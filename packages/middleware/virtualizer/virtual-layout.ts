import type { VirtualLayoutConfig, VirtualRange } from "~/middleware/virtualizer/types";

function nextPowerOf2(n: number): number {
  if (n <= 0) return 1;
  let v = n - 1;
  v |= v >>> 1;
  v |= v >>> 2;
  v |= v >>> 4;
  v |= v >>> 8;
  v |= v >>> 16;
  return v + 1;
}

export class VirtualLayout {
  private _sizes: Float64Array;
  private _offsets: Float64Array;
  private _measured: Uint8Array;
  private _capacity: number;
  private _itemCount: number;
  private _estimatedItemSize: number | ((index: number) => number);

  constructor(config: VirtualLayoutConfig) {
    this._itemCount = config.itemCount;
    this._estimatedItemSize = config.estimatedItemSize;
    this._capacity = nextPowerOf2(Math.max(config.itemCount, 1));

    this._sizes = new Float64Array(this._capacity);
    this._offsets = new Float64Array(this._capacity + 1);
    this._measured = new Uint8Array(this._capacity);

    this.fillEstimates(0, this._itemCount);
    this.recomputeOffsets(0);
  }

  getItemSize(index: number): number {
    if (index < 0 || index >= this._itemCount) return 0;
    return this._sizes[index]!;
  }

  getItemOffset(index: number): number {
    if (index < 0 || index >= this._itemCount) return 0;
    return this._offsets[index]!;
  }

  getTotalSize(): number {
    return this._offsets[this._itemCount]!;
  }

  getIndexAtOffset(offset: number): number {
    if (this._itemCount === 0) return 0;
    if (offset <= 0) return 0;

    let lo = 0;
    let hi = this._itemCount - 1;

    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      // offset at end of item mid = _offsets[mid + 1]
      if (this._offsets[mid + 1]! <= offset) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    return lo;
  }

  getVisibleRange(scrollOffset: number, viewportSize: number, overscan: number): VirtualRange {
    if (this._itemCount === 0) {
      return { startIndex: 0, endIndex: -1, overscanStartIndex: 0, overscanEndIndex: -1 };
    }

    const clampedOffset = Math.max(0, scrollOffset);
    const startIndex = this.getIndexAtOffset(clampedOffset);
    const endOffset = clampedOffset + viewportSize;
    const endIndex = Math.min(this.getIndexAtOffset(endOffset), this._itemCount - 1);

    const overscanStartIndex = Math.max(0, startIndex - overscan);
    const overscanEndIndex = Math.min(this._itemCount - 1, endIndex + overscan);

    return { startIndex, endIndex, overscanStartIndex, overscanEndIndex };
  }

  measureItem(index: number, size: number, anchorIndex: number): number {
    if (index < 0 || index >= this._itemCount) return 0;

    const oldAnchorOffset = anchorIndex >= 0 && anchorIndex < this._itemCount
      ? this._offsets[anchorIndex]!
      : 0;

    this._sizes[index] = size;
    this._measured[index] = 1;

    this.recomputeOffsets(index);

    if (index < anchorIndex && anchorIndex < this._itemCount) {
      return this._offsets[anchorIndex]! - oldAnchorOffset;
    }

    return 0;
  }

  isMeasured(index: number): boolean {
    if (index < 0 || index >= this._itemCount) return false;
    return this._measured[index] === 1;
  }

  setItemCount(count: number): void {
    const oldCount = this._itemCount;
    this._itemCount = count;

    let recomputeFrom = count < oldCount ? count : oldCount;

    if (count > this._capacity) {
      const newCapacity = nextPowerOf2(count);
      const newSizes = new Float64Array(newCapacity);
      const newOffsets = new Float64Array(newCapacity + 1);
      const newMeasured = new Uint8Array(newCapacity);

      // Copy existing data
      newSizes.set(this._sizes.subarray(0, Math.min(oldCount, count)));
      newMeasured.set(this._measured.subarray(0, Math.min(oldCount, count)));

      this._sizes = newSizes;
      this._offsets = newOffsets;
      this._measured = newMeasured;
      this._capacity = newCapacity;

      // Offsets array was freshly allocated (all zeros), must recompute from 0
      recomputeFrom = 0;
    }

    if (count > oldCount) {
      this.fillEstimates(oldCount, count);
    }

    this.recomputeOffsets(recomputeFrom);
  }

  destroy(): void {
    // Allow GC — typed arrays can be large for big lists
    this._sizes = new Float64Array(0);
    this._offsets = new Float64Array(1); // getTotalSize() reads _offsets[0] when _itemCount=0
    this._measured = new Uint8Array(0);
    this._itemCount = 0;
    this._capacity = 0;
  }

  private fillEstimates(from: number, to: number): void {
    const estimator = this._estimatedItemSize;
    if (typeof estimator === "number") {
      for (let i = from; i < to; i++) {
        this._sizes[i] = estimator;
        this._measured[i] = 0;
      }
    } else {
      for (let i = from; i < to; i++) {
        this._sizes[i] = estimator(i);
        this._measured[i] = 0;
      }
    }
  }

  private recomputeOffsets(fromIndex: number): void {
    const start = Math.max(0, fromIndex);
    // Seed from previous offset if possible
    let offset = start > 0 ? this._offsets[start - 1]! + this._sizes[start - 1]! : 0;

    for (let i = start; i < this._itemCount; i++) {
      this._offsets[i] = offset;
      offset += this._sizes[i]!;
    }

    this._offsets[this._itemCount] = offset;
  }
}
