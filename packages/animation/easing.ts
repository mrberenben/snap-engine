import type { EasingFunction, EasingPreset } from "~/animation/types";

export const linear: EasingFunction = t => t;

export const easeOut: EasingFunction = t => 1 - (1 - t) * (1 - t);

export const easeOutCubic: EasingFunction = t => 1 - (1 - t) ** 3;

export const easeOutQuart: EasingFunction = t => 1 - (1 - t) ** 4;

export const easeInOut: EasingFunction = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export const EASING_MAP: Record<EasingPreset, EasingFunction> = {
  linear,
  easeOut,
  easeInOut,
  easeOutCubic,
  easeOutQuart
};

export function resolveEasing(easing: EasingFunction | EasingPreset): EasingFunction {
  if (typeof easing === "function") {
    return easing;
  }
  const fn = EASING_MAP[easing];
  if (!fn) {
    throw new Error(`Unknown easing preset: "${easing}"`);
  }
  return fn;
}
