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
 */
export function procToVideoCoord(normProc: number, procDim: number, videoDim: number): number {
  return (normProc * procDim) / Math.max(1, videoDim);
}

/**
 * Converts a normalized coordinate relative to the full video frame [0..1]
 * into a normalized coordinate relative to the PROC canvas (320x240).
 */
export function videoToProcCoord(normVid: number, procDim: number, videoDim: number): number {
  return (normVid * Math.max(1, videoDim)) / Math.max(1, procDim);
}

export function procToVideoX(procX: number, procW: number, videoW: number): number {
  return procToVideoCoord(procX, procW, videoW);
}

export function procToVideoY(procY: number, procH: number, videoH: number): number {
  return procToVideoCoord(procY, procH, videoH);
}

export function videoToProcX(videoX: number, procW: number, videoW: number): number {
  return videoToProcCoord(videoX, procW, videoW);
}

export function videoToProcY(videoY: number, procH: number, videoH: number): number {
  return videoToProcCoord(videoY, procH, videoH);
}

