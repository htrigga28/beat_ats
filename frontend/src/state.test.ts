import { describe, expect, it } from "vitest";
import { initialState, reducer } from "./state";
import type { GapAnalysis, ResumeDocument, WorkflowState } from "./types";

const resume: ResumeDocument = {
  contact: { full_name: "Jane Doe", links: [] },
  professional_summary: null,
  work_experience: [
    {
      id: "role-1",
      employer: "Example",
      title: "Engineer",
      bullets: [{ id: "b1", text: "Built a thing" }],
    },
  ],
  skills: [],
  education: [],
  certifications: [],
  projects: [
    {
      id: "project-1",
      name: "Toolkit",
      bullets: [{ id: "p1", text: "Published a toolkit" }],
    },
  ],
  additional_sections: [],
};

const analysis: GapAnalysis = {
  match_score: 80,
  keyword_gaps: [],
  title_alignment: {
    target_title: "Engineer",
    assessment: "aligned",
    rationale: "Aligned",
    equivalent_title_suggestions: [],
  },
  actionable_recommendations: ["A", "B", "C"],
};

function ingestedState() {
  return reducer(initialState, {
    type: "ingested",
    resume,
    jobDescription: "A sufficiently long target job description for testing.",
    warnings: ["Check columns"],
  });
}

