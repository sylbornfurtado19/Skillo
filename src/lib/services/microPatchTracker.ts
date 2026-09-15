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

export interface TemplateDiagnostic {
  landmarkIndex: number;
  centerX: number; // in PROC pixels
  centerY: number; // in PROC pixels
  patchRadius: number;
  searchRadius: number;
  missCount: number;
  stdDev: number;
}

interface TemplatePatch {
  landmarkIndex: number;
  centerX: number; // Pixel coordinate
  centerY: number; // Pixel coordinate
  anchorX: number; // Stored model-frame anchor
  anchorY: number;
  patchRadius: number;
  patchWidth: number;
  patchHeight: number;
  grayData: Float32Array; // Zero-mean normalized template
  sobelData?: Float32Array; // Zero-mean normalized Sobel gradient descriptor
  stdDev: number;
  sobelStdDev?: number;
  missCount: number;
}

export class MicroPatchTracker {
  private templates: Map<number, TemplatePatch> = new Map();
  private readonly patchRadius: number;
  private readonly searchRadius: number;
  private readonly maxMisses: number;
  private evictionCount: number = 0;

  /**
   * @param patchRadius Half-width of template patch (default 8 -> 16x16 patch)
   * @param searchRadius Search window displacement bounds (default 8 -> +/- 8px search)
   * @param maxMisses Maximum consecutive frames with low confidence before evicting template (default 5)
   */
  constructor(patchRadius: number = 8, searchRadius: number = 8, maxMisses: number = 5) {
    this.patchRadius = patchRadius;
    this.searchRadius = searchRadius;
    this.maxMisses = maxMisses;
  }

  /**
   * Returns total number of evicted templates across tracking lifetime.
   */
  public getEvictionCount(): number {
    return this.evictionCount;
  }

  /**
   * Returns the count of active reference templates currently tracked.
   */
  public templateCount(): number {
    return this.templates.size;
  }

  /**
   * Returns consecutive miss count for a tracked template, or -1 if non-existent.
   */
  public getMissCount(index: number): number {
    return this.templates.get(index)?.missCount ?? -1;
  }

