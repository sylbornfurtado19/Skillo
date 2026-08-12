// ── HopeNet 3D Head Pose & Gesture Tracking Types (Ruiz et al., CVPR 2018) ─────

/** Continuous 3D Euler rotation angles */
export interface EulerAngles3D {
  yawDegrees: number;   // -90.0 to +90.0 (Side turn)
  pitchDegrees: number; // -90.0 to +90.0 (Up/Down tilt)
  rollDegrees: number;  // -90.0 to +90.0 (Side tilt)
}

/** Per-frame head pose classification and angular velocity */
export interface HeadPoseFrameResult {
  frameTimestampMs: number;
  angles: EulerAngles3D;
  angularVelocity: number; // degrees per second
  detectedGesture: 'NODDING' | 'HEAD_SHAKING' | 'STATIC_COMPOSURE' | 'EXCESSIVE_MOTION';
}

/** Recorded gestural event over a continuous window */
export interface GesturalEvent {
  startTimeMs: number;
  endTimeMs: number;
  gestureType: 'NODDING' | 'HEAD_SHAKING' | 'POSTURE_SLUMP' | 'RAPID_TILT';
  durationSeconds: number;
  intensity: 'HIGH' | 'MEDIUM' | 'LOW';
}

import type { ExecutionMode } from './gazeEngine';

/** Session-level aggregated physical composure and head pose metrics */
export interface HeadPoseSessionMetrics {
  executionMode?: ExecutionMode;
  totalFramesAnalyzed: number;
  averageYaw: number;
  averagePitch: number;
  averageRoll: number;
  postureComposureScore: number; // 0.0 to 100.0%
  nodCount: number;
  headShakeCount: number;
  restlessnessIndex: number;     // 0.0 to 100.0%
  gesturalEvents: GesturalEvent[];
  frameTrace: HeadPoseFrameResult[];
}

/** Input frame accepted by the HopeNet engine (logits or pre-computed angles) */
export interface HeadPoseFrameInput {
  timestampMs: number;
  yawLogits?: number[];
  pitchLogits?: number[];
  rollLogits?: number[];
  yawDegrees?: number;
  pitchDegrees?: number;
  rollDegrees?: number;
  confidence?: number;
}
