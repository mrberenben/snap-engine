export class EventEmitter<TEventMap extends { [K in keyof TEventMap]: unknown }> {
  private listeners = new Map<keyof TEventMap, Set<(payload: never) => void>>();

  on<K extends keyof TEventMap>(event: K, handler: (payload: TEventMap[K]) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    const fn = handler as (payload: never) => void;
    set.add(fn);
    return () => {
      set!.delete(fn);
    };
  }

  off<K extends keyof TEventMap>(event: K, handler: (payload: TEventMap[K]) => void): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(handler as (payload: never) => void);
    }
  }

  emit<K extends keyof TEventMap>(event: K, payload: TEventMap[K]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const handler of set) {
        (handler as (payload: TEventMap[K]) => void)(payload);
      }
    }
  }

  removeAll(): void {
    this.listeners.clear();
  }
}
