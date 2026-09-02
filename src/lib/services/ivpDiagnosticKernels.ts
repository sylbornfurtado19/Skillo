/**
 * Skillo AI - Academic Computer Vision Diagnostic Kernels (Units 1-8)
 * ====================================================================
 * High-performance pure TypeScript image and signal processing library
 * operating directly on ImageData / TypedArray pixel buffers.
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
let _lastNumPixels = 0;

let _grayBuf: Uint8Array = new Uint8Array(0);
let _crBuf: Uint8Array = new Uint8Array(0);
let _cbBuf: Uint8Array = new Uint8Array(0);
let _rawMaskBuf: Uint8Array = new Uint8Array(0);
let _cleanMaskBuf: Uint8Array = new Uint8Array(0);

let _histBuf: Uint32Array = new Uint32Array(256);
let _crHistBuf: Uint32Array = new Uint32Array(256);
let _pdfBuf: Float32Array = new Float32Array(256);
let _cdfBuf: Float32Array = new Float32Array(256);
let _lutBuf: Uint8Array = new Uint8Array(256);

/**
 * Ensures all pixel-count-dependent scratch buffers are allocated for the given resolution.
 */
export function ensureKernelBuffers(numPixels: number): void {
  if (numPixels === _lastNumPixels) return;
  _grayBuf = new Uint8Array(numPixels);
  _crBuf = new Uint8Array(numPixels);
  _cbBuf = new Uint8Array(numPixels);
  _rawMaskBuf = new Uint8Array(numPixels);
  _cleanMaskBuf = new Uint8Array(numPixels);
  _lastNumPixels = numPixels;
}

// =============================================================================
// RESULT INTERFACES
// =============================================================================

export interface LuminanceHistogramResult {
  hist: Uint32Array;
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
  centroidX: number;
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

// Stable result singletons
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
// 1. UNIT 2: LUMINANCE & HISTOGRAM EQUALIZATION
// =============================================================================

/**
 * Computes 256-bin histogram, empirical PDF, and CDF from an RGBA ImageData buffer.
 */
export function computeLuminanceHistogram(
  srcData: ImageData,
  width: number,
  height: number
): LuminanceHistogramResult {
  const src = srcData.data;
  const numPixels = width * height;
  ensureKernelBuffers(numPixels);

  _histBuf.fill(0);

  let sum = 0;
  let minVal = 255;
  let maxVal = 0;

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    // BT.601 integer luminance: Y = (77*R + 150*G + 29*B) >> 8
    const y = (77 * src[idx] + 150 * src[idx + 1] + 29 * src[idx + 2]) >> 8;
    _histBuf[y]++;
    sum += y;
    if (y < minVal) minVal = y;
    if (y > maxVal) maxVal = y;
  }

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
 * Produces clear, unmistakable high-contrast equalized grayscale output.
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

  // Build CDF lookup table
  for (let k = 0; k < 256; k++) {
    _lutBuf[k] = Math.min(255, Math.max(0, Math.round(cdf[k] * 255)));
  }

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const y = (77 * src[idx] + 150 * src[idx + 1] + 29 * src[idx + 2]) >> 8;
    const eq = _lutBuf[y];
    dst[idx] = eq;
    dst[idx + 1] = eq;
    dst[idx + 2] = eq;
    dst[idx + 3] = 255; // Explicit 100% opaque alpha
  }

  return stats;
}

// =============================================================================
// 2. UNIT 6 & 7: YCRCB CHROMINANCE & OTSU OPTIMAL BINARIZATION
// =============================================================================

