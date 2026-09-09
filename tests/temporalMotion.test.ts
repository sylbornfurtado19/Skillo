/**
 * Unit Tests for Temporal Motion & Subject Presence Detection Engine
 * Unit 8 Coursework: Inter-frame temporal differencing, motion energy, and presence gating.
 */

import {
  computeFrameMotionEnergy,
  TemporalMotionDetector,
  fuseRestlessnessWithMotionEnergy,
  DEFAULT_MOTION_CONFIG,
} from '../src/lib/services/temporalMotion';

describe('Temporal Motion & Presence Engine', () => {
  const width = 10;
  const height = 10;
  const numPixels = width * height;

  function createTestFrame(grayValue: number): Uint8ClampedArray {
    const arr = new Uint8ClampedArray(numPixels * 4);
    for (let i = 0; i < numPixels; i++) {
      const idx = i * 4;
      arr[idx] = grayValue;     // R
      arr[idx + 1] = grayValue; // G
      arr[idx + 2] = grayValue; // B
      arr[idx + 3] = 255;       // A
    }
    return arr;
  }

  describe('computeFrameMotionEnergy (One-shot)', () => {
    it('returns zero energy for null previous frame', () => {
      const curr = createTestFrame(128);
      const res = computeFrameMotionEnergy(curr, null, width, height);
      expect(res.motionEnergy).toBe(0);
      expect(res.motionAreaRatio).toBe(0);
      expect(res.maxDiff).toBe(0);
    });

    it('returns zero energy for identical consecutive frames', () => {
      const f1 = createTestFrame(128);
      const f2 = createTestFrame(128);
      const res = computeFrameMotionEnergy(f1, f2, width, height);
      expect(res.motionEnergy).toBe(0);
      expect(res.motionAreaRatio).toBe(0);
      expect(res.maxDiff).toBe(0);
    });

    it('calculates correct scalar energy for uniform brightness shift', () => {
      const f1 = createTestFrame(100);
      const f2 = createTestFrame(120); // delta = 20
      const res = computeFrameMotionEnergy(f2, f1, width, height, 8);
      expect(res.motionEnergy).toBeCloseTo(20, 0);
      expect(res.motionAreaRatio).toBe(1.0);
      expect(res.maxDiff).toBe(20);
    });

    it('ignores sensor noise below threshold in motionAreaRatio', () => {
      const f1 = createTestFrame(100);
      const f2 = createTestFrame(104); // delta = 4 < noiseThreshold (8)
      const res = computeFrameMotionEnergy(f2, f1, width, height, 8);
      expect(res.motionEnergy).toBeCloseTo(4, 0);
      expect(res.motionAreaRatio).toBe(0.0);
    });
  });

  describe('TemporalMotionDetector (Stateful & Presence Gating)', () => {
    it('initializes cleanly on first frame with subject present', () => {
      const detector = new TemporalMotionDetector();
      const f1 = createTestFrame(120);
      const res = detector.processFrame(f1, width, height, 100);
      expect(res.isSubjectPresent).toBe(true);
      expect(res.motionEnergy).toBe(0);
      expect(res.isExcessiveMotion).toBe(false);
      expect(res.absentFrameCount).toBe(0);
    });

    it('detects normal micro-movements within stationary limits', () => {
      const detector = new TemporalMotionDetector();
      const f1 = createTestFrame(100);
      detector.processFrame(f1, width, height, 80);

      // Micro-movement: delta = 3
      const f2 = createTestFrame(103);
      const res = detector.processFrame(f2, width, height, 80);

      expect(res.isSubjectPresent).toBe(true);
      expect(res.isExcessiveMotion).toBe(false);
      expect(res.motionEnergy).toBeGreaterThanOrEqual(2);
      expect(res.motionEnergy).toBeLessThan(DEFAULT_MOTION_CONFIG.stationaryThreshold);
    });

    it('flags excessive motion when motion energy exceeds threshold', () => {
      const detector = new TemporalMotionDetector();
      const f1 = createTestFrame(50);
      detector.processFrame(f1, width, height, 120);

      // Large motion spike: delta = 25 > excessiveMotionThreshold (8.5)
      const f2 = createTestFrame(75);
      const res = detector.processFrame(f2, width, height, 120);

      expect(res.isSubjectPresent).toBe(true);
      expect(res.isExcessiveMotion).toBe(true);
      expect(res.motionEnergy).toBeGreaterThanOrEqual(8.5);
    });

    it('flags subject absence when skin pixels remain near-zero', () => {
      const detector = new TemporalMotionDetector({ absenceFrameLimit: 5 });
      const f = createTestFrame(100);

      // Feed frames with skin pixels = 0 (subject stepped away)
      let lastRes = detector.processFrame(f, width, height, 0);
      for (let i = 0; i < 6; i++) {
        lastRes = detector.processFrame(f, width, height, 0);
      }

      expect(lastRes.isSubjectPresent).toBe(false);
      expect(lastRes.absentFrameCount).toBeGreaterThanOrEqual(5);
    });

    it('recovers presence immediately when subject and skin pixels return', () => {
      const detector = new TemporalMotionDetector({ absenceFrameLimit: 3 });
      const f = createTestFrame(100);

      // Force absence
      for (let i = 0; i < 5; i++) {
        detector.processFrame(f, width, height, 0);
      }

      // Subject returns with skin pixels = 150 and movement
      const fActive = createTestFrame(115);
      const res = detector.processFrame(fActive, width, height, 150);

      expect(res.absentFrameCount).toBeLessThan(5);
    });
  });

  describe('fuseRestlessnessWithMotionEnergy', () => {
    it('produces expected composite score from angular and physical motion', () => {
      // Moderate angular restlessness (30) + moderate motion energy (4.0)
      const result = fuseRestlessnessWithMotionEnergy(30, 4.0);
      expect(result.compositeRestlessness).toBeGreaterThanOrEqual(0);
      expect(result.compositeRestlessness).toBeLessThanOrEqual(100);
      expect(result.motionContribution).toBeCloseTo(40, 0);
    });

    it('clamps composite restlessness strictly to [0, 100]', () => {
      const zero = fuseRestlessnessWithMotionEnergy(0, 0);
      expect(zero.compositeRestlessness).toBe(0);

      const max = fuseRestlessnessWithMotionEnergy(150, 20.0);
      expect(max.compositeRestlessness).toBe(100);
    });
  });
});
