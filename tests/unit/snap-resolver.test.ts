import { describe, it, expect } from "vitest";
import {
  resolveSnap,
  findNearestSnap,
  findDirectionalSnap,
} from "~/core/algorithms/snap-resolver";
import { calculateLayout } from "~/core/algorithms/layout-calculator";
import type { ResolveSnapParams } from "~/core/algorithms/snap-resolver";

function makeParams(overrides: Partial<ResolveSnapParams> = {}): ResolveSnapParams {
  const items = overrides.items ?? calculateLayout([100, 100, 100, 100, 100]);
  return {
    items,
    currentIndex: 0,
    currentOffset: 0,
    velocity: 0,
    velocityThreshold: 0.5,
    multiSkipFactor: 1,
    maxSkipCount: 3,
    alignment: "start",
    viewportSize: 100,
    ...overrides,
  };
}

describe("resolveSnap", () => {
  it("returns nearest snap when velocity is below threshold", () => {
    const result = resolveSnap(makeParams({ velocity: 0.3, currentOffset: 80 }));
    expect(result.targetIndex).toBe(1); // nearest to offset 80 with items at 0, 100, 200...
  });

  it("returns directional snap when velocity exceeds threshold", () => {
    const result = resolveSnap(makeParams({ velocity: 1.0, currentIndex: 1 }));
    expect(result.targetIndex).toBe(2); // forward from index 1
    expect(result.direction).toBe(1);
  });

  it("handles empty items", () => {
    const result = resolveSnap(makeParams({ items: [] }));
    expect(result.targetIndex).toBe(0);
    expect(result.targetOffset).toBe(0);
  });
});

describe("findNearestSnap", () => {
  it("snaps to nearest item by distance (start alignment)", () => {
    const result = findNearestSnap(makeParams({ currentOffset: 130 }));
    expect(result.targetIndex).toBe(1); // offset 100 is closer than 200
  });

  it("snaps to nearest item at exact midpoint (first wins)", () => {
    const result = findNearestSnap(makeParams({ currentOffset: 50 }));
    // offset 0 distance=50, offset 100 distance=50 → first wins (index 0)
    expect(result.targetIndex).toBe(0);
  });

  it("snaps to last item when offset is beyond content", () => {
    const result = findNearestSnap(makeParams({ currentOffset: 999 }));
    expect(result.targetIndex).toBe(4);
  });

  it("works with center alignment", () => {
    // 5 items of 100px, viewport=100. Center snap point for index 0 = 0 - (100-100)/2 = 0
    // Center snap point for index 1 = 100 - 0 = 100
    const result = findNearestSnap(
      makeParams({ currentOffset: 90, alignment: "center" })
    );
    expect(result.targetIndex).toBe(1);
  });

  it("works with end alignment", () => {
    // End snap: offset - (viewport - size) = offset - 0 = offset for same-sized items
    const result = findNearestSnap(
      makeParams({ currentOffset: 80, alignment: "end" })
    );
    expect(result.targetIndex).toBe(1);
  });

  it("reports direction relative to currentIndex", () => {
    const result = findNearestSnap(
      makeParams({ currentIndex: 0, currentOffset: 180 })
    );
    expect(result.direction).toBe(1);
    expect(result.skippedCount).toBe(2);
  });

  it("handles empty items", () => {
    const result = findNearestSnap(makeParams({ items: [] }));
    expect(result.targetIndex).toBe(0);
  });
});

describe("findDirectionalSnap", () => {
  it("snaps forward with positive velocity", () => {
    const result = findDirectionalSnap(
      makeParams({ velocity: 1.0, currentIndex: 1 })
    );
    expect(result.targetIndex).toBe(2);
    expect(result.direction).toBe(1);
    expect(result.skippedCount).toBe(1);
  });

  it("snaps backward with negative velocity", () => {
    const result = findDirectionalSnap(
      makeParams({ velocity: -1.0, currentIndex: 2 })
    );
    expect(result.targetIndex).toBe(1);
    expect(result.direction).toBe(-1);
  });

  it("clamps to first index on backward overshoot", () => {
    const result = findDirectionalSnap(
      makeParams({ velocity: -5.0, currentIndex: 1, maxSkipCount: 10 })
    );
    expect(result.targetIndex).toBe(0);
  });

  it("clamps to last index on forward overshoot", () => {
    const result = findDirectionalSnap(
      makeParams({ velocity: 5.0, currentIndex: 3, maxSkipCount: 10 })
    );
    expect(result.targetIndex).toBe(4);
  });

  it("multi-skip: skips multiple items with high velocity", () => {
    const result = findDirectionalSnap(
      makeParams({
        velocity: 3.0,
        currentIndex: 0,
        multiSkipFactor: 1,
        maxSkipCount: 5,
      })
    );
    expect(result.targetIndex).toBe(3); // round(3.0 * 1) = 3 skips
    expect(result.skippedCount).toBe(3);
  });

  it("multi-skip: respects maxSkipCount", () => {
    const result = findDirectionalSnap(
      makeParams({
        velocity: 10.0,
        currentIndex: 0,
        multiSkipFactor: 1,
        maxSkipCount: 2,
      })
    );
    // round(10 * 1) = 10, clamped to maxSkipCount=2
    expect(result.skippedCount).toBeLessThanOrEqual(2);
  });
});
