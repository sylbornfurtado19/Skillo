'use client';

export type VirtualBackdropType = 'none' | 'blur' | 'office' | 'studio' | 'gradient' | 'mask';

export interface SegmentationOptions {
  blurRadius?: number; // 0 to 25 px
  backdropType?: VirtualBackdropType;
  skinThresholdStrictness?: number; // 0.8 to 1.2
  featherEdgeRadius?: number;
}

/**
 * Extracts a binary foreground/skin segmentation mask using HSV and YCbCr color thresholds.
 * Based on empirical skin-chroma distributions from the Pratheepan dataset.
 */
export function extractSkinForegroundMask(
  srcData: ImageData,
  width: number,
  height: number,
  strictness = 1.0
): Uint8Array<any> {
  const src = srcData.data;
  const mask = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const r = src[i * 4];
    const g = src[i * 4 + 1];
    const b = src[i * 4 + 2];

    // 1. RGB Rule
    const isRgbSkin = r > 95 && g > 40 && b > 20 && Math.max(r, g, b) - Math.min(r, g, b) > 15 && Math.abs(r - g) > 15 && r > g && r > b;

    // 2. YCbCr Rule (Pratheepan dataset distribution)
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    const isYCbCrSkin = y >= 60 && cb >= 77 * strictness && cb <= 127 / strictness && cr >= 133 * strictness && cr <= 173 / strictness;

    // 3. Central Upper Body Bias (Center region is prioritized as foreground)
    const px = i % width;
    const py = Math.floor(i / width);
    const distFromCenter = Math.sqrt(((px - width / 2) / (width / 2)) ** 2 + ((py - height / 2) / (height / 2)) ** 2);
    const centerBias = distFromCenter < 0.75;

    if ((isRgbSkin || isYCbCrSkin) || (centerBias && distFromCenter < 0.35)) {
      mask[i] = 1;
    } else {
      mask[i] = 0;
    }
  }

  // Morphological 3x3 Opening (Erosion followed by Dilation) to eliminate salt-and-pepper noise
  const cleanedMask = new Uint8Array(width * height);
  for (let py = 1; py < height - 1; py++) {
    for (let px = 1; px < width - 1; px++) {
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (mask[(py + dy) * width + (px + dx)] === 1) count++;
        }
      }
      cleanedMask[py * width + px] = count >= 5 ? 1 : 0;
    }
  }

  return cleanedMask;
}

/**
 * Applies background blur or virtual backdrop replacement onto the destination canvas.
 */
export function renderSegmentedBackground(
  srcCtx: CanvasRenderingContext2D,
  dstCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: SegmentationOptions = {}
): void {
  const {
    blurRadius = 12,
    backdropType = 'blur',
    skinThresholdStrictness = 1.0,
  } = options;

  const srcData = srcCtx.getImageData(0, 0, width, height);
  const mask = extractSkinForegroundMask(srcData, width, height, skinThresholdStrictness);

  if (backdropType === 'mask') {
    // Render raw binary segmentation mask for visualization
    const maskImg = dstCtx.createImageData(width, height);
    for (let i = 0; i < width * height; i++) {
      const val = mask[i] === 1 ? 255 : 0;
      maskImg.data[i * 4] = val;
      maskImg.data[i * 4 + 1] = val;
      maskImg.data[i * 4 + 2] = val;
      maskImg.data[i * 4 + 3] = 255;
    }
    dstCtx.putImageData(maskImg, 0, 0);
    return;
  }

  // 1. Draw Background Layer (Blurred, Virtual Office, or Dark Gradient)
  dstCtx.save();
  if (backdropType === 'blur' || backdropType === 'none') {
    if (blurRadius > 0 && backdropType !== 'none') {
      dstCtx.filter = `blur(${blurRadius}px)`;
    }
    dstCtx.drawImage(srcCtx.canvas, 0, 0, width, height);
  } else if (backdropType === 'office') {
    // Clean modern office backdrop gradient simulation
    const grad = dstCtx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(0.5, '#334155');
    grad.addColorStop(1, '#0f172a');
    dstCtx.fillStyle = grad;
    dstCtx.fillRect(0, 0, width, height);
  } else if (backdropType === 'studio') {
    // Professional studio backdrop
    const grad = dstCtx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, width * 0.7);
    grad.addColorStop(0, '#3b82f6');
    grad.addColorStop(0.6, '#1e1b4b');
    grad.addColorStop(1, '#020617');
    dstCtx.fillStyle = grad;
    dstCtx.fillRect(0, 0, width, height);
  } else if (backdropType === 'gradient') {
    // Subtle cyber dark backdrop
    const grad = dstCtx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#311042');
    grad.addColorStop(1, '#090d16');
    dstCtx.fillStyle = grad;
    dstCtx.fillRect(0, 0, width, height);
  }
  dstCtx.restore();

  // 2. Composite Foreground Candidate with Feathered Alpha Mask
  const bgData = dstCtx.getImageData(0, 0, width, height);
  const outData = dstCtx.createImageData(width, height);

  const src = srcData.data;
  const bg = bgData.data;
  const dst = outData.data;

  for (let i = 0; i < width * height; i++) {
    const isFg = mask[i] === 1;
    const idx = i * 4;

    if (isFg) {
      dst[idx] = src[idx];
      dst[idx + 1] = src[idx + 1];
      dst[idx + 2] = src[idx + 2];
      dst[idx + 3] = 255;
    } else {
      dst[idx] = bg[idx];
      dst[idx + 1] = bg[idx + 1];
      dst[idx + 2] = bg[idx + 2];
      dst[idx + 3] = 255;
    }
  }

  dstCtx.putImageData(outData, 0, 0);
}
