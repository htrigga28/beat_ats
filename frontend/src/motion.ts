import { gsap } from "gsap";

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function clearMotionStyles(targets: Element | Element[], properties: string): void {
  gsap.set(targets, { clearProps: properties });
}
