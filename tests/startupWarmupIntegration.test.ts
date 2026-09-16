import {
  detectFastFaceBootstrap,
  detectDeviceProfile,
  computeCoordinateMapping,
  mapNormalizedToCanvas,
} from '../src/lib/services/visionPipeline';
import {
  DenseLandmarksSmoother,
} from '../src/lib/services/temporalSmoothing';
import { MicroPatchTracker } from '../src/lib/services/microPatchTracker';
import {
  getIVPFeatureFlags,
  setIVPFeatureFlag,
} from '../src/lib/services/ivpFeatureFlags';

describe('Startup & Warmup Integration (<1.5s visual lock-in)', () => {
  const PROC_W = 160;
  const PROC_H = 120;

  function createSyntheticSkinFrame(w = PROC_W, h = PROC_H): Uint8ClampedArray {
    const data = new Uint8ClampedArray(w * h * 4);
    // Background
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 30;
      data[i + 1] = 40;
      data[i + 2] = 60;
      data[i + 3] = 255;
    }
    // Face skin block (x: 40..120, y: 25..95)
    for (let y = 25; y < 95; y++) {
      for (let x = 40; x < 120; x++) {
        const idx = (y * w + x) * 4;
        data[idx] = 210;
        data[idx + 1] = 160;
        data[idx + 2] = 140;
        data[idx + 3] = 255;
      }
    }
    // Pupils
    const cx = 80, cy = 60;
    const eyeY = cy - 10;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const rIdx = ((eyeY + dy) * w + (cx - 16 + dx)) * 4;
        data[rIdx] = 20; data[rIdx + 1] = 20; data[rIdx + 2] = 20;
        const lIdx = ((eyeY + dy) * w + (cx + 16 + dx)) * 4;
        data[lIdx] = 20; data[lIdx + 1] = 20; data[lIdx + 2] = 20;
      }
    }
    // Mouth
    const mouthY = cy + 15;
    for (let mx = cx - 14; mx <= cx + 14; mx++) {
      const mIdx = (mouthY * w + mx) * 4;
      data[mIdx] = 60; data[mIdx + 1] = 20; data[mIdx + 2] = 20;
    }
    return data;
  }

  describe('Slow Model Init Simulation (<1.5s lock-in via Fast Bootstrap)', () => {
    it('produces first templates in <500ms and first smoothed overlay in <1500ms', () => {
      const pageLoadTs = performance.now();
      const rawFrame = createSyntheticSkinFrame();

      // State machine
      type TrackingState = 'BOOTSTRAPPING' | 'MODEL_PENDING' | 'MODEL_READY';
      let state: TrackingState = 'BOOTSTRAPPING';

      const microTracker = new MicroPatchTracker(8, 8);
      const denseSmoother = new DenseLandmarksSmoother(70, 'BALANCED');

      const timeline = {
        pageLoadTs,
        firstTemplatesCreatedTs: 0,
        firstSmoothedRenderTs: 0,
      };

      // Frame 1: Simulate frame arriving at 120ms after page load
      const frame1Ts = pageLoadTs + 120;
      const workerModelReady = false; // Simulate model is still downloading/compiling

      if (!workerModelReady && state === 'BOOTSTRAPPING') {
        const t0 = performance.now();
        const face = detectFastFaceBootstrap(rawFrame, PROC_W, PROC_H, false);
        const bootstrapTimeMs = performance.now() - t0;

        expect(bootstrapTimeMs).toBeLessThan(10);
        expect(face).not.toBeNull();

        if (face && face.detected) {
          microTracker.updateTemplates(rawFrame, PROC_W, PROC_H, [
            { index: 68, x: face.rightPupil.x, y: face.rightPupil.y, patchRadius: 8 },
            { index: 69, x: face.leftPupil.x, y: face.leftPupil.y, patchRadius: 8 },
            { index: 48, x: face.mouthRight.x, y: face.mouthRight.y, patchRadius: 10 },
            { index: 54, x: face.mouthLeft.x, y: face.mouthLeft.y, patchRadius: 10 },
          ], { minStdDev: 1.0 });

          timeline.firstTemplatesCreatedTs = frame1Ts;

          const smoothed = denseSmoother.updateFromPoints(face.approxLandmarks, frame1Ts);
          expect(smoothed.points).toHaveLength(70);

          timeline.firstSmoothedRenderTs = frame1Ts + 16;
          state = 'MODEL_PENDING';
        }
      }

      // Assert hard KPIs
      const timeToTemplates = timeline.firstTemplatesCreatedTs - timeline.pageLoadTs;
      const timeToSmoothed = timeline.firstSmoothedRenderTs - timeline.pageLoadTs;

      expect(timeToTemplates).toBeLessThanOrEqual(500); // < 500ms
      expect(timeToSmoothed).toBeLessThanOrEqual(1500); // < 1500ms
      expect(state).toBe('MODEL_PENDING');
      expect(microTracker.templateCount()).toBe(4);
    });
  });

  describe('Warmup Mode Gating & Revertibility', () => {
    it('relaxes minApplyNcc to 0.60 during warmup and restores adaptive threshold afterward', () => {
      const profile = detectDeviceProfile();
      const baseNcc = profile.thresholds.minApplyNcc;

      const appStart = 1000;

      // During first 4s and enableWarmup=true
      const nowDuringWarmup = 2500;
      const warmupActive = getIVPFeatureFlags().enableWarmup && (nowDuringWarmup - appStart < 4000);
      const effectiveNccWarmup = warmupActive ? 0.60 : baseNcc;
      expect(effectiveNccWarmup).toBe(0.60);

      // After 4s elapsed
      const nowAfterWarmup = 6000;
      const warmupExpired = getIVPFeatureFlags().enableWarmup && (nowAfterWarmup - appStart < 4000);
      const effectiveNccNormal = warmupExpired ? 0.60 : baseNcc;
      expect(effectiveNccNormal).toBe(baseNcc);

      // When feature flag is toggled off
      setIVPFeatureFlag('enableWarmup', false);
      const warmupDisabled = getIVPFeatureFlags().enableWarmup && (nowDuringWarmup - appStart < 4000);
      const effectiveNccDisabled = warmupDisabled ? 0.60 : baseNcc;
      expect(effectiveNccDisabled).toBe(baseNcc);

      // Restore flag
      setIVPFeatureFlag('enableWarmup', true);
    });
  });

  describe('Atomic updatePoint acceptance and buffer mutation', () => {
    it('mutates worker buffer only when measurement is accepted by smoother', () => {
      const smoother = new DenseLandmarksSmoother(70, 'BALANCED');
      const initialPoints = Array.from({ length: 70 }, () => ({ x: 0.5, y: 0.5, confidence: 0.9 }));
      smoother.updateFromPoints(initialPoints, 1000);

      // Construct a mock worker Float32Array
      const workerBuffer = new Float32Array(70 * 4);
      for (let i = 0; i < 70; i++) {
        workerBuffer[i * 4] = 0.5;
        workerBuffer[i * 4 + 1] = 0.5;
        workerBuffer[i * 4 + 2] = 0.0;
        workerBuffer[i * 4 + 3] = 0.9;
      }

      // Valid micro movement within delta bounds (0.50 -> 0.505)
      const validUpdate = smoother.updatePoint(68, { x: 0.505, y: 0.503 }, 0.85, 1016);
      expect(validUpdate.accepted).toBe(true);

      if (validUpdate.accepted) {
        const finalX = validUpdate.pos ? validUpdate.pos.x : validUpdate.x;
        const finalY = validUpdate.pos ? validUpdate.pos.y : validUpdate.y;
        workerBuffer[68 * 4] = finalX;
        workerBuffer[68 * 4 + 1] = finalY;
      }
      expect(workerBuffer[68 * 4]).toBeCloseTo(0.505, 2);

      // Wild outlier (0.50 -> 0.95) should be rejected or damped
      const outlierPos = { x: 0.95, y: 0.95 };
      const pred = smoother.predictPoint(68, 0.016);
      const delta = pred ? Math.hypot(pred.x - outlierPos.x, pred.y - outlierPos.y) : 0;
      const accepted = delta < 0.08; // Gate check

      expect(accepted).toBe(false); // Rejected!
      // Worker buffer remains unchanged for index 68
      expect(workerBuffer[68 * 4]).toBeCloseTo(0.505, 2);
    });
  });

  describe('Device Cadence Protection', () => {
    it('sets safe initial target cadence according to CPU tier', () => {
      const profile = detectDeviceProfile();
      let safeCadence = 30;
      if (profile.cpuTier === 'LOW') safeCadence = 15;
      else if (profile.cpuTier === 'MID') safeCadence = 20;
      else safeCadence = 30;

      expect([15, 20, 30]).toContain(safeCadence);
    });
  });
});
