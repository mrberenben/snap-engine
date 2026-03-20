import { SnapScrollContext } from "~/react/context";
import { useSnapScroll } from "~/react/use-snap-scroll";
import type { SnapScrollContextValue, SnapScrollProviderProps } from "~/react/types";

export function SnapScrollProvider({ children, ...options }: SnapScrollProviderProps) {
  const snapScroll = useSnapScroll(options);

  const contextValue: SnapScrollContextValue = {
    controller: snapScroll.controller,
    containerRef: snapScroll.containerRef,
    activeIndex: snapScroll.activeIndex,
    scrollTo: snapScroll.scrollTo
  };

  return <SnapScrollContext.Provider value={contextValue}>{children}</SnapScrollContext.Provider>;
}
