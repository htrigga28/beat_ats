import { CheckCircle2 } from "lucide-react";
import { gsap } from "gsap";
import { useLayoutEffect, useRef } from "react";
import { clearMotionStyles, prefersReducedMotion } from "../motion";

export function ExportCompletionAcknowledgement() {
  const acknowledgementRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const target = acknowledgementRef.current;
    if (!target) return;
    target.dataset.motionState = "running";

    if (prefersReducedMotion()) {
      clearMotionStyles(target, "backgroundColor,boxShadow,opacity,transform");
      target.dataset.motionState = "settled";
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        target,
        {
          autoAlpha: 0.72,
          backgroundColor: "rgba(236, 253, 245, 0.82)",
          boxShadow: "0 0 0 3px rgba(167, 243, 208, 0.66)",
        },
        {
          autoAlpha: 1,
          backgroundColor: "rgba(236, 253, 245, 0)",
          boxShadow: "0 0 0 0 rgba(167, 243, 208, 0)",
          duration: 0.22,
          ease: "power2.out",
          clearProps: "opacity,backgroundColor,boxShadow",
          onComplete: () => {
            target.dataset.motionState = "settled";
          },
        },
      );
    }, target);

    return () => {
      context.revert();
      clearMotionStyles(target, "backgroundColor,boxShadow,opacity,transform");
      target.dataset.motionState = "settled";
    };
  }, []);

  return (
    <span
      ref={acknowledgementRef}
      className="export-complete"
      data-motion-ack="export"
      data-motion-state="settled"
      role="status"
    >
      <CheckCircle2 aria-hidden="true" /> Word document ready. You can download it again.
    </span>
  );
}
