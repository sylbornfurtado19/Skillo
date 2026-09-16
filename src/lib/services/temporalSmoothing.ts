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

// ═══════════════════════════════════════════════════════════════════════════════
// DENSE 2D LANDMARK KINEMATIC FILTER & ADAPTIVE VELOCITY SMOOTHER
// ═══════════════════════════════════════════════════════════════════════════════

export interface LandmarkPoint2D {
  x: number;
  y: number;
}
export type Point2D = LandmarkPoint2D;

export interface LandmarkUpdateResult extends LandmarkPoint2D {
  accepted: boolean;
  pos: LandmarkPoint2D;
}

export type FilterEngineMode = 'KALMAN_HYBRID' | 'EMA_KINEMATIC';

export interface KinematicFilterConfig {
  alphaSlow?: number;
  alphaFast?: number;
  maxSpeed?: number;
  beta?: number;
  confThreshold?: number;
  velocityDecay?: number;
  maxDisplacementPerDt?: number; // Cap step extrapolation displacement (default 0.035)
  maxCumulativeDrift?: number;   // Cap cumulative drift from last confident anchor (default 0.08)
  fadeStartSec?: number;         // Start fading opacity after T seconds of occlusion (default 0.35)
  fadeEndSec?: number;           // Complete fade to 0 opacity after T seconds of occlusion (default 1.0)
  filterMode?: FilterEngineMode; // Kalman Hybrid or Adaptive EMA (default KALMAN_HYBRID)
  r0?: number;                   // Base measurement covariance (default 0.0004)
}

export type TrackingPreset = 'ULTRA_SMOOTH' | 'BALANCED' | 'ULTRA_RESPONSIVE';

export interface RegionalKinematicConfigs {
  eyes: KinematicFilterConfig;
  lips: KinematicFilterConfig;
  noseJaw: KinematicFilterConfig;
  general: KinematicFilterConfig;
}

export const PRESET_REGIONAL_CONFIGS: Record<TrackingPreset, RegionalKinematicConfigs> = {
  BALANCED: {
    eyes:    { alphaSlow: 0.18, alphaFast: 0.85, maxSpeed: 1.20, beta: 0.65, confThreshold: 0.35, maxDisplacementPerDt: 0.04, maxCumulativeDrift: 0.09, fadeStartSec: 0.35, fadeEndSec: 1.0 },
    lips:    { alphaSlow: 0.22, alphaFast: 0.75, maxSpeed: 0.90, beta: 0.60, confThreshold: 0.35, maxDisplacementPerDt: 0.035, maxCumulativeDrift: 0.08, fadeStartSec: 0.35, fadeEndSec: 1.0 },
    noseJaw: { alphaSlow: 0.35, alphaFast: 0.60, maxSpeed: 0.50, beta: 0.50, confThreshold: 0.35, maxDisplacementPerDt: 0.025, maxCumulativeDrift: 0.06, fadeStartSec: 0.35, fadeEndSec: 1.0 },
    general: { alphaSlow: 0.25, alphaFast: 0.70, maxSpeed: 1.00, beta: 0.60, confThreshold: 0.35, maxDisplacementPerDt: 0.035, maxCumulativeDrift: 0.08, fadeStartSec: 0.35, fadeEndSec: 1.0 },
  },
  ULTRA_SMOOTH: {
    eyes:    { alphaSlow: 0.12, alphaFast: 0.65, maxSpeed: 0.90, beta: 0.50, confThreshold: 0.30, maxDisplacementPerDt: 0.03, maxCumulativeDrift: 0.07, fadeStartSec: 0.35, fadeEndSec: 1.0 },
    lips:    { alphaSlow: 0.16, alphaFast: 0.55, maxSpeed: 0.70, beta: 0.45, confThreshold: 0.30, maxDisplacementPerDt: 0.025, maxCumulativeDrift: 0.06, fadeStartSec: 0.35, fadeEndSec: 1.0 },
    noseJaw: { alphaSlow: 0.25, alphaFast: 0.45, maxSpeed: 0.40, beta: 0.40, confThreshold: 0.30, maxDisplacementPerDt: 0.02, maxCumulativeDrift: 0.05, fadeStartSec: 0.35, fadeEndSec: 1.0 },
    general: { alphaSlow: 0.18, alphaFast: 0.55, maxSpeed: 0.70, beta: 0.45, confThreshold: 0.30, maxDisplacementPerDt: 0.025, maxCumulativeDrift: 0.06, fadeStartSec: 0.35, fadeEndSec: 1.0 },
  },
  ULTRA_RESPONSIVE: {
    eyes:    { alphaSlow: 0.30, alphaFast: 0.95, maxSpeed: 1.80, beta: 0.75, confThreshold: 0.40, maxDisplacementPerDt: 0.06, maxCumulativeDrift: 0.12, fadeStartSec: 0.30, fadeEndSec: 0.9 },
    lips:    { alphaSlow: 0.35, alphaFast: 0.88, maxSpeed: 1.40, beta: 0.70, confThreshold: 0.40, maxDisplacementPerDt: 0.05, maxCumulativeDrift: 0.10, fadeStartSec: 0.30, fadeEndSec: 0.9 },
    noseJaw: { alphaSlow: 0.45, alphaFast: 0.75, maxSpeed: 0.80, beta: 0.60, confThreshold: 0.40, maxDisplacementPerDt: 0.035, maxCumulativeDrift: 0.08, fadeStartSec: 0.30, fadeEndSec: 0.9 },
    general: { alphaSlow: 0.35, alphaFast: 0.85, maxSpeed: 1.40, beta: 0.70, confThreshold: 0.40, maxDisplacementPerDt: 0.05, maxCumulativeDrift: 0.10, fadeStartSec: 0.30, fadeEndSec: 0.9 },
  },
};

/**
 * 2D Constant-Velocity Kinematic Filter for a single facial landmark.
 *
 * Implements:
 * - Velocity-adaptive EMA: Lower alpha when resting; Higher alpha during rapid head saccades.
 * - Kinematic extrapolation with per-step and cumulative drift clamps when occluded.
 * - Progressive ease-out cubic opacity fade to prevent "ghost" wandering overlays.
 */
export class LandmarkKinematicFilter {
  private pos: LandmarkPoint2D | null = null;
  private vel: LandmarkPoint2D = { x: 0, y: 0 };
  private lastConfidentPos: LandmarkPoint2D | null = null;
  private occludedSec: number = 0;
  private visibilityOpacity: number = 1.0;
  private lastConfidence: number = 0.95;

  private alphaSlow: number;
  private alphaFast: number;
  private maxSpeed: number;
  private beta: number;
  private confThreshold: number;
  private velocityDecay: number;
  private maxDisplacementPerDt: number;
  private maxCumulativeDrift: number;
  private fadeStartSec: number;
  private fadeEndSec: number;
  private filterMode: FilterEngineMode;
  private r0: number;

  // Decoupled 2x2 state covariance matrices for X and Y: [P00, P01, P10, P11]
  private Px: [number, number, number, number] = [0.0001, 0, 0, 0.005];
  private Py: [number, number, number, number] = [0.0001, 0, 0, 0.005];

