import { createContext, useContext } from "react";
import type { VirtualSnapScrollContextValue } from "~/react/types";

export const VirtualSnapScrollContext = createContext<VirtualSnapScrollContextValue | null>(null);

export function useVirtualSnapScrollContext(): VirtualSnapScrollContextValue {
  const context = useContext(VirtualSnapScrollContext);

  if (context === null) {
    throw new Error("useVirtualSnapScrollContext must be used within a <VirtualSnapScrollProvider>");
  }

  return context;
}
