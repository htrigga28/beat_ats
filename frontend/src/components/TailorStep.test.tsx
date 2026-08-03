import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import type { BulletRewriteResponse, GapAnalysis, ResumeDocument } from "../types";
import { changedBulletCount, TailorStep } from "./TailorStep";

const resume: ResumeDocument = {
  contact: { full_name: "Jane Doe", links: [] },
  professional_summary: null,
  work_experience: [
    {
      id: "role-1",
      employer: "Example Labs",
      title: "Frontend Engineer",
      bullets: [
        { id: "b1", text: "Built accessible interfaces" },
        { id: "b2", text: "Improved application performance" },
      ],
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
    target_title: "Frontend Engineer",
    assessment: "aligned",
    rationale: "The source evidence aligns with the target role.",
    equivalent_title_suggestions: [],
  },
  actionable_recommendations: ["A", "B", "C"],
};

const rewriteResponse: BulletRewriteResponse = {
  items: [
    {
      bullet_id: "b1",
      original_text: "Built accessible interfaces",
      alternatives: [
        {
          text: "Built accessible React interfaces",
          incorporated_keywords: ["React", "WCAG"],
        },
        { text: "Delivered accessible interfaces", incorporated_keywords: [] },
      ],
    },
    {
      bullet_id: "b2",
      original_text: "Improved application performance",
      alternatives: [
        { text: "Improved React application performance", incorporated_keywords: ["React"] },
        { text: "Optimized application performance", incorporated_keywords: [] },
      ],
    },
  ],
};

const rewrites = Object.fromEntries(rewriteResponse.items.map((item) => [item.bullet_id, item]));

function renderTailor(overrides: Partial<ComponentProps<typeof TailorStep>> = {}) {
  const onOpen = vi.fn();
  const onSelectionChange = vi.fn();
  const onGenerate = vi.fn();
  const onApply = vi.fn();
  const onRestore = vi.fn();
  const result = render(
    <TailorStep
      resume={resume}
      analysis={analysis}
      jobDescription={"Senior frontend engineer ".repeat(5)}
      rewritesByBulletId={rewrites}
      selectedIds={["b1", "b2"]}
      activeBulletId="b1"
      selectionLocked
      openedSuggestionIds={["b1"]}
      appliedChanges={{}}
      busy={false}
      onSelectionChange={onSelectionChange}
      onGenerate={onGenerate}
      onOpen={onOpen}
      onChangeSelection={vi.fn()}
      onApply={onApply}
      onRestore={onRestore}
      onBack={vi.fn()}
      onContinue={vi.fn()}
      {...overrides}
    />,
  );
  return { ...result, onOpen, onSelectionChange, onGenerate, onApply, onRestore };
}

describe("TailorStep review progress", () => {
  it("shows incomplete bullets and opens the next unreviewed suggestion", async () => {
    const user = userEvent.setup();
    const { onOpen } = renderTailor();

    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByText("Review required")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Proceed to final export" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Review next bullet" }));

    expect(onOpen).toHaveBeenLastCalledWith("b2");
  });

  it("enables export after every selected suggestion has been opened", () => {
    renderTailor({ openedSuggestionIds: ["b1", "b2"] });

    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(screen.queryByText("Review required")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Proceed to final export" })).toBeEnabled();
  });

  it("shows the suggestion pane when the active mobile bullet is counted as reviewed", async () => {
    const { container, onOpen } = renderTailor();
    const mobile = within(container.querySelector(".tailor-mobile") as HTMLElement);

    await waitFor(() =>
      expect(mobile.getByRole("tab", { name: "Suggestions" })).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
    expect(mobile.getByText("Original wording")).toBeVisible();
    expect(onOpen).toHaveBeenCalledWith("b1");
  });

  it("supports explicit selection and batch generation before suggestions are locked", async () => {
    const user = userEvent.setup();
    const { container, onSelectionChange, unmount } = renderTailor({
      selectedIds: [],
      activeBulletId: null,
      selectionLocked: false,
      openedSuggestionIds: [],
      rewritesByBulletId: {},
    });
    const desktop = within(container.querySelector(".tailor-desktop") as HTMLElement);

    await user.click(desktop.getByRole("checkbox", { name: /Built accessible interfaces/ }));
    expect(onSelectionChange).toHaveBeenCalledWith(["b1"]);

    const generate = screen.getByRole("button", { name: "Generate suggestions" });
    expect(generate).toBeDisabled();
    unmount();

    const selectedRender = renderTailor({
      selectedIds: ["b1"],
      activeBulletId: "b1",
      selectionLocked: false,
      openedSuggestionIds: [],
      rewritesByBulletId: {},
    });
    await user.click(screen.getByRole("button", { name: "Generate suggestions" }));
    expect(selectedRender.onGenerate).toHaveBeenCalledWith(["b1"]);
  });

  it("applies and restores wording only through explicit controls", () => {
    vi.useFakeTimers();
    const { container, onApply } = renderTailor();
    const desktop = within(container.querySelector(".tailor-desktop") as HTMLElement);
    const proposal = desktop.getByText("WCAG").closest(".proposal-card") as HTMLElement;

    fireEvent.click(within(proposal).getByRole("button", { name: "Apply wording" }));
    expect(onApply).toHaveBeenCalledWith("b1", "Built accessible React interfaces");
    act(() => vi.runAllTimers());
    vi.useRealTimers();

    const appliedResume = structuredClone(resume);
    appliedResume.work_experience[0].bullets[0].text = "Built accessible React interfaces";
    const applied = renderTailor({
      resume: appliedResume,
      selectedIds: [],
      activeBulletId: null,
      selectionLocked: false,
      openedSuggestionIds: [],
      appliedChanges: {
        b1: {
          bulletId: "b1",
          source: "ai",
          before: "Built accessible interfaces",
          after: "Built accessible React interfaces",
          appliedAt: 1,
        },
      },
    });
    const appliedDesktop = within(
      applied.container.querySelector(".tailor-desktop") as HTMLElement,
    );

    fireEvent.click(appliedDesktop.getByRole("button", { name: "Restore original" }));
    expect(applied.onRestore).toHaveBeenCalledWith("b1");
  });

  it("counts changed work and project bullets against the immutable source", () => {
    const current = structuredClone(resume);
    current.work_experience[0].bullets[0].text = "Changed work wording";
    current.projects = [
      {
        id: "project-1",
        name: "Toolkit",
        bullets: [{ id: "p1", text: "Changed project wording" }],
      },
    ];
    const original = structuredClone(current);
    original.work_experience[0].bullets[0].text = "Original work wording";
    original.projects[0].bullets[0].text = "Original project wording";

    expect(changedBulletCount(current, original)).toBe(2);
  });
});