  constructor(config: KinematicFilterConfig = {}) {
    this.alphaSlow = config.alphaSlow ?? 0.25;
    this.alphaFast = config.alphaFast ?? 0.70;
    this.maxSpeed = config.maxSpeed ?? 1.5;
    this.beta = config.beta ?? 0.60;
    this.confThreshold = config.confThreshold ?? 0.35;
    this.velocityDecay = config.velocityDecay ?? 0.90;
    this.maxDisplacementPerDt = config.maxDisplacementPerDt ?? 0.035;
    this.maxCumulativeDrift = config.maxCumulativeDrift ?? 0.08;
    this.fadeStartSec = config.fadeStartSec ?? 0.35;
    this.fadeEndSec = config.fadeEndSec ?? 1.0;
    this.filterMode = config.filterMode ?? 'EMA_KINEMATIC';
    this.r0 = config.r0 ?? 0.0004;
  }

  public setConfig(config: Partial<KinematicFilterConfig>) {
    if (config.alphaSlow !== undefined) this.alphaSlow = config.alphaSlow;
    if (config.alphaFast !== undefined) this.alphaFast = config.alphaFast;
    if (config.maxSpeed !== undefined) this.maxSpeed = config.maxSpeed;
    if (config.beta !== undefined) this.beta = config.beta;
    if (config.confThreshold !== undefined) this.confThreshold = config.confThreshold;
    if (config.velocityDecay !== undefined) this.velocityDecay = config.velocityDecay;
    if (config.maxDisplacementPerDt !== undefined) this.maxDisplacementPerDt = config.maxDisplacementPerDt;
    if (config.maxCumulativeDrift !== undefined) this.maxCumulativeDrift = config.maxCumulativeDrift;
    if (config.fadeStartSec !== undefined) this.fadeStartSec = config.fadeStartSec;
    if (config.fadeEndSec !== undefined) this.fadeEndSec = config.fadeEndSec;
    if (config.filterMode !== undefined) this.filterMode = config.filterMode;
    if (config.r0 !== undefined) this.r0 = config.r0;
  }

  public update(
    obs: LandmarkPoint2D,
    conf: number = 1.0,
    dt: number = 0.033
  ): {
    pos: LandmarkPoint2D;
    vel: LandmarkPoint2D;
    alphaUsed: number;
    opacity: number;
    occludedSec: number;
  } {
    const safeDt = Math.max(0.001, Math.min(0.200, dt));

    // NaN / Infinity guard on raw observation
    if (!Number.isFinite(obs.x) || !Number.isFinite(obs.y)) {
      if (this.pos === null) {
        this.pos = { x: 0.5, y: 0.5 };
      }
      return {
        pos: { ...this.pos },
        vel: { ...this.vel },
        alphaUsed: 0.0,
        opacity: this.visibilityOpacity,
        occludedSec: this.occludedSec,
      };
    }

    if (this.pos === null) {
      this.pos = { x: obs.x, y: obs.y };
      this.vel = { x: 0, y: 0 };
      this.lastConfidentPos = { x: obs.x, y: obs.y };
      this.occludedSec = 0;
      this.visibilityOpacity = 1.0;
      return {
        pos: { ...this.pos },
        vel: { ...this.vel },
        alphaUsed: 1.0,
        opacity: 1.0,
        occludedSec: 0,
      };
    }

    if (conf >= this.confThreshold) {
      this.lastConfidence = conf;
      this.occludedSec = 0;
      this.visibilityOpacity = 1.0;
      this.lastConfidentPos = { x: obs.x, y: obs.y };

      const rawVx = (obs.x - this.pos.x) / safeDt;
      const rawVy = (obs.y - this.pos.y) / safeDt;
      const measuredVx = Number.isFinite(rawVx) ? rawVx : 0;
      const measuredVy = Number.isFinite(rawVy) ? rawVy : 0;
      const speed = Math.hypot(measuredVx, measuredVy);
      const speedFactor = Math.max(0, Math.min(1, speed / this.maxSpeed));

      if (this.filterMode === 'KALMAN_HYBRID') {
        // Speed-adaptive process noise Q (increases gain during rapid saccades / head turns)
        const qPos = 0.00005 * safeDt * (1.0 + speedFactor * 8.0);
        const qVel = 0.0015 * safeDt * (1.0 + speedFactor * 8.0);

        // Measurement noise covariance R inversely scaled by detection confidence
        const safeConf = Math.max(0.1, Math.min(1.0, conf));
        const R = this.r0 / (safeConf * safeConf);

        // --- X-Axis Kalman Predict & Update ---
        const xPred = this.pos.x + this.vel.x * safeDt;
        const vxPred = this.vel.x;
        const P00_x = this.Px[0] + safeDt * (this.Px[1] + this.Px[2]) + safeDt * safeDt * this.Px[3] + qPos;
        const P01_x = this.Px[1] + safeDt * this.Px[3];
        const P10_x = this.Px[2] + safeDt * this.Px[3];
        const P11_x = this.Px[3] + qVel;

        const y_x = obs.x - xPred;
        const S_x = P00_x + R;
        const K0_x = P00_x / S_x;
        const K1_x = P10_x / S_x;

        const xNew = xPred + K0_x * y_x;
        const vxNew = vxPred + K1_x * y_x;

        this.Px[0] = Math.max(1e-7, Math.min(1e9, (1 - K0_x) * P00_x));
        const P01_x_sym = ((1 - K0_x) * P01_x + (P10_x - K1_x * P00_x)) * 0.5;
        this.Px[1] = P01_x_sym;
        this.Px[2] = P01_x_sym;
        this.Px[3] = Math.max(1e-7, Math.min(1e9, P11_x - K1_x * P01_x));

        // --- Y-Axis Kalman Predict & Update ---
        const yPred = this.pos.y + this.vel.y * safeDt;
        const vyPred = this.vel.y;
        const P00_y = this.Py[0] + safeDt * (this.Py[1] + this.Py[2]) + safeDt * safeDt * this.Py[3] + qPos;
        const P01_y = this.Py[1] + safeDt * this.Py[3];
        const P10_y = this.Py[2] + safeDt * this.Py[3];
        const P11_y = this.Py[3] + qVel;

        const y_y = obs.y - yPred;
        const S_y = P00_y + R;
        const K0_y = P00_y / S_y;
        const K1_y = P10_y / S_y;

        const yNew = yPred + K0_y * y_y;
        const vyNew = vyPred + K1_y * y_y;

        this.Py[0] = Math.max(1e-7, Math.min(1e9, (1 - K0_y) * P00_y));
        const P01_y_sym = ((1 - K0_y) * P01_y + (P10_y - K1_y * P00_y)) * 0.5;
        this.Py[1] = P01_y_sym;
        this.Py[2] = P01_y_sym;
        this.Py[3] = Math.max(1e-7, Math.min(1e9, P11_y - K1_y * P01_y));

        if (!Number.isFinite(xNew) || !Number.isFinite(yNew) || !Number.isFinite(vxNew) || !Number.isFinite(vyNew)) {
          const fallbackPos = this.lastConfidentPos || { x: obs.x, y: obs.y };
          this.pos = { ...fallbackPos };
          this.vel = { x: 0, y: 0 };
          this.Px = [0.0001, 0, 0, 0.005];
          this.Py = [0.0001, 0, 0, 0.005];
        } else {
          this.pos = { x: xNew, y: yNew };
          this.vel = { x: vxNew, y: vyNew };
        }

        const alphaUsed = (K0_x + K0_y) / 2;
        return {
          pos: { ...this.pos },
          vel: { ...this.vel },
          alphaUsed,
          opacity: 1.0,
          occludedSec: 0,
        };
      } else {
        const baseAlpha = this.alphaSlow + (this.alphaFast - this.alphaSlow) * speedFactor;
        const confWeight = Math.max(0.25, Math.min(1.0, conf));
        const alpha = baseAlpha * confWeight;

        const predX = this.pos.x + this.vel.x * safeDt;
        const predY = this.pos.y + this.vel.y * safeDt;

        const smoothedX = alpha * obs.x + (1 - alpha) * predX;
        const smoothedY = alpha * obs.y + (1 - alpha) * predY;

        if (!Number.isFinite(smoothedX) || !Number.isFinite(smoothedY)) {
          const fallbackPos = this.lastConfidentPos || { x: obs.x, y: obs.y };
          this.pos = { ...fallbackPos };
          this.vel = { x: 0, y: 0 };
        } else {
          this.pos = { x: smoothedX, y: smoothedY };
          this.vel = {
            x: Number.isFinite(measuredVx) ? this.beta * measuredVx + (1 - this.beta) * this.vel.x : 0,
            y: Number.isFinite(measuredVy) ? this.beta * measuredVy + (1 - this.beta) * this.vel.y : 0,
          };
        }

        return {
          pos: { ...this.pos },
          vel: { ...this.vel },
          alphaUsed: alpha,
          opacity: 1.0,
          occludedSec: 0,
        };
      }
    } else {
      // Missing measurement / occlusion tracking
      this.occludedSec += safeDt;

      // Progressive ease-out cubic opacity fade: 1.0 -> 0.0
      if (this.occludedSec <= this.fadeStartSec) {
        this.visibilityOpacity = 1.0;
      } else if (this.occludedSec >= this.fadeEndSec) {
        this.visibilityOpacity = 0.0;
      } else {
        const t = (this.occludedSec - this.fadeStartSec) / (this.fadeEndSec - this.fadeStartSec);
        this.visibilityOpacity = Math.max(0, Math.min(1, 1 - Math.pow(t, 3)));
      }

      // Step extrapolation with clamped displacement per dt
      let stepX = this.vel.x * safeDt;
      let stepY = this.vel.y * safeDt;
      const stepDist = Math.hypot(stepX, stepY);
      if (stepDist > this.maxDisplacementPerDt && stepDist > 0.0001) {
        const clampRatio = this.maxDisplacementPerDt / stepDist;
        stepX *= clampRatio;
        stepY *= clampRatio;
      }

      let predX = this.pos.x + stepX;
      let predY = this.pos.y + stepY;

      // Cap cumulative drift from last confident anchor
      if (this.lastConfidentPos) {
        const driftDist = Math.hypot(predX - this.lastConfidentPos.x, predY - this.lastConfidentPos.y);
        if (driftDist > this.maxCumulativeDrift && driftDist > 0.0001) {
          const driftRatio = this.maxCumulativeDrift / driftDist;
          predX = this.lastConfidentPos.x + (predX - this.lastConfidentPos.x) * driftRatio;
          predY = this.lastConfidentPos.y + (predY - this.lastConfidentPos.y) * driftRatio;
        }
      }

      this.pos = { x: predX, y: predY };

      // Decay velocity exponentially faster under prolonged occlusion
      const decay = this.occludedSec > 0.5 ? this.velocityDecay * 0.75 : this.velocityDecay;
      this.vel = {
        x: this.occludedSec >= this.fadeEndSec ? 0 : this.vel.x * decay,
        y: this.occludedSec >= this.fadeEndSec ? 0 : this.vel.y * decay,
      };

      return {
        pos: { ...this.pos },
        vel: { ...this.vel },
        alphaUsed: 0.0,
        opacity: this.visibilityOpacity,
        occludedSec: this.occludedSec,
      };
    }
  }

