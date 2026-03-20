import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AnimationDriver } from "~/animation/animation-driver";
import type { AnimationCallbacks, AnimationConfig } from "~/animation/types";

// Manual rAF control
let rafCallbacks: Map<number, (timestamp: number) => void>;
let nextRafId: number;

function setupRaf(): void {
  rafCallbacks = new Map();
  nextRafId = 1;

  vi.stubGlobal("requestAnimationFrame", (cb: (timestamp: number) => void) => {
    const id = nextRafId++;
    rafCallbacks.set(id, cb);
    return id;
  });

  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    rafCallbacks.delete(id);
  });
}

function flushFrame(timestamp: number): void {
  const cbs = Array.from(rafCallbacks.entries());
  rafCallbacks.clear();
  for (const [, cb] of cbs) {
    cb(timestamp);
  }
}

function flushFrames(timestamps: number[]): void {
  for (const ts of timestamps) {
    flushFrame(ts);
  }
}

function createCallbacks(
  overrides: Partial<AnimationCallbacks> = {},
): AnimationCallbacks {
  return {
    onUpdate: overrides.onUpdate ?? vi.fn(),
    onComplete: overrides.onComplete ?? vi.fn(),
    onCancel: overrides.onCancel ?? vi.fn(),
  };
}

describe("AnimationDriver", () => {
  beforeEach(() => {
    setupRaf();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("timing animation", () => {
    it("starts rAF on animate()", () => {
      const callbacks = createCallbacks();
      const driver = new AnimationDriver(callbacks);

      driver.animate(0, 500, {
        type: "timing",
        duration: 300,
        easing: "linear",
      });

      expect(rafCallbacks.size).toBe(1);
      expect(driver.isRunning()).toBe(true);
    });

    it("calls onUpdate with interpolated values", () => {
      const onUpdate = vi.fn();
      const callbacks = createCallbacks({ onUpdate });
      const driver = new AnimationDriver(callbacks);

      driver.animate(0, 300, {
        type: "timing",
        duration: 300,
        easing: "linear",
      });

      // First frame sets start time
      flushFrame(0);
      expect(onUpdate).toHaveBeenCalledWith(0);

      // Halfway through
      flushFrame(150);
      expect(onUpdate).toHaveBeenCalledWith(150);
    });

    it("calls onComplete with exact target on completion", () => {
      const onComplete = vi.fn();
      const callbacks = createCallbacks({ onComplete });
      const driver = new AnimationDriver(callbacks);

      driver.animate(0, 300, {
        type: "timing",
        duration: 300,
        easing: "linear",
      });

      flushFrame(0); // start
      flushFrame(300); // end

      expect(onComplete).toHaveBeenCalledWith(300);
      expect(driver.isRunning()).toBe(false);
    });

    it("clamps progress at 1 for overshoot timestamps", () => {
      const onComplete = vi.fn();
      const onUpdate = vi.fn();
      const callbacks = createCallbacks({ onComplete, onUpdate });
      const driver = new AnimationDriver(callbacks);

      driver.animate(0, 100, {
        type: "timing",
        duration: 200,
        easing: "linear",
      });

      flushFrame(0);
      flushFrame(500); // way past duration

      expect(onComplete).toHaveBeenCalledWith(100);
    });

    it("applies easing function", () => {
      const onUpdate = vi.fn();
      const callbacks = createCallbacks({ onUpdate });
      const driver = new AnimationDriver(callbacks);

      driver.animate(0, 100, {
        type: "timing",
        duration: 100,
        easing: "easeOut",
      });

      flushFrame(0); // start time
      flushFrame(50); // halfway

      // easeOut(0.5) = 1 - (1-0.5)^2 = 0.75 → offset 75
      const midValue = onUpdate.mock.calls[1]![0] as number;
      expect(midValue).toBeCloseTo(75, 5);
    });

    it("does not request additional frames after completion", () => {
      const callbacks = createCallbacks();
      const driver = new AnimationDriver(callbacks);

      driver.animate(0, 100, {
        type: "timing",
        duration: 100,
        easing: "linear",
      });

      flushFrame(0);
      flushFrame(100);

      expect(rafCallbacks.size).toBe(0);
      expect(driver.isRunning()).toBe(false);
    });
  });

  describe("spring animation", () => {
    it("converges to target", () => {
      const onComplete = vi.fn();
      const onUpdate = vi.fn();
      const callbacks = createCallbacks({ onComplete, onUpdate });
      const driver = new AnimationDriver(callbacks);

      const config: AnimationConfig = {
        type: "spring",
        spring: { tension: 170, friction: 26 },
      };

      driver.animate(0, 200, config);

      // Run enough frames (at ~60fps) for spring to settle
      let t = 0;
      for (let i = 0; i < 600; i++) {
        flushFrame(t);
        t += 16.67;
        if (onComplete.mock.calls.length > 0) break;
      }

      expect(onComplete).toHaveBeenCalledWith(200);
      expect(driver.isRunning()).toBe(false);
    });

    it("calls onUpdate on each frame", () => {
      const onUpdate = vi.fn();
      const callbacks = createCallbacks({ onUpdate });
      const driver = new AnimationDriver(callbacks);

      driver.animate(0, 100, {
        type: "spring",
        spring: {},
      });

      flushFrame(0);
      flushFrame(16.67);
      flushFrame(33.34);

      expect(onUpdate.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("cancel", () => {
    it("stops the animation and calls onCancel", () => {
      const onCancel = vi.fn();
      const callbacks = createCallbacks({ onCancel });
      const driver = new AnimationDriver(callbacks);

      driver.animate(0, 300, {
        type: "timing",
        duration: 300,
        easing: "linear",
      });

      flushFrame(0);
      flushFrame(150);

      driver.cancel();

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(driver.isRunning()).toBe(false);
      expect(rafCallbacks.size).toBe(0);
    });

    it("cancel while idle is a no-op", () => {
      const onCancel = vi.fn();
      const callbacks = createCallbacks({ onCancel });
      const driver = new AnimationDriver(callbacks);

      driver.cancel();

      expect(onCancel).not.toHaveBeenCalled();
    });

    it("cancel with no onCancel callback does not throw", () => {
      const callbacks: AnimationCallbacks = {
        onUpdate: vi.fn(),
        onComplete: vi.fn(),
      };
      const driver = new AnimationDriver(callbacks);

      driver.animate(0, 100, {
        type: "timing",
        duration: 100,
        easing: "linear",
      });

      flushFrame(0);

      expect(() => driver.cancel()).not.toThrow();
    });
  });

  describe("animate during animation", () => {
    it("cancels previous animation and starts new one", () => {
      const onUpdate = vi.fn();
      const onComplete = vi.fn();
      const callbacks = createCallbacks({ onUpdate, onComplete });
      const driver = new AnimationDriver(callbacks);

      driver.animate(0, 300, {
        type: "timing",
        duration: 300,
        easing: "linear",
      });

      flushFrame(0);
      flushFrame(100);

      // Start new animation mid-flight
      driver.animate(100, 500, {
        type: "timing",
        duration: 200,
        easing: "linear",
      });

      expect(driver.isRunning()).toBe(true);

      flushFrame(0);
      flushFrame(200);

      expect(onComplete).toHaveBeenCalledWith(500);
    });
  });

  describe("same from/to", () => {
    it("calls onComplete immediately without starting rAF", () => {
      const onComplete = vi.fn();
      const onUpdate = vi.fn();
      const callbacks = createCallbacks({ onComplete, onUpdate });
      const driver = new AnimationDriver(callbacks);

      driver.animate(100, 100);

      expect(onComplete).toHaveBeenCalledWith(100);
      expect(onUpdate).not.toHaveBeenCalled();
      expect(driver.isRunning()).toBe(false);
      expect(rafCallbacks.size).toBe(0);
    });
  });

  describe("isRunning", () => {
    it("tracks state correctly through lifecycle", () => {
      const callbacks = createCallbacks();
      const driver = new AnimationDriver(callbacks);

      expect(driver.isRunning()).toBe(false);

      driver.animate(0, 100, {
        type: "timing",
        duration: 100,
        easing: "linear",
      });
      expect(driver.isRunning()).toBe(true);

      flushFrame(0);
      flushFrame(100);
      expect(driver.isRunning()).toBe(false);
    });
  });

  describe("getState", () => {
    it("returns current animation state", () => {
      const callbacks = createCallbacks();
      const driver = new AnimationDriver(callbacks);

      driver.animate(50, 250, {
        type: "timing",
        duration: 200,
        easing: "linear",
      });

      const state = driver.getState();
      expect(state.running).toBe(true);
      expect(state.fromOffset).toBe(50);
      expect(state.toOffset).toBe(250);
      expect(state.distance).toBe(200);
    });
  });

  describe("destroy", () => {
    it("cancels running animation", () => {
      const callbacks = createCallbacks();
      const driver = new AnimationDriver(callbacks);

      driver.animate(0, 100, {
        type: "timing",
        duration: 100,
        easing: "linear",
      });

      driver.destroy();

      expect(driver.isRunning()).toBe(false);
      expect(rafCallbacks.size).toBe(0);
    });

    it("prevents future animations", () => {
      const onComplete = vi.fn();
      const onUpdate = vi.fn();
      const callbacks = createCallbacks({ onComplete, onUpdate });
      const driver = new AnimationDriver(callbacks);

      driver.destroy();
      driver.animate(0, 100);

      expect(onComplete).not.toHaveBeenCalled();
      expect(onUpdate).not.toHaveBeenCalled();
      expect(driver.isRunning()).toBe(false);
    });
  });

  describe("default config", () => {
    it("uses provided default animation config", () => {
      const onUpdate = vi.fn();
      const onComplete = vi.fn();
      const callbacks = createCallbacks({ onUpdate, onComplete });

      const driver = new AnimationDriver(callbacks, {
        defaultAnimation: {
          type: "timing",
          duration: 500,
          easing: "linear",
        },
      });

      driver.animate(0, 500);

      flushFrame(0);
      flushFrame(250);

      // At 250ms of 500ms duration with linear easing → offset 250
      const midValue = onUpdate.mock.calls[1]![0] as number;
      expect(midValue).toBeCloseTo(250, 5);
    });
  });
});
