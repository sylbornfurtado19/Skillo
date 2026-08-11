/**
 * HopeNet 3D Head Pose & Gesture Motion Tracking Engine
 * Research Foundation: Fine-Grained Head Pose Estimation Without Keypoints (Ruiz et al., CVPR 2018)
 *
 * Implements:
 * 1. Continuous 3D Euler angle predictions (Yaw, Pitch, Roll) via Soft-Argmax expectation over discretized bins.
 * 2. Instantaneous angular velocity computation: ω = sqrt( (dθy/dt)^2 + (dθp/dt)^2 + (dθr/dt)^2 ).
 * 3. Temporal gesture recognition over rolling frame windows: Nodding, Head Shaking, Excessive Motion, Posture Slump.
 * 4. Posture Composure Score & Restlessness Index aggregation into HeadPoseSessionMetrics.
 */

import type {
  EulerAngles3D,
  HeadPoseFrameResult,
  HeadPoseFrameInput,
  GesturalEvent,
  HeadPoseSessionMetrics,
} from '@/types/index';

// ── HopeNet Angular Constants ──────────────────────────────────────────────────

/** Number of angle bins (N=90 → 2° per bin covering [-90°, +90°]) */
const N_BINS = 90;

/** Angle bin centers for N=90 bins over [-90°, +90°] */
const BIN_CENTERS: number[] = Array.from(
  { length: N_BINS },
  (_, i) => -90 + (i + 0.5) * (180 / N_BINS)
);

// ─────────────────────────────────────────────────────────────────────────────
// 1. SOFT-ARGMAX: Continuous Euler Angle Prediction
// ─────────────────────────────────────────────────────────────────────────────

function softmax(logits: number[]): number[] {
  if (logits.length === 0) return [];
  const maxLogit = Math.max(...logits);
  const exps = logits.map(z => Math.exp(z - maxLogit));
  const sumExp = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / sumExp);
}