  public predict(dt: number = 0.033): LandmarkPoint2D {
    if (this.pos === null) return { x: 0, y: 0 };
    return {
      x: this.pos.x + this.vel.x * dt,
      y: this.pos.y + this.vel.y * dt,
    };
  }

  public getPos(): LandmarkPoint2D | null {
    return this.pos ? { ...this.pos } : null;
  }

  public getVel(): LandmarkPoint2D {
    return { ...this.vel };
  }

  public setVelocity(vel: LandmarkPoint2D): void {
    this.vel = { ...vel };
  }

  public getOpacity(): number {
    return this.visibilityOpacity;
  }

  public getOccludedSec(): number {
    return this.occludedSec;
  }

  public getConfidence(): number {
    return this.lastConfidence;
  }

  public reset(initialPos?: LandmarkPoint2D): void {
    this.pos = initialPos ? { ...initialPos } : null;
    this.vel = { x: 0, y: 0 };
    this.lastConfidentPos = initialPos ? { ...initialPos } : null;
    this.occludedSec = 0;
    this.visibilityOpacity = 1.0;
    this.Px = [0.0001, 0, 0, 0.005];
    this.Py = [0.0001, 0, 0, 0.005];
  }
}

export interface SmoothedLandmarksResult {
  points: LandmarkPoint2D[];
  confidences: number[];
  regionConfidences: {
    eyes: number;
    nose: number;
    mouth: number;
    overall: number;
  };
  meanAlpha: number;
  visibilityOpacity: number;
  occludedDurationSec: number;
  activePreset: TrackingPreset;
  isRelocalizing: boolean;
  relocalizationProgress: number;
}

export interface SimilarityTransform2D {
  scale: number;
  rotation: number;
  tx: number;
  ty: number;
}

/**
 * Computes optimal 2D Procrustes similarity transform (scale, rotation, translation)
 * mapping sourcePts rigidly onto targetPts.
 */
export function computeSimilarityTransform(
  sourcePts: LandmarkPoint2D[],
  targetPts: LandmarkPoint2D[]
): SimilarityTransform2D {
  const k = Math.min(sourcePts.length, targetPts.length);
  if (k < 2) {
    return { scale: 1, rotation: 0, tx: 0, ty: 0 };
  }

  let meanSrcX = 0, meanSrcY = 0;
  let meanTgtX = 0, meanTgtY = 0;
  for (let i = 0; i < k; i++) {
    meanSrcX += sourcePts[i].x;
    meanSrcY += sourcePts[i].y;
    meanTgtX += targetPts[i].x;
    meanTgtY += targetPts[i].y;
  }
  meanSrcX /= k;
  meanSrcY /= k;
  meanTgtX /= k;
  meanTgtY /= k;

  let varSrc = 0;
  let c11 = 0;
  let c12 = 0;

  for (let i = 0; i < k; i++) {
    const sx = sourcePts[i].x - meanSrcX;
    const sy = sourcePts[i].y - meanSrcY;
    const tx = targetPts[i].x - meanTgtX;
    const ty = targetPts[i].y - meanTgtY;

    varSrc += sx * sx + sy * sy;
    c11 += sx * tx + sy * ty;
    c12 += sx * ty - sy * tx;
  }

  if (varSrc < 1e-7) {
    return { scale: 1, rotation: 0, tx: meanTgtX - meanSrcX, ty: meanTgtY - meanSrcY };
  }

  const rotation = Math.atan2(c12, c11);
  const norm = Math.hypot(c11, c12);
  const rawScale = norm / varSrc;
  const scale = Math.max(0.6, Math.min(1.5, rawScale));

  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  const tx = meanTgtX - scale * (cosR * meanSrcX - sinR * meanSrcY);
  const ty = meanTgtY - scale * (sinR * meanSrcX + cosR * meanSrcY);

  return { scale, rotation, tx, ty };
}

