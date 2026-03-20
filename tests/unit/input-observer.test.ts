import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InputObserver } from "~/dom/input-observer";
import type { InputObserverConfig, InteractionEvent } from "~/dom/types";

// Track registered event listeners
interface ListenerRecord {
  type: string;
  handler: EventListener;
  options?: AddEventListenerOptions | boolean;
}

function createMockElement(): HTMLElement & {
  _listeners: ListenerRecord[];
  _trigger: (type: string, event?: Partial<Event | WheelEvent>) => void;
} {
  const listeners: ListenerRecord[] = [];

  const el = {
    scrollTop: 0,
    scrollLeft: 0,
    clientHeight: 500,
    clientWidth: 400,
    _listeners: listeners,
    addEventListener: vi.fn(
      (
        type: string,
        handler: EventListener,
        options?: AddEventListenerOptions | boolean,
      ) => {
        listeners.push({ type, handler, options });
      },
    ),
    removeEventListener: vi.fn(
      (type: string, handler: EventListener) => {
        const idx = listeners.findIndex(
          (l) => l.type === type && l.handler === handler,
        );
        if (idx !== -1) listeners.splice(idx, 1);
      },
    ),
    _trigger(type: string, event: Partial<Event | WheelEvent> = {}) {
      const matching = listeners.filter((l) => l.type === type);
      for (const l of matching) {
        l.handler(event as Event);
      }
    },
  };

  return el as unknown as HTMLElement & {
    _listeners: ListenerRecord[];
    _trigger: (type: string, event?: Partial<Event | WheelEvent>) => void;
  };
}

