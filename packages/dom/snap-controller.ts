import type { InteractionEvent, SnapControllerConfig, SnapControllerEventMap } from "~/dom/types";
import type { SnapResult } from "~/core/types";
import type { SnapContext, BeforeSnapPayload } from "~/middleware/types";
import type { MiddlewarePipeline } from "~/middleware/pipeline";
import { EventEmitter } from "~/core/events/event-emitter";
import { AnimationDriver } from "~/animation/animation-driver";
import { ScrollController } from "~/dom/scroll-controller";
import { InputObserver } from "~/dom/input-observer";
import { ResizeObserverManager } from "~/dom/resize-observer-manager";
import { SnapEngine } from "~/core/engine/snap-engine";
import { resolveSnap } from "~/core/algorithms/snap-resolver";

type ControllerState = "idle" | "tracking" | "snapping";

const DEFAULT_CONFIG: SnapControllerConfig = {
  axis: "y",
  viewportSize: 0,
  wheelIdleTimeout: 120,
  overscrollBehavior: "contain",
  items: []
};

export class SnapController {
  private readonly engine: SnapEngine;
  private readonly config: SnapControllerConfig;
  private readonly emitter = new EventEmitter<SnapControllerEventMap>();
  private readonly pipeline: MiddlewarePipeline | null;

  private scrollController: ScrollController | null = null;
  private inputObserver: InputObserver | null = null;
  private resizeManager: ResizeObserverManager | null = null;
  private driver: AnimationDriver | null = null;

  private state: ControllerState = "idle";
  private activeSnapResult: SnapResult | null = null;
  private destroyed = false;

  // Bound handler for interaction events
  private readonly boundHandleInteraction: (event: InteractionEvent) => void;

  constructor(engine: SnapEngine, config?: Partial<SnapControllerConfig>) {
    this.engine = engine;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.pipeline = this.config.pipeline ?? null;
    this.boundHandleInteraction = this.handleInteraction.bind(this);
  }

  attach(element: HTMLElement): void {
    if (this.destroyed) return;

    // 1. ScrollController
    this.scrollController = new ScrollController(element, {
      axis: this.config.axis,
      overscrollBehavior: this.config.overscrollBehavior
    });

    // 2. AnimationDriver
    this.driver = new AnimationDriver(
      {
        onUpdate: (offset: number) => {
          this.scrollController!.setOffset(offset);
          this.engine.updateOffset(offset, performance.now());
          this.emitter.emit("offsetChange", { offset });
          this.pipeline?.runOnScroll(offset);
        },
        onComplete: (targetOffset: number) => {
          this.scrollController!.setOffset(targetOffset);
          const snapResult = this.activeSnapResult;
          if (snapResult) {
            this.engine.settle(snapResult.targetIndex);
            this.emitter.emit("snapComplete", {
              index: snapResult.targetIndex
            });
            this.pipeline?.runOnSettle(snapResult.targetIndex);
          }
          this.activeSnapResult = null;
          this.state = "idle";
        },
        onCancel: () => {
          // Don't settle — user is interacting, tracking resumes
        }
      },
      this.config.animationConfig ? { defaultAnimation: this.config.animationConfig } : undefined
    );

    // 3. InputObserver
    this.inputObserver = new InputObserver(
      element,
      {
        axis: this.config.axis,
        wheelIdleTimeout: this.config.wheelIdleTimeout
      },
      { onInteraction: this.boundHandleInteraction }
    );

    // 4. ResizeObserverManager
    this.resizeManager = new ResizeObserverManager(this.config.axis, {
      onViewportResize: (size: number) => {
        this.engine.updateConfig({ viewportSize: size });
      },
      onItemResize: (index: number, size: number) => {
        this.engine.updateItemSize(index, size);
      }
    });

    // Apply styles and attach listeners
    this.scrollController.applyStyles();
    this.inputObserver.attach();
    this.resizeManager.observeContainer(element);

    // Initial measurement
    const measurement = this.scrollController.measure();
    this.engine.updateConfig({ viewportSize: measurement.viewportSize });

    // Register initial items if provided
    if (this.config.items.length > 0) {
      this.engine.registerItems(this.config.items);
    }

    // Initialize middleware pipeline after measurement + item registration
    this.pipeline?.init(this.engine.getState());
  }

  detach(): void {
    if (this.driver?.isRunning()) {
      this.driver.cancel();
    }

    this.scrollController?.removeStyles();
    this.scrollController?.destroy();
    this.scrollController = null;

    this.inputObserver?.destroy();
    this.inputObserver = null;

    this.resizeManager?.destroy();
    this.resizeManager = null;

    this.driver?.destroy();
    this.driver = null;

    this.state = "idle";
    this.activeSnapResult = null;
  }

  // --- Interaction handling (central dispatcher) ---

  private handleInteraction(event: InteractionEvent): void {
    switch (event.phase) {
      case "start":
        this.onInteractionStart(event);
        break;
      case "move":
        this.onInteractionMove(event);
        break;
      case "end":
        this.onInteractionEnd(event);
        break;
    }
  }

  private onInteractionStart(event: InteractionEvent): void {
    // If animating, cancel and resume tracking
    if (this.state === "snapping" && this.driver?.isRunning()) {
      this.driver.cancel();
    }

    this.state = "tracking";
    this.emitter.emit("interactionStart", { source: event.source });
  }

  private onInteractionMove(event: InteractionEvent): void {
    if (this.state !== "tracking") return;

    this.engine.updateOffset(event.offset, event.timestamp);
    this.emitter.emit("offsetChange", { offset: event.offset });
    this.pipeline?.runOnScroll(event.offset);
  }