export interface RansacSimilarityResult extends SimilarityTransform2D {
  inlierCount: number;
  totalCandidates: number;
  inlierIndices: number[];
}

/**
 * Robust RANSAC-based 2D Procrustes similarity transform estimator.
 * Samples pairs of corresponding points, estimates similarity,
 * counts consensus inliers within inlierThreshold, and refines
 * the transform over the maximum inlier set.
 */
export function computeRansacSimilarityTransform(
  sourcePts: LandmarkPoint2D[],
  targetPts: LandmarkPoint2D[],
  maxIterations: number = 20,
  inlierThreshold: number = 0.04
): RansacSimilarityResult {
  const k = Math.min(sourcePts.length, targetPts.length);
  if (k < 2) {
    return { scale: 1, rotation: 0, tx: 0, ty: 0, inlierCount: k, totalCandidates: k, inlierIndices: [] };
  }

  if (k === 2) {
    const t = computeSimilarityTransform(sourcePts, targetPts);
    return { ...t, inlierCount: 2, totalCandidates: 2, inlierIndices: [0, 1] };
  }

  let bestInlierIndices: number[] = [];
  let bestTransform: SimilarityTransform2D = computeSimilarityTransform(sourcePts, targetPts);

  for (let iter = 0; iter < maxIterations; iter++) {
    const idx1 = Math.floor(Math.random() * k);
    let idx2 = Math.floor(Math.random() * (k - 1));
    if (idx2 >= idx1) idx2++;

    const sampleSrc = [sourcePts[idx1], sourcePts[idx2]];
    const sampleTgt = [targetPts[idx1], targetPts[idx2]];

    if (Math.hypot(sampleSrc[0].x - sampleSrc[1].x, sampleSrc[0].y - sampleSrc[1].y) < 0.01) {
      continue;
    }

    const t = computeSimilarityTransform(sampleSrc, sampleTgt);
    const cosR = Math.cos(t.rotation);
    const sinR = Math.sin(t.rotation);

    const inliers: number[] = [];
    for (let i = 0; i < k; i++) {
      const sx = sourcePts[i].x;
      const sy = sourcePts[i].y;
      const predX = t.scale * (cosR * sx - sinR * sy) + t.tx;
      const predY = t.scale * (sinR * sx + cosR * sy) + t.ty;
      const err = Math.hypot(predX - targetPts[i].x, predY - targetPts[i].y);
      if (err <= inlierThreshold) {
        inliers.push(i);
      }
    }

    if (inliers.length > bestInlierIndices.length) {
      bestInlierIndices = inliers;
      bestTransform = t;
      if (inliers.length >= k * 0.85) break;
    }
  }

  if (bestInlierIndices.length >= 2) {
    const inlierSrc = bestInlierIndices.map(i => sourcePts[i]);
    const inlierTgt = bestInlierIndices.map(i => targetPts[i]);
    bestTransform = computeSimilarityTransform(inlierSrc, inlierTgt);
  }

  return {
    ...bestTransform,
    inlierCount: bestInlierIndices.length,
    totalCandidates: k,
    inlierIndices: bestInlierIndices,
  };
}

// ── Statistical PCA Shape Prior Model (70 Canonical Points) ─────────────────
// Pre-computed canonical mean shape (140 dimensions: x0, y0, ... x69, y69)
const CANONICAL_MEAN_SHAPE_70 = new Float32Array([
  // Jawline (0..16)
  0.22, 0.35, 0.23, 0.43, 0.25, 0.51, 0.27, 0.59, 0.31, 0.67, 0.36, 0.74, 0.42, 0.79, 0.46, 0.81, 0.50, 0.82,
  0.54, 0.81, 0.58, 0.79, 0.64, 0.74, 0.69, 0.67, 0.73, 0.59, 0.75, 0.51, 0.77, 0.43, 0.78, 0.35,
  // Right eyebrow (17..21)
  0.29, 0.32, 0.32, 0.30, 0.36, 0.30, 0.40, 0.31, 0.43, 0.33,
  // Left eyebrow (22..26)
  0.57, 0.33, 0.60, 0.31, 0.64, 0.30, 0.68, 0.30, 0.71, 0.32,
  // Nose bridge & tip (27..35)
  0.50, 0.36, 0.50, 0.42, 0.50, 0.48, 0.50, 0.54, 0.45, 0.58, 0.47, 0.58, 0.50, 0.59, 0.53, 0.58, 0.55, 0.58,
  // Right eye (36..41)
  0.32, 0.38, 0.34, 0.36, 0.38, 0.36, 0.41, 0.39, 0.38, 0.40, 0.34, 0.40,
  // Left eye (42..47)
  0.59, 0.39, 0.62, 0.36, 0.66, 0.36, 0.68, 0.38, 0.66, 0.40, 0.62, 0.40,
  // Outer lips (48..59)
  0.39, 0.68, 0.43, 0.65, 0.47, 0.64, 0.50, 0.65, 0.53, 0.64, 0.57, 0.65, 0.61, 0.68, 0.57, 0.71, 0.53, 0.73,
  0.50, 0.73, 0.47, 0.73, 0.43, 0.71,
  // Inner lips (60..67)
  0.41, 0.68, 0.47, 0.66, 0.50, 0.67, 0.53, 0.66, 0.59, 0.68, 0.53, 0.70, 0.50, 0.70, 0.47, 0.70,
  // Pupils (68, 69)
  0.36, 0.38, 0.64, 0.38,
]);

// Top 5 orthonormal modes of variation (140 dimensions each)
const PCA_MODES_70: Float32Array[] = [
  new Float32Array(140), // Mode 0: Aspect ratio / Face width
  new Float32Array(140), // Mode 1: Jaw opening / speech
  new Float32Array(140), // Mode 2: Smile / lip widening
  new Float32Array(140), // Mode 3: Eyebrow raise
  new Float32Array(140), // Mode 4: Eye squint / blink
];

const PCA_SIGMAS = [0.08, 0.06, 0.05, 0.04, 0.03];

