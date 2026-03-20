import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SnapController } from "~/dom/snap-controller";
import { SnapEngine } from "~/core/engine/snap-engine";
import { MiddlewarePipeline } from "~/middleware/pipeline";
import type { Middleware } from "~/middleware/types";
import type { SnapControllerEventMap } from "~/dom/types";

// --- Mock rAF ---
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

// --- Mock ResizeObserver ---
type ResizeCallback = (entries: ResizeObserverEntry[]) => void;
let resizeCallback: ResizeCallback;
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();

class MockResizeObserver {
  constructor(callback: ResizeCallback) {
    resizeCallback = callback;
  }
  observe = mockObserve;
  unobserve = mockUnobserve;
  disconnect = mockDisconnect;
}

// --- Mock element ---
interface MockElement {
  scrollTop: number;
  scrollLeft: number;
  scrollHeight: number;
  scrollWidth: number;
  clientHeight: number;
  clientWidth: number;
  style: Record<string, string>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  _listeners: Map<string, Set<EventListener>>;
  _trigger: (type: string, event?: Partial<Event | WheelEvent | TouchEvent>) => void;
}

function createMockElement(): MockElement {
  const listeners = new Map<string, Set<EventListener>>();

  return {
    scrollTop: 0,
    scrollLeft: 0,
    scrollHeight: 5000,
    scrollWidth: 5000,
    clientHeight: 500,
    clientWidth: 400,
    style: {},
    _listeners: listeners,
    addEventListener: vi.fn((type: string, handler: EventListener) => {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(handler);
    }),
    removeEventListener: vi.fn((type: string, handler: EventListener) => {
      listeners.get(type)?.delete(handler);
    }),
    _trigger(type: string, event: Partial<Event | WheelEvent> = {}) {
      const set = listeners.get(type);
      if (set) {
        for (const handler of set) {
          handler(event as Event);
        }
      }
    },
  };
}

function createResizeEntry(
  target: Element,
  height: number,
  width: number,
): ResizeObserverEntry {
  return {
    target,
    contentBoxSize: [{ blockSize: height, inlineSize: width }],
    contentRect: { height, width, x: 0, y: 0, top: 0, left: 0, bottom: height, right: width, toJSON: () => ({}) },
  } as unknown as ResizeObserverEntry;
}

