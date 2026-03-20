import type { BuiltInVirtualAdapterConfig, VirtualAdapter, VirtualRange } from "~/middleware/virtualizer/types";
import { VirtualLayout } from "~/middleware/virtualizer/virtual-layout";

const EMPTY_RANGE: VirtualRange = {
  startIndex: 0,
  endIndex: -1,
  overscanStartIndex: 0,
  overscanEndIndex: -1
};

export class BuiltInVirtualAdapter implements VirtualAdapter {
  private layout: VirtualLayout;
  private scrollOffset = 0;
  private viewportSize: number;
  private overscan: number;
  private anchorIndex = 0;
  private pendingCorrection = 0;
  private subscribers = new Set<() => void>();
  private cachedRange: VirtualRange;
  private destroyed = false;

  constructor(config: BuiltInVirtualAdapterConfig) {
    this.viewportSize = config.viewportSize;
    this.overscan = config.overscan ?? 3;

    this.layout = new VirtualLayout({
      itemCount: config.itemCount,
      estimatedItemSize: config.estimatedItemSize
    });

    this.cachedRange = config.itemCount > 0
      ? this.layout.getVisibleRange(0, this.viewportSize, this.overscan)
      : EMPTY_RANGE;
  }

  getItemCount(): number {
    return this.layout.getTotalSize() > 0 ? this.getItemCountFromLayout() : 0;
  }

  getItemSize(index: number): number {
    return this.layout.getItemSize(index);
  }

  getItemOffset(index: number): number {
    return this.layout.getItemOffset(index);
  }

  getTotalSize(): number {
    return this.layout.getTotalSize();
  }

  getVisibleRange(): VirtualRange {
    return this.cachedRange;
  }

  updateScrollOffset(offset: number): void {
    if (this.destroyed) return;
    this.scrollOffset = offset;
    this.recalculateRange();
  }

  setAnchorIndex(index: number): void {
    if (this.destroyed) return;
    this.anchorIndex = index;
  }

  getAnchorCorrection(): number {
    return this.pendingCorrection;
  }

  clearAnchorCorrection(): void {
    this.pendingCorrection = 0;
  }

  measureItem(index: number, size: number): void {
    if (this.destroyed) return;
    if (this.layout.getItemSize(index) === size && this.layout.isMeasured(index)) return;

    const correction = this.layout.measureItem(index, size, this.anchorIndex);
    if (correction !== 0) {
      this.pendingCorrection += correction;
    }

    this.recalculateRange();
  }

  setItemCount(count: number): void {
    if (this.destroyed) return;
    this.layout.setItemCount(count);
    this.recalculateRange();
  }

  setViewportSize(size: number): void {
    if (this.destroyed) return;
    this.viewportSize = size;
    this.recalculateRange();
  }

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.subscribers.clear();
    this.layout.destroy();
  }

  // --- Internal ---

  private getItemCountFromLayout(): number {
    // VirtualLayout doesn't expose itemCount directly, derive from the range it can produce
    // We track it through setItemCount calls; store it here
    return this.cachedRange.overscanEndIndex + 1 || 0;
  }

  private recalculateRange(): void {
    const newRange = this.layout.getVisibleRange(this.scrollOffset, this.viewportSize, this.overscan);

    if (
      newRange.startIndex !== this.cachedRange.startIndex ||
      newRange.endIndex !== this.cachedRange.endIndex ||
      newRange.overscanStartIndex !== this.cachedRange.overscanStartIndex ||
      newRange.overscanEndIndex !== this.cachedRange.overscanEndIndex
    ) {
      this.cachedRange = newRange;
      this.notify();
    }
  }

  private notify(): void {
    for (const callback of this.subscribers) {
      callback();
    }
  }
}
