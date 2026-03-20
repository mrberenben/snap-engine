import type { ScrollAxis } from "~/types";
import type { AnimationConfig } from "~/animation/types";
import type { MiddlewarePipeline } from "~/middleware/pipeline";

// --- Configuration ---

export interface ScrollContainerConfig {
  axis: ScrollAxis;
  overscrollBehavior: "contain" | "none" | "auto";
}

export interface InputObserverConfig {
  axis: ScrollAxis;
  wheelIdleTimeout: number;
}

export interface SnapControllerConfig {
  axis: ScrollAxis;
  viewportSize: number;
  wheelIdleTimeout: number;
  overscrollBehavior: "contain" | "none" | "auto";
  animationConfig?: AnimationConfig;
  items: number[];
  pipeline?: MiddlewarePipeline;
}

// --- Interaction model ---

export type InteractionSource = "touch" | "wheel" | "programmatic";
export type InteractionPhase = "start" | "move" | "end";

export interface InteractionEvent {
  source: InteractionSource;
  phase: InteractionPhase;
  offset: number;
  delta: number;
  timestamp: number;
}

// --- Callbacks ---

export interface InputObserverCallbacks {
  onInteraction: (event: InteractionEvent) => void;
}

// --- Measurement ---

export interface MeasurementCache {
  viewportSize: number;
  contentSize: number;
  lastMeasureTime: number;
}

// --- Resize ---

export interface ResizeObserverCallbacks {
  onViewportResize: (size: number) => void;
  onItemResize: (index: number, size: number) => void;
}

// --- SnapController events ---

export interface SnapControllerEventMap {
  interactionStart: { source: InteractionSource };
  interactionEnd: { source: InteractionSource };
  snapStart: { targetIndex: number; targetOffset: number };
  snapComplete: { index: number };
  offsetChange: { offset: number };
}
