import type { EngineState, SnapResult } from "~/core/types";
import type {
  AfterSnapHookInput,
  BeforeSnapHookInput,
  BeforeSnapPayload,
  Middleware,
  MiddlewarePipelineConfig,
  SnapContext
} from "~/middleware/types";

export class MiddlewarePipeline {
  private readonly middlewares: readonly Middleware[];

  // Cached hook arrays — extracted at construction for zero-overhead hot path
  private readonly onInitHooks: ((state: Readonly<EngineState>) => void)[];
  private readonly beforeSnapHooks: ((input: BeforeSnapHookInput) => BeforeSnapPayload)[];
  private readonly afterSnapHooks: ((input: AfterSnapHookInput) => SnapResult)[];
  private readonly onVelocityHooks: ((velocity: number) => number)[];
  private readonly onScrollHooks: ((offset: number) => void)[];
  private readonly onSettleHooks: ((index: number) => void)[];
  private readonly onDestroyHooks: (() => void)[];

  private initialized = false;
  private destroyed = false;

  constructor(config: MiddlewarePipelineConfig) {
    this.middlewares = config.middlewares;

    // Cache hook references into flat arrays at construction time
    this.onInitHooks = [];
    this.beforeSnapHooks = [];
    this.afterSnapHooks = [];
    this.onVelocityHooks = [];
    this.onScrollHooks = [];
    this.onSettleHooks = [];
    this.onDestroyHooks = [];

    for (let i = 0; i < this.middlewares.length; i++) {
      const mw = this.middlewares[i]!;
      if (mw.onInit) this.onInitHooks.push(mw.onInit.bind(mw));
      if (mw.beforeSnap) this.beforeSnapHooks.push(mw.beforeSnap.bind(mw));
      if (mw.afterSnap) this.afterSnapHooks.push(mw.afterSnap.bind(mw));
      if (mw.onVelocity) this.onVelocityHooks.push(mw.onVelocity.bind(mw));
      if (mw.onScroll) this.onScrollHooks.push(mw.onScroll.bind(mw));
      if (mw.onSettle) this.onSettleHooks.push(mw.onSettle.bind(mw));
      if (mw.onDestroy) this.onDestroyHooks.push(mw.onDestroy.bind(mw));
    }
  }

  // --- Lifecycle ---

  init(state: Readonly<EngineState>): void {
    if (this.initialized || this.destroyed) return;
    this.initialized = true;

    for (let i = 0; i < this.onInitHooks.length; i++) {
      this.onInitHooks[i]!(state);
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    for (let i = 0; i < this.onDestroyHooks.length; i++) {
      this.onDestroyHooks[i]!();
    }
  }

  // --- Observation hooks (pure reads, no return) ---

  runOnScroll(offset: number): void {
    for (let i = 0; i < this.onScrollHooks.length; i++) {
      this.onScrollHooks[i]!(offset);
    }
  }

  runOnSettle(index: number): void {
    for (let i = 0; i < this.onSettleHooks.length; i++) {
      this.onSettleHooks[i]!(index);
    }
  }

  // --- Modification hooks (sequential composition) ---

  runOnVelocity(velocity: number): number {
    let v = velocity;
    for (let i = 0; i < this.onVelocityHooks.length; i++) {
      v = this.onVelocityHooks[i]!(v);
    }
    return v;
  }

  runBeforeSnap(context: SnapContext, params: BeforeSnapPayload): BeforeSnapPayload {
    let p = params;
    for (let i = 0; i < this.beforeSnapHooks.length; i++) {
      p = this.beforeSnapHooks[i]!({ context, params: p });
    }
    return p;
  }

  runAfterSnap(context: SnapContext, result: SnapResult): SnapResult {
    let r = result;
    for (let i = 0; i < this.afterSnapHooks.length; i++) {
      r = this.afterSnapHooks[i]!({ context, result: r });
    }
    return r;
  }

  // --- Introspection ---

  hasSnapHooks(): boolean {
    return (
      this.beforeSnapHooks.length > 0 ||
      this.afterSnapHooks.length > 0 ||
      this.onVelocityHooks.length > 0
    );
  }

  hasHook(name: keyof Middleware): boolean {
    switch (name) {
      case "onInit": return this.onInitHooks.length > 0;
      case "beforeSnap": return this.beforeSnapHooks.length > 0;
      case "afterSnap": return this.afterSnapHooks.length > 0;
      case "onVelocity": return this.onVelocityHooks.length > 0;
      case "onScroll": return this.onScrollHooks.length > 0;
      case "onSettle": return this.onSettleHooks.length > 0;
      case "onDestroy": return this.onDestroyHooks.length > 0;
      default: return false;
    }
  }

  getMiddlewares(): readonly Middleware[] {
    return this.middlewares;
  }

  getMiddlewareByName(name: string): Middleware | undefined {
    for (let i = 0; i < this.middlewares.length; i++) {
      if (this.middlewares[i]!.name === name) return this.middlewares[i];
    }
    return undefined;
  }
}
