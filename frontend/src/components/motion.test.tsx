import { gsap } from "gsap";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysisView } from "./AnalysisView";
import { ExportCompletionAcknowledgement } from "./ExportCompletionAcknowledgement";
import type { GapAnalysis } from "../types";

const analysis: GapAnalysis = {
  match_score: 72,
  keyword_gaps: [],
  title_alignment: {
    target_title: "Frontend Engineer",
    assessment: "aligned",
    rationale: "The source evidence aligns with the role.",
    equivalent_title_suggestions: [],
  },
  actionable_recommendations: [],
};

describe("motion acknowledgements", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  });

  it("keeps analysis acknowledgement inside its child target and clears it on unmount", () => {
    const rendered = render(<AnalysisView analysis={analysis} />);
    const target = rendered.container.querySelector<HTMLElement>('[data-motion-ack="analysis"]');
    expect(target).not.toBeNull();
    expect(target?.dataset.motionState).toBe("running");
    expect(rendered.container.querySelector("[data-motion-stage]")).toBeNull();

    rendered.unmount();

    expect(gsap.getTweensOf(target!)).toHaveLength(0);
    expect(target?.style.opacity).toBe("");
    expect(target?.style.transform).toBe("");
  });

  it("does not acknowledge truth readiness and acknowledges only a completed DOCX", () => {
    const rendered = render(<ExportCompletionAcknowledgement complete={false} />);
    expect(rendered.container.querySelector('[data-motion-ack="export"]')).toBeNull();

    rendered.rerender(<ExportCompletionAcknowledgement complete />);
    const target = rendered.container.querySelector<HTMLElement>('[data-motion-ack="export"]');
    expect(target).not.toBeNull();
    expect(target?.dataset.motionState).toBe("running");

    rendered.unmount();

    expect(gsap.getTweensOf(target!)).toHaveLength(0);
    expect(target?.style.opacity).toBe("");
    expect(target?.style.transform).toBe("");
  });

  it("keeps acknowledgement state without spatial motion when reduced motion is requested", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    const analysisRender = render(<AnalysisView analysis={analysis} />);
    const analysisTarget = analysisRender.container.querySelector<HTMLElement>(
      '[data-motion-ack="analysis"]',
    );

    expect(analysisTarget?.dataset.motionState).toBe("settled");
    expect(analysisTarget?.style.opacity).toBe("");
    expect(analysisTarget?.style.transform).toBe("");
    analysisRender.unmount();

    const exportRender = render(<ExportCompletionAcknowledgement complete />);
    const exportTarget = exportRender.container.querySelector<HTMLElement>(
      '[data-motion-ack="export"]',
    );

    expect(exportTarget?.dataset.motionState).toBe("settled");
    expect(exportTarget?.style.opacity).toBe("");
    expect(exportTarget?.style.transform).toBe("");
  });

  it("keeps a low advisory score distinct from the motion acknowledgement", () => {
    const lowScoreAnalysis = { ...analysis, match_score: 40 };
    const rendered = render(<AnalysisView analysis={lowScoreAnalysis} />);

    expect(rendered.container.querySelector(".score-orb")).toHaveClass("is-low");
  });
});