// Initialize orthogonal synthetic PCA modes
(() => {
  // Mode 0: Lateral expansion relative to midline (x = 0.50)
  for (let i = 0; i < 70; i++) {
    const x = CANONICAL_MEAN_SHAPE_70[i * 2];
    PCA_MODES_70[0][i * 2] = (x - 0.50) * 0.25;
  }
  // Mode 1: Lower jaw and lower lip vertical lowering
  for (let i = 5; i <= 11; i++) PCA_MODES_70[1][i * 2 + 1] = 0.35;
  for (let i = 48; i <= 67; i++) PCA_MODES_70[1][i * 2 + 1] = 0.40;
  // Mode 2: Mouth corner widening
  PCA_MODES_70[2][48 * 2] = -0.35;
  PCA_MODES_70[2][48 * 2 + 1] = -0.15;
  PCA_MODES_70[2][54 * 2] = 0.35;
  PCA_MODES_70[2][54 * 2 + 1] = -0.15;
  // Mode 3: Eyebrow vertical elevation
  for (let i = 17; i <= 26; i++) PCA_MODES_70[3][i * 2 + 1] = -0.30;
  // Mode 4: Eye eyelid convergence
  PCA_MODES_70[4][37 * 2 + 1] = 0.25; PCA_MODES_70[4][38 * 2 + 1] = 0.25;
  PCA_MODES_70[4][40 * 2 + 1] = -0.25; PCA_MODES_70[4][41 * 2 + 1] = -0.25;
  PCA_MODES_70[4][43 * 2 + 1] = 0.25; PCA_MODES_70[4][44 * 2 + 1] = 0.25;
  PCA_MODES_70[4][46 * 2 + 1] = -0.25; PCA_MODES_70[4][47 * 2 + 1] = -0.25;

  // Normalize each mode to unit L2 norm
  for (let m = 0; m < 5; m++) {
    let norm = 0;
    for (let j = 0; j < 140; j++) norm += PCA_MODES_70[m][j] * PCA_MODES_70[m][j];
    norm = Math.sqrt(norm);
    if (norm > 1e-6) {
      for (let j = 0; j < 140; j++) PCA_MODES_70[m][j] /= norm;
    }
  }
})();

export class PCAShapePrior {
  /**
   * Returns a copy of the 70-point canonical anthropometric mean facial shape.
   */
  public static getMeanShape(): LandmarkPoint2D[] {
    const list: LandmarkPoint2D[] = [];
    for (let i = 0; i < 70; i++) {
      list.push({
        x: CANONICAL_MEAN_SHAPE_70[i * 2],
        y: CANONICAL_MEAN_SHAPE_70[i * 2 + 1],
      });
    }
    return list;
  }

  /**
   * Projects a 70-point facial landmark array onto the plausible statistical
   * facial shape manifold, clamping outliers exceeding maxSigma standard deviations.
   */
  public static project(
    points: LandmarkPoint2D[],
    maxSigma: number = 3.0,
    alphaBlend: number = 0.18
  ): LandmarkPoint2D[] {
    if (points.length !== 70) return points;

    const canonicalPts: LandmarkPoint2D[] = [];
    for (let i = 0; i < 70; i++) {
      canonicalPts.push({
        x: CANONICAL_MEAN_SHAPE_70[i * 2],
        y: CANONICAL_MEAN_SHAPE_70[i * 2 + 1],
      });
    }

    // Align input points to canonical mean shape
    const sim = computeSimilarityTransform(points, canonicalPts);
    if (sim.scale < 0.1) return points;

    const cosR = Math.cos(sim.rotation);
    const sinR = Math.sin(sim.rotation);

    const aligned = new Float32Array(140);
    for (let i = 0; i < 70; i++) {
      const px = points[i].x;
      const py = points[i].y;
      aligned[i * 2] = sim.scale * (cosR * px - sinR * py) + sim.tx;
      aligned[i * 2 + 1] = sim.scale * (sinR * px + cosR * py) + sim.ty;
    }

    // Subspace projection: b_k = U_k^T * (aligned - mean)
    const diff = new Float32Array(140);
    for (let i = 0; i < 140; i++) diff[i] = aligned[i] - CANONICAL_MEAN_SHAPE_70[i];

    const recon = new Float32Array(CANONICAL_MEAN_SHAPE_70);
    for (let m = 0; m < 5; m++) {
      let b = 0;
      for (let i = 0; i < 140; i++) b += PCA_MODES_70[m][i] * diff[i];
      // Clamp to +/- maxSigma * sigma_m
      const bound = maxSigma * PCA_SIGMAS[m];
      const clampedB = Math.max(-bound, Math.min(bound, b));
      for (let i = 0; i < 140; i++) recon[i] += clampedB * PCA_MODES_70[m][i];
    }

    // Invert similarity transform: recon -> image coordinates
    // [x_im, y_im]^T = (1/s) * R(-theta) * ([x_rec, y_rec]^T - [tx, ty]^T)
    const invScale = 1.0 / sim.scale;
    const cosNegR = Math.cos(-sim.rotation);
    const sinNegR = Math.sin(-sim.rotation);

    const result: LandmarkPoint2D[] = [];
    for (let i = 0; i < 70; i++) {
      const rx = recon[i * 2] - sim.tx;
      const ry = recon[i * 2 + 1] - sim.ty;
      const imX = invScale * (cosNegR * rx - sinNegR * ry);
      const imY = invScale * (sinNegR * rx + cosNegR * ry);

      // Soft-blend with original observation
      result.push({
        x: (1.0 - alphaBlend) * points[i].x + alphaBlend * imX,
        y: (1.0 - alphaBlend) * points[i].y + alphaBlend * imY,
      });
    }

    return result;
  }
}

/**
 * Dense Multi-Point Facial Landmark Smoother.
 * Manages per-landmark kinematic filters with per-region specialization,
 * dynamic presets, and global anti-snap re-localization glide.
 */
export class DenseLandmarksSmoother {
  private filters: LandmarkKinematicFilter[] = [];
  private lastModelTimestampMs: number = 0;
  private lastMicroTimestampMs: number = 0;
  private lastMaxOccludedSec: number = 0;
  private currentPreset: TrackingPreset = 'BALANCED';

  // Global anti-snap re-localization state
  private isRelocalizing: boolean = false;
  private reLocProgress: number = 1.0;
  private reLocDurationSec: number = 0.12; // 120ms glide
  private reLocStartPositions: LandmarkPoint2D[] = [];
  private reLocTransform: SimilarityTransform2D = { scale: 1, rotation: 0, tx: 0, ty: 0 };
  private reLocThreshold: number = 0.06; // 0.06 normalized distance threshold (~38px at 640x480)
  private minOcclusionForRelocSec: number = 0.30; // 300ms minimum occlusion hold
  private filterMode: FilterEngineMode = 'EMA_KINEMATIC';
  private enablePcaProjection: boolean = false;
  private pcaAlpha: number = 0.18;

  public setEnablePcaProjection(enable: boolean, alpha: number = 0.18): void {
    this.enablePcaProjection = enable;
    this.pcaAlpha = Math.max(0, Math.min(0.5, alpha));
  }

  public getEnablePcaProjection(): boolean {
    return this.enablePcaProjection;
  }

  private activeFaceId: string | number | null = null;

  public setFaceId(faceId: string | number | null): void {
    if (faceId !== this.activeFaceId) {
      this.reset();
      this.activeFaceId = faceId;
    }
  }

  public getFaceId(): string | number | null {
    return this.activeFaceId;
  }


  constructor(
    numPoints: number = 68,
    preset: TrackingPreset = 'BALANCED',
    filterMode: FilterEngineMode = 'EMA_KINEMATIC'
  ) {
    this.currentPreset = preset;
    this.filterMode = filterMode;
    this.initFilters(numPoints);
  }

