/**
 * tests/boundedTelemetryBuffer.test.ts
 *
 * ISSUE-07: Unbounded client telemetry buffers verification.
 *
 * Tests:
 * 1. RingBuffer fixed-capacity ring buffer mechanics.
 * 2. BoundedTelemetryBuffer per-question slots capped at 200 frames via stride downsampling.
 * 3. 36,000 pushes at 10 Hz across 8 questions:
 *    - total retained <= 2000
 *    - per-question <= 200
 *    - temporal order strictly preserved
 *    - first/last frames preserved
 *    - retry-scoped fetch isolated
 * 4. Global hard ceiling 2000: downsamples oldest completed questions first.
 * 5. Eye-contact % computed from downsampled data matches full data within tolerance.
 * 6. Regression checks: ISSUE-09 filterQuestionId, server limits (<=20,000 frames) and Zod schema.
 */

import { RingBuffer, BoundedTelemetryBuffer } from '../src/lib/utils/telemetryBuffer';
import { DEFAULT_MAX_SYNC_WINDOWS } from '../src/components/ui/IVPSyncTracker';
import type { GazeFrameInput, HeadPoseFrameInput, AffectFrameInput, SyncWindowInput } from '../src/types/index';
import { z } from 'zod';

describe('ISSUE-07: RingBuffer (IVPSyncTracker)', () => {
  it('stores frames up to capacity in FIFO order', () => {
    const rb = new RingBuffer<number>(5);
    rb.push(1);
    rb.push(2);
    rb.push(3);
    expect(rb.length).toBe(3);
    expect(rb.toArray()).toEqual([1, 2, 3]);
  });

  it('overwrites the oldest frame once capacity is reached', () => {
    const rb = new RingBuffer<string>(3);
    rb.push('a');
    rb.push('b');
    rb.push('c');
    expect(rb.toArray()).toEqual(['a', 'b', 'c']);

    rb.push('d');
    expect(rb.length).toBe(3);
    expect(rb.toArray()).toEqual(['b', 'c', 'd']);

    rb.push('e');
    expect(rb.toArray()).toEqual(['c', 'd', 'e']);
  });

  it('supports clear() and resets internal state', () => {
    const rb = new RingBuffer<number>(4);
    rb.push(10);
    rb.push(20);
    rb.clear();
    expect(rb.length).toBe(0);
    expect(rb.toArray()).toEqual([]);

    rb.push(30);
    expect(rb.toArray()).toEqual([30]);
  });

  it('is iterable via Symbol.iterator', () => {
    const rb = new RingBuffer<number>(3);
    rb.push(1);
    rb.push(2);
    rb.push(3);
    rb.push(4); // [2, 3, 4]
    const elements: number[] = [];
    for (const item of rb) {
      elements.push(item);
    }
    expect(elements).toEqual([2, 3, 4]);
  });

  it('validates capacity constructor parameter', () => {
    expect(() => new RingBuffer(0)).toThrow();
    expect(() => new RingBuffer(-5)).toThrow();
    expect(() => new RingBuffer(NaN)).toThrow();
  });

  it('DEFAULT_MAX_SYNC_WINDOWS constant is bounded and reasonable', () => {
    expect(DEFAULT_MAX_SYNC_WINDOWS).toBeGreaterThanOrEqual(500);
    expect(DEFAULT_MAX_SYNC_WINDOWS).toBeLessThanOrEqual(2000);
  });
});

