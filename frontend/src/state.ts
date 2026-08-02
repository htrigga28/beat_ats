import type {
  BulletRewriteResponse,
  NormalizedError,
  ResumeDocument,
  RuntimeConfig,
  Step,
  WorkflowState,
} from "./types";

export const initialState: WorkflowState = {
  step: 1,
  config: null,
  resume: null,
  originalResume: null,
  jobDescription: "",
  warnings: [],
  analysis: null,
  analysisStale: false,
  selectedBulletIds: [],
  rewrites: null,
  choices: {},
  docxBlob: null,
  error: null,
  activeRequest: null,
};

type Action =
  | { type: "configLoaded"; config: RuntimeConfig }
  | { type: "requestStarted"; label: string }
  | { type: "requestFinished" }
  | { type: "error"; error: NormalizedError }
  | { type: "ingested"; resume: ResumeDocument; jobDescription: string; warnings: string[] }
  | { type: "resumeSaved"; resume: ResumeDocument; stale: boolean }
  | { type: "analysisLoaded"; analysis: WorkflowState["analysis"] }
  | { type: "selected"; ids: string[] }
  | { type: "rewritesLoaded"; rewrites: BulletRewriteResponse }
  | { type: "choice"; id: string; text: string }
  | { type: "rewritesApplied"; resume: ResumeDocument }
  | { type: "docxLoaded"; blob: Blob }
  | { type: "step"; step: Step }
  | { type: "clear" };

export function reducer(state: WorkflowState, action: Action): WorkflowState {
  switch (action.type) {
    case "configLoaded":
      return { ...state, config: action.config, error: null };
    case "requestStarted":
      return { ...state, activeRequest: action.label, error: null };
    case "requestFinished":
      return { ...state, activeRequest: null };
    case "error":
      return { ...state, activeRequest: null, error: action.error };
    case "ingested":
      return {
        ...state,
        step: 2,
        resume: action.resume,
        originalResume: structuredClone(action.resume),
        jobDescription: action.jobDescription,
        warnings: action.warnings,
        analysis: null,
        analysisStale: false,
        rewrites: null,
        choices: {},
        docxBlob: null,
        error: null,
      };
    case "resumeSaved":
      return {
        ...state,
        resume: action.resume,
        analysisStale: action.stale,
        rewrites: null,
        choices: {},
        docxBlob: null,
        error: null,
      };
    case "analysisLoaded":
      return { ...state, analysis: action.analysis, analysisStale: false, error: null };
    case "selected":
      return { ...state, selectedBulletIds: action.ids };
    case "rewritesLoaded":
      return {
        ...state,
        rewrites: action.rewrites,
        choices: Object.fromEntries(
          action.rewrites.items.map((item) => [item.bullet_id, item.alternatives[0]?.text ?? ""]),
        ),
        error: null,
      };
    case "choice":
      return { ...state, choices: { ...state.choices, [action.id]: action.text } };
    case "rewritesApplied":
      return {
        ...state,
        step: 4,
        resume: action.resume,
        analysisStale: true,
        rewrites: null,
        choices: {},
        docxBlob: null,
      };
    case "docxLoaded":
      return { ...state, docxBlob: action.blob, error: null };
    case "step":
      return { ...state, step: action.step, error: null };
    case "clear":
      return { ...initialState, config: state.config };
  }
}
