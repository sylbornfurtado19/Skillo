// ── L2CS-Net Gaze Estimation Types (Abdelrahman et al., CVPR 2023) ───────────

/** Continuous 3D gaze angles predicted by soft-argmax expectation over bins */
export interface GazeAngle3D {
  pitchDegrees: number; // -90.0 to +90.0
  yawDegrees: number;   // -90.0 to +90.0
  rollDegrees?: number; // optional in-plane rotation
}

/** Per-frame gaze result from the L2CS-Net engine */
export interface GazeFrameResult {
  frameTimestampMs: number;
  gazeAngles: GazeAngle3D;
  isEyeContact: boolean;
  screenFocusZone:
    | 'CENTER_SCREEN'
    | 'LOOKING_LEFT'
    | 'LOOKING_RIGHT'
    | 'LOOKING_UP'
    | 'LOOKING_DOWN'
    | 'OFF_SCREEN';
  confidenceScore: number; // 0.0 to 1.0
}

/** A period of sustained gaze deviation beyond the distraction threshold */
export interface DistractionEvent {
  startTimeMs: number;
  endTimeMs: number;
  durationSeconds: number;
  direction: 'LOOKING_LEFT' | 'LOOKING_RIGHT' | 'LOOKING_DOWN' | 'OFF_SCREEN';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export type ExecutionMode = 'VERIFIED_MODEL' | 'ESTIMATED_FALLBACK';

/** Session-level aggregated eye contact metrics returned by the gaze engine */
export interface EyeContactSessionMetrics {
  executionMode?: ExecutionMode;
  totalVideoDurationSeconds: number;
  eyeContactPercentage: number;    // 0.0 to 100.0%
  averagePitch: number;
  averageYaw: number;
  focusStabilityScore: number;     // 0.0 to 100.0%
  distractionEvents: DistractionEvent[];
  gazeFrames: GazeFrameResult[];
}

/**
 * Input frame accepted by the L2CS-Net engine.
 * Either raw logit distributions (for soft-argmax) or pre-computed angles.
 */
export interface GazeFrameInput {
  /** Timestamp of this frame in the session video (ms) */
  timestampMs: number;
  /**
   * Raw classification logits over N angle bins for Pitch.
   * If omitted, pitchDegrees must be provided.
   */
  pitchLogits?: number[];
  /**
   * Raw classification logits over N angle bins for Yaw.
   * If omitted, yawDegrees must be provided.
   */
  yawLogits?: number[];
  /** Pre-computed pitch angle (degrees). Used as passthrough if logits absent. */
  pitchDegrees?: number;
  /** Pre-computed yaw angle (degrees). Used as passthrough if logits absent. */
  yawDegrees?: number;
  /** Model confidence for this frame (0.0–1.0). Defaults to 0.8 if omitted. */
  confidence?: number;
}
