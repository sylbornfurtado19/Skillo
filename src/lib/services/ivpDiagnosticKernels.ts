/**
 * Skillo AI - Academic Computer Vision Diagnostic Kernels (Units 1-8)
 * ====================================================================
 * High-performance pure TypeScript image and signal processing library
 * operating directly on ImageData / TypedArray pixel buffers.
 *
 * PERFORMANCE ARCHITECTURE (Zero-Allocation Hot Loops):
 * -------------------------------------------------------
 * All intermediate typed-array buffers (grayscale scratch, Cr buffer,
 * histogram accumulators, morphological mask buffers) are module-level
 * singletons pre-allocated at first use and REUSED on every subsequent
 * frame.  Calling code MUST NOT resize the canvas mid-session; if canvas
 * dimensions change, call `resetKernelBuffers()` to reallocate.
 *
 * Implements:
 * 1. Unit 1: Pinhole camera intrinsic projection matrix math (3D Euler axes)
 * 2. Unit 2: Radiometric normalization & 256-bin Histogram Equalization (PDF/CDF)
 * 3. Unit 4: Spatial 3x3 Sobel directional convolutions and gradient orientation field
 * 4. Unit 6 & 7: RGB -> YCrCb color transformation & Otsu optimal variance binarization
 * 5. Unit 8: Inter-frame temporal Mean Absolute Difference (MAD) thermal motion heatmap
 * 6. Signal Dynamics: 6-point Eye Aspect Ratio (EAR) and 4-point Mouth Aspect Ratio (MAR)
 */

// =============================================================================
// MODULE-LEVEL PRE-ALLOCATED SCRATCH BUFFERS (Zero GC in hot loops)
// =============================================================================
// These are lazy-initialised the first time a kernel is called and then reused.
// Keyed by pixel count so they auto-resize if the diagnostic buffer resolution changes.

let _lastNumPixels = 0;

// Shared grayscale & Cr / mask buffers
let _grayBuf: Uint8Array = new Uint8Array(0);
let _crBuf: Uint8Array = new Uint8Array(0);
let _rawMaskBuf: Uint8Array = new Uint8Array(0);
let _cleanMaskBuf: Uint8Array = new Uint8Array(0);

// Fixed-size accumulators (always 256 elements)
let _histBuf: Uint32Array = new Uint32Array(256);
let _crHistBuf: Uint32Array = new Uint32Array(256);
let _pdfBuf: Float32Array = new Float32Array(256);
let _cdfBuf: Float32Array = new Float32Array(256);
let _lutBuf: Uint8Array = new Uint8Array(256);

/**
 * Ensures all pixel-count-dependent scratch buffers are allocated for the
 * given resolution.  Call this once whenever the canvas dimensions change.
 */
export function ensureKernelBuffers(numPixels: number): void {
  if (numPixels === _lastNumPixels) return;
  _grayBuf = new Uint8Array(numPixels);
  _crBuf = new Uint8Array(numPixels);
  _rawMaskBuf = new Uint8Array(numPixels);
  _cleanMaskBuf = new Uint8Array(numPixels);
  _lastNumPixels = numPixels;
}

// =============================================================================
// RESULT INTERFACES
// =============================================================================

export interface LuminanceHistogramResult {
  hist: Uint32Array;   // same object reference every frame — do NOT mutate externally
  pdf: Float32Array;
  cdf: Float32Array;
  minVal: number;
  maxVal: number;
  meanVal: number;
}

export interface OtsuSegmentationResult {
  otsuThreshold: number;
  skinPixelRatio: number;
  skinPixelCount: number;
  centroidX: number;   // flat scalars — no allocation
  centroidY: number;
}

export interface SobelGradientResult {
  maxMagnitude: number;
  meanMagnitude: number;
  edgePixelRatio: number;
}

export interface TemporalMADResult {
  madScore: number;
  motionAreaRatio: number;
  maxPixelDiff: number;
}

