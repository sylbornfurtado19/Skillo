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
    height: number
  ): VisionWorkerFramePayload {
    this.frameCounter++;
    return {
      frameId: this.frameCounter,
      timestampMs: Date.now(),
      imageBitmap: bitmap,
      width,
      height,
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
