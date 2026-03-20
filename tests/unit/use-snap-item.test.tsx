// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { useSnapItem } from "~/react/use-snap-item";
import { SnapScrollContext } from "~/react/context";
import type { SnapScrollContextValue } from "~/react/types";

function createMockContextValue(
  overrides?: Partial<SnapScrollContextValue>,
): SnapScrollContextValue {
  return {
    controller: {
      observeItem: vi.fn(),
      unobserveItem: vi.fn(),
      attach: vi.fn(),
      detach: vi.fn(),
      destroy: vi.fn(),
      snapTo: vi.fn(),
      getActiveIndex: vi.fn(() => 0),
      on: vi.fn(() => vi.fn()),
      off: vi.fn(),
      registerItems: vi.fn(),
      isAnimating: vi.fn(() => false),
      isInteracting: vi.fn(() => false),
      getCurrentOffset: vi.fn(() => 0),
      getEngine: vi.fn(),
    } as unknown as SnapScrollContextValue["controller"],
    containerRef: vi.fn(),
    activeIndex: 0,
    scrollTo: vi.fn(),
    ...overrides,
  };
}

function createWrapper(contextValue: SnapScrollContextValue) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SnapScrollContext.Provider value={contextValue}>
        {children}
      </SnapScrollContext.Provider>
    );
  };
}

describe("useSnapItem", () => {
  let contextValue: SnapScrollContextValue;

  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = createMockContextValue();
  });

  it("calls observeItem on element mount", () => {
    const wrapper = createWrapper(contextValue);
    const { result } = renderHook(() => useSnapItem(2), { wrapper });

    const element = document.createElement("div");
    result.current.ref(element);

    expect(contextValue.controller!.observeItem).toHaveBeenCalledWith(
      element,
      2,
    );
  });

  it("calls unobserveItem on element unmount", () => {
    const wrapper = createWrapper(contextValue);
    const { result } = renderHook(() => useSnapItem(0), { wrapper });

    const element = document.createElement("div");
    result.current.ref(element);
    result.current.ref(null);

    expect(contextValue.controller!.unobserveItem).toHaveBeenCalledWith(
      element,
    );
  });

  it("throws when used outside SnapScrollProvider", () => {
    // Suppress console.error from React error boundary
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useSnapItem(0));
    }).toThrow("useSnapScrollContext must be used within a <SnapScrollProvider>");

    consoleSpy.mockRestore();
  });

  it("handles null controller gracefully", () => {
    const contextWithNullController = createMockContextValue({
      controller: null,
    });
    const wrapper = createWrapper(contextWithNullController);
    const { result } = renderHook(() => useSnapItem(0), { wrapper });

    const element = document.createElement("div");

    // Should not throw
    expect(() => {
      result.current.ref(element);
      result.current.ref(null);
    }).not.toThrow();
  });

  it("handles element swap (unobserves old, observes new)", () => {
    const wrapper = createWrapper(contextValue);
    const { result } = renderHook(() => useSnapItem(1), { wrapper });

    const element1 = document.createElement("div");
    const element2 = document.createElement("span");

    result.current.ref(element1);
    result.current.ref(element2);

    expect(contextValue.controller!.unobserveItem).toHaveBeenCalledWith(
      element1,
    );
    expect(contextValue.controller!.observeItem).toHaveBeenCalledWith(
      element2,
      1,
    );
  });

  it("updates observation when index changes", () => {
    const wrapper = createWrapper(contextValue);
    const { result, rerender } = renderHook(
      ({ index }) => useSnapItem(index),
      { wrapper, initialProps: { index: 0 } },
    );

    const element = document.createElement("div");
    result.current.ref(element);

    expect(contextValue.controller!.observeItem).toHaveBeenCalledWith(
      element,
      0,
    );

    // Rerender with new index — new ref callback created
    rerender({ index: 5 });

    // Apply the new ref callback to same element
    result.current.ref(element);

    expect(contextValue.controller!.observeItem).toHaveBeenCalledWith(
      element,
      5,
    );
  });
});
