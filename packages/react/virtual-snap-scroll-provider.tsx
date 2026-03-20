import { VirtualSnapScrollContext } from "~/react/virtual-context";
import { useVirtualSnapScroll } from "~/react/use-virtual-snap-scroll";
import type { VirtualSnapScrollContextValue, VirtualSnapScrollProviderProps } from "~/react/types";

export function VirtualSnapScrollProvider({ children, ...options }: VirtualSnapScrollProviderProps) {
  const virtualSnapScroll = useVirtualSnapScroll(options);

  const contextValue: VirtualSnapScrollContextValue = {
    controller: virtualSnapScroll.controller,
    containerRef: virtualSnapScroll.containerRef,
    activeIndex: virtualSnapScroll.activeIndex,
    scrollTo: virtualSnapScroll.scrollTo,
    visibleRange: virtualSnapScroll.visibleRange,
    totalSize: virtualSnapScroll.totalSize,
    measureItem: virtualSnapScroll.measureItem
  };

  return (
    <VirtualSnapScrollContext.Provider value={contextValue}>
      {children}
    </VirtualSnapScrollContext.Provider>
  );
}
