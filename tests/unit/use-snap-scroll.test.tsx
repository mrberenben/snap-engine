// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// --- Mock state ---
type SnapCompleteHandler = (payload: { index: number }) => void;

let capturedSnapCompleteHandler: SnapCompleteHandler | null = null;
const mockAttach = vi.fn();
const mockDetach = vi.fn();
const mockControllerDestroy = vi.fn();
const mockEngineDestroy = vi.fn();
const mockSnapTo = vi.fn();
const mockControllerGetActiveIndex = vi.fn(() => 0);
const mockOn = vi.fn(
  (event: string, handler: SnapCompleteHandler): (() => void) => {
    if (event === "snapComplete") {
      capturedSnapCompleteHandler = handler;
    }
    return () => {
      if (event === "snapComplete") {
        capturedSnapCompleteHandler = null;
      }
    };
  },
);

let lastEngineArgs: unknown[] = [];
let lastControllerArgs: unknown[] = [];

vi.mock("~/core/engine/snap-engine", () => ({
  SnapEngine: function MockSnapEngine(
    this: Record<string, unknown>,
    ...args: unknown[]
  ) {
    lastEngineArgs = args;
    this.destroy = mockEngineDestroy;
    this.registerItems = vi.fn();
    this.getActiveIndex = vi.fn(() => 0);
    this.updateConfig = vi.fn();
    this.on = vi.fn(() => vi.fn());
    this.off = vi.fn();
  },
}));

vi.mock("~/dom/snap-controller", () => ({
  SnapController: function MockSnapController(
    this: Record<string, unknown>,
    ...args: unknown[]
  ) {
    lastControllerArgs = args;
    this.attach = mockAttach;
    this.detach = mockDetach;
    this.destroy = mockControllerDestroy;
    this.snapTo = mockSnapTo;
    this.getActiveIndex = mockControllerGetActiveIndex;
    this.on = mockOn;
    this.off = vi.fn();
    this.observeItem = vi.fn();
    this.unobserveItem = vi.fn();
    this.registerItems = vi.fn();
  },
}));

// Import after mocks are set up
import { useSnapScroll } from "~/react/use-snap-scroll";

describe("useSnapScroll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedSnapCompleteHandler = null;
    mockControllerGetActiveIndex.mockReturnValue(0);
    lastEngineArgs = [];
    lastControllerArgs = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates engine and controller on mount", () => {
    renderHook(() => useSnapScroll({ axis: "y", items: [500, 500] }));

    expect(lastEngineArgs).toHaveLength(1);
    expect(lastControllerArgs).toHaveLength(2);
  });

  it("ref callback calls attach when element is provided", () => {
    const { result } = renderHook(() => useSnapScroll());
    const element = document.createElement("div");

    act(() => {
      result.current.containerRef(element);
    });

    expect(mockAttach).toHaveBeenCalledWith(element);
  });

  it("ref callback calls detach when element is null", () => {
    const { result } = renderHook(() => useSnapScroll());
    const element = document.createElement("div");

    act(() => {
      result.current.containerRef(element);
    });
    act(() => {
      result.current.containerRef(null);
    });

    expect(mockDetach).toHaveBeenCalledTimes(1);
  });

  it("activeIndex updates via useSyncExternalStore on snapComplete", () => {
    mockControllerGetActiveIndex.mockReturnValue(0);
    const { result } = renderHook(() => useSnapScroll());

    expect(result.current.activeIndex).toBe(0);

    // Simulate snapComplete event
    mockControllerGetActiveIndex.mockReturnValue(2);
    act(() => {
      capturedSnapCompleteHandler?.({ index: 2 });
    });

    expect(result.current.activeIndex).toBe(2);
  });

  it("scrollTo delegates to controller.snapTo", () => {
    const { result } = renderHook(() => useSnapScroll());

    act(() => {
      result.current.scrollTo(3);
    });

    expect(mockSnapTo).toHaveBeenCalledWith(3);
  });

  it("onIndexChange fires on snapComplete", () => {
    const onIndexChange = vi.fn();
    mockControllerGetActiveIndex.mockReturnValue(0);

    renderHook(() => useSnapScroll({ onIndexChange }));

    mockControllerGetActiveIndex.mockReturnValue(1);
    act(() => {
      capturedSnapCompleteHandler?.({ index: 1 });
    });

    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it("cleanup calls destroy on unmount", () => {
    const { unmount } = renderHook(() => useSnapScroll());

    unmount();

    expect(mockControllerDestroy).toHaveBeenCalledTimes(1);
    expect(mockEngineDestroy).toHaveBeenCalledTimes(1);
  });

  it("SSR getServerSnapshot returns initialIndex", () => {
    mockControllerGetActiveIndex.mockReturnValue(3);
    const { result } = renderHook(() =>
      useSnapScroll({ initialIndex: 3 }),
    );

    expect(result.current.activeIndex).toBe(3);
  });

  it("returns controller reference", () => {
    const { result } = renderHook(() => useSnapScroll());
    expect(result.current.controller).not.toBeNull();
  });

  it("passes items to controller config", () => {
    renderHook(() => useSnapScroll({ items: [100, 200, 300] }));

    expect(lastControllerArgs[1]).toMatchObject({
      items: [100, 200, 300],
    });
  });

  it("passes axis and wheelIdleTimeout to controller config", () => {
    renderHook(() =>
      useSnapScroll({ axis: "x", wheelIdleTimeout: 200 }),
    );

    expect(lastControllerArgs[1]).toMatchObject({
      axis: "x",
      wheelIdleTimeout: 200,
    });
  });

  it("defaults to axis y and initialIndex 0", () => {
    const { result } = renderHook(() => useSnapScroll());
    expect(result.current.activeIndex).toBe(0);
  });
});