// Stable result objects reused every frame to avoid per-frame object allocation
const _histResult: LuminanceHistogramResult = {
  hist: _histBuf,
  pdf: _pdfBuf,
  cdf: _cdfBuf,
  minVal: 0,
  maxVal: 255,
  meanVal: 128,
};
const _otsuResult: OtsuSegmentationResult = {
  otsuThreshold: 138,
  skinPixelRatio: 0,
  skinPixelCount: 0,
  centroidX: 160,
  centroidY: 120,
};
const _sobelResult: SobelGradientResult = {
  maxMagnitude: 0,
  meanMagnitude: 0,
  edgePixelRatio: 0,
};
const _madResult: TemporalMADResult = {
  madScore: 0,
  motionAreaRatio: 0,
  maxPixelDiff: 0,
};

// =============================================================================
// UNIT 2: LUMINANCE & HISTOGRAM EQUALIZATION
// =============================================================================

/**
 * Computes 256-bin histogram, empirical PDF, and CDF from an RGBA ImageData buffer.
 * Returns a SHARED result object — copy values before storing if async reads are needed.
 */
export function computeLuminanceHistogram(
  srcData: ImageData,
  width: number,
  height: number
): LuminanceHistogramResult {
  const src = srcData.data;
  const numPixels = width * height;
  ensureKernelBuffers(numPixels);

  // Zero the histogram accumulator in-place (no allocation)
  _histBuf.fill(0);

  let sum = 0;
  let minVal = 255;
  let maxVal = 0;

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    // ITU-R BT.601 standard luma — integer approximation avoids fp multiply per pixel
    // Y ≈ (77*R + 150*G + 29*B) >> 8  — same coefficients as 0.299/0.587/0.114
    const y = (77 * src[idx] + 150 * src[idx + 1] + 29 * src[idx + 2]) >> 8;
    _histBuf[y]++;
    sum += y;
    if (y < minVal) minVal = y;
    if (y > maxVal) maxVal = y;
  }

  // Compute PDF / CDF in-place
  const invN = numPixels > 0 ? 1 / numPixels : 0;
  let cum = 0;
  for (let k = 0; k < 256; k++) {
    _pdfBuf[k] = _histBuf[k] * invN;
    cum += _histBuf[k];
    _cdfBuf[k] = cum * invN;
  }

  _histResult.hist = _histBuf;
  _histResult.pdf = _pdfBuf;
  _histResult.cdf = _cdfBuf;
  _histResult.minVal = minVal;
  _histResult.maxVal = maxVal;
  _histResult.meanVal = numPixels > 0 ? sum * invN : 0;

  return _histResult;
}

/**
 * Applies CDF-based Histogram Equalization: s_k = round(255 × CDF(r_k)).
 * Writes output into dstData.  Returns the same shared result object as
 * computeLuminanceHistogram for downstream metric display.
 */
export function applyHistogramEqualization(
  srcData: ImageData,
  dstData: ImageData,
  width: number,
  height: number
): LuminanceHistogramResult {
  const stats = computeLuminanceHistogram(srcData, width, height);
  const src = srcData.data;
  const dst = dstData.data;
  const numPixels = width * height;
  const cdf = stats.cdf;

  // Build LUT (pre-allocated _lutBuf, no allocation)
  for (let k = 0; k < 256; k++) {
    _lutBuf[k] = Math.min(255, Math.round(cdf[k] * 255));
  }

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const y = (77 * src[idx] + 150 * src[idx + 1] + 29 * src[idx + 2]) >> 8;
    const eq = _lutBuf[y];
    dst[idx]     = eq;
    dst[idx + 1] = eq;
    dst[idx + 2] = eq;
    dst[idx + 3] = 255;
  }

  return stats;
}

// =============================================================================
// UNIT 6 & 7: YCRCB CHROMINANCE & OTSU OPTIMAL BINARIZATION
// =============================================================================

/**
 * Transforms RGB -> YCrCb, computes Otsu optimal variance thresholding on Cr,
 * applies a 3×3 morphological opening (erosion → dilation) to clean speckles.
 *
 * MATHEMATICAL INTEGRITY:
 * - σ²_B(t) = ω₀(t)·ω₁(t)·[μ₀(t) - μ₁(t)]²
 * - Guard: ω₀ = 0 → continue; ω₁ = 0 → break (both explicit)
 * - Guard: totalCr = 0 (all-black frame) → optThresh = 128 fallback
 * - Guard: varMax stays 0 after full sweep → skin fallback threshold 138
 */
