/**
 * Main Thread Vision Pipeline Service (visionPipeline.ts)
 *
 * Provides main-thread utility methods for zero-copy ImageBitmap creation,
 * frame transfer, and fallback decision logic.
 */

import type { VisionWorkerInitPayload, VisionWorkerFramePayload } from '@/types/workerMessages';

export class VisionPipeline {
  private static frameCounter = 0;

  /**
   * Converts a HTMLVideoElement or HTMLCanvasElement to a zero-copy ImageBitmap.
   */
  public static async captureFrameBitmap(
    source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
  ): Promise<ImageBitmap | null> {
    try {
      if ('createImageBitmap' in self) {
        return await createImageBitmap(source);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Prepares a frame payload with auto-incremented frame ID.
   */
  public static createFramePayload(
    bitmap: ImageBitmap,
    width: number,
    height: number,
    requestId?: number,
    mirrored?: boolean
  ): VisionWorkerFramePayload {
    this.frameCounter++;
    return {
      requestId: requestId ?? this.frameCounter,
      frameId: this.frameCounter,
      timestampMs: typeof performance !== 'undefined' ? performance.now() : Date.now(),
      imageBitmap: bitmap,
      width,
      height,
      mirrored,
    };
  }

  /**
   * Evaluates browser environment for Web Worker, ImageBitmap, and OffscreenCanvas support.
   */
  public static checkBrowserCapabilities(): {
    supported: boolean;
    hasWorker: boolean;
    hasImageBitmap: boolean;
    hasOffscreenCanvas: boolean;
    hasTransferable: boolean;
    reason?: string;
  } {
    if (typeof window === 'undefined') {
      return { supported: false, hasWorker: false, hasImageBitmap: false, hasOffscreenCanvas: false, hasTransferable: false, reason: 'SSR environment' };
    }
    const hasWorker = typeof Worker !== 'undefined';
    const hasImageBitmap = 'createImageBitmap' in window;
    const hasOffscreenCanvas = 'OffscreenCanvas' in window;
    let hasTransferable = false;
    try {
      const ab = new ArrayBuffer(1);
      hasTransferable = ab.byteLength === 1;
    } catch {
      hasTransferable = false;
    }

    const supported = hasWorker && hasImageBitmap;
    let reason: string | undefined;
    if (!hasWorker) reason = 'Web Workers not supported';
    else if (!hasImageBitmap) reason = 'createImageBitmap not supported';
    else if (!hasOffscreenCanvas) reason = 'OffscreenCanvas not supported; will use canvas context';

    return {
      supported,
      hasWorker,
      hasImageBitmap,
      hasOffscreenCanvas,
      hasTransferable,
      reason,
    };
  }

  /**
   * Returns default initialization payload parameters.
   */
  public static getDefaultInitPayload(): VisionWorkerInitPayload {
    return {
      backend: 'WEBGL',
      enableGaze: true,
      enablePose: true,
      enableAffect: true,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXACT COORDINATE TRANSFORMATION & ASPECT-RATIO NORMALIZATION PIPELINE
// ═══════════════════════════════════════════════════════════════════════════════

export type VideoFitMode = 'contain' | 'cover' | 'fill';

export interface CoordinateMappingParams {
  videoWidth: number;
  videoHeight: number;
  canvasWidth: number;  // CSS display width
  canvasHeight: number; // CSS display height
  fitMode?: VideoFitMode;
  mirrored?: boolean;
}

export interface CoordinateMappingMetrics {
  scale: number;
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
  fitMode: VideoFitMode;
  mirrored: boolean;
  videoWidth: number;
  videoHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * Computes exact letterbox / cover / fill transform parameters.
 * Eliminates spatial drift between model inference space and canvas viewport.
 */
export function computeCoordinateMapping(params: CoordinateMappingParams): CoordinateMappingMetrics {
  const {
    videoWidth,
    videoHeight,
    canvasWidth,
    canvasHeight,
    fitMode = 'contain',
    mirrored = false,
  } = params;

  const vw = Math.max(1, videoWidth);
  const vh = Math.max(1, videoHeight);
  const cw = Math.max(1, canvasWidth);
  const ch = Math.max(1, canvasHeight);

  if (fitMode === 'fill') {
    return {
      scale: 1,
      scaleX: cw / vw,
      scaleY: ch / vh,
      offsetX: 0,
      offsetY: 0,
      fitMode,
      mirrored,
      videoWidth: vw,
      videoHeight: vh,
      canvasWidth: cw,
      canvasHeight: ch,
    };
  }

  const scale = fitMode === 'contain'
    ? Math.min(cw / vw, ch / vh)
    : Math.max(cw / vw, ch / vh);

  const offsetX = (cw - vw * scale) / 2;
  const offsetY = (ch - vh * scale) / 2;

  return {
    scale,
    scaleX: scale,
    scaleY: scale,
    offsetX,
    offsetY,
    fitMode,
    mirrored,
    videoWidth: vw,
    videoHeight: vh,
    canvasWidth: cw,
    canvasHeight: ch,
  };
}

/**
 * Maps a single normalized coordinate [0..1] to high-fidelity canvas viewport pixels.
 */
export function mapNormalizedToCanvas(
  normPoint: { x: number; y: number },
  mapping: CoordinateMappingMetrics
): { x: number; y: number } {
  const normX = mapping.mirrored ? (1.0 - normPoint.x) : normPoint.x;
  const normY = normPoint.y;

  const pixelX = normX * mapping.videoWidth * mapping.scaleX + mapping.offsetX;
  const pixelY = normY * mapping.videoHeight * mapping.scaleY + mapping.offsetY;

  return { x: pixelX, y: pixelY };
}

/**
 * Maps an array of normalized points [0..1] directly to canvas pixels.
 */
export function mapNormalizedPointsToCanvas(
  normPoints: Array<{ x: number; y: number }>,
  mapping: CoordinateMappingMetrics
): Array<{ x: number; y: number }> {
  return normPoints.map(p => mapNormalizedToCanvas(p, mapping));
}

/**
 * Converts a normalized coordinate relative to the PROC canvas (320x240)
 * into a normalized coordinate relative to the full video frame [0..1].
 *
 * When the proc canvas draws the full video frame span:
 * procPixelX = normProcX * PROC_W
 * videoPixelX = (procPixelX / PROC_W) * videoW = normProcX * videoW
 * videoNormX = videoPixelX / videoW = normProcX.
 */
export function procNormalizedToVideoNormalized(
  normProcX: number,
  normProcY: number,
  cropRoi?: { x: number; y: number; width: number; height: number; videoWidth: number; videoHeight: number }
): { x: number; y: number } {
  if (cropRoi && cropRoi.videoWidth > 0 && cropRoi.videoHeight > 0) {
    const videoPixelX = cropRoi.x + normProcX * cropRoi.width;
    const videoPixelY = cropRoi.y + normProcY * cropRoi.height;
    return {
      x: videoPixelX / cropRoi.videoWidth,
      y: videoPixelY / cropRoi.videoHeight,
    };
  }
  return { x: normProcX, y: normProcY };
}

export function procToVideoCoord(normProc: number, procDim?: number, videoDim?: number): number {
  if (procDim !== undefined && videoDim !== undefined) {
    return (normProc * procDim) / Math.max(1, videoDim);
  }
  return normProc;
}

export function videoToProcCoord(normVid: number, procDim?: number, videoDim?: number): number {
  if (procDim !== undefined && videoDim !== undefined) {
    return (normVid * videoDim) / Math.max(1, procDim);
  }
  return normVid;
}

export function procToVideoX(procX: number, procW?: number, videoW?: number): number {
  return procToVideoCoord(procX, procW, videoW);
}

export function procToVideoY(procY: number, procH?: number, videoH?: number): number {
  return procToVideoCoord(procY, procH, videoH);
}

export function videoToProcX(videoX: number, procW?: number, videoW?: number): number {
  return videoToProcCoord(videoX, procW, videoW);
}

export function videoToProcY(videoY: number, procH?: number, videoH?: number): number {
  return videoToProcCoord(videoY, procH, videoH);
}

/**
 * Canonical proc -> pixel -> video normalized conversion.
 * Avoids normalization algebra mistakes by explicitly traversing intermediate pixel space.
 */
export function procToVideoNormalized(
  procX: number,
  procY: number,
  procW: number,
  procH: number,
  videoW: number,
  videoH: number
): { x: number; y: number } {
  const px = procX * procW; // pixel in PROC
  const py = procY * procH;
  return {
    x: px / Math.max(1, videoW),
    y: py / Math.max(1, videoH),
  };
}

/**
 * Inverts canonical video -> pixel -> proc normalized conversion.
 */
export function videoNormalizedToProc(
  videoX: number,
  videoY: number,
  procW: number,
  procH: number,
  videoW: number,
  videoH: number
): { x: number; y: number } {
  const px = videoX * videoW; // pixel in video
  const py = videoY * videoH;
  return {
    x: px / Math.max(1, procW),
    y: py / Math.max(1, procH),
  };
}

// ── Device Profiling & Adaptive Thresholds ──────────────────────────────────
export type CPUTier = 'HIGH' | 'MID' | 'LOW';
export type DeviceClass = 'desktop' | 'tablet' | 'mobile';

export interface AdaptiveTrackingThresholds {
  minApplyNcc: number;
  maxMahalanobisDelta: number;
  faceScaleFactor: number;
  lkMinEigenvalue: number;
  stride: number;
  maxMisses: number;
}

export interface DeviceProfile {
  cpuTier: CPUTier;
  deviceClass: DeviceClass;
  devicePixelRatio: number;
  hardwareConcurrency: number;
  baselineThresholds: AdaptiveTrackingThresholds;
  thresholds: AdaptiveTrackingThresholds;
  computeAdaptiveThresholds: (
    faceBox?: { width: number; height: number },
    videoWidth?: number,
    videoHeight?: number
  ) => AdaptiveTrackingThresholds;
}

/**
 * Online empirical calibration estimator across a rolling window of recent NCC values.
 * Computes median and IQR to adjust threshold: threshold = median + 0.4 * IQR
 */
export class OnlineCalibrationEstimator {
  private samples: number[] = [];
  private readonly maxSamples: number;

  constructor(maxSamples: number = 30) {
    this.maxSamples = maxSamples;
  }

  public addSample(ncc: number): void {
    if (Number.isFinite(ncc) && ncc >= 0 && ncc <= 1) {
      this.samples.push(ncc);
      if (this.samples.length > this.maxSamples) {
        this.samples.shift();
      }
    }
  }

  public getEmpiricalThreshold(baseThreshold: number): number {
    if (this.samples.length < 10) return baseThreshold;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const n = sorted.length;
    const q1 = sorted[Math.floor(n * 0.25)];
    const median = sorted[Math.floor(n * 0.5)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    const empirical = median + 0.4 * iqr;
    return Math.max(0.68, Math.min(0.85, empirical));
  }

  public getThreshold(baseThreshold: number): number {
    return this.getEmpiricalThreshold(baseThreshold);
  }

  public reset(): void {
    this.samples = [];
  }
}

/**
 * Detects current hardware and browser performance capabilities,
 * establishing explainable data-driven thresholds for the IVP pipeline.
 */
export function detectDeviceProfile(): DeviceProfile {
  const isBrowser = typeof window !== 'undefined';
  const dpr = isBrowser ? (window.devicePixelRatio || 1.0) : 1.0;
  const cores = isBrowser ? (navigator.hardwareConcurrency || 4) : 4;

  let deviceClass: DeviceClass = 'desktop';
  if (isBrowser) {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|android(?!.*tablet)|ipod|mobile/i.test(ua)) {
      deviceClass = 'mobile';
    } else if (/ipad|tablet/i.test(ua)) {
      deviceClass = 'tablet';
    }
  }

  let cpuTier: CPUTier = 'HIGH';
  if (cores <= 2 || deviceClass === 'mobile') {
    cpuTier = cores <= 2 ? 'LOW' : 'MID';
  } else if (cores <= 4) {
    cpuTier = 'MID';
  } else {
    cpuTier = 'HIGH';
  }

  const baseNCC = cpuTier === 'HIGH' ? 0.76 : (cpuTier === 'MID' ? 0.73 : 0.70);
  const baseDelta = cpuTier === 'HIGH' ? 0.06 : (cpuTier === 'MID' ? 0.055 : 0.05);
  const stride = cpuTier === 'LOW' ? 2 : 1;
  const maxMisses = cpuTier === 'LOW' ? 4 : 6;
  const lkMinEigenvalue = cpuTier === 'HIGH' ? 8.0 : 5.0;

  const baselineThresholds: AdaptiveTrackingThresholds = {
    minApplyNcc: baseNCC,
    maxMahalanobisDelta: baseDelta,
    faceScaleFactor: 1.0,
    lkMinEigenvalue,
    stride,
    maxMisses,
  };

  return {
    cpuTier,
    deviceClass,
    devicePixelRatio: dpr,
    hardwareConcurrency: cores,
    baselineThresholds,
    thresholds: baselineThresholds,
    computeAdaptiveThresholds: (faceBox, videoWidth = 640, _videoHeight = 480) => {
      let faceScale = 1.0;
      let maxMahalanobisDelta = baseDelta;
      if (faceBox && faceBox.width > 0 && faceBox.height > 0) {
        const faceDiag = Math.hypot(faceBox.width, faceBox.height);
        faceScale = faceDiag / Math.hypot(videoWidth * 0.4, videoWidth * 0.5);
        const baseDeltaPx = faceDiag * 0.035;
        maxMahalanobisDelta = Math.max(0.03, Math.min(0.10, baseDeltaPx / Math.max(1, videoWidth)));
      }
      return {
        minApplyNcc: baseNCC,
        maxMahalanobisDelta,
        faceScaleFactor: faceScale,
        lkMinEigenvalue,
        stride,
        maxMisses,
      };
    },
  };
}


