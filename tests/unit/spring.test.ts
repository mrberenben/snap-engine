import { describe, it, expect } from "vitest";
import {
  DEFAULT_SPRING_CONFIG,
  resolveSpringConfig,
  stepSpring,
} from "~/animation/spring";
import type { AnimationState, SpringConfig } from "~/animation/types";

function createState(
  from: number,
  to: number,
  velocity = 0,
): AnimationState {
  return {
    running: true,
    startTime: 0,
    fromOffset: from,
    toOffset: to,
    distance: to - from,
    currentOffset: from,
    springVelocity: velocity,
    rafId: 0,
  };
}

describe("spring", () => {
  describe("DEFAULT_SPRING_CONFIG", () => {
    it("has expected defaults", () => {
      expect(DEFAULT_SPRING_CONFIG.tension).toBe(170);
      expect(DEFAULT_SPRING_CONFIG.friction).toBe(26);
      expect(DEFAULT_SPRING_CONFIG.mass).toBe(1);
      expect(DEFAULT_SPRING_CONFIG.restVelocityThreshold).toBe(0.01);
      expect(DEFAULT_SPRING_CONFIG.restDisplacementThreshold).toBe(0.1);
    });
  });

  describe("resolveSpringConfig", () => {
    it("returns defaults when given empty object", () => {
      const config = resolveSpringConfig({});
      expect(config).toEqual(DEFAULT_SPRING_CONFIG);
    });

    it("overrides specific fields", () => {
      const config = resolveSpringConfig({ tension: 300, mass: 2 });
      expect(config.tension).toBe(300);
      expect(config.mass).toBe(2);
      expect(config.friction).toBe(DEFAULT_SPRING_CONFIG.friction);
    });

    it("overrides all fields", () => {
      const custom: SpringConfig = {
        tension: 100,
        friction: 10,
        mass: 3,
        restVelocityThreshold: 0.05,
        restDisplacementThreshold: 0.5,
      };
      expect(resolveSpringConfig(custom)).toEqual(custom);
    });
  });

  describe("stepSpring", () => {
    it("converges to target within reasonable steps", () => {
      const state = createState(0, 500);
      const config = resolveSpringConfig({});
      const dt = 1 / 60; // ~16.67ms in seconds

      let settled = false;
      for (let i = 0; i < 600; i++) {
        settled = stepSpring(state, config, dt);
        if (settled) break;
      }

      expect(settled).toBe(true);
      expect(state.currentOffset).toBe(500);
      expect(state.springVelocity).toBe(0);
    });

    it("high tension + friction = fast settle", () => {
      const state = createState(0, 100);
      const config = resolveSpringConfig({ tension: 500, friction: 50 });
      const dt = 1 / 60;

      let steps = 0;
      for (let i = 0; i < 600; i++) {
        steps++;
        if (stepSpring(state, config, dt)) break;
      }

      // Should settle in fewer steps than default config
      const stateDefault = createState(0, 100);
      const defaultConfig = resolveSpringConfig({});
      let defaultSteps = 0;
      for (let i = 0; i < 600; i++) {
        defaultSteps++;
        if (stepSpring(stateDefault, defaultConfig, dt)) break;
      }

      expect(steps).toBeLessThan(defaultSteps);
    });

    it("low friction causes overshoot", () => {
      const state = createState(0, 100);
      const config = resolveSpringConfig({ tension: 170, friction: 5 });
      const dt = 1 / 60;

      let maxOffset = 0;
      for (let i = 0; i < 1200; i++) {
        stepSpring(state, config, dt);
        if (state.currentOffset > maxOffset) {
          maxOffset = state.currentOffset;
        }
        if (state.currentOffset === 100 && state.springVelocity === 0) break;
      }

      // Should have overshot past 100
      expect(maxOffset).toBeGreaterThan(100);
    });

    it("snaps exactly to target on settle", () => {
      const state = createState(0, 333.333);
      const config = resolveSpringConfig({});
      const dt = 1 / 60;

      for (let i = 0; i < 600; i++) {
        if (stepSpring(state, config, dt)) break;
      }

      expect(state.currentOffset).toBe(333.333);
      expect(state.springVelocity).toBe(0);
    });

    it("large dt does not cause explosion", () => {
      const state = createState(0, 100);
      const config = resolveSpringConfig({});
      // Simulate a very large frame gap (64ms clamped from driver)
      const dt = 64 / 1000;

      for (let i = 0; i < 600; i++) {
        stepSpring(state, config, dt);
        // Should never produce NaN or Infinity
        expect(Number.isFinite(state.currentOffset)).toBe(true);
        expect(Number.isFinite(state.springVelocity)).toBe(true);
        if (state.currentOffset === 100 && state.springVelocity === 0) break;
      }
    });

    it("moves in correct direction toward target", () => {
      // Forward
      const stateForward = createState(0, 100);
      const config = resolveSpringConfig({});
      stepSpring(stateForward, config, 1 / 60);
      expect(stateForward.currentOffset).toBeGreaterThan(0);

      // Backward
      const stateBackward = createState(100, 0);
      stepSpring(stateBackward, config, 1 / 60);
      expect(stateBackward.currentOffset).toBeLessThan(100);
    });
  });
});
