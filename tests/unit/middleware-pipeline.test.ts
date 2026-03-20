import { describe, it, expect, vi } from "vitest";
import { MiddlewarePipeline } from "~/middleware/pipeline";
import type { Middleware, SnapContext, BeforeSnapPayload } from "~/middleware/types";
import type { EngineState, SnapResult } from "~/core/types";

function createContext(overrides?: Partial<SnapContext>): SnapContext {
  return {
    items: [
      { index: 0, offset: 0, size: 100 },
      { index: 1, offset: 100, size: 100 },
      { index: 2, offset: 200, size: 100 }
    ],
    currentIndex: 0,
    currentOffset: 50,
    velocity: 2,
    config: {
      axis: "y",
      velocityThreshold: 0.5,
      multiSkipFactor: 1,
      maxSkipCount: 3,
      overscrollEnabled: false,
      snapPointAlignment: "start",
      viewportSize: 100
    },
    ...overrides
  };
}

function createParams(overrides?: Partial<BeforeSnapPayload>): BeforeSnapPayload {
  return {
    velocity: 2,
    currentIndex: 0,
    currentOffset: 50,
    velocityThreshold: 0.5,
    maxSkipCount: 3,
    ...overrides
  };
}

function createResult(overrides?: Partial<SnapResult>): SnapResult {
  return {
    targetIndex: 1,
    targetOffset: 100,
    direction: 1,
    skippedCount: 1,
    ...overrides
  };
}

function createEngineState(): Readonly<EngineState> {
  return {
    items: [{ index: 0, offset: 0, size: 100 }],
    currentOffset: 0,
    velocity: 0,
    activeIndex: 0,
    isSettled: true,
    itemCount: 1
  };
}

