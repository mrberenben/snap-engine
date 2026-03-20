import type { ScrollAxis } from "~/types";
import type { ResizeObserverCallbacks } from "~/dom/types";

export class ResizeObserverManager {
  private readonly axis: ScrollAxis;
  private readonly callbacks: ResizeObserverCallbacks;
  private readonly observer: ResizeObserver;
  private readonly itemMap = new Map<Element, number>();
  private containerElement: Element | null = null;

  constructor(axis: ScrollAxis, callbacks: ResizeObserverCallbacks) {
    this.axis = axis;
    this.callbacks = callbacks;
    this.observer = new ResizeObserver(this.handleResize.bind(this));
  }

  observeContainer(element: Element): void {
    if (this.containerElement) {
      this.observer.unobserve(this.containerElement);
    }
    this.containerElement = element;
    this.observer.observe(element);
  }

  observeItem(element: Element, index: number): void {
    this.itemMap.set(element, index);
    this.observer.observe(element);
  }

  unobserveContainer(): void {
    if (this.containerElement) {
      this.observer.unobserve(this.containerElement);
      this.containerElement = null;
    }
  }

  unobserveItem(element: Element): void {
    if (this.itemMap.has(element)) {
      this.observer.unobserve(element);
      this.itemMap.delete(element);
    }
  }

  destroy(): void {
    this.observer.disconnect();
    this.itemMap.clear();
    this.containerElement = null;
  }

  private handleResize(entries: ResizeObserverEntry[]): void {
    for (const entry of entries) {
      const size = this.extractSize(entry);

      if (entry.target === this.containerElement) {
        this.callbacks.onViewportResize(size);
      } else {
        const index = this.itemMap.get(entry.target);
        if (index !== undefined) {
          this.callbacks.onItemResize(index, size);
        }
      }
    }
  }

  private extractSize(entry: ResizeObserverEntry): number {
    // Prefer contentBoxSize (modern API)
    if (entry.contentBoxSize && entry.contentBoxSize.length > 0) {
      const box = entry.contentBoxSize[0]!;
      return this.axis === "y" ? box.blockSize : box.inlineSize;
    }

    // Fallback to contentRect
    return this.axis === "y" ? entry.contentRect.height : entry.contentRect.width;
  }
}
