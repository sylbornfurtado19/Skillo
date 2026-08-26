// ── SyncNet Audio-Visual Lip-Speech Sync & Anti-Spoofing Types (Chung & Zisserman, ACCV 2016) ──

export type SyncVerificationStatus =
  | 'VERIFIED_GENUINE'
  | 'LATENCY_LAG_WARNING'
  | 'NO_AUDIO_DETECTED';

export interface SyncWindowResult {
  windowTimestampMs: number;
  crossModalDistance: number; // L2 distance D(v,a)
  optimalOffsetMs: number;    // -500 to +500 ms
  status: SyncVerificationStatus;
}

export interface SpoofingAlertEvent {
  startTimeMs: number;
  endTimeMs: number;
  reason: 'LIP_AUDIO_MISMATCH' | 'EXCESSIVE_TIME_OFFSET' | 'SYNTHETIC_VOICE_SUSPECTED';
  averageDistance: number;
  durationSeconds: number;
}

export interface LipSyncSessionMetrics {
  totalWindowsAnalyzed: number;
  overallSyncScore: number;            // 0.0 to 100.0%
  averageOffsetMs: number;             // Mean time-shift
  averageCrossModalDistance: number;
  verificationStatus: SyncVerificationStatus;
  spoofingAlerts: SpoofingAlertEvent[];
  syncTrace: SyncWindowResult[];
}

export interface SyncWindowInput {
  timestampMs: number;
  visualLogits?: number[];
  audioLogits?: number[];
  visualDistance?: number;
  offsetMs?: number;
  audioEnergy?: number;
  confidence?: number;
}
