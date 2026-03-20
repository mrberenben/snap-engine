import type { ScrollAxis } from "~/types";
import type { AnimationConfig } from "~/animation/types";
import type { SnapController } from "~/dom/snap-controller";
import type { Middleware } from "~/middleware/types";

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
