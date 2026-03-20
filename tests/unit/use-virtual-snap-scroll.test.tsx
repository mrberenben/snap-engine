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
const mockRegisterItems = vi.fn();
const mockUpdateItemSize = vi.fn();
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
  }
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
    this.registerItems = mockRegisterItems;
    this.updateItemSize = mockUpdateItemSize;
    this.getActiveIndex = vi.fn(() => 0);
    this.updateConfig = vi.fn();
    this.on = vi.fn(() => vi.fn());
    this.off = vi.fn();
  }
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
  }
}));

// Mock ResizeObserver
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();
vi.stubGlobal(
  "ResizeObserver",
  vi.fn(() => ({
    observe: mockObserve,
    disconnect: mockDisconnect,
    unobserve: vi.fn()
  }))
);

// Import after mocks
import { useVirtualSnapScroll } from "~/react/use-virtual-snap-scroll";

describe("useVirtualSnapScroll", () => {
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

  it("creates engine, adapter, middleware, controller on mount", () => {
    renderHook(() =>
      useVirtualSnapScroll({ totalCount: 100, estimatedItemSize: 200 })
    );

    // Engine created with axis config
    expect(lastEngineArgs).toHaveLength(1);
    // Controller created with engine + config
    expect(lastControllerArgs).toHaveLength(2);
  });

  it("registers estimated items in engine on mount", () => {
    renderHook(() =>
      useVirtualSnapScroll({ totalCount: 5, estimatedItemSize: 100 })
    );

    expect(mockRegisterItems).toHaveBeenCalledWith([100, 100, 100, 100, 100]);
  });

  it("registers variable estimated items from callback", () => {
    renderHook(() =>
      useVirtualSnapScroll({
        totalCount: 3,
        estimatedItemSize: (i) => (i + 1) * 50
      })
    );

    expect(mockRegisterItems).toHaveBeenCalledWith([50, 100, 150]);
  });

  it("containerRef callback attaches/detaches controller", () => {
    const { result } = renderHook(() =>
      useVirtualSnapScroll({ totalCount: 10, estimatedItemSize: 100 })
    );

    const element = document.createElement("div");
    act(() => {
      result.current.containerRef(element);
    });
    expect(mockAttach).toHaveBeenCalledWith(element);

    act(() => {
      result.current.containerRef(null);
    });
    expect(mockDetach).toHaveBeenCalledTimes(1);
  });

  it("activeIndex updates via useSyncExternalStore on snapComplete", () => {
    mockControllerGetActiveIndex.mockReturnValue(0);
    const { result } = renderHook(() =>
      useVirtualSnapScroll({ totalCount: 10, estimatedItemSize: 100 })
    );

    expect(result.current.activeIndex).toBe(0);

    mockControllerGetActiveIndex.mockReturnValue(5);
    act(() => {
      capturedSnapCompleteHandler?.({ index: 5 });
    });

    expect(result.current.activeIndex).toBe(5);
  });

  it("visibleRange is available from adapter", () => {
    const { result } = renderHook(() =>
      useVirtualSnapScroll({ totalCount: 20, estimatedItemSize: 100 })
    );

    // Initial range should exist
    expect(result.current.visibleRange).toBeDefined();
    expect(typeof result.current.visibleRange.startIndex).toBe("number");
    expect(typeof result.current.visibleRange.endIndex).toBe("number");
  });

  it("scrollTo delegates to controller.snapTo", () => {
    const { result } = renderHook(() =>
      useVirtualSnapScroll({ totalCount: 10, estimatedItemSize: 100 })
    );

    act(() => {
      result.current.scrollTo(7);
    });

    expect(mockSnapTo).toHaveBeenCalledWith(7);
  });

  it("cleanup destroys controller + engine on unmount", () => {
    const { unmount } = renderHook(() =>
      useVirtualSnapScroll({ totalCount: 10, estimatedItemSize: 100 })
    );

    unmount();

    expect(mockControllerDestroy).toHaveBeenCalledTimes(1);
    expect(mockEngineDestroy).toHaveBeenCalledTimes(1);
  });

  it("returns controller reference", () => {
    const { result } = renderHook(() =>
      useVirtualSnapScroll({ totalCount: 10, estimatedItemSize: 100 })
    );

    expect(result.current.controller).not.toBeNull();
  });

  it("onIndexChange fires on snapComplete", () => {
    const onIndexChange = vi.fn();
    mockControllerGetActiveIndex.mockReturnValue(0);

    renderHook(() =>
      useVirtualSnapScroll({
        totalCount: 10,
        estimatedItemSize: 100,
        onIndexChange
      })
    );

    mockControllerGetActiveIndex.mockReturnValue(3);
    act(() => {
      capturedSnapCompleteHandler?.({ index: 3 });
    });

    expect(onIndexChange).toHaveBeenCalledWith(3);
  });

  it("SSR getServerSnapshot returns initial range", () => {
    const { result } = renderHook(() =>
      useVirtualSnapScroll({ totalCount: 10, estimatedItemSize: 100 })
    );

    // Should have a valid range object
    expect(result.current.visibleRange).toHaveProperty("startIndex");
    expect(result.current.visibleRange).toHaveProperty("endIndex");
    expect(result.current.visibleRange).toHaveProperty("overscanStartIndex");
    expect(result.current.visibleRange).toHaveProperty("overscanEndIndex");
  });

  it("totalSize is computed from adapter", () => {
    const { result } = renderHook(() =>
      useVirtualSnapScroll({ totalCount: 10, estimatedItemSize: 100 })
    );

    expect(result.current.totalSize).toBe(1000);
  });

  it("measureItem is a function", () => {
    const { result } = renderHook(() =>
      useVirtualSnapScroll({ totalCount: 10, estimatedItemSize: 100 })
    );

    expect(typeof result.current.measureItem).toBe("function");
  });
});
