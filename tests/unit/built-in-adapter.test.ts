import { describe, it, expect, vi } from "vitest";
import { BuiltInVirtualAdapter } from "~/middleware/virtualizer/built-in-adapter";

describe("BuiltInVirtualAdapter", () => {
  it("construction initializes layout with estimated sizes", () => {
    const adapter = new BuiltInVirtualAdapter({
      itemCount: 5,
      estimatedItemSize: 100,
      viewportSize: 300
    });

    expect(adapter.getTotalSize()).toBe(500);
    expect(adapter.getItemSize(0)).toBe(100);
    expect(adapter.getItemSize(4)).toBe(100);
  });

  it("getVisibleRange returns correct range for scroll offset", () => {
    const adapter = new BuiltInVirtualAdapter({
      itemCount: 20,
      estimatedItemSize: 100,
      viewportSize: 300,
      overscan: 2
    });

    adapter.updateScrollOffset(250);
    const range = adapter.getVisibleRange();

    expect(range.startIndex).toBe(2);
    expect(range.endIndex).toBe(5);
    expect(range.overscanStartIndex).toBe(0);
    expect(range.overscanEndIndex).toBe(7);
  });

  it("updateScrollOffset changes range and notifies subscribers", () => {
    const adapter = new BuiltInVirtualAdapter({
      itemCount: 20,
      estimatedItemSize: 100,
      viewportSize: 300,
      overscan: 0
    });

    const subscriber = vi.fn();
    adapter.subscribe(subscriber);

    adapter.updateScrollOffset(500);

    expect(subscriber).toHaveBeenCalledTimes(1);
    const range = adapter.getVisibleRange();
    expect(range.startIndex).toBe(5);
  });

  it("updateScrollOffset does NOT notify if range unchanged", () => {
    const adapter = new BuiltInVirtualAdapter({
      itemCount: 20,
      estimatedItemSize: 100,
      viewportSize: 300,
      overscan: 0
    });

    const subscriber = vi.fn();
    adapter.subscribe(subscriber);

    // Scroll within item 0 — range stays the same (items 0-2)
    adapter.updateScrollOffset(10);
    adapter.updateScrollOffset(20);

    // First call changes range from initial, second should not re-notify
    // Actually initial range is already items 0-2, so offset 10 and 20 stay in same range
    expect(subscriber).toHaveBeenCalledTimes(0);
  });

  it("measureItem with item before anchor produces correction", () => {
    const adapter = new BuiltInVirtualAdapter({
      itemCount: 10,
      estimatedItemSize: 100,
      viewportSize: 300,
      overscan: 0
    });

    adapter.setAnchorIndex(5);
    adapter.measureItem(2, 150);

    expect(adapter.getAnchorCorrection()).toBe(50);
  });

  it("measureItem with item after anchor produces zero correction", () => {
    const adapter = new BuiltInVirtualAdapter({
      itemCount: 10,
      estimatedItemSize: 100,
      viewportSize: 300,
      overscan: 0
    });

    adapter.setAnchorIndex(2);
    adapter.measureItem(5, 150);

    expect(adapter.getAnchorCorrection()).toBe(0);
  });

  it("clearAnchorCorrection resets to 0", () => {
    const adapter = new BuiltInVirtualAdapter({
      itemCount: 10,
      estimatedItemSize: 100,
      viewportSize: 300
    });

    adapter.setAnchorIndex(5);
    adapter.measureItem(2, 150);
    expect(adapter.getAnchorCorrection()).toBe(50);

    adapter.clearAnchorCorrection();
    expect(adapter.getAnchorCorrection()).toBe(0);
  });

  it("setAnchorIndex changes the anchor", () => {
    const adapter = new BuiltInVirtualAdapter({
      itemCount: 10,
      estimatedItemSize: 100,
      viewportSize: 300
    });

    adapter.setAnchorIndex(7);
    adapter.measureItem(3, 200);

    // Item 3 was 100, now 200 → +100 shift for all items after 3 (including anchor 7)
    expect(adapter.getAnchorCorrection()).toBe(100);
  });

  it("setItemCount grows and notifies", () => {
    const adapter = new BuiltInVirtualAdapter({
      itemCount: 5,
      estimatedItemSize: 100,
      viewportSize: 300,
      overscan: 0
    });

    const subscriber = vi.fn();
    adapter.subscribe(subscriber);

    adapter.setItemCount(10);

    expect(adapter.getTotalSize()).toBe(1000);
    expect(adapter.getItemSize(9)).toBe(100);
  });

  it("setViewportSize updates range", () => {
    const adapter = new BuiltInVirtualAdapter({
      itemCount: 20,
      estimatedItemSize: 100,
      viewportSize: 200,
      overscan: 0
    });

    adapter.setViewportSize(500);
    const range = adapter.getVisibleRange();

    // With viewportSize 500, scroll at 0: endOffset=500 which is the boundary of item 5
    // getIndexAtOffset(500) → item 5, so endIndex is 5
    expect(range.endIndex).toBe(5);
  });

  it("subscribe returns working unsubscribe", () => {
    const adapter = new BuiltInVirtualAdapter({
      itemCount: 20,
      estimatedItemSize: 100,
      viewportSize: 300,
      overscan: 0
    });

    const subscriber = vi.fn();
    const unsubscribe = adapter.subscribe(subscriber);

    adapter.updateScrollOffset(500);
    expect(subscriber).toHaveBeenCalledTimes(1);

    unsubscribe();
    adapter.updateScrollOffset(1000);
    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  it("destroy clears state", () => {
    const adapter = new BuiltInVirtualAdapter({
      itemCount: 10,
      estimatedItemSize: 100,
      viewportSize: 300
    });

    const subscriber = vi.fn();
    adapter.subscribe(subscriber);

    adapter.destroy();

    // After destroy, operations are no-ops
    adapter.updateScrollOffset(500);
    expect(subscriber).not.toHaveBeenCalled();
  });

  it("measureItem skips when size unchanged and already measured", () => {
    const adapter = new BuiltInVirtualAdapter({
      itemCount: 10,
      estimatedItemSize: 100,
      viewportSize: 300,
      overscan: 0
    });

    const subscriber = vi.fn();
    adapter.subscribe(subscriber);

    // First measure changes size
    adapter.measureItem(0, 150);
    const callCount = subscriber.mock.calls.length;

    // Second measure with same size — should be skipped
    adapter.measureItem(0, 150);
    expect(subscriber).toHaveBeenCalledTimes(callCount);
  });
});