/**
 * Transforms RGB -> YCrCb, computes Otsu optimal variance thresholding on Cr channel,
 * bounds chrominance against office lighting, and executes a morphological opening pass.
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

  _crHistBuf.fill(0);

  // 1. RGB -> YCrCb transformation (BT.601)
  let totalCr = 0;
  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const r = src[idx];
    const g = src[idx + 1];
    const b = src[idx + 2];

    const cr = Math.min(255, Math.max(0, (32768 + 128 * r - 107 * g - 21 * b) >> 8));
    const cb = Math.min(255, Math.max(0, (32768 - 43 * r - 85 * g + 128 * b) >> 8));

    _crBuf[i] = cr;
    _cbBuf[i] = cb;
    _crHistBuf[cr]++;
    totalCr += cr;
  }

  // 2. Otsu between-class variance maximization
  let sumB = 0;
  let wB = 0;
  let varMax = 0;
  let optThresh = 138;

  if (totalCr > 0) {
    for (let t = 0; t < 256; t++) {
      wB += _crHistBuf[t];
      if (wB === 0) continue;
      const wF = numPixels - wB;
      if (wF === 0) break;

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
  }

  // Clamp Otsu threshold to realistic human skin chrominance bounds
  optThresh = Math.max(130, Math.min(160, optThresh));

  // 3. Combined Chrominance Envelope + Otsu Binarization (Resistant to fluorescent lighting)
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
      const cb = _cbBuf[i];

      // Robust skin classification condition
      const isSkin =
        cr >= optThresh &&
        cr >= 125 &&
        cr <= 175 &&
        cb >= 75 &&
        cb <= 130 &&
        r > g &&
        g > b;

      if (isSkin) {
        _rawMaskBuf[i] = 1;
        skinCount++;
        sumX += px;
        sumY += py;
      }
    }
  }

  // 4. 3x3 Morphological Opening (Erosion -> Dilation)
  _cleanMaskBuf.fill(0);
  for (let py = 1; py < height - 1; py++) {
    for (let px = 1; px < width - 1; px++) {
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

  // 4b. Dilation pass with high-contrast binary mask rendering
  let finalSkinCount = 0;
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const i = py * width + px;
      const outIdx = i * 4;

      if (py === 0 || py === height - 1 || px === 0 || px === width - 1) {
        // Border pixels
        dst[outIdx] = 15;
        dst[outIdx + 1] = 23;
        dst[outIdx + 2] = 42;
        dst[outIdx + 3] = 255;
        continue;
      }

      const base = i;
      const anyOnes =
        _cleanMaskBuf[base - width - 1] | _cleanMaskBuf[base - width] | _cleanMaskBuf[base - width + 1] |
        _cleanMaskBuf[base - 1]         | _cleanMaskBuf[base]          | _cleanMaskBuf[base + 1]         |
        _cleanMaskBuf[base + width - 1] | _cleanMaskBuf[base + width] | _cleanMaskBuf[base + width + 1];

      if (anyOnes) {
        // High-contrast neon emerald/white skin segmentation
        dst[outIdx] = 16;
        dst[outIdx + 1] = 230;
        dst[outIdx + 2] = 140;
        dst[outIdx + 3] = 255;
        finalSkinCount++;
      } else {
        // Solid deep midnight navy background (guarantees zero transparency)
        dst[outIdx] = 15;
        dst[outIdx + 1] = 23;
        dst[outIdx + 2] = 42;
        dst[outIdx + 3] = 255;
      }
    }
  }

  _otsuResult.otsuThreshold = optThresh;
  _otsuResult.skinPixelRatio = numPixels > 0 ? (finalSkinCount / numPixels) * 100 : 0;
  _otsuResult.skinPixelCount = finalSkinCount;
  _otsuResult.centroidX = skinCount > 0 ? Math.round(sumX / skinCount) : Math.round(width / 2);
  _otsuResult.centroidY = skinCount > 0 ? Math.round(sumY / skinCount) : Math.round(height / 2);

  return _otsuResult;
}

// =============================================================================
// 3. UNIT 4 & 5: SPATIAL SOBEL GRADIENT & ORIENTATION FIELD
// =============================================================================

/**
 * Computes 3x3 Sobel spatial convolutions Gx, Gy and renders glowing orientation-colored
 * edge vector fields against a solid black background.
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

  // 1. Convert to grayscale
  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    _grayBuf[i] = (77 * src[idx] + 150 * src[idx + 1] + 29 * src[idx + 2]) >> 8;
  }

  // 2. Initialize entire output buffer to solid black with 100% opaque alpha
  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    dst[idx] = 0;
    dst[idx + 1] = 0;
    dst[idx + 2] = 0;
    dst[idx + 3] = 255;
  }

  let sumMag = 0;
  let maxMag = 0;
  let edgeCount = 0;

  // 3. 3x3 Spatial Convolution
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

      // Sobel Kernels
      const gx = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
      const gy = (bl + 2 * bc + br) - (tl + 2 * tc + tr);

      const rawMag = Math.sqrt(gx * gx + gy * gy);
      sumMag += rawMag;
      if (rawMag > maxMag) maxMag = rawMag;
      if (rawMag > 25) edgeCount++;

      const outIdx = (row + px) * 4;

      // Amplify gradient magnitude visually for striking contrast
      const visualMag = Math.min(255, Math.round(rawMag * 2.2));

      if (visualMag >= 18 && colorizeOrientation) {
        // Calculate gradient orientation angle theta in [-PI, PI]
        const theta = Math.atan2(gy, gx);
        const normAngle = (theta + Math.PI) / (2 * Math.PI); // [0..1]
        const h = normAngle * 6;
        const v = visualMag / 255.0;
        const s = 1.0;
        const c = v * s;
        const xC = c * (1 - Math.abs((h % 2) - 1));

        let r = 0, g = 0, b = 0;
        if (h < 1) { r = c; g = xC; b = 0; }
        else if (h < 2) { r = xC; g = c; b = 0; }
        else if (h < 3) { r = 0; g = c; b = xC; }
        else if (h < 4) { r = 0; g = xC; b = c; }
        else if (h < 5) { r = xC; g = 0; b = c; }
        else { r = c; g = 0; b = xC; }

        dst[outIdx] = Math.round(r * 255);
        dst[outIdx + 1] = Math.round(g * 255);
        dst[outIdx + 2] = Math.round(b * 255);
        dst[outIdx + 3] = 255;
      } else if (visualMag >= 18) {
        dst[outIdx] = visualMag;
        dst[outIdx + 1] = visualMag;
        dst[outIdx + 2] = visualMag;
        dst[outIdx + 3] = 255;
      } else {
        // Pure solid black background
        dst[outIdx] = 0;
        dst[outIdx + 1] = 0;
        dst[outIdx + 2] = 0;
        dst[outIdx + 3] = 255;
      }
    }
  }

  const invN = numPixels > 0 ? 1 / numPixels : 0;
  _sobelResult.maxMagnitude = Math.round(maxMag);
  _sobelResult.meanMagnitude = Math.round(sumMag * invN * 10) / 10;
  _sobelResult.edgePixelRatio = Math.round(edgeCount * invN * 1000) / 10;

  return _sobelResult;
}

// =============================================================================
// 4. UNIT 8: TEMPORAL MEAN ABSOLUTE DIFFERENCE (MAD) MOTION HEATMAP
// =============================================================================

/**
 * Computes inter-frame pixel difference Δ(x,y) = |I_t - I_{t-1}| BEFORE buffer update,
 * projecting motion through an intensified thermal Jet colormap.
 */
