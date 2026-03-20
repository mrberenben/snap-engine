interface Sample {
  offset: number;
  timestamp: number;
}

const BUFFER_CAPACITY = 10;
const MAX_SAMPLE_AGE_MS = 100;
const MIN_SAMPLES = 2;

export class VelocityTracker {
  private buffer: Sample[];
  private head = 0;
  private count = 0;

  constructor() {
    this.buffer = new Array<Sample>(BUFFER_CAPACITY);
    for (let i = 0; i < BUFFER_CAPACITY; i++) {
      this.buffer[i] = { offset: 0, timestamp: 0 };
    }
  }

  push(offset: number, timestamp: number): void {
    const sample = this.buffer[this.head]!;
    sample.offset = offset;
    sample.timestamp = timestamp;
    this.head = (this.head + 1) % BUFFER_CAPACITY;
    if (this.count < BUFFER_CAPACITY) {
      this.count++;
    }
  }

  compute(currentTimestamp: number): number {
    if (this.count < MIN_SAMPLES) return 0;

    // Walk backward from most recent sample, collect valid (non-stale) samples
    let newestIdx = (this.head - 1 + BUFFER_CAPACITY) % BUFFER_CAPACITY;
    let oldestValidIdx = newestIdx;
    let validCount = 0;

    for (let i = 0; i < this.count; i++) {
      const idx = (this.head - 1 - i + BUFFER_CAPACITY * 2) % BUFFER_CAPACITY;
      const sample = this.buffer[idx]!;
      if (currentTimestamp - sample.timestamp > MAX_SAMPLE_AGE_MS) {
        break;
      }
      oldestValidIdx = idx;
      validCount++;
    }

    if (validCount < MIN_SAMPLES) return 0;

    const newest = this.buffer[newestIdx]!;
    const oldest = this.buffer[oldestValidIdx]!;
    const dt = newest.timestamp - oldest.timestamp;

    if (dt === 0) return 0;

    return (newest.offset - oldest.offset) / dt;
  }

  reset(): void {
    this.head = 0;
    this.count = 0;
  }
}
