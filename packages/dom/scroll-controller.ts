import type { ScrollContainerConfig, MeasurementCache } from "~/dom/types";

export class ScrollController {
  private element: HTMLElement | null;
  private readonly axis: ScrollContainerConfig["axis"];
  private readonly overscrollBehavior: ScrollContainerConfig["overscrollBehavior"];

  // Pre-allocated — mutated in place by measure()
  private readonly cache: MeasurementCache = {
    viewportSize: 0,
    contentSize: 0,
    lastMeasureTime: 0
  };

  constructor(element: HTMLElement, config: ScrollContainerConfig) {
    this.element = element;
    this.axis = config.axis;
    this.overscrollBehavior = config.overscrollBehavior;
  }

  getOffset(): number {
    if (!this.element) return 0;
    return this.axis === "y" ? this.element.scrollTop : this.element.scrollLeft;
  }

  setOffset(offset: number): void {
    if (!this.element) return;
    if (this.axis === "y") {
      this.element.scrollTop = offset;
    } else {
      this.element.scrollLeft = offset;
    }
  }

  getContentSize(): number {
    if (!this.element) return 0;
    return this.axis === "y" ? this.element.scrollHeight : this.element.scrollWidth;
  }

  getViewportSize(): number {
    if (!this.element) return 0;
    return this.axis === "y" ? this.element.clientHeight : this.element.clientWidth;
  }

  measure(): MeasurementCache {
    this.cache.viewportSize = this.getViewportSize();
    this.cache.contentSize = this.getContentSize();
    this.cache.lastMeasureTime = performance.now();
    return this.cache;
  }

  applyStyles(): void {
    if (!this.element) return;
    const style = this.element.style;
    style.overscrollBehavior = this.overscrollBehavior;
    if (this.axis === "y") {
      style.overflowY = "auto";
      style.touchAction = "pan-y";
    } else {
      style.overflowX = "auto";
      style.touchAction = "pan-x";
    }
  }

  removeStyles(): void {
    if (!this.element) return;
    const style = this.element.style;
    style.overscrollBehavior = "";
    style.overflowY = "";
    style.overflowX = "";
    style.touchAction = "";
  }

  updateElement(element: HTMLElement): void {
    this.element = element;
  }

  destroy(): void {
    this.element = null;
  }
}
