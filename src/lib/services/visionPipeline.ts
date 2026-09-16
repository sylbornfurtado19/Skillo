/**
 * Main Thread Vision Pipeline Service (visionPipeline.ts)
 *
 * Provides main-thread utility methods for zero-copy ImageBitmap creation,
 * frame transfer, and fallback decision logic.
 */

import type { VisionWorkerInitPayload, VisionWorkerFramePayload } from '@/types/workerMessages';
import { PCAShapePrior } from './temporalSmoothing';

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

// ─────────────────────────────────────────────────────────────────────────────
// Fast Bootstrap Face Detector — Otsu-on-Cr Skin Segmentation Pipeline
//
// Architecture:
//  1. Extract Cr and Cb channels (integer BT.601 arithmetic)
//  2. Gaussian blur Cr (3×3 separable) to smooth noise before histogram
//  3. Otsu threshold on blurred Cr → adaptive T_cr
//  4. Binary mask = blurredCr >= T_cr AND Cb in [77,127] AND Cr in [130,190]
//  5. Morphological opening (erode3x3 → dilate3x3) to remove speckles
//  6. Morphological closing (dilate3x3 → erode3x3) to fill holes
//  7. BFS connected-components → blob candidates
//  8. Filter by area fraction [0.01, 0.55], aspect ratio [0.35, 2.8]
//  9. Sobel edge-density gate (mean |∇| inside bbox >= MIN_EDGE_DENSITY)
// 10. Select largest qualifying blob → face box
// 11. Fallback: if no blob qualifies, revert to original fixed-range path
//
// All intermediate buffers are module-scoped and reused; no per-frame GC.
// Target: < 1.8 ms total at 160×120 (measured on mid-tier device).
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum supported PROC resolution for static buffer sizing. */
const _BOOT_MAX_PIX = 320 * 240; // 76 800 – covers 160×120 and 320×240

const _crBuf    = new Uint8ClampedArray(_BOOT_MAX_PIX);
const _cbBuf    = new Uint8ClampedArray(_BOOT_MAX_PIX);
const _blurTmp  = new Uint8ClampedArray(_BOOT_MAX_PIX);
const _blurOut  = new Uint8ClampedArray(_BOOT_MAX_PIX);
const _mask     = new Uint8ClampedArray(_BOOT_MAX_PIX);
const _morphTmp = new Uint8ClampedArray(_BOOT_MAX_PIX);
const _labels   = new Int32Array(_BOOT_MAX_PIX);

/** Minimum mean absolute Sobel magnitude required inside a face blob. */
const MIN_EDGE_DENSITY = 7.0;

// ── Sub-utilities (pure, no closures, inlineable) ────────────────────────────

/**
 * Extracts Cr and Cb channels from RGBA pixel data using integer BT.601.
 * Cr = 128 + (128R - 107G - 21B) >> 8    (clamped 0–255)
 * Cb = 128 + (-43R  -  85G + 128B) >> 8   (clamped 0–255)
 */
function _extractCrCb(
  rgba: Uint8ClampedArray,
  len: number,          // pixel count (width * height)
  crOut: Uint8ClampedArray,
  cbOut: Uint8ClampedArray,
): void {
  for (let p = 0, i = 0; p < len; p++, i += 4) {
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    let crv = 128 + ((128 * r - 107 * g - 21 * b) >> 8);
    let cbv = 128 + ((-43 * r -  85 * g + 128 * b) >> 8);
    crOut[p] = crv < 0 ? 0 : crv > 255 ? 255 : crv;
    cbOut[p] = cbv < 0 ? 0 : cbv > 255 ? 255 : cbv;
  }
}

/**
 * Separable 3×3 Gaussian [1 2 1]/4 blur on a single-channel Uint8ClampedArray.
 * Writes result into `outBuf`; uses `tmpBuf` as scratch (both caller-provided).
 */
function _gaussianBlur3(
  src: Uint8ClampedArray,
  w: number, h: number,
  tmpBuf: Uint8ClampedArray,
  outBuf: Uint8ClampedArray,
): void {
  // Horizontal pass: src → tmpBuf
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const a = src[row + (x > 0     ? x - 1 : 0)];
      const b = src[row + x];
      const c = src[row + (x < w - 1 ? x + 1 : x)];
      tmpBuf[row + x] = (a + 2 * b + c) >> 2;
    }
  }
  // Vertical pass: tmpBuf → outBuf
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const idx = y * w + x;
      const a = tmpBuf[(y > 0     ? y - 1 : 0) * w + x];
      const b = tmpBuf[idx];
      const c = tmpBuf[(y < h - 1 ? y + 1 : y) * w + x];
      outBuf[idx] = (a + 2 * b + c) >> 2;
    }
  }
}