describe('ISSUE-07: BoundedTelemetryBuffer', () => {
  it('organizes frames in per-question slots: Map<questionId, Frame[]>', () => {
    const buffer = new BoundedTelemetryBuffer<GazeFrameInput>({ maxPerQuestion: 200, maxTotal: 2000 });
    buffer.push({ timestampMs: 100, pitchDegrees: 0, yawDegrees: 0, questionId: 'q_1' });
    buffer.push({ timestampMs: 200, pitchDegrees: 0, yawDegrees: 0, questionId: 'q_2' });

    expect(buffer.slots).toBeInstanceOf(Map);
    expect(buffer.slots.has('q_1')).toBe(true);
    expect(buffer.slots.has('q_2')).toBe(true);
    expect(buffer.slots.get('q_1')).toHaveLength(1);
    expect(buffer.slots.get('q_2')).toHaveLength(1);
  });

  it('preserves small inputs under 200 frames without modification', () => {
    const buffer = new BoundedTelemetryBuffer<GazeFrameInput>({ maxPerQuestion: 200, maxTotal: 2000 });
    for (let i = 0; i < 50; i++) {
      buffer.push({
        timestampMs: i * 100,
        pitchDegrees: 1,
        yawDegrees: 2,
        questionId: 'q_small',
      });
    }
    const frames = buffer.getFrames('q_small');
    expect(frames).toHaveLength(50);
    expect(frames[0].timestampMs).toBe(0);
    expect(frames[49].timestampMs).toBe(4900);
  });

  it('caps question at 200 frames via stride-based downsampling when exceeded', () => {
    const buffer = new BoundedTelemetryBuffer<GazeFrameInput>({ maxPerQuestion: 200, maxTotal: 2000 });
    // Push 500 frames for a single question
    for (let i = 0; i < 500; i++) {
      buffer.push({
        timestampMs: i * 100,
        pitchDegrees: 0,
        yawDegrees: 0,
        questionId: 'q_overflow',
      });
    }

    const slot = buffer.slots.get('q_overflow');
    expect(slot).toBeDefined();
    expect(slot!.length).toBeLessThanOrEqual(200);

    const materialized = buffer.getFrames('q_overflow');
    expect(materialized.length).toBeLessThanOrEqual(200);
    // Must keep first and last frames
    expect(materialized[0].timestampMs).toBe(0);
    expect(materialized[materialized.length - 1].timestampMs).toBe(49900);

    // Strictly monotonic timestamps
    for (let j = 1; j < materialized.length; j++) {
      expect(materialized[j].timestampMs).toBeGreaterThan(materialized[j - 1].timestampMs);
    }
  });

  it('enforces global hard ceiling 2000 by downsampling oldest completed questions first', () => {
    const buffer = new BoundedTelemetryBuffer<GazeFrameInput>({ maxPerQuestion: 200, maxTotal: 2000 });

    // Push 20 questions with 800 frames each (20 * 200 = 4,000 potential frames > 2,000)
    for (let q = 0; q < 20; q++) {
      const qId = `q_${q}`;
      buffer.setActiveQuestion(qId);
      for (let i = 0; i < 800; i++) {
        buffer.push({
          timestampMs: (q * 800 + i) * 100,
          pitchDegrees: 0,
          yawDegrees: 0,
          questionId: qId,
        });
      }
    }

    const allFrames = buffer.getFrames();
    expect(allFrames.length).toBeLessThanOrEqual(2000);

    // Oldest completed question (q_0) must have been downsampled before newer questions
    const q0Frames = buffer.getFrames('q_0');
    const q19Frames = buffer.getFrames('q_19'); // currently active question
    expect(q0Frames.length).toBeLessThan(q19Frames.length);

    // Every question must retain its first and last frames
    for (let q = 0; q < 20; q++) {
      const qFrames = buffer.getFrames(`q_${q}`);
      expect(qFrames.length).toBeGreaterThanOrEqual(2);
      expect(qFrames[0].timestampMs).toBe(q * 800 * 100);
      expect(qFrames[qFrames.length - 1].timestampMs).toBe((q * 800 + 799) * 100);
    }
  });

  describe('Simulation: 36,000 pushes at 10 Hz across 8 questions', () => {
    it('satisfies total <= 2000, per-question <= 200, order preserved, and retry-scoped fetch', () => {
      const buffer = new BoundedTelemetryBuffer<GazeFrameInput>({ maxPerQuestion: 200, maxTotal: 2000 });
      const NUM_QUESTIONS = 8;
      const TOTAL_PUSHES = 36000;
      const PUSHES_PER_QUESTION = TOTAL_PUSHES / NUM_QUESTIONS; // 4500 pushes = 450s = 7.5 min per question

      for (let q = 0; q < NUM_QUESTIONS; q++) {
        const qId = `question_${q}`;
        buffer.setActiveQuestion(qId);

        for (let i = 0; i < PUSHES_PER_QUESTION; i++) {
          const timestampMs = (q * PUSHES_PER_QUESTION + i) * 100;
          buffer.push({
            timestampMs,
            pitchDegrees: 2.5,
            yawDegrees: 1.0,
            confidence: 0.92,
            questionId: qId,
            questionIndex: q,
          });
        }
      }

      // 1. Total retained frames <= 2000
      const allFrames = buffer.getFrames();
      expect(allFrames.length).toBeLessThanOrEqual(2000);

      // 2. Per-question frames <= 200
      for (let q = 0; q < NUM_QUESTIONS; q++) {
        const qId = `question_${q}`;
        const qFrames = buffer.getFrames(qId);
        expect(qFrames.length).toBeLessThanOrEqual(200);
        expect(qFrames.length).toBeGreaterThan(0);

        // First and last timestamps preserved
        const expectedFirst = q * PUSHES_PER_QUESTION * 100;
        const expectedLast = (q * PUSHES_PER_QUESTION + PUSHES_PER_QUESTION - 1) * 100;
        expect(qFrames[0].timestampMs).toBe(expectedFirst);
        expect(qFrames[qFrames.length - 1].timestampMs).toBe(expectedLast);

        // Per-question order preserved
        for (let j = 1; j < qFrames.length; j++) {
          expect(qFrames[j].timestampMs).toBeGreaterThan(qFrames[j - 1].timestampMs);
        }
      }

      // 3. Global temporal order preserved
      for (let i = 1; i < allFrames.length; i++) {
        expect(allFrames[i].timestampMs).toBeGreaterThan(allFrames[i - 1].timestampMs);
      }

      // 4. Retry-scoped fetch correct
      const retryTelemetry = buffer.getFrames('question_2');
      expect(retryTelemetry.length).toBeGreaterThan(0);
      expect(retryTelemetry.every((f) => f.questionId === 'question_2')).toBe(true);
      expect(retryTelemetry.some((f) => f.questionId === 'question_1')).toBe(false);
      expect(retryTelemetry.some((f) => f.questionId === 'question_3')).toBe(false);
    });
  });

  describe('Eye-contact accuracy on downsampled data', () => {
    it('retains eye-contact % matching full uncompressed data within tolerance', () => {
      const buffer = new BoundedTelemetryBuffer<GazeFrameInput & { isEyeContact: boolean }>({
        maxPerQuestion: 200,
        maxTotal: 2000,
      });

      const TOTAL_FRAMES = 4500;
      let fullEyeContactCount = 0;

      // Simulate a question where user makes eye contact 62% of the time
      for (let i = 0; i < TOTAL_FRAMES; i++) {
        // Pseudo-random but deterministic pattern: 62% true
        const isEyeContact = (i * 13) % 100 < 62;
        if (isEyeContact) fullEyeContactCount++;

        buffer.push({
          timestampMs: i * 100,
          pitchDegrees: isEyeContact ? 3 : 25,
          yawDegrees: isEyeContact ? 2 : 20,
          isEyeContact,
          questionId: 'q_eye_contact',
        });
      }

      const fullEyeContactPct = (fullEyeContactCount / TOTAL_FRAMES) * 100;
      const downsampledFrames = buffer.getFrames('q_eye_contact');
      expect(downsampledFrames.length).toBeLessThanOrEqual(200);

      const downsampledEyeCount = downsampledFrames.filter((f) => f.isEyeContact).length;
      const downsampledEyeContactPct = (downsampledEyeCount / downsampledFrames.length) * 100;

      const tolerancePct = 3.0; // Within 3 percentage points of full dataset
      const diff = Math.abs(fullEyeContactPct - downsampledEyeContactPct);
      expect(diff).toBeLessThan(tolerancePct);
    });
  });

  describe('Regression Checks', () => {
    it('ISSUE-09 filterQuestionId scoping works identically to array filter', () => {
      const buffer = new BoundedTelemetryBuffer<GazeFrameInput>({ maxPerQuestion: 200, maxTotal: 2000 });
      buffer.push({ timestampMs: 100, pitchDegrees: 0, yawDegrees: 0, questionId: 'q_1' });
      buffer.push({ timestampMs: 200, pitchDegrees: 0, yawDegrees: 0, questionId: 'q_2' });
      buffer.push({ timestampMs: 300, pitchDegrees: 0, yawDegrees: 0, questionId: 'q_2' });

      const filtered = buffer.getFrames('q_2');
      expect(filtered).toHaveLength(2);
      expect(filtered.every((f) => f.questionId === 'q_2')).toBe(true);

      const nonExistent = buffer.getFrames('q_unknown');
      expect(nonExistent).toEqual([]);
    });

    it('satisfies server limit (<=20,000 frames) and evaluate Zod schema', () => {
      const buffer = new BoundedTelemetryBuffer<GazeFrameInput>({ maxPerQuestion: 200, maxTotal: 2000 });
      for (let i = 0; i < 5000; i++) {
        buffer.push({
          timestampMs: i * 100,
          pitchDegrees: 0,
          yawDegrees: 0,
          questionId: `q_${i % 10}`,
        });
      }

      const frames = buffer.getFrames();
      // Server MAX_TELEMETRY_INPUT = 20,000
      expect(frames.length).toBeLessThanOrEqual(20000);
      expect(frames.length).toBeLessThanOrEqual(2000);

      // Verify Zod schema acceptance
      const gazeSchema = z.object({
        timestampMs: z.number().finite().nonnegative(),
        pitchDegrees: z.number().finite(),
        yawDegrees: z.number().finite(),
        questionId: z.string().optional(),
      });
      const telemetryArraySchema = z.array(gazeSchema).max(20000);
      const parseResult = telemetryArraySchema.safeParse(frames);
      expect(parseResult.success).toBe(true);
    });

    it('clear() and clearQuestion() work properly', () => {
      const buffer = new BoundedTelemetryBuffer<GazeFrameInput>({ maxPerQuestion: 200, maxTotal: 2000 });
      buffer.push({ timestampMs: 100, pitchDegrees: 0, yawDegrees: 0, questionId: 'q_1' });
      buffer.push({ timestampMs: 200, pitchDegrees: 0, yawDegrees: 0, questionId: 'q_2' });

      buffer.clearQuestion('q_1');
      expect(buffer.getFrames('q_1')).toHaveLength(0);
      expect(buffer.getFrames('q_2')).toHaveLength(1);

      buffer.clear();
      expect(buffer.getFrames()).toHaveLength(0);
      expect(buffer.slots.size).toBe(0);
    });
  });
});
