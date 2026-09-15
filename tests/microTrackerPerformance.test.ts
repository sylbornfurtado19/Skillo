import { MicroPatchTracker } from '../src/lib/services/microPatchTracker';

describe('MicroPatchTracker Performance & Latency Budgets', () => {
  const W = 320;
  const H = 240;

  function createSyntheticProcFrame(): Uint8ClampedArray {
    const frame = new Uint8ClampedArray(W * H * 4);
    // Draw 4 distinct gradient features (2 pupils, 2 lip corners)
    const features = [
      { x: 120, y: 90, r: 8 },  // right pupil
      { x: 200, y: 90, r: 8 },  // left pupil
      { x: 130, y: 160, r: 12 }, // right mouth corner
      { x: 190, y: 160, r: 12 }, // left mouth corner
    ];

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = (y * W + x) * 4;
        let luma = 180; // background skin tone
        for (const feat of features) {
          const dist = Math.hypot(x - feat.x, y - feat.y);
          if (dist < feat.r) {
            luma = Math.round(30 + (dist / feat.r) * 80);
            break;
          }
        }
        frame[idx] = luma;
        frame[idx + 1] = luma;
        frame[idx + 2] = luma;
        frame[idx + 3] = 255;
      }
    }
    return frame;
  }

  it('completes tracking of 4 templates well under the 10ms 60Hz frame budget', () => {
    const tracker = new MicroPatchTracker(8, 8);
    const frame1 = createSyntheticProcFrame();

    tracker.updateTemplates(frame1, W, H, [
      { index: 68, x: 120 / W, y: 90 / H, patchRadius: 8 },
      { index: 69, x: 200 / W, y: 90 / H, patchRadius: 8 },
      { index: 48, x: 130 / W, y: 160 / H, patchRadius: 12 },
      { index: 54, x: 190 / W, y: 160 / H, patchRadius: 12 },
    ]);

    expect(tracker.templateCount()).toBe(4);

    // Warm-up JIT
    tracker.track(frame1, W, H, 0.55, 1);

    // Measure execution time across 5 frames
    const timings: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      const results = tracker.track(frame1, W, H, 0.55, 1);
      const dt = performance.now() - t0;
      timings.push(dt);
      expect(results.size).toBe(4);
    }

    const avgMs = timings.reduce((a, b) => a + b, 0) / timings.length;
    // Assert p95 average is well within the 10ms threshold
    expect(avgMs).toBeLessThan(10);
  });

  it('supports conservative stride=2 for reduced CPU load when specified', () => {
    const tracker = new MicroPatchTracker(8, 8);
    const frame = createSyntheticProcFrame();

    tracker.updateTemplates(frame, W, H, [
      { index: 68, x: 120 / W, y: 90 / H, patchRadius: 8 },
      { index: 69, x: 200 / W, y: 90 / H, patchRadius: 8 },
    ]);

    const resStride2 = tracker.track(frame, W, H, 0.55, 2);
    expect(resStride2.has(68)).toBe(true);
    expect(resStride2.has(69)).toBe(true);
  });
});