export function computeTemporalMAD(
  currData: ImageData,
  prevData: ImageData | null,
  dstData: ImageData,
  width: number,
  height: number,
  motionThreshold = 6
): TemporalMADResult {
  const curr = currData.data;
  const dst = dstData.data;
  const numPixels = width * height;

  if (!prevData) {
    // First frame initialization (solid navy with 100% alpha)
    for (let i = 0; i < numPixels; i++) {
      const idx = i * 4;
      dst[idx] = 10;
      dst[idx + 1] = 15;
      dst[idx + 2] = 30;
      dst[idx + 3] = 255;
    }
    _madResult.madScore = 0;
    _madResult.motionAreaRatio = 0;
    _madResult.maxPixelDiff = 0;
    return _madResult;
  }

  const prev = prevData.data;
  let sumDiff = 0;
  let maxDiff = 0;
  let motionPixelCount = 0;

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;

    const currLuma = (77 * curr[idx] + 150 * curr[idx + 1] + 29 * curr[idx + 2]) >> 8;
    const prevLuma = (77 * prev[idx] + 150 * prev[idx + 1] + 29 * prev[idx + 2]) >> 8;

    const delta = Math.abs(currLuma - prevLuma);
    sumDiff += delta;
    if (delta > maxDiff) maxDiff = delta;

    if (delta >= motionThreshold) {
      motionPixelCount++;
      // Amplify motion intensity for high visual impact
      const normDelta = Math.min(1.0, (delta - motionThreshold) / 35.0);

      let r = 0, g = 0, b = 0;
      if (normDelta < 0.33) {
        // Blue to Cyan
        const t = normDelta / 0.33;
        r = 0;
        g = Math.round(t * 240);
        b = 255;
      } else if (normDelta < 0.66) {
        // Cyan to Yellow
        const t = (normDelta - 0.33) / 0.33;
        r = Math.round(t * 255);
        g = 255;
        b = Math.round((1 - t) * 255);
      } else {
        // Yellow to Vivid Neon Red
        const t = (normDelta - 0.66) / 0.34;
        r = 255;
        g = Math.round((1 - t) * 220);
        b = 0;
      }

      dst[idx] = r;
      dst[idx + 1] = g;
      dst[idx + 2] = b;
      dst[idx + 3] = 255;
    } else {
      // Solid deep navy background for low motion
      const muted = Math.min(60, Math.round(currLuma * 0.2));
      dst[idx] = 10 + muted;
      dst[idx + 1] = 15 + muted;
      dst[idx + 2] = 32 + muted;
      dst[idx + 3] = 255;
    }
  }

  const invN = numPixels > 0 ? 1 / numPixels : 0;
  _madResult.madScore = Math.round(sumDiff * invN * 100) / 100;
  _madResult.motionAreaRatio = Math.round(motionPixelCount * invN * 1000) / 10;
  _madResult.maxPixelDiff = maxDiff;

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
 * Projects three orthogonal 3D coordinate vectors onto the 2D canvas using
 * standard OpenCV/pinhole camera conventions (+X right, +Y down, +Z forward).
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
  const DEG2RAD = Math.PI / 180;
  const yaw = (isFinite(yawDeg) ? yawDeg : 0) * DEG2RAD;
  const pitch = (isFinite(pitchDeg) ? pitchDeg : 0) * DEG2RAD;
  const roll = (isFinite(rollDeg) ? rollDeg : 0) * DEG2RAD;

  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);

  // Tait-Bryan Z-Y-X rotation
  const xProj_x = cy * cr;
  const xProj_y = sp * sy * cr - cp * sr;

  const yProj_x = cy * sr;
  const yProj_y = sp * sy * sr + cp * cr;

  const zProj_x = sy;
  const zProj_y = -sp * cy;

  const xEndX = originX + axisLength * xProj_x;
  const xEndY = originY + axisLength * xProj_y;

  const yEndX = originX + axisLength * yProj_x;
  const yEndY = originY + axisLength * yProj_y;

  const zEndX = originX + axisLength * zProj_x;
  const zEndY = originY + axisLength * zProj_y;

  ctx.save();
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';

  // X-axis -> Red (Pitch)
  ctx.strokeStyle = '#EF4444';
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(xEndX, xEndY);
  ctx.stroke();

  // Y-axis -> Green (Yaw)
  ctx.strokeStyle = '#10B981';
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(yEndX, yEndY);
  ctx.stroke();

  // Z-axis -> Blue (Roll / Normal)
  ctx.strokeStyle = '#3B82F6';
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(zEndX, zEndY);
  ctx.stroke();

  // Origin sphere (nose tip)
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

export function histogramMax(hist: Uint32Array): number {
  let m = 0;
  for (let i = 0; i < 256; i++) {
    if (hist[i] > m) m = hist[i];
  }
  return m;
}
