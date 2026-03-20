import { describe, it, expect, vi } from "vitest";
import { SnapEngine } from "~/core/engine/snap-engine";

describe("SnapEngine", () => {
  it("starts with empty state", () => {
    const engine = new SnapEngine();
    const state = engine.getState();

    expect(state.items).toEqual([]);
    expect(state.currentOffset).toBe(0);
    expect(state.velocity).toBe(0);
    expect(state.activeIndex).toBe(0);
    expect(state.isSettled).toBe(true);
    expect(state.itemCount).toBe(0);
  });

  describe("item management", () => {
    it("registerItems creates layout from sizes", () => {
      const engine = new SnapEngine();
      engine.registerItems([100, 200, 150]);

      const items = engine.getItems();
      expect(items).toHaveLength(3);
      expect(items[0]).toEqual({ index: 0, offset: 0, size: 100 });
      expect(items[1]).toEqual({ index: 1, offset: 100, size: 200 });
      expect(items[2]).toEqual({ index: 2, offset: 300, size: 150 });
      expect(engine.getState().itemCount).toBe(3);
    });

    it("registerItem inserts at correct position", () => {
      const engine = new SnapEngine();
      engine.registerItem(0, 100);
      engine.registerItem(1, 200);

      expect(engine.getItems()).toHaveLength(2);
      expect(engine.getItems()[0]!.size).toBe(100);
      expect(engine.getItems()[1]!.size).toBe(200);
    });

    it("updateItemSize recalculates layout", () => {
      const engine = new SnapEngine();
      engine.registerItems([100, 100, 100]);
      engine.updateItemSize(1, 200);

      const items = engine.getItems();
      expect(items[1]!.size).toBe(200);
      expect(items[2]!.offset).toBe(300); // 100 + 200
    });

    it("removeItem re-indexes and rebuilds layout", () => {
      const engine = new SnapEngine();
      engine.registerItems([100, 200, 150]);
      engine.removeItem(1);

      const items = engine.getItems();
      expect(items).toHaveLength(2);
      expect(items[0]!.size).toBe(100);
      expect(items[1]!.size).toBe(150);
      expect(items[1]!.index).toBe(1);
      expect(items[1]!.offset).toBe(100);
    });

    it("emits itemsChange on registration", () => {
      const engine = new SnapEngine();
      const handler = vi.fn();

      engine.on("itemsChange", handler);
      engine.registerItems([100, 200]);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        items: expect.arrayContaining([
          expect.objectContaining({ index: 0, size: 100 }),
        ]),
      });
    });
  });

  describe("offset tracking", () => {
    it("updateOffset updates currentOffset and emits offsetChange", () => {
      const engine = new SnapEngine();
      engine.registerItems([100, 100, 100]);
      const handler = vi.fn();

      engine.on("offsetChange", handler);
      engine.updateOffset(150, 0);

      expect(engine.getCurrentOffset()).toBe(150);
      expect(handler).toHaveBeenCalledWith({ offset: 150 });
    });

    it("updateOffset updates activeIndex based on offset", () => {
      const engine = new SnapEngine();
      engine.registerItems([100, 100, 100]);

      engine.updateOffset(150, 0);
      expect(engine.getActiveIndex()).toBe(1);

      engine.updateOffset(250, 10);
      expect(engine.getActiveIndex()).toBe(2);
    });

    it("updateOffset marks state as not settled", () => {
      const engine = new SnapEngine();
      engine.registerItems([100, 100]);

      engine.updateOffset(50, 0);
      expect(engine.getState().isSettled).toBe(false);
    });
  });

  describe("release and snap", () => {
    it("release computes velocity and emits snap event", () => {
      const engine = new SnapEngine({
        velocityThreshold: 0.5,
        viewportSize: 100,
      });
      engine.registerItems([100, 100, 100]);
      const handler = vi.fn();
      engine.on("snap", handler);

      // Simulate scroll movement
      engine.updateOffset(0, 0);
      engine.updateOffset(50, 25);
      engine.updateOffset(100, 50);

      const result = engine.release(50);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(result.targetIndex).toBeGreaterThanOrEqual(0);
      expect(result.targetIndex).toBeLessThan(3);
    });

    it("release returns nearest snap when velocity is low", () => {
      const engine = new SnapEngine({
        velocityThreshold: 10, // Very high threshold
        viewportSize: 100,
      });
      engine.registerItems([100, 100, 100]);

      engine.updateOffset(0, 0);
      engine.updateOffset(80, 50);

      const result = engine.release(50);
      expect(result.targetIndex).toBe(1); // 80 is closer to 100 than to 0
    });
  });

  describe("snapTo", () => {
    it("snaps to specified index and emits snap event", () => {
      const engine = new SnapEngine({ viewportSize: 100 });
      engine.registerItems([100, 100, 100]);
      const handler = vi.fn();
      engine.on("snap", handler);

      const result = engine.snapTo(2);

      expect(result.targetIndex).toBe(2);
      expect(result.targetOffset).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("clamps index to valid range", () => {
      const engine = new SnapEngine({ viewportSize: 100 });
      engine.registerItems([100, 100, 100]);

      expect(engine.snapTo(-1).targetIndex).toBe(0);
      expect(engine.snapTo(99).targetIndex).toBe(2);
    });

    it("returns zero result for empty items", () => {
      const engine = new SnapEngine();
      const result = engine.snapTo(5);

      expect(result.targetIndex).toBe(0);
      expect(result.targetOffset).toBe(0);
    });
  });

  describe("settle", () => {
    it("marks state as settled and emits settle event", () => {
      const engine = new SnapEngine();
      engine.registerItems([100, 100]);
      const handler = vi.fn();
      engine.on("settle", handler);

      engine.updateOffset(50, 0);
      engine.settle(1);

      expect(engine.getState().isSettled).toBe(true);
      expect(engine.getActiveIndex()).toBe(1);
      expect(handler).toHaveBeenCalledWith({ index: 1 });
    });
  });

  describe("configuration", () => {
    it("accepts partial config in constructor", () => {
      const engine = new SnapEngine({ axis: "x", viewportSize: 500 });
      const config = engine.getConfig();

      expect(config.axis).toBe("x");
      expect(config.viewportSize).toBe(500);
      expect(config.velocityThreshold).toBe(0.5); // default
    });

    it("updateConfig merges partial config", () => {
      const engine = new SnapEngine();
      engine.updateConfig({ viewportSize: 800 });

      expect(engine.getConfig().viewportSize).toBe(800);
      expect(engine.getConfig().axis).toBe("y"); // unchanged
    });
  });

  describe("computeVelocity", () => {
    it("returns velocity after pushes and resets tracker", () => {
      const engine = new SnapEngine({
        velocityThreshold: 0.5,
        viewportSize: 100
      });
      engine.registerItems([100, 100, 100]);

      engine.updateOffset(0, 0);
      engine.updateOffset(50, 25);
      engine.updateOffset(100, 50);

      const velocity = engine.computeVelocity(50);
      expect(velocity).not.toBe(0);
      expect(engine.getState().velocity).toBe(velocity);

      // Tracker was reset — second call should yield 0
      const velocity2 = engine.computeVelocity(60);
      expect(velocity2).toBe(0);
    });

    it("throws after destroy", () => {
      const engine = new SnapEngine();
      engine.destroy();

      expect(() => engine.computeVelocity(0)).toThrow("destroyed");
    });
  });

  describe("applySnapResult", () => {
    it("emits snap event with provided result", () => {
      const engine = new SnapEngine();
      engine.registerItems([100, 100]);
      const handler = vi.fn();
      engine.on("snap", handler);

      const result = { targetIndex: 1, targetOffset: 100, direction: 1 as const, skippedCount: 1 };
      engine.applySnapResult(result);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(result);
    });

    it("throws after destroy", () => {
      const engine = new SnapEngine();
      engine.destroy();

      const result = { targetIndex: 0, targetOffset: 0, direction: 0 as const, skippedCount: 0 };
      expect(() => engine.applySnapResult(result)).toThrow("destroyed");
    });
  });

  describe("destroy", () => {
    it("removes all listeners and resets tracker", () => {
      const engine = new SnapEngine();
      const handler = vi.fn();
      engine.on("snap", handler);

      engine.destroy();

      // Should not receive events after destroy
      expect(() => engine.registerItems([100])).toThrow("destroyed");
    });

    it("throws on use after destroy", () => {
      const engine = new SnapEngine();
      engine.destroy();

      expect(() => engine.registerItems([100])).toThrow("destroyed");
      expect(() => engine.release(0)).toThrow("destroyed");
      expect(() => engine.snapTo(0)).toThrow("destroyed");
    });

    it("updateOffset does not throw after destroy (hot path)", () => {
      const engine = new SnapEngine();
      engine.destroy();
      // updateOffset doesn't check destroyed for performance on the hot path
      // but listeners are cleared so it's effectively a no-op
      engine.updateOffset(100, 0);
      expect(engine.getCurrentOffset()).toBe(100);
    });
  });

  describe("event subscription", () => {
    it("on() returns unsubscribe function", () => {
      const engine = new SnapEngine();
      const handler = vi.fn();

      const unsub = engine.on("offsetChange", handler);
      engine.registerItems([100]);
      engine.updateOffset(50, 0);
      expect(handler).toHaveBeenCalledTimes(1);

      unsub();
      engine.updateOffset(80, 10);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("off() removes handler", () => {
      const engine = new SnapEngine();
      const handler = vi.fn();

      engine.on("offsetChange", handler);
      engine.off("offsetChange", handler);
      engine.registerItems([100]);
      engine.updateOffset(50, 0);

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
