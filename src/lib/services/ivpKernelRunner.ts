/**
 * Skillo AI - Headless IVP Kernel Runner
 * ====================================================================
 * Executes classical computer vision kernels sequentially on an offscreen
 * 160x120 canvas, generating telemetry stats and low-resolution thumbnails
 * with strict single-threaded non-reentrant safety.
 */

import {
  computeLuminanceHistogram,
  applyHistogramEqualization,
  applyYCrCbOtsuSegmentation,
  applySobelGradientField,
  computeTemporalMAD,
  calculateEAR,
  calculateMAR,
  drawProjected3DAxes,
  histogramMax,
  type FaceRoi,
} from './ivpDiagnosticKernels';
import { renderSegmentedBackground } from './backgroundSegmentation';
import { getRawIVPFeatureFlags, subscribeIVPFeatureFlags, type IVPFeatureFlags } from './ivpFeatureFlags';
import { MicroPatchTracker } from './microPatchTracker';
import { AdaptiveSkinCalibrator } from './adaptiveSkinCalibrator';
import type { KernelSampleStats } from './ivpEvidenceAggregator';
import type { IVPKernelCounts, IVPEvidenceThumbnail } from '@/types/ivpEvidence';

export const RUNNER_WIDTH = 160;
export const RUNNER_HEIGHT = 120;
export const THUMB_WIDTH = 64;
export const THUMB_HEIGHT = 48;

export interface RunnerFrameResult {
  stats: KernelSampleStats;
  thumbnail?: IVPEvidenceThumbnail;
  diagnosticBuffers: {
    equalized: ImageData;
    otsu: ImageData;
    sobel: ImageData;
    motion: ImageData;
  };
}

export class IVPKernelRunner {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private thumbCanvas: HTMLCanvasElement | null = null;
  private thumbCtx: CanvasRenderingContext2D | null = null;

  private srcData: ImageData | null = null;
  private prevData: ImageData | null = null;
  private eqData: ImageData | null = null;
  private otsuData: ImageData | null = null;
  private sobelData: ImageData | null = null;
  private madData: ImageData | null = null;

  private totalFramesAnalyzed = 0;
  private totalKernelTimeMs = 0;
  private kernelCounts: IVPKernelCounts = {
    histogramEq: 0,
    otsuYCrCb: 0,
    sobel: 0,
    temporalMAD: 0,
    earMar: 0,
  };

  private isRunning = false;
  private patchTracker = new MicroPatchTracker();
  private skinCalibrator = new AdaptiveSkinCalibrator();

  constructor() {
    this.initBuffers();
  }

  private initBuffers(): void {
    if (typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas');
      this.canvas.width = RUNNER_WIDTH;
      this.canvas.height = RUNNER_HEIGHT;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

      this.thumbCanvas = document.createElement('canvas');
      this.thumbCanvas.width = THUMB_WIDTH;
      this.thumbCanvas.height = THUMB_HEIGHT;
      this.thumbCtx = this.thumbCanvas.getContext('2d');
    }

    // Allocate reusable ImageDatas
    const numPixels = RUNNER_WIDTH * RUNNER_HEIGHT;
    this.srcData = this.createEmptyImageData(RUNNER_WIDTH, RUNNER_HEIGHT);
    this.prevData = this.createEmptyImageData(RUNNER_WIDTH, RUNNER_HEIGHT);
    this.eqData = this.createEmptyImageData(RUNNER_WIDTH, RUNNER_HEIGHT);
    this.otsuData = this.createEmptyImageData(RUNNER_WIDTH, RUNNER_HEIGHT);
    this.sobelData = this.createEmptyImageData(RUNNER_WIDTH, RUNNER_HEIGHT);
    this.madData = this.createEmptyImageData(RUNNER_WIDTH, RUNNER_HEIGHT);
  }

  private createEmptyImageData(w: number, h: number): ImageData {
    if (typeof ImageData !== 'undefined') {
      return new ImageData(w, h);
    }
    // Node.js test environment mock
    return {
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
      colorSpace: 'srgb',
    } as ImageData;
  }

