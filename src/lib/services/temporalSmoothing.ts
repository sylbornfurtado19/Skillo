/**
 * Temporal Signal Smoothing Engine (Exponential Moving Average & Categorical Consensus)
 * Unit 8 Coursework: Signal conditioning, anti-jitter filtering & temporal coherence.
 *
 * Implements:
 * 1. Continuous per-signal Exponential Moving Average (EMA): S_t = α · X_t + (1 - α) · S_{t-1}.
 * 2. Domain-tuned alpha coefficients:
 *    - Gaze angles (pitch/yaw): α = 0.45 (rapid eye saccade tracking without sluggish lag)
 *    - Head pose (yaw/pitch/roll): α = 0.35 (smooth rotational stabilization)
 *    - Valence & Arousal: α = 0.25 (gradual emotional trajectory)
 *    - Composure score: α = 0.20 (macro-level behavioral trend)
 * 3. Discrete Emotion Smoothing:
 *    - Probability vector EMA before argmax
 *    - Rolling temporal window majority vote (W=5)
 * 4. Tracking Hygiene: Freeze/Reset capabilities when subject leaves frame.
 * 5. Jitter metric calculation: Mean Frame-to-Frame Absolute Delta.
 */

import type {
  EulerAngles3D,
  ValenceArousal2D,
  DiscreteEmotion,
} from '@/types/index';

export interface SmoothingAlphas {
  gaze: number;
  pose: number;
  affectVA: number;
  composure: number;
  emotionProbs: number;
}

export const DEFAULT_SMOOTHING_ALPHAS: SmoothingAlphas = {
  gaze: 0.45,
  pose: 0.35,
  affectVA: 0.25,
  composure: 0.20,
  emotionProbs: 0.30,
};

/**
 * Single-scalar Exponential Moving Average filter.
 */
export class ScalarEMA {
  private value: number | null = null;
  private alpha: number;

  constructor(alpha: number, initialValue?: number) {
    this.alpha = Math.max(0.01, Math.min(1.0, alpha));
    if (initialValue !== undefined) {
      this.value = initialValue;
    }
  }

  public update(rawVal: number): number {
    if (this.value === null || !Number.isFinite(this.value)) {
      this.value = rawVal;
    } else {
      this.value = this.alpha * rawVal + (1 - this.alpha) * this.value;
    }
    return this.value;
  }

  public get(): number | null {
    return this.value;
  }

  public reset(value?: number): void {
    this.value = value !== undefined ? value : null;
  }
}

/**
 * 2D Gaze Angle EMA Filter (pitchDegrees, yawDegrees).
 */
export class GazeAngleEMA {
  private pitchFilter: ScalarEMA;
  private yawFilter: ScalarEMA;

  constructor(alpha: number = DEFAULT_SMOOTHING_ALPHAS.gaze) {
    this.pitchFilter = new ScalarEMA(alpha);
    this.yawFilter = new ScalarEMA(alpha);
  }

  public update(angles: { pitchDegrees: number; yawDegrees: number }): {
    pitchDegrees: number;
    yawDegrees: number;
  } {
    const pitch = this.pitchFilter.update(angles.pitchDegrees);
    const yaw = this.yawFilter.update(angles.yawDegrees);
    return {
      pitchDegrees: Math.round(pitch * 100) / 100,
      yawDegrees: Math.round(yaw * 100) / 100,
    };
  }

  public reset(): void {
    this.pitchFilter.reset();
    this.yawFilter.reset();
  }
}

/**
 * 3D Head Pose Euler Angle EMA Filter (yaw, pitch, roll).
 */
export class HeadPoseEMA {
  private yawFilter: ScalarEMA;
  private pitchFilter: ScalarEMA;
  private rollFilter: ScalarEMA;

  constructor(alpha: number = DEFAULT_SMOOTHING_ALPHAS.pose) {
    this.yawFilter = new ScalarEMA(alpha);
    this.pitchFilter = new ScalarEMA(alpha);
    this.rollFilter = new ScalarEMA(alpha);
  }

  public update(angles: EulerAngles3D): EulerAngles3D {
    const yaw = this.yawFilter.update(angles.yawDegrees);
    const pitch = this.pitchFilter.update(angles.pitchDegrees);
    const roll = this.rollFilter.update(angles.rollDegrees);

    return {
      yawDegrees: Math.round(yaw * 100) / 100,
      pitchDegrees: Math.round(pitch * 100) / 100,
      rollDegrees: Math.round(roll * 100) / 100,
    };
  }

  public reset(): void {
    this.yawFilter.reset();
    this.pitchFilter.reset();
    this.rollFilter.reset();
  }
}

/**
 * Valence-Arousal & Composure Score EMA Filter.
 */
export class AffectiveEMA {
  private valenceFilter: ScalarEMA;
  private arousalFilter: ScalarEMA;
  private composureFilter: ScalarEMA;

  constructor(
    vaAlpha: number = DEFAULT_SMOOTHING_ALPHAS.affectVA,
    composureAlpha: number = DEFAULT_SMOOTHING_ALPHAS.composure
  ) {
    this.valenceFilter = new ScalarEMA(vaAlpha);
    this.arousalFilter = new ScalarEMA(vaAlpha);
    this.composureFilter = new ScalarEMA(composureAlpha);
  }

