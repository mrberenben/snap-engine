import type { ScrollAxis } from "~/types";
import type { AnimationConfig } from "~/animation/types";
import type { SnapController } from "~/dom/snap-controller";
import type { Middleware } from "~/middleware/types";
import type { VirtualRange } from "~/middleware/virtualizer/types";

export interface UseSnapScrollOptions {
  axis?: ScrollAxis;
  items?: number[];
  wheelIdleTimeout?: number;
  overscrollBehavior?: "contain" | "none" | "auto";
  animationConfig?: AnimationConfig;
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  middlewares?: Middleware[];
}

export interface UseSnapScrollReturn {
  containerRef: React.RefCallback<HTMLElement>;
  activeIndex: number;
  scrollTo: (index: number) => void;
  controller: SnapController | null;
}

export interface UseSnapItemReturn {
  ref: React.RefCallback<HTMLElement>;
}

export interface SnapScrollContextValue {
  controller: SnapController | null;
  containerRef: React.RefCallback<HTMLElement>;
  activeIndex: number;
  scrollTo: (index: number) => void;
}

export interface SnapScrollProviderProps extends UseSnapScrollOptions {
  children: React.ReactNode;
}

export interface UseVirtualSnapScrollOptions {
  axis?: ScrollAxis;
  totalCount: number;
  estimatedItemSize: number | ((index: number) => number);
  overscan?: number;
  wheelIdleTimeout?: number;
  overscrollBehavior?: "contain" | "none" | "auto";
  animationConfig?: AnimationConfig;
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  onRangeChange?: (range: VirtualRange) => void;
  middlewares?: Middleware[];
}

export interface UseVirtualSnapScrollReturn {
  containerRef: React.RefCallback<HTMLElement>;
  activeIndex: number;
  scrollTo: (index: number) => void;
  visibleRange: VirtualRange;
  totalSize: number;
  measureItem: (index: number, element: HTMLElement | null) => void;
  controller: SnapController | null;
}

export interface VirtualSnapScrollContextValue {
  controller: SnapController | null;
  containerRef: React.RefCallback<HTMLElement>;
  activeIndex: number;
  scrollTo: (index: number) => void;
  visibleRange: VirtualRange;
  totalSize: number;
  measureItem: (index: number, element: HTMLElement | null) => void;
}

export interface VirtualSnapScrollProviderProps extends UseVirtualSnapScrollOptions {
  children: React.ReactNode;
}
