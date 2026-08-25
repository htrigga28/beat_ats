import type {
  AppliedChange,
  BulletRewriteResponse,
  GapAnalysis,
  IngestionStreamEvent,
  NormalizedError,
  ResumeDocument,
  RuntimeConfig,
  Step,
  TruthConfirmations,
  WorkflowState,
} from "./types";

const unchecked: TruthConfirmations = { factual: false, advisory: false };

export const initialState: WorkflowState = {
  step: 1,
  config: null,
  resume: null,
  originalResume: null,
  jobDescription: "",
  warnings: [],
  dismissedWarnings: [],
  analysis: null,
  analysisStale: false,
  selectedBulletIds: [],
  activeBulletId: null,
  selectionLocked: false,
  rewritesByBulletId: {},
  openedSuggestionIds: [],
  appliedChanges: {},
  truthConfirmations: unchecked,
  docxBlob: null,
  exportStatus: "idle",
  error: null,
  activeRequest: null,
  uploadProgress: 0,
  ingestionPhase: null,
};

export type Action =
  | { type: "configLoaded"; config: RuntimeConfig }
  | { type: "requestStarted"; label: string }
  | { type: "requestFinished" }
  | { type: "uploadProgress"; progress: number }
  | { type: "ingestionProgress"; event: Extract<IngestionStreamEvent, { type: "progress" }> }
  | { type: "error"; error: NormalizedError }
  | { type: "errorCleared" }
  | { type: "ingested"; resume: ResumeDocument; jobDescription: string; warnings: string[] }
  | { type: "resumeUpdated"; resume: ResumeDocument }
  | { type: "jobDescriptionUpdated"; jobDescription: string }
  | { type: "analysisLoaded"; analysis: GapAnalysis; advance?: boolean }
  | { type: "warningDismissed"; warning: string }
  | { type: "selected"; ids: string[] }
  | { type: "activeBullet"; id: string | null }
  | { type: "rewritesLoaded"; rewrites: BulletRewriteResponse }
  | { type: "selectionUnlocked" }
  | { type: "suggestionsOpened"; id: string }
  | { type: "suggestionApplied"; resume: ResumeDocument; change: AppliedChange }
  | { type: "bulletRestored"; resume: ResumeDocument; bulletId: string }
  | { type: "truthConfirmation"; key: keyof TruthConfirmations; checked: boolean }
  | { type: "docxLoaded"; blob: Blob }
  | { type: "docxCompilationStarted" }
  | { type: "docxDownloadFinished" }
  | { type: "step"; step: Step }
  | { type: "clear" };

function invalidateDependents(
  state: WorkflowState,
  updates: Pick<WorkflowState, "resume" | "jobDescription" | "appliedChanges">,
): WorkflowState {
  const { resume, jobDescription, appliedChanges } = updates;
  return {
    ...state,
    resume,
    jobDescription,
    analysisStale: state.analysis !== null,
    selectedBulletIds: [],
    activeBulletId: null,
    selectionLocked: false,
    rewritesByBulletId: {},
    openedSuggestionIds: [],
    appliedChanges,
    truthConfirmations: unchecked,
    docxBlob: null,
    exportStatus: "idle",
    activeRequest: null,
    error: null,
  };
}

function invalidateResumeDependents(state: WorkflowState, resume: ResumeDocument): WorkflowState {
  const currentBulletText = new Map(
    [...resume.work_experience, ...resume.projects].flatMap((entry) =>
      entry.bullets.map((bullet) => [bullet.id, bullet.text] as const),
    ),
  );
  const appliedChanges = Object.fromEntries(
    Object.entries(state.appliedChanges).filter(
      ([bulletId, change]) => currentBulletText.get(bulletId) === change.after,
    ),
  );
  return invalidateDependents(state, {
    resume,
    jobDescription: state.jobDescription,
    appliedChanges,
  });
}

