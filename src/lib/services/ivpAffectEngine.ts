/**
 * AffectNet Real-Time Facial Expression, Valence-Arousal & Composure Engine
 * Research Foundation: AffectNet: A Database for Facial Expression, Valence, and Arousal
 * Computing in the Wild (Mollahosseini et al., IEEE 2019)
 *
 * Implements:
 * 1. Soft-argmax expectation calculation over 100 bins for continuous 2D (Valence, Arousal) coordinates.
 * 2. Euclidean Composure Score calculation relative to ideal target vector (V_target, A_target) = (+0.40, +0.20).
 * 3. Discrete emotion classification: NEUTRAL, CONFIDENT, STRESSED, HESITANT, THINKING, SURPRISED.
 * 4. Stress Spike event detection (A >= +0.65 & V <= -0.30 for >= 3 keyframes).
 * 5. Session aggregation into AffectiveSessionMetrics.
 */

import type {
  DiscreteEmotion,
  ValenceArousal2D,
  AffectFrameResult,
  AffectFrameInput,
  StressSpikeEvent,
  AffectiveSessionMetrics,
} from '@/types/index';

const N_BINS = 100;
const BIN_CENTERS: number[] = Array.from(
  { length: N_BINS },
  (_, i) => -1.0 + (i + 0.5) * (2.0 / N_BINS)
);

// Target ideal calm-confidence vector
const TARGET_VALENCE = 0.40;
const TARGET_AROUSAL = 0.20;
const MAX_DIST_SQ = 8.0; // max possible dist squared in [-1,1] space is (2^2 + 2^2) = 8
const SQRT_8 = Math.sqrt(MAX_DIST_SQ);

// ─────────────────────────────────────────────────────────────────────────────
// 1. SOFT-ARGMAX EXPECTATION FOR CONTINUOUS V-A METRICS
// ─────────────────────────────────────────────────────────────────────────────

function softmax(logits: number[]): number[] {
  if (logits.length === 0) return [];
  const maxLogit = Math.max(...logits);
  const exps = logits.map(z => Math.exp(z - maxLogit));
  const sumExp = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / sumExp);
}

