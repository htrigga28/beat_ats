import { gsap } from "gsap";
import { render } from "@testing-library/react";
import { StrictMode, useRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StageMotionBoundary } from "./StageMotionBoundary";
import type { Step } from "../types";

function Harness({ step, showMarkers = true }: { step: Step; showMarkers?: boolean }) {
  const stepperRef = useRef<HTMLElement>(null);
  return (
    <>
      <nav ref={stepperRef}>
        {showMarkers &&
          [1, 2, 3, 4].map((marker) => <span data-step-marker={marker} key={marker} />)}
      </nav>
      <StageMotionBoundary step={step} stepperRef={stepperRef}>
        <section>Stage {step}</section>
      </StageMotionBoundary>
    </>
  );
}

describe("stage motion lifecycle", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  });

  it("cleans owned GSAP targets after Strict Mode replay and an interrupted step change", () => {
    const rendered = render(
      <StrictMode>
        <Harness step={2} />
      </StrictMode>,
    );
    const reviewStage = document.querySelector<HTMLElement>('[data-motion-stage="2"]');
    expect(reviewStage).not.toBeNull();

    rendered.rerender(
      <StrictMode>
        <Harness step={3} />
      </StrictMode>,
    );
    const tailorStage = document.querySelector<HTMLElement>('[data-motion-stage="3"]');
    expect(tailorStage).not.toBeNull();

    rendered.rerender(
      <StrictMode>
        <Harness step={2} />
      </StrictMode>,
    );
    const finalStage = document.querySelector<HTMLElement>('[data-motion-stage="2"]');
    const markers = Array.from(document.querySelectorAll<HTMLElement>("[data-step-marker]"));
    expect(document.querySelectorAll("[data-motion-stage]")).toHaveLength(1);
    expect(finalStage).not.toBeNull();

    rendered.unmount();

    for (const target of [reviewStage, tailorStage, finalStage, ...markers]) {
      if (!target) continue;
      expect(gsap.getTweensOf(target)).toHaveLength(0);
      expect(target.style.opacity).toBe("");
      expect(target.style.transform).toBe("");
    }
  });

  it("settles immediately without a marker when reduced motion is requested", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    const rendered = render(<Harness step={2} showMarkers={false} />);
    const stage = rendered.container.querySelector<HTMLElement>('[data-motion-stage="2"]');

    expect(stage?.dataset.motionState).toBe("settled");
    expect(stage?.style.opacity).toBe("");
    expect(stage?.style.transform).toBe("");
  });
});
