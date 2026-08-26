/**
 * L2CS-Net Real-Time 3D Gaze Estimation & Eye Contact Tracking Engine
 * Research Foundation: L2CS-Net: Fine-Grained Gaze Estimation in the Wild using
 * Data-Driven Continuous Binning (Abdelrahman et al., CVPR 2023)
 *
 * Implements:
 * 1. Continuous angle prediction via soft-argmax expectation over N discretized bins
 * 2. 3D gaze vector computation: v = [sin(yaw)cos(pitch), sin(pitch), cos(yaw)cos(pitch)]
 * 3. Eye contact zone classification with configurable angular thresholds
 * 4. Sustained distraction event detection (>1.5s consecutive off-screen gaze)
 * 5. Session-level metric aggregation into EyeContactSessionMetrics
 */

import type {
  GazeAngle3D,
  GazeFrameResult,
  GazeFrameInput,
  DistractionEvent,
  EyeContactSessionMetrics,
} from '@/types/index';

// ── L2CS-Net Angular Constants ────────────────────────────────────────────────

/** Number of angle bins (N=90 → 2° per bin covering [-90°, +90°]) */
const N_BINS = 90;

/**
 * Angle bin centers for N=90 bins over [-90°, +90°].
 * bin_i = -90 + (i + 0.5) * (180 / N_BINS)
 */
const BIN_CENTERS: number[] = Array.from(
  { length: N_BINS },
  (_, i) => -90 + (i + 0.5) * (180 / N_BINS)
);

// ── Eye Contact Thresholds ────────────────────────────────────────────────────

/** Maximum pitch deviation (°) for CENTER_SCREEN classification */
const EYE_CONTACT_PITCH_THRESHOLD_DEG = 12;
/** Maximum yaw deviation (°) for CENTER_SCREEN classification */
const EYE_CONTACT_YAW_THRESHOLD_DEG = 15;

/**
 * Assumed camera-calibrated screen center angles.
 * θ_center,p = 0° (camera level), θ_center,y = 0° (facing screen directly).
 */
const CENTER_PITCH_DEG = 0;
const CENTER_YAW_DEG = 0;

/** Duration threshold (ms) for flagging a sustained distraction event */
const DISTRACTION_THRESHOLD_MS = 1500;

// ── Radians Conversion ────────────────────────────────────────────────────────

const DEG_TO_RAD = Math.PI / 180;

// ─────────────────────────────────────────────────────────────────────────────
// 1. SOFT-ARGMAX: Continuous Angle Prediction via Expectation Over Bins
// θ̂ = Σ_i p_i · bin_i   where   p_i = exp(z_i) / Σ_j exp(z_j)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes softmax probability distribution over logits.
 * Uses the numerically-stable log-sum-exp trick:
 * p_i = exp(z_i - max(z)) / Σ_j exp(z_j - max(z))
 */
function softmax(logits: number[]): number[] {
  if (logits.length === 0) return [];
  const maxLogit = Math.max(...logits);
  const exps = logits.map(z => Math.exp(z - maxLogit));
  const sumExp = exps.reduce((a, b) => a + b, 0);
  if (sumExp === 0 || !Number.isFinite(sumExp)) {
    return new Array(logits.length).fill(1 / logits.length);
  }
  return exps.map(e => e / sumExp);
}

/**
 * Soft-Argmax expectation over N discretized angle bins.
 * Converts a raw classification logit distribution into a continuous angle (°).
 *
 * θ̂ = Σ_{i=1}^{N} p_i · bin_i
 *
 * @param logits  Raw model output logits (length N). If fewer than N provided,
 *                they are zero-padded to length N_BINS.
 * @returns       Predicted continuous angle in degrees, clamped to [-90°, +90°].
 */