  public setFilterMode(mode: FilterEngineMode): void {
    this.filterMode = mode;
    for (const filter of this.filters) {
      filter.setConfig({ filterMode: mode });
    }
  }

  public setRelocalizationConfig(config: {
    threshold?: number;
    durationMs?: number;
    durationSec?: number;
    minOcclusionSec?: number;
  }) {
    if (config.threshold !== undefined) this.reLocThreshold = config.threshold;
    if (config.durationMs !== undefined) this.reLocDurationSec = Math.max(0.02, config.durationMs / 1000);
    else if (config.durationSec !== undefined) this.reLocDurationSec = Math.max(0.02, config.durationSec);
    if (config.minOcclusionSec !== undefined) this.minOcclusionForRelocSec = config.minOcclusionSec;
  }

  public getIsRelocalizing(): boolean {
    return this.isRelocalizing;
  }

  public getRelocalizationProgress(): number {
    return this.reLocProgress;
  }

  private getRegionKeyForIndex(index: number): 'eyes' | 'lips' | 'noseJaw' | 'general' {
    if ((index >= 36 && index <= 47) || index === 68 || index === 69) {
      return 'eyes';
    } else if (index >= 48 && index <= 67) {
      return 'lips';
    } else if (index >= 0 && index <= 35) {
      return 'noseJaw';
    }
    return 'general';
  }

  private initFilters(numPoints: number) {
    this.filters = [];
    const configs = PRESET_REGIONAL_CONFIGS[this.currentPreset];
    for (let i = 0; i < numPoints; i++) {
      const region = this.getRegionKeyForIndex(i);
      this.filters.push(new LandmarkKinematicFilter({
        ...configs[region],
        filterMode: this.filterMode,
      }));
    }
    this.isRelocalizing = false;
    this.reLocProgress = 1.0;
    this.reLocStartPositions = [];
  }

  public setPreset(preset: TrackingPreset): void {
    this.currentPreset = preset;
    const configs = PRESET_REGIONAL_CONFIGS[preset];
    for (let i = 0; i < this.filters.length; i++) {
      const region = this.getRegionKeyForIndex(i);
      this.filters[i].setConfig(configs[region]);
    }
  }

  public setRegionConfig(
    region: 'eyes' | 'lips' | 'noseJaw' | 'all',
    config: Partial<KinematicFilterConfig>
  ): void {
    for (let i = 0; i < this.filters.length; i++) {
      const rk = this.getRegionKeyForIndex(i);
      if (region === 'all' || region === rk) {
        this.filters[i].setConfig(config);
      }
    }
  }

  /**
   * Updates landmark state directly from a zero-copy transferable Float32Array
   * formatted as [x0, y0, z0, c0, x1, y1, z1, c1, ...].
   */
  public updateFromBuffer(
    buffer: Float32Array,
    numPoints: number,
    timestampMs: number
  ): SmoothedLandmarksResult {
    if (this.filters.length !== numPoints) {
      this.initFilters(numPoints);
    }

    let validTimestamp = timestampMs;
    if (this.lastModelTimestampMs > 0 && validTimestamp <= this.lastModelTimestampMs) {
      validTimestamp = this.lastModelTimestampMs + 1;
    }

    const dt = this.lastModelTimestampMs > 0
      ? Math.max(0.001, Math.min(0.200, (validTimestamp - this.lastModelTimestampMs) / 1000))
      : 0.033;
    this.lastModelTimestampMs = validTimestamp;

    // 1. Global Anchor Centroid calculation for Re-localization Gating
    const anchorIndices = [30, 33, 36, 39, 42, 45]; // nose base, tip, eye corners
    let anchorSumX = 0, anchorSumY = 0, anchorConfSum = 0, anchorCount = 0;

    for (const idx of anchorIndices) {
      if (idx < numPoints) {
        const off = idx * 4;
        anchorSumX += buffer[off];
        anchorSumY += buffer[off + 1];
        anchorConfSum += buffer[off + 3];
        anchorCount++;
      }
    }
    const incomingAnchorConf = anchorCount > 0 ? anchorConfSum / anchorCount : 0;

    if (
      !this.isRelocalizing &&
      incomingAnchorConf >= 0.45 &&
      this.lastMaxOccludedSec >= this.minOcclusionForRelocSec &&
      this.filters.length === numPoints
    ) {
      let prevAnchorSumX = 0, prevAnchorSumY = 0, prevCount = 0;
      for (const idx of anchorIndices) {
        const p = this.filters[idx]?.getPos();
        if (p) {
          prevAnchorSumX += p.x;
          prevAnchorSumY += p.y;
          prevCount++;
        }
      }
      if (prevCount > 0) {
        const prevAnchorX = prevAnchorSumX / prevCount;
        const prevAnchorY = prevAnchorSumY / prevCount;
        const incAnchorX = anchorSumX / anchorCount;
        const incAnchorY = anchorSumY / anchorCount;
        const displacement = Math.hypot(incAnchorX - prevAnchorX, incAnchorY - prevAnchorY);

        if (displacement >= this.reLocThreshold) {
          // Trigger global smooth re-localization glide across all landmarks via Procrustes similarity transform
          this.isRelocalizing = true;
          this.reLocProgress = 0.0;
          const prevAnchors: LandmarkPoint2D[] = [];
          const incAnchors: LandmarkPoint2D[] = [];
          for (const idx of anchorIndices) {
            const p = this.filters[idx]?.getPos();
            if (p) {
              prevAnchors.push(p);
              incAnchors.push({ x: buffer[idx * 4], y: buffer[idx * 4 + 1] });
            }
          }
          const numSamples = prevAnchors.length;
          const ransacIters = Math.min(50, 5 + 3 * numSamples);
          let minX = 1, maxX = 0, minY = 1, maxY = 0;
          for (const p of prevAnchors) {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          }
          const faceScale = Math.max(0.1, Math.hypot(maxX - minX, maxY - minY));
          const inlierThreshold = Math.max(0.015, Math.min(0.06, 0.02 * faceScale));
          this.reLocTransform = computeRansacSimilarityTransform(prevAnchors, incAnchors, ransacIters, inlierThreshold);
          this.reLocStartPositions = this.filters.map((f, i) => {
            const p = f.getPos();
            return p ? { ...p } : { x: buffer[i * 4], y: buffer[i * 4 + 1] };
          });
        }
      }
    }

    const wasRelocalizing = this.isRelocalizing;
    if (this.isRelocalizing) {
      this.reLocProgress += dt / this.reLocDurationSec;
      if (this.reLocProgress >= 1.0) {
        this.reLocProgress = 1.0;
        this.isRelocalizing = false;
      }
    }

    // PCA Shape Prior: project onto statistical manifold if enabled and confidence >= 0.60
    let conditionedPoints: LandmarkPoint2D[] | null = null;
    if (this.enablePcaProjection && numPoints === 70) {
      let avgConf = 0;
      const rawPts: LandmarkPoint2D[] = [];
      for (let i = 0; i < 70; i++) {
        rawPts.push({ x: buffer[i * 4], y: buffer[i * 4 + 1] });
        avgConf += buffer[i * 4 + 3];
      }
      avgConf /= 70;
      // Gated by overall confidence > 0.60 to avoid bias on ambiguous/occluded poses
      if (avgConf >= 0.60) {
        conditionedPoints = PCAShapePrior.project(rawPts, 3.0, this.pcaAlpha);
      }
    }

    const points: LandmarkPoint2D[] = [];
    const confidences: number[] = [];
    let alphaSum = 0;
    let opacitySum = 0;
    let maxOccludedSec = 0;

    let eyeConfSum = 0, eyeCount = 0;
    let noseConfSum = 0, noseCount = 0;
    let mouthConfSum = 0, mouthCount = 0;
    let totalConfSum = 0;

    const t = Math.min(1.0, this.reLocProgress);
    const blend = t * t * (3 - 2 * t); // Hermite cubic smoothstep

    for (let i = 0; i < numPoints; i++) {
      const offset = i * 4;
      let x = conditionedPoints ? conditionedPoints[i].x : buffer[offset];
      let y = conditionedPoints ? conditionedPoints[i].y : buffer[offset + 1];
      const conf = buffer[offset + 3];

      // If global re-localizing, apply interpolated Procrustes similarity transform + smooth glide
      if (wasRelocalizing && this.reLocStartPositions[i]) {
        const start = this.reLocStartPositions[i];
        const targetX = x;
        const targetY = y;

        const s = 1.0 + (this.reLocTransform.scale - 1.0) * blend;
        const theta = this.reLocTransform.rotation * blend;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const tx = this.reLocTransform.tx * blend;
        const ty = this.reLocTransform.ty * blend;

        const xRigid = s * (cosT * start.x - sinT * start.y) + tx;
        const yRigid = s * (sinT * start.x + cosT * start.y) + ty;

        x = xRigid + (targetX - xRigid) * blend;
        y = yRigid + (targetY - yRigid) * blend;

        // Explicitly blend internal velocity toward target glide velocity to prevent post-glide overshoot
        const targetVx = (targetX - start.x) / this.reLocDurationSec;
        const targetVy = (targetY - start.y) / this.reLocDurationSec;
        const currentVel = this.filters[i].getVel();
        this.filters[i].setVelocity({
          x: currentVel.x * (1 - blend) + targetVx * blend * 0.5,
          y: currentVel.y * (1 - blend) + targetVy * blend * 0.5,
        });
      }

      const res = this.filters[i].update({ x, y }, conf, dt);
      points.push(res.pos);
      confidences.push(conf);
      alphaSum += res.alphaUsed;
      opacitySum += res.opacity;
      if (res.occludedSec > maxOccludedSec) maxOccludedSec = res.occludedSec;
      totalConfSum += conf;

      // Classify region by canonical landmark indices
      if ((i >= 36 && i <= 47) || i === 68 || i === 69) {
        eyeConfSum += conf;
        eyeCount++;
      } else if (i >= 27 && i <= 35) {
        noseConfSum += conf;
        noseCount++;
      } else if (i >= 48 && i <= 67) {
        mouthConfSum += conf;
        mouthCount++;
      }
    }

    this.lastMaxOccludedSec = maxOccludedSec;

    return {
      points,
      confidences,
      regionConfidences: {
        eyes: eyeCount > 0 ? eyeConfSum / eyeCount : 1.0,
        nose: noseCount > 0 ? noseConfSum / noseCount : 1.0,
        mouth: mouthCount > 0 ? mouthConfSum / mouthCount : 1.0,
        overall: numPoints > 0 ? totalConfSum / numPoints : 1.0,
      },
      meanAlpha: numPoints > 0 ? alphaSum / numPoints : 0.5,
      visibilityOpacity: numPoints > 0 ? opacitySum / numPoints : 1.0,
      occludedDurationSec: maxOccludedSec,
      activePreset: this.currentPreset,
      isRelocalizing: this.isRelocalizing,
      relocalizationProgress: this.reLocProgress,
    };
  }

