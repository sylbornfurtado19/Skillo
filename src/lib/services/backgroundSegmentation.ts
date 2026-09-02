'use client';

export type VirtualBackdropType = 'blur' | 'office' | 'studio' | 'gradient' | 'mask' | 'none';

export interface SegmentationOptions {
  blurRadius?: number; // 2 to 35 px
  backdropType?: VirtualBackdropType;
  featherRadius?: number; // 2 to 16 px
  sensitivity?: number; // 0.7 to 1.3
}

// Reusable offscreen scratch canvases for high-performance zero-allocation compositing
let scratchBgCanvas: HTMLCanvasElement | null = null;
let scratchMaskCanvas: HTMLCanvasElement | null = null;

function getScratchCanvas(width: number, height: number, type: 'bg' | 'mask'): HTMLCanvasElement {
  if (type === 'bg') {
    if (!scratchBgCanvas) scratchBgCanvas = document.createElement('canvas');
    if (scratchBgCanvas.width !== width || scratchBgCanvas.height !== height) {
      scratchBgCanvas.width = width;
      scratchBgCanvas.height = height;
    }
    return scratchBgCanvas;
  } else {
    if (!scratchMaskCanvas) scratchMaskCanvas = document.createElement('canvas');
    if (scratchMaskCanvas.width !== width || scratchMaskCanvas.height !== height) {
      scratchMaskCanvas.width = width;
      scratchMaskCanvas.height = height;
    }
    return scratchMaskCanvas;
  }
}

/**
 * Computes an anthropometric Person Foreground Saliency Mask (Head, Hair, Neck & Torso/Shoulders).
 * Combines skin chrominance with upper-body geometric prior and background rejection.
 */
export function extractPersonForegroundMask(
  srcData: ImageData,
  width: number,
  height: number,
  sensitivity = 1.0
): Float32Array {
  const src = srcData.data;
  const numPixels = width * height;
  const rawMask = new Float32Array(numPixels);

  // 1. Pass 1: Find face centroid by accumulating skin chroma coordinates
  let skinSumX = 0;
  let skinSumY = 0;
  let skinCount = 0;

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const idx = (y * width + x) * 4;
      const r = src[idx];
      const g = src[idx + 1];
      const b = src[idx + 2];

      // YCbCr Skin Rule
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

      if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173 && r > g && g > b) {
        skinSumX += x;
        skinSumY += y;
        skinCount++;
      }
    }
  }

  // Default to upper-center of frame if face skin detection is sparse
  const faceCx = skinCount > 200 ? skinSumX / skinCount : width * 0.5;
  const faceCy = skinCount > 200 ? Math.min(height * 0.45, Math.max(height * 0.25, skinSumY / skinCount)) : height * 0.38;

  // Approximate head radius from width
  const headRx = width * 0.22 * sensitivity;
  const headRy = height * 0.24 * sensitivity;

  // 2. Pass 2: Calculate foreground probability for each pixel
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const idx = i * 4;

      const r = src[idx];
      const g = src[idx + 1];
      const b = src[idx + 2];

      // Skin Chroma Check
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      const isSkin = cb >= 75 && cb <= 130 && cr >= 130 && cr <= 175 && r > g;

      // Elliptical Head & Hair Region (includes forehead, hair, cheeks, chin)
      const headDistSq = ((x - faceCx) / headRx) ** 2 + ((y - (faceCy - headRy * 0.1)) / headRy) ** 2;
      const inHeadRegion = headDistSq <= 1.05;

      // Shoulder & Torso Trapezoid (expands downward from neck to bottom of frame)
      let inTorsoRegion = false;
      if (y > faceCy + headRy * 0.5) {
        const progressY = (y - (faceCy + headRy * 0.5)) / (height - (faceCy + headRy * 0.5));
        const torsoHalfWidth = headRx * 1.2 + progressY * (width * 0.48);
        const distFromCenter = Math.abs(x - faceCx);
        inTorsoRegion = distFromCenter <= torsoHalfWidth;
      }

      // Background Border Penalty (pixels at the outer edges are confident background)
      const isOuterBorder = x < width * 0.08 || x > width * 0.92 || (y < height * 0.08 && !inHeadRegion);

      if (isOuterBorder) {
        rawMask[i] = 0.0;
      } else if (inHeadRegion) {
        // Inside head region: skin or hair
        rawMask[i] = 1.0;
      } else if (inTorsoRegion) {
        // Inside torso: clothing or arms
        rawMask[i] = 0.92;
      } else if (isSkin && Math.abs(x - faceCx) < width * 0.35) {
        rawMask[i] = 0.85;
      } else {
        rawMask[i] = 0.0;
      }
    }
  }

  // 3. Pass 3: Fast 2D Separable Box-Filter to feather and smooth alpha edges
  const featheredMask = new Float32Array(numPixels);
  const tempMask = new Float32Array(numPixels);
  const radius = Math.max(2, Math.round(5 * sensitivity));

  // Horizontal blur pass
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    let sum = 0;
    for (let k = -radius; k <= radius; k++) {
      const px = Math.min(width - 1, Math.max(0, k));
      sum += rawMask[rowOffset + px];
    }
    const winSize = 2 * radius + 1;
    for (let x = 0; x < width; x++) {
      tempMask[rowOffset + x] = sum / winSize;
      const prevX = Math.max(0, x - radius);
      const nextX = Math.min(width - 1, x + radius + 1);
      sum += rawMask[rowOffset + nextX] - rawMask[rowOffset + prevX];
    }
  }

  // Vertical blur pass
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) {
      const py = Math.min(height - 1, Math.max(0, k));
      sum += tempMask[py * width + x];
    }
    const winSize = 2 * radius + 1;
    for (let y = 0; y < height; y++) {
      featheredMask[y * width + x] = Math.max(0.0, Math.min(1.0, sum / winSize));
      const prevY = Math.max(0, y - radius);
      const nextY = Math.min(height - 1, y + radius + 1);
      sum += tempMask[nextY * width + x] - tempMask[prevY * width + x];
    }
  }

  return featheredMask;
}

