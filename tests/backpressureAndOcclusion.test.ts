import {
  isNewerRequestId,
} from '../src/types/workerMessages';
import {
  LandmarkKinematicFilter,
  DenseLandmarksSmoother,
  PRESET_REGIONAL_CONFIGS,
} from '../src/lib/services/temporalSmoothing';

describe('Backpressure Request ID Handshake & Ordering', () => {
  it('accepts strictly monotonically increasing request IDs', () => {
    expect(isNewerRequestId(1, 0)).toBe(true);
    expect(isNewerRequestId(2, 1)).toBe(true);
    expect(isNewerRequestId(100, 99)).toBe(true);
  });

  it('rejects stale or out-of-order request IDs', () => {
    expect(isNewerRequestId(1, 2)).toBe(false);
    expect(isNewerRequestId(50, 50)).toBe(false);
    expect(isNewerRequestId(45, 50)).toBe(false);
  });

  it('handles safe 30-bit modular counter wrapping cleanly', () => {
    const maxVal = (1 << 30) - 2;
    const wrappedVal = 2;
    expect(isNewerRequestId(wrappedVal, maxVal)).toBe(true);
    expect(isNewerRequestId(maxVal, wrappedVal)).toBe(false);
  });
});

describe('LandmarkKinematicFilter Occlusion Backstop & Fading', () => {
  it('maintains 100% opacity when landmarks have confident measurements', () => {
    const filter = new LandmarkKinematicFilter({
      confThreshold: 0.35,
      fadeStartSec: 0.35,
      fadeEndSec: 1.0,
    });

    for (let i = 0; i < 30; i++) {
      const res = filter.update({ x: 0.5, y: 0.5 }, 0.95, 0.033);
      expect(res.opacity).toBe(1.0);
      expect(res.occludedSec).toBe(0);
    }
  });

  it('gradually decays opacity and zeroes velocity after prolonged occlusion', () => {
    const filter = new LandmarkKinematicFilter({
      confThreshold: 0.35,
      fadeStartSec: 0.35,
      fadeEndSec: 1.0,
      maxCumulativeDrift: 0.08,
    });

    // 1. Establish anchor position and a moving velocity vector
    filter.update({ x: 0.5, y: 0.5 }, 0.95, 0.033);
    filter.update({ x: 0.52, y: 0.52 }, 0.95, 0.033);

    // 2. Feed 10 occluded frames (0.33s < fadeStartSec)
    for (let i = 0; i < 10; i++) {
      const res = filter.update({ x: 0.6, y: 0.6 }, 0.1, 0.033);
      expect(res.opacity).toBe(1.0);
      expect(res.occludedSec).toBeCloseTo((i + 1) * 0.033, 2);
    }

    // 3. Feed frames up to 0.70s (mid-fade)
    let midFadeRes;
    for (let i = 0; i < 12; i++) {
      midFadeRes = filter.update({ x: 0.6, y: 0.6 }, 0.1, 0.033);
    }
    expect(midFadeRes!.opacity).toBeLessThan(1.0);
    expect(midFadeRes!.opacity).toBeGreaterThan(0.0);

    // 4. Feed frames up to > 1.1s (complete fade)
    let finalRes;
    for (let i = 0; i < 20; i++) {
      finalRes = filter.update({ x: 0.6, y: 0.6 }, 0.1, 0.033);
    }
    expect(finalRes!.opacity).toBe(0.0);
    expect(finalRes!.vel.x).toBe(0);
    expect(finalRes!.vel.y).toBe(0);

    // Assert cumulative drift from the anchor position (0.52, 0.52) is strictly capped <= 0.08
    const drift = Math.hypot(finalRes!.pos.x - 0.52, finalRes!.pos.y - 0.52);
    expect(drift).toBeLessThanOrEqual(0.0801);
  });

  it('immediately restores 100% opacity when tracking confidence returns', () => {
    const filter = new LandmarkKinematicFilter();
    filter.update({ x: 0.5, y: 0.5 }, 0.9, 0.033);

    // Occlude for 1.2s
    for (let i = 0; i < 40; i++) {
      filter.update({ x: 0.5, y: 0.5 }, 0.05, 0.033);
    }
    expect(filter.getOpacity()).toBe(0.0);

    // Subject returns with high confidence
    const recoveryRes = filter.update({ x: 0.55, y: 0.55 }, 0.95, 0.033);
    expect(recoveryRes.opacity).toBe(1.0);
    expect(recoveryRes.occludedSec).toBe(0);
    expect(recoveryRes.pos.x).toBeCloseTo(0.55, 1);
  });
});

