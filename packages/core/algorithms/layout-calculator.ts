import type { SnapItem, SnapPointAlignment } from "~/core/types";

export function calculateLayout(sizes: number[]): SnapItem[] {
  const items: SnapItem[] = new Array<SnapItem>(sizes.length);
  let offset = 0;

  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i]!;
    items[i] = { index: i, offset, size };
    offset += size;
  }

  return items;
}

export function recalculateLayout(items: SnapItem[], changedIndex: number, newSize: number): void {
  if (changedIndex < 0 || changedIndex >= items.length) return;

  items[changedIndex]!.size = newSize;

  for (let i = changedIndex + 1; i < items.length; i++) {
    const prev = items[i - 1]!;
    items[i]!.offset = prev.offset + prev.size;
  }
}

export function getOffsetForIndex(
  items: SnapItem[],
  index: number,
  alignment: SnapPointAlignment,
  viewportSize: number
): number {
  if (items.length === 0 || index < 0 || index >= items.length) return 0;

  const item = items[index]!;

  switch (alignment) {
    case "start":
      return item.offset;
    case "center":
      return item.offset - (viewportSize - item.size) / 2;
    case "end":
      return item.offset - (viewportSize - item.size);
  }
}

export function getIndexAtOffset(items: SnapItem[], offset: number): number {
  if (items.length === 0) return 0;

  let lo = 0;
  let hi = items.length - 1;

  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const item = items[mid]!;

    if (item.offset + item.size <= offset) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  return lo;
}
