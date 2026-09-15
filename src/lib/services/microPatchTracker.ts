/**
 * MicroPatchTracker (microPatchTracker.ts)
 *
 * Lightweight, 60 FPS Normalized Cross-Correlation (NCC) template tracker
 * for micro-features (pupils and mouth corners) between model inference frames.
 *
 * Eliminates high-speed saccadic detach by tracking localized 16x16 / 24x24 grayscale
 * patches with sub-pixel cross-correlation in a localized search window (+/- 8px).
 */

export interface TrackedFeature {
  landmarkIndex: number;
  x: number; // Normalized [0..1]
  y: number; // Normalized [0..1]
  ncc: number; // Confidence score [0..1]
}

interface TemplatePatch {
  landmarkIndex: number;
  centerX: number; // Pixel coordinate
  centerY: number; // Pixel coordinate
  patchRadius: number;
  patchWidth: number;
  patchHeight: number;
  grayData: Float32Array; // Zero-mean normalized template
  stdDev: number;
}

export class MicroPatchTracker {
  private templates: Map<number, TemplatePatch> = new Map();
  private readonly patchRadius: number;
  private readonly searchRadius: number;

  /**
   * @param patchRadius Half-width of template patch (default 8 -> 16x16 patch)
   * @param searchRadius Search window displacement bounds (default 8 -> +/- 8px search)
   */
  constructor(patchRadius: number = 8, searchRadius: number = 8) {
    this.patchRadius = patchRadius;
    this.searchRadius = searchRadius;
  }

  /**
   * Returns the count of active reference templates currently tracked.
   */
  public templateCount(): number {
    return this.templates.size;
  }

  /**
   * Resets all stored templates.
   */
  public reset(): void {
    this.templates.clear();
  }

  /**
   * Updates reference templates from a freshly inferred model frame.
   *
   * @param rgbaPixels Frame pixel buffer (320x240)
   * @param width Frame width
   * @param height Frame height
   * @param targetLandmarks Array of points { index, x, y, patchRadius? } in normalized [0..1] space
   */
  public updateTemplates(
    rgbaPixels: Uint8ClampedArray,
    width: number,
    height: number,
    targetLandmarks: Array<{ index: number; x: number; y: number; patchRadius?: number }>
  ): void {
    this.templates.clear();

    for (const lm of targetLandmarks) {
      const px = Math.round(lm.x * width);
      const py = Math.round(lm.y * height);
      const pRadius = lm.patchRadius ?? this.patchRadius;

      const x0 = px - pRadius;
      const y0 = py - pRadius;
      const x1 = px + pRadius;
      const y1 = py + pRadius;

      // Ensure template lies completely inside image boundaries
      if (x0 < 0 || y0 < 0 || x1 >= width || y1 >= height) {
        continue;
      }

      const pWidth = x1 - x0 + 1;
      const pHeight = y1 - y0 + 1;
      const totalPixels = pWidth * pHeight;
      const gray = new Float32Array(totalPixels);

      let sum = 0;
      let ptr = 0;
      for (let y = y0; y <= y1; y++) {
        const rowOff = y * width * 4;
        for (let x = x0; x <= x1; x++) {
          const idx = rowOff + x * 4;
          // Standard ITU-R BT.601 luma conversion
          const luma = 0.299 * rgbaPixels[idx] + 0.587 * rgbaPixels[idx + 1] + 0.114 * rgbaPixels[idx + 2];
          gray[ptr++] = luma;
          sum += luma;
        }
      }

      const mean = sum / totalPixels;
      let varSum = 0;
      for (let i = 0; i < totalPixels; i++) {
        gray[i] -= mean;
        varSum += gray[i] * gray[i];
      }

      const stdDev = Math.sqrt(varSum / totalPixels);
      if (stdDev < 1.5) {
        // Flat/homogeneous region (low contrast) - unsuitable for NCC tracking
        continue;
      }

      this.templates.set(lm.index, {
        landmarkIndex: lm.index,
        centerX: px,
        centerY: py,
        patchRadius: pRadius,
        patchWidth: pWidth,
        patchHeight: pHeight,
        grayData: gray,
        stdDev,
      });
    }
  }