/**
 * Otsu's method on an 8-bit grayscale buffer.
 * Maximises inter-class variance → returns optimal threshold T in [0, 255].
 */
function _otsuThreshold(gray: Uint8ClampedArray, len: number): number {
  const hist = new Uint32Array(256);
  for (let i = 0; i < len; i++) hist[gray[i]]++;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, maxBetween = 0, thresh = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = len - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxBetween) { maxBetween = between; thresh = t; }
  }
  return thresh;
}

/**
 * 4-connected 3×3 morphological erosion (min in 5-pixel cross neighbourhood).
 * Reads `src`, writes `dst` — caller must ensure distinct buffers.
 */
function _erode3(
  src: Uint8ClampedArray, w: number, h: number,
  dst: Uint8ClampedArray,
): void {
  const len = w * h;
  for (let i = 0; i < len; i++) {
    if (src[i] === 0) { dst[i] = 0; continue; }
    const x = i % w, y = (i / w) | 0;
    const left  = x > 0     ? src[i - 1] : 0;
    const right = x < w - 1 ? src[i + 1] : 0;
    const up    = y > 0     ? src[i - w] : 0;
    const down  = y < h - 1 ? src[i + w] : 0;
    dst[i] = (src[i] & left & right & up & down) ? 1 : 0;
  }
}

/**
 * 4-connected 3×3 morphological dilation (max in 5-pixel cross neighbourhood).
 */
function _dilate3(
  src: Uint8ClampedArray, w: number, h: number,
  dst: Uint8ClampedArray,
): void {
  const len = w * h;
  for (let i = 0; i < len; i++) {
    if (src[i]) { dst[i] = 1; continue; }
    const x = i % w, y = (i / w) | 0;
    const left  = x > 0     ? src[i - 1] : 0;
    const right = x < w - 1 ? src[i + 1] : 0;
    const up    = y > 0     ? src[i - w] : 0;
    const down  = y < h - 1 ? src[i + w] : 0;
    dst[i] = (left | right | up | down) ? 1 : 0;
  }
}

/** Copies src into dst (same length). */
function _copyBuf(src: Uint8ClampedArray, dst: Uint8ClampedArray, len: number): void {
  for (let i = 0; i < len; i++) dst[i] = src[i];
}

/**
 * Computes mean absolute Sobel magnitude (Gx + Gy approximation) inside a
 * rectangular bounding box of the RGBA image.  Returns 0.0 if the box is empty.
 * Samples at `step` stride for speed (2 is fine at 160×120).
 */
