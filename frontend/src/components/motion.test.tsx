import { gsap } from "gsap";
import { fireEvent, render } from "@testing-library/react";
import { StrictMode } from "react";
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
    const rendered = render(
      <StrictMode>
        <AnalysisView analysis={analysis} />
      </StrictMode>,
    );
    const target = rendered.container.querySelector<HTMLElement>('[data-motion-ack="analysis"]');
    expect(target).not.toBeNull();
    expect(target?.dataset.motionState).toBe("running");
    expect(rendered.container.querySelector("[data-motion-stage]")).toBeNull();

    rendered.unmount();

    expect(gsap.getTweensOf(target!)).toHaveLength(0);
    expect(target?.style.opacity).toBe("");
    expect(target?.style.transform).toBe("");
  });

  it("acknowledges a completed DOCX and clears the acknowledgement on unmount", () => {
    const rendered = render(
      <StrictMode>
        <ExportCompletionAcknowledgement completion={new Blob(["completed"])} />
      </StrictMode>,
    );
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

    const exportRender = render(
      <ExportCompletionAcknowledgement completion={new Blob(["completed"])} />,
    );
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

  it("does not replay an analysis acknowledgement after a same-state back-navigation remount", () => {
    const completedAnalysis = { ...analysis };
    const firstRender = render(<AnalysisView analysis={completedAnalysis} />);
    expect(
      firstRender.container.querySelector<HTMLElement>('[data-motion-ack="analysis"]')?.dataset
        .motionState,
    ).toBe("running");
    firstRender.unmount();

    const remounted = render(<AnalysisView analysis={completedAnalysis} />);
    const target = remounted.container.querySelector<HTMLElement>('[data-motion-ack="analysis"]');
    expect(target?.dataset.motionState).toBe("settled");
    expect(gsap.getTweensOf(target!)).toHaveLength(0);

    remounted.rerender(<AnalysisView analysis={{ ...completedAnalysis, match_score: 73 }} />);
    expect(target?.dataset.motionState).toBe("running");
  });

  it("does not replay a DOCX acknowledgement after a same-state back-navigation remount", () => {
    const completion = new Blob(["completed"]);
    const firstRender = render(<ExportCompletionAcknowledgement completion={completion} />);
    expect(
      firstRender.container.querySelector<HTMLElement>('[data-motion-ack="export"]')?.dataset
        .motionState,
    ).toBe("running");
    firstRender.unmount();

    const remounted = render(<ExportCompletionAcknowledgement completion={completion} />);
    const target = remounted.container.querySelector<HTMLElement>('[data-motion-ack="export"]');
    expect(target?.dataset.motionState).toBe("settled");
    expect(gsap.getTweensOf(target!)).toHaveLength(0);

    remounted.rerender(
      <ExportCompletionAcknowledgement completion={new Blob(["new completion"])} />,
    );
    expect(target?.dataset.motionState).toBe("running");
  });

  it("shows all returned analysis evidence in the keyboard-accessible disclosure", () => {
    const fullAnalysis: GapAnalysis = {
      ...analysis,
      keyword_gaps: [
        { term: "WCAG", category: "technical_skill", importance: "Required by the role" },
        {
          term: "product strategy",
          category: "domain_experience",
          importance: "Important responsibility",
        },
      ],
      title_alignment: {
        ...analysis.title_alignment,
        assessment: "partial_alignment",
        equivalent_title_suggestions: ["Senior UI Engineer", "Product Engineer"],
      },
      actionable_recommendations: [
        "Describe accessible delivery outcomes.",
        "Connect work to product decisions.",
      ],
    };
    const rendered = render(<AnalysisView analysis={fullAnalysis} />);

    fireEvent.click(rendered.getByRole("button", { name: "View full analysis" }));

    expect(rendered.getByText("partial alignment")).toBeVisible();
    expect(rendered.getByText("Senior UI Engineer")).toBeVisible();
    expect(rendered.getByText("Product Engineer")).toBeVisible();
    expect(rendered.getByText("Category: technical skill")).toBeVisible();
    expect(rendered.getByText("Importance: Required by the role")).toBeVisible();
    expect(rendered.getByText("Category: domain experience")).toBeVisible();
    expect(rendered.getByText("Importance: Important responsibility")).toBeVisible();
    expect(rendered.getByText("Describe accessible delivery outcomes.")).toBeVisible();
    expect(rendered.getByText("Connect work to product decisions.")).toBeVisible();
  });
});
