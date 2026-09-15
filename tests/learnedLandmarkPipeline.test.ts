import {
  MEDIAPIPE_478_TO_CANONICAL_70,
  extractDenseLandmarksFromLearnedModel,
} from '../src/lib/workers/visionWorker';
import { DenseLandmarksSmoother } from '../src/lib/services/temporalSmoothing';

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
});
