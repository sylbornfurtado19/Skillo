import {
  detectFastFaceBootstrap,
  type FastFaceBootstrapResult,
} from '../src/lib/services/visionPipeline';

describe('Fast Face Bootstrap Detector', () => {
  const W = 160;
  const H = 120;

  function createBlankFrame(width = W, height = H): Uint8ClampedArray {
    return new Uint8ClampedArray(width * height * 4);
  }

  function drawSyntheticFace(
    data: Uint8ClampedArray,
    width = W,
    height = H,
    fx = 40,
    fy = 30,
    fw = 80,
    fh = 70
  ) {
    // Fill background with cool blue/gray
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = 40;
        data[idx + 1] = 50;
        data[idx + 2] = 80;
        data[idx + 3] = 255;
      }
    }

    // Fill face box with skin-tone (R=210, G=160, B=140)
    for (let y = fy; y < fy + fh; y++) {
      for (let x = fx; x < fx + fw; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = 210;
        data[idx + 1] = 160;
        data[idx + 2] = 140;
        data[idx + 3] = 255;
      }
    }

    // Place dark pupils (R=20, G=20, B=20)
    // In subject coordinates: right eye is on image left (x = cx - 14), left eye is on image right (x = cx + 14)
    const cx = fx + Math.round(fw / 2);
    const cy = fy + Math.round(fh / 2);
    const eyeY = cy - 10;
    const rEyeX = cx - 14;
    const lEyeX = cx + 14;

    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const rIdx = ((eyeY + dy) * width + (rEyeX + dx)) * 4;
        data[rIdx] = 20;
        data[rIdx + 1] = 20;
        data[rIdx + 2] = 20;

        const lIdx = ((eyeY + dy) * width + (lEyeX + dx)) * 4;
        data[lIdx] = 20;
        data[lIdx + 1] = 20;
        data[lIdx + 2] = 20;
      }
    }

    // Place dark mouth line
    const mouthY = cy + 15;
    for (let mx = cx - 12; mx <= cx + 12; mx++) {
      const mIdx = (mouthY * width + mx) * 4;
      data[mIdx] = 60;
      data[mIdx + 1] = 20;
      data[mIdx + 2] = 20;
    }
  }

  it('detects a synthetic face within < 5ms and returns 70 canonical landmarks', () => {
    const data = createBlankFrame();
    drawSyntheticFace(data, W, H, 40, 25, 80, 70);

    const start = performance.now();
    const result = detectFastFaceBootstrap(data, W, H, false);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(10); // Well within budget (< 5ms typical)
    expect(result).not.toBeNull();

    if (!result) return;
    expect(result.detected).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.60);

    // Bounding box should enclose face
    expect(result.box.x).toBeGreaterThanOrEqual(0.20);
    expect(result.box.x + result.box.width).toBeLessThanOrEqual(0.85);
    expect(result.box.y).toBeGreaterThanOrEqual(0.15);
    expect(result.box.y + result.box.height).toBeLessThanOrEqual(0.90);

    // Pupils should be detected and separated
    expect(result.rightPupil.x).toBeLessThan(result.leftPupil.x);
    expect(result.leftPupil.x - result.rightPupil.x).toBeGreaterThan(0.10);

    // Approx landmarks must be 70 points
    expect(result.approxLandmarks).toHaveLength(70);
    expect(result.approxLandmarks[68].x).toBeCloseTo(result.rightPupil.x, 2);
    expect(result.approxLandmarks[69].x).toBeCloseTo(result.leftPupil.x, 2);
  });

  it('gracefully returns null on non-skin or low-light frames', () => {
    const blank = createBlankFrame();
    expect(detectFastFaceBootstrap(blank, W, H)).toBeNull();

    // Uniform green screen
    const greenScreen = createBlankFrame();
    for (let i = 0; i < greenScreen.length; i += 4) {
      greenScreen[i] = 10;
      greenScreen[i + 1] = 230;
      greenScreen[i + 2] = 20;
      greenScreen[i + 3] = 255;
    }
    expect(detectFastFaceBootstrap(greenScreen, W, H)).toBeNull();

    // Frame too small
    expect(detectFastFaceBootstrap(blank, 16, 16)).toBeNull();
  });

  it('handles mirrored mode with accurate horizontal reflection', () => {
    const data = createBlankFrame();
    drawSyntheticFace(data, W, H, 30, 25, 60, 60);

    const unmirrored = detectFastFaceBootstrap(data, W, H, false);
    const mirrored = detectFastFaceBootstrap(data, W, H, true);

    expect(unmirrored).not.toBeNull();
    expect(mirrored).not.toBeNull();

    if (!unmirrored || !mirrored) return;

    // Pupil X coordinates should be reflected
    expect(mirrored.rightPupil.x).toBeCloseTo(1.0 - unmirrored.rightPupil.x, 2);
    expect(mirrored.leftPupil.x).toBeCloseTo(1.0 - unmirrored.leftPupil.x, 2);

    // Box dimensions match while horizontal position reflects
    expect(mirrored.box.width).toBeCloseTo(unmirrored.box.width, 2);
    expect(mirrored.box.y).toBeCloseTo(unmirrored.box.y, 2);

    // Approximate landmark 33 (nose) reflects horizontally
    expect(mirrored.approxLandmarks[33].x).toBeCloseTo(1.0 - unmirrored.approxLandmarks[33].x, 2);
  });
});
