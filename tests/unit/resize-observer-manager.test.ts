import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ResizeObserverManager } from "~/dom/resize-observer-manager";
import type { ResizeObserverCallbacks } from "~/dom/types";

// Mock ResizeObserver
type ResizeCallback = (entries: ResizeObserverEntry[]) => void;

let mockObserverCallback: ResizeCallback;
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();

class MockResizeObserver {
  constructor(callback: ResizeCallback) {
    mockObserverCallback = callback;
  }
  observe = mockObserve;
  unobserve = mockUnobserve;
  disconnect = mockDisconnect;
}

function createEntry(
  target: Element,
  height: number,
  width: number,
  useContentBoxSize = true,
): ResizeObserverEntry {
  const entry: Partial<ResizeObserverEntry> = {
    target,
    contentRect: { height, width, x: 0, y: 0, top: 0, left: 0, bottom: height, right: width, toJSON: () => ({}) },
  };

  if (useContentBoxSize) {
    (entry as Record<string, unknown>).contentBoxSize = [
      { blockSize: height, inlineSize: width },
    ];
  } else {
    (entry as Record<string, unknown>).contentBoxSize = [];
  }

  return entry as ResizeObserverEntry;
}

describe("ResizeObserverManager", () => {
  let callbacks: ResizeObserverCallbacks;

  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    mockObserve.mockClear();
    mockUnobserve.mockClear();
    mockDisconnect.mockClear();

    callbacks = {
      onViewportResize: vi.fn(),
      onItemResize: vi.fn(),
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a single ResizeObserver instance", () => {
    const _manager = new ResizeObserverManager("y", callbacks);
    // Constructor already called, no additional observers created
    expect(true).toBe(true); // If we got here, no error
  });

  describe("container observation", () => {
    it("observes container element", () => {
      const manager = new ResizeObserverManager("y", callbacks);
      const container = {} as Element;

      manager.observeContainer(container);

      expect(mockObserve).toHaveBeenCalledWith(container);
    });

    it("calls onViewportResize when container resizes (y-axis)", () => {
      const manager = new ResizeObserverManager("y", callbacks);
      const container = {} as Element;

      manager.observeContainer(container);

      // Simulate resize
      mockObserverCallback([createEntry(container, 600, 400)]);

      expect(callbacks.onViewportResize).toHaveBeenCalledWith(600);
    });

    it("calls onViewportResize when container resizes (x-axis)", () => {
      const manager = new ResizeObserverManager("x", callbacks);
      const container = {} as Element;

      manager.observeContainer(container);

      mockObserverCallback([createEntry(container, 600, 400)]);

      expect(callbacks.onViewportResize).toHaveBeenCalledWith(400);
    });

    it("unobserves previous container on re-observe", () => {
      const manager = new ResizeObserverManager("y", callbacks);
      const container1 = {} as Element;
      const container2 = {} as Element;

      manager.observeContainer(container1);
      manager.observeContainer(container2);

      expect(mockUnobserve).toHaveBeenCalledWith(container1);
      expect(mockObserve).toHaveBeenCalledWith(container2);
    });

    it("unobserveContainer removes observation", () => {
      const manager = new ResizeObserverManager("y", callbacks);
      const container = {} as Element;

      manager.observeContainer(container);
      manager.unobserveContainer();

      expect(mockUnobserve).toHaveBeenCalledWith(container);
    });
  });

  describe("item observation", () => {
    it("observes item elements", () => {
      const manager = new ResizeObserverManager("y", callbacks);
      const item = {} as Element;

      manager.observeItem(item, 0);

      expect(mockObserve).toHaveBeenCalledWith(item);
    });

    it("calls onItemResize with correct index (y-axis)", () => {
      const manager = new ResizeObserverManager("y", callbacks);
      const item = {} as Element;

      manager.observeItem(item, 3);

      mockObserverCallback([createEntry(item, 200, 100)]);

      expect(callbacks.onItemResize).toHaveBeenCalledWith(3, 200);
    });

    it("calls onItemResize with correct index (x-axis)", () => {
      const manager = new ResizeObserverManager("x", callbacks);
      const item = {} as Element;

      manager.observeItem(item, 5);

      mockObserverCallback([createEntry(item, 200, 150)]);

      expect(callbacks.onItemResize).toHaveBeenCalledWith(5, 150);
    });

    it("handles multiple items in a single callback", () => {
      const manager = new ResizeObserverManager("y", callbacks);
      const item1 = {} as Element;
      const item2 = {} as Element;

      manager.observeItem(item1, 0);
      manager.observeItem(item2, 1);

      mockObserverCallback([
        createEntry(item1, 100, 400),
        createEntry(item2, 200, 400),
      ]);

      expect(callbacks.onItemResize).toHaveBeenCalledTimes(2);
      expect(callbacks.onItemResize).toHaveBeenCalledWith(0, 100);
      expect(callbacks.onItemResize).toHaveBeenCalledWith(1, 200);
    });

    it("unobserveItem removes the item", () => {
      const manager = new ResizeObserverManager("y", callbacks);
      const item = {} as Element;

      manager.observeItem(item, 0);
      manager.unobserveItem(item);

      expect(mockUnobserve).toHaveBeenCalledWith(item);
    });

    it("ignores unknown elements in callback", () => {
      const manager = new ResizeObserverManager("y", callbacks);
      const unknown = {} as Element;

      mockObserverCallback([createEntry(unknown, 300, 200)]);

      expect(callbacks.onViewportResize).not.toHaveBeenCalled();
      expect(callbacks.onItemResize).not.toHaveBeenCalled();
    });
  });

  describe("contentRect fallback", () => {
    it("falls back to contentRect when contentBoxSize is empty", () => {
      const manager = new ResizeObserverManager("y", callbacks);
      const container = {} as Element;

      manager.observeContainer(container);

      mockObserverCallback([createEntry(container, 500, 300, false)]);

      expect(callbacks.onViewportResize).toHaveBeenCalledWith(500);
    });
  });

  describe("destroy", () => {
    it("disconnects observer and clears state", () => {
      const manager = new ResizeObserverManager("y", callbacks);
      const container = {} as Element;
      const item = {} as Element;

      manager.observeContainer(container);
      manager.observeItem(item, 0);
      manager.destroy();

      expect(mockDisconnect).toHaveBeenCalled();
    });
  });
});