  /**
   * Updates landmark state from array of Point2D objects.
   */
  public updateFromPoints(
    rawPoints: Array<{ x: number; y: number; confidence?: number }>,
    timestampMs: number
  ): SmoothedLandmarksResult {
    const numPoints = rawPoints.length;
    if (this.filters.length !== numPoints) {
      this.initFilters(numPoints);
    }

    let validTimestamp = timestampMs;
    if (this.lastModelTimestampMs > 0 && validTimestamp <= this.lastModelTimestampMs) {
      validTimestamp = this.lastModelTimestampMs + 1;
    }

    const dt = this.lastModelTimestampMs > 0
      ? Math.max(0.001, Math.min(0.200, (validTimestamp - this.lastModelTimestampMs) / 1000))
      : 0.033;
    this.lastModelTimestampMs = validTimestamp;

    const anchorIndices = [30, 33, 36, 39, 42, 45];
    let anchorSumX = 0, anchorSumY = 0, anchorConfSum = 0, anchorCount = 0;

    for (const idx of anchorIndices) {
      if (idx < numPoints) {
        anchorSumX += rawPoints[idx].x;
        anchorSumY += rawPoints[idx].y;
        anchorConfSum += rawPoints[idx].confidence ?? 1.0;
        anchorCount++;
      }
    }
    const incomingAnchorConf = anchorCount > 0 ? anchorConfSum / anchorCount : 0;

    if (
      !this.isRelocalizing &&
      incomingAnchorConf >= 0.45 &&
      this.lastMaxOccludedSec >= this.minOcclusionForRelocSec &&
      this.filters.length === numPoints
    ) {
      let prevAnchorSumX = 0, prevAnchorSumY = 0, prevCount = 0;
      for (const idx of anchorIndices) {
        const p = this.filters[idx]?.getPos();
        if (p) {
          prevAnchorSumX += p.x;
          prevAnchorSumY += p.y;
          prevCount++;
        }
      }
      if (prevCount > 0) {
        const prevAnchorX = prevAnchorSumX / prevCount;
        const prevAnchorY = prevAnchorSumY / prevCount;
        const incAnchorX = anchorSumX / anchorCount;
        const incAnchorY = anchorSumY / anchorCount;
        const displacement = Math.hypot(incAnchorX - prevAnchorX, incAnchorY - prevAnchorY);

        if (displacement >= this.reLocThreshold) {
          this.isRelocalizing = true;
          this.reLocProgress = 0.0;
          const prevAnchors: LandmarkPoint2D[] = [];
          const incAnchors: LandmarkPoint2D[] = [];
          for (const idx of anchorIndices) {
            const p = this.filters[idx]?.getPos();
            if (p) {
              prevAnchors.push(p);
              incAnchors.push({ x: rawPoints[idx].x, y: rawPoints[idx].y });
            }
          }
          this.reLocTransform = computeSimilarityTransform(prevAnchors, incAnchors);
          this.reLocStartPositions = this.filters.map((f, i) => {
            const p = f.getPos();
            return p ? { ...p } : { x: rawPoints[i].x, y: rawPoints[i].y };
          });
        }
      }
    }

    const wasRelocalizing = this.isRelocalizing;
    if (this.isRelocalizing) {
      this.reLocProgress += dt / this.reLocDurationSec;
      if (this.reLocProgress >= 1.0) {
        this.reLocProgress = 1.0;
        this.isRelocalizing = false;
      }
    }

    const points: LandmarkPoint2D[] = [];
    const confidences: number[] = [];
    let alphaSum = 0;
    let opacitySum = 0;
    let maxOccludedSec = 0;

    let eyeConfSum = 0, eyeCount = 0;
    let noseConfSum = 0, noseCount = 0;
    let mouthConfSum = 0, mouthCount = 0;
    let totalConfSum = 0;

    const t = Math.min(1.0, this.reLocProgress);
    const blend = t * t * (3 - 2 * t);

    for (let i = 0; i < numPoints; i++) {
      const p = rawPoints[i];
      let x = p.x;
      let y = p.y;
      const conf = p.confidence ?? 1.0;

      if (wasRelocalizing && this.reLocStartPositions[i]) {
        const start = this.reLocStartPositions[i];
        const targetX = p.x;
        const targetY = p.y;

        const s = 1.0 + (this.reLocTransform.scale - 1.0) * blend;
        const theta = this.reLocTransform.rotation * blend;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const tx = this.reLocTransform.tx * blend;
        const ty = this.reLocTransform.ty * blend;

        const xRigid = s * (cosT * start.x - sinT * start.y) + tx;
        const yRigid = s * (sinT * start.x + cosT * start.y) + ty;

        x = xRigid + (targetX - xRigid) * blend;
        y = yRigid + (targetY - yRigid) * blend;

        // Explicitly blend internal velocity toward target glide velocity to prevent post-glide overshoot
        const targetVx = (targetX - start.x) / this.reLocDurationSec;
        const targetVy = (targetY - start.y) / this.reLocDurationSec;
        const currentVel = this.filters[i].getVel();
        this.filters[i].setVelocity({
          x: currentVel.x * (1 - blend) + targetVx * blend * 0.5,
          y: currentVel.y * (1 - blend) + targetVy * blend * 0.5,
        });
      }

      const res = this.filters[i].update({ x, y }, conf, dt);
      points.push(res.pos);
      confidences.push(conf);
      alphaSum += res.alphaUsed;
      opacitySum += res.opacity;
      if (res.occludedSec > maxOccludedSec) maxOccludedSec = res.occludedSec;
      totalConfSum += conf;

      if ((i >= 36 && i <= 47) || i === 68 || i === 69) {
        eyeConfSum += conf;
        eyeCount++;
      } else if (i >= 27 && i <= 35) {
        noseConfSum += conf;
        noseCount++;
      } else if (i >= 48 && i <= 67) {
        mouthConfSum += conf;
        mouthCount++;
      }
    }

    this.lastMaxOccludedSec = maxOccludedSec;

    return {
      points,
      confidences,
      regionConfidences: {
        eyes: eyeCount > 0 ? eyeConfSum / eyeCount : 1.0,
        nose: noseCount > 0 ? noseConfSum / noseCount : 1.0,
        mouth: mouthCount > 0 ? mouthConfSum / mouthCount : 1.0,
        overall: numPoints > 0 ? totalConfSum / numPoints : 1.0,
      },
      meanAlpha: numPoints > 0 ? alphaSum / numPoints : 0.5,
      visibilityOpacity: numPoints > 0 ? opacitySum / numPoints : 1.0,
      occludedDurationSec: maxOccludedSec,
      activePreset: this.currentPreset,
      isRelocalizing: this.isRelocalizing,
      relocalizationProgress: this.reLocProgress,
    };
  }