  /**
   * Resets all running history and inter-frame motion states.
   */
  public reset(): void {
    this.totalFramesAnalyzed = 0;
    this.totalKernelTimeMs = 0;
    this.kernelCounts = {
      histogramEq: 0,
      otsuYCrCb: 0,
      sobel: 0,
      temporalMAD: 0,
      earMar: 0,
    };
    if (this.prevData) {
      this.prevData.data.fill(0);
    }
    this.skinCalibrator.reset();
    this.isRunning = false;
  }

  public getSkinCalibrator(): AdaptiveSkinCalibrator {
    return this.skinCalibrator;
  }

  /**
   * Increment EAR/MAR call counter.
   */
  public recordEarMarPass(): void {
    this.kernelCounts.earMar += 1;
  }

  public getKernelCounts(): IVPKernelCounts {
    return { ...this.kernelCounts };
  }

  public getFramesAnalyzed(): number {
    return this.totalFramesAnalyzed;
  }

  public getAvgKernelMs(): number {
    return this.totalFramesAnalyzed > 0
      ? Math.round((this.totalKernelTimeMs / this.totalFramesAnalyzed) * 100) / 100
      : 0;
  }

  public getPatchTracker(): MicroPatchTracker {
    return this.patchTracker;
  }

  public getHistogramPeak(hist: Uint32Array): number {
    return histogramMax(hist);
  }

  public computeLandmarkApertures(landmarks: Array<{ x: number; y: number }>): { ear: number; mar: number } {
    return {
      ear: calculateEAR(landmarks),
      mar: calculateMAR(landmarks),
    };
  }

  public renderPoseProjection(
    ctx: CanvasRenderingContext2D,
    originX: number,
    originY: number,
    yawRad: number,
    pitchRad: number,
    rollRad: number,
    axisLength?: number
  ): void {
    drawProjected3DAxes(ctx, originX, originY, yawRad, pitchRad, rollRad, axisLength);
  }

  public renderSegmentedForeground(
    outputCtx: CanvasRenderingContext2D,
    srcCtx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    renderSegmentedBackground(outputCtx, srcCtx, width, height);
  }

  public getActiveFeatureFlags(): IVPFeatureFlags {
    return getRawIVPFeatureFlags();
  }

  public onFeatureFlagsChange(callback: (flags: IVPFeatureFlags) => void): () => void {
    return subscribeIVPFeatureFlags(callback);
  }

