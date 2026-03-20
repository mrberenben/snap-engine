import type { SnapItem } from "~/core/types";

export function clampOffset(offset: number, items: SnapItem[], viewportSize: number): number {
  if (items.length === 0) return 0;

  const lastItem = items[items.length - 1]!;
  const totalContentSize = lastItem.offset + lastItem.size;
  const maxOffset = Math.max(0, totalContentSize - viewportSize);

  return Math.max(0, Math.min(offset, maxOffset));
}

export function isAtBoundary(offset: number, items: SnapItem[], viewportSize: number): "start" | "end" | null {
  if (items.length === 0) return null;

  if (offset <= 0) return "start";

  const lastItem = items[items.length - 1]!;
  const totalContentSize = lastItem.offset + lastItem.size;
  const maxOffset = Math.max(0, totalContentSize - viewportSize);

  if (offset >= maxOffset) return "end";

  return null;
}

export function applyElasticOverscroll(offset: number, boundary: number, factor = 0.3): number {
  const overshoot = offset - boundary;
  return boundary + overshoot * factor;
}
