import { describe, it, expect } from "vitest";
import {
  linear,
  easeOut,
  easeOutCubic,
  easeOutQuart,
  easeInOut,
  resolveEasing,
  EASING_MAP,
} from "~/animation/easing";
import type { EasingFunction } from "~/animation/types";

describe("easing functions", () => {
  describe("boundary values", () => {
    const fns: [string, EasingFunction][] = [
      ["linear", linear],
      ["easeOut", easeOut],
      ["easeOutCubic", easeOutCubic],
      ["easeOutQuart", easeOutQuart],
      ["easeInOut", easeInOut],
    ];

    it.each(fns)("%s returns 0 at t=0", (_name, fn) => {
      expect(fn(0)).toBe(0);
    });

    it.each(fns)("%s returns 1 at t=1", (_name, fn) => {
      expect(fn(1)).toBe(1);
    });
  });

  describe("linear", () => {
    it("is identity", () => {
      expect(linear(0.25)).toBe(0.25);
      expect(linear(0.5)).toBe(0.5);
      expect(linear(0.75)).toBe(0.75);
    });
  });

  describe("easeOut", () => {
    it("fast start — value at 0.5 is greater than 0.5", () => {
      expect(easeOut(0.5)).toBeGreaterThan(0.5);
    });

    it("is monotonically increasing", () => {
      let prev = 0;
      for (let t = 0.01; t <= 1; t += 0.01) {
        const val = easeOut(t);
        expect(val).toBeGreaterThanOrEqual(prev);
        prev = val;
      }
    });
  });

  describe("easeOutCubic", () => {
    it("fast start — value at 0.5 is greater than 0.5", () => {
      expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
    });

    it("is monotonically increasing", () => {
      let prev = 0;
      for (let t = 0.01; t <= 1; t += 0.01) {
        const val = easeOutCubic(t);
        expect(val).toBeGreaterThanOrEqual(prev);
        prev = val;
      }
    });
  });

  describe("easeOutQuart", () => {
    it("fast start — value at 0.5 is greater than 0.5", () => {
      expect(easeOutQuart(0.5)).toBeGreaterThan(0.5);
    });

    it("is monotonically increasing", () => {
      let prev = 0;
      for (let t = 0.01; t <= 1; t += 0.01) {
        const val = easeOutQuart(t);
        expect(val).toBeGreaterThanOrEqual(prev);
        prev = val;
      }
    });
  });

  describe("easeInOut", () => {
    it("is symmetric around 0.5", () => {
      const atQuarter = easeInOut(0.25);
      const atThreeQuarter = easeInOut(0.75);
      expect(atQuarter + atThreeQuarter).toBeCloseTo(1, 10);
    });

    it("value at 0.5 is 0.5", () => {
      expect(easeInOut(0.5)).toBeCloseTo(0.5, 10);
    });

    it("is monotonically increasing", () => {
      let prev = 0;
      for (let t = 0.01; t <= 1; t += 0.01) {
        const val = easeInOut(t);
        expect(val).toBeGreaterThanOrEqual(prev);
        prev = val;
      }
    });
  });

  describe("EASING_MAP", () => {
    it("contains all five presets", () => {
      expect(Object.keys(EASING_MAP)).toHaveLength(5);
      expect(EASING_MAP.linear).toBe(linear);
      expect(EASING_MAP.easeOut).toBe(easeOut);
      expect(EASING_MAP.easeOutCubic).toBe(easeOutCubic);
      expect(EASING_MAP.easeOutQuart).toBe(easeOutQuart);
      expect(EASING_MAP.easeInOut).toBe(easeInOut);
    });
  });

  describe("resolveEasing", () => {
    it("resolves preset name to function", () => {
      expect(resolveEasing("easeOut")).toBe(easeOut);
      expect(resolveEasing("linear")).toBe(linear);
    });

    it("passes through function as-is", () => {
      const custom: EasingFunction = (t) => t * t;
      expect(resolveEasing(custom)).toBe(custom);
    });

    it("throws on unknown preset", () => {
      expect(() => resolveEasing("unknown" as never)).toThrow(
        'Unknown easing preset: "unknown"',
      );
    });
  });
});