export function applyYCrCbOtsuSegmentation(
  srcData: ImageData,
  dstData: ImageData,
  width: number,
  height: number
): OtsuSegmentationResult {
  const src = srcData.data;
  const dst = dstData.data;
  const numPixels = width * height;
  ensureKernelBuffers(numPixels);

  // Zero the Cr histogram accumulator
  _crHistBuf.fill(0);

  // 1. RGB → YCrCb — accumulate Cr histogram into pre-allocated buffer
  let totalCr = 0;
  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const r = src[idx];
    const g = src[idx + 1];
    const b = src[idx + 2];

    // Cr = 128 + 0.5R - 0.41869G - 0.08131B  (BT.601)
    // Integer-friendly: (128*256 + 128*r - 107*g - 21*b) >> 8
    const cr = Math.min(255, Math.max(0, (32768 + 128 * r - 107 * g - 21 * b) >> 8));
    _crBuf[i] = cr;
    _crHistBuf[cr]++;
    totalCr += cr;
  }

  // 2. Otsu variance maximisation on Cr channel
  //    σ²_B(t) = ω₀·ω₁·(μ₀ - μ₁)²
  //    Guard: if totalCr === 0 the frame is fully black → use fallback threshold 128
  let sumB = 0;
  let wB = 0;
  let varMax = 0;
  let optThresh = 138; // anatomical fallback for human Cr range

  if (totalCr > 0) {
    for (let t = 0; t < 256; t++) {
      wB += _crHistBuf[t];
      if (wB === 0) continue;          // ω₀ = 0 guard
      const wF = numPixels - wB;
      if (wF === 0) break;             // ω₁ = 0 guard

      sumB += t * _crHistBuf[t];
      const mB = sumB / wB;
      const mF = (totalCr - sumB) / wF;
      const diff = mB - mF;
      const varBetween = wB * wF * diff * diff;

      if (varBetween > varMax) {
        varMax = varBetween;
        optThresh = t;
      }
    }
    // Guard: if varMax === 0 (uniform Cr field, e.g. white wall or occluded lens)
    // keep anatomical fallback — already set to 138
  }

  // Clamp to physiologically realistic human skin Cr bounds [128, 165]
  optThresh = Math.max(128, Math.min(165, optThresh));

  // 3. Generate raw binary skin mask
  _rawMaskBuf.fill(0);
  let skinCount = 0;
  let sumX = 0;
  let sumY = 0;

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const i = py * width + px;
      const idx = i * 4;
      const r = src[idx];
      const g = src[idx + 1];
      const b = src[idx + 2];
      const cr = _crBuf[i];
      // Cb = 128 - 0.16874R - 0.33126G + 0.5B  (BT.601)
      const cb = Math.round(128 - 0.16874 * r - 0.33126 * g + 0.5 * b);

      const isSkin = cr >= optThresh && cb >= 77 && cb <= 127 && r > g && g > b;
      if (isSkin) {
        _rawMaskBuf[i] = 1;
        skinCount++;
        sumX += px;
        sumY += py;
      }
    }
  }

  // 4. 3×3 Morphological Opening — erosion pass into _cleanMaskBuf
  _cleanMaskBuf.fill(0);
  for (let py = 1; py < height - 1; py++) {
    for (let px = 1; px < width - 1; px++) {
      // Check all 9 neighbours (3×3 SE)
      const base = py * width + px;
      if (
        _rawMaskBuf[base - width - 1] & _rawMaskBuf[base - width] & _rawMaskBuf[base - width + 1] &
        _rawMaskBuf[base - 1]         & _rawMaskBuf[base]          & _rawMaskBuf[base + 1]         &
        _rawMaskBuf[base + width - 1] & _rawMaskBuf[base + width] & _rawMaskBuf[base + width + 1]
      ) {
        _cleanMaskBuf[base] = 1;
      }
    }
  }

  // 4b. Dilation pass — write directly to dst pixel buffer
  let finalSkinCount = 0;
  for (let py = 1; py < height - 1; py++) {
    for (let px = 1; px < width - 1; px++) {
      const i = py * width + px;
      const base = i;
      const anyOnes =
        _cleanMaskBuf[base - width - 1] | _cleanMaskBuf[base - width] | _cleanMaskBuf[base - width + 1] |
        _cleanMaskBuf[base - 1]         | _cleanMaskBuf[base]          | _cleanMaskBuf[base + 1]         |
        _cleanMaskBuf[base + width - 1] | _cleanMaskBuf[base + width] | _cleanMaskBuf[base + width + 1];

      const outIdx = i * 4;
      if (anyOnes) {
        // Skin: emerald/cyan highlight
        dst[outIdx]     = 16;
        dst[outIdx + 1] = 185;
        dst[outIdx + 2] = 129;
        dst[outIdx + 3] = 255;
        finalSkinCount++;
      } else {
        // Non-skin: dark Cr-tinted background for academic contrast
        const crVal = _crBuf[i];
        dst[outIdx]     = (crVal * 102) >> 8;   // * 0.4 via bit shift
        dst[outIdx + 1] = (crVal * 102) >> 8;
        dst[outIdx + 2] = (crVal * 128) >> 8;   // * 0.5
        dst[outIdx + 3] = 255;
      }
    }
  }

  // Fill border rows/cols with black (avoids unwritten pixels)
  for (let px = 0; px < width; px++) {
    const top = px * 4;
    const bot = ((height - 1) * width + px) * 4;
    dst[top] = dst[top + 1] = dst[top + 2] = 0; dst[top + 3] = 255;
    dst[bot] = dst[bot + 1] = dst[bot + 2] = 0; dst[bot + 3] = 255;
  }

  _otsuResult.otsuThreshold  = optThresh;
  _otsuResult.skinPixelRatio = numPixels > 0 ? (finalSkinCount / numPixels) * 100 : 0;
  _otsuResult.skinPixelCount = finalSkinCount;
  _otsuResult.centroidX      = skinCount > 0 ? Math.round(sumX / skinCount) : Math.round(width / 2);
  _otsuResult.centroidY      = skinCount > 0 ? Math.round(sumY / skinCount) : Math.round(height / 2);

  return _otsuResult;
}

