import type { AnimationState, SpringConfig } from "~/animation/types";

export const DEFAULT_SPRING_CONFIG: SpringConfig = {
  tension: 170,
  friction: 26,
  mass: 1,
  restVelocityThreshold: 0.01,
  restDisplacementThreshold: 0.1
};

export function resolveSpringConfig(partial: Partial<SpringConfig>): SpringConfig {
  return {
    tension: partial.tension ?? DEFAULT_SPRING_CONFIG.tension,
    friction: partial.friction ?? DEFAULT_SPRING_CONFIG.friction,
    mass: partial.mass ?? DEFAULT_SPRING_CONFIG.mass,
    restVelocityThreshold: partial.restVelocityThreshold ?? DEFAULT_SPRING_CONFIG.restVelocityThreshold,
    restDisplacementThreshold: partial.restDisplacementThreshold ?? DEFAULT_SPRING_CONFIG.restDisplacementThreshold
  };
}

/**
 * Semi-implicit Euler integration, one frame step.
 * Mutates `state` in place. Returns `true` when the spring has settled.
 */
export function stepSpring(state: AnimationState, config: SpringConfig, dt: number): boolean {
  const displacement = state.currentOffset - state.toOffset;

  // Spring force: F = -tension * displacement
  const springForce = -config.tension * displacement;
  // Damping force: F = -friction * velocity
  const dampingForce = -config.friction * state.springVelocity;
  // Acceleration
  const acceleration = (springForce + dampingForce) / config.mass;

  // Semi-implicit Euler: update velocity first, then position
  state.springVelocity += acceleration * dt;
  state.currentOffset += state.springVelocity * dt;

  // Check if settled
  const isSettled =
    Math.abs(state.springVelocity) < config.restVelocityThreshold &&
    Math.abs(state.currentOffset - state.toOffset) < config.restDisplacementThreshold;

  if (isSettled) {
    state.currentOffset = state.toOffset;
    state.springVelocity = 0;
  }

  return isSettled;
}