export function softArgmaxVA(logits: number[]): number {
  const padded =
    logits.length >= N_BINS
      ? logits.slice(0, N_BINS)
      : [...logits, ...new Array(N_BINS - logits.length).fill(0)];

  const probs = softmax(padded);
  const val = probs.reduce((acc, p, i) => acc + p * BIN_CENTERS[i], 0);
  return Math.max(-1.0, Math.min(1.0, val));
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. COMPOSURE SCORE & DISCRETE EMOTION CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────

export function calculateComposureScore(v: number, a: number): number {
  const dist = Math.sqrt((v - TARGET_VALENCE) ** 2 + (a - TARGET_AROUSAL) ** 2);
  const score = Math.max(0, 100 * (1.0 - dist / SQRT_8));
  return Math.round(score * 10) / 10;
}

export function classifyDiscreteEmotion(v: number, a: number): DiscreteEmotion {
  if (a >= 0.30 && v <= -0.20) return 'STRESSED';
  if (a >= 0.70) return 'SURPRISED';
  if (a <= -0.20 && v <= -0.20) return 'HESITANT';
  if (v >= 0.20 && a >= 0.05) return 'CONFIDENT';
  if (Math.abs(v) <= 0.10 && Math.abs(a) <= 0.15) return 'NEUTRAL';
  if (Math.abs(v) <= 0.25 && a <= 0.10) return 'THINKING';
  return 'NEUTRAL';
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. FRAME-LEVEL AFFECT PROCESSING
// ─────────────────────────────────────────────────────────────────────────────

export function processAffectFrame(input: AffectFrameInput): AffectFrameResult {
  const valence = input.valenceLogits?.length
    ? softArgmaxVA(input.valenceLogits)
    : Math.max(-1.0, Math.min(1.0, input.valence ?? 0.1));

  const arousal = input.arousalLogits?.length
    ? softArgmaxVA(input.arousalLogits)
    : Math.max(-1.0, Math.min(1.0, input.arousal ?? 0.0));

  const vaCoordinates: ValenceArousal2D = {
    valence: Math.round(valence * 100) / 100,
    arousal: Math.round(arousal * 100) / 100,
  };

  const dominantEmotion = classifyDiscreteEmotion(valence, arousal);
  const composureScore = calculateComposureScore(valence, arousal);
  const confidenceScore = Math.min(1.0, Math.max(0.0, input.confidence ?? 0.85));

  return {
    frameTimestampMs: input.timestampMs,
    vaCoordinates,
    dominantEmotion,
    composureScore,
    confidenceScore,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. STRESS SPIKE DETECTOR
// ─────────────────────────────────────────────────────────────────────────────

export function detectStressSpikes(frames: AffectFrameResult[]): StressSpikeEvent[] {
  if (frames.length < 3) return [];

  const events: StressSpikeEvent[] = [];
  let spikeStartIdx: number | null = null;

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const isStressFrame = f.vaCoordinates.arousal >= 0.65 && f.vaCoordinates.valence <= -0.30;

    if (isStressFrame) {
      if (spikeStartIdx === null) {
        spikeStartIdx = i;
      }
    } else {
      if (spikeStartIdx !== null) {
        const streakLength = i - spikeStartIdx;
        if (streakLength >= 3) {
          const streak = frames.slice(spikeStartIdx, i);
          const startMs = streak[0].frameTimestampMs;
          const endMs = streak[streak.length - 1].frameTimestampMs;
          const peakArousal = Math.max(...streak.map(s => s.vaCoordinates.arousal));
          const nadirValence = Math.min(...streak.map(s => s.vaCoordinates.valence));
          const durationSeconds = (endMs - startMs) / 1000;

          events.push({
            startTimeMs: startMs,
            endTimeMs: endMs,
            peakArousal: Math.round(peakArousal * 100) / 100,
            nadirValence: Math.round(nadirValence * 100) / 100,
            durationSeconds: Math.round(durationSeconds * 100) / 100,
            triggerContext: 'Elevated physiological arousal combined with negative sentiment drift',
          });
        }
        spikeStartIdx = null;
      }
    }
  }

  // Trailing spike check
  if (spikeStartIdx !== null) {
    const streakLength = frames.length - spikeStartIdx;
    if (streakLength >= 3) {
      const streak = frames.slice(spikeStartIdx);
      const startMs = streak[0].frameTimestampMs;
      const endMs = streak[streak.length - 1].frameTimestampMs;
      const peakArousal = Math.max(...streak.map(s => s.vaCoordinates.arousal));
      const nadirValence = Math.min(...streak.map(s => s.vaCoordinates.valence));
      const durationSeconds = (endMs - startMs) / 1000;

      events.push({
        startTimeMs: startMs,
        endTimeMs: endMs,
        peakArousal: Math.round(peakArousal * 100) / 100,
        nadirValence: Math.round(nadirValence * 100) / 100,
        durationSeconds: Math.round(durationSeconds * 100) / 100,
        triggerContext: 'Elevated physiological arousal combined with negative sentiment drift',
      });
    }
  }

  return events;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. PUBLIC API: SESSION AGGREGATION
// ─────────────────────────────────────────────────────────────────────────────

export function processAffectFrames(
  inputs: AffectFrameInput[]
): AffectiveSessionMetrics {
  const defaultDist: Record<DiscreteEmotion, number> = {
    NEUTRAL: 40,
    CONFIDENT: 35,
    STRESSED: 5,
    HESITANT: 10,
    THINKING: 10,
    SURPRISED: 0,
  };

  if (!inputs || inputs.length === 0) {
    return {
      totalKeyframesAnalyzed: 0,
      averageValence: 0,
      averageArousal: 0,
      overallComposureScore: 100,
      dominantEmotionDistribution: defaultDist,
      stressSpikeEvents: [],
      affectTimeline: [],
    };
  }


  const sorted = [...inputs].sort((a, b) => a.timestampMs - b.timestampMs);
  const affectTimeline: AffectFrameResult[] = sorted.map(processAffectFrame);
  const total = affectTimeline.length;

  const avgValence = Math.round((affectTimeline.reduce((s, f) => s + f.vaCoordinates.valence, 0) / total) * 100) / 100;
  const avgArousal = Math.round((affectTimeline.reduce((s, f) => s + f.vaCoordinates.arousal, 0) / total) * 100) / 100;
  const overallComposureScore = Math.round((affectTimeline.reduce((s, f) => s + f.composureScore, 0) / total) * 10) / 10;

  // Emotion distribution mapping
  const emotionCounts: Record<DiscreteEmotion, number> = {
    NEUTRAL: 0,
    CONFIDENT: 0,
    STRESSED: 0,
    HESITANT: 0,
    THINKING: 0,
    SURPRISED: 0,
  };

  affectTimeline.forEach(f => {
    emotionCounts[f.dominantEmotion] = (emotionCounts[f.dominantEmotion] || 0) + 1;
  });

  const dominantEmotionDistribution: Record<DiscreteEmotion, number> = {
    NEUTRAL: Math.round((emotionCounts.NEUTRAL / total) * 100),
    CONFIDENT: Math.round((emotionCounts.CONFIDENT / total) * 100),
    STRESSED: Math.round((emotionCounts.STRESSED / total) * 100),
    HESITANT: Math.round((emotionCounts.HESITANT / total) * 100),
    THINKING: Math.round((emotionCounts.THINKING / total) * 100),
    SURPRISED: Math.round((emotionCounts.SURPRISED / total) * 100),
  };

  const stressSpikeEvents = detectStressSpikes(affectTimeline);

  return {
    totalKeyframesAnalyzed: total,
    averageValence: avgValence,
    averageArousal: avgArousal,
    overallComposureScore,
    dominantEmotionDistribution,
    stressSpikeEvents,
    affectTimeline,
  };
}
