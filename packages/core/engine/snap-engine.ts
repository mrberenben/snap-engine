import type { EngineState, SnapEngineConfig, SnapEngineEventMap, SnapItem, SnapResult } from "~/core/types";
import { EventEmitter } from "~/core/events/event-emitter";
import {
  calculateLayout,
  getIndexAtOffset,
  getOffsetForIndex,
  recalculateLayout
} from "~/core/algorithms/layout-calculator";
import { resolveSnap } from "~/core/algorithms/snap-resolver";
import { VelocityTracker } from "~/core/algorithms/velocity-tracker";
import { createInitialState, DEFAULT_CONFIG } from "~/core/engine/state";

export class SnapEngine {
  private state: EngineState;
  private config: SnapEngineConfig;
  private emitter = new EventEmitter<SnapEngineEventMap>();
  private velocityTracker = new VelocityTracker();
  private destroyed = false;

  // Pre-allocated event payloads for hot path — zero allocation per frame
  private _offsetChangePayload = { offset: 0 };

  constructor(config?: Partial<SnapEngineConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = createInitialState();
  }

  // --- Item management ---

  registerItem(index: number, size: number): void {
    this.assertNotDestroyed();
    const item: SnapItem = { index, offset: 0, size };

    // Insert at the correct position
    const items = this.state.items;
    const insertIdx = items.findIndex(it => it.index >= index);

    if (insertIdx === -1) {
      items.push(item);
    } else if (items[insertIdx]!.index === index) {
      // Replace existing
      items[insertIdx] = item;
    } else {
      items.splice(insertIdx, 0, item);
    }

    this.rebuildLayout();
    this.state.itemCount = this.state.items.length;
    this.emitter.emit("itemsChange", { items: this.state.items });
  }

  registerItems(sizes: number[]): void {
    this.assertNotDestroyed();
    this.state.items = calculateLayout(sizes);
    this.state.itemCount = this.state.items.length;
    this.emitter.emit("itemsChange", { items: this.state.items });
  }

  updateItemSize(index: number, size: number): void {
    this.assertNotDestroyed();
    if (index < 0 || index >= this.state.items.length) return;

    recalculateLayout(this.state.items, index, size);
    this.emitter.emit("itemsChange", { items: this.state.items });
  }

  removeItem(index: number): void {
    this.assertNotDestroyed();
    const idx = this.state.items.findIndex(it => it.index === index);
    if (idx === -1) return;

    this.state.items.splice(idx, 1);
    // Re-index remaining items
    for (let i = idx; i < this.state.items.length; i++) {
      this.state.items[i]!.index = i;
    }
    this.rebuildLayout();
    this.state.itemCount = this.state.items.length;
    this.emitter.emit("itemsChange", { items: this.state.items });
  }

  // --- Scroll tracking (HOT PATH) ---

  updateOffset(offset: number, timestamp: number): void {
    this.state.currentOffset = offset;
    this.state.isSettled = false;
    this.velocityTracker.push(offset, timestamp);

    // Update active index
    if (this.state.items.length > 0) {
      this.state.activeIndex = getIndexAtOffset(this.state.items, offset);
    }

    // Reuse pre-allocated payload — zero allocation
    this._offsetChangePayload.offset = offset;
    this.emitter.emit("offsetChange", this._offsetChangePayload);
  }

  // --- Decomposed snap methods (for middleware interception) ---

  computeVelocity(timestamp: number): number {
    this.assertNotDestroyed();
    const velocity = this.velocityTracker.compute(timestamp);
    this.velocityTracker.reset();
    this.state.velocity = velocity;
    return velocity;
  }

  applySnapResult(result: SnapResult): void {
    this.assertNotDestroyed();
    this.emitter.emit("snap", result);
  }

  // --- Snap resolution ---

  release(timestamp: number): SnapResult {
    this.assertNotDestroyed();
    const velocity = this.velocityTracker.compute(timestamp);
    this.state.velocity = velocity;

    const result = resolveSnap({
      items: this.state.items,
      currentIndex: this.state.activeIndex,
      currentOffset: this.state.currentOffset,
      velocity,
      velocityThreshold: this.config.velocityThreshold,
      multiSkipFactor: this.config.multiSkipFactor,
      maxSkipCount: this.config.maxSkipCount,
      alignment: this.config.snapPointAlignment,
      viewportSize: this.config.viewportSize
    });

    this.velocityTracker.reset();
    this.emitter.emit("snap", result);

    return result;
  }

  settle(index: number): void {
    this.state.activeIndex = index;
    this.state.isSettled = true;
    this.state.velocity = 0;
    this.emitter.emit("settle", { index });
  }

  snapTo(index: number): SnapResult {
    this.assertNotDestroyed();
    if (this.state.items.length === 0) {
      return { targetIndex: 0, targetOffset: 0, direction: 0, skippedCount: 0 };
    }

    const clampedIndex = Math.max(0, Math.min(index, this.state.items.length - 1));
    const targetOffset = getOffsetForIndex(
      this.state.items,
      clampedIndex,
      this.config.snapPointAlignment,
      this.config.viewportSize
    );

    const direction = clampedIndex > this.state.activeIndex ? 1 : clampedIndex < this.state.activeIndex ? -1 : 0;

    const result: SnapResult = {
      targetIndex: clampedIndex,
      targetOffset,
      direction: direction as -1 | 0 | 1,
      skippedCount: Math.abs(clampedIndex - this.state.activeIndex)
    };

    this.emitter.emit("snap", result);
    return result;
  }

  // --- State accessors ---

  getState(): Readonly<EngineState> {
    return this.state;
  }

  getActiveIndex(): number {
    return this.state.activeIndex;
  }

  getCurrentOffset(): number {
    return this.state.currentOffset;
  }

  getItems(): readonly SnapItem[] {
    return this.state.items;
  }

  // --- Events ---

  on<K extends keyof SnapEngineEventMap>(event: K, handler: (payload: SnapEngineEventMap[K]) => void): () => void {
    return this.emitter.on(event, handler);
  }

  off<K extends keyof SnapEngineEventMap>(event: K, handler: (payload: SnapEngineEventMap[K]) => void): void {
    this.emitter.off(event, handler);
  }

  // --- Configuration ---

  updateConfig(partial: Partial<SnapEngineConfig>): void {
    this.assertNotDestroyed();
    Object.assign(this.config, partial);
  }

  getConfig(): Readonly<SnapEngineConfig> {
    return this.config;
  }

  // --- Lifecycle ---

  destroy(): void {
    this.emitter.removeAll();
    this.velocityTracker.reset();
    this.destroyed = true;
  }

  // --- Internal ---

  private rebuildLayout(): void {
    const sizes = this.state.items.map(it => it.size);
    const rebuilt = calculateLayout(sizes);
    for (let i = 0; i < rebuilt.length; i++) {
      this.state.items[i]!.offset = rebuilt[i]!.offset;
    }
  }

  private assertNotDestroyed(): void {
    if (this.destroyed) {
      throw new Error("SnapEngine has been destroyed");
    }
  }
}
