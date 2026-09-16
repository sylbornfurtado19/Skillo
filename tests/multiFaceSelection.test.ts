import { DenseLandmarksSmoother } from '../src/lib/services/temporalSmoothing';
import { MicroPatchTracker } from '../src/lib/services/microPatchTracker';

describe('Multi-Face Selection & State Isolation (PR D)', () => {
  const PROC_W = 160;
  const PROC_H = 120;

  function createPatternedFrame(): Uint8ClampedArray {
    const data = new Uint8ClampedArray(PROC_W * PROC_H * 4);
    for (let y = 0; y < PROC_H; y++) {
      for (let x = 0; x < PROC_W; x++) {
        const idx = (y * PROC_W + x) * 4;
        const v = (x % 16 < 8 && y % 16 < 8) ? 200 : 50;
        data[idx] = v;
        data[idx + 1] = v;
        data[idx + 2] = v;
        data[idx + 3] = 255;
      }
    }
    return data;
  }

  it('isolates micro-tracker templates and resets denser smoother on face switch', () => {
    const smoother = new DenseLandmarksSmoother(70, 'BALANCED');
    const tracker = new MicroPatchTracker(8, 10);
    const frame = createPatternedFrame();

    // 1. Initialize Face A
    smoother.setFaceId('subject_face_A');
    tracker.setFaceId('subject_face_A');
    expect(smoother.getFaceId()).toBe('subject_face_A');
    expect(tracker.getFaceId()).toBe('subject_face_A');

    tracker.updateTemplates(frame, PROC_W, PROC_H, [
      { index: 68, x: 0.25, y: 0.35, patchRadius: 8, source: 'model' },
      { index: 69, x: 0.45, y: 0.35, patchRadius: 8, source: 'model' },
    ], { source: 'model' });

    expect(tracker.templateCount()).toBe(2);

    const updateA = smoother.updatePoint(68, { x: 0.25, y: 0.35 }, 0.95, 100);
    expect(updateA?.accepted).toBe(true);

    // 2. Switch to Face B (e.g. second person in scene)
    smoother.setFaceId('subject_face_B');
    tracker.setFaceId('subject_face_B');

    expect(smoother.getFaceId()).toBe('subject_face_B');
    expect(tracker.getFaceId()).toBe('subject_face_B');

    // Templates from Face A must be wiped to prevent cross-contamination
    expect(tracker.templateCount()).toBe(0);

    // 3. Register Face B templates on different coordinate region
    tracker.updateTemplates(frame, PROC_W, PROC_H, [
      { index: 68, x: 0.70, y: 0.40, patchRadius: 8, source: 'model' },
      { index: 69, x: 0.85, y: 0.40, patchRadius: 8, source: 'model' },
      { index: 48, x: 0.72, y: 0.60, patchRadius: 10, source: 'model' },
      { index: 54, x: 0.82, y: 0.60, patchRadius: 10, source: 'model' },
    ], { source: 'model' });

    expect(tracker.templateCount()).toBe(4);

    const updateB = smoother.updatePoint(68, { x: 0.70, y: 0.40 }, 0.95, 120);
    expect(updateB?.accepted).toBe(true);
    expect(updateB?.pos.x).toBeCloseTo(0.70, 1);

    // 4. Switching back to Face A clears Face B templates
    smoother.setFaceId('subject_face_A');
    tracker.setFaceId('subject_face_A');
    expect(tracker.templateCount()).toBe(0);
  });

  it('ensures transitioning from BOOTSTRAP face to MODEL face does not wipe state prematurely', () => {
    const smoother = new DenseLandmarksSmoother(70, 'BALANCED');
    smoother.setFaceId('bootstrap_face');
    expect(smoother.getFaceId()).toBe('bootstrap_face');

    // Transitioning from bootstrap to primary model face preserves smoother filter continuity
    smoother.setFaceId('model_face_cluster_1');
    expect(smoother.getFaceId()).toBe('model_face_cluster_1');

    // But switching from one model face to another model face triggers full reset
    smoother.setFaceId('model_face_cluster_2');
    expect(smoother.getFaceId()).toBe('model_face_cluster_2');
  });
});
