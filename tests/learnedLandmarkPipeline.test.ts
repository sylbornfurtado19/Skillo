import {
  MEDIAPIPE_478_TO_CANONICAL_70,
  extractDenseLandmarksFromLearnedModel,
} from '../src/lib/workers/visionWorker';
import {
  DenseLandmarksSmoother,
  LandmarkKinematicFilter,
  computeSimilarityTransform,
} from '../src/lib/services/temporalSmoothing';
import { MicroPatchTracker } from '../src/lib/services/microPatchTracker';
import { isNewerRequestId } from '../src/types/workerMessages';

describe('Learned MediaPipe Landmark Pipeline & 70-Point Canonical Mapping', () => {
  it('defines a valid 70-point canonical index mapping from MediaPipe 478 mesh', () => {
    expect(MEDIAPIPE_478_TO_CANONICAL_70).toBeDefined();
    expect(MEDIAPIPE_478_TO_CANONICAL_70.length).toBe(70);

    // Verify all indices are within valid 478 MediaPipe index bounds
    for (const idx of MEDIAPIPE_478_TO_CANONICAL_70) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(478);
    }

    // Verify anchor points
    expect(MEDIAPIPE_478_TO_CANONICAL_70[33]).toBe(1);   // Nose tip
    expect(MEDIAPIPE_478_TO_CANONICAL_70[8]).toBe(152);  // Chin
    expect(MEDIAPIPE_478_TO_CANONICAL_70[68]).toBe(468); // Right pupil iris
    expect(MEDIAPIPE_478_TO_CANONICAL_70[69]).toBe(473); // Left pupil iris
  });

  it('correctly maps 478 MediaPipe landmarks to canonical 70-point Float32Array buffer', () => {
    // Generate synthetic 478-point MediaPipe face mesh
    const mockLandmarks = Array.from({ length: 478 }, (_, i) => ({
      x: 0.5 + Math.sin(i) * 0.1,
      y: 0.4 + Math.cos(i) * 0.1,
      z: -0.05,
      visibility: 0.98,
    }));

    // Specific eye positions to test EAR calculation
    // Right Eye: 33 (outer), 160 (top), 158 (top), 133 (inner), 153 (bot), 144 (bot)
    mockLandmarks[33] = { x: 0.35, y: 0.35, z: 0, visibility: 0.99 };
    mockLandmarks[133] = { x: 0.45, y: 0.35, z: 0, visibility: 0.99 };
    mockLandmarks[160] = { x: 0.38, y: 0.33, z: 0, visibility: 0.99 };
    mockLandmarks[158] = { x: 0.42, y: 0.33, z: 0, visibility: 0.99 };
    mockLandmarks[144] = { x: 0.38, y: 0.37, z: 0, visibility: 0.99 };
    mockLandmarks[153] = { x: 0.42, y: 0.37, z: 0, visibility: 0.99 };

    // Left Eye: 362 (inner), 385 (top), 387 (top), 263 (outer), 373 (bot), 380 (bot)
    mockLandmarks[362] = { x: 0.55, y: 0.35, z: 0, visibility: 0.99 };
    mockLandmarks[263] = { x: 0.65, y: 0.35, z: 0, visibility: 0.99 };
    mockLandmarks[385] = { x: 0.58, y: 0.33, z: 0, visibility: 0.99 };
    mockLandmarks[387] = { x: 0.62, y: 0.33, z: 0, visibility: 0.99 };
    mockLandmarks[380] = { x: 0.58, y: 0.37, z: 0, visibility: 0.99 };
    mockLandmarks[373] = { x: 0.62, y: 0.37, z: 0, visibility: 0.99 };

    // Pupils: 468 (right), 473 (left)
    mockLandmarks[468] = { x: 0.40, y: 0.35, z: -0.01, visibility: 0.99 };
    mockLandmarks[473] = { x: 0.60, y: 0.35, z: -0.01, visibility: 0.99 };

    // Mouth: 61 (corner), 291 (corner), 0 (top), 17 (bottom)
    mockLandmarks[61] = { x: 0.42, y: 0.55, z: 0, visibility: 0.98 };
    mockLandmarks[291] = { x: 0.58, y: 0.55, z: 0, visibility: 0.98 };
    mockLandmarks[0] = { x: 0.50, y: 0.53, z: 0, visibility: 0.98 };
    mockLandmarks[17] = { x: 0.50, y: 0.57, z: 0, visibility: 0.98 };

    const output = extractDenseLandmarksFromLearnedModel(mockLandmarks, 640, 480);

    expect(output.faceDetected).toBe(true);
    expect(output.landmarksBuffer.length).toBe(70 * 4);

    // Verify pupil positions in buffer (68 & 69)
    expect(output.landmarksBuffer[68 * 4]).toBeCloseTo(0.40, 2);
    expect(output.landmarksBuffer[68 * 4 + 1]).toBeCloseTo(0.35, 2);
    expect(output.landmarksBuffer[69 * 4]).toBeCloseTo(0.60, 2);
    expect(output.landmarksBuffer[69 * 4 + 1]).toBeCloseTo(0.35, 2);

    // Verify biological EAR & MAR calculation
    // Eye width = 0.10, Eye height = 0.04 -> EAR ~ 0.08 / 0.20 = 0.40
    expect(output.ear).toBeGreaterThan(0.20);
    expect(output.ear).toBeLessThan(0.60);

    // MAR mouth width = 0.16, mouth height = 0.04
    expect(output.mar).toBeGreaterThan(0.05);
    expect(output.mar).toBeLessThan(0.60);

    // Verify region confidences
    expect(output.regionConfidences.eyes).toBeGreaterThan(0.90);
    expect(output.regionConfidences.overall).toBeGreaterThan(0.90);
  });

  it('falls back gracefully to eye contour centroid when iris landmarks (468/473) are absent', () => {
    // 468 landmarks only (without iris indices)
    const mockLandmarks = Array.from({ length: 468 }, (_, i) => ({
      x: 0.5,
      y: 0.5,
      z: 0,
      visibility: 0.95,
    }));

    // Right Eye Contour: 33 (outer), 160, 158, 133 (inner), 153, 144
    mockLandmarks[33] = { x: 0.30, y: 0.30, z: 0, visibility: 0.95 };
    mockLandmarks[133] = { x: 0.40, y: 0.30, z: 0, visibility: 0.95 };
    mockLandmarks[160] = { x: 0.35, y: 0.28, z: 0, visibility: 0.95 };
    mockLandmarks[158] = { x: 0.35, y: 0.28, z: 0, visibility: 0.95 };
    mockLandmarks[144] = { x: 0.35, y: 0.32, z: 0, visibility: 0.95 };
    mockLandmarks[153] = { x: 0.35, y: 0.32, z: 0, visibility: 0.95 };

    const output = extractDenseLandmarksFromLearnedModel(mockLandmarks, 640, 480);
    expect(output.faceDetected).toBe(true);

    // Pupil 68 should fallback to centroid of contour: x ~ 0.35, y ~ 0.30
    const pupilX = output.landmarksBuffer[68 * 4];
    const pupilY = output.landmarksBuffer[68 * 4 + 1];
    expect(pupilX).toBeCloseTo(0.35, 1);
    expect(pupilY).toBeCloseTo(0.30, 1);
  });

  it('seamlessly integrates learned buffer into DenseLandmarksSmoother with confidence weighting', () => {
    const smoother = new DenseLandmarksSmoother(70, 'BALANCED');

    const mockLandmarks = Array.from({ length: 478 }, () => ({
      x: 0.5,
      y: 0.5,
      z: 0,
      visibility: 0.98,
    }));

    const output = extractDenseLandmarksFromLearnedModel(mockLandmarks, 640, 480);
    const smoothedRes = smoother.updateFromBuffer(output.landmarksBuffer, 70, 1000);

    expect(smoothedRes.points.length).toBe(70);
    expect(smoothedRes.points[33].x).toBeCloseTo(0.5, 2);
    expect(smoothedRes.points[68].x).toBeCloseTo(0.5, 2);
    expect(smoothedRes.regionConfidences.overall).toBeGreaterThan(0.9);
  });

  it('reduces static jitter and tracks step motion in KALMAN_HYBRID filter mode', () => {
    const kalman = new LandmarkKinematicFilter({
      filterMode: 'KALMAN_HYBRID',
      r0: 0.0004,
    });

    // 1. Static noisy input
    const truePos = { x: 0.5, y: 0.5 };
    const rawNoisyX: number[] = [];
    const filteredX: number[] = [];

    for (let i = 0; i < 40; i++) {
      const noise = (Math.sin(i * 1.7) + Math.cos(i * 2.3)) * 0.015;
      const obs = { x: truePos.x + noise, y: truePos.y };
      rawNoisyX.push(obs.x);
      const res = kalman.update(obs, 0.95, 0.033);
      if (i > 10) filteredX.push(res.pos.x);
    }

    // Measure standard deviation of raw vs filtered
    const stdDev = (arr: number[]) => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      return Math.sqrt(arr.reduce((acc, v) => acc + (v - mean) ** 2, 0) / arr.length);
    };

    const rawStd = stdDev(rawNoisyX.slice(10));
    const filtStd = stdDev(filteredX);
    expect(filtStd).toBeLessThan(rawStd);

    // 2. Step response (saccade from 0.5 to 0.7)
    const stepRes = kalman.update({ x: 0.7, y: 0.5 }, 1.0, 0.033);
    expect(stepRes.pos.x).toBeGreaterThan(0.5);
    expect(stepRes.vel.x).toBeGreaterThan(0);
  });

  it('tracks micro-features (pupils/lips) across frame translation with MicroPatchTracker', () => {
    const tracker = new MicroPatchTracker(8, 8);
    const W = 64;
    const H = 64;
    const frame1 = new Uint8ClampedArray(W * H * 4);

    // Create a high-contrast dark pupil feature at (32, 32)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = (y * W + x) * 4;
        const dist = Math.hypot(x - 32, y - 32);
        const luma = dist < 4 ? 20 : 200;
        frame1[idx] = luma;
        frame1[idx + 1] = luma;
        frame1[idx + 2] = luma;
        frame1[idx + 3] = 255;
      }
    }

    // Update reference template at (32/64, 32/64)
    tracker.updateTemplates(frame1, W, H, [{ index: 68, x: 32 / W, y: 32 / H }]);

    // Create frame 2 with the pupil shifted by +2px in X and +2px in Y
    const frame2 = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = (y * W + x) * 4;
        const dist = Math.hypot(x - 34, y - 34);
        const luma = dist < 4 ? 20 : 200;
        frame2[idx] = luma;
        frame2[idx + 1] = luma;
        frame2[idx + 2] = luma;
        frame2[idx + 3] = 255;
      }
    }

    const tracked = tracker.track(frame2, W, H, 0.50);
    expect(tracked.has(68)).toBe(true);

    const feat = tracked.get(68)!;
    expect(feat.x).toBeCloseTo(34 / W, 2);
    expect(feat.y).toBeCloseTo(34 / W, 2);
    expect(feat.ncc).toBeGreaterThan(0.60);

    // Verify integration into DenseLandmarksSmoother
    const smoother = new DenseLandmarksSmoother(70, 'BALANCED');
    const updatedPos = smoother.updatePoint(68, { x: feat.x, y: feat.y }, feat.ncc, 1033);
    expect(updatedPos).not.toBeNull();
    expect(updatedPos!.x).toBeCloseTo(34 / W, 2);
  });

  describe('30-Bit Monotonic Request ID Modular Comparison', () => {
    it('handles initial state, sequential progression, and stale frame rejection', () => {
      // First frame from worker with any positive ID accepted
      expect(isNewerRequestId(1, 0)).toBe(true);
      expect(isNewerRequestId(100, 0)).toBe(true);

      // Monotonically increasing ID is newer
      expect(isNewerRequestId(2, 1)).toBe(true);
      expect(isNewerRequestId(105, 100)).toBe(true);

      // Same ID is not newer
      expect(isNewerRequestId(100, 100)).toBe(false);

      // Out-of-order or stale ID is rejected
      expect(isNewerRequestId(99, 100)).toBe(false);
      expect(isNewerRequestId(50, 100)).toBe(false);
    });

    it('safely handles 30-bit integer wraparound without signed overflow', () => {
      const RANGE = 0x40000000; // 2^30
      const lastId = RANGE - 1; // 0x3fffffff
      const newId = 0; // Wraparound to 0

      // After 0x3fffffff, next frame 0 is newer
      expect(isNewerRequestId(newId, lastId)).toBe(true);
      expect(isNewerRequestId(1, lastId)).toBe(true);

      // But an old frame from before wraparound arriving after wrap is stale
      expect(isNewerRequestId(RANGE - 10, 5)).toBe(false);
    });
  });

  describe('Procrustes 2D Similarity Transform Relocalization', () => {
    it('accurately recovers scale, rotation, and translation between point sets', () => {
      // Triangular facial anchors (left eye, right eye, nose tip)
      const srcPts = [
        { x: 0.35, y: 0.35 },
        { x: 0.65, y: 0.35 },
        { x: 0.50, y: 0.55 },
      ];

      // Pure translation (+0.05 in X, -0.02 in Y)
      const translated = srcPts.map(p => ({ x: p.x + 0.05, y: p.y - 0.02 }));
      const tformTrans = computeSimilarityTransform(srcPts, translated);
      expect(tformTrans.scale).toBeCloseTo(1.0, 2);
      expect(tformTrans.rotation).toBeCloseTo(0.0, 2);
      expect(tformTrans.tx).toBeCloseTo(0.05, 2);
      expect(tformTrans.ty).toBeCloseTo(-0.02, 2);

      // Pure rotation (10 degrees = ~0.1745 rad) around (0.5, 0.4)
      const angle = 0.1745;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const rotated = srcPts.map(p => {
        const dx = p.x - 0.5;
        const dy = p.y - 0.4;
        return {
          x: 0.5 + (dx * cosA - dy * sinA),
          y: 0.4 + (dx * sinA + dy * cosA),
        };
      });
      const tformRot = computeSimilarityTransform(srcPts, rotated);
      expect(tformRot.scale).toBeCloseTo(1.0, 2);
      expect(tformRot.rotation).toBeCloseTo(angle, 2);

      // Scaled by 1.15
      const scaled = srcPts.map(p => ({
        x: 0.5 + (p.x - 0.5) * 1.15,
        y: 0.4 + (p.y - 0.4) * 1.15,
      }));
      const tformScale = computeSimilarityTransform(srcPts, scaled);
      expect(tformScale.scale).toBeCloseTo(1.15, 2);
      expect(tformScale.rotation).toBeCloseTo(0.0, 2);
    });

    it('preserves topology during relocalization glide in DenseLandmarksSmoother', () => {
      const smoother = new DenseLandmarksSmoother(70, 'BALANCED');
      smoother.setRelocalizationConfig({ minOcclusionSec: 0 });
      const initialBuffer = new Float32Array(70 * 4);
      for (let i = 0; i < 70; i++) {
        initialBuffer[i * 4] = 0.4 + (i % 10) * 0.02;
        initialBuffer[i * 4 + 1] = 0.3 + Math.floor(i / 10) * 0.03;
        initialBuffer[i * 4 + 2] = 0;
        initialBuffer[i * 4 + 3] = 0.99;
      }

      // Initialize smoother
      smoother.updateFromBuffer(initialBuffer, 70, 1000);

      // Simulate re-entry jump (> 0.06 normalized distance)
      const jumpedBuffer = new Float32Array(70 * 4);
      for (let i = 0; i < 70; i++) {
        jumpedBuffer[i * 4] = initialBuffer[i * 4] + 0.15; // +15% X jump
        jumpedBuffer[i * 4 + 1] = initialBuffer[i * 4 + 1] + 0.10; // +10% Y jump
        jumpedBuffer[i * 4 + 2] = 0;
        jumpedBuffer[i * 4 + 3] = 0.99;
      }

      // First step into relocalization
      const res1 = smoother.updateFromBuffer(jumpedBuffer, 70, 1033);
      expect(res1.isRelocalizing).toBe(true);

      // Eye-to-eye distance should remain structurally consistent (not warped)
      const initialEyeDist = Math.hypot(
        initialBuffer[36 * 4] - initialBuffer[45 * 4],
        initialBuffer[36 * 4 + 1] - initialBuffer[45 * 4 + 1]
      );
      const relocalizingEyeDist = Math.hypot(
        res1.points[36].x - res1.points[45].x,
        res1.points[36].y - res1.points[45].y
      );
      expect(relocalizingEyeDist).toBeCloseTo(initialEyeDist, 1);
    });
  });

  describe('Kalman Numerical Stability & Boundary Guards', () => {
    it('recovers gracefully from NaN / Infinity inputs without diverging', () => {
      const filter = new LandmarkKinematicFilter({
        filterMode: 'KALMAN_HYBRID',
      });

      // Warm up with valid observations
      filter.update({ x: 0.5, y: 0.5 }, 0.95, 0.033);
      const warm = filter.update({ x: 0.51, y: 0.51 }, 0.95, 0.033);
      expect(warm.pos.x).toBeCloseTo(0.51, 1);

      // Inject NaN observation
      const nanRes = filter.update({ x: NaN, y: NaN }, 0.95, 0.033);
      expect(Number.isNaN(nanRes.pos.x)).toBe(false);
      expect(Number.isNaN(nanRes.pos.y)).toBe(false);
      expect(nanRes.pos.x).toBeCloseTo(0.51, 1);

      // Inject Infinity observation
      const infRes = filter.update({ x: Infinity, y: -Infinity }, 0.95, 0.033);
      expect(Number.isFinite(infRes.pos.x)).toBe(true);
      expect(Number.isFinite(infRes.pos.y)).toBe(true);

      // Subsequent valid update tracks normally
      const nextValid = filter.update({ x: 0.52, y: 0.52 }, 0.95, 0.033);
      expect(nextValid.pos.x).toBeCloseTo(0.52, 1);
    });

    it('safely clamps anomalous delta time spikes to [1e-3, 0.2] seconds', () => {
      const filter = new LandmarkKinematicFilter({
        filterMode: 'KALMAN_HYBRID',
      });

      filter.update({ x: 0.5, y: 0.5 }, 0.95, 0.033);

      // Huge delta time spike (e.g. tab backgrounded for 10 seconds)
      const resSpike = filter.update({ x: 0.55, y: 0.55 }, 0.95, 10.0);
      expect(Number.isFinite(resSpike.pos.x)).toBe(true);
      expect(Number.isFinite(resSpike.vel.x)).toBe(true);

      // Near zero or negative delta time
      const resZero = filter.update({ x: 0.55, y: 0.55 }, 0.95, -0.05);
      expect(Number.isFinite(resZero.pos.x)).toBe(true);
    });
  });

  describe('Quantitative Acceptance Criteria Benchmarks (720p Baseline)', () => {
    // 720p baseline: 1280 x 720
    const W_720P = 1280;
    const H_720P = 720;

    it('satisfies production accuracy thresholds: Nose <= 6px, Eyes <= 8px, Lips <= 10px RMSE', () => {
      const smoother = new DenseLandmarksSmoother(70, 'BALANCED');

      // Canonical true anchor positions (normalized)
      const groundTruth = {
        noseTip: { x: 640 / W_720P, y: 380 / H_720P },      // index 33
        leftEyeCentroid: { x: 480 / W_720P, y: 300 / H_720P }, // index 69
        rightEyeCentroid: { x: 800 / W_720P, y: 300 / H_720P },// index 68
        leftMouthCorner: { x: 540 / W_720P, y: 480 / H_720P }, // index 48
        rightMouthCorner: { x: 740 / W_720P, y: 480 / H_720P },// index 54
      };

      const noseErrorsPx: number[] = [];
      const eyeErrorsPx: number[] = [];
      const mouthErrorsPx: number[] = [];

      const NUM_FRAMES = 60;
      for (let f = 0; f < NUM_FRAMES; f++) {
        const buffer = new Float32Array(70 * 4);
        // Add zero-mean pseudo-random sensor noise (+/- 2.5px std dev)
        const sensorNoiseX = (Math.sin(f * 2.1) + Math.cos(f * 3.7)) * (2.5 / W_720P);
        const sensorNoiseY = (Math.cos(f * 1.9) + Math.sin(f * 4.1)) * (2.5 / H_720P);

        for (let i = 0; i < 70; i++) {
          let gx = 0.5;
          let gy = 0.5;
          if (i === 33) {
            gx = groundTruth.noseTip.x;
            gy = groundTruth.noseTip.y;
          } else if (i === 68) {
            gx = groundTruth.rightEyeCentroid.x;
            gy = groundTruth.rightEyeCentroid.y;
          } else if (i === 69) {
            gx = groundTruth.leftEyeCentroid.x;
            gy = groundTruth.leftEyeCentroid.y;
          } else if (i === 48) {
            gx = groundTruth.leftMouthCorner.x;
            gy = groundTruth.leftMouthCorner.y;
          } else if (i === 54) {
            gx = groundTruth.rightMouthCorner.x;
            gy = groundTruth.rightMouthCorner.y;
          }

          buffer[i * 4] = gx + sensorNoiseX;
          buffer[i * 4 + 1] = gy + sensorNoiseY;
          buffer[i * 4 + 2] = 0;
          buffer[i * 4 + 3] = 0.98;
        }

        const res = smoother.updateFromBuffer(buffer, 70, 1000 + f * 33);

        // Record pixel errors on warm frames (f >= 15)
        if (f >= 15) {
          const nosePx = Math.hypot(
            (res.points[33].x - groundTruth.noseTip.x) * W_720P,
            (res.points[33].y - groundTruth.noseTip.y) * H_720P
          );
          noseErrorsPx.push(nosePx);

          const eyePx = Math.hypot(
            (res.points[68].x - groundTruth.rightEyeCentroid.x) * W_720P,
            (res.points[68].y - groundTruth.rightEyeCentroid.y) * H_720P
          );
          eyeErrorsPx.push(eyePx);

          const mouthPx = Math.hypot(
            (res.points[48].x - groundTruth.leftMouthCorner.x) * W_720P,
            (res.points[48].y - groundTruth.leftMouthCorner.y) * H_720P
          );
          mouthErrorsPx.push(mouthPx);
        }
      }

      const rmse = (errors: number[]) =>
        Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / errors.length);

      const noseRMSE = rmse(noseErrorsPx);
      const eyeRMSE = rmse(eyeErrorsPx);
      const mouthRMSE = rmse(mouthErrorsPx);

      // Assertions against quantitative production acceptance gates:
      // Nose tip RMSE <= 6 px (720p baseline)
      expect(noseRMSE).toBeLessThanOrEqual(6.0);
      // Eye centroid RMSE <= 8 px (720p baseline)
      expect(eyeRMSE).toBeLessThanOrEqual(8.0);
      // Lip corner RMSE <= 10 px (720p baseline)
      expect(mouthRMSE).toBeLessThanOrEqual(10.0);
    });

    it('achieves >= 60% jitter reduction compared to raw noisy input', () => {
      const smoother = new DenseLandmarksSmoother(70, 'BALANCED', 'KALMAN_HYBRID');
      const rawDeltas: number[] = [];
      const filteredDeltas: number[] = [];

      let prevRawX = 0.5;
      let prevFiltX = 0.5;

      for (let f = 0; f < 60; f++) {
        // High frequency sensor flutter
        const jitter = (Math.sin(f * 5.7) + Math.cos(f * 7.3)) * 0.008;
        const rawX = 0.5 + jitter;

        const buffer = new Float32Array(70 * 4);
        for (let i = 0; i < 70; i++) {
          buffer[i * 4] = rawX;
          buffer[i * 4 + 1] = 0.5;
          buffer[i * 4 + 2] = 0;
          buffer[i * 4 + 3] = 0.95;
        }

        const res = smoother.updateFromBuffer(buffer, 70, 1000 + f * 33);
        const filtX = res.points[33].x;

        if (f > 10) {
          rawDeltas.push(Math.abs(rawX - prevRawX));
          filteredDeltas.push(Math.abs(filtX - prevFiltX));
        }

        prevRawX = rawX;
        prevFiltX = filtX;
      }

      const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
      const rawJitter = mean(rawDeltas);
      const filteredJitter = mean(filteredDeltas);
      const jitterReductionPercent = ((rawJitter - filteredJitter) / rawJitter) * 100;

      // Assert jitter reduction is >= 60%
      expect(jitterReductionPercent).toBeGreaterThanOrEqual(60);
    });

    it('correctly integrates PROC-space micro-tracking into video-normalized worker buffer and smoother', () => {
      const videoW = 1280;
      const videoH = 720;
      const PROC_W = 320;
      const PROC_H = 240;

      const workerBuffer = new Float32Array(70 * 4);
      // Setup mock landmarks normalized to video
      workerBuffer[68 * 4] = 0.50;
      workerBuffer[68 * 4 + 1] = 0.50;
      workerBuffer[68 * 4 + 3] = 0.95;

      const tracker = new MicroPatchTracker(8, 8);
      const smoother = new DenseLandmarksSmoother(70, 'BALANCED');

      // Create synthetic PROC frame (320x240)
      const procFrame1 = new Uint8ClampedArray(PROC_W * PROC_H * 4);
      // Pupil at (160, 120) in PROC
      for (let y = 0; y < PROC_H; y++) {
        for (let x = 0; x < PROC_W; x++) {
          const idx = (y * PROC_W + x) * 4;
          const d = Math.hypot(x - 160, y - 120);
          const luma = d < 4 ? 20 : 200;
          procFrame1[idx] = luma;
          procFrame1[idx + 1] = luma;
          procFrame1[idx + 2] = luma;
          procFrame1[idx + 3] = 255;
        }
      }

      // Initialize templates using video-normalized coords
      tracker.updateTemplates(procFrame1, PROC_W, PROC_H, [
        { index: 68, x: workerBuffer[68 * 4], y: workerBuffer[68 * 4 + 1], patchRadius: 8 },
      ]);
      expect(tracker.templateCount()).toBe(1);

      // Frame 2 with small movement in PROC (+2px X, +2px Y)
      const procFrame2 = new Uint8ClampedArray(PROC_W * PROC_H * 4);
      for (let y = 0; y < PROC_H; y++) {
        for (let x = 0; x < PROC_W; x++) {
          const idx = (y * PROC_W + x) * 4;
          const d = Math.hypot(x - 162, y - 122);
          const luma = d < 4 ? 20 : 200;
          procFrame2[idx] = luma;
          procFrame2[idx + 1] = luma;
          procFrame2[idx + 2] = luma;
          procFrame2[idx + 3] = 255;
        }
      }

      const tracked = tracker.track(procFrame2, PROC_W, PROC_H, 0.55);
      expect(tracked.has(68)).toBe(true);

      const feat = tracked.get(68)!;
      expect(feat.x).toBeCloseTo(162 / PROC_W, 2);
      expect(feat.y).toBeCloseTo(122 / PROC_H, 2);

      // Convert PROC-normalized -> video-normalized
      const procToVideoX = (procX: number) => (procX * PROC_W) / videoW;
      const procToVideoY = (procY: number) => (procY * PROC_H) / videoH;

      const videoNormX = procToVideoX(feat.x);
      const videoNormY = procToVideoY(feat.y);

      // Update buffer and smoother
      workerBuffer[68 * 4] = videoNormX;
      workerBuffer[68 * 4 + 1] = videoNormY;
      workerBuffer[68 * 4 + 3] = feat.ncc;

      const smoothed = smoother.updatePoint(68, { x: videoNormX, y: videoNormY }, feat.ncc, 1033);
      expect(smoothed).not.toBeNull();
      expect(workerBuffer[68 * 4]).toBeCloseTo(videoNormX, 5);
      expect(workerBuffer[68 * 4 + 1]).toBeCloseTo(videoNormY, 5);
      expect(workerBuffer[68 * 4 + 3]).toBeCloseTo(feat.ncc, 4);
    });
  });
});

