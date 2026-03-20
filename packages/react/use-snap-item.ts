import { useCallback, useRef } from "react";
import { useSnapScrollContext } from "~/react/context";
import type { UseSnapItemReturn } from "~/react/types";

export function useSnapItem(index: number): UseSnapItemReturn {
  const { controller } = useSnapScrollContext();
  const prevElementRef = useRef<HTMLElement | null>(null);

  const ref: React.RefCallback<HTMLElement> = useCallback(
    (element: HTMLElement | null) => {
      // Clean up previous element
      if (prevElementRef.current !== null && prevElementRef.current !== element) {
        controller?.unobserveItem(prevElementRef.current);
      }

      if (element !== null) {
        controller?.observeItem(element, index);
      }

      prevElementRef.current = element;
    },
    [controller, index]
  );

  return { ref };
}
