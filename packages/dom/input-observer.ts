import type { InputObserverConfig, InputObserverCallbacks, InteractionEvent, InteractionSource } from "~/dom/types";

export class InputObserver {
  private element: HTMLElement | null;
  private readonly axis: InputObserverConfig["axis"];
  private readonly wheelIdleTimeout: number;
  private readonly callbacks: InputObserverCallbacks;

  private interacting = false;
  private activeSource: InteractionSource | null = null;
  private wheelIdleTimer = 0;
  private previousOffset = 0;
  private attached = false;

  // Pre-allocated — mutated and passed to callback (zero allocation)
  private readonly event: InteractionEvent = {
    source: "touch",
    phase: "start",
    offset: 0,
    delta: 0,
    timestamp: 0
  };

  // Bound handlers — allocated once in constructor
  private readonly handleTouchStart: (e: TouchEvent) => void;
  private readonly handleTouchEnd: (e: TouchEvent) => void;
  private readonly handleTouchCancel: (e: TouchEvent) => void;
  private readonly handleWheel: (e: WheelEvent) => void;
  private readonly handleScroll: () => void;
  private readonly handleWheelIdle: () => void;

  constructor(element: HTMLElement, config: InputObserverConfig, callbacks: InputObserverCallbacks) {
    this.element = element;
    this.axis = config.axis;
    this.wheelIdleTimeout = config.wheelIdleTimeout;
    this.callbacks = callbacks;

    this.handleTouchStart = this._onTouchStart.bind(this);
    this.handleTouchEnd = this._onTouchEnd.bind(this);
    this.handleTouchCancel = this._onTouchEnd.bind(this);
    this.handleWheel = this._onWheel.bind(this);
    this.handleScroll = this._onScroll.bind(this);
    this.handleWheelIdle = this._onWheelIdle.bind(this);
  }

  attach(): void {
    if (this.attached || !this.element) return;
    this.attached = true;

    this.element.addEventListener("touchstart", this.handleTouchStart, {
      passive: true
    });
    this.element.addEventListener("touchend", this.handleTouchEnd, {
      passive: true
    });
    this.element.addEventListener("touchcancel", this.handleTouchCancel, {
      passive: true
    });
    this.element.addEventListener("wheel", this.handleWheel, {
      passive: true
    });
    this.element.addEventListener("scroll", this.handleScroll);
  }

  detach(): void {
    if (!this.attached || !this.element) return;
    this.attached = false;

    this.element.removeEventListener("touchstart", this.handleTouchStart);
    this.element.removeEventListener("touchend", this.handleTouchEnd);
    this.element.removeEventListener("touchcancel", this.handleTouchCancel);
    this.element.removeEventListener("wheel", this.handleWheel);
    this.element.removeEventListener("scroll", this.handleScroll);

    this.clearWheelTimer();
    this.interacting = false;
    this.activeSource = null;
  }

  updateElement(element: HTMLElement): void {
    const wasAttached = this.attached;
    this.detach();
    this.element = element;
    if (wasAttached) {
      this.attach();
    }
  }

  isInteracting(): boolean {
    return this.interacting;
  }

  getInteractionSource(): InteractionSource | null {
    return this.activeSource;
  }

  destroy(): void {
    this.detach();
    this.element = null;
  }

  // --- Internal handlers ---

  private _onTouchStart(): void {
    if (!this.element) return;

    this.interacting = true;
    this.activeSource = "touch";
    this.previousOffset = this.readOffset();

    this.emitEvent("touch", "start", this.previousOffset, 0);
  }

  private _onTouchEnd(): void {
    if (!this.interacting || this.activeSource !== "touch") return;

    this.emitEvent("touch", "end", this.readOffset(), 0);

    this.interacting = false;
    this.activeSource = null;
  }

  private _onWheel(e: WheelEvent): void {
    const delta = this.normalizeDelta(e);

    if (!this.interacting) {
      // First wheel event — start interaction
      this.interacting = true;
      this.activeSource = "wheel";
      this.previousOffset = this.readOffset();
      this.emitEvent("wheel", "start", this.previousOffset, 0);
    }

    // Emit move
    this.emitEvent("wheel", "move", this.readOffset(), delta);

    // Reset idle timer
    this.clearWheelTimer();
    this.wheelIdleTimer = setTimeout(this.handleWheelIdle, this.wheelIdleTimeout) as unknown as number;
  }

  private _onScroll(): void {
    // Drop scroll events when not interacting — prevents feedback from animation writes
    if (!this.interacting) return;

    // Only emit scroll-based moves for touch (wheel has its own delta)
    if (this.activeSource !== "touch") return;

    const currentOffset = this.readOffset();
    const delta = currentOffset - this.previousOffset;
    this.previousOffset = currentOffset;

    this.emitEvent("touch", "move", currentOffset, delta);
  }

  private _onWheelIdle(): void {
    this.wheelIdleTimer = 0;

    if (!this.interacting || this.activeSource !== "wheel") return;

    this.emitEvent("wheel", "end", this.readOffset(), 0);

    this.interacting = false;
    this.activeSource = null;
  }

  // --- Helpers ---

  private readOffset(): number {
    if (!this.element) return 0;
    return this.axis === "y" ? this.element.scrollTop : this.element.scrollLeft;
  }

  private normalizeDelta(e: WheelEvent): number {
    const raw = this.axis === "y" ? e.deltaY : e.deltaX;

    // deltaMode constants: 0 = DOM_DELTA_PIXEL, 1 = DOM_DELTA_LINE, 2 = DOM_DELTA_PAGE
    switch (e.deltaMode) {
      case 1: // DOM_DELTA_LINE
        return raw * 16;
      case 2: // DOM_DELTA_PAGE
        return raw * (this.element ? this.getViewportSize() : 800);
      default:
        // DOM_DELTA_PIXEL (0)
        return raw;
    }
  }

  private getViewportSize(): number {
    if (!this.element) return 0;
    return this.axis === "y" ? this.element.clientHeight : this.element.clientWidth;
  }

  private emitEvent(
    source: InteractionEvent["source"],
    phase: InteractionEvent["phase"],
    offset: number,
    delta: number
  ): void {
    this.event.source = source;
    this.event.phase = phase;
    this.event.offset = offset;
    this.event.delta = delta;
    this.event.timestamp = performance.now();
    this.callbacks.onInteraction(this.event);
  }

  private clearWheelTimer(): void {
    if (this.wheelIdleTimer !== 0) {
      clearTimeout(this.wheelIdleTimer);
      this.wheelIdleTimer = 0;
    }
  }
}
