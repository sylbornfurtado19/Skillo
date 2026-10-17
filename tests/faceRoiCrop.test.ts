import { computeFaceRoiCrop } from '../src/lib/services/visionPipeline';

describe('Face-ROI Tight Crop Math & Edge Clamping (Iteration 1a)', () => {
  it('computes square aspect-preserving crop centered on face with 25% margin', () => {
    // Face box centered in a 640x480 frame
    const faceBox = { x: 220, y: 140, width: 200, height: 200 };
    const sourceWidth = 640;
    const sourceHeight = 480;

    const crop = computeFaceRoiCrop(faceBox, sourceWidth, sourceHeight, { margin: 0.25 });

    expect(crop.isROI).toBe(true);
    // side = 200 * (1 + 2*0.25) = 300
    expect(crop.sw).toBe(300);
    expect(crop.sh).toBe(300);
    // cx = 320, cy = 240 -> x0 = 320 - 150 = 170, y0 = 240 - 150 = 90
    expect(crop.sx).toBe(170);
    expect(crop.sy).toBe(90);
  });

  it('clamps correctly when face is near the top-left boundary', () => {
    // Face box at the extreme top-left (e.g. x=10, y=10, w=150, h=150)
    const faceBox = { x: 10, y: 10, width: 150, height: 150 };
    const sourceWidth = 640;
    const sourceHeight = 480;

    const crop = computeFaceRoiCrop(faceBox, sourceWidth, sourceHeight, { margin: 0.20 });

    expect(crop.isROI).toBe(true);
    // side = 150 * (1 + 2*0.2) = 210
    expect(crop.sw).toBe(210);
    expect(crop.sh).toBe(210);
    // Left and top must never be negative
    expect(crop.sx).toBeGreaterThanOrEqual(0);
    expect(crop.sy).toBeGreaterThanOrEqual(0);
    expect(crop.sx).toBe(0);
    expect(crop.sy).toBe(0);
  });

  it('clamps correctly when face is near the bottom-right boundary', () => {
    // Face box at the extreme bottom-right
    const faceBox = { x: 500, y: 360, width: 120, height: 110 };
    const sourceWidth = 640;
    const sourceHeight = 480;

    const crop = computeFaceRoiCrop(faceBox, sourceWidth, sourceHeight, { margin: 0.25 });

    expect(crop.isROI).toBe(true);
    // side = 120 * 1.5 = 180
    expect(crop.sw).toBe(180);
    expect(crop.sh).toBe(180);
    // Crop must stay strictly within sourceWidth and sourceHeight
    expect(crop.sx + crop.sw).toBeLessThanOrEqual(sourceWidth);
    expect(crop.sy + crop.sh).toBeLessThanOrEqual(sourceHeight);
    expect(crop.sx).toBe(640 - 180); // 460
    expect(crop.sy).toBe(480 - 180); // 300
  });

  it('handles mirrored input coordinates correctly', () => {
    // Subject on the right side of video (x=450, w=100)
    // When mirrored, should be on the left side (x_mirrored = 640 - (450 + 50) = 140 center)
    const faceBox = { x: 450, y: 150, width: 100, height: 100 };
    const sourceWidth = 640;
    const sourceHeight = 480;

    const unmirrored = computeFaceRoiCrop(faceBox, sourceWidth, sourceHeight, { mirrored: false, margin: 0.25 });
    const mirrored = computeFaceRoiCrop(faceBox, sourceWidth, sourceHeight, { mirrored: true, margin: 0.25 });

    expect(unmirrored.isROI).toBe(true);
    expect(mirrored.isROI).toBe(true);
    expect(unmirrored.sw).toBe(mirrored.sw);
    expect(unmirrored.sh).toBe(mirrored.sh);
    // Unmirrored center is 500, mirrored center is 140
    expect(unmirrored.sx).toBe(500 - 75); // 425
    expect(mirrored.sx).toBe(140 - 75);   // 65
  });

  it('falls back to full-frame when faceBox is null, undefined, or empty', () => {
    const sourceWidth = 1280;
    const sourceHeight = 720;

    const cropNull = computeFaceRoiCrop(null, sourceWidth, sourceHeight);
    expect(cropNull.isROI).toBe(false);
    expect(cropNull.sx).toBe(0);
    expect(cropNull.sy).toBe(0);
    expect(cropNull.sw).toBe(1280);
    expect(cropNull.sh).toBe(720);

    const cropZero = computeFaceRoiCrop({ x: 0, y: 0, width: 0, height: 0 }, sourceWidth, sourceHeight);
    expect(cropZero.isROI).toBe(false);
    expect(cropZero.sw).toBe(1280);
    expect(cropZero.sh).toBe(720);
  });
});
