import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import {
  analyzeResume,
  generateDocx,
  getConfig,
  ingestResumeStream,
  normalizeError,
  rewriteBullets,
} from "./api";
import { initialState, reducer, type Action } from "./state";
import type { AppliedChange, NormalizedError, ResumeDocument, Step, WorkflowState } from "./types";

interface SessionContextValue {
  state: WorkflowState;
  dispatch: React.Dispatch<Action>;
  retry: (() => void) | null;
  uploadResume: (
    file: File,
    jobDescription: string,
    consent: boolean,
    visionConsent: boolean,
  ) => void;
  saveResume: (resume: ResumeDocument, shouldAnalyze: boolean) => void;
  updateJobDescription: (jobDescription: string) => void;
  requestRewrites: (ids: string[]) => void;
  selectBullets: (ids: string[]) => void;
  openSuggestions: (id: string) => void;
  changeSelection: () => void;
  applySuggestion: (bulletId: string, text: string) => void;
  restoreBullet: (bulletId: string) => void;
  reanalyze: () => void;
  createDocx: () => void;
  downloadDocx: () => void;
  clearSession: () => void;
  cancelActiveRequest: () => void;
  setStep: (step: Step) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);
const maxJobDescriptionLength = 50_000;

function replaceBulletText(
  source: ResumeDocument,
  replacements: Record<string, string>,
): ResumeDocument {
  const resume = structuredClone(source);
  for (const role of resume.work_experience) {
    for (const bullet of role.bullets) {
      if (replacements[bullet.id]) bullet.text = replacements[bullet.id].trim();
    }
  }
  for (const project of resume.projects) {
    for (const bullet of project.bullets) {
      if (replacements[bullet.id]) bullet.text = replacements[bullet.id].trim();
    }
  }
  return resume;
}

function findBulletText(resume: ResumeDocument, bulletId: string): string | null {
  for (const role of resume.work_experience) {
    const bullet = role.bullets.find((item) => item.id === bulletId);
    if (bullet) return bullet.text;
  }
  for (const project of resume.projects) {
    const bullet = project.bullets.find((item) => item.id === bulletId);
    if (bullet) return bullet.text;
  }
  return null;
}

function downloadDocxBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tailored_resume.docx";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  const requestRef = useRef<{ id: number; controller: AbortController } | null>(null);
  const nextRequestId = useRef(0);
  const retryRef = useRef<(() => void) | null>(null);
  stateRef.current = state;

  const invalidateRequest = useCallback(() => {
    requestRef.current?.controller.abort();
    requestRef.current = null;
    nextRequestId.current += 1;
    retryRef.current = null;
  }, []);

  const run = useCallback(
    async <T,>(
      label: string,
      task: (signal: AbortSignal) => Promise<T>,
      onSuccess: (result: T) => void,
      retry?: () => void,
    ) => {
      requestRef.current?.controller.abort();
      const controller = new AbortController();
      const id = ++nextRequestId.current;
      requestRef.current = { id, controller };
      retryRef.current = retry ?? null;
      dispatch({ type: "requestStarted", label });
      try {
        const result = await task(controller.signal);
        if (requestRef.current?.id !== id || controller.signal.aborted) return;
        onSuccess(result);
      } catch (error) {
        if (requestRef.current?.id !== id || controller.signal.aborted) return;
        const normalized =
          error && typeof error === "object" && "code" in error
            ? (error as NormalizedError)
            : normalizeError(error);
        dispatch({ type: "error", error: normalized });
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
    void run("Loading deployment settings", getConfig, (config) => {
      dispatch({ type: "configLoaded", config });
    });
    return () => requestRef.current?.controller.abort();
  }, [run]);

  const uploadResume = useCallback(
    (file: File, jobDescription: string, consent: boolean, visionConsent: boolean) => {
      const body = new FormData();
      body.append("file", file);
      body.append("ai_processing_consent", String(consent));
      body.append("allow_vision_fallback", String(visionConsent));
      const retry = () => uploadResume(file, jobDescription, consent, visionConsent);
      void run(
        "Extracting resume",
        (signal) =>
          ingestResumeStream(
            body,
            {
              onUploadProgress: (progress) => dispatch({ type: "uploadProgress", progress }),
              onEvent: (event) => {
                if (event.type === "progress") dispatch({ type: "ingestionProgress", event });
              },
            },
            signal,
          ),
        (result) => {
          dispatch({
            type: "ingested",
            resume: result.resume,
            jobDescription: jobDescription.trim(),
            warnings: result.warnings ?? [],
          });
        },
        retry,
      );
    },
    [run],
  );

  const saveResume = useCallback(
    (resume: ResumeDocument, shouldAnalyze: boolean) => {
      const changed = JSON.stringify(resume) !== JSON.stringify(stateRef.current.resume);
      if (changed) invalidateRequest();
      if (changed) dispatch({ type: "resumeUpdated", resume });
      if (!shouldAnalyze) return;
      const jobDescription = stateRef.current.jobDescription.trim();
      if (jobDescription.length < 50 || jobDescription.length > maxJobDescriptionLength) {
        dispatch({
          type: "error",
          error: {
            code:
              jobDescription.length < 50 ? "job_description_too_short" : "job_description_too_long",
            message:
              jobDescription.length < 50
                ? "Enter a target job description with at least 50 characters before comparison."
                : "Use a target job description with no more than 50,000 characters before comparison.",
            retryable: false,
          },
        });
        return;
      }
      const retry = () => saveResume(resume, true);
      void run(
        "Comparing resume evidence",
        (signal) => analyzeResume(resume, jobDescription, true, signal),
        (analysis) => dispatch({ type: "analysisLoaded", analysis }),
        retry,
      );
    },
    [invalidateRequest, run],
  );

  const requestRewrites = useCallback(
    (ids: string[]) => {
      const snapshot = stateRef.current;
      if (!snapshot.resume || ids.length === 0) return;
      dispatch({ type: "selected", ids });
      const retry = () => requestRewrites(ids);
      void run(
        "Drafting alternatives",
        (signal) => rewriteBullets(snapshot.resume!, snapshot.jobDescription, ids, true, signal),
        (rewrites) => dispatch({ type: "rewritesLoaded", rewrites }),
        retry,
      );
    },
    [run],
  );

  const applyChoices = useCallback(
    (choices: Record<string, string>) => {
      const snapshot = stateRef.current;
      if (!snapshot.resume) return;
      let resume = snapshot.resume;
      for (const [bulletId, text] of Object.entries(choices)) {
        if (!text.trim()) continue;
        const before = findBulletText(resume, bulletId);
        if (!before || before === text.trim()) continue;
        resume = replaceBulletText(resume, { [bulletId]: text });
        const change: AppliedChange = {
          bulletId,
          source: "ai",
          before: snapshot.appliedChanges[bulletId]?.before ?? before,
          after: text.trim(),
          appliedAt: Date.now(),
        };
        invalidateRequest();
        dispatch({ type: "suggestionApplied", resume, change });
      }
    },
    [invalidateRequest],
  );

  const selectBullets = useCallback((ids: string[]) => dispatch({ type: "selected", ids }), []);
  const openSuggestions = useCallback(
    (id: string) => dispatch({ type: "suggestionsOpened", id }),
    [],
  );
  const changeSelection = useCallback(() => dispatch({ type: "selectionUnlocked" }), []);
  const applySuggestion = useCallback(
    (bulletId: string, text: string) => applyChoices({ [bulletId]: text }),
    [applyChoices],
  );
  const restoreBullet = useCallback(
    (bulletId: string) => {
      const snapshot = stateRef.current;
      if (!snapshot.resume || !snapshot.originalResume) return;
      const originalText =
        snapshot.appliedChanges[bulletId]?.before ??
        findBulletText(snapshot.originalResume, bulletId);
      if (!originalText) return;
      const resume = replaceBulletText(snapshot.resume, { [bulletId]: originalText });
      invalidateRequest();
      dispatch({ type: "bulletRestored", resume, bulletId });
    },
    [invalidateRequest],
  );

  const reanalyze = useCallback(() => {
    const snapshot = stateRef.current;
    if (!snapshot.resume) return;
    const retry = () => reanalyze();
    void run(
      "Refreshing advisory analysis",
      (signal) => analyzeResume(snapshot.resume!, snapshot.jobDescription, true, signal),
      (analysis) => dispatch({ type: "analysisLoaded", analysis, advance: false }),
      retry,
    );
  }, [run]);

  const createDocx = useCallback(() => {
    const snapshot = stateRef.current;
    if (!snapshot.resume) return;
    const retry = () => createDocx();
    dispatch({ type: "docxCompilationStarted" });
    void run(
      "Building Word document",
      (signal) => generateDocx(snapshot.resume!, signal),
      (blob) => {
        dispatch({ type: "docxLoaded", blob });
        downloadDocxBlob(blob);
        dispatch({ type: "docxDownloadFinished" });
      },
      retry,
    );
  }, [run]);

  const downloadDocx = useCallback(() => {
    const blob = stateRef.current.docxBlob;
    if (blob) downloadDocxBlob(blob);
  }, []);

  const updateJobDescription = useCallback(
    (jobDescription: string) => {
      const nextJobDescription = jobDescription.slice(0, maxJobDescriptionLength);
      if (nextJobDescription === stateRef.current.jobDescription) return;
      invalidateRequest();
      dispatch({ type: "jobDescriptionUpdated", jobDescription: nextJobDescription });
    },
    [invalidateRequest],
  );
  const clearSession = useCallback(() => {
    invalidateRequest();
    dispatch({ type: "clear" });
  }, [invalidateRequest]);

  const cancelActiveRequest = useCallback(() => {
    invalidateRequest();
    dispatch({ type: "requestFinished" });
  }, [invalidateRequest]);
  const setStep = useCallback((step: Step) => dispatch({ type: "step", step }), []);

  const value = useMemo<SessionContextValue>(
    () => ({
      state,
      dispatch,
      retry: retryRef.current,
      uploadResume,
      saveResume,
      updateJobDescription,
      requestRewrites,
      selectBullets,
      openSuggestions,
      changeSelection,
      applySuggestion,
      restoreBullet,
      reanalyze,
      createDocx,
      downloadDocx,
      clearSession,
      cancelActiveRequest,
      setStep,
    }),
    [
      state,
      uploadResume,
      saveResume,
      updateJobDescription,
      requestRewrites,
      selectBullets,
      openSuggestions,
      changeSelection,
      applySuggestion,
      restoreBullet,
      reanalyze,
      createDocx,
      downloadDocx,
      clearSession,
      cancelActiveRequest,
      setStep,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
