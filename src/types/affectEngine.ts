// ── AffectNet Real-Time Facial Expression, Valence-Arousal Types (Mollahosseini et al., IEEE 2019) ──

export type DiscreteEmotion = 'NEUTRAL' | 'CONFIDENT' | 'STRESSED' | 'HESITANT' | 'THINKING' | 'SURPRISED';

export interface ValenceArousal2D {
  valence: number; // -1.0 to +1.0 (Sentiment positivity vs negativity)
  arousal: number; // -1.0 to +1.0 (Physical activation vs calmness)
}

export interface AffectFrameResult {
  frameTimestampMs: number;
  vaCoordinates: ValenceArousal2D;
  dominantEmotion: DiscreteEmotion;
  composureScore: number; // 0.0 to 100.0%
  confidenceScore: number;
}

export interface StressSpikeEvent {
  startTimeMs: number;
  endTimeMs: number;
  peakArousal: number;
  nadirValence: number;
  durationSeconds: number;
  triggerContext?: string;
}

import type { ExecutionMode } from './gazeEngine';

export interface AffectiveSessionMetrics {
  executionMode?: ExecutionMode;
  totalKeyframesAnalyzed: number;
  averageValence: number;
  averageArousal: number;
  overallComposureScore: number; // 0.0 to 100.0%
  dominantEmotionDistribution: Record<DiscreteEmotion, number>; // Percentage mapping (0.0 - 100.0)
  stressSpikeEvents: StressSpikeEvent[];
  affectTimeline: AffectFrameResult[];
}

export interface AffectFrameInput {
  timestampMs: number;
  valence?: number;
  arousal?: number;
  valenceLogits?: number[];
  arousalLogits?: number[];
  confidence?: number;
}