export function softArgmaxAngle(logits: number[]): number {
  const padded =
    logits.length >= N_BINS
      ? logits.slice(0, N_BINS)
      : [...logits, ...new Array(N_BINS - logits.length).fill(0)];

  const probs = softmax(padded);
  const angle = probs.reduce((acc, p, i) => acc + p * BIN_CENTERS[i], 0);
  return Math.max(-90, Math.min(90, angle));
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. FRAME-LEVEL POSE & VELOCITY COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────

export function processPoseFrame(
  input: HeadPoseFrameInput,
  prevFrame?: HeadPoseFrameResult
): HeadPoseFrameResult {
  const yaw = input.yawLogits?.length
    ? softArgmaxAngle(input.yawLogits)
    : input.yawDegrees ?? 0;

  const pitch = input.pitchLogits?.length
    ? softArgmaxAngle(input.pitchLogits)
    : input.pitchDegrees ?? 0;

  const roll = input.rollLogits?.length
    ? softArgmaxAngle(input.rollLogits)
    : input.rollDegrees ?? 0;

  const angles: EulerAngles3D = {
    yawDegrees: Math.round(yaw * 100) / 100,
    pitchDegrees: Math.round(pitch * 100) / 100,
    rollDegrees: Math.round(roll * 100) / 100,
  };

  let angularVelocity = 0;
  if (prevFrame) {
    const dtSeconds = Math.max(0.01, (input.timestampMs - prevFrame.frameTimestampMs) / 1000);
    const dYaw = (angles.yawDegrees - prevFrame.angles.yawDegrees) / dtSeconds;
    const dPitch = (angles.pitchDegrees - prevFrame.angles.pitchDegrees) / dtSeconds;
    const dRoll = (angles.rollDegrees - prevFrame.angles.rollDegrees) / dtSeconds;

    angularVelocity = Math.round(Math.sqrt(dYaw * dYaw + dPitch * dPitch + dRoll * dRoll) * 100) / 100;
  }

  let detectedGesture: HeadPoseFrameResult['detectedGesture'] = 'STATIC_COMPOSURE';
  if (angularVelocity > 60) {
    detectedGesture = 'EXCESSIVE_MOTION';
  }

  return {
    frameTimestampMs: input.timestampMs,
    angles,
    angularVelocity,
    detectedGesture,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. TEMPORAL GESTURE CLASSIFICATION & EVENT DETECTION
// ─────────────────────────────────────────────────────────────────────────────

export function analyzeGesturalEvents(frames: HeadPoseFrameResult[]): {
  events: GesturalEvent[];
  nodCount: number;
  headShakeCount: number;
  frameTrace: HeadPoseFrameResult[];
} {
  if (frames.length < 3) {
    return { events: [], nodCount: 0, headShakeCount: 0, frameTrace: frames };
  }




  const events: GesturalEvent[] = [];
  const updatedTrace = [...frames];
  let nodCount = 0;
  let headShakeCount = 0;

  // Windowed analysis for cyclic oscillations
  let i = 0;
  while (i < frames.length - 2) {
    const startFrame = frames[i];

    // Check for Nodding (Pitch oscillations: deltaPitch >= 6 deg within 250ms - 800ms)
    let peakPitch = startFrame.angles.pitchDegrees;
    let troughPitch = startFrame.angles.pitchDegrees;
    let peakIdx = i;

    for (let j = i + 1; j < Math.min(i + 15, frames.length); j++) {
      const dt = (frames[j].frameTimestampMs - startFrame.frameTimestampMs) / 1000;
      if (dt > 1.2) break;

      const p = frames[j].angles.pitchDegrees;
      if (Math.abs(p - startFrame.angles.pitchDegrees) > Math.abs(peakPitch - startFrame.angles.pitchDegrees)) {
        peakPitch = p;
        peakIdx = j;
      }
    }

    const pitchDelta = Math.abs(peakPitch - startFrame.angles.pitchDegrees);
    const nodDt = peakIdx > i ? (frames[peakIdx].frameTimestampMs - startFrame.frameTimestampMs) / 1000 : 0;

    if (pitchDelta >= 6 && nodDt >= 0.25 && nodDt <= 0.8) {
      nodCount++;
      const endMs = frames[peakIdx].frameTimestampMs;
      events.push({
        startTimeMs: startFrame.frameTimestampMs,
        endTimeMs: endMs,
        gestureType: 'NODDING',
        durationSeconds: Math.round(nodDt * 100) / 100,
        intensity: pitchDelta > 12 ? 'HIGH' : pitchDelta > 8 ? 'MEDIUM' : 'LOW',
      });

      for (let k = i; k <= peakIdx; k++) {
        updatedTrace[k].detectedGesture = 'NODDING';
      }
      i = peakIdx + 1;
      continue;
    }

    // Check for Head Shaking (Yaw oscillations: deltaYaw >= 8 deg within 250ms - 800ms)
    let peakYaw = startFrame.angles.yawDegrees;
    let yawIdx = i;

    for (let j = i + 1; j < Math.min(i + 15, frames.length); j++) {
      const dt = (frames[j].frameTimestampMs - startFrame.frameTimestampMs) / 1000;
      if (dt > 1.2) break;

      const y = frames[j].angles.yawDegrees;
      if (Math.abs(y - startFrame.angles.yawDegrees) > Math.abs(peakYaw - startFrame.angles.yawDegrees)) {
        peakYaw = y;
        yawIdx = j;
      }
    }

    const yawDelta = Math.abs(peakYaw - startFrame.angles.yawDegrees);
    const shakeDt = yawIdx > i ? (frames[yawIdx].frameTimestampMs - startFrame.frameTimestampMs) / 1000 : 0;

    if (yawDelta >= 8 && shakeDt >= 0.25 && shakeDt <= 0.8) {

      headShakeCount++;
      const endMs = frames[yawIdx].frameTimestampMs;
      events.push({
        startTimeMs: startFrame.frameTimestampMs,
        endTimeMs: endMs,
        gestureType: 'HEAD_SHAKING',
        durationSeconds: Math.round(shakeDt * 100) / 100,
        intensity: yawDelta > 15 ? 'HIGH' : yawDelta > 10 ? 'MEDIUM' : 'LOW',
      });

      for (let k = i; k <= yawIdx; k++) {
        updatedTrace[k].detectedGesture = 'HEAD_SHAKING';
      }
      i = yawIdx + 1;
      continue;
    }

    // Check for Posture Slump (Sustained downward pitch < -15 deg for > 1.5s)
    if (startFrame.angles.pitchDegrees < -15) {
      let slumpEndIdx = i;
      for (let j = i + 1; j < frames.length; j++) {
        if (frames[j].angles.pitchDegrees < -12) {
          slumpEndIdx = j;
        } else {
          break;
        }
      }
      const slumpDuration = (frames[slumpEndIdx].frameTimestampMs - startFrame.frameTimestampMs) / 1000;
      if (slumpDuration >= 1.2) {
        events.push({
          startTimeMs: startFrame.frameTimestampMs,
          endTimeMs: frames[slumpEndIdx].frameTimestampMs,
          gestureType: 'POSTURE_SLUMP',
          durationSeconds: Math.round(slumpDuration * 100) / 100,
          intensity: slumpDuration > 3 ? 'HIGH' : 'MEDIUM',
        });
        i = slumpEndIdx + 1;
        continue;
      }
    }

    i++;
  }

  return {
    events,
    nodCount,
    headShakeCount,
    frameTrace: updatedTrace,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. MAIN PUBLIC API: SESSION AGGREGATION
// ─────────────────────────────────────────────────────────────────────────────

export function analyzeHeadPoseAndGestures(
  inputs: HeadPoseFrameInput[]
): HeadPoseSessionMetrics {
  if (!inputs || inputs.length === 0) {
    return {
      totalFramesAnalyzed: 0,
      averageYaw: 0,
      averagePitch: 0,
      averageRoll: 0,
      postureComposureScore: 100,
      nodCount: 0,
      headShakeCount: 0,
      restlessnessIndex: 0,
      gesturalEvents: [],
      frameTrace: [],
    };
  }

  // Sort by timestamp
  const sorted = [...inputs].sort((a, b) => a.timestampMs - b.timestampMs);

  // Compute frame trace
  const rawTrace: HeadPoseFrameResult[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const frame = processPoseFrame(sorted[i], rawTrace[i - 1]);
    rawTrace.push(frame);
  }

  // Temporal gestural analysis
  const { events, nodCount, headShakeCount, frameTrace } = analyzeGesturalEvents(rawTrace);

  // Averages
  const total = frameTrace.length;
  const avgYaw = Math.round((frameTrace.reduce((s, f) => s + f.angles.yawDegrees, 0) / total) * 100) / 100;
  const avgPitch = Math.round((frameTrace.reduce((s, f) => s + f.angles.pitchDegrees, 0) / total) * 100) / 100;
  const avgRoll = Math.round((frameTrace.reduce((s, f) => s + f.angles.rollDegrees, 0) / total) * 100) / 100;

  // Restlessness & Composure calculation based on average angular velocity
  const avgVelocity = frameTrace.reduce((s, f) => s + f.angularVelocity, 0) / total;
  // Angular velocity > 45 deg/s maps to high restlessness
  const restlessnessIndex = Math.min(100, Math.max(0, Math.round((avgVelocity / 45) * 100 * 10) / 10));
  const postureComposureScore = Math.max(0, Math.min(100, Math.round((100 - restlessnessIndex * 0.75) * 10) / 10));

  return {
    totalFramesAnalyzed: total,
    averageYaw: avgYaw,
    averagePitch: avgPitch,
    averageRoll: avgRoll,
    postureComposureScore,
    nodCount,
    headShakeCount,
    restlessnessIndex,
    gesturalEvents: events,
    frameTrace,
  };
}
