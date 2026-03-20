// Types
export type {
  VirtualRange,
  VirtualAdapter,
  VirtualLayoutConfig,
  BuiltInVirtualAdapterConfig
} from "~/middleware/virtualizer/types";

// Layout
export { VirtualLayout } from "~/middleware/virtualizer/virtual-layout";

// Adapter
export { BuiltInVirtualAdapter } from "~/middleware/virtualizer/built-in-adapter";

// Middleware
export { VirtualizationMiddleware, createVirtualSnapMiddleware } from "~/middleware/virtualizer/middleware";
export type { CreateVirtualSnapMiddlewareResult } from "~/middleware/virtualizer/middleware";
