import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { SnapEngine } from "~/core/engine/snap-engine";
import { SnapController } from "~/dom/snap-controller";
import { MiddlewarePipeline } from "~/middleware/pipeline";
import { BuiltInVirtualAdapter } from "~/middleware/virtualizer/built-in-adapter";
import { VirtualizationMiddleware } from "~/middleware/virtualizer/middleware";
import type { VirtualRange } from "~/middleware/virtualizer/types";
import type { UseVirtualSnapScrollOptions, UseVirtualSnapScrollReturn } from "~/react/types";

interface MountedItem {
  element: HTMLElement;
  observer: ResizeObserver;
}

const INITIAL_RANGE: VirtualRange = {
  startIndex: 0,
  endIndex: -1,
  overscanStartIndex: 0,
  overscanEndIndex: -1
};

export function useVirtualSnapScroll(options: UseVirtualSnapScrollOptions): UseVirtualSnapScrollReturn {
  const {
    axis = "y",
    totalCount,
    estimatedItemSize,
    overscan = 3,
    wheelIdleTimeout = 120,
    overscrollBehavior = "contain",
    animationConfig,
    initialIndex = 0,
    onIndexChange,
    onRangeChange,
    middlewares: userMiddlewares
  } = options;

  // Stable refs for callbacks
  const onIndexChangeRef = useRef(onIndexChange);
  onIndexChangeRef.current = onIndexChange;
  const onRangeChangeRef = useRef(onRangeChange);
  onRangeChangeRef.current = onRangeChange;

  // Container element ref
  const containerElementRef = useRef<HTMLElement | null>(null);

  // Mounted items for ResizeObserver tracking
  const mountedItemsRef = useRef<Map<number, MountedItem>>(new Map());

  // Guarded refs: create once
  const engineRef = useRef<SnapEngine | null>(null);
  const controllerRef = useRef<SnapController | null>(null);
  const adapterRef = useRef<BuiltInVirtualAdapter | null>(null);

  if (engineRef.current === null) {
    const adapter = new BuiltInVirtualAdapter({
      itemCount: totalCount,
      estimatedItemSize,
      viewportSize: 0,
      overscan
    });

    const virtualizationMiddleware = new VirtualizationMiddleware(adapter);
    const allMiddlewares = userMiddlewares?.length
      ? [virtualizationMiddleware, ...userMiddlewares]
      : [virtualizationMiddleware];
    const pipeline = new MiddlewarePipeline({ middlewares: allMiddlewares });

    const engine = new SnapEngine({ axis, viewportSize: 0 });

    // Build sizes array from estimatedItemSize and register
    const sizes = buildSizesArray(totalCount, estimatedItemSize);
    engine.registerItems(sizes);

    const controller = new SnapController(engine, {
      axis,
      wheelIdleTimeout,
      overscrollBehavior,
      animationConfig,
      items: [],
      pipeline
    });

    engineRef.current = engine;
    controllerRef.current = controller;
    adapterRef.current = adapter;
  }

  // containerRef callback
  const containerRef: React.RefCallback<HTMLElement> = useCallback(
    (element: HTMLElement | null) => {
      const controller = controllerRef.current;
      const adapter = adapterRef.current;
      if (!controller || !adapter) return;

      if (element !== null) {
        containerElementRef.current = element;
        controller.attach(element);

        // Measure viewport and propagate to adapter
        const sizeProperty = axis === "y" ? "clientHeight" : "clientWidth";
        const viewportSize = element[sizeProperty];
        adapter.setViewportSize(viewportSize);

        if (initialIndex > 0) {
          controller.snapTo(initialIndex);
        }
      } else {
        containerElementRef.current = null;
        controller.detach();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // useSyncExternalStore for activeIndex
  const subscribeActiveIndex = useCallback((onStoreChange: () => void) => {
    const controller = controllerRef.current;
    if (!controller) return () => {};

    const unsubscribe = controller.on("snapComplete", (payload) => {
      onIndexChangeRef.current?.(payload.index);
      onStoreChange();
    });
    return unsubscribe;
  }, []);

  const getActiveIndexSnapshot = useCallback(() => {
    return controllerRef.current?.getActiveIndex() ?? initialIndex;
  }, [initialIndex]);

  const getActiveIndexServerSnapshot = useCallback(() => {
    return initialIndex;
  }, [initialIndex]);

  const activeIndex = useSyncExternalStore(
    subscribeActiveIndex,
    getActiveIndexSnapshot,
    getActiveIndexServerSnapshot
  );

  // useSyncExternalStore for visibleRange
  const subscribeRange = useCallback((onStoreChange: () => void) => {
    const adapter = adapterRef.current;
    if (!adapter) return () => {};
    return adapter.subscribe(onStoreChange);
  }, []);

  const getRangeSnapshot = useCallback(() => {
    return adapterRef.current?.getVisibleRange() ?? INITIAL_RANGE;
  }, []);

  const getRangeServerSnapshot = useCallback(() => {
    return INITIAL_RANGE;
  }, []);

  const visibleRange = useSyncExternalStore(
    subscribeRange,
    getRangeSnapshot,
    getRangeServerSnapshot
  );

  // totalSize — read from adapter each render (fresh due to adapter subscription)
  const totalSize = adapterRef.current?.getTotalSize() ?? 0;

  // Stable scrollTo
  const scrollTo = useCallback((index: number) => {
    controllerRef.current?.snapTo(index);
  }, []);

  // measureItem callback
  const measureItem = useCallback((index: number, element: HTMLElement | null) => {
    const adapter = adapterRef.current;
    const engine = engineRef.current;
    if (!adapter || !engine) return;

    const mountedItems = mountedItemsRef.current;

    if (element === null) {
      // Unmount: disconnect observer, remove from map
      const mounted = mountedItems.get(index);
      if (mounted) {
        mounted.observer.disconnect();
        mountedItems.delete(index);
      }
      return;
    }

    const doMeasure = (el: HTMLElement) => {
      const sizeProperty = axis === "y" ? "height" : "width";
      const rect = el.getBoundingClientRect();
      const size = rect[sizeProperty];

      if (adapter.getItemSize(index) === size) return;

      adapter.measureItem(index, size);
      engine.updateItemSize(index, size);

      const correction = adapter.getAnchorCorrection();
      if (correction !== 0 && containerElementRef.current) {
        const scrollProperty = axis === "y" ? "scrollTop" : "scrollLeft";
        containerElementRef.current[scrollProperty] += correction;
        adapter.clearAnchorCorrection();
      }
    };

    // Initial measurement
    doMeasure(element);

    // Clean up previous observer for this index if any
    const existing = mountedItems.get(index);
    if (existing) {
      existing.observer.disconnect();
    }

    // Set up ResizeObserver for dynamic size changes
    const observer = new ResizeObserver(() => {
      doMeasure(element);
    });
    observer.observe(element);

    mountedItems.set(index, { element, observer });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [axis]);

  // totalCount changes
  useEffect(() => {
    const adapter = adapterRef.current;
    const engine = engineRef.current;
    if (!adapter || !engine) return;

    adapter.setItemCount(totalCount);
    const sizes = buildSizesArray(totalCount, estimatedItemSize);
    engine.registerItems(sizes);
  }, [totalCount, estimatedItemSize]);

  // onRangeChange callback
  useEffect(() => {
    onRangeChangeRef.current?.(visibleRange);
  }, [visibleRange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Destroy all item ResizeObservers
      const mountedItems = mountedItemsRef.current;
      for (const [, mounted] of mountedItems) {
        mounted.observer.disconnect();
      }
      mountedItems.clear();

      controllerRef.current?.destroy();
      engineRef.current?.destroy();
      controllerRef.current = null;
      engineRef.current = null;
      adapterRef.current = null;
    };
  }, []);

  return {
    containerRef,
    activeIndex,
    scrollTo,
    visibleRange,
    totalSize,
    measureItem,
    controller: controllerRef.current
  };
}

function buildSizesArray(
  count: number,
  estimatedItemSize: number | ((index: number) => number)
): number[] {
  const sizes = new Array<number>(count);
  if (typeof estimatedItemSize === "number") {
    for (let i = 0; i < count; i++) {
      sizes[i] = estimatedItemSize;
    }
  } else {
    for (let i = 0; i < count; i++) {
      sizes[i] = estimatedItemSize(i);
    }
  }
  return sizes;
}
