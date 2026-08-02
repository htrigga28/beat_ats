import { describe, expect, it } from "vitest";
import { initialState, reducer } from "./state";

describe("workflow reducer", () => {
  it("selects the first rewrite without changing the source resume", () => {
    const state = reducer(initialState, {
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
    expect(state.choices.b1).toBe("Built a better thing");
    expect(state.resume).toBeNull();
  });

  it("leaves an empty choice when a rewrite has no alternatives", () => {
    const state = reducer(initialState, {
      type: "rewritesLoaded",
      rewrites: { items: [{ bullet_id: "b2", original_text: "Source", alternatives: [] }] },
    });
    expect(state.choices.b2).toBe("");
  });

  it("clears private session data while retaining deployment config", () => {
    const configured = reducer(initialState, {
      type: "configLoaded",
      config: {
        max_upload_bytes: 10,
        accepted_extensions: ["pdf"],
        vision_fallback_available: true,
        gemini_model: "gemini-3.1-flash-lite",
      },
    });
    const cleared = reducer({ ...configured, jobDescription: "private" }, { type: "clear" });
    expect(cleared.jobDescription).toBe("");
    expect(cleared.config?.max_upload_bytes).toBe(10);
  });

  it("handles request, resume, analysis, selection, apply, and download transitions", () => {
    const resume = {
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
      projects: [],
      additional_sections: [],
    };
    const analysis = {
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
    let state = reducer(initialState, { type: "requestStarted", label: "Working" });
    expect(state.activeRequest).toBe("Working");
    state = reducer(state, { type: "requestFinished" });
    state = reducer(state, {
      type: "ingested",
      resume,
      jobDescription: "A long job description",
      warnings: ["Check this"],
    });
    expect(state.originalResume).not.toBe(state.resume);
    state = reducer(state, { type: "resumeSaved", resume, stale: true });
    state = reducer(state, { type: "analysisLoaded", analysis });
    state = reducer(state, { type: "selected", ids: ["b1"] });
    state = reducer(state, { type: "choice", id: "b1", text: "Built a better thing" });
    state = reducer(state, {
      type: "rewritesApplied",
      resume: {
        ...resume,
        work_experience: [
          { ...resume.work_experience[0], bullets: [{ id: "b1", text: "Built a better thing" }] },
        ],
      },
    });
    state = reducer(state, { type: "docxLoaded", blob: new Blob(["docx"]) });
    state = reducer(state, { type: "step", step: 3 });
    expect(state.step).toBe(3);
  });

  it("stores a normalized error", () => {
    const state = reducer(initialState, {
      type: "error",
      error: { code: "failed", message: "Try again", retryable: true },
    });
    expect(state.error?.retryable).toBe(true);
  });
});
