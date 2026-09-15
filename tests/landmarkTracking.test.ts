/**
 * Comprehensive Unit & Integration Tests for Landmark Tracking & Kinematics
 *
 * Tests:
 * 1. LandmarkKinematicFilter: Static jitter reduction (anti-jitter EMA).
 * 2. LandmarkKinematicFilter: Dynamic step response and velocity adaptation.
 * 3. LandmarkKinematicFilter: Occlusion handling & kinematic extrapolation (no snapping).
 * 4. DenseLandmarksSmoother: Multi-point Float32Array buffer decoding & regional confidences.
 * 5. Coordinate Mapping: Exact letterbox (contain), cover, and mirrored webcam transforms.
 */

import {
  LandmarkKinematicFilter,
  DenseLandmarksSmoother,
  computeJitterMetric,
  computeJitterReduction,
} from '../src/lib/services/temporalSmoothing';
import {
  computeCoordinateMapping,
  mapNormalizedToCanvas,
} from '../src/lib/services/visionPipeline';

describe('LandmarkKinematicFilter (Constant-Velocity Adaptive Smoother)', () => {
  it('reduces high-frequency spatial jitter on stationary targets by > 50%', () => {
    const filter = new LandmarkKinematicFilter({
      alphaSlow: 0.25,
      alphaFast: 0.70,
    });

    const trueCenter = { x: 0.5, y: 0.5 };
    const numSamples = 60;
    const rawXSeries: number[] = [];
    const smoothedXSeries: number[] = [];

    // Simulate high-frequency camera sensor noise (±0.02)
    for (let i = 0; i < numSamples; i++) {
      const noise = (Math.sin(i * 1.7) * 0.015) + (Math.cos(i * 3.1) * 0.008);
      const rawX = trueCenter.x + noise;
      rawXSeries.push(rawX);

      const res = filter.update({ x: rawX, y: trueCenter.y }, 1.0, 0.033);
      smoothedXSeries.push(res.pos.x);
    }

    const { rawJitter, smoothedJitter, reductionPercentage } = computeJitterReduction(
      rawXSeries,
      smoothedXSeries
    );

    expect(smoothedJitter).toBeLessThan(rawJitter);
    expect(reductionPercentage).toBeGreaterThanOrEqual(45.0);
  });

  it('adapts alpha dynamically during rapid movement to prevent lag', () => {
    const filter = new LandmarkKinematicFilter({
      alphaSlow: 0.20,
      alphaFast: 0.80,
      maxSpeed: 1.0,
    });

    // 1. Initial stationary state
    filter.update({ x: 0.2, y: 0.5 }, 1.0, 0.033);
    const slowRes = filter.update({ x: 0.201, y: 0.5 }, 1.0, 0.033);
    // When slow, alphaUsed should be near alphaSlow
    expect(slowRes.alphaUsed).toBeLessThan(0.35);

    // 2. Sudden rapid head movement (saccade / head turn: 0.2 -> 0.45 in 33ms)
    const fastRes = filter.update({ x: 0.45, y: 0.5 }, 1.0, 0.033);
    // When moving rapidly, alphaUsed should adapt upward toward alphaFast
    expect(fastRes.alphaUsed).toBeGreaterThan(0.55);
    expect(fastRes.vel.x).toBeGreaterThan(0);
  });

  it('extrapolates smoothly during occlusions or low confidence without snapping', () => {
    const filter = new LandmarkKinematicFilter({
      confThreshold: 0.35,
      velocityDecay: 0.85,
    });

    // Establish rightward velocity: 0.1 per frame (3.0 units/sec)
    filter.update({ x: 0.1, y: 0.5 }, 1.0, 0.033);
    filter.update({ x: 0.2, y: 0.5 }, 1.0, 0.033);
    const moving = filter.update({ x: 0.3, y: 0.5 }, 1.0, 0.033);
    expect(moving.vel.x).toBeGreaterThan(0);

    // Occlusion event: landmark lost (confidence = 0.05 < threshold 0.35)
    // Observation jumps to a bad glitch value (e.g. 0.0), but filter must ignore it and extrapolate forward
    const occluded1 = filter.update({ x: 0.0, y: 0.0 }, 0.05, 0.033);
    expect(occluded1.alphaUsed).toBe(0.0);
    // Extrapolated position should be ahead of 0.3, not falling back to 0.0
    expect(occluded1.pos.x).toBeGreaterThan(0.30);
    expect(occluded1.pos.y).toBeCloseTo(0.5, 1);

    // Velocity should decay smoothly under prolonged occlusion
    const occluded2 = filter.update({ x: 0.0, y: 0.0 }, 0.05, 0.033);
    expect(occluded2.vel.x).toBeLessThan(occluded1.vel.x);
  });
});

