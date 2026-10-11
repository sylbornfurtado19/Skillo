'use client';

/**
 * FacialComposureCard
 * IVP Feature 4 — AffectNet Post-Interview Analytics Dashboard
 *
 * Displays:
 * 1. Composure Score Ring Gauge (overallComposureScore)
 * 2. 2D Valence-Arousal Scatter Plot Quadrant (High Confidence, Calm Focus, Stress/Anxiety, Hesitation)
 * 3. Dominant Emotion Distribution Breakdown
 * 4. Itemized Stress Spike Event Timeline Log
 */

import React, { useMemo } from 'react';
import type { AffectiveSessionMetrics, DiscreteEmotion } from '@/types/index';

const RING_R = 48;
const RING_C = 2 * Math.PI * RING_R; // ≈ 301.6

function pctToOffset(pct: number) {
  return RING_C - (RING_C * Math.min(100, Math.max(0, pct))) / 100;
}

const EMOTION_COLORS: Record<DiscreteEmotion, { bar: string; text: string; bg: string }> = {
  HAPPY:     { bar: 'bg-success',   text: 'text-success',        bg: 'bg-success/10' },
  CONFIDENT: { bar: 'bg-success',   text: 'text-success',        bg: 'bg-success/10' },
  NEUTRAL:   { bar: 'bg-secondary', text: 'text-text-secondary', bg: 'bg-surface-alt' },
  THINKING:  { bar: 'bg-info',      text: 'text-info',           bg: 'bg-info/10' },
  HESITANT:  { bar: 'bg-warning',   text: 'text-warning',        bg: 'bg-warning/10' },
  STRESSED:  { bar: 'bg-danger',    text: 'text-danger',         bg: 'bg-danger/10' },
  SURPRISED: { bar: 'bg-primary',   text: 'text-primary',        bg: 'bg-primary-soft' },
};

interface FacialComposureCardProps {
  metrics: AffectiveSessionMetrics;
}

