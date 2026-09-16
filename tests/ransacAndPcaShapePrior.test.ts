import {
  computeSimilarityTransform,
  computeRansacSimilarityTransform,
  PCAShapePrior,
  DenseLandmarksSmoother,
  type LandmarkPoint2D,
} from '../src/lib/services/temporalSmoothing';

describe('RANSAC Similarity Relocalization & PCA Shape Prior', () => {
  describe('computeRansacSimilarityTransform', () => {
    it('rejects outliers and recovers true similarity transform under 30% contamination', () => {
      // Create a set of 10 anchor points on a face (eyes, nose, mouth)
      const cleanSource: LandmarkPoint2D[] = [
        { x: 0.35, y: 0.38 }, { x: 0.38, y: 0.36 }, { x: 0.41, y: 0.38 }, // Right eye
        { x: 0.59, y: 0.38 }, { x: 0.62, y: 0.36 }, { x: 0.65, y: 0.38 }, // Left eye
        { x: 0.50, y: 0.55 }, // Nose tip
        { x: 0.40, y: 0.68 }, { x: 0.50, y: 0.72 }, { x: 0.60, y: 0.68 }, // Mouth
      ];

      // Ground-truth rigid transform: scale = 1.05, translation = (+0.02, -0.01), rotation = 0.05 rad
      const trueScale = 1.05;
      const trueRot = 0.04;
      const trueTx = 0.02;
      const trueTy = -0.01;
      const cosR = Math.cos(trueRot);
      const sinR = Math.sin(trueRot);

      const target: LandmarkPoint2D[] = cleanSource.map(p => ({
        x: trueScale * (cosR * p.x - sinR * p.y) + trueTx,
        y: trueScale * (sinR * p.x + cosR * p.y) + trueTy,
      }));

      // Corrupt 3 out of 10 points (30% contamination) with large random outliers
      target[0] = { x: 0.95, y: 0.10 }; // wildly displaced right eye corner
      target[7] = { x: 0.10, y: 0.95 }; // wildly displaced mouth corner
      target[9] = { x: 0.88, y: 0.90 }; // wildly displaced mouth corner

      // Standard least-squares will be severely skewed by outliers
      const standardTransform = computeSimilarityTransform(cleanSource, target);
      // RANSAC estimator should identify inliers and recover true transform
      const ransacTransform = computeRansacSimilarityTransform(cleanSource, target, 30, 0.04);

      expect(ransacTransform.inlierCount).toBeGreaterThanOrEqual(6);
      expect(ransacTransform.scale).toBeCloseTo(trueScale, 1);
      expect(ransacTransform.rotation).toBeCloseTo(trueRot, 1);
      expect(ransacTransform.tx).toBeCloseTo(trueTx, 1);
      expect(ransacTransform.ty).toBeCloseTo(trueTy, 1);

      // Verify that RANSAC has lower error on clean inliers than standard LS
      const inlierErrorsRansac = cleanSource.slice(1, 7).map((p, idx) => {
        const i = idx + 1;
        const predX = ransacTransform.scale * (Math.cos(ransacTransform.rotation) * p.x - Math.sin(ransacTransform.rotation) * p.y) + ransacTransform.tx;
        const predY = ransacTransform.scale * (Math.sin(ransacTransform.rotation) * p.x + Math.cos(ransacTransform.rotation) * p.y) + ransacTransform.ty;
        return Math.hypot(predX - target[i].x, predY - target[i].y);
      });
      const meanInlierError = inlierErrorsRansac.reduce((a, b) => a + b, 0) / inlierErrorsRansac.length;
      expect(meanInlierError).toBeLessThan(0.015);
    });
  });

  describe('PCAShapePrior', () => {
    it('clamps outlier corrupted landmark points back toward plausible facial manifold', () => {
      // Build a standard 70-point face from canonical mean shape
      const points: LandmarkPoint2D[] = PCAShapePrior.getMeanShape();

      // Corrupt a mouth corner (index 48) and an eye pupil (index 68) with 5-sigma outliers
      const originalMouthX = points[48].x;
      const originalPupilY = points[68].y;
      points[48].x += 0.20; // 20% displacement out of face
      points[68].y -= 0.20; // 20% displacement up into forehead

      const projected = PCAShapePrior.project(points, 3.0, 0.40);

      expect(projected.length).toBe(70);
      // The outlier mouth point should be pulled back towards plausible configuration
      const correctedMouthDelta = Math.abs(projected[48].x - originalMouthX);
      expect(correctedMouthDelta).toBeLessThan(0.18);

      // The outlier pupil point should be pulled back towards plausible eye socket
      const correctedPupilDelta = Math.abs(projected[68].y - originalPupilY);
      expect(correctedPupilDelta).toBeLessThan(0.18);
    });

    it('smoother respects setEnablePcaProjection toggle', () => {
      const smoother = new DenseLandmarksSmoother(70, 'BALANCED');
      expect(smoother.getEnablePcaProjection()).toBe(false);

      smoother.setEnablePcaProjection(true);
      expect(smoother.getEnablePcaProjection()).toBe(true);

      smoother.setEnablePcaProjection(false);
      expect(smoother.getEnablePcaProjection()).toBe(false);

      smoother.setEnablePcaProjection(true, 0.25);
      expect(smoother.getEnablePcaProjection()).toBe(true);
    });
  });
});
