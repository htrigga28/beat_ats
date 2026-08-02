import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import {
  analyzeResume,
  generateDocx,
  getConfig,
  ingestResume,
  normalizeError,
  rewriteBullets,
} from "./api";
import { initialState, reducer } from "./state";
import type { NormalizedError, ResumeDocument, Step } from "./types";
import { ExportStep } from "./components/ExportStep";
import { ReviewStep } from "./components/ReviewStep";
import { TailorStep } from "./components/TailorStep";
import { UploadStep } from "./components/UploadStep";

const labels = ["Upload", "Review", "Tailor", "Export"] as const;

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const requestRef = useRef<{ id: number; controller: AbortController } | null>(null);
  const nextRequestId = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const retryRef = useRef<(() => void) | null>(null);

  const run = useCallback(
    async <T,>(label: string, task: (signal: AbortSignal) => Promise<T>, retry?: () => void) => {
      requestRef.current?.controller.abort();
      const controller = new AbortController();
      const id = ++nextRequestId.current;
      requestRef.current = { id, controller };
      retryRef.current = retry ?? null;
      dispatch({ type: "requestStarted", label });
      try {
        return await task(controller.signal);
      } catch (error) {
        if (controller.signal.aborted) return undefined;
        const normalized =
          error && typeof error === "object" && "code" in error
            ? (error as NormalizedError)
            : normalizeError(error);
        dispatch({ type: "error", error: normalized });
        return undefined;
      } finally {
        if (requestRef.current?.id === id) {
          requestRef.current = null;
          dispatch({ type: "requestFinished" });
        }
      }
    },
    [],
  );

  useEffect(() => {
    void run("Loading deployment settings", (signal) =>
      getConfig(signal).then((config) => {
        dispatch({ type: "configLoaded", config });
        return config;
      }),
    );
    return () => requestRef.current?.controller.abort();
  }, [run]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [state.step]);

  const clearSession = () => {
    requestRef.current?.controller.abort();
    dispatch({ type: "clear" });
  };

  const onUpload = (
    file: File,
    jobDescription: string,
    consent: boolean,
    visionConsent: boolean,
  ) => {
    const body = new FormData();
    body.append("file", file);
    body.append("ai_processing_consent", String(consent));
    body.append("allow_vision_fallback", String(visionConsent));
    void run(
      "Extracting resume",
      (signal) =>
        ingestResume(body, signal).then((result) => {
          dispatch({
            type: "ingested",
            resume: result.resume,
            jobDescription: jobDescription.trim(),
            warnings: result.warnings ?? [],
          });
          return result;
        }),
      () => onUpload(file, jobDescription, consent, visionConsent),
    );
  };

  const saveResume = (resume: ResumeDocument, shouldAnalyze: boolean) => {
    const changed = JSON.stringify(resume) !== JSON.stringify(state.resume);
    if (!shouldAnalyze) {
      dispatch({ type: "resumeSaved", resume, stale: changed && state.analysis !== null });
      return;
    }
    dispatch({ type: "resumeSaved", resume, stale: false });
    void run(
      "Comparing resume evidence",
      (signal) =>
        analyzeResume(resume, state.jobDescription, true, signal).then((analysis) => {
          dispatch({ type: "analysisLoaded", analysis });
          return analysis;
        }),
      () => saveResume(resume, true),
    );
  };

  const requestRewrites = (ids: string[]) => {
    dispatch({ type: "selected", ids });
    void run(
      "Drafting alternatives",
      (signal) =>
        rewriteBullets(state.resume!, state.jobDescription, ids, true, signal).then((rewrites) => {
          dispatch({ type: "rewritesLoaded", rewrites });
          return rewrites;
        }),
      () => requestRewrites(ids),
    );
  };

  const applyRewrites = (choices: Record<string, string>) => {
    if (!state.resume) return;
    const resume = structuredClone(state.resume);
    for (const role of resume.work_experience ?? [])
      for (const bullet of role.bullets ?? [])
        if (choices[bullet.id]) bullet.text = choices[bullet.id].trim();
    dispatch({ type: "rewritesApplied", resume });
  };

  const reanalyze = () => {
    if (state.resume) saveResume(state.resume, true);
  };

  const downloadUrl = useMemo(
    () => (state.docxBlob ? URL.createObjectURL(state.docxBlob) : null),
    [state.docxBlob],
  );
  useEffect(
    () => () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    },
    [downloadUrl],
  );

  const createDocx = () => {
    if (state.resume)
      void run(
        "Building Word document",
        (signal) =>
          generateDocx(state.resume!, signal).then((blob) => {
            dispatch({ type: "docxLoaded", blob });
            return blob;
          }),
        () => createDocx(),
      );
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <div>
          <p className="kicker">PRIVATE DOCUMENT WORKSPACE</p>
          <p className="brand">Beat ATS</p>
          <p className="tagline">Tailor to the role. Keep every fact yours.</p>
        </div>
        <button
          className="button button-secondary clear-button"
          type="button"
          onClick={clearSession}
        >
          Clear session
        </button>
      </header>
      <nav className="progress-register" aria-label="Tailoring progress">
        {labels.map((label, index) => {
          const step = (index + 1) as Step;
          const complete = state.step > step;
          return (
            <div
              className={`progress-step ${complete ? "complete" : ""} ${state.step === step ? "current" : ""}`}
              aria-current={state.step === step ? "step" : undefined}
              key={label}
            >
              <span className="progress-marker">{complete ? "✓" : step}</span>
              <span>{label}</span>
              <span className="progress-status">
                {complete ? "completed" : state.step === step ? "current" : "pending"}
              </span>
            </div>
          );
        })}
      </nav>
      <main className="work-surface">
        <div className="surface-heading">
          <p className="surface-index">STAGE {state.step} / 04</p>
          <h1 ref={headingRef} tabIndex={-1}>
            {labels[state.step - 1]}
          </h1>
          {state.activeRequest && (
            <p className="status-line" role="status">
              {state.activeRequest}…
            </p>
          )}
        </div>
        {state.error && (
          <div
            className={`alert ${state.error.retryable ? "alert-warning" : "alert-error"}`}
            role="alert"
          >
            <strong>
              {state.error.retryable
                ? "The service needs another try."
                : "The request could not be completed."}
            </strong>
            <span>{state.error.message}</span>
            {state.error.requestId && <small>Request ID: {state.error.requestId}</small>}
            {state.error.retryable && retryRef.current && (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => retryRef.current?.()}
              >
                Retry
              </button>
            )}
          </div>
        )}
        {state.step === 1 && (
          <UploadStep
            config={state.config}
            busy={Boolean(state.activeRequest)}
            onUpload={onUpload}
          />
        )}
        {state.step === 2 && state.resume && (
          <ReviewStep
            resume={state.resume}
            warnings={state.warnings}
            analysis={state.analysis}
            analysisStale={state.analysisStale}
            busy={Boolean(state.activeRequest)}
            onSave={saveResume}
            onContinue={() => dispatch({ type: "step", step: 3 })}
          />
        )}
        {state.step === 3 && state.resume && (
          <TailorStep
            resume={state.resume}
            rewrites={state.rewrites}
            selectedIds={state.selectedBulletIds}
            choices={state.choices}
            busy={Boolean(state.activeRequest)}
            onRequest={requestRewrites}
            onChoice={(id, text) => dispatch({ type: "choice", id, text })}
            onApply={applyRewrites}
            onBack={() => dispatch({ type: "step", step: 2 })}
            onContinue={() => dispatch({ type: "step", step: 4 })}
          />
        )}
        {state.step === 4 && state.resume && state.originalResume && (
          <ExportStep
            resume={state.resume}
            original={state.originalResume}
            analysisStale={state.analysisStale}
            busy={Boolean(state.activeRequest)}
            downloadUrl={downloadUrl}
            onGenerate={createDocx}
            onReanalyze={reanalyze}
            onBack={() => dispatch({ type: "step", step: 3 })}
          />
        )}
      </main>
      <footer className="privacy-footer">
        <span>
          In-memory session only. Refreshing or clearing this page removes the working document.
        </span>
        <a href="/docs">API documentation</a>
      </footer>
    </div>
  );
}
