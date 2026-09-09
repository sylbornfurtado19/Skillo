/**
 * Temporal Motion Energy & Presence Detection Engine
 * Unit 8 Coursework: Inter-frame temporal differencing & motion analysis.
 *
 * Implements:
 * 1. Zero-allocation inter-frame luminance differencing: Δ(x,y) = |Y_t(x,y) - Y_{t-1}(x,y)|.
 * 2. Mean Motion Energy scalar E_t = (1/N) * Σ |Y_t - Y_{t-1}| and Motion Area Ratio.
 * 3. Subject-left-frame detection via temporal persistence of zero motion + low skin mask foreground.
 * 4. Excess-motion / fidgeting detection as an additive signal to posture composure scoring.
 */

export interface MotionEnergyResult {
  /** Mean luminance difference across all sampled pixels [0..255] */
  motionEnergy: number;
  /** Fraction of pixels exceeding noise threshold (e.g. >= 8 px delta) [0..1] */
  motionAreaRatio: number;
  /** Maximum observed pixel delta in current frame [0..255] */
  maxDiff: number;
  /** Whether the subject is actively detected in frame */
  isSubjectPresent: boolean;
  /** Whether movement exceeds steady-state composure bounds (fidgeting) */
  isExcessiveMotion: boolean;
  /** Consecutive frames where subject appeared absent */
  absentFrameCount: number;
}

export interface MotionDetectionConfig {
  /** Pixel noise floor: deltas below this are treated as camera sensor noise (default: 8) */
  noiseThreshold: number;
  /** Motion energy ceiling for stationary micro-movements (default: 6.5) */
  stationaryThreshold: number;
  /** Motion energy threshold for triggering excessive fidgeting warning (default: 8.5) */
  excessiveMotionThreshold: number;
  /** Minimum skin pixel count required to confirm subject presence (default: 50) */
  minSkinPixels: number;
  /** Consecutive frames of zero motion/skin needed to declare subject absent (default: 12) */
  absenceFrameLimit: number;
}

export const DEFAULT_MOTION_CONFIG: MotionDetectionConfig = {
  noiseThreshold: 8,
  stationaryThreshold: 6.5,
  excessiveMotionThreshold: 8.5,
  minSkinPixels: 50,
  absenceFrameLimit: 12,
};

/**
 * Stateful tracker that monitors consecutive frames for presence/absence
 * and computes zero-allocation motion energy scalars.
 */
export class TemporalMotionDetector {
  private prevLuma: Uint8Array | null = null;
  private width = 0;
  private height = 0;
  private absentFrames = 0;
  private config: MotionDetectionConfig;

  constructor(config: Partial<MotionDetectionConfig> = {}) {
    this.config = { ...DEFAULT_MOTION_CONFIG, ...config };
  }

  /**
   * Resets the temporal baseline (e.g. after camera restart or subject change).
   */
  public reset(): void {
    this.prevLuma = null;
    this.absentFrames = 0;
  }

