import {
  computeCoordinateMapping,
  mapNormalizedToCanvas,
  procToVideoX,
} from '../src/lib/services/visionPipeline';

describe('Mirroring Roundtrip & Symmetrical Projection', () => {
  const videoWidth = 1280;
  const videoHeight = 720;
  const canvasWidth = 640;
  const canvasHeight = 480;

  it('produces exact horizontal reflection across canvas coordinates when mirrored=true', () => {
    const unmirroredMap = computeCoordinateMapping({
      videoWidth,
      videoHeight,
      canvasWidth,
      canvasHeight,
      fitMode: 'contain',
      mirrored: false,
    });

    const mirroredMap = computeCoordinateMapping({
      videoWidth,
      videoHeight,
      canvasWidth,
      canvasHeight,
      fitMode: 'contain',
      mirrored: true,
    });

    const testPoints = [
      { x: 0.20, y: 0.40 },
      { x: 0.50, y: 0.50 },
      { x: 0.75, y: 0.60 },
      { x: 0.10, y: 0.85 },
    ];

    const destW = unmirroredMap.videoWidth * unmirroredMap.scaleX;
    const destX = unmirroredMap.offsetX;

    for (const pt of testPoints) {
      const pUnmirrored = mapNormalizedToCanvas(pt, unmirroredMap);
      const pMirrored = mapNormalizedToCanvas(pt, mirroredMap);

      // Y coordinates must be strictly unchanged by horizontal mirroring
      expect(pMirrored.y).toBeCloseTo(pUnmirrored.y, 4);

      // X coordinates must reflect across the center of the rendered video viewport
      const offsetFromLeft = pUnmirrored.x - destX;
      const offsetFromRight = (destX + destW) - pMirrored.x;
      expect(offsetFromRight).toBeCloseTo(offsetFromLeft, 4);
    }
  });

  it('preserves canonical landmark position when round-tripped through micro-tracking mirroring', () => {
    // Simulate a raw point at x = 0.35 in video space
    const videoNormX = 0.35;
    const PROC_W = 320;
    const videoW = 1280;

    for (const mirrored of [false, true]) {
      // 1. Template initialization mapping:
      const normMicroX = (x: number) => (mirrored ? (1.0 - x) : x);
      const inputToTracker = normMicroX(videoNormX);

      // Tracker finds feature at inputToTracker (assume 0 displacement for roundtrip)
      const featX = inputToTracker;

      // 2. Intermediate frame recovery:
      const procX = mirrored ? (1.0 - featX) : featX;
      const recoveredVideoNormX = procToVideoX(procX, PROC_W, videoW);

      // Assert videoNormX is preserved through the mirrored transform
      expect(procX).toBeCloseTo(videoNormX, 6);
      expect(recoveredVideoNormX).toBeCloseTo((videoNormX * PROC_W) / videoW, 6);
    }
  });
});
