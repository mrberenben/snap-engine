import type { EngineState, SnapEngineConfig } from "~/core/types";

export const DEFAULT_CONFIG: SnapEngineConfig = {
  axis: "y",
  velocityThreshold: 0.5,
  multiSkipFactor: 1,
  maxSkipCount: 3,
  overscrollEnabled: false,
  snapPointAlignment: "start",
  viewportSize: 0
};

export function createInitialState(): EngineState {
  return {
    items: [],
    currentOffset: 0,
    velocity: 0,
    activeIndex: 0,
    isSettled: true,
    itemCount: 0
  };
}

export function resetVelocity(state: EngineState): void {
  state.velocity = 0;
}
