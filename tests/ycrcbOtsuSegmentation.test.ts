import {
  applyYCrCbOtsuSegmentation,
  type FaceRoi,
} from '../src/lib/services/ivpDiagnosticKernels';

describe('YCrCb Morphological Otsu Segmentation (Unit 6 & 7)', () => {
  const W = 320;
  const H = 240;

  function createMockImageData(width = W, height = H): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    return {
      data,
      width,
      height,
      colorSpace: 'srgb',
    } as unknown as ImageData;
  }

  it('highlights facial skin and strictly rejects clothes/shirt below neck', () => {
    const srcImg = createMockImageData(W, H);
    const dstImg = createMockImageData(W, H);

    // 1. Cool neutral background (walls, ceiling)
    for (let i = 0; i < W * H; i++) {
      const idx = i * 4;
      srcImg.data[idx]     = 45; // R
      srcImg.data[idx + 1] = 55; // G
      srcImg.data[idx + 2] = 75; // B
      srcImg.data[idx + 3] = 255;
    }

    // 2. Face region (Center: x=120..200, y=40..130): human skin tone (R=205, G=150, B=125 -> Cr~160, Cb~108)
    const faceX = 120, faceY = 40, faceW = 80, faceH = 90;
    for (let y = faceY; y < faceY + faceH; y++) {
      for (let x = faceX; x < faceX + faceW; x++) {
        const idx = (y * W + x) * 4;
        srcImg.data[idx]     = 205;
        srcImg.data[idx + 1] = 150;
        srcImg.data[idx + 2] = 125;
      }
    }

    // 3. Warm/red shirt/clothes region (y=150..240, x=30..290):
    // Red/orange shirt has very high Cr (R=210, G=70, B=60 -> Cr~190, Cb~90)
    for (let y = 150; y < H; y++) {
      for (let x = 30; x < W - 30; x++) {
        const idx = (y * W + x) * 4;
        srcImg.data[idx]     = 210;
        srcImg.data[idx + 1] = 70;
        srcImg.data[idx + 2] = 60;
      }
    }

    const faceRoi: FaceRoi = { x: faceX, y: faceY, width: faceW, height: faceH };
    const res = applyYCrCbOtsuSegmentation(srcImg, dstImg, W, H, faceRoi);

    expect(res.otsuThreshold).toBeGreaterThanOrEqual(125);
    expect(res.otsuThreshold).toBeLessThanOrEqual(140);
    expect(res.skinPixelCount).toBeGreaterThan(0);

    // Assert: Center of the face MUST be detected as skin (neon emerald: G=230)
    const faceCenterIdx = ((faceY + Math.round(faceH / 2)) * W + (faceX + Math.round(faceW / 2))) * 4;
    expect(dstImg.data[faceCenterIdx + 1]).toBe(230); // Neon emerald G=230

    // Assert: The clothes / shirt (y=190, x=160) MUST NOT be detected as skin (must be background navy: G=23)
    const shirtCenterIdx = (190 * W + 160) * 4;
    expect(dstImg.data[shirtCenterIdx + 1]).toBe(23); // Background navy G=23

    // Assert: Shoulder clothes (y=170, x=60) MUST NOT be detected as skin
    const shoulderIdx = (170 * W + 60) * 4;
    expect(dstImg.data[shoulderIdx + 1]).toBe(23); // Background navy G=23
  });

  it('detects darker skin tones without dropping face pixels under cool lighting', () => {
    const srcImg = createMockImageData(W, H);
    const dstImg = createMockImageData(W, H);

    // Neutral office background
    for (let i = 0; i < W * H; i++) {
      const idx = i * 4;
      srcImg.data[idx]     = 60;
      srcImg.data[idx + 1] = 65;
      srcImg.data[idx + 2] = 70;
      srcImg.data[idx + 3] = 255;
    }

    // Tan/dark skin tone (R=140, G=105, B=80 -> Cr~148, Cb~112)
    const faceX = 110, faceY = 50, faceW = 90, faceH = 100;
    for (let y = faceY; y < faceY + faceH; y++) {
      for (let x = faceX; x < faceX + faceW; x++) {
        const idx = (y * W + x) * 4;
        srcImg.data[idx]     = 140;
        srcImg.data[idx + 1] = 105;
        srcImg.data[idx + 2] = 80;
      }
    }

    const faceRoi: FaceRoi = { x: faceX, y: faceY, width: faceW, height: faceH };
    const res = applyYCrCbOtsuSegmentation(srcImg, dstImg, W, H, faceRoi);

    expect(res.skinPixelCount).toBeGreaterThan(500);

    const faceCenterIdx = ((faceY + 40) * W + (faceX + 40)) * 4;
    expect(dstImg.data[faceCenterIdx + 1]).toBe(230); // Skin detected
  });

  it('automatically isolates upper skin cluster when faceRoi is null', () => {
    const srcImg = createMockImageData(W, H);
    const dstImg = createMockImageData(W, H);

    // Blue/grey background
    for (let i = 0; i < W * H; i++) {
      const idx = i * 4;
      srcImg.data[idx]     = 40;
      srcImg.data[idx + 1] = 50;
      srcImg.data[idx + 2] = 80;
      srcImg.data[idx + 3] = 255;
    }

    // Face skin in upper frame
    const fx = 100, fy = 35, fw = 75, fh = 80;
    for (let y = fy; y < fy + fh; y++) {
      for (let x = fx; x < fx + fw; x++) {
        const idx = (y * W + x) * 4;
        srcImg.data[idx]     = 210;
        srcImg.data[idx + 1] = 160;
        srcImg.data[idx + 2] = 140;
      }
    }

    // Clothes in bottom frame
    for (let y = 160; y < H; y++) {
      for (let x = 40; x < W - 40; x++) {
        const idx = (y * W + x) * 4;
        srcImg.data[idx]     = 200;
        srcImg.data[idx + 1] = 80;
        srcImg.data[idx + 2] = 60;
      }
    }

    // Call without faceRoi
    const res = applyYCrCbOtsuSegmentation(srcImg, dstImg, W, H, null);

    expect(res.skinPixelCount).toBeGreaterThan(0);

    // Face center must be detected as skin
    const faceCenterIdx = ((fy + 35) * W + (fx + 35)) * 4;
    expect(dstImg.data[faceCenterIdx + 1]).toBe(230);

    // Shirt center must be rejected as background
    const shirtIdx = (190 * W + 150) * 4;
    expect(dstImg.data[shirtIdx + 1]).toBe(23);
  });
});