export function reducer(state: WorkflowState, action: Action): WorkflowState {
  switch (action.type) {
    case "configLoaded":
      return { ...state, config: action.config, error: null };
    case "requestStarted":
      return { ...state, activeRequest: action.label, error: null };
    case "requestFinished":
      return { ...state, activeRequest: null };
    case "uploadProgress":
      return { ...state, uploadProgress: Math.max(0, Math.min(100, action.progress)) };
    case "ingestionProgress":
      return { ...state, ingestionPhase: action.event };
    case "error":
      return { ...state, activeRequest: null, exportStatus: "idle", error: action.error };
    case "errorCleared":
      return { ...state, error: null };
    case "ingested":
      return {
        ...initialState,
        config: state.config,
        step: 2,
        resume: structuredClone(action.resume),
        originalResume: structuredClone(action.resume),
        jobDescription: action.jobDescription,
        warnings: action.warnings,
      };
    case "resumeUpdated":
      return invalidateResumeDependents(state, structuredClone(action.resume));
    case "jobDescriptionUpdated":
      return invalidateDependents(state, {
        resume: state.resume,
        jobDescription: action.jobDescription,
        appliedChanges: state.appliedChanges,
      });
    case "analysisLoaded":
      return {
        ...state,
        step: action.advance === false ? state.step : 3,
        analysis: action.analysis,
        analysisStale: false,
        error: null,
      };
    case "warningDismissed":
      return state.dismissedWarnings.includes(action.warning)
        ? state
        : { ...state, dismissedWarnings: [...state.dismissedWarnings, action.warning] };
    case "selected":
      return state.selectionLocked
        ? state
        : {
            ...state,
            selectedBulletIds: action.ids.slice(0, 10),
            activeBulletId: action.ids.includes(state.activeBulletId ?? "")
              ? state.activeBulletId
              : (action.ids[0] ?? null),
          };
    case "activeBullet":
      return { ...state, activeBulletId: action.id };
    case "rewritesLoaded":
      return {
        ...state,
        selectionLocked: true,
        rewritesByBulletId: Object.fromEntries(
          action.rewrites.items.map((item) => [item.bullet_id, item]),
        ),
        activeBulletId: state.activeBulletId ?? state.selectedBulletIds[0] ?? null,
        openedSuggestionIds: [],
        error: null,
      };
    case "selectionUnlocked":
      return {
        ...state,
        selectionLocked: false,
        rewritesByBulletId: {},
        openedSuggestionIds: [],
        activeBulletId: state.selectedBulletIds[0] ?? null,
      };
    case "suggestionsOpened":
      return state.openedSuggestionIds.includes(action.id)
        ? { ...state, activeBulletId: action.id }
        : {
            ...state,
            activeBulletId: action.id,
            openedSuggestionIds: [...state.openedSuggestionIds, action.id],
          };
    case "suggestionApplied":
      return {
        ...state,
        resume: structuredClone(action.resume),
        analysisStale: state.analysis !== null,
        appliedChanges: { ...state.appliedChanges, [action.change.bulletId]: action.change },
        truthConfirmations: unchecked,
        docxBlob: null,
        exportStatus: "idle",
        error: null,
      };
    case "bulletRestored": {
      const appliedChanges = { ...state.appliedChanges };
      delete appliedChanges[action.bulletId];
      return {
        ...state,
        resume: structuredClone(action.resume),
        analysisStale: state.analysis !== null,
        appliedChanges,
        truthConfirmations: unchecked,
        docxBlob: null,
        exportStatus: "idle",
      };
    }
    case "truthConfirmation":
      return {
        ...state,
        truthConfirmations: { ...state.truthConfirmations, [action.key]: action.checked },
      };
    case "docxLoaded":
      return { ...state, docxBlob: action.blob, exportStatus: "downloading", error: null };
    case "docxCompilationStarted":
      return { ...state, exportStatus: "compiling", error: null };
    case "docxDownloadFinished":
      return { ...state, exportStatus: "idle" };
    case "step":
      return { ...state, step: action.step, error: null };
    case "clear":
      return { ...initialState, config: state.config };
  }
}
