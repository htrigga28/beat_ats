import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionProvider, useSession } from "./SessionContext";
import type { BulletRewriteResponse, GapAnalysis, ResumeDocument, RuntimeConfig } from "./types";

const api = vi.hoisted(() => ({
  analyzeResume: vi.fn(),
  generateDocx: vi.fn(),
  getConfig: vi.fn(),
  ingestResumeStream: vi.fn(),
  normalizeError: vi.fn(),
  rewriteBullets: vi.fn(),
}));

vi.mock("./api", () => api);

const config: RuntimeConfig = {
  max_upload_bytes: 10_000_000,
  accepted_extensions: [".pdf"],
  vision_fallback_available: false,
  gemini_model: "test-model",
};

const resume: ResumeDocument = {
  contact: { full_name: "Jane Doe", links: [] },
  professional_summary: null,
  work_experience: [
    {
      id: "role-1",
      employer: "Example",
      title: "Engineer",
      bullets: [{ id: "b1", text: "Built accessible interfaces" }],
    },
  ],
  skills: [],
  education: [],
  certifications: [],
  projects: [],
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
  actionable_recommendations: [],
};

const rewrites: BulletRewriteResponse = {
  items: [
    {
      bullet_id: "b1",
      original_text: "Built accessible interfaces",
      alternatives: [
        { text: "Built accessible React interfaces", incorporated_keywords: ["React"] },
      ],
    },
  ],
};

type Session = ReturnType<typeof useSession>;

function Probe({ expose }: { expose: (session: Session) => void }) {
  expose(useSession());
  return null;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("request lifecycle", () => {
  let session: Session;

  beforeEach(async () => {
    vi.clearAllMocks();
    api.getConfig.mockResolvedValue(config);
    render(
      <SessionProvider>
        <Probe expose={(value) => (session = value)} />
      </SessionProvider>,
    );
    await waitFor(() => expect(session.state.config).toEqual(config));
    act(() => {
      session.dispatch({
        type: "ingested",
        resume,
        jobDescription: "A sufficiently detailed target role for frontend engineering work.",
        warnings: [],
      });
    });
  });

  it("rejects an old analysis and keeps a newer request busy after a target edit", async () => {
    const first = deferred<GapAnalysis>();
    const second = deferred<GapAnalysis>();
    api.analyzeResume.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    act(() => session.saveResume(resume, true));
    act(() =>
      session.updateJobDescription("A new frontend role that requires React and TypeScript."),
    );
    act(() => session.saveResume(resume, true));

    expect(api.analyzeResume).toHaveBeenLastCalledWith(
      resume,
      "A new frontend role that requires React and TypeScript.",
      true,
      expect.any(AbortSignal),
    );
    expect(session.state.activeRequest).toBe("Comparing resume evidence");

    await act(async () => first.resolve(analysis));
    expect(session.state.step).toBe(2);
    expect(session.state.analysis).toBeNull();
    expect(session.state.activeRequest).toBe("Comparing resume evidence");

    await act(async () => second.resolve(analysis));
    expect(session.state.step).toBe(3);
    expect(session.state.analysis).toEqual(analysis);
    expect(session.state.activeRequest).toBeNull();
  });

  it("does not restore stale rewrites or a DOCX after the target changes", async () => {
    const rewrite = deferred<BulletRewriteResponse>();
    const docx = deferred<Blob>();
    api.rewriteBullets.mockReturnValue(rewrite.promise);
    api.generateDocx.mockReturnValue(docx.promise);

    act(() => session.requestRewrites(["b1"]));
    act(() =>
      session.updateJobDescription("A new frontend role that requires React and TypeScript."),
    );
    await act(async () => rewrite.resolve(rewrites));

    expect(session.state.rewritesByBulletId).toEqual({});
    expect(session.state.selectedBulletIds).toEqual([]);

    act(() => session.createDocx());
    act(() =>
      session.updateJobDescription("A third frontend role that requires accessible UI delivery."),
    );
    await act(async () => docx.resolve(new Blob(["docx"])));

    expect(session.state.docxBlob).toBeNull();
    expect(session.state.exportStatus).toBe("idle");
  });

  it("shows a retryable analysis error and retries the saved request", async () => {
    api.analyzeResume
      .mockRejectedValueOnce({
        code: "provider_unavailable",
        message: "Try again",
        retryable: true,
      })
      .mockResolvedValueOnce(analysis);

    act(() => session.saveResume(resume, true));
    await waitFor(() => expect(session.state.error?.code).toBe("provider_unavailable"));
    expect(session.retry).not.toBeNull();

    act(() => session.retry?.());
    await waitFor(() => expect(session.state.analysis).toEqual(analysis));
    expect(api.analyzeResume).toHaveBeenCalledTimes(2);
    expect(session.state.error).toBeNull();
  });

  it("normalizes an unknown request error", async () => {
    api.analyzeResume.mockRejectedValueOnce(new Error("offline"));
    api.normalizeError.mockReturnValueOnce({
      code: "request_failed",
      message: "The private API is unavailable.",
      retryable: true,
    });

    act(() => session.saveResume(resume, true));
    await waitFor(() => expect(session.state.error?.code).toBe("request_failed"));
    expect(api.normalizeError).toHaveBeenCalled();
  });

  it("aborts and ignores late requests when cancelled or cleared", async () => {
    const cancelled = deferred<GapAnalysis>();
    const cleared = deferred<GapAnalysis>();
    api.analyzeResume.mockReturnValueOnce(cancelled.promise).mockReturnValueOnce(cleared.promise);

    act(() => session.saveResume(resume, true));
    const cancelledSignal = api.analyzeResume.mock.calls[0][3] as AbortSignal;
    act(() => session.cancelActiveRequest());
    expect(cancelledSignal.aborted).toBe(true);
    expect(session.state.activeRequest).toBeNull();
    expect(session.retry).toBeNull();
    await act(async () => cancelled.resolve(analysis));
    expect(session.state.analysis).toBeNull();

    act(() => session.saveResume(resume, true));
    const clearedSignal = api.analyzeResume.mock.calls[1][3] as AbortSignal;
    act(() => session.clearSession());
    expect(clearedSignal.aborted).toBe(true);
    await act(async () => cleared.resolve(analysis));
    expect(session.state.resume).toBeNull();
    expect(session.state.analysis).toBeNull();
  });

  it("keeps selection, wording, navigation, and clearing controls in the session boundary", () => {
    act(() => session.selectBullets(["b1"]));
    act(() => session.openSuggestions("b1"));
    expect(session.state.openedSuggestionIds).toEqual(["b1"]);

    act(() => session.changeSelection());
    expect(session.state.selectionLocked).toBe(false);

    act(() => session.applySuggestion("b1", "Built accessible React interfaces"));
    expect(session.state.appliedChanges.b1?.after).toBe("Built accessible React interfaces");

    act(() => session.restoreBullet("b1"));
    expect(session.state.appliedChanges).toEqual({});

    act(() => session.setStep(4));
    expect(session.state.step).toBe(4);

    act(() => session.clearSession());
    expect(session.state.resume).toBeNull();
    expect(session.state.config).toEqual(config);
  });
});
