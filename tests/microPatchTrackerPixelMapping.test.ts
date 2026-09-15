import {
  procToVideoCoord,
  videoToProcCoord,
  procToVideoX,
  procToVideoY,
  videoToProcX,
  videoToProcY,
} from '../src/lib/services/visionPipeline';
import { MicroPatchTracker } from '../src/lib/services/microPatchTracker';

describe('MicroPatchTracker Pixel Mapping & Mutual Inversion', () => {
  it('strictly inverts procToVideoCoord and videoToProcCoord across arbitrary resolutions', () => {
    const resolutions = [
      { vw: 1280, vh: 720, pw: 320, ph: 240 },
      { vw: 1920, vh: 1080, pw: 320, ph: 240 },
      { vw: 640, vh: 480, pw: 320, ph: 240 },
      { vw: 320, vh: 240, pw: 320, ph: 240 },
      { vw: 3840, vh: 2160, pw: 320, ph: 240 },
    ];

    const testValues = [0.0, 0.125, 0.3333, 0.5, 0.6789, 0.95, 1.0];

    for (const res of resolutions) {
      for (const val of testValues) {
        // Test X mapping
        const vidX = procToVideoX(val, res.pw, res.vw);
        const backProcX = videoToProcX(vidX, res.pw, res.vw);
        expect(backProcX).toBeCloseTo(val, 6);

        // Test Y mapping
        const vidY = procToVideoY(val, res.ph, res.vh);
        const backProcY = videoToProcY(vidY, res.ph, res.vh);
        expect(backProcY).toBeCloseTo(val, 6);

        // Direct coord inversion
        const toVid = procToVideoCoord(val, res.pw, res.vw);
        const toProc = videoToProcCoord(toVid, res.pw, res.vw);
        expect(toProc).toBeCloseTo(val, 6);
      }
    }
  });

  it('safely handles degenerate 0-dimension video dimensions without NaN', () => {
    expect(Number.isFinite(procToVideoCoord(0.5, 320, 0))).toBe(true);
    expect(Number.isFinite(videoToProcCoord(0.5, 0, 720))).toBe(true);
    expect(procToVideoX(0.5, 320, 0)).toBe(0.5 * 320); // fallback max(1, 0) = 1
  });

  it('tracks templateCount lifecycle correctly', () => {
    const tracker = new MicroPatchTracker(8, 8);
    expect(tracker.templateCount()).toBe(0);

    const W = 64;
    const H = 64;
    const frame = new Uint8ClampedArray(W * H * 4);
    // Draw high-contrast feature
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = (y * W + x) * 4;
        frame[idx] = (x > 28 && x < 36 && y > 28 && y < 36) ? 20 : 220;
        frame[idx + 1] = frame[idx];
        frame[idx + 2] = frame[idx];
        frame[idx + 3] = 255;
      }
    }

    tracker.updateTemplates(frame, W, H, [
      { index: 68, x: 0.5, y: 0.5, patchRadius: 8 },
      { index: 69, x: 0.5, y: 0.5, patchRadius: 10 },
      { index: 48, x: 0.5, y: 0.5, patchRadius: 12 },
      { index: 54, x: 0.5, y: 0.5, patchRadius: 12 },
    ]);

    expect(tracker.templateCount()).toBe(4);

    tracker.reset();
    expect(tracker.templateCount()).toBe(0);
  });

  it('supports per-landmark patchRadius overrides for lips and pupils', () => {
    const tracker = new MicroPatchTracker(8, 8);
    const W = 80;
    const H = 80;
    const frame = new Uint8ClampedArray(W * H * 4);
    // Draw a larger gradient circle for lips at (40, 40)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = (y * W + x) * 4;
        const d = Math.hypot(x - 40, y - 40);
        const luma = d < 12 ? 30 : 210;
        frame[idx] = luma;
        frame[idx + 1] = luma;
        frame[idx + 2] = luma;
        frame[idx + 3] = 255;
      }
    }

    // Set lip template with radius 12
    tracker.updateTemplates(frame, W, H, [
      { index: 48, x: 40 / W, y: 40 / H, patchRadius: 12 },
    ]);
    expect(tracker.templateCount()).toBe(1);

    // Track in unchanged frame -> high NCC
    const tracked = tracker.track(frame, W, H, 0.70);
    expect(tracked.has(48)).toBe(true);
    expect(tracked.get(48)!.ncc).toBeGreaterThan(0.95);
    expect(tracked.get(48)!.x).toBeCloseTo(40 / W, 2);
    expect(tracked.get(48)!.y).toBeCloseTo(40 / H, 2);
  });

  it('computes sub-pixel displacement accurately with quadratic peak interpolation', () => {
    const tracker = new MicroPatchTracker(8, 8);
    const W = 64;
    const H = 64;
    const frame1 = new Uint8ClampedArray(W * H * 4);

    // Smooth Gaussian blob at (32, 32)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = (y * W + x) * 4;
        const distSq = (x - 32) * (x - 32) + (y - 32) * (y - 32);
        const luma = Math.round(255 * Math.exp(-distSq / 18));
        frame1[idx] = luma;
        frame1[idx + 1] = luma;
        frame1[idx + 2] = luma;
        frame1[idx + 3] = 255;
      }
    }

    tracker.updateTemplates(frame1, W, H, [{ index: 68, x: 32 / W, y: 32 / H }]);

    // Frame 2 with 1px displacement
    const frame2 = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = (y * W + x) * 4;
        const distSq = (x - 33) * (x - 33) + (y - 33) * (y - 33);
        const luma = Math.round(255 * Math.exp(-distSq / 18));
        frame2[idx] = luma;
        frame2[idx + 1] = luma;
        frame2[idx + 2] = luma;
        frame2[idx + 3] = 255;
      }
    }

    const tracked = tracker.track(frame2, W, H, 0.60);
    expect(tracked.has(68)).toBe(true);
    const feat = tracked.get(68)!;
    // Displaced by 1px: 33/64 = 0.515625
    expect(feat.x).toBeCloseTo(33 / W, 2);
    expect(feat.y).toBeCloseTo(33 / W, 2);
    expect(feat.ncc).toBeGreaterThan(0.95);
  });
});