export default function FacialComposureCard({ metrics }: FacialComposureCardProps) {
  const {
    overallComposureScore,
    averageValence,
    averageArousal,
    totalKeyframesAnalyzed,
    dominantEmotionDistribution,
    stressSpikeEvents,
    affectTimeline,
  } = metrics;

  const scoreOffset = pctToOffset(overallComposureScore);

  // Quadrant mapping: 220x220 viewBox, center at (110, 110)
  const QUAD_W = 220;
  const QUAD_H = 220;
  const toQX = (v: number) => 110 + v * 95;
  const toQY = (a: number) => 110 - a * 95; // invert Y for SVG

  // Sample points for scatter plot
  const scatterPoints = useMemo(() => {
    const step = Math.max(1, Math.floor(affectTimeline.length / 180));
    return affectTimeline
      .filter((_, i) => i % step === 0)
      .map(f => {
        const emo = f.dominantEmotion;
        let color = '#6B6E70';
        if (emo === 'CONFIDENT' || emo === 'HAPPY') color = '#3F7D58';
        else if (emo === 'STRESSED') color = '#B3261E';
        else if (emo === 'HESITANT') color = '#C98A1B';
        else if (emo === 'THINKING') color = '#4A6B8A';
        return {
          x: toQX(f.vaCoordinates.valence),
          y: toQY(f.vaCoordinates.arousal),
          color,
        };
      });
  }, [affectTimeline]);

  function fmtTime(ms: number) {
    const s = Math.round(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  }

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-heading font-bold text-text-primary">
                Color & Brightness Activity Monitor
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-surface-alt text-text-secondary border border-border">
                [Canvas Heuristic]
              </span>
            </div>
            <p className="text-[11px] text-text-secondary mt-0.5">
              Visual Composure Estimator · {totalKeyframesAnalyzed} keyframes analyzed
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono border bg-primary-soft border-primary/20 text-primary">
            {overallComposureScore >= 80 ? 'High Composure' : overallComposureScore >= 60 ? 'Moderate Composure' : 'Elevated Stress'}
          </span>
        </div>
      </div>

      {/* Row 1: Score Gauge & 2D V-A Quadrant */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Score Ring Gauge & Emotion Breakdown */}
        <div className="md:col-span-5 flex flex-col items-center justify-between p-5 rounded-2xl bg-surface border border-border shadow-soft space-y-4">
          <span className="text-[10px] text-text-secondary font-mono uppercase tracking-widest self-start">
            Facial Composure Score
          </span>

          <div className="relative h-36 w-36 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="72" cy="72" r={RING_R}
                stroke="#E2DDD5"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="72" cy="72" r={RING_R}
                stroke="url(#affectGrad)"
                strokeWidth="8"
                strokeDasharray={RING_C}
                strokeDashoffset={scoreOffset}
                strokeLinecap="round"
                fill="transparent"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
              <defs>
                <linearGradient id="affectGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#9B2218" />
                  <stop offset="100%" stopColor="#7F1B13" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-3xl font-heading font-extrabold text-text-primary">
                {overallComposureScore.toFixed(0)}%
              </span>
              <span className="text-[9px] text-text-secondary font-mono">composure</span>
            </div>
          </div>

          {/* Composure Signal (Beta) Distribution Bars */}
          <div className="w-full space-y-2 border-t border-border pt-3">
            <span className="text-[9px] text-text-secondary font-mono uppercase block">Composure Signal (Beta) Distribution</span>
            {(['HAPPY', 'CONFIDENT', 'THINKING', 'NEUTRAL', 'HESITANT', 'STRESSED', 'SURPRISED'] as DiscreteEmotion[]).map(emo => {
              const pct = dominantEmotionDistribution[emo] ?? 0;
              const cfg = EMOTION_COLORS[emo];
              return (
                <div key={emo} className="space-y-0.5 font-mono text-[9px]">
                  <div className="flex justify-between text-text-secondary">
                    <span>{emo}</span>
                    <span className={`font-bold ${cfg.text}`}>{pct}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-alt rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2D Valence-Arousal Quadrant Map */}
        <div className="md:col-span-7 flex flex-col justify-between p-5 rounded-2xl bg-surface border border-border shadow-soft space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-secondary font-mono uppercase tracking-widest">
              2D Valence-Arousal Space Map
            </span>
            <div className="flex items-center gap-3 text-[9px] text-text-secondary font-mono">
              <span>Avg V: <strong className="text-success">{averageValence >= 0 ? '+' : ''}{averageValence}</strong></span>
              <span>Avg A: <strong className="text-primary">{averageArousal >= 0 ? '+' : ''}{averageArousal}</strong></span>
            </div>
          </div>

          <div className="flex justify-center">
            <svg
              width={QUAD_W}
              height={QUAD_H}
              viewBox={`0 0 ${QUAD_W} ${QUAD_H}`}
              className="rounded-xl overflow-hidden border border-border"
              style={{ background: '#EFEBE5' }}
            >
              {/* Quadrant background zones */}
              {/* Top-Right: High Confidence */}
              <rect x="110" y="0" width="110" height="110" fill="rgba(63,125,88,0.06)" />
              <text x="165" y="20" fill="rgba(63,125,88,0.7)" fontSize="8" fontFamily="monospace" textAnchor="middle">High Confidence</text>

              {/* Bottom-Right: Calm Focus */}
              <rect x="110" y="110" width="110" height="110" fill="rgba(107,110,112,0.06)" />
              <text x="165" y="200" fill="rgba(107,110,112,0.7)" fontSize="8" fontFamily="monospace" textAnchor="middle">Calm Focus</text>

              {/* Top-Left: Stress / Anxiety */}
              <rect x="0" y="0" width="110" height="110" fill="rgba(179,38,30,0.06)" />
              <text x="55" y="20" fill="rgba(179,38,30,0.7)" fontSize="8" fontFamily="monospace" textAnchor="middle">Stress / Anxiety</text>

              {/* Bottom-Left: Hesitation */}
              <rect x="0" y="110" width="110" height="110" fill="rgba(201,138,27,0.06)" />
              <text x="55" y="200" fill="rgba(201,138,27,0.7)" fontSize="8" fontFamily="monospace" textAnchor="middle">Hesitation / Withdrawal</text>

              {/* Main axes */}
              <line x1="110" y1="0" x2="110" y2={QUAD_H} stroke="#E2DDD5" strokeWidth="1" />
              <line x1="0" y1="110" x2={QUAD_W} y2="110" stroke="#E2DDD5" strokeWidth="1" />

              {/* Ideal baseline target point (+0.40, +0.20) */}
              <circle cx={toQX(0.40)} cy={toQY(0.20)} r="5" fill="rgba(63,125,88,0.25)" stroke="#3F7D58" strokeWidth="1.5" />
              <text x={toQX(0.40)} y={toQY(0.20) - 8} fill="#3F7D58" fontSize="7" fontFamily="monospace" textAnchor="middle">Target Baseline</text>

              {/* Keyframe scatter points */}
              {scatterPoints.map((pt, i) => (
                <circle
                  key={i}
                  cx={Math.min(QUAD_W - 4, Math.max(4, pt.x))}
                  cy={Math.min(QUAD_H - 4, Math.max(4, pt.y))}
                  r="2.5"
                  fill={pt.color}
                  opacity="0.75"
                />
              ))}

              {/* Axis labels */}
              <text x="112" y="10" fill="rgba(43,37,35,0.45)" fontSize="8" fontFamily="monospace">+Arousal</text>
              <text x="112" y={QUAD_H - 4} fill="rgba(43,37,35,0.45)" fontSize="8" fontFamily="monospace">-Arousal</text>
              <text x="4" y="108" fill="rgba(43,37,35,0.45)" fontSize="8" fontFamily="monospace">-Valence</text>
              <text x={QUAD_W - 45} y="108" fill="rgba(43,37,35,0.45)" fontSize="8" fontFamily="monospace">+Valence</text>
            </svg>
          </div>
        </div>
      </div>

      {/* Row 2: Stress Spike Event Timeline Log */}
      <div className="rounded-2xl bg-surface border border-border shadow-soft overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-[10px] text-text-secondary font-mono uppercase tracking-widest">
            Physiological Stress Spike Timeline
          </span>
          <span className="text-[9px] text-text-secondary font-mono">
            {stressSpikeEvents.length} spike{stressSpikeEvents.length !== 1 ? 's' : ''} detected
          </span>
        </div>

        {stressSpikeEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <span className="text-2xl">🌱</span>
            <p className="text-[11px] text-success font-semibold">
              No physiological stress spikes detected
            </p>
            <p className="text-[10px] text-text-secondary font-mono">
              Emotional composure remained stable across all keyframes
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {stressSpikeEvents.map((evt, idx) => (
              <div key={idx} className="flex items-start justify-between px-4 py-3 bg-danger/5 border-l-2 border-danger/40">
                <div className="space-y-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">⚡</span>
                    <span className="text-xs font-mono font-bold text-danger">
                      Stress Spike Event #{idx + 1}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-danger/15 text-danger border border-danger/30">
                      Duration: {evt.durationSeconds}s
                    </span>
                  </div>
                  <p className="text-[10px] text-text-secondary font-mono">
                    {evt.triggerContext ?? 'Elevated physiological arousal combined with negative sentiment drift'}
                  </p>
                  <div className="flex items-center gap-3 text-[9px] text-text-secondary font-mono">
                    <span>Peak Arousal: <strong className="text-danger">+{evt.peakArousal}</strong></span>
                    <span>Nadir Valence: <strong className="text-warning">{evt.nadirValence}</strong></span>
                  </div>
                </div>

                <div className="text-right font-mono text-[10px] text-text-secondary shrink-0">
                  <span>{fmtTime(evt.startTimeMs)} → {fmtTime(evt.endTimeMs)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
