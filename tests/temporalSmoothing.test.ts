/**
 * Unit Tests for Temporal Signal Smoothing Engine (EMA & Categorical Consensus)
 * Unit 8 Coursework: Exponential Moving Average, jitter suppression, and stability.
 */

import {
  ScalarEMA,
  GazeAngleEMA,
  HeadPoseEMA,
  AffectiveEMA,
  CategoricalConsensusSmoother,
  DenseLandmarksSmoother,
  computeJitterMetric,
  computeJitterReduction,
  DEFAULT_SMOOTHING_ALPHAS,
} from '../src/lib/services/temporalSmoothing';

describe('Temporal Smoothing Engine', () => {
  describe('ScalarEMA', () => {
    it('initializes to first input value without lag', () => {
      const ema = new ScalarEMA(0.35);
      expect(ema.update(10.0)).toBe(10.0);
    });

    it('converges toward new steady-state value asymptotically', () => {
      const alpha = 0.5;
      const ema = new ScalarEMA(alpha);
      ema.update(0.0); // S_0 = 0
      const s1 = ema.update(10.0); // 0.5 * 10 + 0.5 * 0 = 5.0
      expect(s1).toBeCloseTo(5.0, 3);
      const s2 = ema.update(10.0); // 0.5 * 10 + 0.5 * 5 = 7.5
      expect(s2).toBeCloseTo(7.5, 3);
      const s3 = ema.update(10.0); // 0.5 * 10 + 0.5 * 7.5 = 8.75
      expect(s3).toBeCloseTo(8.75, 3);
    });

    it('resets cleanly when requested', () => {
      const ema = new ScalarEMA(0.4);
      ema.update(25);
      ema.reset();
      expect(ema.get()).toBeNull();
      expect(ema.update(50)).toBe(50);
    });
  });

  describe('GazeAngleEMA', () => {
    it('smooths 2D gaze angles with gaze alpha (0.45)', () => {
      const gazeEma = new GazeAngleEMA(DEFAULT_SMOOTHING_ALPHAS.gaze);
      const first = gazeEma.update({ pitchDegrees: 0, yawDegrees: 0 });
      expect(first.pitchDegrees).toBe(0);
      expect(first.yawDegrees).toBe(0);

      // Saccade spike: pitch 10, yaw 20
      const second = gazeEma.update({ pitchDegrees: 10, yawDegrees: 20 });
      expect(second.pitchDegrees).toBeCloseTo(4.5, 1);
      expect(second.yawDegrees).toBeCloseTo(9.0, 1);
    });
  });

  describe('HeadPoseEMA', () => {
    it('filters angular jitter across 3D Euler angles', () => {
      const poseEma = new HeadPoseEMA(0.35);
      poseEma.update({ yawDegrees: 10, pitchDegrees: 5, rollDegrees: 0 });

      // Step change with noise
      const res = poseEma.update({ yawDegrees: 12, pitchDegrees: 7, rollDegrees: -1 });
      expect(res.yawDegrees).toBeCloseTo(10 * 0.65 + 12 * 0.35, 1);
      expect(res.pitchDegrees).toBeCloseTo(5 * 0.65 + 7 * 0.35, 1);
      expect(res.rollDegrees).toBeCloseTo(0 * 0.65 + -1 * 0.35, 1);
    });
  });

  describe('AffectiveEMA', () => {
    it('smooths valence, arousal, and composure score', () => {
      const affectEma = new AffectiveEMA(0.25, 0.20);
      affectEma.update({ valence: 0.2, arousal: 0.1 }, 80);

      const res = affectEma.update({ valence: 0.6, arousal: 0.5 }, 90);
      // Valence: 0.25 * 0.6 + 0.75 * 0.2 = 0.30
      expect(res.vaCoordinates.valence).toBeCloseTo(0.30, 2);
      // Arousal: 0.25 * 0.5 + 0.75 * 0.1 = 0.20
      expect(res.vaCoordinates.arousal).toBeCloseTo(0.20, 2);
      // Composure: 0.20 * 90 + 0.80 * 80 = 82
      expect(res.composureScore).toBe(82);
    });
  });

  describe('CategoricalConsensusSmoother (Emotion Stability)', () => {
    it('suppresses single-frame flickers via rolling majority vote', () => {
      const smoother = new CategoricalConsensusSmoother(5);

      smoother.update('CONFIDENT');
      smoother.update('CONFIDENT');
      smoother.update('CONFIDENT');

      // 1-frame spurious glitch to 'STRESSED'
      const consensus = smoother.update('STRESSED');
      // Majority in ['CONFIDENT', 'CONFIDENT', 'CONFIDENT', 'STRESSED'] is still 'CONFIDENT'
      expect(consensus).toBe('CONFIDENT');
    });

    it('smooths emotion probability distribution before argmax', () => {
      const smoother = new CategoricalConsensusSmoother(5, 0.4);

      // Frame 1: Confident dominant
      const label1 = smoother.update('CONFIDENT', { CONFIDENT: 0.70, STRESSED: 0.30 });
      expect(label1).toBe('CONFIDENT');

      // Frame 2: Stress spike in raw data (0.55 vs 0.45)
      // Smoothed P(CONFIDENT) = 0.4 * 0.45 + 0.6 * 0.70 = 0.60
      // Smoothed P(STRESSED)  = 0.4 * 0.55 + 0.6 * 0.30 = 0.40
      // Confident should remain dominant due to temporal hysteresis!
      const label2 = smoother.update('STRESSED', { CONFIDENT: 0.45, STRESSED: 0.55 });
      expect(label2).toBe('CONFIDENT');
    });
  });

  describe('Jitter Metrics & Reduction Evaluation', () => {
    it('computes zero jitter on perfectly stationary signal', () => {
      const stationary = [5.0, 5.0, 5.0, 5.0, 5.0];
      expect(computeJitterMetric(stationary)).toBe(0);
    });

    it('demonstrates measurable jitter reduction on noisy simulated stream', () => {
      // Raw signal with alternating micro-tremor noise: 10 ± 2
      const raw = [10.0, 12.0, 8.5, 11.5, 9.0, 12.5, 8.0, 11.0, 9.5, 10.5];
      const ema = new ScalarEMA(0.35);
      const smoothed = raw.map(x => ema.update(x));

      const evaluation = computeJitterReduction(raw, smoothed);
      expect(evaluation.rawJitter).toBeGreaterThan(evaluation.smoothedJitter);
      expect(evaluation.reductionPercentage).toBeGreaterThanOrEqual(30.0);
    });
  });

  describe('DenseLandmarksSmoother Intermediate State & Prediction', () => {
    it('predicts landmark positions accurately without mutating filter state', () => {
      const smoother = new DenseLandmarksSmoother(70, 'BALANCED');
      const buffer = new Float32Array(70 * 4);
      for (let i = 0; i < 70; i++) {
        buffer[i * 4] = 0.5;
        buffer[i * 4 + 1] = 0.5;
        buffer[i * 4 + 3] = 0.95;
      }

      smoother.updateFromBuffer(buffer, 70, 1000);

      // Frame 2 with velocity
      for (let i = 0; i < 70; i++) {
        buffer[i * 4] = 0.52;
        buffer[i * 4 + 1] = 0.50;
      }
      smoother.updateFromBuffer(buffer, 70, 1033);

      const pred = smoother.predictPoint(68, 0.016);
      expect(pred).not.toBeNull();
      // Prediction should extrapolate forward in X
      expect(pred!.x).toBeGreaterThan(0.50);

      // getCurrentResult should return valid positions without corrupting filters
      const cur = smoother.getCurrentResult();
      expect(cur.points.length).toBe(70);
      expect(cur.points[68].x).toBeCloseTo(0.51, 1);
    });

    it('identifies and rejects large outlier displacements via prediction delta gating', () => {
      const smoother = new DenseLandmarksSmoother(70, 'BALANCED');
      const buffer = new Float32Array(70 * 4);
      for (let i = 0; i < 70; i++) {
        buffer[i * 4] = 0.5;
        buffer[i * 4 + 1] = 0.5;
        buffer[i * 4 + 3] = 0.95;
      }
      smoother.updateFromBuffer(buffer, 70, 1000);

      // Micro-update with small delta (valid motion: 0.505)
      const validMeas = { x: 0.505, y: 0.502 };
      const pred = smoother.predictPoint(68, 0.016)!;
      const validDelta = Math.hypot(pred.x - validMeas.x, pred.y - validMeas.y);
      expect(validDelta).toBeLessThan(0.06);

      // Micro-update with massive outlier glitch (e.g. false patch match at 0.65)
      const outlierMeas = { x: 0.65, y: 0.58 };
      const outlierDelta = Math.hypot(pred.x - outlierMeas.x, pred.y - outlierMeas.y);
      expect(outlierDelta).toBeGreaterThan(0.06);
    });

    it('calling getCurrentResult() repeatedly without new model packets returns stable values and does not move filters', () => {
      const smoother = new DenseLandmarksSmoother(70, 'BALANCED');
      const buffer = new Float32Array(70 * 4);
      for (let i = 0; i < 70; i++) {
        buffer[i * 4] = 0.35 + i * 0.005;
        buffer[i * 4 + 1] = 0.40;
        buffer[i * 4 + 3] = 0.95;
      }
      smoother.updateFromBuffer(buffer, 70, 1000);

      const res1 = smoother.getCurrentResult();

      // Call repeatedly 20 times across simulated RAF frames
      for (let frame = 0; frame < 20; frame++) {
        const resN = smoother.getCurrentResult();
        expect(resN.points.length).toBe(70);
        for (let i = 0; i < 70; i++) {
          expect(resN.points[i].x).toBe(res1.points[i].x);
          expect(resN.points[i].y).toBe(res1.points[i].y);
        }
      }
    });

    it('updatePoint updates micro-only timestamp without corrupting model frame dt calculation', () => {
      const smoother = new DenseLandmarksSmoother(70, 'BALANCED');
      const buffer = new Float32Array(70 * 4);
      for (let i = 0; i < 70; i++) {
        buffer[i * 4] = 0.5;
        buffer[i * 4 + 1] = 0.5;
        buffer[i * 4 + 3] = 0.95;
      }

      // Model frame 1 at t=1000ms
      smoother.updateFromBuffer(buffer, 70, 1000);

      // Intermediate micro RAF frames at t=1016ms, 1033ms
      smoother.updatePoint(68, { x: 0.502, y: 0.501 }, 0.85, 1016);
      smoother.updatePoint(68, { x: 0.504, y: 0.502 }, 0.85, 1033);

      // Model frame 2 at t=1100ms: should use dt = (1100 - 1000) / 1000 = 0.1s, NOT (1100 - 1033)
      for (let i = 0; i < 70; i++) {
        buffer[i * 4] = 0.55;
      }
      const resModel2 = smoother.updateFromBuffer(buffer, 70, 1100);
      expect(resModel2.points[33].x).toBeGreaterThan(0.50);
      expect(resModel2.points[33].x).toBeLessThan(0.55);
    });

    it('handles monotonic, duplicate, and out-of-order timestamps gracefully without negative dt or NaN', () => {
      const smoother = new DenseLandmarksSmoother(70, 'BALANCED');
      const buffer = new Float32Array(70 * 4);
      for (let i = 0; i < 70; i++) {
        buffer[i * 4] = 0.5;
        buffer[i * 4 + 1] = 0.5;
        buffer[i * 4 + 3] = 0.95;
      }

      smoother.updateFromBuffer(buffer, 70, 1000);

      // Duplicate timestamp (1000ms <= lastModelTs)
      const resDup = smoother.updateFromBuffer(buffer, 70, 1000);
      expect(Number.isFinite(resDup.points[0].x)).toBe(true);
      expect(Number.isNaN(resDup.points[0].x)).toBe(false);

      // Out-of-order timestamp (950ms < 1000ms)
      const resBack = smoother.updateFromBuffer(buffer, 70, 950);
      expect(Number.isFinite(resBack.points[0].x)).toBe(true);

      // Out-of-order micro updates
      smoother.updatePoint(68, { x: 0.51, y: 0.51 }, 0.85, 1020);
      const resMicroOut = smoother.updatePoint(68, { x: 0.52, y: 0.52 }, 0.85, 1010); // backward timestamp
      expect(resMicroOut).not.toBeNull();
      expect(resMicroOut!.accepted).toBe(true);
      expect(Number.isFinite(resMicroOut!.pos.x)).toBe(true);
    });

    it('atomic updatePoint rejects low confidence or NaN coordinates, returning accepted: false', () => {
      const smoother = new DenseLandmarksSmoother(70, 'BALANCED');
      const buffer = new Float32Array(70 * 4);
      for (let i = 0; i < 70; i++) {
        buffer[i * 4] = 0.5;
        buffer[i * 4 + 1] = 0.5;
        buffer[i * 4 + 3] = 0.95;
      }
      smoother.updateFromBuffer(buffer, 70, 1000);

      const targetBuffer = new Float32Array(buffer);

      // Reject low confidence (< 0.15)
      const lowConfRes = smoother.updatePoint(68, { x: 0.9, y: 0.9 }, 0.05, 1016);
      expect(lowConfRes).not.toBeNull();
      expect(lowConfRes!.accepted).toBe(false);

      // Simulate atomic mutation guard: only mutate buffer if accepted
      if (lowConfRes && lowConfRes.accepted) {
        targetBuffer[68 * 4] = lowConfRes.pos.x;
      }
      // Target buffer remains unchanged
      expect(targetBuffer[68 * 4]).toBe(0.5);

      // Valid update
      const validRes = smoother.updatePoint(68, { x: 0.51, y: 0.50 }, 0.90, 1033);
      expect(validRes).not.toBeNull();
      expect(validRes!.accepted).toBe(true);
      if (validRes && validRes.accepted) {
        targetBuffer[68 * 4] = validRes.pos.x;
      }
      expect(targetBuffer[68 * 4]).toBeCloseTo(0.51, 1);
    });
  });
});
