import type {
  AnimationCallbacks,
  AnimationConfig,
  AnimationDriverConfig,
  AnimationState,
  EasingFunction,
  SpringConfig
} from "~/animation/types";
import { resolveEasing } from "~/animation/easing";
import { resolveSpringConfig, stepSpring } from "~/animation/spring";

const MAX_DT = 64; // ms — clamp for tab-backgrounding safety

const DEFAULT_TIMING_CONFIG: AnimationConfig = {
  type: "timing",
  duration: 300,
  easing: "easeOut"
};

export class AnimationDriver {
  private readonly callbacks: AnimationCallbacks;
  private readonly defaultConfig: AnimationConfig;

  // Pre-allocated mutable state — zero allocations per frame
  private readonly state: AnimationState = {
    running: false,
    startTime: 0,
    fromOffset: 0,
    toOffset: 0,
    distance: 0,
    currentOffset: 0,
    springVelocity: 0,
    rafId: 0
  };

  private destroyed = false;

  // Resolved once at animation start, reused per frame
  private activeEasing: EasingFunction | null = null;
  private activeSpringConfig: SpringConfig | null = null;
  private activeDuration = 0;
  private activeType: "timing" | "spring" = "timing";
  private lastFrameTime = 0;

  // Bound in constructor — no per-frame closure
  private readonly boundTick: (timestamp: number) => void;

  constructor(callbacks: AnimationCallbacks, config?: AnimationDriverConfig) {
    this.callbacks = callbacks;
    this.defaultConfig = config?.defaultAnimation ?? DEFAULT_TIMING_CONFIG;
    this.boundTick = this.tick.bind(this);
  }

  animate(fromOffset: number, toOffset: number, config?: AnimationConfig): void {
    if (this.destroyed) return;

    // Same position — immediate complete
    if (fromOffset === toOffset) {
      this.callbacks.onComplete(toOffset);
      return;
    }

    // Cancel any in-flight animation
    if (this.state.running) {
      this.cancelRaf();
      // No onCancel here — this is an implicit cancel by starting a new animation
    }

    const animConfig = config ?? this.defaultConfig;

    // Populate state in place
    this.state.running = true;
    this.state.startTime = -1; // sentinel: set on first frame
    this.state.fromOffset = fromOffset;
    this.state.toOffset = toOffset;
    this.state.distance = toOffset - fromOffset;
    this.state.currentOffset = fromOffset;
    this.state.springVelocity = 0;
    this.state.rafId = 0;
    this.lastFrameTime = -1;

    // Resolve config once
    this.activeType = animConfig.type;
    if (animConfig.type === "timing") {
      this.activeEasing = resolveEasing(animConfig.easing);
      this.activeDuration = animConfig.duration;
      this.activeSpringConfig = null;
    } else {
      this.activeSpringConfig = resolveSpringConfig(animConfig.spring);
      this.activeEasing = null;
      this.activeDuration = 0;
    }

    // Request first frame
    this.state.rafId = requestAnimationFrame(this.boundTick);
  }

  /**
   * HOT PATH — zero allocations.
   */
  private tick(timestamp: number): void {
    if (!this.state.running) return;

    if (this.activeType === "timing") {
      this.tickTiming(timestamp);
    } else {
      this.tickSpring(timestamp);
    }
  }

  private tickTiming(timestamp: number): void {
    // Set start time on first frame
    if (this.state.startTime < 0) {
      this.state.startTime = timestamp;
    }

    const elapsed = timestamp - this.state.startTime;
    const progress = Math.min(elapsed / this.activeDuration, 1);
    const easedProgress = this.activeEasing!(progress);

    this.state.currentOffset = this.state.fromOffset + this.state.distance * easedProgress;

    this.callbacks.onUpdate(this.state.currentOffset);

    if (progress >= 1) {
      this.complete();
    } else {
      this.state.rafId = requestAnimationFrame(this.boundTick);
    }
  }

  private tickSpring(timestamp: number): void {
    // Set start time on first frame
    if (this.lastFrameTime < 0) {
      this.lastFrameTime = timestamp;
      // First frame: just call update with current position and schedule next
      this.callbacks.onUpdate(this.state.currentOffset);
      this.state.rafId = requestAnimationFrame(this.boundTick);
      return;
    }

    let dt = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;

    // Clamp dt for tab-backgrounding safety
    if (dt > MAX_DT) {
      dt = MAX_DT;
    }

    // Convert to seconds for physics calculation
    const dtSeconds = dt / 1000;

    const settled = stepSpring(this.state, this.activeSpringConfig!, dtSeconds);

    this.callbacks.onUpdate(this.state.currentOffset);

    if (settled) {
      this.complete();
    } else {
      this.state.rafId = requestAnimationFrame(this.boundTick);
    }
  }

  private complete(): void {
    this.state.running = false;
    this.state.currentOffset = this.state.toOffset;
    this.callbacks.onComplete(this.state.toOffset);
  }

  cancel(): void {
    if (!this.state.running) return;

    this.cancelRaf();
    this.state.running = false;
    const offset = this.state.currentOffset;
    this.callbacks.onCancel?.(offset);
  }

  isRunning(): boolean {
    return this.state.running;
  }

  getState(): Readonly<AnimationState> {
    return this.state;
  }

  destroy(): void {
    if (this.state.running) {
      this.cancelRaf();
      this.state.running = false;
    }
    this.destroyed = true;
  }

  private cancelRaf(): void {
    if (this.state.rafId !== 0) {
      cancelAnimationFrame(this.state.rafId);
      this.state.rafId = 0;
    }
  }
}
