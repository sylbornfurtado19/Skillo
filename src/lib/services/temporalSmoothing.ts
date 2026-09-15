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
      this.occludedSec = 0;
      this.visibilityOpacity = 1.0;
      this.lastConfidentPos = { x: obs.x, y: obs.y };

      const measuredVx = (obs.x - this.pos.x) / safeDt;
      const measuredVy = (obs.y - this.pos.y) / safeDt;
      const speed = Math.hypot(measuredVx, measuredVy);

      const speedFactor = Math.max(0, Math.min(1, speed / this.maxSpeed));
      const alpha = this.alphaSlow + (this.alphaFast - this.alphaSlow) * speedFactor;

      const predX = this.pos.x + this.vel.x * safeDt;
      const predY = this.pos.y + this.vel.y * safeDt;

      const smoothedX = alpha * obs.x + (1 - alpha) * predX;
      const smoothedY = alpha * obs.y + (1 - alpha) * predY;

      this.pos = { x: smoothedX, y: smoothedY };
      this.vel = {
        x: this.beta * measuredVx + (1 - this.beta) * this.vel.x,
        y: this.beta * measuredVy + (1 - this.beta) * this.vel.y,
      };

      return {
        pos: { ...this.pos },
        vel: { ...this.vel },
        alphaUsed: alpha,
        opacity: 1.0,
        occludedSec: 0,
      };
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

  public getOpacity(): number {
    return this.visibilityOpacity;
  }

  public getOccludedSec(): number {
    return this.occludedSec;
  }

  public reset(initialPos?: LandmarkPoint2D): void {
    this.pos = initialPos ? { ...initialPos } : null;
    this.vel = { x: 0, y: 0 };
    this.lastConfidentPos = initialPos ? { ...initialPos } : null;
    this.occludedSec = 0;
    this.visibilityOpacity = 1.0;
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

/**
 * Dense Multi-Point Facial Landmark Smoother.
 * Manages per-landmark kinematic filters with per-region specialization,
 * dynamic presets, and global anti-snap re-localization glide.
 */
export class DenseLandmarksSmoother {
  private filters: LandmarkKinematicFilter[] = [];
  private lastTimestampMs: number = 0;
  private currentPreset: TrackingPreset = 'BALANCED';

  // Global anti-snap re-localization state
  private isRelocalizing: boolean = false;
  private reLocProgress: number = 1.0;
  private reLocDurationSec: number = 0.12; // 120ms glide
  private reLocStartPositions: LandmarkPoint2D[] = [];
  private reLocThreshold: number = 0.06; // 0.06 normalized distance threshold (~38px at 640x480)
  private minOcclusionForRelocSec: number = 0.30; // 300ms minimum occlusion hold
  private lastMaxOccludedSec: number = 0;

  constructor(numPoints: number = 68, preset: TrackingPreset = 'BALANCED') {
    this.currentPreset = preset;
    this.initFilters(numPoints);
  }

  public setRelocalizationConfig(config: {
    threshold?: number;
    durationMs?: number;
    minOcclusionSec?: number;
  }) {
    if (config.threshold !== undefined) this.reLocThreshold = config.threshold;
    if (config.durationMs !== undefined) this.reLocDurationSec = Math.max(0.02, config.durationMs / 1000);
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
      this.filters.push(new LandmarkKinematicFilter(configs[region]));
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

    const dt = this.lastTimestampMs > 0
      ? Math.max(0.001, Math.min(0.200, (timestampMs - this.lastTimestampMs) / 1000))
      : 0.033;
    this.lastTimestampMs = timestampMs;

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
          // Trigger global smooth re-localization glide across all landmarks
          this.isRelocalizing = true;
          this.reLocProgress = 0.0;
          this.reLocStartPositions = this.filters.map((f, i) => {
            const p = f.getPos();
            return p ? { ...p } : { x: buffer[i * 4], y: buffer[i * 4 + 1] };
          });
        }
      }
    }

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
    const blend = t * t * (3 - 2 * t); // Hermite cubic smoothstep

    for (let i = 0; i < numPoints; i++) {
      const offset = i * 4;
      let x = buffer[offset];
      let y = buffer[offset + 1];
      const conf = buffer[offset + 3];

      // If global re-localizing, interpolate the observation to glide smoothly
      if (this.isRelocalizing && this.reLocStartPositions[i]) {
        const start = this.reLocStartPositions[i];
        x = start.x + (x - start.x) * blend;
        y = start.y + (y - start.y) * blend;
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

    const dt = this.lastTimestampMs > 0
      ? Math.max(0.001, Math.min(0.200, (timestampMs - this.lastTimestampMs) / 1000))
      : 0.033;
    this.lastTimestampMs = timestampMs;

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
          this.reLocStartPositions = this.filters.map((f, i) => {
            const p = f.getPos();
            return p ? { ...p } : { x: rawPoints[i].x, y: rawPoints[i].y };
          });
        }
      }
    }

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

      if (this.isRelocalizing && this.reLocStartPositions[i]) {
        const start = this.reLocStartPositions[i];
        x = start.x + (x - start.x) * blend;
        y = start.y + (y - start.y) * blend;
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

  public reset(): void {
    for (const f of this.filters) {
      f.reset();
    }
    this.lastTimestampMs = 0;
    this.isRelocalizing = false;
    this.reLocProgress = 1.0;
    this.reLocStartPositions = [];
    this.lastMaxOccludedSec = 0;
  }
}