describe("MiddlewarePipeline", () => {
  describe("empty pipeline", () => {
    it("all run methods are no-ops", () => {
      const pipeline = new MiddlewarePipeline({ middlewares: [] });
      const context = createContext();
      const params = createParams();
      const result = createResult();

      expect(pipeline.runOnVelocity(5)).toBe(5);
      expect(pipeline.runBeforeSnap(context, params)).toBe(params);
      expect(pipeline.runAfterSnap(context, result)).toBe(result);

      // Observation hooks just shouldn't throw
      pipeline.runOnScroll(100);
      pipeline.runOnSettle(1);
    });

    it("hasSnapHooks returns false", () => {
      const pipeline = new MiddlewarePipeline({ middlewares: [] });
      expect(pipeline.hasSnapHooks()).toBe(false);
    });
  });

  describe("runOnVelocity", () => {
    it("single middleware modifies velocity", () => {
      const mw: Middleware = {
        name: "double-velocity",
        onVelocity: (v) => v * 2
      };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw] });

      expect(pipeline.runOnVelocity(3)).toBe(6);
    });

    it("chained middlewares compose sequentially", () => {
      const mw1: Middleware = {
        name: "double",
        onVelocity: (v) => v * 2
      };
      const mw2: Middleware = {
        name: "add-one",
        onVelocity: (v) => v + 1
      };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw1, mw2] });

      // 3 * 2 = 6, 6 + 1 = 7
      expect(pipeline.runOnVelocity(3)).toBe(7);
    });
  });

  describe("runBeforeSnap", () => {
    it("modifies params", () => {
      const mw: Middleware = {
        name: "clamp-velocity",
        beforeSnap: (input) => ({
          ...input.params,
          velocity: Math.min(input.params.velocity, 1)
        })
      };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw] });
      const context = createContext();
      const params = createParams({ velocity: 5 });

      const result = pipeline.runBeforeSnap(context, params);
      expect(result.velocity).toBe(1);
    });

    it("chained middlewares compose sequentially", () => {
      const mw1: Middleware = {
        name: "bump-index",
        beforeSnap: (input) => ({
          ...input.params,
          currentIndex: input.params.currentIndex + 1
        })
      };
      const mw2: Middleware = {
        name: "bump-index-again",
        beforeSnap: (input) => ({
          ...input.params,
          currentIndex: input.params.currentIndex + 1
        })
      };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw1, mw2] });
      const context = createContext();
      const params = createParams({ currentIndex: 0 });

      const result = pipeline.runBeforeSnap(context, params);
      expect(result.currentIndex).toBe(2);
    });
  });

  describe("runAfterSnap", () => {
    it("remaps targetIndex and targetOffset", () => {
      const mw: Middleware = {
        name: "remap",
        afterSnap: (input) => ({
          ...input.result,
          targetIndex: input.result.targetIndex + 1,
          targetOffset: input.result.targetOffset + 100
        })
      };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw] });
      const context = createContext();
      const result = createResult({ targetIndex: 0, targetOffset: 0 });

      const final = pipeline.runAfterSnap(context, result);
      expect(final.targetIndex).toBe(1);
      expect(final.targetOffset).toBe(100);
    });

    it("chained middlewares compose sequentially", () => {
      const mw1: Middleware = {
        name: "add-one",
        afterSnap: (input) => ({
          ...input.result,
          targetIndex: input.result.targetIndex + 1
        })
      };
      const mw2: Middleware = {
        name: "double",
        afterSnap: (input) => ({
          ...input.result,
          targetIndex: input.result.targetIndex * 2
        })
      };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw1, mw2] });
      const context = createContext();
      const result = createResult({ targetIndex: 1 });

      // 1 + 1 = 2, 2 * 2 = 4
      const final = pipeline.runAfterSnap(context, result);
      expect(final.targetIndex).toBe(4);
    });
  });

  describe("runOnScroll", () => {
    it("calls all observation hooks with correct offset", () => {
      const spy1 = vi.fn();
      const spy2 = vi.fn();
      const mw1: Middleware = { name: "logger1", onScroll: spy1 };
      const mw2: Middleware = { name: "logger2", onScroll: spy2 };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw1, mw2] });

      pipeline.runOnScroll(42);

      expect(spy1).toHaveBeenCalledWith(42);
      expect(spy2).toHaveBeenCalledWith(42);
    });
  });

  describe("runOnSettle", () => {
    it("calls all settle hooks with correct index", () => {
      const spy1 = vi.fn();
      const spy2 = vi.fn();
      const mw1: Middleware = { name: "settle1", onSettle: spy1 };
      const mw2: Middleware = { name: "settle2", onSettle: spy2 };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw1, mw2] });

      pipeline.runOnSettle(3);

      expect(spy1).toHaveBeenCalledWith(3);
      expect(spy2).toHaveBeenCalledWith(3);
    });
  });

  describe("init", () => {
    it("calls onInit on all middlewares", () => {
      const spy1 = vi.fn();
      const spy2 = vi.fn();
      const mw1: Middleware = { name: "init1", onInit: spy1 };
      const mw2: Middleware = { name: "init2", onInit: spy2 };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw1, mw2] });
      const state = createEngineState();

      pipeline.init(state);

      expect(spy1).toHaveBeenCalledWith(state);
      expect(spy2).toHaveBeenCalledWith(state);
    });

    it("second call is a no-op", () => {
      const spy = vi.fn();
      const mw: Middleware = { name: "once", onInit: spy };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw] });
      const state = createEngineState();

      pipeline.init(state);
      pipeline.init(state);

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("destroy", () => {
    it("calls onDestroy on all middlewares", () => {
      const spy1 = vi.fn();
      const spy2 = vi.fn();
      const mw1: Middleware = { name: "d1", onDestroy: spy1 };
      const mw2: Middleware = { name: "d2", onDestroy: spy2 };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw1, mw2] });

      pipeline.destroy();

      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
    });

    it("subsequent runs are safe after destroy", () => {
      const spy = vi.fn();
      const mw: Middleware = { name: "obs", onScroll: spy };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw] });

      pipeline.destroy();

      // These should still work (not throw) — hooks still cached
      pipeline.runOnScroll(100);
      expect(spy).toHaveBeenCalledWith(100);
    });

    it("second destroy call is a no-op", () => {
      const spy = vi.fn();
      const mw: Middleware = { name: "d", onDestroy: spy };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw] });

      pipeline.destroy();
      pipeline.destroy();

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("hasSnapHooks", () => {
    it("returns true with beforeSnap", () => {
      const mw: Middleware = {
        name: "before",
        beforeSnap: (input) => input.params
      };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw] });
      expect(pipeline.hasSnapHooks()).toBe(true);
    });

    it("returns true with afterSnap", () => {
      const mw: Middleware = {
        name: "after",
        afterSnap: (input) => input.result
      };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw] });
      expect(pipeline.hasSnapHooks()).toBe(true);
    });

    it("returns true with onVelocity", () => {
      const mw: Middleware = {
        name: "vel",
        onVelocity: (v) => v
      };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw] });
      expect(pipeline.hasSnapHooks()).toBe(true);
    });

    it("returns false with only observation hooks", () => {
      const mw: Middleware = {
        name: "observer",
        onScroll: () => {},
        onSettle: () => {}
      };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw] });
      expect(pipeline.hasSnapHooks()).toBe(false);
    });
  });

  describe("hasHook", () => {
    it("checks specific hook type", () => {
      const mw: Middleware = {
        name: "mixed",
        onScroll: () => {},
        beforeSnap: (input) => input.params
      };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw] });

      expect(pipeline.hasHook("onScroll")).toBe(true);
      expect(pipeline.hasHook("beforeSnap")).toBe(true);
      expect(pipeline.hasHook("afterSnap")).toBe(false);
      expect(pipeline.hasHook("onVelocity")).toBe(false);
      expect(pipeline.hasHook("onSettle")).toBe(false);
      expect(pipeline.hasHook("onInit")).toBe(false);
      expect(pipeline.hasHook("onDestroy")).toBe(false);
    });
  });

  describe("getMiddlewares", () => {
    it("returns the middlewares array", () => {
      const mw1: Middleware = { name: "a" };
      const mw2: Middleware = { name: "b" };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw1, mw2] });

      const result = pipeline.getMiddlewares();
      expect(result).toHaveLength(2);
      expect(result[0]!.name).toBe("a");
      expect(result[1]!.name).toBe("b");
    });
  });

  describe("getMiddlewareByName", () => {
    it("finds middleware by name", () => {
      const mw1: Middleware = { name: "alpha" };
      const mw2: Middleware = { name: "beta" };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw1, mw2] });

      expect(pipeline.getMiddlewareByName("beta")).toBe(mw2);
    });

    it("returns undefined for unknown name", () => {
      const mw: Middleware = { name: "alpha" };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw] });

      expect(pipeline.getMiddlewareByName("gamma")).toBeUndefined();
    });
  });
});