  public update(
    va: ValenceArousal2D,
    composureScore: number
  ): { vaCoordinates: ValenceArousal2D; composureScore: number } {
    const v = this.valenceFilter.update(va.valence);
    const a = this.arousalFilter.update(va.arousal);
    const c = this.composureFilter.update(composureScore);

    return {
      vaCoordinates: {
        valence: Math.round(v * 100) / 100,
        arousal: Math.round(a * 100) / 100,
      },
      composureScore: Math.round(c * 10) / 10,
    };
  }

  public reset(): void {
    this.valenceFilter.reset();
    this.arousalFilter.reset();
    this.composureFilter.reset();
  }
}

/**
 * Discrete Emotion Classifier Stabilizer:
 * Smooths confidence vectors across consecutive frames and applies rolling majority voting
 * to prevent flickering between discrete emotion labels.
 */
export class CategoricalConsensusSmoother<T extends string = DiscreteEmotion> {
  private windowSize: number;
  private history: T[] = [];
  private smoothedProbMap: Map<T, number> = new Map();
  private alpha: number;

  constructor(windowSize = 5, probAlpha: number = DEFAULT_SMOOTHING_ALPHAS.emotionProbs) {
    this.windowSize = Math.max(1, windowSize);
    this.alpha = probAlpha;
  }

  /**
   * Updates discrete class prediction via rolling window majority vote and optional probability smoothing.
   */
  public update(label: T, rawProbabilities?: Record<string, number>): T {
    // 1. Update rolling majority window
    this.history.push(label);
    if (this.history.length > this.windowSize) {
      this.history.shift();
    }

    // 2. If probability distribution is available, apply vector EMA
    if (rawProbabilities && Object.keys(rawProbabilities).length > 0) {
      let maxP = -1;
      let topClass: T = label;

      for (const [cls, rawProb] of Object.entries(rawProbabilities)) {
        const key = cls as T;
        const prevP = this.smoothedProbMap.get(key) ?? rawProb;
        const smoothedP = this.alpha * rawProb + (1 - this.alpha) * prevP;
        this.smoothedProbMap.set(key, smoothedP);

        if (smoothedP > maxP) {
          maxP = smoothedP;
          topClass = key;
        }
      }
      return topClass;
    }

    // 3. Fallback to rolling majority vote
    const counts = new Map<T, number>();
    for (const item of this.history) {
      counts.set(item, (counts.get(item) ?? 0) + 1);
    }

    let consensus = label;
    let maxCount = 0;
    for (const [candidate, count] of counts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        consensus = candidate;
      }
    }

    return consensus;
  }

  public reset(): void {
    this.history = [];
    this.smoothedProbMap.clear();
  }
}

/**
 * Unified Session Tracking Smoother:
 * Centralizes all per-signal EMA smoothers into a coherent pipeline with
 * subject-absence freezing/reset.
 */
export class VisionTelemetrySmoother {
  public readonly gaze: GazeAngleEMA;
  public readonly pose: HeadPoseEMA;
  public readonly affect: AffectiveEMA;
  public readonly emotion: CategoricalConsensusSmoother<DiscreteEmotion>;

  constructor(alphas: Partial<SmoothingAlphas> = {}) {
    const cfg = { ...DEFAULT_SMOOTHING_ALPHAS, ...alphas };
    this.gaze = new GazeAngleEMA(cfg.gaze);
    this.pose = new HeadPoseEMA(cfg.pose);
    this.affect = new AffectiveEMA(cfg.affectVA, cfg.composure);
    this.emotion = new CategoricalConsensusSmoother(5, cfg.emotionProbs);
  }

  /**
   * Resets all smoothing filters (e.g. when subject leaves frame).
   */
  public reset(): void {
    this.gaze.reset();
    this.pose.reset();
    this.affect.reset();
    this.emotion.reset();
  }
}

/**
 * Computes mean frame-to-frame absolute difference (jitter metric) across a series of numeric points.
 * Jitter = (1 / (N - 1)) * Σ |X_t - X_{t-1}|.
 */
export function computeJitterMetric(series: number[]): number {
  if (series.length < 2) return 0;

  let sumDelta = 0;
  for (let i = 1; i < series.length; i++) {
    sumDelta += Math.abs(series[i] - series[i - 1]);
  }

  return Math.round((sumDelta / (series.length - 1)) * 1000) / 1000;
}

/**
 * Computes the percentage jitter reduction between raw and smoothed series:
 * JitterReduction% = ((Jitter_raw - Jitter_smoothed) / Jitter_raw) * 100.
 */
export function computeJitterReduction(
  rawSeries: number[],
  smoothedSeries: number[]
): {
  rawJitter: number;
  smoothedJitter: number;
  reductionPercentage: number;
} {
  const rawJitter = computeJitterMetric(rawSeries);
  const smoothedJitter = computeJitterMetric(smoothedSeries);

  const reduction =
    rawJitter > 0 ? Math.round(((rawJitter - smoothedJitter) / rawJitter) * 1000) / 10 : 0;

  return {
    rawJitter,
    smoothedJitter,
    reductionPercentage: Math.max(0, reduction),
  };
}
