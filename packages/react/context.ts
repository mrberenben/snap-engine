import { createContext, useContext } from "react";
import type { SnapScrollContextValue } from "~/react/types";

export const SnapScrollContext = createContext<SnapScrollContextValue | null>(null);

export function useSnapScrollContext(): SnapScrollContextValue {
  const context = useContext(SnapScrollContext);

  if (context === null) {
    throw new Error("useSnapScrollContext must be used within a <SnapScrollProvider>");
  }

  return context;
}
