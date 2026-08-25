import { gsap } from "gsap";

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function clearMotionStyles(
  targets: Element | Element[] | null | undefined,
  properties: string,
): void {
  const elements = (Array.isArray(targets) ? targets : [targets]).filter(
    (target): target is Element => target !== null && target !== undefined,
  );
  if (elements.length > 0) gsap.set(elements, { clearProps: properties });
}