describe("session reducer", () => {
  it("keeps extracted and current resumes as separate immutable snapshots", () => {
    const state = ingestedState();
    expect(state.step).toBe(2);
    expect(state.originalResume).toEqual(state.resume);
    expect(state.originalResume).not.toBe(state.resume);
    expect(state.resume).not.toBe(resume);
  });

  it("stores proposals without choosing or applying one", () => {
    const source = reducer(ingestedState(), { type: "selected", ids: ["b1"] });
    const state = reducer(source, {
      type: "rewritesLoaded",
      rewrites: {
        items: [
          {
            bullet_id: "b1",
            original_text: "Built a thing",
            alternatives: [
              { text: "Built a better thing", incorporated_keywords: [] },
              { text: "Delivered a thing", incorporated_keywords: [] },
            ],
          },
        ],
      },
    });
    expect(state.resume).toEqual(source.resume);
    expect(state.appliedChanges).toEqual({});
    expect(state.rewritesByBulletId.b1.alternatives).toHaveLength(2);
    expect(state.selectionLocked).toBe(true);
  });

  it("caps selection, locks it after generation, and records opened suggestions", () => {
    let state = ingestedState();
    state = reducer(state, {
      type: "selected",
      ids: Array.from({ length: 12 }, (_, index) => `b${index}`),
    });
    expect(state.selectedBulletIds).toHaveLength(10);
    state = reducer(state, { type: "rewritesLoaded", rewrites: { items: [] } });
    const locked = reducer(state, { type: "selected", ids: ["different"] });
    expect(locked.selectedBulletIds).toEqual(state.selectedBulletIds);
    state = reducer(state, { type: "suggestionsOpened", id: "b1" });
    state = reducer(state, { type: "suggestionsOpened", id: "b1" });
    expect(state.openedSuggestionIds).toEqual(["b1"]);
    expect(state.activeBulletId).toBe("b1");
  });

  it("preserves an active selected bullet and unlocks a generated selection", () => {
    let state = reducer(ingestedState(), { type: "selected", ids: ["b1", "p1"] });
    state = reducer(state, { type: "activeBullet", id: "p1" });
    state = reducer(state, { type: "selected", ids: ["p1"] });
    expect(state.activeBulletId).toBe("p1");
    state = reducer(state, { type: "rewritesLoaded", rewrites: { items: [] } });
    state = reducer(state, { type: "selectionUnlocked" });
    expect(state.selectionLocked).toBe(false);
    expect(state.rewritesByBulletId).toEqual({});
  });

  it("invalidates analysis-derived and export state after manual resume edits", () => {
    let state = reducer(ingestedState(), { type: "analysisLoaded", analysis });
    state = {
      ...state,
      selectedBulletIds: ["b1"],
      selectionLocked: true,
      rewritesByBulletId: {
        b1: { bullet_id: "b1", original_text: "Built a thing", alternatives: [] },
      },
      truthConfirmations: { factual: true, advisory: true },
      docxBlob: new Blob(["docx"]),
    };
    const edited = structuredClone(resume);
    edited.contact.full_name = "Jane Q. Doe";
    state = reducer(state, { type: "resumeUpdated", resume: edited });
    expect(state.analysisStale).toBe(true);
    expect(state.rewritesByBulletId).toEqual({});
    expect(state.selectedBulletIds).toEqual([]);
    expect(state.truthConfirmations).toEqual({ factual: false, advisory: false });
    expect(state.docxBlob).toBeNull();
  });

  it("keeps only AI change records whose applied wording still exists after review edits", () => {
    const appliedResume = structuredClone(resume);
    appliedResume.work_experience[0].bullets[0].text = "Built a better thing";
    let state: WorkflowState = {
      ...ingestedState(),
      resume: appliedResume,
      appliedChanges: {
        b1: {
          bulletId: "b1",
          source: "ai",
          before: "Built a thing",
          after: "Built a better thing",
          appliedAt: 1,
        },
      },
    };

    const unrelatedEdit = structuredClone(appliedResume);
    unrelatedEdit.contact.location = "Lagos";
    state = reducer(state, { type: "resumeUpdated", resume: unrelatedEdit });
    expect(state.appliedChanges.b1).toBeDefined();

    const overwrittenBullet = structuredClone(unrelatedEdit);
    overwrittenBullet.work_experience[0].bullets[0].text = "Manually revised wording";
    state = reducer(state, { type: "resumeUpdated", resume: overwrittenBullet });
    expect(state.appliedChanges).toEqual({});
  });

  it("applies only an explicit suggestion while retaining generated proposals", () => {
    const source = reducer(ingestedState(), { type: "analysisLoaded", analysis });
    const edited = structuredClone(resume);
    edited.work_experience[0].bullets[0].text = "Built a better thing";
    const state = reducer(
      {
        ...source,
        selectedBulletIds: ["b1"],
        selectionLocked: true,
        rewritesByBulletId: {
          b1: { bullet_id: "b1", original_text: "Built a thing", alternatives: [] },
        },
        truthConfirmations: { factual: true, advisory: true },
      },
      {
        type: "suggestionApplied",
        resume: edited,
        change: {
          bulletId: "b1",
          source: "ai",
          before: "Built a thing",
          after: "Built a better thing",
          appliedAt: 1,
        },
      },
    );
    expect(state.resume?.work_experience[0].bullets[0].text).toBe("Built a better thing");
    expect(state.originalResume?.work_experience[0].bullets[0].text).toBe("Built a thing");
    expect(state.rewritesByBulletId.b1).toBeDefined();
    expect(state.truthConfirmations).toEqual({ factual: false, advisory: false });
  });

  it("restores an applied bullet without mutating the immutable extraction", () => {
    const edited = structuredClone(resume);
    edited.work_experience[0].bullets[0].text = "Built a better thing";
    let state: WorkflowState = {
      ...ingestedState(),
      resume: edited,
      appliedChanges: {
        b1: {
          bulletId: "b1",
          source: "ai" as const,
          before: "Built a thing",
          after: "Built a better thing",
          appliedAt: 1,
        },
      },
    };
    state = reducer(state, { type: "bulletRestored", resume, bulletId: "b1" });
    expect(state.appliedChanges).toEqual({});
    expect(state.resume?.work_experience[0].bullets[0].text).toBe("Built a thing");
    expect(state.originalResume?.work_experience[0].bullets[0].text).toBe("Built a thing");
  });

  it("dismisses warnings and clears private state while retaining deployment config", () => {
    const configured = reducer(ingestedState(), {
      type: "configLoaded",
      config: {
        max_upload_bytes: 10,
        accepted_extensions: ["pdf"],
        vision_fallback_available: true,
        gemini_model: "gemini-3.1-flash-lite",
      },
    });
    const dismissed = reducer(configured, {
      type: "warningDismissed",
      warning: "Check columns",
    });
    expect(dismissed.dismissedWarnings).toEqual(["Check columns"]);
    const duplicate = reducer(dismissed, {
      type: "warningDismissed",
      warning: "Check columns",
    });
    expect(duplicate).toBe(dismissed);
    const cleared = reducer(duplicate, { type: "clear" });
    expect(cleared.jobDescription).toBe("");
    expect(cleared.resume).toBeNull();
    expect(cleared.config?.max_upload_bytes).toBe(10);
  });

  it("tracks bounded upload progress and normalized request errors", () => {
    let state = reducer(initialState, { type: "requestStarted", label: "Working" });
    state = reducer(state, { type: "uploadProgress", progress: 140 });
    expect(state.uploadProgress).toBe(100);
    state = reducer(state, {
      type: "error",
      error: { code: "failed", message: "Try again", retryable: true },
    });
    expect(state.activeRequest).toBeNull();
    expect(state.error?.retryable).toBe(true);
  });

  it("tracks request phases, confirmations, exports, and explicit navigation", () => {
    let state = reducer(initialState, { type: "uploadProgress", progress: -20 });
    expect(state.uploadProgress).toBe(0);
    state = reducer(state, {
      type: "ingestionProgress",
      event: {
        type: "progress",
        stage: "parsing",
        sequence: 1,
        message: "Parsing",
      },
    });
    expect(state.ingestionPhase?.stage).toBe("parsing");
    state = reducer(state, { type: "requestStarted", label: "Working" });
    state = reducer(state, { type: "requestFinished" });
    expect(state.activeRequest).toBeNull();
    state = reducer(state, {
      type: "error",
      error: { code: "failed", message: "No", retryable: false },
    });
    state = reducer(state, { type: "errorCleared" });
    expect(state.error).toBeNull();
    state = reducer(state, { type: "truthConfirmation", key: "factual", checked: true });
    expect(state.truthConfirmations.factual).toBe(true);
    const blob = new Blob(["docx"]);
    state = reducer(state, { type: "docxCompilationStarted" });
    expect(state.exportStatus).toBe("compiling");
    state = reducer(state, { type: "docxLoaded", blob });
    expect(state.docxBlob).toBe(blob);
    expect(state.exportStatus).toBe("downloading");
    state = reducer(state, { type: "docxDownloadFinished" });
    expect(state.exportStatus).toBe("idle");
    state = reducer(state, { type: "step", step: 4 });
    expect(state.step).toBe(4);
    state = reducer(state, { type: "analysisLoaded", analysis, advance: false });
    expect(state.step).toBe(4);
  });
});
