import { MicroPatchTracker } from '../src/lib/services/microPatchTracker';

describe('MicroPatchTracker Template Aging & Lifecycle', () => {
  const W = 64;
  const H = 64;

  function createPatternFrame(cx: number, cy: number): Uint8ClampedArray {
    const frame = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = (y * W + x) * 4;
        const dist = Math.hypot(x - cx, y - cy);
        const luma = dist < 5 ? 20 : 220;
        frame[idx] = luma;
        frame[idx + 1] = luma;
        frame[idx + 2] = luma;
        frame[idx + 3] = 255;
      }
    }
    return frame;
  }

  function createBlankFrame(): Uint8ClampedArray {
    const frame = new Uint8ClampedArray(W * H * 4);
    frame.fill(128); // Completely flat, no contrast
    return frame;
  }

  it('increments miss count when correlation drops and evicts template after maxMisses', () => {
    // maxMisses = 3
    const tracker = new MicroPatchTracker(8, 8, 3);
    const validFrame = createPatternFrame(32, 32);
    const blankFrame = createBlankFrame();

    tracker.updateTemplates(validFrame, W, H, [
      { index: 68, x: 32 / W, y: 32 / H, patchRadius: 8 },
    ]);

    expect(tracker.templateCount()).toBe(1);
    expect(tracker.getMissCount(68)).toBe(0);

    // Frame 1 with blank: correlation fails
    const res1 = tracker.track(blankFrame, W, H, 0.55);
    expect(res1.has(68)).toBe(false);
    expect(tracker.getMissCount(68)).toBe(1);
    expect(tracker.templateCount()).toBe(1); // Not evicted yet

    // Frame 2 with blank
    const res2 = tracker.track(blankFrame, W, H, 0.55);
    expect(res2.has(68)).toBe(false);
    expect(tracker.getMissCount(68)).toBe(2);
    expect(tracker.templateCount()).toBe(1);

    // Frame 3 with blank: hits maxMisses = 3 -> template evicted
    const res3 = tracker.track(blankFrame, W, H, 0.55);
    expect(res3.has(68)).toBe(false);
    expect(tracker.templateCount()).toBe(0);
    expect(tracker.getMissCount(68)).toBe(-1); // Evicted
  });

  it('resets miss count back to 0 when a subsequent frame matches successfully', () => {
    const tracker = new MicroPatchTracker(8, 8, 3);
    const validFrame = createPatternFrame(32, 32);
    const blankFrame = createBlankFrame();

    tracker.updateTemplates(validFrame, W, H, [
      { index: 68, x: 32 / W, y: 32 / H, patchRadius: 8 },
    ]);

    // 2 failed frames
    tracker.track(blankFrame, W, H, 0.55);
    tracker.track(blankFrame, W, H, 0.55);
    expect(tracker.getMissCount(68)).toBe(2);

    // 1 successful frame recovers template
    const res = tracker.track(validFrame, W, H, 0.55);
    expect(res.has(68)).toBe(true);
    expect(tracker.getMissCount(68)).toBe(0);
  });
});
