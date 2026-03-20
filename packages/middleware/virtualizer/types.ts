export interface VirtualRange {
  startIndex: number;
  endIndex: number;
  overscanStartIndex: number;
  overscanEndIndex: number;
}

export interface VirtualAdapter {
  getItemCount(): number;
  getItemSize(index: number): number;
  getItemOffset(index: number): number;
  getTotalSize(): number;
  getVisibleRange(): VirtualRange;
  updateScrollOffset(offset: number): void;
  setAnchorIndex(index: number): void;
  getAnchorCorrection(): number;
  clearAnchorCorrection(): void;
  subscribe(callback: () => void): () => void;
  destroy(): void;
}

export interface VirtualLayoutConfig {
  itemCount: number;
  estimatedItemSize: number | ((index: number) => number);
}

export interface BuiltInVirtualAdapterConfig {
  itemCount: number;
  estimatedItemSize: number | ((index: number) => number);
  viewportSize: number;
  overscan?: number;
}
