import { describe, it, expect, vi } from "vitest";
import { VirtualizationMiddleware, createVirtualSnapMiddleware } from "~/middleware/virtualizer/middleware";
import { MiddlewarePipeline } from "~/middleware/pipeline";
import type { VirtualAdapter } from "~/middleware/virtualizer/types";
import type { EngineState } from "~/core/types";

function createMockAdapter(): VirtualAdapter {
  return {
    getItemCount: vi.fn(() => 10),
    getItemSize: vi.fn(() => 100),
    getItemOffset: vi.fn(() => 0),
    getTotalSize: vi.fn(() => 1000),
    getVisibleRange: vi.fn(() => ({
      startIndex: 0,
      endIndex: 3,
      overscanStartIndex: 0,
      overscanEndIndex: 5
    })),
    updateScrollOffset: vi.fn(),
    setAnchorIndex: vi.fn(),
    getAnchorCorrection: vi.fn(() => 0),
    clearAnchorCorrection: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    destroy: vi.fn()
  };
}

function createEngineState(overrides?: Partial<EngineState>): Readonly<EngineState> {
  return {
    items: [{ index: 0, offset: 0, size: 100 }],
    currentOffset: 0,
    velocity: 0,
    activeIndex: 0,
    isSettled: true,
    itemCount: 1,
    ...overrides
  };
}

describe("VirtualizationMiddleware", () => {
  it("has correct name", () => {
    const adapter = createMockAdapter();
    const middleware = new VirtualizationMiddleware(adapter);
    expect(middleware.name).toBe("snap-engine:virtualization");
  });

  it("onInit propagates state to adapter", () => {
    const adapter = createMockAdapter();
    const middleware = new VirtualizationMiddleware(adapter);
    const state = createEngineState({ currentOffset: 250, activeIndex: 2 });

    middleware.onInit(state);

    expect(adapter.updateScrollOffset).toHaveBeenCalledWith(250);
    expect(adapter.setAnchorIndex).toHaveBeenCalledWith(2);
  });

  it("onScroll forwards offset to adapter", () => {
    const adapter = createMockAdapter();
    const middleware = new VirtualizationMiddleware(adapter);

    middleware.onScroll(500);

    expect(adapter.updateScrollOffset).toHaveBeenCalledWith(500);
  });

  it("onSettle sets anchor index", () => {
    const adapter = createMockAdapter();
    const middleware = new VirtualizationMiddleware(adapter);

    middleware.onSettle(7);

    expect(adapter.setAnchorIndex).toHaveBeenCalledWith(7);
  });

  it("onDestroy calls adapter.destroy", () => {
    const adapter = createMockAdapter();
    const middleware = new VirtualizationMiddleware(adapter);

    middleware.onDestroy();

    expect(adapter.destroy).toHaveBeenCalledTimes(1);
  });

  it("does not have snap hooks (beforeSnap/afterSnap/onVelocity)", () => {
    const adapter = createMockAdapter();
    const middleware = new VirtualizationMiddleware(adapter);
    const pipeline = new MiddlewarePipeline({ middlewares: [middleware] });

    expect(pipeline.hasSnapHooks()).toBe(false);
  });

  it("has onScroll and onSettle hooks", () => {
    const adapter = createMockAdapter();
    const middleware = new VirtualizationMiddleware(adapter);
    const pipeline = new MiddlewarePipeline({ middlewares: [middleware] });

    expect(pipeline.hasHook("onScroll")).toBe(true);
    expect(pipeline.hasHook("onSettle")).toBe(true);
  });

  it("integrates into MiddlewarePipeline correctly", () => {
    const adapter = createMockAdapter();
    const middleware = new VirtualizationMiddleware(adapter);
    const pipeline = new MiddlewarePipeline({ middlewares: [middleware] });
    const state = createEngineState({ currentOffset: 100, activeIndex: 1 });

    // Init
    pipeline.init(state);
    expect(adapter.updateScrollOffset).toHaveBeenCalledWith(100);
    expect(adapter.setAnchorIndex).toHaveBeenCalledWith(1);

    // Scroll
    pipeline.runOnScroll(300);
    expect(adapter.updateScrollOffset).toHaveBeenCalledWith(300);

    // Settle
    pipeline.runOnSettle(3);
    expect(adapter.setAnchorIndex).toHaveBeenCalledWith(3);

    // Destroy
    pipeline.destroy();
    expect(adapter.destroy).toHaveBeenCalledTimes(1);
  });
});

describe("createVirtualSnapMiddleware", () => {
  it("returns working middleware and adapter pair", () => {
    const { middleware, adapter } = createVirtualSnapMiddleware({
      itemCount: 100,
      estimatedItemSize: 50,
      viewportSize: 300
    });

    expect(middleware.name).toBe("snap-engine:virtualization");
    expect(adapter.getTotalSize()).toBe(5000);
    expect(adapter.getItemSize(0)).toBe(50);

    // Middleware delegates to the adapter
    middleware.onScroll(200);
    const range = adapter.getVisibleRange();
    expect(range.startIndex).toBeGreaterThanOrEqual(0);
  });
});