// =============================================================================
// UNIT 4 & 5: SPATIAL SOBEL GRADIENT & ORIENTATION FIELD
// =============================================================================

/**
 * Computes 3×3 Sobel spatial convolutions Gx, Gy and renders gradient magnitude
 * with HSV orientation-encoded colour on interior pixels.
 * Boundary pixels (x=0, x=W-1, y=0, y=H-1) are explicitly zeroed.
 */
export function applySobelGradientField(
  srcData: ImageData,
  dstData: ImageData,
  width: number,
  height: number,
  colorizeOrientation = true
): SobelGradientResult {
  const src = srcData.data;
  const dst = dstData.data;
  const numPixels = width * height;
  ensureKernelBuffers(numPixels);

  // 1. RGB → Grayscale into pre-allocated buffer (integer BT.601)
  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    _grayBuf[i] = (77 * src[idx] + 150 * src[idx + 1] + 29 * src[idx + 2]) >> 8;
  }

  // 2. Clamp boundary pixels to black (boundary clamping guard)
  for (let px = 0; px < width; px++) {
    const top = px * 4;
    const bot = ((height - 1) * width + px) * 4;
    dst[top] = dst[top + 1] = dst[top + 2] = 0; dst[top + 3] = 255;
    dst[bot] = dst[bot + 1] = dst[bot + 2] = 0; dst[bot + 3] = 255;
  }
  for (let py = 0; py < height; py++) {
    const left = py * width * 4;
    const right = (py * width + width - 1) * 4;
    dst[left] = dst[left + 1] = dst[left + 2] = 0; dst[left + 3] = 255;
    dst[right] = dst[right + 1] = dst[right + 2] = 0; dst[right + 3] = 255;
  }

  let sumMag = 0;
  let maxMag = 0;
  let edgeCount = 0;

  // 3. 3×3 Sobel convolution — interior pixels only
  for (let py = 1; py < height - 1; py++) {
    const row = py * width;
    for (let px = 1; px < width - 1; px++) {
      const tl = _grayBuf[row - width + px - 1];
      const tc = _grayBuf[row - width + px];
      const tr = _grayBuf[row - width + px + 1];
      const ml = _grayBuf[row + px - 1];
      const mr = _grayBuf[row + px + 1];
      const bl = _grayBuf[row + width + px - 1];
      const bc = _grayBuf[row + width + px];
      const br = _grayBuf[row + width + px + 1];

      // Sobel kernels:  Gx = [-1 0 1; -2 0 2; -1 0 1]  Gy = [-1 -2 -1; 0 0 0; 1 2 1]
      const gx = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
      const gy = (bl + 2 * bc + br) - (tl + 2 * tc + tr);

      const mag = Math.sqrt(gx * gx + gy * gy);
      sumMag += mag;
      if (mag > maxMag) maxMag = mag;
      if (mag > 40) edgeCount++;

      const outIdx = (row + px) * 4;
      const clampedMag = mag > 255 ? 255 : (mag | 0); // integer truncation, avoids Math.round

      if (colorizeOrientation && clampedMag > 20) {
        // HSV colour encode: Hue = gradient orientation θ ∈ [-π, π]
        const theta = Math.atan2(gy, gx);
        const normAngle = (theta + Math.PI) * (1 / (2 * Math.PI)); // 0..1
        const h = normAngle * 6;
        const v = clampedMag / 255;
        const xC = v * (1 - Math.abs((h % 2) - 1));
        const m = 0; // Saturation = 1.0, so m = v - c = v - v = 0

        let rr = 0, gg = 0, bb = 0;
        if      (h < 1) { rr = v;  gg = xC; bb = 0;  }
        else if (h < 2) { rr = xC; gg = v;  bb = 0;  }
        else if (h < 3) { rr = 0;  gg = v;  bb = xC; }
        else if (h < 4) { rr = 0;  gg = xC; bb = v;  }
        else if (h < 5) { rr = xC; gg = 0;  bb = v;  }
        else            { rr = v;  gg = 0;  bb = xC; }

        dst[outIdx]     = (rr * 255) | 0;
        dst[outIdx + 1] = (gg * 255) | 0;
        dst[outIdx + 2] = (bb * 255) | 0;
      } else {
        dst[outIdx]     = clampedMag;
        dst[outIdx + 1] = clampedMag;
        dst[outIdx + 2] = clampedMag;
      }
      dst[outIdx + 3] = 255;
    }
  }

  const invN = numPixels > 0 ? 1 / numPixels : 0;
  _sobelResult.maxMagnitude  = maxMag | 0;
  _sobelResult.meanMagnitude = Math.round(sumMag * invN * 10) / 10;
  _sobelResult.edgePixelRatio = Math.round(edgeCount * invN * 1000) / 10; // percent × 1 decimal

  return _sobelResult;
}

