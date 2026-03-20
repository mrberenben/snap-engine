import type { EngineState } from "~/core/types";
import type { Middleware } from "~/middleware/types";
import type { BuiltInVirtualAdapterConfig, VirtualAdapter } from "~/middleware/virtualizer/types";
import { BuiltInVirtualAdapter } from "~/middleware/virtualizer/built-in-adapter";

export class VirtualizationMiddleware implements Middleware {
  readonly name = "snap-engine:virtualization";
  private adapter: VirtualAdapter;

  constructor(adapter: VirtualAdapter) {
    this.adapter = adapter;
  }

  onInit(state: Readonly<EngineState>): void {
    this.adapter.updateScrollOffset(state.currentOffset);
    this.adapter.setAnchorIndex(state.activeIndex);
  }

  onScroll(offset: number): void {
    this.adapter.updateScrollOffset(offset);
  }

  onSettle(index: number): void {
    this.adapter.setAnchorIndex(index);
  }

  onDestroy(): void {
    this.adapter.destroy();
  }

  getAdapter(): VirtualAdapter {
    return this.adapter;
  }
}

export interface CreateVirtualSnapMiddlewareResult {
  middleware: VirtualizationMiddleware;
  adapter: BuiltInVirtualAdapter;
}

export function createVirtualSnapMiddleware(
  config: BuiltInVirtualAdapterConfig
): CreateVirtualSnapMiddlewareResult {
  const adapter = new BuiltInVirtualAdapter(config);
  const middleware = new VirtualizationMiddleware(adapter);
  return { middleware, adapter };
}
