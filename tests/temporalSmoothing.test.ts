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
});