describe("InputObserver", () => {
  let element: ReturnType<typeof createMockElement>;
  let onInteraction: ReturnType<typeof vi.fn>;
  const defaultConfig: InputObserverConfig = {
    axis: "y",
    wheelIdleTimeout: 120,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("performance", { now: vi.fn(() => 1000) });
    element = createMockElement();
    onInteraction = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("touch flow", () => {
    it("emits start on touchstart", () => {
      const observer = new InputObserver(element, defaultConfig, {
        onInteraction,
      });
      observer.attach();

      element._trigger("touchstart");

      expect(onInteraction).toHaveBeenCalledTimes(1);
      const event = onInteraction.mock.calls[0]![0] as InteractionEvent;
      expect(event.source).toBe("touch");
      expect(event.phase).toBe("start");
    });

    it("emits move on scroll while touching", () => {
      const observer = new InputObserver(element, defaultConfig, {
        onInteraction,
      });
      observer.attach();

      element._trigger("touchstart");
      element.scrollTop = 100;
      element._trigger("scroll");

      expect(onInteraction).toHaveBeenCalledTimes(2);
      const moveEvent = onInteraction.mock.calls[1]![0] as InteractionEvent;
      expect(moveEvent.source).toBe("touch");
      expect(moveEvent.phase).toBe("move");
      expect(moveEvent.offset).toBe(100);
      expect(moveEvent.delta).toBe(100);
    });

    it("emits end on touchend", () => {
      const observer = new InputObserver(element, defaultConfig, {
        onInteraction,
      });
      observer.attach();

      element._trigger("touchstart");
      element._trigger("touchend");

      expect(onInteraction).toHaveBeenCalledTimes(2);
      const endEvent = onInteraction.mock.calls[1]![0] as InteractionEvent;
      expect(endEvent.source).toBe("touch");
      expect(endEvent.phase).toBe("end");
    });

    it("treats touchcancel as end", () => {
      const observer = new InputObserver(element, defaultConfig, {
        onInteraction,
      });
      observer.attach();

      element._trigger("touchstart");
      element._trigger("touchcancel");

      const endEvent = onInteraction.mock.calls[1]![0] as InteractionEvent;
      expect(endEvent.source).toBe("touch");
      expect(endEvent.phase).toBe("end");
    });

    it("tracks delta correctly across multiple scroll moves", () => {
      // Capture deltas at call time since the event object is pre-allocated and reused
      const deltas: number[] = [];
      const observer = new InputObserver(element, defaultConfig, {
        onInteraction: (e) => {
          if (e.phase === "move") deltas.push(e.delta);
        },
      });
      observer.attach();

      element._trigger("touchstart");

      element.scrollTop = 50;
      element._trigger("scroll");

      element.scrollTop = 120;
      element._trigger("scroll");

      // First move: delta = 50 - 0 = 50
      expect(deltas[0]).toBe(50);
      // Second move: delta = 120 - 50 = 70
      expect(deltas[1]).toBe(70);
    });
  });

  describe("wheel flow", () => {
    it("emits start on first wheel event", () => {
      // Capture phases at call time since event object is pre-allocated
      const phases: string[] = [];
      const observer = new InputObserver(element, defaultConfig, {
        onInteraction: (e) => phases.push(e.phase),
      });
      observer.attach();

      element._trigger("wheel", {
        deltaY: 100,
        deltaX: 0,
        deltaMode: 0,
      });

      expect(phases).toEqual(["start", "move"]);
    });

    it("emits move on subsequent wheel events", () => {
      const observer = new InputObserver(element, defaultConfig, {
        onInteraction,
      });
      observer.attach();

      element._trigger("wheel", { deltaY: 50, deltaX: 0, deltaMode: 0 });
      element._trigger("wheel", { deltaY: 30, deltaX: 0, deltaMode: 0 });

      // First wheel: start + move, second wheel: move only
      expect(onInteraction).toHaveBeenCalledTimes(3);
      const moveEvent = onInteraction.mock.calls[2]![0] as InteractionEvent;
      expect(moveEvent.source).toBe("wheel");
      expect(moveEvent.phase).toBe("move");
    });

    it("emits end after idle timeout", () => {
      const observer = new InputObserver(element, defaultConfig, {
        onInteraction,
      });
      observer.attach();

      element._trigger("wheel", { deltaY: 100, deltaX: 0, deltaMode: 0 });

      vi.advanceTimersByTime(120);

      const lastCall =
        onInteraction.mock.calls[onInteraction.mock.calls.length - 1]![0] as InteractionEvent;
      expect(lastCall.source).toBe("wheel");
      expect(lastCall.phase).toBe("end");
    });

    it("resets idle timer on subsequent wheel events", () => {
      const observer = new InputObserver(element, defaultConfig, {
        onInteraction,
      });
      observer.attach();

      element._trigger("wheel", { deltaY: 50, deltaX: 0, deltaMode: 0 });
      vi.advanceTimersByTime(100); // not yet idle

      element._trigger("wheel", { deltaY: 30, deltaX: 0, deltaMode: 0 });
      vi.advanceTimersByTime(100); // still not idle after reset

      // Should not have ended yet
      const calls = onInteraction.mock.calls.map(
        (c) => (c[0] as InteractionEvent).phase,
      );
      expect(calls).not.toContain("end");

      vi.advanceTimersByTime(20); // now 120ms since last wheel

      const lastCall =
        onInteraction.mock.calls[onInteraction.mock.calls.length - 1]![0] as InteractionEvent;
      expect(lastCall.phase).toBe("end");
    });

    it("configurable idle timeout", () => {
      const observer = new InputObserver(
        element,
        { axis: "y", wheelIdleTimeout: 200 },
        { onInteraction },
      );
      observer.attach();

      element._trigger("wheel", { deltaY: 100, deltaX: 0, deltaMode: 0 });

      vi.advanceTimersByTime(120);
      // Should NOT have ended yet at 120ms with 200ms timeout
      const callsAt120 = onInteraction.mock.calls.map(
        (c) => (c[0] as InteractionEvent).phase,
      );
      expect(callsAt120).not.toContain("end");

      vi.advanceTimersByTime(80);
      const lastCall =
        onInteraction.mock.calls[onInteraction.mock.calls.length - 1]![0] as InteractionEvent;
      expect(lastCall.phase).toBe("end");
    });

    it("normalizes DOM_DELTA_LINE by multiplying by 16", () => {
      const observer = new InputObserver(element, defaultConfig, {
        onInteraction,
      });
      observer.attach();

      element._trigger("wheel", {
        deltaY: 3,
        deltaX: 0,
        deltaMode: 1, // DOM_DELTA_LINE
      });

      // Second call is the move event
      const moveEvent = onInteraction.mock.calls[1]![0] as InteractionEvent;
      expect(moveEvent.delta).toBe(48); // 3 * 16
    });

    it("normalizes DOM_DELTA_PAGE by multiplying by viewport size", () => {
      const observer = new InputObserver(element, defaultConfig, {
        onInteraction,
      });
      observer.attach();

      element._trigger("wheel", {
        deltaY: 1,
        deltaX: 0,
        deltaMode: 2, // DOM_DELTA_PAGE
      });

      const moveEvent = onInteraction.mock.calls[1]![0] as InteractionEvent;
      expect(moveEvent.delta).toBe(500); // 1 * clientHeight
    });
  });

  describe("scroll events while not interacting", () => {
    it("drops scroll events when no interaction is active", () => {
      const observer = new InputObserver(element, defaultConfig, {
        onInteraction,
      });
      observer.attach();

      element.scrollTop = 200;
      element._trigger("scroll");

      expect(onInteraction).not.toHaveBeenCalled();
    });
  });

  describe("pre-allocated event reuse", () => {
    it("passes the same event object reference", () => {
      const events: InteractionEvent[] = [];
      const observer = new InputObserver(element, defaultConfig, {
        onInteraction: (e) => events.push(e),
      });
      observer.attach();

      element._trigger("touchstart");
      element.scrollTop = 50;
      element._trigger("scroll");

      // Both calls receive the same reference (pre-allocated)
      expect(events[0]).toBe(events[1]);
    });
  });

  describe("passive listener options", () => {
    it("uses passive: true for touch and wheel events", () => {
      const observer = new InputObserver(element, defaultConfig, {
        onInteraction,
      });
      observer.attach();

      const touchStartCall = (
        element.addEventListener as ReturnType<typeof vi.fn>
      ).mock.calls.find(
        (c: [string, EventListener, AddEventListenerOptions?]) =>
          c[0] === "touchstart",
      );
      expect(touchStartCall?.[2]).toEqual({ passive: true });

      const wheelCall = (
        element.addEventListener as ReturnType<typeof vi.fn>
      ).mock.calls.find(
        (c: [string, EventListener, AddEventListenerOptions?]) =>
          c[0] === "wheel",
      );
      expect(wheelCall?.[2]).toEqual({ passive: true });
    });

    it("scroll listener has no options", () => {
      const observer = new InputObserver(element, defaultConfig, {
        onInteraction,
      });
      observer.attach();

      const scrollCall = (
        element.addEventListener as ReturnType<typeof vi.fn>
      ).mock.calls.find(
        (c: [string, EventListener, AddEventListenerOptions?]) =>
          c[0] === "scroll",
      );
      expect(scrollCall?.[2]).toBeUndefined();
    });
  });

  describe("detach", () => {
    it("removes all event listeners", () => {
      const observer = new InputObserver(element, defaultConfig, {
        onInteraction,
      });
      observer.attach();
      observer.detach();

      expect(element._listeners).toHaveLength(0);
    });

    it("clears wheel idle timer", () => {
      const observer = new InputObserver(element, defaultConfig, {
        onInteraction,
      });
      observer.attach();

      element._trigger("wheel", { deltaY: 100, deltaX: 0, deltaMode: 0 });
      observer.detach();

      vi.advanceTimersByTime(200);

      // No end event should fire after detach
      const phases = onInteraction.mock.calls.map(
        (c) => (c[0] as InteractionEvent).phase,
      );
      expect(phases).not.toContain("end");
    });

    it("resets interaction state", () => {
      const observer = new InputObserver(element, defaultConfig, {
        onInteraction,
      });
      observer.attach();

      element._trigger("touchstart");
      expect(observer.isInteracting()).toBe(true);

      observer.detach();
      expect(observer.isInteracting()).toBe(false);
      expect(observer.getInteractionSource()).toBeNull();
    });
  });

  describe("updateElement", () => {
    it("detaches from old element and attaches to new", () => {
      const observer = new InputObserver(element, defaultConfig, {
        onInteraction,
      });
      observer.attach();

      const newElement = createMockElement();
      observer.updateElement(newElement);

      // Old element should have no listeners
      expect(element._listeners).toHaveLength(0);
      // New element should have listeners
      expect(newElement._listeners.length).toBeGreaterThan(0);
    });
  });

  describe("isInteracting / getInteractionSource", () => {
    it("returns correct state during touch", () => {
      const observer = new InputObserver(element, defaultConfig, {
        onInteraction,
      });
      observer.attach();

      expect(observer.isInteracting()).toBe(false);
      expect(observer.getInteractionSource()).toBeNull();

      element._trigger("touchstart");
      expect(observer.isInteracting()).toBe(true);
      expect(observer.getInteractionSource()).toBe("touch");

      element._trigger("touchend");
      expect(observer.isInteracting()).toBe(false);
      expect(observer.getInteractionSource()).toBeNull();
    });

    it("returns correct state during wheel", () => {
      const observer = new InputObserver(element, defaultConfig, {
        onInteraction,
      });
      observer.attach();

      element._trigger("wheel", { deltaY: 50, deltaX: 0, deltaMode: 0 });
      expect(observer.isInteracting()).toBe(true);
      expect(observer.getInteractionSource()).toBe("wheel");

      vi.advanceTimersByTime(120);
      expect(observer.isInteracting()).toBe(false);
    });
  });

  describe("x-axis", () => {
    it("reads scrollLeft and deltaX", () => {
      const observer = new InputObserver(
        element,
        { axis: "x", wheelIdleTimeout: 120 },
        { onInteraction },
      );
      observer.attach();

      element._trigger("touchstart");
      element.scrollLeft = 75;
      element._trigger("scroll");

      const moveEvent = onInteraction.mock.calls[1]![0] as InteractionEvent;
      expect(moveEvent.offset).toBe(75);
    });

    it("uses deltaX for wheel events", () => {
      const observer = new InputObserver(
        element,
        { axis: "x", wheelIdleTimeout: 120 },
        { onInteraction },
      );
      observer.attach();

      element._trigger("wheel", {
        deltaY: 0,
        deltaX: 40,
        deltaMode: 0,
      });

      const moveEvent = onInteraction.mock.calls[1]![0] as InteractionEvent;
      expect(moveEvent.delta).toBe(40);
    });
  });

  describe("destroy", () => {
    it("detaches and nullifies element", () => {
      const observer = new InputObserver(element, defaultConfig, {
        onInteraction,
      });
      observer.attach();
      observer.destroy();

      expect(element._listeners).toHaveLength(0);
      expect(observer.isInteracting()).toBe(false);
    });
  });
});