export function softArgmax(logits: number[]): number {
  // Pad or truncate to N_BINS
  const paddedLogits =
    logits.length >= N_BINS
      ? logits.slice(0, N_BINS)
      : [...logits, ...new Array(N_BINS - logits.length).fill(0)];

  const probs = softmax(paddedLogits);
  const angle = probs.reduce((acc, p, i) => acc + p * BIN_CENTERS[i], 0);

  // Clamp to valid angular range
  return Math.max(-90, Math.min(90, angle));
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. 3D GAZE VECTOR COMPUTATION
// v_gaze = [sin(θ_y)cos(θ_p), sin(θ_p), cos(θ_y)cos(θ_p)]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the normalized 3D gaze origin vector from pitch and yaw angles.
 * Standard spherical coordinate convention: x=right, y=up, z=forward.
 *
 * @returns [vx, vy, vz] normalized unit vector
 */
export function computeGazeVector(
  pitchDeg: number,
  yawDeg: number
): [number, number, number] {
  const p = pitchDeg * DEG_TO_RAD;
  const y = yawDeg * DEG_TO_RAD;

  const vx = Math.sin(y) * Math.cos(p);
  const vy = Math.sin(p);
  const vz = Math.cos(y) * Math.cos(p);

  return [vx, vy, vz];
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. EYE CONTACT & SCREEN FOCUS ZONE CLASSIFICATION
// isEyeContact = |θ_p - θ_center,p| ≤ 12° AND |θ_y - θ_center,y| ≤ 15°
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluates direct eye contact against the angular threshold criteria.
 * Returns true if both pitch and yaw deviate within the defined thresholds.
 */
export function evaluateEyeContact(pitchDeg: number, yawDeg: number): boolean {
  const pitchDeviation = Math.abs(pitchDeg - CENTER_PITCH_DEG);
  const yawDeviation = Math.abs(yawDeg - CENTER_YAW_DEG);
  return (
    pitchDeviation <= EYE_CONTACT_PITCH_THRESHOLD_DEG &&
    yawDeviation <= EYE_CONTACT_YAW_THRESHOLD_DEG
  );
}

/**
 * Classifies the screen focus zone based on pitch and yaw angles.
 * Returns one of 6 mutually exclusive zones.
 */
export function classifyFocusZone(
  pitchDeg: number,
  yawDeg: number
): GazeFrameResult['screenFocusZone'] {
  // Direct center — most restrictive check first
  if (evaluateEyeContact(pitchDeg, yawDeg)) {
    return 'CENTER_SCREEN';
  }

  const pitchDeviation = Math.abs(pitchDeg - CENTER_PITCH_DEG);
  const yawDeviation = Math.abs(yawDeg - CENTER_YAW_DEG);

  // Dominant vertical gaze deviation
  if (pitchDeviation > EYE_CONTACT_PITCH_THRESHOLD_DEG) {
    if (pitchDeg - CENTER_PITCH_DEG > 0) {
      return pitchDeviation > 35 ? 'OFF_SCREEN' : 'LOOKING_UP';
    } else {
      return pitchDeviation > 35 ? 'OFF_SCREEN' : 'LOOKING_DOWN';
    }
  }

  // Dominant horizontal gaze deviation
  if (yawDeg - CENTER_YAW_DEG < 0) {
    return yawDeviation > 40 ? 'OFF_SCREEN' : 'LOOKING_LEFT';
  } else {
    return yawDeviation > 40 ? 'OFF_SCREEN' : 'LOOKING_RIGHT';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. FRAME-LEVEL GAZE RESULT COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a raw GazeFrameInput into a fully evaluated GazeFrameResult.
 * Accepts either raw logit arrays (soft-argmax path) or pre-computed angles.
 */
export function processGazeFrame(input: GazeFrameInput): GazeFrameResult {
  // Resolve pitch angle: logits → soft-argmax OR direct passthrough
  let pitchDeg: number;
  let yawDeg: number;

  if (input.pitchLogits && input.pitchLogits.length > 0) {
    pitchDeg = softArgmax(input.pitchLogits);
  } else {
    pitchDeg = input.pitchDegrees ?? 0;
  }

  if (input.yawLogits && input.yawLogits.length > 0) {
    yawDeg = softArgmax(input.yawLogits);
  } else {
    yawDeg = input.yawDegrees ?? 0;
  }

  const gazeAngles: GazeAngle3D = {
    pitchDegrees: Math.round(pitchDeg * 100) / 100,
    yawDegrees: Math.round(yawDeg * 100) / 100,
  };

  const isEyeContact = evaluateEyeContact(pitchDeg, yawDeg);
  const screenFocusZone = classifyFocusZone(pitchDeg, yawDeg);
  const confidenceScore = Math.min(1, Math.max(0, input.confidence ?? 0.8));

  return {
    frameTimestampMs: input.timestampMs,
    gazeAngles,
    isEyeContact,
    screenFocusZone,
    confidenceScore,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. DISTRACTION EVENT DETECTION
// Flag sustained off-screen deviations > DISTRACTION_THRESHOLD_MS (1500ms)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detects sustained distraction events from a sorted array of GazeFrameResults.
 * A distraction event is recorded when the candidate maintains a non-CENTER_SCREEN
 * zone continuously for more than 1.5 seconds.
 *
 * Distraction severity:
 * - HIGH: duration > 4s
 * - MEDIUM: 2s < duration ≤ 4s
 * - LOW: 1.5s < duration ≤ 2s
 */
export function detectDistractionEvents(
  frames: GazeFrameResult[]
): DistractionEvent[] {
  if (frames.length === 0) return [];

  const events: DistractionEvent[] = [];

  // Sort frames by timestamp (defensive)
  const sorted = [...frames].sort((a, b) => a.frameTimestampMs - b.frameTimestampMs);

  let distractionStart: number | null = null;
  let distractionZone: GazeFrameResult['screenFocusZone'] | null = null;
  let previousTimestampMs = sorted[0].frameTimestampMs;

  for (let i = 0; i < sorted.length; i++) {
    const frame = sorted[i];
    const isDistracted = !frame.isEyeContact && frame.screenFocusZone !== 'CENTER_SCREEN';

    if (isDistracted) {
      if (distractionStart === null) {
        // Begin a new distraction run
        distractionStart = frame.frameTimestampMs;
        distractionZone = frame.screenFocusZone;
      } else {
        // If zone changes during a run, close current and start new
        if (frame.screenFocusZone !== distractionZone) {
          const durationMs = previousTimestampMs - distractionStart;
          if (durationMs >= DISTRACTION_THRESHOLD_MS && distractionZone !== null) {
            events.push(
              buildDistractionEvent(distractionStart, previousTimestampMs, distractionZone)
            );
          }
          distractionStart = frame.frameTimestampMs;
          distractionZone = frame.screenFocusZone;
        }
      }
    } else {
      // Eye contact restored — close any open distraction run
      if (distractionStart !== null && distractionZone !== null) {
        const durationMs = previousTimestampMs - distractionStart;
        if (durationMs >= DISTRACTION_THRESHOLD_MS) {
          events.push(
            buildDistractionEvent(distractionStart, previousTimestampMs, distractionZone)
          );
        }
        distractionStart = null;
        distractionZone = null;
      }
    }

    previousTimestampMs = frame.frameTimestampMs;
  }

  // Close any trailing open distraction
  if (distractionStart !== null && distractionZone !== null) {
    const durationMs = previousTimestampMs - distractionStart;
    if (durationMs >= DISTRACTION_THRESHOLD_MS) {
      events.push(
        buildDistractionEvent(distractionStart, previousTimestampMs, distractionZone)
      );
    }
  }

  return events;
}

function buildDistractionEvent(
  startMs: number,
  endMs: number,
  zone: GazeFrameResult['screenFocusZone']
): DistractionEvent {
  const durationSeconds = (endMs - startMs) / 1000;

  let severity: DistractionEvent['severity'];
  if (durationSeconds > 4) {
    severity = 'HIGH';
  } else if (durationSeconds > 2) {
    severity = 'MEDIUM';
  } else {
    severity = 'LOW';
  }

  // Map zone to distraction direction (CENTER_SCREEN cannot appear here, but guard anyway)
  const direction: DistractionEvent['direction'] =
    zone === 'CENTER_SCREEN' || zone === 'LOOKING_UP'
      ? 'OFF_SCREEN'
      : (zone as DistractionEvent['direction']);

  return {
    startTimeMs: startMs,
    endTimeMs: endMs,
    durationSeconds: Math.round(durationSeconds * 100) / 100,
    direction,
    severity,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. FOCUS STABILITY SCORE
// Measures gaze consistency — lower variance in gaze angles → higher stability.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes a focus stability score (0–100%) from frame-level gaze angles.
 * Based on combined pitch + yaw standard deviation mapped to a 0–100 scale.
 *
 * stdDev = 0° → score = 100%, stdDev ≥ 45° → score ≈ 0%
 */
function computeFocusStabilityScore(frames: GazeFrameResult[]): number {
  if (frames.length < 2) return 85; // Insufficient data — conservative default

  const pitches = frames.map(f => f.gazeAngles.pitchDegrees);
  const yaws = frames.map(f => f.gazeAngles.yawDegrees);

  const meanPitch = pitches.reduce((a, b) => a + b, 0) / pitches.length;
  const meanYaw = yaws.reduce((a, b) => a + b, 0) / yaws.length;

  const pitchVar = pitches.reduce((s, p) => s + (p - meanPitch) ** 2, 0) / pitches.length;
  const yawVar = yaws.reduce((s, y) => s + (y - meanYaw) ** 2, 0) / yaws.length;

  const combinedStdDev = Math.sqrt((pitchVar + yawVar) / 2);

  // Map: stdDev 0° → 100%, 45° → 0%
  const stabilityScore = Math.max(0, Math.min(100, 100 - (combinedStdDev / 45) * 100));
  return Math.round(stabilityScore * 10) / 10;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. PUBLIC API — SESSION-LEVEL PROCESSING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Processes a batch of raw GazeFrameInput records from an interview session
 * into an aggregated EyeContactSessionMetrics result.
 *
 * Handles both raw logit input (soft-argmax path) and pre-computed angle input.
 * Safe to call with an empty array — returns meaningful zero-state metrics.
 */
export function processGazeFrames(
  frames: GazeFrameInput[]
): EyeContactSessionMetrics {
  // Empty input guard — return empty-state metrics
  if (!frames || frames.length === 0) {
    return {
      totalVideoDurationSeconds: 0,
      eyeContactPercentage: 0,
      averagePitch: 0,
      averageYaw: 0,
      focusStabilityScore: 100,
      distractionEvents: [],
      gazeFrames: [],
    };
  }


  // Sort by timestamp (defensive)
  const sortedInputs = [...frames].sort((a, b) => a.timestampMs - b.timestampMs);

  // Process each frame into a GazeFrameResult
  const gazeFrames: GazeFrameResult[] = sortedInputs.map(processGazeFrame);

  // Session duration from first to last frame timestamp
  const firstTs = sortedInputs[0].timestampMs;
  const lastTs = sortedInputs[sortedInputs.length - 1].timestampMs;
  const totalVideoDurationSeconds = (lastTs - firstTs) / 1000;

  // Eye contact percentage
  const eyeContactFrameCount = gazeFrames.filter(f => f.isEyeContact).length;
  const eyeContactPercentage =
    Math.round((eyeContactFrameCount / gazeFrames.length) * 1000) / 10; // 1dp

  // Average pitch and yaw across all frames
  const avgPitch =
    Math.round(
      (gazeFrames.reduce((s, f) => s + f.gazeAngles.pitchDegrees, 0) / gazeFrames.length) * 100
    ) / 100;
  const avgYaw =
    Math.round(
      (gazeFrames.reduce((s, f) => s + f.gazeAngles.yawDegrees, 0) / gazeFrames.length) * 100
    ) / 100;

  // Focus stability score
  const focusStabilityScore = computeFocusStabilityScore(gazeFrames);

  // Distraction events (>1.5s sustained off-center gaze)
  const distractionEvents = detectDistractionEvents(gazeFrames);

  return {
    totalVideoDurationSeconds: Math.round(totalVideoDurationSeconds * 100) / 100,
    eyeContactPercentage,
    averagePitch: avgPitch,
    averageYaw: avgYaw,
    focusStabilityScore,
    distractionEvents,
    gazeFrames,
  };
}