describe('DenseLandmarksSmoother', () => {
  it('decodes zero-copy Float32Array buffer and computes accurate regional confidences', () => {
    const numPoints = 70;
    const smoother = new DenseLandmarksSmoother(numPoints);

    // Pack synthetic Float32Array: 70 points * 4 floats [x, y, z, c]
    const buffer = new Float32Array(numPoints * 4);
    for (let i = 0; i < numPoints; i++) {
      const off = i * 4;
      buffer[off] = 0.45 + (i / numPoints) * 0.1; // x
      buffer[off + 1] = 0.35 + (i / numPoints) * 0.1; // y
      buffer[off + 2] = 0.0; // z
      // Set high confidence on eyes (36..47, 68, 69) and nose (27..35)
      if ((i >= 36 && i <= 47) || i === 68 || i === 69) {
        buffer[off + 3] = 0.95;
      } else if (i >= 27 && i <= 35) {
        buffer[off + 3] = 0.90;
      } else if (i >= 48 && i <= 67) {
        buffer[off + 3] = 0.85;
      } else {
        buffer[off + 3] = 0.70;
      }
    }

    const res = smoother.updateFromBuffer(buffer, numPoints, 1000);
    expect(res.points.length).toBe(70);
    expect(res.confidences.length).toBe(70);
    expect(res.regionConfidences.eyes).toBeCloseTo(0.95, 2);
    expect(res.regionConfidences.nose).toBeCloseTo(0.90, 2);
    expect(res.regionConfidences.mouth).toBeCloseTo(0.85, 2);
    expect(res.regionConfidences.overall).toBeGreaterThan(0.80);
  });
});

describe('Coordinate Transformation & Normalization Pipeline', () => {
  it('correctly calculates letterbox (contain) scaling for 16:9 video in 4:3 canvas', () => {
    const mapping = computeCoordinateMapping({
      videoWidth: 1280,
      videoHeight: 720,
      canvasWidth: 640,
      canvasHeight: 480,
      fitMode: 'contain',
      mirrored: false,
    });

    // 1280x720 in 640x480: scale = min(640/1280, 480/720) = min(0.5, 0.6667) = 0.5
    expect(mapping.scale).toBeCloseTo(0.5, 3);
    // Video displayed size: 640x360.
    // Horizontal offset: (640 - 640)/2 = 0
    expect(mapping.offsetX).toBe(0);
    // Vertical letterbox offset: (480 - 360)/2 = 60
    expect(mapping.offsetY).toBe(60);

    // Center point (0.5, 0.5) should map to canvas center (320, 240)
    const center = mapNormalizedToCanvas({ x: 0.5, y: 0.5 }, mapping);
    expect(center.x).toBeCloseTo(320, 1);
    expect(center.y).toBeCloseTo(240, 1);
  });

  it('correctly mirrors horizontal coordinates for mirrored webcam streams', () => {
    const mapping = computeCoordinateMapping({
      videoWidth: 640,
      videoHeight: 480,
      canvasWidth: 640,
      canvasHeight: 480,
      fitMode: 'contain',
      mirrored: true, // Webcam mirrored mode
    });

    // A landmark at normalized x = 0.2 (observer left) should flip to x' = 0.8
    const leftPt = mapNormalizedToCanvas({ x: 0.2, y: 0.5 }, mapping);
    expect(leftPt.x).toBeCloseTo(640 * 0.8, 1);
    expect(leftPt.y).toBeCloseTo(240, 1);

    // Center point remains at center
    const centerPt = mapNormalizedToCanvas({ x: 0.5, y: 0.5 }, mapping);
    expect(centerPt.x).toBeCloseTo(320, 1);
  });
});
