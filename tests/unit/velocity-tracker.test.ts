import { describe, it, expect } from "vitest";
import { VelocityTracker } from "~/core/algorithms/velocity-tracker";

describe("VelocityTracker", () => {
  it("computes positive velocity for forward scroll", () => {
    const tracker = new VelocityTracker();

    tracker.push(0, 0);
    tracker.push(100, 50);

    const v = tracker.compute(50);
    expect(v).toBe(2); // 100px / 50ms = 2 px/ms
  });

  it("computes negative velocity for backward scroll", () => {
    const tracker = new VelocityTracker();

    tracker.push(200, 0);
    tracker.push(100, 50);

    const v = tracker.compute(50);
    expect(v).toBe(-2); // -100px / 50ms
  });

  it("returns 0 with fewer than 2 samples", () => {
    const tracker = new VelocityTracker();

    expect(tracker.compute(100)).toBe(0);

    tracker.push(0, 0);
    expect(tracker.compute(0)).toBe(0);
  });

  it("discards samples older than 100ms", () => {
    const tracker = new VelocityTracker();

    // Old sample
    tracker.push(0, 0);
    // Recent samples
    tracker.push(500, 150);
    tracker.push(600, 200);

    // At timestamp 200, sample at t=0 is 200ms old (> 100ms) → discarded
    const v = tracker.compute(200);
    // Only samples at t=150 and t=200 remain: (600-500)/(200-150) = 2
    expect(v).toBe(2);
  });

  it("returns 0 if all samples are stale", () => {
    const tracker = new VelocityTracker();

    tracker.push(0, 0);
    tracker.push(100, 10);

    // At timestamp 500, both samples are >100ms old
    expect(tracker.compute(500)).toBe(0);
  });

  it("handles ring buffer wrapping", () => {
    const tracker = new VelocityTracker();

    // Push 12 samples (buffer capacity is 10, wraps around)
    for (let i = 0; i < 12; i++) {
      tracker.push(i * 10, i * 5);
    }

    // Most recent sample: offset=110, t=55
    // Velocity should still be computable
    const v = tracker.compute(55);
    expect(v).toBe(2); // 10px / 5ms
  });

  it("reset() clears state", () => {
    const tracker = new VelocityTracker();

    tracker.push(0, 0);
    tracker.push(100, 50);
    tracker.reset();

    expect(tracker.compute(50)).toBe(0);
  });

  it("returns 0 when dt is zero between samples", () => {
    const tracker = new VelocityTracker();

    tracker.push(0, 100);
    tracker.push(50, 100);

    expect(tracker.compute(100)).toBe(0);
  });
});