function _edgeDensityInBox(
  rgba: Uint8ClampedArray,
  imgW: number, imgH: number,
  bx0: number, by0: number, bx1: number, by1: number,
  step = 2,
): number {
  let sum = 0, count = 0;
  const x0 = Math.max(1, bx0), y0 = Math.max(1, by0);
  const x1 = Math.min(imgW - 2, bx1), y1 = Math.min(imgH - 2, by1);
  for (let y = y0; y <= y1; y += step) {
    for (let x = x0; x <= x1; x += step) {
      // Sample luma only
      const i    = (y * imgW + x) << 2;
      const iN   = ((y - 1) * imgW + x) << 2;
      const iS   = ((y + 1) * imgW + x) << 2;
      const iE   = (y * imgW + (x + 1)) << 2;
      const iW   = (y * imgW + (x - 1)) << 2;
      const luma = (c: number) => (77 * rgba[c] + 150 * rgba[c + 1] + 29 * rgba[c + 2]) >> 8;
      const gx = luma(iE) - luma(iW);
      const gy = luma(iS) - luma(iN);
      sum += Math.abs(gx) + Math.abs(gy); // L1 Sobel approx
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

// ── FastFaceBootstrapResult ──────────────────────────────────────────────────

export interface FastFaceBootstrapResult {
  detected: boolean;
  box: { x: number; y: number; width: number; height: number }; // normalized [0..1]
  rightPupil: { x: number; y: number }; // normalized [0..1]
  leftPupil: { x: number; y: number };  // normalized [0..1]
  mouthRight: { x: number; y: number }; // normalized [0..1]
  mouthLeft: { x: number; y: number };  // normalized [0..1]
  noseTip: { x: number; y: number };    // normalized [0..1]
  confidence: number;
  approxLandmarks: Array<{ x: number; y: number; confidence: number }>;
  // ── Diagnostic fields (visible in debug HUD) ────────────────────────────
  otsuThresholdCr: number;        // Otsu T_cr used (or 0 if fallback)
  maskCoverageFraction: number;   // fraction of pixels inside final skin mask
  selectedBlobAspect: number;     // width/height of chosen blob (or 0 if fallback)
  edgeDensity: number;            // mean L1 Sobel magnitude inside face bbox
  detectionMethod: 'OTSU' | 'FIXED_RANGE_FALLBACK';
}

// ── Main detector ────────────────────────────────────────────────────────────

/**
 * High-speed main-thread face detector running in < 2 ms on 160×120 scratch.
 *
 * Primary path: Otsu-on-Cr with morphological filtering + BFS blobs.
 * Fallback path: original fixed-range YCrCb heuristic (fast, ~0.3 ms).
 */
export function detectFastFaceBootstrap(
  sourceData: ImageData | Uint8ClampedArray,
  width: number,
  height: number,
  mirrored: boolean = false,
): FastFaceBootstrapResult | null {
  const data = sourceData instanceof Uint8ClampedArray ? sourceData : sourceData.data;
  if (width < 32 || height < 32 || data.length < width * height * 4) return null;

  const numPix = width * height;

  // ── OTSU PRIMARY PATH ────────────────────────────────────────────────────

  // Ensure module-level buffers are large enough (lazy realloc guard).
  // In practice PROC_W * PROC_H <= 320*240, so this branch never fires.
  const crBuf    = numPix <= _BOOT_MAX_PIX ? _crBuf    : new Uint8ClampedArray(numPix);
  const cbBuf    = numPix <= _BOOT_MAX_PIX ? _cbBuf    : new Uint8ClampedArray(numPix);
  const blurTmp  = numPix <= _BOOT_MAX_PIX ? _blurTmp  : new Uint8ClampedArray(numPix);
  const blurOut  = numPix <= _BOOT_MAX_PIX ? _blurOut  : new Uint8ClampedArray(numPix);
  const mask     = numPix <= _BOOT_MAX_PIX ? _mask     : new Uint8ClampedArray(numPix);
  const morphTmp = numPix <= _BOOT_MAX_PIX ? _morphTmp : new Uint8ClampedArray(numPix);
  const labels   = numPix <= _BOOT_MAX_PIX ? _labels   : new Int32Array(numPix);

  // Step 1: Extract Cr and Cb
  _extractCrCb(data, numPix, crBuf, cbBuf);

  // Step 2: Gaussian blur Cr to reduce impulse noise before histogram
  _gaussianBlur3(crBuf, width, height, blurTmp, blurOut);

  // Step 3: Otsu threshold on blurred Cr
  const tCr = _otsuThreshold(blurOut, numPix);

  // Step 4: Binary mask = blurredCr >= tCr AND Cb in [77,127] AND Cr in [130,190]
  //   • The Cb / Cr hard ranges act as a loose sanity filter, not a classifier.
  //     They are intentionally wider than the old fixed-range heuristic so
  //     darker and lighter skin tones still pass.
  let rawMaskCount = 0;
  for (let p = 0; p < numPix; p++) {
    const crv = crBuf[p], cbv = cbBuf[p];
    mask[p] = (blurOut[p] >= tCr && cbv >= 77 && cbv <= 127 && crv >= 130 && crv <= 190) ? 1 : 0;
    if (mask[p]) rawMaskCount++;
  }

  // Step 5: Morphological opening (erode → dilate) — removes speckles
  _erode3(mask, width, height, morphTmp);
  _dilate3(morphTmp, width, height, mask);

  // Step 6: Morphological closing (dilate → erode) — fills holes
  _dilate3(mask, width, height, morphTmp);
  _erode3(morphTmp, width, height, mask);

  // Step 7: BFS connected components
  labels.fill(0, 0, numPix);
  type BlobInfo = { label: number; area: number; minX: number; minY: number; maxX: number; maxY: number; };
  const blobs: BlobInfo[] = [];
  let nextLabel = 1;
  const queue: number[] = [];

  for (let i = 0; i < numPix; i++) {
    if (mask[i] && labels[i] === 0) {
      let area = 0, bMinX = width, bMinY = height, bMaxX = 0, bMaxY = 0;
      labels[i] = nextLabel;
      queue.length = 0;
      queue.push(i);
      let qi = 0;
      while (qi < queue.length) {
        const idx = queue[qi++];
        area++;
        const px = idx % width;
        const py = (idx / width) | 0;
        if (px < bMinX) bMinX = px;
        if (px > bMaxX) bMaxX = px;
        if (py < bMinY) bMinY = py;
        if (py > bMaxY) bMaxY = py;
        // 4-connected neighbours
        const nbrs = [idx - 1, idx + 1, idx - width, idx + width];
        for (let n = 0; n < 4; n++) {
          const ni = nbrs[n];
          if (ni >= 0 && ni < numPix && mask[ni] && labels[ni] === 0) {
            // Boundary guard for left/right wrap
            if (n === 0 && px === 0) continue;
            if (n === 1 && px === width - 1) continue;
            labels[ni] = nextLabel;
            queue.push(ni);
          }
        }
      }
      blobs.push({ label: nextLabel, area, minX: bMinX, minY: bMinY, maxX: bMaxX, maxY: bMaxY });
      nextLabel++;
    }
  }

  // Step 8: Filter blobs by area fraction and aspect ratio
  blobs.sort((a, b) => b.area - a.area);

  const maskCovFraction = rawMaskCount / numPix;
  let chosen: BlobInfo | null = null;
  let chosenAspect = 0;
  let chosenEdge = 0;

  for (const blob of blobs) {
    const areaFrac = blob.area / numPix;
    if (areaFrac < 0.01 || areaFrac > 0.55) continue; // too small or fills frame
    const bw = blob.maxX - blob.minX + 1;
    const bh = blob.maxY - blob.minY + 1;
    const aspect = bw / Math.max(1, bh);
    if (aspect < 0.35 || aspect > 2.8) continue; // not face-like shape

    // Step 9: Edge-density gate — reject flat non-face blobs (walls, shirts)
    const ed = _edgeDensityInBox(data, width, height, blob.minX, blob.minY, blob.maxX, blob.maxY, 2);
    if (ed < MIN_EDGE_DENSITY) continue;

    chosen = blob;
    chosenAspect = aspect;
    chosenEdge = ed;
    break; // blobs are sorted by area; first qualifying = largest face-like region
  }

  // ── FALLBACK: fixed-range heuristic if Otsu produces no valid blob ────────

  if (!chosen) {
    return _fixedRangeFallback(data, width, height, numPix, mirrored, maskCovFraction, tCr);
  }

  // ── OTSU PATH: derive face metrics from chosen blob ─────────────────────

  const bMinX = chosen.minX, bMinY = chosen.minY;
  const bMaxX = chosen.maxX, bMaxY = chosen.maxY;
  const bw = bMaxX - bMinX + 1;
  const bh = bMaxY - bMinY + 1;
  const cx = (bMinX + bMaxX) / 2;
  const cy = (bMinY + bMaxY) / 2;

  // Normalized face bounding box with small padding
  const padX = bw * 0.08, padY = bh * 0.08;
  const normBoxX = Math.max(0, (bMinX - padX) / width);
  const normBoxY = Math.max(0, (bMinY - padY) / height);
  const normBoxW = Math.min(1.0 - normBoxX, (bw + 2 * padX) / width);
  const normBoxH = Math.min(1.0 - normBoxY, (bh + 2 * padY) / height);

  // Pupil refinement by local darkness minimum
  const eyeBandY = Math.round(cy - bh * 0.15);
  const rEyeInitX = Math.round(cx - bw * 0.18);
  const lEyeInitX = Math.round(cx + bw * 0.18);
  const pupilRadius = Math.round(bw * 0.08);

  const refineDarkness = (initX: number, initY: number, radius: number) => {
    let minL = 256, bestX = initX, bestY = initY;
    const x0 = Math.max(0, initX - radius), x1 = Math.min(width - 1, initX + radius);
    const y0 = Math.max(0, initY - radius), y1 = Math.min(height - 1, initY + radius);
    for (let py = y0; py <= y1; py++) {
      const row = py * width;
      for (let px = x0; px <= x1; px++) {
        const i4 = (row + px) << 2;
        const l = (77 * data[i4] + 150 * data[i4 + 1] + 29 * data[i4 + 2]) >> 8;
        if (l < minL) { minL = l; bestX = px; bestY = py; }
      }
    }
    return { x: bestX / width, y: bestY / height };
  };

  const rightPupil  = refineDarkness(rEyeInitX, eyeBandY, pupilRadius);
  const leftPupil   = refineDarkness(lEyeInitX, eyeBandY, pupilRadius);
  const mouthBandY  = Math.round(cy + bh * 0.22);
  const mouthRight  = { x: Math.round(cx - bw * 0.16) / width, y: mouthBandY / height };
  const mouthLeft   = { x: Math.round(cx + bw * 0.16) / width, y: mouthBandY / height };
  const noseTip     = { x: cx / width, y: (cy + bh * 0.05) / height };

  const flipX = (nx: number) => mirrored ? 1.0 - nx : nx;
  const skinFraction = chosen.area / numPix;

  const approxLandmarks: Array<{ x: number; y: number; confidence: number }> = [];
  const meanShape = PCAShapePrior.getMeanShape();
  for (let i = 0; i < 70; i++) {
    const ms = meanShape[i];
    let lx = normBoxX + ms.x * normBoxW;
    let ly = normBoxY + ms.y * normBoxH;
    let conf = 0.75;
    if (i === 68) { lx = rightPupil.x; ly = rightPupil.y; conf = 0.87; }
    else if (i === 69) { lx = leftPupil.x;  ly = leftPupil.y;  conf = 0.87; }
    else if (i === 48) { lx = mouthRight.x; ly = mouthRight.y; conf = 0.82; }
    else if (i === 54) { lx = mouthLeft.x;  ly = mouthLeft.y;  conf = 0.82; }
    else if (i === 33) { lx = noseTip.x;    ly = noseTip.y;    conf = 0.82; }
    approxLandmarks.push({ x: flipX(lx), y: ly, confidence: conf });
  }

  return {
    detected: true,
    box: {
      x: flipX(normBoxX + (mirrored ? normBoxW : 0)),
      y: normBoxY,
      width: normBoxW,
      height: normBoxH,
    },
    rightPupil:  { x: flipX(rightPupil.x),  y: rightPupil.y  },
    leftPupil:   { x: flipX(leftPupil.x),   y: leftPupil.y   },
    mouthRight:  { x: flipX(mouthRight.x),  y: mouthRight.y  },
    mouthLeft:   { x: flipX(mouthLeft.x),   y: mouthLeft.y   },
    noseTip:     { x: flipX(noseTip.x),     y: noseTip.y     },
    confidence: Math.min(0.90, 0.55 + skinFraction * 0.55),
    approxLandmarks,
    otsuThresholdCr:      tCr,
    maskCoverageFraction: maskCovFraction,
    selectedBlobAspect:   chosenAspect,
    edgeDensity:          chosenEdge,
    detectionMethod:      'OTSU',
  };
}

// ── Fixed-range fallback (original algorithm, preserved verbatim) ─────────────

function _fixedRangeFallback(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  numPix: number,
  mirrored: boolean,
  maskCovFraction: number,
  tCr: number,
): FastFaceBootstrapResult | null {
  const step = 2;
  let minX = width, maxX = 0, minY = height, maxY = 0;
  let skinCount = 0, sumX = 0, sumY = 0;

  for (let y = 0; y < height; y += step) {
    const rowOff = y * width * 4;
    for (let x = 0; x < width; x += step) {
      const idx = rowOff + (x << 2);
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const luma = (77 * r + 150 * g + 29 * b) >> 8;
      const cr = ((128 * r - 107 * g - 21 * b) >> 8) + 128;
      const cb = ((-43 * r -  85 * g + 128 * b) >> 8) + 128;
      if (luma >= 35 && luma <= 225 && cr >= 133 && cr <= 185 && cb >= 75 && cb <= 130 && (cr - cb) >= 10 && (r - b) >= 12) {
        skinCount++; sumX += x; sumY += y;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }

  const skinFraction = (skinCount * step * step) / numPix;
  const minReq = Math.round(numPix / (step * step * 100));
  if (skinCount < minReq || (maxX - minX) < width * 0.12 || (maxY - minY) < height * 0.15) return null;

  const cx = sumX / skinCount, cy = sumY / skinCount;
  const fw = maxX - minX, fh = maxY - minY;

  const normBoxX = Math.max(0, (minX - fw * 0.08) / width);
  const normBoxY = Math.max(0, (minY - fh * 0.08) / height);
  const normBoxW = Math.min(1.0 - normBoxX, (fw * 1.16) / width);
  const normBoxH = Math.min(1.0 - normBoxY, (fh * 1.16) / height);

  const eyeBandY  = Math.round(cy - fh * 0.15);
  const rEyeInitX = Math.round(cx - fw * 0.18);
  const lEyeInitX = Math.round(cx + fw * 0.18);

  const refineDarkness = (initX: number, initY: number, radius: number) => {
    let minLuma = 256, bestX = initX, bestY = initY;
    for (let py = Math.max(0, initY - radius); py <= Math.min(height - 1, initY + radius); py++) {
      const row = py * width;
      for (let px = Math.max(0, initX - radius); px <= Math.min(width - 1, initX + radius); px++) {
        const i4 = (row + px) << 2;
        const l = (77 * data[i4] + 150 * data[i4 + 1] + 29 * data[i4 + 2]) >> 8;
        if (l < minLuma) { minLuma = l; bestX = px; bestY = py; }
      }
    }
    return { x: bestX / width, y: bestY / height };
  };

  const rightPupil = refineDarkness(rEyeInitX, eyeBandY, Math.round(fw * 0.08));
  const leftPupil  = refineDarkness(lEyeInitX, eyeBandY, Math.round(fw * 0.08));
  const mouthBandY = Math.round(cy + fh * 0.22);
  const mouthRight = { x: Math.round(cx - fw * 0.16) / width, y: mouthBandY / height };
  const mouthLeft  = { x: Math.round(cx + fw * 0.16) / width, y: mouthBandY / height };
  const noseTip    = { x: cx / width, y: (cy + fh * 0.05) / height };

  const flipX = (nx: number) => mirrored ? 1.0 - nx : nx;

  const approxLandmarks: Array<{ x: number; y: number; confidence: number }> = [];
  const meanShape = PCAShapePrior.getMeanShape();
  for (let i = 0; i < 70; i++) {
    const ms = meanShape[i];
    let lx = normBoxX + ms.x * normBoxW, ly = normBoxY + ms.y * normBoxH, conf = 0.70;
    if (i === 68) { lx = rightPupil.x; ly = rightPupil.y; conf = 0.85; }
    else if (i === 69) { lx = leftPupil.x;  ly = leftPupil.y;  conf = 0.85; }
    else if (i === 48) { lx = mouthRight.x; ly = mouthRight.y; conf = 0.80; }
    else if (i === 54) { lx = mouthLeft.x;  ly = mouthLeft.y;  conf = 0.80; }
    else if (i === 33) { lx = noseTip.x;    ly = noseTip.y;    conf = 0.80; }
    approxLandmarks.push({ x: flipX(lx), y: ly, confidence: conf });
  }

  // Confidence is lower (0.55 cap) to signal to the smoother that
  // this is a fallback result and should be down-weighted.
  return {
    detected: true,
    box: {
      x: flipX(normBoxX + (mirrored ? normBoxW : 0)),
      y: normBoxY, width: normBoxW, height: normBoxH,
    },
    rightPupil:  { x: flipX(rightPupil.x),  y: rightPupil.y  },
    leftPupil:   { x: flipX(leftPupil.x),   y: leftPupil.y   },
    mouthRight:  { x: flipX(mouthRight.x),  y: mouthRight.y  },
    mouthLeft:   { x: flipX(mouthLeft.x),   y: mouthLeft.y   },
    noseTip:     { x: flipX(noseTip.x),     y: noseTip.y     },
    confidence:          Math.min(0.55, 0.38 + skinFraction * 0.5),
    approxLandmarks,
    otsuThresholdCr:      tCr,
    maskCoverageFraction: maskCovFraction,
    selectedBlobAspect:   0,
    edgeDensity:          0,
    detectionMethod:      'FIXED_RANGE_FALLBACK',
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


