import { describe, it, expect } from "vitest";
import {
  calculateLayout,
  recalculateLayout,
  getOffsetForIndex,
  getIndexAtOffset,
} from "~/core/algorithms/layout-calculator";

describe("calculateLayout", () => {
  it("creates items with cumulative offsets", () => {
    const items = calculateLayout([100, 200, 150]);
    expect(items).toEqual([
      { index: 0, offset: 0, size: 100 },
      { index: 1, offset: 100, size: 200 },
      { index: 2, offset: 300, size: 150 },
    ]);
  });

  it("handles single item", () => {
    const items = calculateLayout([50]);
    expect(items).toEqual([{ index: 0, offset: 0, size: 50 }]);
  });

  it("handles empty array", () => {
    const items = calculateLayout([]);
    expect(items).toEqual([]);
  });

  it("handles uniform sizes", () => {
    const items = calculateLayout([100, 100, 100]);
    expect(items[0]!.offset).toBe(0);
    expect(items[1]!.offset).toBe(100);
    expect(items[2]!.offset).toBe(200);
  });
});

describe("recalculateLayout", () => {
  it("updates offsets from changed index forward", () => {
    const items = calculateLayout([100, 100, 100]);
    recalculateLayout(items, 1, 200);

    expect(items[1]!.size).toBe(200);
    expect(items[2]!.offset).toBe(300); // 100 + 200
  });

  it("does not affect items before changed index", () => {
    const items = calculateLayout([100, 100, 100]);
    recalculateLayout(items, 2, 50);

    expect(items[0]!.offset).toBe(0);
    expect(items[1]!.offset).toBe(100);
    expect(items[2]!.size).toBe(50);
  });

  it("handles out-of-bounds index gracefully", () => {
    const items = calculateLayout([100, 100]);
    recalculateLayout(items, -1, 50);
    recalculateLayout(items, 5, 50);
    // No crash, no mutation
    expect(items[0]!.size).toBe(100);
    expect(items[1]!.size).toBe(100);
  });
});

describe("getOffsetForIndex", () => {
  const items = calculateLayout([100, 200, 150]);
  const viewportSize = 300;

  it("returns item offset for start alignment", () => {
    expect(getOffsetForIndex(items, 0, "start", viewportSize)).toBe(0);
    expect(getOffsetForIndex(items, 1, "start", viewportSize)).toBe(100);
    expect(getOffsetForIndex(items, 2, "start", viewportSize)).toBe(300);
  });

  it("centers item in viewport for center alignment", () => {
    // index 1: offset=100, size=200, viewport=300 → 100 - (300-200)/2 = 50
    expect(getOffsetForIndex(items, 1, "center", viewportSize)).toBe(50);
  });

  it("aligns item end to viewport end for end alignment", () => {
    // index 1: offset=100, size=200, viewport=300 → 100 - (300-200) = 0
    expect(getOffsetForIndex(items, 1, "end", viewportSize)).toBe(0);
  });

  it("returns 0 for empty items", () => {
    expect(getOffsetForIndex([], 0, "start", 100)).toBe(0);
  });

  it("returns 0 for out-of-bounds index", () => {
    expect(getOffsetForIndex(items, -1, "start", 100)).toBe(0);
    expect(getOffsetForIndex(items, 10, "start", 100)).toBe(0);
  });
});

describe("getIndexAtOffset", () => {
  const items = calculateLayout([100, 100, 100, 100, 100]);

  it("returns 0 for offset at start", () => {
    expect(getIndexAtOffset(items, 0)).toBe(0);
  });

  it("returns correct index for offset in middle", () => {
    expect(getIndexAtOffset(items, 150)).toBe(1);
    expect(getIndexAtOffset(items, 250)).toBe(2);
  });

  it("returns last index for offset at the end", () => {
    expect(getIndexAtOffset(items, 450)).toBe(4);
  });

  it("returns correct index at exact boundaries", () => {
    expect(getIndexAtOffset(items, 100)).toBe(1); // exactly at item 1's start
    expect(getIndexAtOffset(items, 200)).toBe(2);
  });

  it("returns 0 for empty items", () => {
    expect(getIndexAtOffset([], 100)).toBe(0);
  });

  it("returns last index for offset beyond content", () => {
    expect(getIndexAtOffset(items, 9999)).toBe(4);
  });
});