  private onInteractionEnd(event: InteractionEvent): void {
    if (this.state !== "tracking") return;

    const snapResult = this.pipeline?.hasSnapHooks()
      ? this.resolveSnapWithMiddleware(event.timestamp)
      : this.engine.release(event.timestamp);

    const currentOffset = this.scrollController?.getOffset() ?? 0;

    this.emitter.emit("interactionEnd", { source: event.source });

    if (snapResult.targetOffset === currentOffset) {
      // Already at target — settle immediately
      this.engine.settle(snapResult.targetIndex);
      this.emitter.emit("snapStart", {
        targetIndex: snapResult.targetIndex,
        targetOffset: snapResult.targetOffset
      });
      this.emitter.emit("snapComplete", { index: snapResult.targetIndex });
      this.pipeline?.runOnSettle(snapResult.targetIndex);
      this.state = "idle";
    } else {
      // Animate to target
      this.activeSnapResult = snapResult;
      this.emitter.emit("snapStart", {
        targetIndex: snapResult.targetIndex,
        targetOffset: snapResult.targetOffset
      });
      this.driver!.animate(currentOffset, snapResult.targetOffset);
      this.state = "snapping";
    }
  }

  // --- Programmatic API ---

  snapTo(index: number): void {
    if (this.destroyed || !this.driver || !this.scrollController) return;

    // Cancel any current animation
    if (this.driver.isRunning()) {
      this.driver.cancel();
    }

    let snapResult = this.engine.snapTo(index);

    // For programmatic snaps, only afterSnap runs (no velocity/beforeSnap)
    if (this.pipeline?.hasHook("afterSnap")) {
      const state = this.engine.getState();
      const config = this.engine.getConfig();
      const context: SnapContext = {
        items: state.items,
        currentIndex: state.activeIndex,
        currentOffset: state.currentOffset,
        velocity: 0,
        config
      };
      snapResult = this.pipeline.runAfterSnap(context, snapResult);
    }

    const currentOffset = this.scrollController.getOffset();

    if (snapResult.targetOffset === currentOffset) {
      this.engine.settle(snapResult.targetIndex);
      this.emitter.emit("snapStart", {
        targetIndex: snapResult.targetIndex,
        targetOffset: snapResult.targetOffset
      });
      this.emitter.emit("snapComplete", { index: snapResult.targetIndex });
      this.pipeline?.runOnSettle(snapResult.targetIndex);
      return;
    }

    this.activeSnapResult = snapResult;
    this.state = "snapping";
    this.emitter.emit("snapStart", {
      targetIndex: snapResult.targetIndex,
      targetOffset: snapResult.targetOffset
    });
    this.driver.animate(currentOffset, snapResult.targetOffset);
  }

  // --- State accessors ---

  getActiveIndex(): number {
    return this.engine.getActiveIndex();
  }

  getCurrentOffset(): number {
    return this.scrollController?.getOffset() ?? this.engine.getCurrentOffset();
  }

  isAnimating(): boolean {
    return this.driver?.isRunning() ?? false;
  }

  isInteracting(): boolean {
    return this.inputObserver?.isInteracting() ?? false;
  }

  getEngine(): SnapEngine {
    return this.engine;
  }

  // --- Events ---

  on<K extends keyof SnapControllerEventMap>(
    event: K,
    handler: (payload: SnapControllerEventMap[K]) => void
  ): () => void {
    return this.emitter.on(event, handler);
  }

  off<K extends keyof SnapControllerEventMap>(event: K, handler: (payload: SnapControllerEventMap[K]) => void): void {
    this.emitter.off(event, handler);
  }

  // --- Item management pass-through ---

  registerItems(sizes: number[]): void {
    this.engine.registerItems(sizes);
  }

  observeItem(element: Element, index: number): void {
    this.resizeManager?.observeItem(element, index);
  }

  unobserveItem(element: Element): void {
    this.resizeManager?.unobserveItem(element);
  }

  // --- Lifecycle ---

  destroy(): void {
    this.pipeline?.destroy();
    this.detach();
    this.emitter.removeAll();
    this.destroyed = true;
  }

  // --- Middleware-aware snap resolution ---

  private resolveSnapWithMiddleware(timestamp: number): SnapResult {
    const pipeline = this.pipeline!;
    const config = this.engine.getConfig();
    const state = this.engine.getState();

    // 1. Compute velocity via engine (decomposed)
    let velocity = this.engine.computeVelocity(timestamp);

    // 2. Run onVelocity hooks
    velocity = pipeline.runOnVelocity(velocity);

    // 3. Build read-only context snapshot
    const context: SnapContext = {
      items: state.items,
      currentIndex: state.activeIndex,
      currentOffset: state.currentOffset,
      velocity,
      config
    };

    // 4. Build mutable beforeSnap params
    let params: BeforeSnapPayload = {
      velocity,
      currentIndex: state.activeIndex,
      currentOffset: state.currentOffset,
      velocityThreshold: config.velocityThreshold,
      maxSkipCount: config.maxSkipCount
    };

    // 5. Run beforeSnap hooks
    params = pipeline.runBeforeSnap(context, params);

    // 6. Resolve snap using pure function
    let result = resolveSnap({
      ...params,
      items: state.items,
      alignment: config.snapPointAlignment,
      viewportSize: config.viewportSize,
      multiSkipFactor: config.multiSkipFactor
    });

    // 7. Run afterSnap hooks
    result = pipeline.runAfterSnap(context, result);

    // 8. Emit snap event via engine
    this.engine.applySnapResult(result);

    return result;
  }

  // --- Static factory ---

  static create(element: HTMLElement, config?: Partial<SnapControllerConfig>): SnapController {
    const engine = new SnapEngine({
      axis: config?.axis ?? "y",
      viewportSize: config?.viewportSize ?? 0
    });
    const controller = new SnapController(engine, config);
    controller.attach(element);
    return controller;
  }
}
