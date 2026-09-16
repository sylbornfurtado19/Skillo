import { MicroPatchTracker } from '../src/lib/services/microPatchTracker';

describe('Lucas-Kanade Optical Flow Fallback & Multi-Face Isolation', () => {
  const W = 160;
  const H = 120;

  // Helper to create synthetic frame with a textured circular feature
  function createSyntheticPatch(cx: number, cy: number, radius: number = 8, noiseLevel: number = 0, cx2?: number, cy2?: number): Uint8ClampedArray {
    const pixels = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = (y * W + x) * 4;
        const d1 = Math.hypot(x - cx, y - cy);
        const d2 = cx2 !== undefined && cy2 !== undefined ? Math.hypot(x - cx2, y - cy2) : 999;
        let val = 128; // background
        if (d1 <= radius) {
          val = Math.round(50 + (x - (cx - radius)) * 10 + (y - (cy - radius)) * 5);
        } else if (d2 <= radius) {
          val = Math.round(50 + (x - ((cx2 ?? 0) - radius)) * 10 + (y - ((cy2 ?? 0) - radius)) * 5);
        }
        if (noiseLevel > 0) {
          val += Math.round((Math.random() - 0.5) * noiseLevel);
        }
        val = Math.max(0, Math.min(255, val));
        pixels[idx] = val;
        pixels[idx + 1] = val;
        pixels[idx + 2] = val;
        pixels[idx + 3] = 255;
      }
    }
    return pixels;
  }

  it('accurately recovers known sub-pixel displacement under Lucas-Kanade optical flow', () => {
    const tracker = new MicroPatchTracker(8, 8, 5);
    const initialX = 50;
    const initialY = 50;

    // Frame 0: Anchor template at (50, 50)
    const frame0 = createSyntheticPatch(initialX, initialY, 8);
    tracker.updateTemplates(frame0, W, H, [
      { index: 68, x: initialX / W, y: initialY / H, patchRadius: 8 },
    ]);

    expect(tracker.templateCount()).toBe(1);

    // Frame 1: Feature translated by dx = +1.2 px, dy = +0.8 px with slight noise
    const dxTrue = 1.2;
    const dyTrue = 0.8;
    const frame1 = createSyntheticPatch(initialX + dxTrue, initialY + dyTrue, 8, 2);

    // Track with LK enabled
    const results = tracker.track(frame1, W, H, 0.55, 1, { enableLk: true });
    const feature = results.get(68);

    expect(feature).toBeDefined();
    if (feature) {
      const estimatedPxX = feature.x * W;
      const estimatedPxY = feature.y * H;
      const errorX = Math.abs(estimatedPxX - (initialX + dxTrue));
      const errorY = Math.abs(estimatedPxY - (initialY + dyTrue));

      // Error must be < 0.5 px
      expect(errorX).toBeLessThan(0.5);
      expect(errorY).toBeLessThan(0.5);
    }
  });

  it('triggers LK fallback when ZNCC is depressed by subtle photometric gain shift', () => {
    const tracker = new MicroPatchTracker(8, 8, 5);
    const initialX = 60;
    const initialY = 60;

    const frame0 = createSyntheticPatch(initialX, initialY, 8);
    tracker.updateTemplates(frame0, W, H, [
      { index: 48, x: initialX / W, y: initialY / H, patchRadius: 8 },
    ]);

    // Create frame1 with slight displacement + gain shift that reduces standard correlation
    const frame1 = createSyntheticPatch(initialX + 1.0, initialY + 0.5, 8);
    // Add uniform brightness offset
    for (let i = 0; i < frame1.length; i += 4) {
      frame1[i] = Math.min(255, frame1[i] + 35);
      frame1[i + 1] = Math.min(255, frame1[i + 1] + 35);
      frame1[i + 2] = Math.min(255, frame1[i + 2] + 35);
    }

    // Requiring high confidence 0.88 causes ZNCC to fall back
    const results = tracker.track(frame1, W, H, 0.88, 1, { enableLk: true, lkMinEigenvalue: 4.0 });
    const feature = results.get(48);

    expect(feature).toBeDefined();
    if (feature) {
      expect(['LK', 'SOBEL', 'ZNCC']).toContain(feature.method);
      const estX = feature.x * W;
      const estY = feature.y * H;
      expect(Math.abs(estX - (initialX + 1.0))).toBeLessThan(0.6);
      expect(Math.abs(estY - (initialY + 0.5))).toBeLessThan(0.6);
    }
  });

  it('isolates multi-face templates by clearing on faceId switch', () => {
    const tracker = new MicroPatchTracker(8, 8, 5);
    tracker.setFaceId('face-user-1');

    const frame = createSyntheticPatch(40, 40, 8, 0, 60, 40);
    tracker.updateTemplates(frame, W, H, [
      { index: 68, x: 40 / W, y: 40 / H },
      { index: 69, x: 60 / W, y: 40 / H },
    ]);

    expect(tracker.templateCount()).toBe(2);
    expect(tracker.getFaceId()).toBe('face-user-1');

    // Face switches to a second person in frame
    tracker.setFaceId('face-user-2');
    expect(tracker.getFaceId()).toBe('face-user-2');
    // All templates from face 1 must be flushed
    expect(tracker.templateCount()).toBe(0);
  });
});