  /**
   * Tracks stored templates in the new incoming frame.
   *
   * @param rgbaPixels Current frame pixel buffer
   * @param width Frame width
   * @param height Frame height
   * @param minConfidence Minimum NCC correlation coefficient [0..1] (default 0.55)
   */
  public track(
    rgbaPixels: Uint8ClampedArray,
    width: number,
    height: number,
    minConfidence: number = 0.55
  ): Map<number, TrackedFeature> {
    const results = new Map<number, TrackedFeature>();
    const gridDim = this.searchRadius * 2 + 1;
    const nccGrid = new Float32Array(gridDim * gridDim);

    for (const [index, tmpl] of this.templates.entries()) {
      let bestNCC = -1;
      let bestDx = 0;
      let bestDy = 0;

      const pRadius = tmpl.patchRadius;
      const pWidth = tmpl.patchWidth;
      const pHeight = tmpl.patchHeight;
      const totalPixels = pWidth * pHeight;
      const tmplGray = tmpl.grayData;

      nccGrid.fill(-1);

      for (let dy = -this.searchRadius; dy <= this.searchRadius; dy += 1) {
        const cy = tmpl.centerY + dy;
        const y0 = cy - pRadius;
        const y1 = cy + pRadius;
        if (y0 < 0 || y1 >= height) continue;

        const gy = dy + this.searchRadius;

        for (let dx = -this.searchRadius; dx <= this.searchRadius; dx += 1) {
          const cx = tmpl.centerX + dx;
          const x0 = cx - pRadius;
          const x1 = cx + pRadius;
          if (x0 < 0 || x1 >= width) continue;

          const gx = dx + this.searchRadius;

          // Compute NCC between template and candidate window
          let sumI = 0;
          for (let y = y0; y <= y1; y++) {
            const rowOff = y * width * 4;
            for (let x = x0; x <= x1; x++) {
              const idx = rowOff + x * 4;
              sumI += 0.299 * rgbaPixels[idx] + 0.587 * rgbaPixels[idx + 1] + 0.114 * rgbaPixels[idx + 2];
            }
          }
          const meanI = sumI / totalPixels;

          let num = 0;
          let varI = 0;
          let pIdx = 0;

          for (let y = y0; y <= y1; y++) {
            const rowOff = y * width * 4;
            for (let x = x0; x <= x1; x++) {
              const idx = rowOff + x * 4;
              const luma = (0.299 * rgbaPixels[idx] + 0.587 * rgbaPixels[idx + 1] + 0.114 * rgbaPixels[idx + 2]) - meanI;
              num += tmplGray[pIdx++] * luma;
              varI += luma * luma;
            }
          }

          const denom = tmpl.stdDev * Math.sqrt(varI / totalPixels) * totalPixels;
          const ncc = denom > 0.0001 ? num / denom : 0;
          nccGrid[gy * gridDim + gx] = ncc;

          if (ncc > bestNCC) {
            bestNCC = ncc;
            bestDx = dx;
            bestDy = dy;
          }
        }
      }

      if (bestNCC >= minConfidence) {
        // Sub-pixel quadratic peak interpolation around bestDx, bestDy
        let subDx = bestDx;
        let subDy = bestDy;
        const gx = bestDx + this.searchRadius;
        const gy = bestDy + this.searchRadius;

        if (gx > 0 && gx < gridDim - 1) {
          const c0 = nccGrid[gy * gridDim + gx];
          const cL = nccGrid[gy * gridDim + (gx - 1)];
          const cR = nccGrid[gy * gridDim + (gx + 1)];
          if (cL >= 0 && cR >= 0) {
            const denom = cL - 2 * c0 + cR;
            if (denom < -1e-5) {
              const deltaX = (cL - cR) / (2 * denom);
              subDx += Math.max(-0.5, Math.min(0.5, deltaX));
            }
          }
        }

        if (gy > 0 && gy < gridDim - 1) {
          const c0 = nccGrid[gy * gridDim + gx];
          const cT = nccGrid[(gy - 1) * gridDim + gx];
          const cB = nccGrid[(gy + 1) * gridDim + gx];
          if (cT >= 0 && cB >= 0) {
            const denom = cT - 2 * c0 + cB;
            if (denom < -1e-5) {
              const deltaY = (cT - cB) / (2 * denom);
              subDy += Math.max(-0.5, Math.min(0.5, deltaY));
            }
          }
        }

        const updatedX = (tmpl.centerX + subDx) / width;
        const updatedY = (tmpl.centerY + subDy) / height;

        results.set(index, {
          landmarkIndex: index,
          x: Math.max(0, Math.min(1, updatedX)),
          y: Math.max(0, Math.min(1, updatedY)),
          ncc: Math.min(1.0, Math.max(0, bestNCC)),
        });
      }
    }

    return results;
  }
}
