import {
  DenseLandmarksSmoother,
  type Point2D,
} from '../src/lib/services/temporalSmoothing';

describe('DenseLandmarksSmoother Anti-Snap Re-Localization', () => {
  const createBuffer = (center: Point2D, confidence: number = 0.95): Float32Array => {
    const buf = new Float32Array(70 * 4);
    for (let i = 0; i < 70; i++) {
      // Points spread around center with consistent relative offsets to mimic a face
      const offsetX = ((i % 10) - 5) * 0.01;
      const offsetY = (Math.floor(i / 10) - 3.5) * 0.01;
      buf[i * 4] = center.x + offsetX;
      buf[i * 4 + 1] = center.y + offsetY;
      buf[i * 4 + 2] = 0;
      buf[i * 4 + 3] = confidence;
    }
    return buf;
  };

  it('triggers smooth anti-snap relocalization glide after sustained occlusion and large displacement', () => {
    const smoother = new DenseLandmarksSmoother(70, 'BALANCED');
    smoother.setRelocalizationConfig({
      threshold: 0.06,
      durationSec: 0.12, // 120ms
      minOcclusionSec: 0.30,
    });

    let time = 1000;

    // 1. Establish stable initial lock at (0.4, 0.4)
    const initialBuf = createBuffer({ x: 0.4, y: 0.4 }, 0.95);
    for (let i = 0; i < 15; i++) {
      smoother.updateFromBuffer(initialBuf, 70, time);
      time += 33;
    }
    expect(smoother.getIsRelocalizing()).toBe(false);

    // 2. Occlude face for 450ms (> 300ms minOcclusion)
    const occludedBuf = createBuffer({ x: 0.4, y: 0.4 }, 0.05);
    for (let i = 0; i < 15; i++) {
      smoother.updateFromBuffer(occludedBuf, 70, time);
      time += 30;
    }
    expect(smoother.getIsRelocalizing()).toBe(false);

    // 3. Face re-appears with large jump to (0.6, 0.6) - displacement ~0.28 > 0.06
    const reappearedBuf = createBuffer({ x: 0.6, y: 0.6 }, 0.95);
    const firstReappearRes = smoother.updateFromBuffer(reappearedBuf, 70, time);

    // Re-localization MUST be triggered!
    expect(smoother.getIsRelocalizing()).toBe(true);
    expect(firstReappearRes.isRelocalizing).toBe(true);
    expect(firstReappearRes.relocalizationProgress).toBeGreaterThanOrEqual(0);
    expect(firstReappearRes.relocalizationProgress).toBeLessThan(0.4);

    // Initial position on re-lock should NOT snap directly to 0.60
    const pt30Start = firstReappearRes.points[30]; // nose anchor
    expect(pt30Start.x).toBeLessThan(0.55);

    // 4. Progress glide through 60ms (midpoint of 120ms glide)
    time += 60;
    const midGlideRes = smoother.updateFromBuffer(reappearedBuf, 70, time);
    expect(smoother.getIsRelocalizing()).toBe(true);
    expect(midGlideRes.isRelocalizing).toBe(true);
    expect(midGlideRes.relocalizationProgress).toBeGreaterThan(0.3);
    expect(midGlideRes.relocalizationProgress).toBeLessThan(0.85);

    // Midpoint position should be between start (0.4) and target (0.6)
    const pt30Mid = midGlideRes.points[30];
    expect(pt30Mid.x).toBeGreaterThan(pt30Start.x);
    expect(pt30Mid.x).toBeLessThan(0.60);

    // 5. Complete glide after remaining 80ms (total 140ms > 120ms duration)
    time += 80;
    const finishedRes = smoother.updateFromBuffer(reappearedBuf, 70, time);
    expect(smoother.getIsRelocalizing()).toBe(false);
    expect(finishedRes.isRelocalizing).toBe(false);
    expect(finishedRes.relocalizationProgress).toBe(1.0);

    // Target locked onto new location
    const pt30Final = finishedRes.points[30];
    expect(pt30Final.x).toBeCloseTo(0.60, 1);
  });

  it('does NOT trigger relocalization during normal fast head movement without prior occlusion', () => {
    const smoother = new DenseLandmarksSmoother(70, 'BALANCED');
    smoother.setRelocalizationConfig({
      threshold: 0.06,
      durationSec: 0.12,
      minOcclusionSec: 0.30,
    });

    let time = 1000;

    // 1. Establish stable tracking at (0.4, 0.4)
    const buf1 = createBuffer({ x: 0.4, y: 0.4 }, 0.95);
    for (let i = 0; i < 10; i++) {
      smoother.updateFromBuffer(buf1, 70, time);
      time += 33;
    }

    // 2. High-speed displacement in adjacent frames while visible (occlusionDuration == 0)
    const fastMovedBuf = createBuffer({ x: 0.55, y: 0.55 }, 0.95); // jump > 0.06
    const fastMoveRes = smoother.updateFromBuffer(fastMovedBuf, 70, time);

    // Relocalization MUST NOT be triggered because face was never occluded
    expect(smoother.getIsRelocalizing()).toBe(false);
    expect(fastMoveRes.isRelocalizing).toBe(false);
  });

  it('does NOT trigger relocalization if displacement is below threshold', () => {
    const smoother = new DenseLandmarksSmoother(70, 'BALANCED');
    smoother.setRelocalizationConfig({
      threshold: 0.06,
      durationSec: 0.12,
      minOcclusionSec: 0.30,
    });

    let time = 1000;

    // 1. Establish initial lock at (0.5, 0.5)
    const buf1 = createBuffer({ x: 0.5, y: 0.5 }, 0.95);
    for (let i = 0; i < 10; i++) {
      smoother.updateFromBuffer(buf1, 70, time);
      time += 33;
    }

    // 2. Occlude for 500ms
    const occludedBuf = createBuffer({ x: 0.5, y: 0.5 }, 0.05);
    for (let i = 0; i < 16; i++) {
      smoother.updateFromBuffer(occludedBuf, 70, time);
      time += 33;
    }

    // 3. Reappear at virtually same spot (0.51, 0.51) - displacement 0.014 < 0.06
    const smallMoveBuf = createBuffer({ x: 0.51, y: 0.51 }, 0.95);
    const res = smoother.updateFromBuffer(smallMoveBuf, 70, time);

    expect(smoother.getIsRelocalizing()).toBe(false);
    expect(res.isRelocalizing).toBe(false);
  });

  it('allows dynamic reconfiguration of relocalization parameters', () => {
    const smoother = new DenseLandmarksSmoother(70, 'BALANCED');

    // Customize config to higher threshold
    smoother.setRelocalizationConfig({
      threshold: 0.15,
      durationSec: 0.20,
      minOcclusionSec: 0.50,
    });

    let time = 1000;
    const initialBuf = createBuffer({ x: 0.3, y: 0.3 }, 0.95);
    for (let i = 0; i < 10; i++) {
      smoother.updateFromBuffer(initialBuf, 70, time);
      time += 33;
    }

    // Occlude for only 350ms (< 500ms custom threshold)
    const occludedBuf = createBuffer({ x: 0.3, y: 0.3 }, 0.05);
    for (let i = 0; i < 10; i++) {
      smoother.updateFromBuffer(occludedBuf, 70, time);
      time += 35;
    }

    // Reappear at (0.42, 0.42) - jump is ~0.17 > 0.15, but occlusion was < 500ms
    const reappearBuf = createBuffer({ x: 0.42, y: 0.42 }, 0.95);
    const res = smoother.updateFromBuffer(reappearBuf, 70, time);

    expect(smoother.getIsRelocalizing()).toBe(false);
    expect(res.isRelocalizing).toBe(false);
  });

  it('maintains facial mesh shape coherence (no distorting drift) during global relocalization glide', () => {
    const smoother = new DenseLandmarksSmoother(70, 'BALANCED');
    smoother.setRelocalizationConfig({
      threshold: 0.06,
      durationSec: 0.12,
      minOcclusionSec: 0.30,
    });

    let time = 1000;
    const initialBuf = createBuffer({ x: 0.3, y: 0.3 }, 0.95);
    for (let i = 0; i < 10; i++) {
      smoother.updateFromBuffer(initialBuf, 70, time);
      time += 33;
    }

    // Occlude for 400ms
    const occludedBuf = createBuffer({ x: 0.3, y: 0.3 }, 0.05);
    for (let i = 0; i < 12; i++) {
      smoother.updateFromBuffer(occludedBuf, 70, time);
      time += 33;
    }

    // Reappear at (0.5, 0.5)
    const jumpBuf = createBuffer({ x: 0.5, y: 0.5 }, 0.95);
    const res1 = smoother.updateFromBuffer(jumpBuf, 70, time);
    expect(res1.isRelocalizing).toBe(true);

    // During glide, relative distance between left eye (point 36) and right eye (point 45)
    // should remain intact rather than stretching or distorting
    const leftEyeStart = res1.points[36];
    const rightEyeStart = res1.points[45];
    const initialInterOcularDist = Math.hypot(rightEyeStart.x - leftEyeStart.x, rightEyeStart.y - leftEyeStart.y);

    time += 50;
    const res2 = smoother.updateFromBuffer(jumpBuf, 70, time);
    const leftEyeMid = res2.points[36];
    const rightEyeMid = res2.points[45];
    const midInterOcularDist = Math.hypot(rightEyeMid.x - leftEyeMid.x, rightEyeMid.y - leftEyeMid.y);

    expect(Math.abs(midInterOcularDist - initialInterOcularDist)).toBeLessThan(0.02);
  });
});
