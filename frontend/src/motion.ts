import { gsap } from "gsap";

const acknowledgedMotionTokens = new WeakSet<object>();

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function clearMotionStyles(targets: Element | Element[], properties: string): void {
  gsap.set(targets, { clearProps: properties });
}

export function claimMotionAcknowledgement(token: object): boolean {
  if (acknowledgedMotionTokens.has(token)) return false;
  acknowledgedMotionTokens.add(token);
  return true;
}
