import { gsap } from "gsap";
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { clearMotionStyles, prefersReducedMotion } from "../motion";
import type { Step } from "../types";

interface Props {
  step: Step;
  stepperRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}

export function StageMotionBoundary({ step, stepperRef, children }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [motionState, setMotionState] = useState("settled");

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const marker = stepperRef.current?.querySelector<HTMLElement>(`[data-step-marker="${step}"]`);
    const targets = [stage, marker].filter(
      (target): target is HTMLElement => target !== null && target !== undefined,
    );
    if (!stage) return;

    setMotionState("running");
    if (prefersReducedMotion()) {
      clearMotionStyles(targets, "opacity,transform");
      setMotionState("settled");
      return;
    }

    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        defaults: { ease: "power3.out" },
        onComplete: () => {
          clearMotionStyles(targets, "opacity,transform");
          setMotionState("settled");
        },
      });
      timeline.set(stage, { autoAlpha: 0, y: 12 });
      if (marker) {
        timeline.set(marker, { autoAlpha: 0.62 }, 0).to(marker, { autoAlpha: 1, duration: 0.2 }, 0);
      }
      timeline.to(stage, { autoAlpha: 1, y: 0, duration: 0.65 }, 0);
    }, stage);

    return () => {
      context.revert();
      clearMotionStyles(targets, "opacity,transform");
    };
  }, [step, stepperRef]);

  return (
    <div ref={stageRef} data-motion-stage={step} data-motion-state={motionState}>
      {children}
    </div>
  );
}
