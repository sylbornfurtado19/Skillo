import {
  computeCoordinateMapping,
  mapNormalizedToCanvas,
  mapNormalizedPointsToCanvas,
  procNormalizedToVideoNormalized,
  procToVideoCoord,
  videoToProcCoord,
  procToVideoX,
  procToVideoY,
  videoToProcX,
  videoToProcY,
  detectDeviceProfile,
  OnlineCalibrationEstimator,
} from '../src/lib/services/visionPipeline';

describe('Coordinate Mapping & Device Profiling Robustness', () => {
  describe('proc <-> video normalized transformations', () => {
    it('preserves authentic normalized values across full video span', () => {
      const testCoords = [0.0, 0.25, 0.5, 0.75, 1.0];
      for (const c of testCoords) {
        const p = procNormalizedToVideoNormalized(c, c);
        expect(p.x).toBeCloseTo(c, 6);
        expect(p.y).toBeCloseTo(c, 6);
        expect(procToVideoCoord(c, 320, 320)).toBeCloseTo(c, 6);
        expect(videoToProcCoord(c, 320, 320)).toBeCloseTo(c, 6);
        expect(procToVideoX(c, 320, 320)).toBeCloseTo(c, 6);
        expect(procToVideoY(c, 240, 240)).toBeCloseTo(c, 6);
      }
    });

    it('correctly maps cropped ROI coordinates if ROI is supplied', () => {
      // 640x480 video with face ROI cropped to [160, 120, 320, 240]
      const roi = { x: 160, y: 120, width: 320, height: 240, videoWidth: 640, videoHeight: 480 };
      const centerInProc = procNormalizedToVideoNormalized(0.5, 0.5, roi);
      // Pixel in video should be 160 + 0.5*320 = 320 -> 320 / 640 = 0.5
      // Pixel Y in video should be 120 + 0.5*240 = 240 -> 240 / 480 = 0.5
      expect(centerInProc.x).toBeCloseTo(0.5, 5);
      expect(centerInProc.y).toBeCloseTo(0.5, 5);

      const cornerInProc = procNormalizedToVideoNormalized(0.0, 0.0, roi);
      expect(cornerInProc.x).toBeCloseTo(160 / 640, 5);
      expect(cornerInProc.y).toBeCloseTo(120 / 480, 5);
    });
  });

  describe('Letterbox & Mirrored Canvas Mapping Paths', () => {
    it('computes exact offsets for 16:9 video contained in 4:3 canvas (unmirrored)', () => {
      // Video 1280x720 (16:9), Canvas 640x480 (4:3)
      // Fit mode 'contain': scale = 640 / 1280 = 0.5. destW = 640, destH = 360.
      // Vertical letterbox: offsetY = (480 - 360) / 2 = 60px.
      const mapping = computeCoordinateMapping({
        videoWidth: 1280,
        videoHeight: 720,
        canvasWidth: 640,
        canvasHeight: 480,
        fitMode: 'contain',
        mirrored: false,
      });

      expect(mapping.offsetX).toBe(0);
      expect(mapping.offsetY).toBe(60);
      expect(mapping.scaleX).toBeCloseTo(0.5, 5);
      expect(mapping.scaleY).toBeCloseTo(0.5, 5);

      // Center point (0.5, 0.5) -> canvas (320, 60 + 0.5*360 = 240)
      const center = mapNormalizedToCanvas({ x: 0.5, y: 0.5 }, mapping);
      expect(center.x).toBeCloseTo(320, 2);
      expect(center.y).toBeCloseTo(240, 2);
    });

    it('computes exact offsets for 16:9 video contained in 4:3 canvas (mirrored)', () => {
      const mapping = computeCoordinateMapping({
        videoWidth: 1280,
        videoHeight: 720,
        canvasWidth: 640,
        canvasHeight: 480,
        fitMode: 'contain',
        mirrored: true,
      });

      // Left eye in normalized coords (0.3, 0.4) -> mirrored should flip X: 1.0 - 0.3 = 0.7
      const leftPt = mapNormalizedToCanvas({ x: 0.3, y: 0.4 }, mapping);
      expect(leftPt.x).toBeCloseTo(0.7 * 640, 2);
      expect(leftPt.y).toBeCloseTo(60 + 0.4 * 360, 2);

      // Symmetrical pair check
      const rightPt = mapNormalizedToCanvas({ x: 0.7, y: 0.4 }, mapping);
      expect(rightPt.x).toBeCloseTo(0.3 * 640, 2);
    });

    it('computes horizontal letterbox (pillarbox) for 4:3 video contained in 16:9 canvas', () => {
      // Video 640x480 (4:3), Canvas 1280x720 (16:9)
      // Fit mode 'contain': scale = 720 / 480 = 1.5. destH = 720, destW = 960.
      // Horizontal pillarbox: offsetX = (1280 - 960) / 2 = 160px.
      const mapping = computeCoordinateMapping({
        videoWidth: 640,
        videoHeight: 480,
        canvasWidth: 1280,
        canvasHeight: 720,
        fitMode: 'contain',
        mirrored: false,
      });

      expect(mapping.offsetX).toBe(160);
      expect(mapping.offsetY).toBe(0);
      expect(mapping.scaleX).toBeCloseTo(1.5, 5);

      const center = mapNormalizedToCanvas({ x: 0.5, y: 0.5 }, mapping);
      expect(center.x).toBeCloseTo(640, 2);
      expect(center.y).toBeCloseTo(360, 2);
    });

    it('handles batch mapping via mapNormalizedPointsToCanvas', () => {
      const mapping = computeCoordinateMapping({
        videoWidth: 640,
        videoHeight: 480,
        canvasWidth: 640,
        canvasHeight: 480,
        fitMode: 'contain',
        mirrored: false,
      });

      const pts = [
        { x: 0.0, y: 0.0 },
        { x: 0.5, y: 0.5 },
        { x: 1.0, y: 1.0 },
      ];
      const mapped = mapNormalizedPointsToCanvas(pts, mapping);
      expect(mapped[0]).toEqual({ x: 0, y: 0 });
      expect(mapped[1]).toEqual({ x: 320, y: 240 });
      expect(mapped[2]).toEqual({ x: 640, y: 480 });
    });
  });

  describe('Device Profile & Online Empirical Calibration', () => {
    it('detects a valid device profile with explainable thresholds', () => {
      const profile = detectDeviceProfile();
      expect(['HIGH', 'MID', 'LOW']).toContain(profile.cpuTier);
      expect(['desktop', 'tablet', 'mobile']).toContain(profile.deviceClass);
      expect(profile.baselineThresholds.minApplyNcc).toBeGreaterThanOrEqual(0.68);
      expect(profile.baselineThresholds.minApplyNcc).toBeLessThanOrEqual(0.80);

      // Adaptive calculation scaling with face box size
      const thresholds = profile.computeAdaptiveThresholds({ width: 200, height: 250 }, 640, 480);
      expect(thresholds.faceScaleFactor).toBeGreaterThan(0.5);
      expect(thresholds.maxMahalanobisDelta).toBeGreaterThanOrEqual(0.03);
      expect(thresholds.maxMahalanobisDelta).toBeLessThanOrEqual(0.10);
    });

    it('empirically adjusts NCC threshold based on rolling window IQR', () => {
      const estimator = new OnlineCalibrationEstimator(30);
      expect(estimator.getEmpiricalThreshold(0.75)).toBe(0.75); // <10 samples fallback

      // Feed 20 samples around 0.85 with small IQR
      for (let i = 0; i < 20; i++) {
        estimator.addSample(0.82 + (i % 5) * 0.01);
      }
      const empirical = estimator.getEmpiricalThreshold(0.75);
      expect(empirical).toBeGreaterThanOrEqual(0.75);
      expect(empirical).toBeLessThanOrEqual(0.85);
    });
  });
});