  /**
   * Executes the 5 classical computer vision kernels sequentially.
   * Enforces non-reentrant execution per Devil's Advocate D11.
   */
  public executeFrame(
    source: HTMLVideoElement | ImageData,
    options: {
      faceRoi?: FaceRoi | null;
      faceDetected?: boolean | null;
      captureThumbKind?: 'equalized' | 'otsu' | 'sobel' | 'motion';
      evidenceId?: string;
      blinkRatePerMin?: number;
      isMouthActive?: boolean;
    } = {}
  ): RunnerFrameResult {
    if (this.isRunning) {
      throw new Error('[IVPKernelRunner] Re-entrant call detected! Scratch buffers are single-threaded.');
    }
    this.isRunning = true;
    const t0 = performance.now();

    try {
      // 1. Prepare input ImageData buffer at 160x120
      if ('data' in source) {
        // Source is already an ImageData (e.g. from unit tests)
        if (source.width === RUNNER_WIDTH && source.height === RUNNER_HEIGHT) {
          this.srcData!.data.set(source.data);
        } else {
          // Copy or resize
          this.srcData!.data.fill(0);
          const copyLen = Math.min(this.srcData!.data.length, source.data.length);
          this.srcData!.data.set(source.data.subarray(0, copyLen));
        }
      } else if (this.ctx) {
        // Source is HTMLVideoElement
        this.ctx.drawImage(source, 0, 0, RUNNER_WIDTH, RUNNER_HEIGHT);
        const read = this.ctx.getImageData(0, 0, RUNNER_WIDTH, RUNNER_HEIGHT);
        this.srcData!.data.set(read.data);
      }

      // Adaptive skin chrominance calibration on confirmed face detections
      this.skinCalibrator.addFrame(
        this.srcData!,
        RUNNER_WIDTH,
        RUNNER_HEIGHT,
        options.faceRoi,
        options.faceDetected
      );
      const skinRange = this.skinCalibrator.getRange();

      // 2. Unit 2: Luminance Histogram Analysis
      const histRes = computeLuminanceHistogram(this.srcData!, RUNNER_WIDTH, RUNNER_HEIGHT);

      // 3. Unit 2: Histogram Equalization
      applyHistogramEqualization(this.srcData!, this.eqData!, RUNNER_WIDTH, RUNNER_HEIGHT);
      this.kernelCounts.histogramEq += 1;

      // 4. Units 6 & 7: YCrCb Chrominance & Otsu Segmentation
      const otsuRes = applyYCrCbOtsuSegmentation(
        this.srcData!,
        this.otsuData!,
        RUNNER_WIDTH,
        RUNNER_HEIGHT,
        options.faceRoi,
        skinRange
      );
      this.kernelCounts.otsuYCrCb += 1;

      // 5. Units 4 & 5: Sobel Spatial Convolutions
      const sobelRes = applySobelGradientField(
        this.srcData!,
        this.sobelData!,
        RUNNER_WIDTH,
        RUNNER_HEIGHT,
        true
      );
      this.kernelCounts.sobel += 1;

      // 6. Unit 8: Inter-frame Temporal MAD Motion Heatmap
      const madRes = computeTemporalMAD(
        this.srcData!,
        this.totalFramesAnalyzed === 0 ? null : this.prevData,
        this.madData!,
        RUNNER_WIDTH,
        RUNNER_HEIGHT
      );
      this.kernelCounts.temporalMAD += 1;

      // Update prev buffer for next frame's motion differencing
      this.prevData!.data.set(this.srcData!.data);

      const elapsedMs = performance.now() - t0;
      this.totalFramesAnalyzed += 1;
      this.totalKernelTimeMs += elapsedMs;

      // 7. Calculate clipped pixels (underexposed 0s and overexposed 255s)
      const numPixels = RUNNER_WIDTH * RUNNER_HEIGHT;
      const clippedPixels = (histRes.hist[0] || 0) + (histRes.hist[255] || 0);
      const clippedPct = (clippedPixels / numPixels) * 100;

      const stats: KernelSampleStats = {
        meanLuminance: histRes.meanVal,
        minVal: histRes.minVal,
        maxVal: histRes.maxVal,
        clippedPixelsPct: clippedPct,
        skinPixelRatio: otsuRes.skinPixelRatio / 100,
        skinMaskCoverage: (otsuRes.skinMaskCoverage ?? otsuRes.skinPixelRatio) / 100,
        faceDetected: options.faceDetected,
        sobelMeanMagnitude: sobelRes.meanMagnitude,
        sobelEdgeRatio: sobelRes.edgePixelRatio / 100,
        madScore: madRes.madScore,
        blinkRatePerMin: options.blinkRatePerMin,
        isMouthActive: options.isMouthActive,
        kernelDurationMs: elapsedMs,
      };

      // 8. Capture low-res thumbnail if requested (dataUrl from offscreen thumbnail canvas)
      let thumbnail: IVPEvidenceThumbnail | undefined;
      if (options.captureThumbKind && options.evidenceId && this.thumbCtx && this.thumbCanvas) {
        let chosenBuffer = this.sobelData!;
        if (options.captureThumbKind === 'otsu') chosenBuffer = this.otsuData!;
        else if (options.captureThumbKind === 'equalized') chosenBuffer = this.eqData!;
        else if (options.captureThumbKind === 'motion') chosenBuffer = this.madData!;

        if (this.ctx) {
          this.ctx.putImageData(chosenBuffer, 0, 0);
          this.thumbCtx.drawImage(
            this.canvas!,
            0,
            0,
            RUNNER_WIDTH,
            RUNNER_HEIGHT,
            0,
            0,
            THUMB_WIDTH,
            THUMB_HEIGHT
          );
          thumbnail = {
            evidenceId: options.evidenceId,
            kind: options.captureThumbKind,
            dataUrl: this.thumbCanvas.toDataURL('image/webp', 0.6),
          };
        }
      }

      return {
        stats,
        thumbnail,
        diagnosticBuffers: {
          equalized: this.eqData!,
          otsu: this.otsuData!,
          sobel: this.sobelData!,
          motion: this.madData!,
        },
      };
    } finally {
      this.isRunning = false;
    }
  }
}
