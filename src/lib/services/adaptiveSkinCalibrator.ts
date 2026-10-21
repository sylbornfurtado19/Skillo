/**
 * adaptiveSkinCalibrator.ts
 *
 * ISSUE-04: Adaptive Skin Chrominance Calibrator
 *
 * Replaces rigid, fixed YCrCb skin thresholds (which cause racial bias against
 * darker skin tones and miscalibration in office lighting) with candidate-specific
 * chrominance ranges derived from confirmed MediaPipe face detections.
 *
 * During the first N confirmed-face frames, Cr and Cb values inside the MediaPipe
 * face bounding box are sampled. Percentiles 5-95 are computed and widened by a
 * configurable margin to establish candidate-specific bounds. Falls back to default
 * inclusive biological ranges until calibrated.
 */

import type { FaceRoi } from './ivpDiagnosticKernels';

export interface SkinChrominanceRange {
  crMin: number;
  crMax: number;
  cbMin: number;
  cbMax: number;
}

/** Default biological chrominance range used prior to calibration */
export const DEFAULT_SKIN_RANGE: SkinChrominanceRange = {
  crMin: 133,
  crMax: 180,
  cbMin: 75,
  cbMax: 130,
};

export class AdaptiveSkinCalibrator {
  private targetFrames: number;
  private margin: number;
  private crSamples: number[] = [];
  private cbSamples: number[] = [];
  private confirmedFrames = 0;
  private calibratedRange: SkinChrominanceRange | null = null;

  constructor(targetFrames = 10, margin = 12) {
    this.targetFrames = Math.max(1, targetFrames);
    this.margin = Math.max(0, margin);
  }

  get isCalibrated(): boolean {
    return this.calibratedRange !== null;
  }

  getRange(): SkinChrominanceRange {
    return this.calibratedRange ?? DEFAULT_SKIN_RANGE;
  }

  getConfirmedFrames(): number {
    return this.confirmedFrames;
  }

  addFrame(
    srcData: ImageData,
    width: number,
    height: number,
    faceRoi: FaceRoi | null | undefined,
    faceDetected?: boolean | null
  ): void {
    if (!faceDetected || !faceRoi) return;
    if (this.isCalibrated) return;

    // Resolve pixel coordinates for face ROI
    const fx = faceRoi.width <= 1.0 ? faceRoi.x * width : faceRoi.x;
    const fy = faceRoi.height <= 1.0 ? faceRoi.y * height : faceRoi.y;
    const fw = faceRoi.width <= 1.0 ? faceRoi.width * width : faceRoi.width;
    const fh = faceRoi.height <= 1.0 ? faceRoi.height * height : faceRoi.height;

    // Sample central 60% of the face ROI to avoid hair, collar, and background
    const xStart = Math.max(0, Math.round(fx + fw * 0.2));
    const xEnd = Math.min(width - 1, Math.round(fx + fw * 0.8));
    const yStart = Math.max(0, Math.round(fy + fh * 0.2));
    const yEnd = Math.min(height - 1, Math.round(fy + fh * 0.8));

    if (xEnd <= xStart || yEnd <= yStart) return;

    const src = srcData.data;
    for (let py = yStart; py <= yEnd; py++) {
      const row = py * width;
      for (let px = xStart; px <= xEnd; px++) {
        const idx = (row + px) * 4;
        const r = src[idx];
        const g = src[idx + 1];
        const b = src[idx + 2];

        // BT.601 RGB -> YCrCb integer conversion
        const cr = Math.min(255, Math.max(0, (32768 + 128 * r - 107 * g - 21 * b) >> 8));
        const cb = Math.min(255, Math.max(0, (32768 - 43 * r - 85 * g + 128 * b) >> 8));

        this.crSamples.push(cr);
        this.cbSamples.push(cb);
      }
    }

    this.confirmedFrames++;
    if (this.confirmedFrames >= this.targetFrames && this.crSamples.length >= 10) {
      this.calibrate();
    }
  }

  calibrate(): void {
    if (this.crSamples.length === 0 || this.cbSamples.length === 0) return;

    this.crSamples.sort((a, b) => a - b);
    this.cbSamples.sort((a, b) => a - b);

    const nCr = this.crSamples.length;
    const nCb = this.cbSamples.length;

    // 5th and 95th percentiles to reject outliers / shadows
    const crP5 = this.crSamples[Math.floor(nCr * 0.05)];
    const crP95 = this.crSamples[Math.min(nCr - 1, Math.floor(nCr * 0.95))];
    const cbP5 = this.cbSamples[Math.floor(nCb * 0.05)];
    const cbP95 = this.cbSamples[Math.min(nCb - 1, Math.floor(nCb * 0.95))];

    this.calibratedRange = {
      crMin: Math.max(0, crP5 - this.margin),
      crMax: Math.min(255, crP95 + this.margin),
      cbMin: Math.max(0, cbP5 - this.margin),
      cbMax: Math.min(255, cbP95 + this.margin),
    };
  }

  reset(): void {
    this.crSamples = [];
    this.cbSamples = [];
    this.confirmedFrames = 0;
    this.calibratedRange = null;
  }
}