  /**
   * Returns diagnostic information about all currently stored reference templates.
   */
  public getTemplatesDiagnostics(): TemplateDiagnostic[] {
    const list: TemplateDiagnostic[] = [];
    for (const tmpl of this.templates.values()) {
      list.push({
        landmarkIndex: tmpl.landmarkIndex,
        centerX: tmpl.centerX,
        centerY: tmpl.centerY,
        patchRadius: tmpl.patchRadius,
        searchRadius: this.searchRadius,
        missCount: tmpl.missCount,
        stdDev: tmpl.stdDev,
      });
    }
    return list;
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

      // Compute Sobel gradient descriptor for fallback matching
      const sobel = new Float32Array(totalPixels);
      let sobelSum = 0;
      let sPtr = 0;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const ym1 = Math.max(0, y - 1);
          const yp1 = Math.min(height - 1, y + 1);
          const xm1 = Math.max(0, x - 1);
          const xp1 = Math.min(width - 1, x + 1);

          const getLuma = (pxlX: number, pxlY: number) => {
            const i = (pxlY * width + pxlX) * 4;
            return 0.299 * rgbaPixels[i] + 0.587 * rgbaPixels[i + 1] + 0.114 * rgbaPixels[i + 2];
          };

          const gx = (getLuma(xp1, ym1) + 2 * getLuma(xp1, y) + getLuma(xp1, yp1)) -
                     (getLuma(xm1, ym1) + 2 * getLuma(xm1, y) + getLuma(xm1, yp1));
          const gy = (getLuma(xm1, yp1) + 2 * getLuma(x, yp1) + getLuma(xp1, yp1)) -
                     (getLuma(xm1, ym1) + 2 * getLuma(x, ym1) + getLuma(xp1, ym1));

          const mag = Math.hypot(gx, gy);
          sobel[sPtr++] = mag;
          sobelSum += mag;
        }
      }

      const sobelMean = sobelSum / totalPixels;
      let sobelVarSum = 0;
      for (let i = 0; i < totalPixels; i++) {
        sobel[i] -= sobelMean;
        sobelVarSum += sobel[i] * sobel[i];
      }
      const sobelStdDev = Math.sqrt(sobelVarSum / totalPixels);

      this.templates.set(lm.index, {
        landmarkIndex: lm.index,
        centerX: px,
        centerY: py,
        anchorX: px,
        anchorY: py,
        patchRadius: pRadius,
        patchWidth: pWidth,
        patchHeight: pHeight,
        grayData: gray,
        sobelData: sobel,
        stdDev,
        sobelStdDev,
        missCount: 0,
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
   * @param stride Search grid step size (1 for high-accuracy sub-pixel, 2 for CPU conservation)
   */
  public track(
    rgbaPixels: Uint8ClampedArray,
    width: number,
    height: number,
    minConfidence: number = 0.55,
    stride: number = 1
  ): Map<number, TrackedFeature> {
    const results = new Map<number, TrackedFeature>();
    const gridDim = this.searchRadius * 2 + 1;
    const nccGrid = new Float32Array(gridDim * gridDim);
    const step = Math.max(1, Math.round(stride));

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

      for (let dy = -this.searchRadius; dy <= this.searchRadius; dy += step) {
        const cy = tmpl.centerY + dy;
        const y0 = cy - pRadius;
        const y1 = cy + pRadius;
        if (y0 < 0 || y1 >= height) continue;

        const gy = dy + this.searchRadius;

        for (let dx = -this.searchRadius; dx <= this.searchRadius; dx += step) {
          const cx = tmpl.centerX + dx;
          const x0 = cx - pRadius;
          const x1 = cx + pRadius;
          if (x0 < 0 || x1 >= width) continue;

          const gx = dx + this.searchRadius;

          // Compute Single-Pass ZNCC: template is already zero-mean (sum(tmplGray) == 0)
          let sumI = 0;
          let sumSqI = 0;
          let num = 0;
          let pIdx = 0;

          for (let y = y0; y <= y1; y++) {
            const rowOff = y * width * 4;
            for (let x = x0; x <= x1; x++) {
              const idx = rowOff + x * 4;
              const luma = 0.299 * rgbaPixels[idx] + 0.587 * rgbaPixels[idx + 1] + 0.114 * rgbaPixels[idx + 2];
              sumI += luma;
              sumSqI += luma * luma;
              num += tmplGray[pIdx++] * luma;
            }
          }

          const varI = Math.max(0, sumSqI - (sumI * sumI) / totalPixels);
          const candStdDev = Math.sqrt(varI / totalPixels);
          const ncc = (candStdDev >= 1.0 && tmpl.stdDev >= 1.0)
            ? num / (tmpl.stdDev * candStdDev * totalPixels)
            : 0;
          nccGrid[gy * gridDim + gx] = ncc;

          if (ncc > bestNCC) {
            bestNCC = ncc;
            bestDx = dx;
            bestDy = dy;
          }
        }
      }

      // Fallback: If standard grayscale NCC fails, evaluate Sobel gradient correlation
      let usedFallback = false;
      if (bestNCC < minConfidence && tmpl.sobelData && tmpl.sobelStdDev && tmpl.sobelStdDev > 0.5) {
        const tmplSobel = tmpl.sobelData;
        const sobelStdDev = tmpl.sobelStdDev;
        let bestSobelNCC = -1;
        let bestSobelDx = 0;
        let bestSobelDy = 0;

        for (let dy = -this.searchRadius; dy <= this.searchRadius; dy += step) {
          const cy = tmpl.centerY + dy;
          const y0 = cy - pRadius;
          const y1 = cy + pRadius;
          if (y0 < 0 || y1 >= height) continue;

          for (let dx = -this.searchRadius; dx <= this.searchRadius; dx += step) {
            const cx = tmpl.centerX + dx;
            const x0 = cx - pRadius;
            const x1 = cx + pRadius;
            if (x0 < 0 || x1 >= width) continue;

            // Extract Sobel magnitudes for candidate
            let sumS = 0;
            let pIdx = 0;
            const candSobel = new Float32Array(totalPixels);
            for (let y = y0; y <= y1; y++) {
              for (let x = x0; x <= x1; x++) {
                const ym1 = Math.max(0, y - 1);
                const yp1 = Math.min(height - 1, y + 1);
                const xm1 = Math.max(0, x - 1);
                const xp1 = Math.min(width - 1, x + 1);

                const getLuma = (pxlX: number, pxlY: number) => {
                  const i = (pxlY * width + pxlX) * 4;
                  return 0.299 * rgbaPixels[i] + 0.587 * rgbaPixels[i + 1] + 0.114 * rgbaPixels[i + 2];
                };

                const gx = (getLuma(xp1, ym1) + 2 * getLuma(xp1, y) + getLuma(xp1, yp1)) -
                           (getLuma(xm1, ym1) + 2 * getLuma(xm1, y) + getLuma(xm1, yp1));
                const gy = (getLuma(xm1, yp1) + 2 * getLuma(x, yp1) + getLuma(xp1, yp1)) -
                           (getLuma(xm1, ym1) + 2 * getLuma(x, ym1) + getLuma(xp1, ym1));
                const mag = Math.hypot(gx, gy);
                candSobel[pIdx++] = mag;
                sumS += mag;
              }
            }

            const meanS = sumS / totalPixels;
            let numS = 0;
            let varS = 0;
            for (let i = 0; i < totalPixels; i++) {
              const diff = candSobel[i] - meanS;
              numS += tmplSobel[i] * diff;
              varS += diff * diff;
            }
            const denomS = sobelStdDev * Math.sqrt(varS / totalPixels) * totalPixels;
            const sobelNCC = denomS > 0.0001 ? numS / denomS : 0;
            if (sobelNCC > bestSobelNCC) {
              bestSobelNCC = sobelNCC;
              bestSobelDx = dx;
              bestSobelDy = dy;
            }
          }
        }

        if (bestSobelNCC >= minConfidence * 0.82) {
          bestNCC = bestSobelNCC;
          bestDx = bestSobelDx;
          bestDy = bestSobelDy;
          usedFallback = true;
        }
      }

      if (bestNCC >= minConfidence || usedFallback) {
        tmpl.missCount = 0;

        // Sub-pixel quadratic peak interpolation around bestDx, bestDy (when stride === 1)
        let subDx = bestDx;
        let subDy = bestDy;
        const gx = bestDx + this.searchRadius;
        const gy = bestDy + this.searchRadius;

        if (step === 1 && !usedFallback) {
          if (gx > 0 && gx < gridDim - 1) {
            const c0 = nccGrid[gy * gridDim + gx];
            const cL = nccGrid[gy * gridDim + (gx - 1)];
            const cR = nccGrid[gy * gridDim + (gx + 1)];
            if (cL >= 0 && cR >= 0) {
              const denom = cL - 2 * c0 + cR;
              if (Math.abs(denom) > 1e-6) {
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
              if (Math.abs(denom) > 1e-6) {
                const deltaY = (cT - cB) / (2 * denom);
                subDy += Math.max(-0.5, Math.min(0.5, deltaY));
              }
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
      } else {
        // Increment miss count and apply template aging logic:
        // Evict stale templates after maxMisses, but attempt re-capture from initial model anchor before full eviction
        tmpl.missCount++;
        if (tmpl.missCount < this.maxMisses) {
          tmpl.centerX = tmpl.anchorX;
          tmpl.centerY = tmpl.anchorY;
        } else {
          this.evictionCount++;
          this.templates.delete(index);
        }
      }
    }

    // Region-level topology preservation check (reject one if bilateral scale expands or collapses > 50%)
    const checkTopologyPair = (idxA: number, idxB: number) => {
      const rA = results.get(idxA);
      const rB = results.get(idxB);
      const tA = this.templates.get(idxA);
      const tB = this.templates.get(idxB);
      if (rA && rB && tA && tB) {
        const initialDist = Math.hypot(tA.anchorX - tB.anchorX, tA.anchorY - tB.anchorY);
        const currentDist = Math.hypot((rA.x - rB.x) * width, (rA.y - rB.y) * height);
        if (initialDist > 2 && (currentDist < initialDist * 0.50 || currentDist > initialDist * 1.50)) {
          if (rA.ncc < rB.ncc) {
            results.delete(idxA);
          } else {
            results.delete(idxB);
          }
        }
      }
    };
    checkTopologyPair(68, 69); // Eyes
    checkTopologyPair(48, 54); // Mouth corners

    return results;
  }
}
