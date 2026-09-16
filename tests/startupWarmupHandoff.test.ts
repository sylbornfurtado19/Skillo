import { DenseLandmarksSmoother } from '../src/lib/services/temporalSmoothing';
import { MicroPatchTracker } from '../src/lib/services/microPatchTracker';
import { detectFastFaceBootstrap } from '../src/lib/services/visionPipeline';

describe('Startup Warmup to Model Handoff & Concurrency Invariants', () => {
  const PROC_W = 160;
  const PROC_H = 120;

  function createSyntheticFaceFrame(faceCX: number, faceCY: number, faceW: number, faceH: number): Uint8ClampedArray {
    const data = new Uint8ClampedArray(PROC_W * PROC_H * 4);
    // Dark background
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 18;
      data[i + 1] = 22;
      data[i + 2] = 30;
      data[i + 3] = 255;
    }

    const x1 = Math.round(faceCX - faceW / 2);
    const x2 = Math.round(faceCX + faceW / 2);
    const y1 = Math.round(faceCY - faceH / 2);
    const y2 = Math.round(faceCY + faceH / 2);

    for (let y = y1; y <= y2; y++) {
      if (y < 0 || y >= PROC_H) continue;
      for (let x = x1; x <= x2; x++) {
        if (x < 0 || x >= PROC_W) continue;
        const dx = (x - faceCX) / (faceW / 2);
        const dy = (y - faceCY) / (faceH / 2);
        if (dx * dx + dy * dy <= 1.0) {
          const idx = (y * PROC_W + x) * 4;
          data[idx] = 210;     // R
          data[idx + 1] = 150; // G
          data[idx + 2] = 120; // B
          data[idx + 3] = 255;
        }
      }
    }

    // Pupils (dark spots)
    const eyeY = Math.round(faceCY - faceH * 0.12);
    const leftEyeX = Math.round(faceCX - faceW * 0.22);
    const rightEyeX = Math.round(faceCX + faceW * 0.22);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx * dx + dy * dy <= 4) {
          const idxL = ((eyeY + dy) * PROC_W + (leftEyeX + dx)) * 4;
          const idxR = ((eyeY + dy) * PROC_W + (rightEyeX + dx)) * 4;
          data[idxL] = data[idxL + 1] = data[idxL + 2] = 25;
          data[idxR] = data[idxR + 1] = data[idxR + 2] = 25;
        }
      }
    }

    // Mouth (dark band)
    const mouthY = Math.round(faceCY + faceH * 0.25);
    const mouthW = Math.round(faceW * 0.35);
    for (let x = faceCX - mouthW / 2; x <= faceCX + mouthW / 2; x++) {
      for (let dy = -1; dy <= 1; dy++) {
        const idx = (Math.round(mouthY + dy) * PROC_W + Math.round(x)) * 4;
        data[idx] = 130;
        data[idx + 1] = 40;
        data[idx + 2] = 40;
      }
    }

    return data;
  }

  it('atomically transitions from bootstrap seeding to model packet with 120ms glide', () => {
    const smoother = new DenseLandmarksSmoother(70, 'BALANCED');
    const microTracker = new MicroPatchTracker(8, 10);

    const frameData = createSyntheticFaceFrame(80, 60, 50, 65);

    // Step 1: Detect fast bootstrap face
    const bootstrap = detectFastFaceBootstrap(frameData, PROC_W, PROC_H, false);
    expect(bootstrap).not.toBeNull();
    expect(bootstrap!.detected).toBe(true);

    // Seed state machine into BOOTSTRAPPING -> MODEL_PENDING
    smoother.setFaceId('bootstrap_face');
    microTracker.setFaceId('bootstrap_face');

    microTracker.updateTemplates(frameData, PROC_W, PROC_H, [
      { index: 68, x: bootstrap!.rightPupil.x, y: bootstrap!.rightPupil.y, patchRadius: 8 },
      { index: 69, x: bootstrap!.leftPupil.x, y: bootstrap!.leftPupil.y, patchRadius: 8 },
      { index: 48, x: bootstrap!.mouthRight.x, y: bootstrap!.mouthRight.y, patchRadius: 10 },
      { index: 54, x: bootstrap!.mouthLeft.x, y: bootstrap!.mouthLeft.y, patchRadius: 10 },
    ], { minStdDev: 1.0 });

    expect(microTracker.templateCount()).toBe(4);

    const initSmoothed = smoother.updateFromPoints(bootstrap!.approxLandmarks, 100);
    expect(initSmoothed.points.length).toBe(70);
    for (const p of initSmoothed.points) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(isNaN(p.x)).toBe(false);
      expect(isNaN(p.y)).toBe(false);
    }

    // Step 2: Intermediate micro-track update on frame 2
    const tracked = microTracker.track(frameData, PROC_W, PROC_H, 0.50, 1);
    expect(tracked.size).toBeGreaterThanOrEqual(2);

    let acceptedCount = 0;
    for (const [idx, feat] of tracked.entries()) {
      const updated = smoother.updatePoint(idx, { x: feat.x, y: feat.y }, feat.ncc, 116);
      if (updated && updated.accepted) {
        acceptedCount++;
        expect(Number.isFinite(updated.pos.x)).toBe(true);
        expect(Number.isFinite(updated.pos.y)).toBe(true);
      }
    }
    expect(acceptedCount).toBeGreaterThan(0);

    // Step 3: Immediate first model packet arrival (simultaneous handoff)
    const modelBuffer = new Float32Array(70 * 4);
    // Fill model buffer with valid landmarks slightly displaced (+0.035 displacement)
    for (let i = 0; i < 70; i++) {
      const p = bootstrap!.approxLandmarks[i];
      modelBuffer[i * 4] = Math.min(0.95, p.x + 0.035);
      modelBuffer[i * 4 + 1] = Math.min(0.95, p.y + 0.025);
      modelBuffer[i * 4 + 2] = 0;
      modelBuffer[i * 4 + 3] = 0.95;
    }

    // Set new faceId from model envelope
    smoother.setFaceId('model_face_cluster_1');
    microTracker.setFaceId('model_face_cluster_1');

    // Model packet handoff
    const handoffRes = smoother.updateFromBuffer(modelBuffer, 70, 133);
    expect(handoffRes.points.length).toBe(70);

    // Verify anti-snap re-localization glide is triggered
    expect(smoother.getIsRelocalizing()).toBe(true);
    expect(smoother.getRelocalizationProgress()).toBeLessThan(1.0);

    // Assert all points remain strictly valid and within [0, 1]
    for (const p of handoffRes.points) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(isNaN(p.x)).toBe(false);
      expect(isNaN(p.y)).toBe(false);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
    }

    // Step 4: Advance time across glide window (133ms -> 260ms)
    const glideMid = smoother.updateFromBuffer(modelBuffer, 70, 180);
    expect(glideMid.relocalizationProgress).toBeGreaterThan(0.2);
    expect(glideMid.relocalizationProgress).toBeLessThan(1.0);

    const glideEnd = smoother.updateFromBuffer(modelBuffer, 70, 260);
    expect(glideEnd.relocalizationProgress).toBe(1.0);
    expect(smoother.getIsRelocalizing()).toBe(false);

    // Final positions should closely match incoming model points without residual drift
    const noseTip = glideEnd.points[30];
    expect(Math.abs(noseTip.x - modelBuffer[30 * 4])).toBeLessThan(0.015);
    expect(Math.abs(noseTip.y - modelBuffer[30 * 4 + 1])).toBeLessThan(0.015);
  });

  it('guarantees atomic buffer mutation and prevents stale template retention', () => {
    const smoother = new DenseLandmarksSmoother(70, 'BALANCED');
    const microTracker = new MicroPatchTracker(8, 10);
    const frameData = createSyntheticFaceFrame(80, 60, 50, 65);

    // Seed bootstrap
    smoother.setFaceId('bootstrap_face');
    microTracker.setFaceId('bootstrap_face');
    microTracker.updateTemplates(frameData, PROC_W, PROC_H, [
      { index: 68, x: 0.40, y: 0.45 },
      { index: 69, x: 0.60, y: 0.45 },
    ]);

    // Model arrives and completely overrides faceId & templates
    smoother.setFaceId('subject_face_primary');
    microTracker.setFaceId('subject_face_primary');

    // Updating templates with new points replaces old ones
    microTracker.updateTemplates(frameData, PROC_W, PROC_H, [
      { index: 68, x: 0.42, y: 0.46 },
      { index: 69, x: 0.58, y: 0.46 },
      { index: 48, x: 0.45, y: 0.65 },
      { index: 54, x: 0.55, y: 0.65 },
    ]);

    expect(microTracker.templateCount()).toBe(4);
    expect(smoother.getFaceId()).toBe('subject_face_primary');

    // Simulate concurrent updatePoint with out-of-range confidence or coordinates
    const invalidRes1 = smoother.updatePoint(68, { x: NaN, y: 0.5 }, 0.9, 200);
    expect(invalidRes1?.accepted).toBe(false);

    const invalidRes2 = smoother.updatePoint(68, { x: 0.5, y: 0.5 }, 0.05, 201); // <0.15 threshold
    expect(invalidRes2?.accepted).toBe(false);

    const validRes = smoother.updatePoint(68, { x: 0.42, y: 0.46 }, 0.92, 202);
    expect(validRes?.accepted).toBe(true);
    expect(validRes?.pos.x).toBeCloseTo(0.42, 1);
  });
});