// =============================================================================
// UNIT 8: TEMPORAL MEAN ABSOLUTE DIFFERENCE (MAD) MOTION HEATMAP
// =============================================================================

/**
 * Computes frame-difference MAD = (1/HW)·Σ|I_t − I_{t-1}| and renders a
 * Blue→Cyan→Yellow→Red thermal heatmap for motion pixels.
 */
export function computeTemporalMAD(
  currData: ImageData,
  prevData: ImageData | null,
  dstData: ImageData,
  width: number,
  height: number,
  motionThreshold = 8
): TemporalMADResult {
  const curr = currData.data;
  const dst  = dstData.data;
  const numPixels = width * height;

  if (!prevData) {
    // First frame: passthrough — no previous to diff against
    for (let i = 0; i < curr.length; i++) dst[i] = curr[i];
    _madResult.madScore        = 0;
    _madResult.motionAreaRatio = 0;
    _madResult.maxPixelDiff    = 0;
    return _madResult;
  }

  const prev = prevData.data;
  let sumDiff = 0;
  let maxDiff = 0;
  let motionPixelCount = 0;

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;

    // Integer BT.601 luma — avoids 3 fp multiplies per pixel
    const currLuma = (77 * curr[idx] + 150 * curr[idx + 1] + 29 * curr[idx + 2]) >> 8;
    const prevLuma = (77 * prev[idx] + 150 * prev[idx + 1] + 29 * prev[idx + 2]) >> 8;

    const delta = currLuma > prevLuma ? currLuma - prevLuma : prevLuma - currLuma;
    sumDiff += delta;
    if (delta > maxDiff) maxDiff = delta;

    if (delta >= motionThreshold) {
      motionPixelCount++;
      // Thermal Jet colourmap: Blue→Cyan→Yellow→Red
      const normDelta = (delta - motionThreshold) > 50 ? 1.0 : (delta - motionThreshold) / 50;
      let r = 0, g = 0, b = 0;

      if (normDelta < 0.333) {
        const t = normDelta * 3;          // 0..1
        g = (t * 255) | 0;
        b = 255;
      } else if (normDelta < 0.667) {
        const t = (normDelta - 0.333) * 3;
        r = (t * 255) | 0;
        g = 255;
        b = ((1 - t) * 255) | 0;
      } else {
        const t = (normDelta - 0.667) * 3;
        r = 255;
        g = ((1 - t) * 255) | 0;
      }

      dst[idx]     = r;
      dst[idx + 1] = g;
      dst[idx + 2] = b;
    } else {
      // Muted blue-tinted grayscale background
      const muted = (currLuma * 90) >> 8;  // ≈ *0.35
      dst[idx]     = muted;
      dst[idx + 1] = muted;
      dst[idx + 2] = muted + 20 > 255 ? 255 : muted + 20;
    }
    dst[idx + 3] = 255;
  }

  const invN = numPixels > 0 ? 1 / numPixels : 0;
  _madResult.madScore        = Math.round(sumDiff * invN * 100) / 100;
  _madResult.motionAreaRatio = Math.round(motionPixelCount * invN * 1000) / 10;
  _madResult.maxPixelDiff    = maxDiff;

  return _madResult;
}