/**
 * Renders high-quality Portrait Bokeh Background Blur or Virtual Backdrop replacement.
 */
export function renderSegmentedBackground(
  srcCtx: CanvasRenderingContext2D,
  dstCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: SegmentationOptions = {}
): void {
  const {
    blurRadius = 14,
    backdropType = 'blur',
    sensitivity = 1.0,
  } = options;

  const srcData = srcCtx.getImageData(0, 0, width, height);

  // If no backdrop filter selected, perform direct pass-through
  if (backdropType === 'none') {
    dstCtx.drawImage(srcCtx.canvas, 0, 0, width, height);
    return;
  }

  // Generate feathered person segmentation mask
  const alphaMask = extractPersonForegroundMask(srcData, width, height, sensitivity);

  // If visualization mask requested, draw grayscale alpha map
  if (backdropType === 'mask') {
    const maskImg = dstCtx.createImageData(width, height);
    const mData = maskImg.data;
    for (let i = 0; i < width * height; i++) {
      const val = Math.round(alphaMask[i] * 255);
      const idx = i * 4;
      mData[idx] = val;
      mData[idx + 1] = val;
      mData[idx + 2] = val;
      mData[idx + 3] = 255;
    }
    dstCtx.putImageData(maskImg, 0, 0);
    return;
  }

  // 1. Prepare Background Layer on scratch canvas
  const bgCanvas = getScratchCanvas(width, height, 'bg');
  const bgCtx = bgCanvas.getContext('2d', { willReadFrequently: true });
  if (!bgCtx) return;

  bgCtx.clearRect(0, 0, width, height);

  if (backdropType === 'blur') {
    // Generate clean bokeh blur without edge artifacts
    bgCtx.save();
    bgCtx.filter = `blur(${Math.max(2, blurRadius)}px)`;
    // Draw slightly scaled source canvas so blur doesn't darken the boundaries
    const pad = Math.min(24, Math.round(blurRadius * 0.8));
    bgCtx.drawImage(srcCtx.canvas, -pad, -pad, width + pad * 2, height + pad * 2);
    bgCtx.filter = 'none';
    bgCtx.restore();
  } else if (backdropType === 'office') {
    // Clean modern office backdrop gradient
    const grad = bgCtx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(0.5, '#334155');
    grad.addColorStop(1, '#0f172a');
    bgCtx.fillStyle = grad;
    bgCtx.fillRect(0, 0, width, height);
  } else if (backdropType === 'studio') {
    // Professional blue spotlight studio
    const grad = bgCtx.createRadialGradient(width * 0.5, height * 0.4, 25, width * 0.5, height * 0.5, width * 0.8);
    grad.addColorStop(0, '#2563eb');
    grad.addColorStop(0.5, '#1e1b4b');
    grad.addColorStop(1, '#020617');
    bgCtx.fillStyle = grad;
    bgCtx.fillRect(0, 0, width, height);
  } else if (backdropType === 'gradient') {
    // Cyberpunk dark violet backdrop
    const grad = bgCtx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#4c1d95');
    grad.addColorStop(0.5, '#1e1b4b');
    grad.addColorStop(1, '#030712');
    bgCtx.fillStyle = grad;
    bgCtx.fillRect(0, 0, width, height);
  }

  // 2. High-Performance Alpha Compositing:
  // Out = Foreground * Alpha + Background * (1 - Alpha)
  const bgData = bgCtx.getImageData(0, 0, width, height);
  const outData = dstCtx.createImageData(width, height);

  const src = srcData.data;
  const bg = bgData.data;
  const dst = outData.data;
  const len = width * height;

  for (let i = 0; i < len; i++) {
    const a = alphaMask[i];
    const invA = 1.0 - a;
    const idx = i * 4;

    dst[idx] = Math.round(src[idx] * a + bg[idx] * invA);
    dst[idx + 1] = Math.round(src[idx + 1] * a + bg[idx + 1] * invA);
    dst[idx + 2] = Math.round(src[idx + 2] * a + bg[idx + 2] * invA);
    dst[idx + 3] = 255;
  }

  dstCtx.putImageData(outData, 0, 0);
}