describe("SnapController", () => {
  let element: MockElement;
  let engine: SnapEngine;

  beforeEach(() => {
    setupRaf();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.stubGlobal("performance", { now: vi.fn(() => 1000) });
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    mockObserve.mockClear();
    mockUnobserve.mockClear();
    mockDisconnect.mockClear();

    element = createMockElement();
    engine = new SnapEngine({ axis: "y", viewportSize: 500 });
    engine.registerItems([500, 500, 500, 500, 500]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function attachController(
    config?: Partial<Parameters<typeof SnapController.prototype.attach>[0]> & { pipeline?: MiddlewarePipeline },
  ): SnapController {
    const controller = new SnapController(engine, {
      axis: "y",
      wheelIdleTimeout: 120,
      overscrollBehavior: "contain",
      animationConfig: {
        type: "timing",
        duration: 300,
        easing: "linear",
      },
      ...config,
    });
    controller.attach(element as unknown as HTMLElement);
    return controller;
  }

  describe("touch snap flow", () => {
    it("touchstart → scroll moves → touchend → animate → complete → settle", () => {
      const controller = attachController();
      const snapComplete = vi.fn();
      controller.on("snapComplete", snapComplete);

      // Touch start
      element._trigger("touchstart");

      // Simulate scroll moves
      element.scrollTop = 200;
      element._trigger("scroll");
      element.scrollTop = 400;
      element._trigger("scroll");

      // Touch end — triggers release → animate
      element._trigger("touchend");

      // Animation should be running
      expect(controller.isAnimating()).toBe(true);

      // Flush animation frames to completion
      flushFrame(0); // start frame
      flushFrame(300); // end frame (duration=300)

      expect(controller.isAnimating()).toBe(false);
      expect(snapComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe("wheel snap flow", () => {
    it("wheel events → idle → release → animate → settle", () => {
      const controller = attachController();
      const snapComplete = vi.fn();
      controller.on("snapComplete", snapComplete);

      // Wheel events
      element._trigger("wheel", { deltaY: 100, deltaX: 0, deltaMode: 0 });
      element.scrollTop = 100;
      element._trigger("wheel", { deltaY: 100, deltaX: 0, deltaMode: 0 });
      element.scrollTop = 200;

      // Idle timer fires
      vi.advanceTimersByTime(120);

      // Should be animating now
      expect(controller.isAnimating()).toBe(true);

      flushFrame(0);
      flushFrame(300);

      expect(controller.isAnimating()).toBe(false);
      expect(snapComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe("interruption", () => {
    it("touch during animation cancels and resumes tracking", () => {
      const controller = attachController();

      // Start a touch → release → animation
      element._trigger("touchstart");
      element.scrollTop = 250;
      element._trigger("scroll");
      element._trigger("touchend");

      expect(controller.isAnimating()).toBe(true);

      // Start new touch while animating
      element._trigger("touchstart");

      // Animation should be cancelled
      expect(controller.isAnimating()).toBe(false);
      expect(controller.isInteracting()).toBe(true);
    });
  });

  describe("programmatic snapTo", () => {
    it("snapTo(2) animates to target index", () => {
      const controller = attachController();
      const snapStart = vi.fn();
      const snapComplete = vi.fn();
      controller.on("snapStart", snapStart);
      controller.on("snapComplete", snapComplete);

      controller.snapTo(2);

      expect(snapStart).toHaveBeenCalledTimes(1);
      expect(snapStart.mock.calls[0]![0]).toMatchObject({
        targetIndex: 2,
      });
      expect(controller.isAnimating()).toBe(true);

      flushFrame(0);
      flushFrame(300);

      expect(snapComplete).toHaveBeenCalledWith({ index: 2 });
      expect(controller.isAnimating()).toBe(false);
    });

    it("snapTo current index settles immediately", () => {
      const controller = attachController();
      const snapComplete = vi.fn();
      controller.on("snapComplete", snapComplete);

      // Already at index 0, offset 0
      controller.snapTo(0);

      expect(snapComplete).toHaveBeenCalledWith({ index: 0 });
      expect(controller.isAnimating()).toBe(false);
    });

    it("snapTo cancels current animation", () => {
      const controller = attachController();

      controller.snapTo(2);
      expect(controller.isAnimating()).toBe(true);

      // snapTo another index while animating
      controller.snapTo(3);
      // Should start new animation
      expect(controller.isAnimating()).toBe(true);
    });
  });

  describe("no-op snap", () => {
    it("when release target equals current offset, settles immediately", () => {
      const controller = attachController();
      const snapComplete = vi.fn();
      controller.on("snapComplete", snapComplete);

      // Touch at origin with no movement
      element._trigger("touchstart");
      element._trigger("touchend");

      // Should settle immediately (target = current = 0)
      expect(snapComplete).toHaveBeenCalledTimes(1);
      expect(controller.isAnimating()).toBe(false);
    });
  });

  describe("resize handling", () => {
    it("viewport resize updates engine config", () => {
      const controller = attachController();
      const updateSpy = vi.spyOn(engine, "updateConfig");

      // Simulate resize via ResizeObserver callback
      resizeCallback([
        createResizeEntry(element as unknown as Element, 600, 400),
      ]);

      expect(updateSpy).toHaveBeenCalledWith({ viewportSize: 600 });
    });

    it("item resize updates engine item size", () => {
      const controller = attachController();
      const updateSpy = vi.spyOn(engine, "updateItemSize");

      const itemEl = {} as Element;
      controller.observeItem(itemEl, 1);

      resizeCallback([createResizeEntry(itemEl, 300, 400)]);

      expect(updateSpy).toHaveBeenCalledWith(1, 300);
    });
  });

  describe("events", () => {
    it("emits interactionStart on touch", () => {
      const controller = attachController();
      const handler = vi.fn();
      controller.on("interactionStart", handler);

      element._trigger("touchstart");

      expect(handler).toHaveBeenCalledWith({ source: "touch" });
    });

    it("emits interactionEnd after touch", () => {
      const controller = attachController();
      const handler = vi.fn();
      controller.on("interactionEnd", handler);

      element._trigger("touchstart");
      element._trigger("touchend");

      expect(handler).toHaveBeenCalledWith({ source: "touch" });
    });

    it("emits snapStart with target info", () => {
      const controller = attachController();
      const handler = vi.fn();
      controller.on("snapStart", handler);

      element._trigger("touchstart");
      element.scrollTop = 300;
      element._trigger("scroll");
      element._trigger("touchend");

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0]![0]).toHaveProperty("targetIndex");
      expect(handler.mock.calls[0]![0]).toHaveProperty("targetOffset");
    });

    it("emits offsetChange during interaction", () => {
      const controller = attachController();
      const handler = vi.fn();
      controller.on("offsetChange", handler);

      element._trigger("touchstart");
      element.scrollTop = 100;
      element._trigger("scroll");

      expect(handler).toHaveBeenCalledWith({ offset: 100 });
    });

    it("off removes handler", () => {
      const controller = attachController();
      const handler = vi.fn();
      controller.on("interactionStart", handler);
      controller.off("interactionStart", handler);

      element._trigger("touchstart");

      expect(handler).not.toHaveBeenCalled();
    });

    it("on returns unsubscribe function", () => {
      const controller = attachController();
      const handler = vi.fn();
      const unsub = controller.on("interactionStart", handler);

      unsub();
      element._trigger("touchstart");

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("state accessors", () => {
    it("getActiveIndex returns engine active index", () => {
      const controller = attachController();
      expect(controller.getActiveIndex()).toBe(0);
    });

    it("getCurrentOffset returns scroll position", () => {
      const controller = attachController();
      element.scrollTop = 250;
      expect(controller.getCurrentOffset()).toBe(250);
    });

    it("isAnimating reflects driver state", () => {
      const controller = attachController();
      expect(controller.isAnimating()).toBe(false);

      controller.snapTo(2);
      expect(controller.isAnimating()).toBe(true);
    });

    it("isInteracting reflects input observer state", () => {
      const controller = attachController();
      expect(controller.isInteracting()).toBe(false);

      element._trigger("touchstart");
      expect(controller.isInteracting()).toBe(true);
    });

    it("getEngine returns the injected engine", () => {
      const controller = attachController();
      expect(controller.getEngine()).toBe(engine);
    });
  });

  describe("registerItems pass-through", () => {
    it("delegates to engine.registerItems", () => {
      const controller = attachController();
      const spy = vi.spyOn(engine, "registerItems");

      controller.registerItems([100, 200, 300]);

      expect(spy).toHaveBeenCalledWith([100, 200, 300]);
    });
  });

  describe("unobserveItem", () => {
    it("delegates to resizeManager.unobserveItem", () => {
      const controller = attachController();
      const itemEl = {} as Element;

      controller.observeItem(itemEl, 1);
      expect(mockObserve).toHaveBeenCalled();

      controller.unobserveItem(itemEl);
      expect(mockUnobserve).toHaveBeenCalledWith(itemEl);
    });

    it("is safe to call before attach", () => {
      const controller = new SnapController(engine, { axis: "y" });
      expect(() => controller.unobserveItem({} as Element)).not.toThrow();
    });
  });

  describe("lifecycle", () => {
    it("attach sets up everything", () => {
      const controller = attachController();

      // Styles applied
      expect(element.style.overscrollBehavior).toBe("contain");
      expect(element.style.overflowY).toBe("auto");

      // Event listeners attached
      expect(element.addEventListener).toHaveBeenCalled();

      // ResizeObserver observing
      expect(mockObserve).toHaveBeenCalled();
    });

    it("detach cleans up everything", () => {
      const controller = attachController();
      controller.detach();

      // Styles removed
      expect(element.style.overscrollBehavior).toBe("");
      expect(element.style.overflowY).toBe("");

      // Event listeners removed
      expect(element.removeEventListener).toHaveBeenCalled();

      // ResizeObserver disconnected
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it("destroy prevents further operations", () => {
      const controller = attachController();
      controller.destroy();

      expect(controller.isAnimating()).toBe(false);
      expect(controller.isInteracting()).toBe(false);
    });

    it("detach cancels running animation", () => {
      const controller = attachController();
      controller.snapTo(2);
      expect(controller.isAnimating()).toBe(true);

      controller.detach();
      expect(controller.isAnimating()).toBe(false);
    });
  });

  describe("static create", () => {
    it("creates a controller with a new engine and attaches to element", () => {
      const controller = SnapController.create(
        element as unknown as HTMLElement,
        {
          axis: "y",
          items: [500, 500, 500],
          animationConfig: { type: "timing", duration: 300, easing: "linear" },
        },
      );

      expect(controller.getEngine()).toBeInstanceOf(SnapEngine);
      expect(element.style.overscrollBehavior).toBe("contain");

      controller.destroy();
    });
  });

  describe("middleware integration", () => {
    it("no pipeline: existing behavior unchanged", () => {
      const controller = attachController();
      const snapComplete = vi.fn();
      controller.on("snapComplete", snapComplete);

      element._trigger("touchstart");
      element._trigger("touchend");

      expect(snapComplete).toHaveBeenCalledTimes(1);
      controller.destroy();
    });

    it("observation middleware (onScroll): receives scroll offsets", () => {
      const scrollSpy = vi.fn();
      const mw: Middleware = { name: "scroll-logger", onScroll: scrollSpy };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw] });
      const controller = attachController({ pipeline });

      element._trigger("touchstart");
      element.scrollTop = 200;
      element._trigger("scroll");

      expect(scrollSpy).toHaveBeenCalledWith(200);
      controller.destroy();
    });

    it("onVelocity middleware: velocity modified before resolution", () => {
      const mw: Middleware = {
        name: "zero-velocity",
        onVelocity: () => 0 // Force zero velocity → nearest snap
      };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw] });
      const controller = attachController({ pipeline });
      const snapStart = vi.fn();
      controller.on("snapStart", snapStart);

      // Simulate a fast scroll that would normally skip indices
      element._trigger("touchstart");
      element.scrollTop = 100;
      element._trigger("scroll");
      element.scrollTop = 200;
      element._trigger("scroll");
      element._trigger("touchend");

      // With velocity zeroed, should snap to nearest (not skip far)
      expect(snapStart).toHaveBeenCalledTimes(1);
      controller.destroy();
    });

    it("beforeSnap middleware: params modified", () => {
      const mw: Middleware = {
        name: "force-index",
        beforeSnap: (input) => ({
          ...input.params,
          currentIndex: 0,
          currentOffset: 0,
          velocity: 0
        })
      };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw] });
      const controller = attachController({ pipeline });
      const snapStart = vi.fn();
      controller.on("snapStart", snapStart);

      element._trigger("touchstart");
      element.scrollTop = 300;
      element._trigger("scroll");
      element._trigger("touchend");

      expect(snapStart).toHaveBeenCalledTimes(1);
      // Snap result should reflect the forced params
      expect(snapStart.mock.calls[0]![0]).toHaveProperty("targetIndex");
      controller.destroy();
    });

    it("afterSnap middleware: result remapped", () => {
      const mw: Middleware = {
        name: "remap-target",
        afterSnap: (input) => ({
          ...input.result,
          targetIndex: 2,
          targetOffset: 1000
        })
      };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw] });
      const controller = attachController({ pipeline });
      const snapStart = vi.fn();
      controller.on("snapStart", snapStart);

      element._trigger("touchstart");
      element.scrollTop = 100;
      element._trigger("scroll");
      element._trigger("touchend");

      expect(snapStart).toHaveBeenCalledWith({
        targetIndex: 2,
        targetOffset: 1000
      });
      controller.destroy();
    });

    it("onSettle: called when snap completes via animation", () => {
      const settleSpy = vi.fn();
      const mw: Middleware = { name: "settle-logger", onSettle: settleSpy };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw] });
      const controller = attachController({ pipeline });

      controller.snapTo(2);

      // Complete animation
      flushFrame(0);
      flushFrame(300);

      expect(settleSpy).toHaveBeenCalledWith(2);
      controller.destroy();
    });

    it("onSettle: called on immediate settle", () => {
      const settleSpy = vi.fn();
      const mw: Middleware = { name: "settle-logger", onSettle: settleSpy };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw] });
      const controller = attachController({ pipeline });

      // snapTo current index — settles immediately
      controller.snapTo(0);

      expect(settleSpy).toHaveBeenCalledWith(0);
      controller.destroy();
    });

    it("snapTo + afterSnap: programmatic snap is post-processed", () => {
      const mw: Middleware = {
        name: "remap-programmatic",
        afterSnap: (input) => ({
          ...input.result,
          targetIndex: 3,
          targetOffset: 1500
        })
      };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw] });
      const controller = attachController({ pipeline });
      const snapStart = vi.fn();
      controller.on("snapStart", snapStart);

      controller.snapTo(1);

      expect(snapStart).toHaveBeenCalledWith({
        targetIndex: 3,
        targetOffset: 1500
      });
      controller.destroy();
    });

    it("onInit called on attach, onDestroy called on destroy", () => {
      const initSpy = vi.fn();
      const destroySpy = vi.fn();
      const mw: Middleware = {
        name: "lifecycle",
        onInit: initSpy,
        onDestroy: destroySpy
      };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw] });
      const controller = attachController({ pipeline });

      expect(initSpy).toHaveBeenCalledTimes(1);
      expect(initSpy.mock.calls[0]![0]).toHaveProperty("items");
      expect(initSpy.mock.calls[0]![0]).toHaveProperty("currentOffset");

      controller.destroy();

      expect(destroySpy).toHaveBeenCalledTimes(1);
    });

    it("full pipeline: all hooks chained", () => {
      const scrollSpy = vi.fn();
      const settleSpy = vi.fn();

      const mw1: Middleware = {
        name: "velocity-dampener",
        onVelocity: (v) => v * 0.5,
        onScroll: scrollSpy
      };
      const mw2: Middleware = {
        name: "settle-logger",
        onSettle: settleSpy,
        afterSnap: (input) => input.result // passthrough
      };
      const pipeline = new MiddlewarePipeline({ middlewares: [mw1, mw2] });
      const controller = attachController({ pipeline });
      const snapComplete = vi.fn();
      controller.on("snapComplete", snapComplete);

      // Touch flow
      element._trigger("touchstart");
      element.scrollTop = 200;
      element._trigger("scroll");
      element._trigger("touchend");

      // Scroll hook should have been called during the scroll
      expect(scrollSpy).toHaveBeenCalled();

      // Complete animation
      flushFrame(0);
      flushFrame(300);

      expect(snapComplete).toHaveBeenCalledTimes(1);
      expect(settleSpy).toHaveBeenCalledTimes(1);

      controller.destroy();
    });
  });
});
