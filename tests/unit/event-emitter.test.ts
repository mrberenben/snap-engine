import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "~/core/events/event-emitter";

interface TestEvents {
  foo: { value: number };
  bar: { message: string };
}

describe("EventEmitter", () => {
  it("calls handler on emit", () => {
    const emitter = new EventEmitter<TestEvents>();
    const handler = vi.fn();

    emitter.on("foo", handler);
    emitter.emit("foo", { value: 42 });

    expect(handler).toHaveBeenCalledWith({ value: 42 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("supports multiple handlers for same event", () => {
    const emitter = new EventEmitter<TestEvents>();
    const h1 = vi.fn();
    const h2 = vi.fn();

    emitter.on("foo", h1);
    emitter.on("foo", h2);
    emitter.emit("foo", { value: 1 });

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it("does not call handlers for other events", () => {
    const emitter = new EventEmitter<TestEvents>();
    const handler = vi.fn();

    emitter.on("foo", handler);
    emitter.emit("bar", { message: "hello" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("on() returns unsubscribe function", () => {
    const emitter = new EventEmitter<TestEvents>();
    const handler = vi.fn();

    const unsub = emitter.on("foo", handler);
    emitter.emit("foo", { value: 1 });
    expect(handler).toHaveBeenCalledTimes(1);

    unsub();
    emitter.emit("foo", { value: 2 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("off() removes a handler", () => {
    const emitter = new EventEmitter<TestEvents>();
    const handler = vi.fn();

    emitter.on("foo", handler);
    emitter.off("foo", handler);
    emitter.emit("foo", { value: 1 });

    expect(handler).not.toHaveBeenCalled();
  });

  it("removeAll() clears all handlers", () => {
    const emitter = new EventEmitter<TestEvents>();
    const h1 = vi.fn();
    const h2 = vi.fn();

    emitter.on("foo", h1);
    emitter.on("bar", h2);
    emitter.removeAll();

    emitter.emit("foo", { value: 1 });
    emitter.emit("bar", { message: "hello" });

    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it("prevents duplicate handlers from same reference", () => {
    const emitter = new EventEmitter<TestEvents>();
    const handler = vi.fn();

    emitter.on("foo", handler);
    emitter.on("foo", handler);
    emitter.emit("foo", { value: 1 });

    // Set deduplicates, so handler fires once
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("emitting event with no listeners is a no-op", () => {
    const emitter = new EventEmitter<TestEvents>();
    expect(() => emitter.emit("foo", { value: 1 })).not.toThrow();
  });

  it("off() on non-existent event is a no-op", () => {
    const emitter = new EventEmitter<TestEvents>();
    const handler = vi.fn();
    expect(() => emitter.off("foo", handler)).not.toThrow();
  });
});
