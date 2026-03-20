import { describe, it, expect } from "vitest";
import { VirtualLayout } from "~/middleware/virtualizer/virtual-layout";

describe("VirtualLayout", () => {
  describe("uniform estimatedItemSize", () => {
    it("offsets are sequential multiples of item size", () => {
      const layout = new VirtualLayout({ itemCount: 5, estimatedItemSize: 100 });

      expect(layout.getItemOffset(0)).toBe(0);
      expect(layout.getItemOffset(1)).toBe(100);
      expect(layout.getItemOffset(2)).toBe(200);
      expect(layout.getItemOffset(3)).toBe(300);
      expect(layout.getItemOffset(4)).toBe(400);
    });

    it("all sizes are the estimated size", () => {
      const layout = new VirtualLayout({ itemCount: 3, estimatedItemSize: 50 });

      expect(layout.getItemSize(0)).toBe(50);
      expect(layout.getItemSize(1)).toBe(50);
      expect(layout.getItemSize(2)).toBe(50);
    });

    it("totalSize is itemCount * estimatedItemSize", () => {
      const layout = new VirtualLayout({ itemCount: 10, estimatedItemSize: 100 });
      expect(layout.getTotalSize()).toBe(1000);
    });
  });

  describe("callback estimatedItemSize", () => {
    it("applies per-item estimates", () => {
      const layout = new VirtualLayout({
        itemCount: 3,
        estimatedItemSize: (i) => (i + 1) * 100
      });

      expect(layout.getItemSize(0)).toBe(100);
      expect(layout.getItemSize(1)).toBe(200);
      expect(layout.getItemSize(2)).toBe(300);
      expect(layout.getItemOffset(0)).toBe(0);
      expect(layout.getItemOffset(1)).toBe(100);
      expect(layout.getItemOffset(2)).toBe(300);
      expect(layout.getTotalSize()).toBe(600);
    });
  });

  describe("getIndexAtOffset", () => {
    it("returns correct index at exact boundary", () => {
      const layout = new VirtualLayout({ itemCount: 5, estimatedItemSize: 100 });

      expect(layout.getIndexAtOffset(0)).toBe(0);
      expect(layout.getIndexAtOffset(100)).toBe(1);
      expect(layout.getIndexAtOffset(200)).toBe(2);
    });

    it("returns correct index at mid-item", () => {
      const layout = new VirtualLayout({ itemCount: 5, estimatedItemSize: 100 });

      expect(layout.getIndexAtOffset(50)).toBe(0);
      expect(layout.getIndexAtOffset(150)).toBe(1);
      expect(layout.getIndexAtOffset(350)).toBe(3);
    });

    it("clamps to last item when beyond end", () => {
      const layout = new VirtualLayout({ itemCount: 5, estimatedItemSize: 100 });
      expect(layout.getIndexAtOffset(999)).toBe(4);
    });

    it("returns 0 for negative offset", () => {
      const layout = new VirtualLayout({ itemCount: 5, estimatedItemSize: 100 });
      expect(layout.getIndexAtOffset(-50)).toBe(0);
    });

    it("returns 0 for empty layout", () => {
      const layout = new VirtualLayout({ itemCount: 0, estimatedItemSize: 100 });
      expect(layout.getIndexAtOffset(50)).toBe(0);
    });
  });

  describe("getVisibleRange", () => {
    it("returns correct start/end with overscan", () => {
      const layout = new VirtualLayout({ itemCount: 20, estimatedItemSize: 100 });

      const range = layout.getVisibleRange(250, 300, 2);

      // scrollOffset=250: items 2-5 visible (offsets 200-500 covers 250-550)
      expect(range.startIndex).toBe(2);
      expect(range.endIndex).toBe(5);
      expect(range.overscanStartIndex).toBe(0);
      expect(range.overscanEndIndex).toBe(7);
    });

    it("clamps overscan to bounds", () => {
      const layout = new VirtualLayout({ itemCount: 5, estimatedItemSize: 100 });

      const range = layout.getVisibleRange(0, 200, 5);

      expect(range.overscanStartIndex).toBe(0);
      expect(range.overscanEndIndex).toBe(4);
    });

    it("handles empty layout", () => {
      const layout = new VirtualLayout({ itemCount: 0, estimatedItemSize: 100 });
      const range = layout.getVisibleRange(0, 300, 3);

      expect(range.startIndex).toBe(0);
      expect(range.endIndex).toBe(-1);
    });
  });

  describe("measureItem", () => {
    it("updates size and cascades offsets", () => {
      const layout = new VirtualLayout({ itemCount: 5, estimatedItemSize: 100 });

      layout.measureItem(1, 150, 0);

      expect(layout.getItemSize(1)).toBe(150);
      expect(layout.getItemOffset(2)).toBe(250); // 0 + 100 + 150
      expect(layout.getItemOffset(3)).toBe(350);
      expect(layout.getTotalSize()).toBe(550);
    });

    it("marks item as measured", () => {
      const layout = new VirtualLayout({ itemCount: 3, estimatedItemSize: 100 });

      expect(layout.isMeasured(1)).toBe(false);
      layout.measureItem(1, 120, 0);
      expect(layout.isMeasured(1)).toBe(true);
    });

    it("returns correct anchor correction when item is before anchor", () => {
      const layout = new VirtualLayout({ itemCount: 5, estimatedItemSize: 100 });

      // Anchor is at index 3 (offset 300)
      // Measure item 1 as 150 (was 100) → anchor offset shifts to 350
      const correction = layout.measureItem(1, 150, 3);
      expect(correction).toBe(50);
    });

    it("returns zero correction when item is at or after anchor", () => {
      const layout = new VirtualLayout({ itemCount: 5, estimatedItemSize: 100 });

      const correction = layout.measureItem(3, 150, 2);
      expect(correction).toBe(0);
    });

    it("handles out-of-bounds index", () => {
      const layout = new VirtualLayout({ itemCount: 3, estimatedItemSize: 100 });
      expect(layout.measureItem(-1, 50, 0)).toBe(0);
      expect(layout.measureItem(5, 50, 0)).toBe(0);
    });
  });

  describe("setItemCount", () => {
    it("grow: new items get estimated sizes, existing preserved", () => {
      const layout = new VirtualLayout({ itemCount: 3, estimatedItemSize: 100 });
      layout.measureItem(1, 150, 0);

      layout.setItemCount(5);

      expect(layout.getItemSize(1)).toBe(150);
      expect(layout.isMeasured(1)).toBe(true);
      expect(layout.getItemSize(3)).toBe(100);
      expect(layout.getItemSize(4)).toBe(100);
      expect(layout.isMeasured(3)).toBe(false);
    });

    it("shrink: truncated cleanly", () => {
      const layout = new VirtualLayout({ itemCount: 5, estimatedItemSize: 100 });

      layout.setItemCount(2);

      expect(layout.getTotalSize()).toBe(200);
      expect(layout.getItemSize(2)).toBe(0); // out of bounds
    });

    it("power-of-2 capacity: no realloc when growing within capacity", () => {
      // Initial capacity is nextPowerOf2(3) = 4
      const layout = new VirtualLayout({ itemCount: 3, estimatedItemSize: 100 });

      // Growing to 4 should not need realloc
      layout.setItemCount(4);

      expect(layout.getItemSize(3)).toBe(100);
      expect(layout.getTotalSize()).toBe(400);
    });
  });

  describe("edge cases", () => {
    it("0 items", () => {
      const layout = new VirtualLayout({ itemCount: 0, estimatedItemSize: 100 });

      expect(layout.getTotalSize()).toBe(0);
      expect(layout.getItemSize(0)).toBe(0);
      expect(layout.getItemOffset(0)).toBe(0);
    });

    it("1 item", () => {
      const layout = new VirtualLayout({ itemCount: 1, estimatedItemSize: 200 });

      expect(layout.getTotalSize()).toBe(200);
      expect(layout.getItemSize(0)).toBe(200);
      expect(layout.getItemOffset(0)).toBe(0);
      expect(layout.getIndexAtOffset(0)).toBe(0);
      expect(layout.getIndexAtOffset(100)).toBe(0);
    });

    it("out-of-bounds getItemSize returns 0", () => {
      const layout = new VirtualLayout({ itemCount: 3, estimatedItemSize: 100 });
      expect(layout.getItemSize(-1)).toBe(0);
      expect(layout.getItemSize(10)).toBe(0);
    });

    it("out-of-bounds getItemOffset returns 0", () => {
      const layout = new VirtualLayout({ itemCount: 3, estimatedItemSize: 100 });
      expect(layout.getItemOffset(-1)).toBe(0);
      expect(layout.getItemOffset(10)).toBe(0);
    });
  });

  describe("destroy", () => {
    it("resets all state", () => {
      const layout = new VirtualLayout({ itemCount: 5, estimatedItemSize: 100 });
      layout.destroy();

      expect(layout.getTotalSize()).toBe(0);
      expect(layout.getItemSize(0)).toBe(0);
    });
  });
});