describe('DenseLandmarksSmoother Regional Specialization & Presets', () => {
  it('configures eye landmarks with faster response dynamics than nose/jaw landmarks', () => {
    const smoother = new DenseLandmarksSmoother(70, 'BALANCED');

    // Create baseline buffer with stationary points at (0.5, 0.5)
    const baseBuffer = new Float32Array(70 * 4);
    for (let i = 0; i < 70; i++) {
      baseBuffer[i * 4] = 0.5;
      baseBuffer[i * 4 + 1] = 0.5;
      baseBuffer[i * 4 + 2] = 0.0;
      baseBuffer[i * 4 + 3] = 0.95;
    }

    smoother.updateFromBuffer(baseBuffer, 70, 1000);

    // Step input: move all points to (0.6, 0.6)
    const stepBuffer = new Float32Array(70 * 4);
    for (let i = 0; i < 70; i++) {
      stepBuffer[i * 4] = 0.6;
      stepBuffer[i * 4 + 1] = 0.6;
      stepBuffer[i * 4 + 2] = 0.0;
      stepBuffer[i * 4 + 3] = 0.95;
    }

    const stepRes = smoother.updateFromBuffer(stepBuffer, 70, 1033);

    const eyePoint = stepRes.points[68]; // Pupil
    const nosePoint = stepRes.points[30]; // Nose bridge/tip

    // Eyes have higher alpha_fast and should move closer to 0.6 on sudden step than nose/jaw
    const eyeDelta = Math.abs(eyePoint.x - 0.5);
    const noseDelta = Math.abs(nosePoint.x - 0.5);

    expect(eyeDelta).toBeGreaterThan(noseDelta);
  });

  it('switches tracking presets dynamically', () => {
    const smoother = new DenseLandmarksSmoother(70, 'BALANCED');

    const buffer = new Float32Array(70 * 4);
    for (let i = 0; i < 70; i++) {
      buffer[i * 4] = 0.5;
      buffer[i * 4 + 1] = 0.5;
      buffer[i * 4 + 3] = 0.9;
    }

    const res1 = smoother.updateFromBuffer(buffer, 70, 1000);
    expect(res1.activePreset).toBe('BALANCED');

    smoother.setPreset('ULTRA_SMOOTH');
    const res2 = smoother.updateFromBuffer(buffer, 70, 1033);
    expect(res2.activePreset).toBe('ULTRA_SMOOTH');

    smoother.setPreset('ULTRA_RESPONSIVE');
    const res3 = smoother.updateFromBuffer(buffer, 70, 1066);
    expect(res3.activePreset).toBe('ULTRA_RESPONSIVE');
  });

  it('exposes visibilityOpacity and occludedDurationSec across all landmarks', () => {
    const smoother = new DenseLandmarksSmoother(70, 'BALANCED');

    // Feed occluded buffer
    const occludedBuf = new Float32Array(70 * 4);
    for (let i = 0; i < 70; i++) {
      occludedBuf[i * 4] = 0.5;
      occludedBuf[i * 4 + 1] = 0.5;
      occludedBuf[i * 4 + 3] = 0.05; // Low confidence
    }

    let lastRes;
    for (let t = 1000; t <= 2500; t += 33) {
      lastRes = smoother.updateFromBuffer(occludedBuf, 70, t);
    }

    expect(lastRes!.visibilityOpacity).toBe(0);
    expect(lastRes!.occludedDurationSec).toBeGreaterThan(1.0);
  });
});
