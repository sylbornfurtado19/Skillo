import { PCAShapePrior, DenseLandmarksSmoother } from '../src/lib/services/temporalSmoothing';

describe('PCA Clamp Frequency & Bias Monitoring (PR E)', () => {
  beforeEach(() => {
    PCAShapePrior.resetClampStats();
  });

  it('accurately tracks subspace projection count and zero clamps on canonical mean shape', () => {
    const mean = PCAShapePrior.getMeanShape();
    expect(mean).toHaveLength(70);

    const projected = PCAShapePrior.project(mean, 3.0, 0.2);
    expect(projected).toHaveLength(70);

    const stats = PCAShapePrior.getClampStats();
    expect(stats.totalProjections).toBe(1);
    expect(stats.totalClamps).toBe(0);
    expect(stats.clampCountPerMode).toEqual([0, 0, 0, 0, 0]);
    expect(stats.clampRatePerModePercent).toEqual([0, 0, 0, 0, 0]);
  });

  it('detects and logs outlier clamps when shape coordinates exceed 3 sigma bounds', () => {
    const mean = PCAShapePrior.getMeanShape();

    // Create exaggerated vertical mouth opening (Mode 1 outlier)
    const exaggerated = mean.map((p, i) => {
      if (i >= 48 && i <= 67) {
        return { x: p.x, y: p.y + 0.6 }; // Massive mouth droop
      }
      return { ...p };
    });

    const projected = PCAShapePrior.project(exaggerated, 2.0, 0.2);
    expect(projected).toHaveLength(70);

    const stats = PCAShapePrior.getClampStats();
    expect(stats.totalProjections).toBe(1);
    expect(stats.totalClamps).toBeGreaterThan(0);
    expect(stats.clampCountPerMode[1]).toBeGreaterThan(0); // Mode 1 jaw opening was clamped
    expect(stats.clampRatePerModePercent[1]).toBeGreaterThan(0);
  });

  it('exposes PCA clamp telemetry through DenseLandmarksSmoother instance', () => {
    const smoother = new DenseLandmarksSmoother(70, 'BALANCED');
    const stats = smoother.getPCAClampStats();
    expect(stats).toBeDefined();
    expect(stats.totalProjections).toBe(0);
    expect(Array.isArray(stats.clampCountPerMode)).toBe(true);
  });
});
