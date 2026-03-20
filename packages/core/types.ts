import type { Direction, ScrollAxis } from "~/types";

export type SnapPointAlignment = "start" | "center" | "end";

export interface SnapItem {
  index: number;
  offset: number;
  size: number;
  measuredSize?: number;
}

export interface SnapEngineConfig {
  axis: ScrollAxis;
  velocityThreshold: number;
  multiSkipFactor: number;
  maxSkipCount: number;
  overscrollEnabled: boolean;
  snapPointAlignment: SnapPointAlignment;
  viewportSize: number;
}

export interface EngineState {
  items: SnapItem[];
  currentOffset: number;
  velocity: number;
  activeIndex: number;
  isSettled: boolean;
  itemCount: number;
}

export interface SnapResult {
  targetIndex: number;
  targetOffset: number;
  direction: Direction;
  skippedCount: number;
}

export interface SnapEngineEventMap {
  snap: SnapResult;
  offsetChange: { offset: number };
  settle: { index: number };
  itemsChange: { items: SnapItem[] };
}
