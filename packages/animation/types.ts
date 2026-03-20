export type EasingFunction = (t: number) => number;

export type EasingPreset = "linear" | "easeOut" | "easeInOut" | "easeOutCubic" | "easeOutQuart";

export interface SpringConfig {
  tension: number;
  friction: number;
  mass: number;
  restVelocityThreshold: number;
  restDisplacementThreshold: number;
}

export interface TimingAnimationConfig {
  type: "timing";
  duration: number;
  easing: EasingFunction | EasingPreset;
}

export interface SpringAnimationConfig {
  type: "spring";
  spring: Partial<SpringConfig>;
}

export type AnimationConfig = TimingAnimationConfig | SpringAnimationConfig;

/**
 * Pre-allocated, mutated in place — zero allocation per frame.
 */
export interface AnimationState {
  running: boolean;
  startTime: number;
  fromOffset: number;
  toOffset: number;
  distance: number;
  currentOffset: number;
  springVelocity: number;
  rafId: number;
}

export interface AnimationCallbacks {
  onUpdate: (offset: number) => void;
  onComplete: (targetOffset: number) => void;
  onCancel?: (currentOffset: number) => void;
}

export interface AnimationDriverConfig {
  defaultAnimation: AnimationConfig;
}