  /**
   * Updates a single landmark filter (e.g. from high-speed micro-patch tracker).
   */
  public updatePoint(
    index: number,
    pos: LandmarkPoint2D,
    confidence: number,
    timestampMs: number
  ): LandmarkUpdateResult | null {
    if (index < 0 || index >= this.filters.length) return null;
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y) || confidence < 0.15) {
      return { accepted: false, pos: { ...pos }, x: pos.x, y: pos.y };
    }

    let validTimestamp = timestampMs;
    if (this.lastMicroTimestampMs > 0 && validTimestamp <= this.lastMicroTimestampMs) {
      validTimestamp = this.lastMicroTimestampMs + 1;
    }

    const dt = this.lastMicroTimestampMs > 0
      ? Math.max(0.001, Math.min(0.200, (validTimestamp - this.lastMicroTimestampMs) / 1000))
      : 0.016;

    const res = this.filters[index].update(pos, confidence, dt);
    this.lastMicroTimestampMs = validTimestamp;

    const accepted = Number.isFinite(res.pos.x) && Number.isFinite(res.pos.y);
    return {
      accepted,
      pos: res.pos,
      x: res.pos.x,
      y: res.pos.y,
    };
  }

  /**
   * Retrieves the current smoothed state across all landmarks without mutating
   * kinematic filters with stale intermediate observations.
   */
  public getCurrentResult(): SmoothedLandmarksResult {
    const points: LandmarkPoint2D[] = [];
    const confidences: number[] = [];
    let eyeConfSum = 0, eyeCount = 0;
    let noseConfSum = 0, noseCount = 0;
    let mouthConfSum = 0, mouthCount = 0;
    let totalConfSum = 0;

    for (let i = 0; i < this.filters.length; i++) {
      const p = this.filters[i].getPos() || { x: 0.5, y: 0.5 };
      points.push(p);
      const conf = this.filters[i].getConfidence();
      confidences.push(conf);
      totalConfSum += conf;

      if ((i >= 36 && i <= 47) || i === 68 || i === 69) {
        eyeConfSum += conf;
        eyeCount++;
      } else if (i >= 27 && i <= 35) {
        noseConfSum += conf;
        noseCount++;
      } else if (i >= 48 && i <= 67) {
        mouthConfSum += conf;
        mouthCount++;
      }
    }

    return {
      points,
      confidences,
      regionConfidences: {
        eyes: eyeCount > 0 ? eyeConfSum / eyeCount : 1.0,
        nose: noseCount > 0 ? noseConfSum / noseCount : 1.0,
        mouth: mouthCount > 0 ? mouthConfSum / mouthCount : 1.0,
        overall: this.filters.length > 0 ? totalConfSum / this.filters.length : 1.0,
      },
      meanAlpha: 0.5,
      visibilityOpacity: 1.0,
      occludedDurationSec: this.lastMaxOccludedSec,
      activePreset: this.currentPreset,
      isRelocalizing: this.isRelocalizing,
      relocalizationProgress: this.reLocProgress,
    };
  }

  /**
   * Returns the 1-step predicted position for a specific landmark filter.
   */
  public predictPoint(index: number, dt: number = 0.016): LandmarkPoint2D | null {
    if (index < 0 || index >= this.filters.length) return null;
    return this.filters[index].predict(dt);
  }

  /**
   * Exposes raw filter reference for diagnostic inspection.
   */
  public getFilter(index: number): LandmarkKinematicFilter | null {
    if (index < 0 || index >= this.filters.length) return null;
    return this.filters[index];
  }

  public reset(): void {
    for (const f of this.filters) {
      f.reset();
    }
    this.lastModelTimestampMs = 0;
    this.lastMicroTimestampMs = 0;
    this.isRelocalizing = false;
    this.reLocProgress = 1.0;
    this.reLocStartPositions = [];
    this.lastMaxOccludedSec = 0;
  }
}
