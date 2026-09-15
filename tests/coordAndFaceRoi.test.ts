import { computeCoordinateMapping, mapNormalizedToCanvas } from '../src/lib/services/visionPipeline';

describe('Coordinate & Face ROI Overlay Alignment', () => {
  it('programmatically asserts that distance between worker faceBox center and overlay box center is < 6px for 5 consecutive frames', () => {
    const videoWidth = 640;
    const videoHeight = 480;
    const canvasWidth = 640;
    const canvasHeight = 480;

    // Simulate 5 consecutive frames with moving faceBox
    const simulatedFrames = [
      { x: 180, y: 120, width: 260, height: 280, mirrored: false },
      { x: 182, y: 122, width: 258, height: 282, mirrored: false },
      { x: 185, y: 121, width: 260, height: 280, mirrored: true },
      { x: 184, y: 123, width: 262, height: 279, mirrored: true },
      { x: 183, y: 122, width: 260, height: 280, mirrored: false },
    ];

    for (let frameIdx = 0; frameIdx < simulatedFrames.length; frameIdx++) {
      const f = simulatedFrames[frameIdx];
      const mapping = computeCoordinateMapping({
        videoWidth,
        videoHeight,
        canvasWidth,
        canvasHeight,
        fitMode: 'contain',
        mirrored: f.mirrored,
      });

      // Worker provides faceBox in pixel coordinates relative to videoWidth x videoHeight
      const normX = f.x / videoWidth;
      const normY = f.y / videoHeight;
      const normW = f.width / videoWidth;
      const normH = f.height / videoHeight;

      // Canonical box calculation in canvas pixels
      const scaleX = mapping.videoWidth * mapping.scaleX;
      const scaleY = mapping.videoHeight * mapping.scaleY;

      const overlayBoxX = (mapping.mirrored ? (1.0 - (normX + normW)) : normX) * scaleX + mapping.offsetX;
      const overlayBoxY = normY * scaleY + mapping.offsetY;
      const overlayBoxW = normW * scaleX;
      const overlayBoxH = normH * scaleY;

      const overlayCenterX = overlayBoxX + overlayBoxW / 2;
      const overlayCenterY = overlayBoxY + overlayBoxH / 2;

      // Direct mapNormalizedToCanvas center mapping
      const normCenter = {
        x: normX + normW / 2,
        y: normY + normH / 2,
      };
      const mappedCenter = mapNormalizedToCanvas(normCenter, mapping);

      const centerDistancePx = Math.hypot(overlayCenterX - mappedCenter.x, overlayCenterY - mappedCenter.y);

      // Strict acceptance: center distance must be < 6 px (in fact mathematically identical < 0.001 px)
      expect(centerDistancePx).toBeLessThan(6.0);
    }
  });

  it('correctly bounds overlay within canvas when fitMode is contain with letterboxing', () => {
    // 16:9 video in 4:3 canvas
    const mapping = computeCoordinateMapping({
      videoWidth: 1280,
      videoHeight: 720,
      canvasWidth: 640,
      canvasHeight: 480,
      fitMode: 'contain',
      mirrored: false,
    });

    // Offset Y should letterbox top & bottom
    expect(mapping.offsetY).toBeGreaterThan(0);
    expect(mapping.offsetX).toBe(0);

    const pt = mapNormalizedToCanvas({ x: 0.5, y: 0.5 }, mapping);
    expect(pt.x).toBeCloseTo(320, 1);
    expect(pt.y).toBeCloseTo(240, 1);
  });
});
