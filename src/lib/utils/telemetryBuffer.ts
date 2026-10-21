/**
 * telemetryBuffer.ts
 *
 * ISSUE-07: Bounded client telemetry buffers.
 *
 * Prevents unbounded memory growth in long-running interview sessions by:
 * 1. RingBuffer<T>: Fixed-capacity circular buffer that drops the oldest frames
 *    when capacity is exceeded, preserving FIFO order. Used by IVPSyncTracker.
 * 2. BoundedTelemetryBuffer<T>: Per-question slot buffer capped at 200 frames via
 *    uniform stride-based downsampling when exceeded (retaining first & last frames,
 *    strictly preserving temporal order). Enforces a global ceiling of 2000 frames
 *    total by downsampling the oldest completed questions first.
 */

import { downsampleEvenly } from './downsample';

/**
 * RingBuffer
 *
 * A memory-bounded circular buffer with a fixed maximum capacity.
 * When full, new elements overwrite the oldest entries in O(1) time.
 */
export class RingBuffer<T> {
  private buffer: Array<T | undefined>;
  private capacity: number;
  private head: number = 0; // index of oldest element
  private count: number = 0; // current count of stored elements

  constructor(capacity: number) {
    const cap = Math.floor(capacity);
    if (!Number.isFinite(cap) || cap <= 0) {
      throw new Error(`RingBuffer capacity must be a positive integer, received: ${capacity}`);
    }
    this.capacity = cap;
    this.buffer = new Array<T | undefined>(cap);
  }

  push(item: T): void {
    if (this.count < this.capacity) {
      const idx = (this.head + this.count) % this.capacity;
      this.buffer[idx] = item;
      this.count++;
    } else {
      // Overwrite oldest item at head and advance head
      this.buffer[this.head] = item;
      this.head = (this.head + 1) % this.capacity;
    }
  }

  toArray(): T[] {
    const result: T[] = new Array(this.count);
    for (let i = 0; i < this.count; i++) {
      result[i] = this.buffer[(this.head + i) % this.capacity] as T;
    }
    return result;
  }

  clear(): void {
    this.buffer = new Array<T | undefined>(this.capacity);
    this.head = 0;
    this.count = 0;
  }

  get length(): number {
    return this.count;
  }

  get maxCapacity(): number {
    return this.capacity;
  }

  *[Symbol.iterator](): Iterator<T> {
    for (let i = 0; i < this.count; i++) {
      yield this.buffer[(this.head + i) % this.capacity] as T;
    }
  }
}

export interface BoundedTelemetryBufferOptions {
  maxPerQuestion?: number;
  maxTotal?: number;
}

interface QuestionSlotMeta<T> {
  sampled: T[];
  stride: number;
  incoming: number;
  lastFrame: T | null;
}

/**
 * BoundedTelemetryBuffer
 *
 * Manages client telemetry across multiple interview questions.
 * - Slots: Map<questionId, Frame[]>.
 * - Per-question cap: defaults to 200 frames via stride-based downsampling.
 * - Global hard ceiling: defaults to 2000 frames total; downsamples oldest
 *   completed questions first when exceeded.
 * - Maintains temporal order and keeps first/last elements intact.
 */
export class BoundedTelemetryBuffer<T extends { timestampMs: number; questionId?: string }> {
  public readonly maxPerQuestion: number;
  public readonly maxTotal: number;

  /** Per-question slots matching the design specification: Map<questionId, Frame[]> */
  public slots: Map<string, T[]> = new Map();

  private slotMeta: Map<string, QuestionSlotMeta<T>> = new Map();
  private questionOrder: string[] = [];
  private activeQuestionId: string | undefined = undefined;

  constructor(options: BoundedTelemetryBufferOptions = {}) {
    this.maxPerQuestion = options.maxPerQuestion ?? 200;
    this.maxTotal = options.maxTotal ?? 2000;
  }

  setActiveQuestion(questionId?: string): void {
    this.activeQuestionId = questionId;
  }

  push(frame: T, currentQuestionId?: string): void {
    const qId = frame.questionId ?? currentQuestionId ?? this.activeQuestionId ?? '';
    let meta = this.slotMeta.get(qId);

    if (!meta) {
      meta = { sampled: [], stride: 1, incoming: 0, lastFrame: null };
      this.slotMeta.set(qId, meta);
      if (!this.questionOrder.includes(qId)) {
        this.questionOrder.push(qId);
      }
    }

    meta.lastFrame = frame;
    meta.incoming++;

    if (meta.incoming === 1 || meta.incoming % meta.stride === 0) {
      meta.sampled.push(frame);
      if (meta.sampled.length > this.maxPerQuestion) {
        meta.stride *= 2;
        meta.sampled = downsampleEvenly(meta.sampled, Math.floor(this.maxPerQuestion / 2));
      }
    }

    // Materialize into public slots map
    this.slots.set(qId, this.buildSlotArray(qId));
    this.enforceGlobalCeiling(qId);
  }

  private buildSlotArray(qId: string): T[] {
    const meta = this.slotMeta.get(qId);
    if (!meta || meta.sampled.length === 0) return [];
    const result = [...meta.sampled];
    if (meta.lastFrame && result[result.length - 1] !== meta.lastFrame) {
      if (result.length < this.maxPerQuestion) {
        result.push(meta.lastFrame);
      } else {
        result[result.length - 1] = meta.lastFrame;
      }
    }
    return result;
  }

  private enforceGlobalCeiling(activeQId: string): void {
    let total = this.getTotalCount();
    if (total <= this.maxTotal) return;

    // Completed questions are those in questionOrder that are NOT the active question
    const completed = this.questionOrder.filter((id) => id !== activeQId && this.slotMeta.has(id));

    let changed = true;
    while (total > this.maxTotal && changed) {
      changed = false;
      for (const qId of completed) {
        const meta = this.slotMeta.get(qId);
        if (meta && meta.sampled.length > 2) {
          const currentSlot = this.slots.get(qId) ?? meta.sampled;
          const target = Math.max(2, Math.floor(currentSlot.length / 2));
          const downsampled = downsampleEvenly(currentSlot, target);
          meta.sampled = downsampled;
          meta.lastFrame = downsampled[downsampled.length - 1];
          this.slots.set(qId, [...downsampled]);
          total = this.getTotalCount();
          changed = true;
          if (total <= this.maxTotal) break;
        }
      }
    }
  }

  getTotalCount(): number {
    let sum = 0;
    for (const frames of this.slots.values()) {
      sum += frames.length;
    }
    return sum;
  }

  getFrames(filterQuestionId?: string): T[] {
    if (filterQuestionId !== undefined) {
      return [...(this.slots.get(filterQuestionId) ?? [])];
    }
    const all: T[] = [];
    for (const frames of this.slots.values()) {
      all.push(...frames);
    }
    return all.sort((a, b) => a.timestampMs - b.timestampMs);
  }

  getQuestionFrames(questionId: string): T[] {
    return this.getFrames(questionId);
  }

  clear(): void {
    this.slots.clear();
    this.slotMeta.clear();
    this.questionOrder = [];
  }

  clearQuestion(questionId: string): void {
    this.slots.delete(questionId);
    this.slotMeta.delete(questionId);
    this.questionOrder = this.questionOrder.filter((id) => id !== questionId);
  }
}
