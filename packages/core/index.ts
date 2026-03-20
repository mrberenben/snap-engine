// Types
export type {
  SnapItem,
  SnapEngineConfig,
  EngineState,
  SnapResult,
  SnapEngineEventMap,
  SnapPointAlignment
} from "~/core/types";

// Events
export { EventEmitter } from "~/core/events/event-emitter";

// Algorithms
export { VelocityTracker } from "~/core/algorithms/velocity-tracker";
export { resolveSnap, findNearestSnap, findDirectionalSnap } from "~/core/algorithms/snap-resolver";
export type { ResolveSnapParams } from "~/core/algorithms/snap-resolver";
export {
  calculateLayout,
  recalculateLayout,
  getOffsetForIndex,
  getIndexAtOffset
} from "~/core/algorithms/layout-calculator";
export { clampOffset, isAtBoundary, applyElasticOverscroll } from "~/core/algorithms/overscroll";

// Engine
export { SnapEngine } from "~/core/engine/snap-engine";
export { DEFAULT_CONFIG, createInitialState, resetVelocity } from "~/core/engine/state";