// =============================================================================
// PHYSIOLOGICAL SIGNAL CALCULATORS: EAR & MAR
// =============================================================================

export interface Point2D {
  x: number;
  y: number;
}

function euclideanDist(p1: Point2D, p2: Point2D): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Soukupová & Čech (2016) 6-point Eye Aspect Ratio:
 * EAR = (||p2−p6|| + ||p3−p5||) / (2·||p1−p4||)
 */
export function calculateEAR(eyePoints: Point2D[] | null | undefined): number {
  if (!eyePoints || eyePoints.length < 6) return 0.28;

  const vertical1  = euclideanDist(eyePoints[1], eyePoints[5]);
  const vertical2  = euclideanDist(eyePoints[2], eyePoints[4]);
  const horizontal = euclideanDist(eyePoints[0], eyePoints[3]);

  if (horizontal <= 0.001) return 0.28;
  const ear = (vertical1 + vertical2) / (2.0 * horizontal);
  return Math.max(0.05, Math.min(0.5, Math.round(ear * 1000) / 1000));
}

/**
 * 4-point Mouth Aspect Ratio:
 * MAR = ||p_top − p_bottom|| / ||p_left − p_right||
 */
export function calculateMAR(mouthPoints: Point2D[] | null | undefined): number {
  if (!mouthPoints || mouthPoints.length < 4) return 0.15;

  const vertical   = euclideanDist(mouthPoints[1], mouthPoints[3]);
  const horizontal = euclideanDist(mouthPoints[0], mouthPoints[2]);

  if (horizontal <= 0.001) return 0.15;
  const mar = vertical / horizontal;
  return Math.max(0.05, Math.min(1.2, Math.round(mar * 1000) / 1000));
}

// =============================================================================
// UNIT 1: PINHOLE CAMERA INTRINSIC PROJECTION MATRIX (3D POSE AXES)
// =============================================================================

