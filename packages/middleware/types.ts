import type { EngineState, SnapEngineConfig, SnapItem, SnapResult } from "~/core/types";

// --- Read-only snapshot of engine state at snap time ---

export interface SnapContext {
  readonly items: readonly SnapItem[];
  readonly currentIndex: number;
  readonly currentOffset: number;
  readonly velocity: number;
  readonly config: Readonly<SnapEngineConfig>;
}

// --- Mutable payload for beforeSnap ---
// Intentionally excludes items, alignment, viewportSize, multiSkipFactor —
// those are fundamental config, not per-snap modifiable concerns.

export interface BeforeSnapPayload {
  velocity: number;
  currentIndex: number;
  currentOffset: number;
  velocityThreshold: number;
  maxSkipCount: number;
}

// --- Hook inputs ---

export interface BeforeSnapHookInput {
  readonly context: SnapContext;
  params: BeforeSnapPayload;
}

export interface AfterSnapHookInput {
  readonly context: SnapContext;
  result: SnapResult;
}

// --- Middleware interface ---

export interface Middleware {
  readonly name: string;
  onInit?(state: Readonly<EngineState>): void;
  beforeSnap?(input: BeforeSnapHookInput): BeforeSnapPayload;
  afterSnap?(input: AfterSnapHookInput): SnapResult;
  onVelocity?(velocity: number): number;
  onScroll?(offset: number): void;
  onSettle?(index: number): void;
  onDestroy?(): void;
}

// --- Pipeline config ---

export interface MiddlewarePipelineConfig {
  middlewares: Middleware[];
}
