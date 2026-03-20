import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { SnapEngine } from "~/core/engine/snap-engine";
import { SnapController } from "~/dom/snap-controller";
import { MiddlewarePipeline } from "~/middleware/pipeline";
import type { UseSnapScrollOptions, UseSnapScrollReturn } from "~/react/types";

export function useSnapScroll(options: UseSnapScrollOptions = {}): UseSnapScrollReturn {
  const {
    axis = "y",
    items,
    wheelIdleTimeout = 120,
    overscrollBehavior = "contain",
    animationConfig,
    initialIndex = 0,
    onIndexChange,
    middlewares
  } = options;

  // Store onIndexChange in a ref to avoid subscribe instability
  const onIndexChangeRef = useRef(onIndexChange);
  onIndexChangeRef.current = onIndexChange;

  // Guarded ref: create engine + controller once, recreate if destroyed
  const engineRef = useRef<SnapEngine | null>(null);
  const controllerRef = useRef<SnapController | null>(null);

  if (engineRef.current === null) {
    const engine = new SnapEngine({ axis, viewportSize: 0 });
    const pipeline = middlewares?.length
      ? new MiddlewarePipeline({ middlewares })
      : undefined;
    const controller = new SnapController(engine, {
      axis,
      wheelIdleTimeout,
      overscrollBehavior,
      animationConfig,
      items: items ?? [],
      pipeline
    });
    engineRef.current = engine;
    controllerRef.current = controller;
  }

  // Ref callback for container element
  const containerRef: React.RefCallback<HTMLElement> = useCallback(
    (element: HTMLElement | null) => {
      const controller = controllerRef.current;
      if (!controller) return;

      if (element !== null) {
        controller.attach(element);
        if (initialIndex > 0 && items && items.length > 0) {
          controller.snapTo(initialIndex);
        }
      } else {
        controller.detach();
      }
    },
    // Config is treated as immutable — no deps needed beyond mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // useSyncExternalStore for activeIndex
  const subscribe = useCallback((onStoreChange: () => void) => {
    const controller = controllerRef.current;
    if (!controller) return () => {};

    const unsubscribe = controller.on("snapComplete", payload => {
      onIndexChangeRef.current?.(payload.index);
      onStoreChange();
    });
    return unsubscribe;
  }, []);

  const getSnapshot = useCallback(() => {
    return controllerRef.current?.getActiveIndex() ?? initialIndex;
  }, [initialIndex]);

  const getServerSnapshot = useCallback(() => {
    return initialIndex;
  }, [initialIndex]);

  const activeIndex = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Stable scrollTo
  const scrollTo = useCallback((index: number) => {
    controllerRef.current?.snapTo(index);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      controllerRef.current?.destroy();
      engineRef.current?.destroy();
      controllerRef.current = null;
      engineRef.current = null;
    };
  }, []);

  return {
    containerRef,
    activeIndex,
    scrollTo,
    controller: controllerRef.current
  };
}