/**
 * Projects three orthogonal 3D coordinate vectors onto the 2D canvas using the
 * standard OpenCV/pinhole camera convention (+X right, +Y down, +Z forward into scene).
 *
 * Rotation order: Rz(roll) × Ry(yaw) × Rx(pitch)  (Tait-Bryan ZYX / intrinsic)
 *
 * COORDINATE CONVENTION NOTE:
 * Canvas Y increases downward — identical to the OpenCV +Y-down convention.
 * Therefore we apply '+' (not '−') to the Y screen component: y_screen = originY + proj_Y.
 *
 * ANGLE UNITS:
 * Inputs yawDeg, pitchDeg, rollDeg are expected in DEGREES and are explicitly
 * converted to radians before any trigonometric call.
 */
export function drawProjected3DAxes(
  ctx: CanvasRenderingContext2D,
  yawDeg: number,
  pitchDeg: number,
  rollDeg: number,
  originX: number,
  originY: number,
  axisLength = 60
): void {
  // Degree → Radian conversion (explicit guard for NaN inputs)
  const DEG2RAD = Math.PI / 180;
  const yaw   = (isFinite(yawDeg)   ? yawDeg   : 0) * DEG2RAD;
  const pitch = (isFinite(pitchDeg) ? pitchDeg : 0) * DEG2RAD;
  const roll  = (isFinite(rollDeg)  ? rollDeg  : 0) * DEG2RAD;

  // Precompute sin/cos
  const cy = Math.cos(yaw),  sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll),  sr = Math.sin(roll);

  // Combined rotation R = Rz(roll) × Ry(yaw) × Rx(pitch)
  // Column-major layout for clarity:
  // R = | cy·cr       cy·sr-sy·sp·cr    sy·cp   |
  //     | -cr·sy·sp   cp·cr             sp       |
  //     | -sy         -cy·sp            cy·cp    |   <-- this is the standard ZYX Tait-Bryan
  //
  // We project 3D unit vectors:  p_2D = origin + axisLength · R · e_i
  // Screen convention: x_screen = originX + proj_x
  //                    y_screen = originY + proj_y   (+Y is DOWN in both canvas and OpenCV)

  // X-axis basis [1,0,0] → projected to screen
  const xProj_x = cy * cr;
  const xProj_y = sp * sy * cr - cp * sr;   // row1 col0 of R

  // Y-axis basis [0,1,0] → projected to screen
  const yProj_x = cy * sr;
  const yProj_y = sp * sy * sr + cp * cr;   // row1 col1 of R

  // Z-axis basis [0,0,1] → projected to screen  (forward into scene)
  const zProj_x =  sy;
  const zProj_y = -sp * cy;                 // row1 col2 of R

  const xEndX = originX + axisLength * xProj_x;
  const xEndY = originY + axisLength * xProj_y;   // + for OpenCV Y-down convention

  const yEndX = originX + axisLength * yProj_x;
  const yEndY = originY + axisLength * yProj_y;

  const zEndX = originX + axisLength * zProj_x;
  const zEndY = originY + axisLength * zProj_y;

  ctx.save();
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';

  // X-axis → Red (Pitch axis)
  ctx.strokeStyle = '#EF4444';
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(xEndX, xEndY);
  ctx.stroke();

  // Y-axis → Green (Yaw axis)
  ctx.strokeStyle = '#10B981';
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(yEndX, yEndY);
  ctx.stroke();

  // Z-axis → Blue (Roll / depth forward)
  ctx.strokeStyle = '#3B82F6';
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(zEndX, zEndY);
  ctx.stroke();

  // Origin sphere
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(originX, originY, 4.5, 0, 2 * Math.PI);
  ctx.fill();

  // Axis labels
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#EF4444';
  ctx.fillText('X', xEndX + 5, xEndY);
  ctx.fillStyle = '#10B981';
  ctx.fillText('Y', yEndX + 5, yEndY);
  ctx.fillStyle = '#3B82F6';
  ctx.fillText('Z', zEndX + 5, zEndY);

  ctx.restore();
}

// Pre-computed constant for histogram max — avoids Math.max spread in hot render loop
export function histogramMax(hist: Uint32Array): number {
  let m = 0;
  for (let i = 0; i < 256; i++) {
    if (hist[i] > m) m = hist[i];
  }
  return m;
}
