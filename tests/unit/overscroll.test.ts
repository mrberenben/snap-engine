import { describe, it, expect } from "vitest";
import {
  clampOffset,
  isAtBoundary,
  applyElasticOverscroll,
} from "~/core/algorithms/overscroll";
import { calculateLayout } from "~/core/algorithms/layout-calculator";

describe("clampOffset", () => {
  const items = calculateLayout([100, 100, 100]); // total = 300
  const viewportSize = 100;

  it("returns offset when within bounds", () => {
    expect(clampOffset(50, items, viewportSize)).toBe(50);
    expect(clampOffset(150, items, viewportSize)).toBe(150);
  });

  it("clamps to 0 when below bounds", () => {
    expect(clampOffset(-50, items, viewportSize)).toBe(0);
  });

  it("clamps to max when above bounds", () => {
    // max = 300 - 100 = 200
    expect(clampOffset(250, items, viewportSize)).toBe(200);
  });

  it("returns 0 for empty items", () => {
    expect(clampOffset(100, [], viewportSize)).toBe(0);
  });

  it("handles viewport larger than content", () => {
    const smallItems = calculateLayout([50]);
    // max = max(0, 50-100) = 0
    expect(clampOffset(10, smallItems, 100)).toBe(0);
  });
});

describe("isAtBoundary", () => {
  const items = calculateLayout([100, 100, 100]); // total = 300
  const viewportSize = 100;

  it('returns "start" at offset 0', () => {
    expect(isAtBoundary(0, items, viewportSize)).toBe("start");
  });

  it('returns "start" at negative offset', () => {
    expect(isAtBoundary(-10, items, viewportSize)).toBe("start");
  });

  it('returns "end" at max offset', () => {
    expect(isAtBoundary(200, items, viewportSize)).toBe("end");
  });

  it('returns "end" beyond max offset', () => {
    expect(isAtBoundary(250, items, viewportSize)).toBe("end");
  });

  it("returns null in the middle", () => {
    expect(isAtBoundary(100, items, viewportSize)).toBeNull();
  });

  it("returns null for empty items", () => {
    expect(isAtBoundary(0, [], viewportSize)).toBeNull();
  });
});

describe("applyElasticOverscroll", () => {
  it("applies resistance factor to overshoot", () => {
    // offset=50 past boundary=0 with factor=0.3 → 0 + 50*0.3 = 15
    expect(applyElasticOverscroll(50, 0, 0.3)).toBe(15);
  });

  it("returns boundary when offset equals boundary", () => {
    expect(applyElasticOverscroll(0, 0, 0.3)).toBe(0);
  });

  it("handles negative overshoot", () => {
    // offset=-30, boundary=0, factor=0.3 → 0 + (-30)*0.3 = -9
    expect(applyElasticOverscroll(-30, 0, 0.3)).toBe(-9);
  });

  it("uses default factor of 0.3", () => {
    expect(applyElasticOverscroll(100, 0)).toBe(30);
  });

  it("works with non-zero boundary", () => {
    // offset=250, boundary=200, factor=0.5 → 200 + 50*0.5 = 225
    expect(applyElasticOverscroll(250, 200, 0.5)).toBe(225);
  });
});