  /**
   * Processes a raw RGBA/BGRA pixel buffer against the previous frame baseline.
   *
   * @param currPixels Uint8ClampedArray or Uint8Array of RGBA values
   * @param width Frame width
   * @param height Frame height
   * @param skinPixelCount Optional skin pixel count from backgroundSegmentation or Otsu mask
   * @returns MotionEnergyResult
   */
  public processFrame(
    currPixels: Uint8ClampedArray | Uint8Array,
    width: number,
    height: number,
    skinPixelCount?: number
  ): MotionEnergyResult {
    const numPixels = width * height;

    // Allocate or resize internal luminance buffer if frame dimensions changed
    if (!this.prevLuma || this.width !== width || this.height !== height) {
      this.prevLuma = new Uint8Array(numPixels);
      this.width = width;
      this.height = height;

      // Initialize previous frame with current luminance
      for (let i = 0; i < numPixels; i++) {
        const idx = i * 4;
        this.prevLuma[i] = (77 * currPixels[idx] + 150 * currPixels[idx + 1] + 29 * currPixels[idx + 2]) >> 8;
      }

      const hasSkin = skinPixelCount === undefined || skinPixelCount >= this.config.minSkinPixels;
      return {
        motionEnergy: 0,
        motionAreaRatio: 0,
        maxDiff: 0,
        isSubjectPresent: hasSkin,
        isExcessiveMotion: false,
        absentFrameCount: 0,
      };
    }

    let sumDiff = 0;
    let maxDiff = 0;
    let motionPixelCount = 0;

    // Sub-sample step = 1 for accurate energy, step = 2 for high frame-rate performance
    const step = width >= 640 ? 2 : 1;
    let sampledCount = 0;

    for (let y = 0; y < height; y += step) {
      const row = y * width;
      for (let x = 0; x < width; x += step) {
        const i = row + x;
        const idx = i * 4;
        const currY = (77 * currPixels[idx] + 150 * currPixels[idx + 1] + 29 * currPixels[idx + 2]) >> 8;
        const prevY = this.prevLuma[i];

        const delta = currY > prevY ? currY - prevY : prevY - currY;
        sumDiff += delta;
        if (delta > maxDiff) maxDiff = delta;

        if (delta >= this.config.noiseThreshold) {
          motionPixelCount++;
        }

        // Update previous frame luminance buffer in-place
        this.prevLuma[i] = currY;
        sampledCount++;
      }
    }

    const motionEnergy = sampledCount > 0 ? Math.round((sumDiff / sampledCount) * 100) / 100 : 0;
    const motionAreaRatio = sampledCount > 0 ? Math.round((motionPixelCount / sampledCount) * 1000) / 1000 : 0;

    // Subject Presence Logic:
    // 1. If skin mask is available and below minimum threshold, increment absence counter.
    // 2. If motion energy is below 0.35 (ambient noise floor) AND skin pixels are low, subject has left frame.
    const lowSkin = skinPixelCount !== undefined && skinPixelCount < this.config.minSkinPixels;
    const nearZeroMotion = motionEnergy < 0.35;

    if (lowSkin || (skinPixelCount === undefined && nearZeroMotion && motionAreaRatio < 0.005)) {
      this.absentFrames++;
    } else {
      // Rapid recovery when motion and skin return
      this.absentFrames = Math.max(0, this.absentFrames - 2);
    }

    const isSubjectPresent = this.absentFrames < this.config.absenceFrameLimit;
    const isExcessiveMotion = isSubjectPresent && motionEnergy >= this.config.excessiveMotionThreshold;

    return {
      motionEnergy,
      motionAreaRatio,
      maxDiff,
      isSubjectPresent,
      isExcessiveMotion,
      absentFrameCount: this.absentFrames,
    };
  }
}

/**
 * Computes a standalone one-shot frame difference scalar without keeping state.
 */
export function computeFrameMotionEnergy(
  currPixels: Uint8ClampedArray | Uint8Array,
  prevPixels: Uint8ClampedArray | Uint8Array | null,
  width: number,
  height: number,
  noiseThreshold = 8
): { motionEnergy: number; motionAreaRatio: number; maxDiff: number } {
  if (!prevPixels) {
    return { motionEnergy: 0, motionAreaRatio: 0, maxDiff: 0 };
  }

  const numPixels = width * height;
  let sumDiff = 0;
  let maxDiff = 0;
  let motionCount = 0;

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const y1 = (77 * currPixels[idx] + 150 * currPixels[idx + 1] + 29 * currPixels[idx + 2]) >> 8;
    const y2 = (77 * prevPixels[idx] + 150 * prevPixels[idx + 1] + 29 * prevPixels[idx + 2]) >> 8;

    const delta = y1 > y2 ? y1 - y2 : y2 - y1;
    sumDiff += delta;
    if (delta > maxDiff) maxDiff = delta;
    if (delta >= noiseThreshold) motionCount++;
  }

  return {
    motionEnergy: numPixels > 0 ? Math.round((sumDiff / numPixels) * 100) / 100 : 0,
    motionAreaRatio: numPixels > 0 ? Math.round((motionCount / numPixels) * 1000) / 1000 : 0,
    maxDiff,
  };
}

/**
 * Fuses head angular velocity and full-frame motion energy into an integrated restlessness metric.
 * Head pose captures rotation; motion energy captures body fidgeting, shifting, and hand gestures.
 */
export function fuseRestlessnessWithMotionEnergy(
  angularRestlessness: number,
  motionEnergy: number,
  weightAngular = 0.60,
  weightMotion = 0.40
): { compositeRestlessness: number; motionContribution: number } {
  // Map motion energy [0..15] to motion restlessness index [0..100]
  // Steady state micro-movements (1-5) -> 5-25% restlessness
  // Moderate fidgeting (6-8) -> 35-55% restlessness
  // High agitation (>9) -> 65-100% restlessness
  const motionRestlessness = Math.min(100, Math.max(0, Math.round((motionEnergy / 10.0) * 100 * 10) / 10));

  const composite = Math.min(
    100,
    Math.max(
      0,
      Math.round((angularRestlessness * weightAngular + motionRestlessness * weightMotion) * 10) / 10
    )
  );

  return {
    compositeRestlessness: composite,
    motionContribution: motionRestlessness,
  };
}
