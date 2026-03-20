import type { Direction } from "~/types";
import type { SnapItem, SnapPointAlignment, SnapResult } from "~/core/types";
import { getOffsetForIndex } from "~/core/algorithms/layout-calculator";

export interface ResolveSnapParams {
  items: SnapItem[];
  currentIndex: number;
  currentOffset: number;
  velocity: number;
  velocityThreshold: number;
  multiSkipFactor: number;
  maxSkipCount: number;
  alignment: SnapPointAlignment;
  viewportSize: number;
}

export function resolveSnap(params: ResolveSnapParams): SnapResult {
  if (params.items.length === 0) {
    return { targetIndex: 0, targetOffset: 0, direction: 0, skippedCount: 0 };
  }

  if (Math.abs(params.velocity) > params.velocityThreshold) {
    return findDirectionalSnap(params);
  }

  return findNearestSnap(params);
}

export function findNearestSnap(params: ResolveSnapParams): SnapResult {
  const { items, currentOffset, alignment, viewportSize } = params;

  if (items.length === 0) {
    return { targetIndex: 0, targetOffset: 0, direction: 0, skippedCount: 0 };
  }

  let minDistance = Infinity;
  let nearestIndex = 0;

  for (let i = 0; i < items.length; i++) {
    const snapOffset = getOffsetForIndex(items, i, alignment, viewportSize);
    const distance = Math.abs(currentOffset - snapOffset);

    if (distance < minDistance) {
      minDistance = distance;
      nearestIndex = i;
    }
  }

  const targetOffset = getOffsetForIndex(items, nearestIndex, alignment, viewportSize);
  const direction: Direction = nearestIndex > params.currentIndex ? 1 : nearestIndex < params.currentIndex ? -1 : 0;

  return {
    targetIndex: nearestIndex,
    targetOffset,
    direction,
    skippedCount: Math.abs(nearestIndex - params.currentIndex)
  };
}

export function findDirectionalSnap(params: ResolveSnapParams): SnapResult {
  const { items, currentIndex, velocity, multiSkipFactor, maxSkipCount, alignment, viewportSize } = params;

  const direction: Direction = velocity > 0 ? 1 : -1;
  const rawSkip = Math.round(Math.abs(velocity) * multiSkipFactor);
  const skipCount = Math.max(1, Math.min(rawSkip, maxSkipCount));

  const targetIndex = Math.max(0, Math.min(currentIndex + direction * skipCount, items.length - 1));
  const targetOffset = getOffsetForIndex(items, targetIndex, alignment, viewportSize);

  return {
    targetIndex,
    targetOffset,
    direction,
    skippedCount: Math.abs(targetIndex - currentIndex)
  };
}
