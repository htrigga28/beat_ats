import { useEffect, useRef } from "react";
import { ExportStep } from "./components/ExportStep";
import { ReviewStep } from "./components/ReviewStep";
import { TailorStep } from "./components/TailorStep";
import { UploadStep } from "./components/UploadStep";
import { rewritesAsResponse, SessionProvider, useSession } from "./SessionContext";
import type { Step } from "./types";

const labels = ["Upload", "Review", "Tailor", "Export"] as const;

function Application() {
  const {
    state,
    retry,
    downloadUrl,
    uploadResume,
    saveResume,
    requestRewrites,
    applyChoices,
    reanalyze,
    createDocx,
    clearSession,
    setStep,
  } = useSession();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const rewrites = rewritesAsResponse(state);

  useEffect(() => {
    headingRef.current?.focus();
  }, [state.step]);

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
            {state.error.retryable && retry && (
              <button className="button button-secondary" type="button" onClick={retry}>
                Retry
              </button>
            )}
          </div>
        )}
        {state.step === 1 && (
          <UploadStep
            config={state.config}
            busy={Boolean(state.activeRequest)}
            onUpload={uploadResume}
          />
        )}
        {state.step === 2 && state.resume && (
          <ReviewStep
            resume={state.resume}
            warnings={state.warnings.filter(
              (warning) => !state.dismissedWarnings.includes(warning),
            )}
            analysis={state.analysis}
            analysisStale={state.analysisStale}
            busy={Boolean(state.activeRequest)}
            onSave={saveResume}
            onContinue={() => setStep(3)}
          />
        )}
        {state.step === 3 && state.resume && (
          <TailorStep
            resume={state.resume}
            rewrites={rewrites}
            selectedIds={state.selectedBulletIds}
            choices={{}}
            busy={Boolean(state.activeRequest)}
            onRequest={requestRewrites}
            onChoice={() => undefined}
            onApply={applyChoices}
            onBack={() => setStep(2)}
            onContinue={() => setStep(4)}
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
            onBack={() => setStep(3)}
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

export function App() {
  return (
    <SessionProvider>
      <Application />
    </SessionProvider>
  );
}
