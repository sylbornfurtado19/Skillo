'use client';

/**
 * PostureComposureCard
 * IVP Feature 3 SP2 — HopeNet Post-Interview Analytics Dashboard
 *
 * Displays:
 * 1. Posture Composure Score gauge + Restlessness Index meter
 * 2. Stat grid: Nod count, Head shake count, Euler angle averages, Velocity
 * 3. Chronological Gestural Event Timeline
 */

import React from 'react';
import type { HeadPoseSessionMetrics, GesturalEvent } from '@/types/index';

const RING_R = 48;
const RING_C = 2 * Math.PI * RING_R; // ≈ 301.6

function pctToOffset(pct: number) {
  return RING_C - (RING_C * Math.min(100, Math.max(0, pct))) / 100;
}

const INTENSITY_STYLE: Record<
  GesturalEvent['intensity'],
  { bg: string; border: string; text: string }
> = {
  HIGH:   { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-400' },
  MEDIUM: { bg: 'bg-blue-500/15',  border: 'border-blue-500/30',  text: 'text-blue-400'  },
  LOW:    { bg: 'bg-gray-500/15',  border: 'border-gray-500/30',  text: 'text-gray-400'  },
};

const GESTURE_CONFIG: Record<
  GesturalEvent['gestureType'],
  { label: string; icon: string; desc: string }
> = {
  NODDING:      { label: 'Gestural Nod',       icon: '👍', desc: 'Affirmative head oscillation' },
  HEAD_SHAKING: { label: 'Head Shake',         icon: '❓', desc: 'Hesitation/disagreement turn' },
  POSTURE_SLUMP:{ label: 'Downward Slump',     icon: '⚠️', desc: 'Sustained downward pitch tilt' },
  RAPID_TILT:   { label: 'Rapid Head Motion',  icon: '⚡', desc: 'High angular velocity spike'   },
};

interface PostureComposureCardProps {
  metrics: HeadPoseSessionMetrics;
}

export default function PostureComposureCard({ metrics }: PostureComposureCardProps) {
  const {
    postureComposureScore,
    restlessnessIndex,
    nodCount,
    headShakeCount,
    averageYaw,
    averagePitch,
    averageRoll,
    totalFramesAnalyzed,
    gesturalEvents,
  } = metrics;

  const scoreOffset = pctToOffset(postureComposureScore);

  function fmtTime(ms: number) {
    const s = Math.round(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  }

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-heading font-bold text-white">
            Head Movement & Posture Tracker
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Motion Stability Monitor · {totalFramesAnalyzed} frames analyzed
          </p>
          <p className="text-[10px] text-gray-400 italic mt-0.5">
            Monitors head rotation and nodding motion patterns over time using visual frame positioning.
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-mono border bg-indigo-500/10 border-indigo-500/25 text-indigo-400">
          {postureComposureScore >= 80 ? 'High Composure' : postureComposureScore >= 60 ? 'Moderate Stability' : 'High Motion'}
        </span>
      </div>

      {/* Row 1: Score Ring + Stat Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Score Ring Gauge */}
        <div className="md:col-span-5 flex flex-col items-center justify-center p-5 rounded-2xl bg-[#060b14] border border-white/8 text-center space-y-3">
          <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest self-start">
            Posture Composure Score
          </span>

          <div className="relative h-36 w-36 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="72" cy="72" r={RING_R}
                stroke="rgba(255, 255, 255, 0.04)"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="72" cy="72" r={RING_R}
                stroke="url(#postureGrad)"
                strokeWidth="8"
                strokeDasharray={RING_C}
                strokeDashoffset={scoreOffset}
                strokeLinecap="round"
                fill="transparent"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
              <defs>
                <linearGradient id="postureGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-3xl font-heading font-extrabold text-white">
                {postureComposureScore.toFixed(0)}%
              </span>
              <span className="text-[9px] text-gray-500 font-mono">composure</span>
            </div>
          </div>

          {/* Restlessness Index bar */}
          <div className="w-full space-y-1 text-left border-t border-white/5 pt-3">
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-gray-400">Restlessness Index:</span>
              <span className={restlessnessIndex > 35 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                {restlessnessIndex.toFixed(1)}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  restlessnessIndex > 35 ? 'bg-gradient-to-r from-amber-500 to-red-500' : 'bg-gradient-to-r from-emerald-500 to-indigo-500'
                }`}
                style={{ width: `${Math.min(100, restlessnessIndex)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stat Cards Grid */}
        <div className="md:col-span-7 grid grid-cols-2 gap-3">
          <div className="p-4 rounded-2xl bg-[#060b14] border border-white/8 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs">👍</span>
              <span className="text-[9px] text-gray-500 font-mono uppercase">Nod Count</span>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono text-emerald-400">{nodCount}</p>
              <p className="text-[10px] text-gray-500 font-mono mt-0.5">Affirmation cycles</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#060b14] border border-white/8 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs">❓</span>
              <span className="text-[9px] text-gray-500 font-mono uppercase">Head Shake</span>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono text-amber-400">{headShakeCount}</p>
              <p className="text-[10px] text-gray-500 font-mono mt-0.5">Hesitation cycles</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#060b14] border border-white/8 flex flex-col justify-between space-y-2 col-span-2">
            <span className="text-[9px] text-gray-500 font-mono uppercase tracking-widest">
              3D Euler Orientation Averages
            </span>
            <div className="grid grid-cols-3 gap-2 text-center pt-1 font-mono">
              <div className="bg-white/2 p-2 rounded-xl border border-white/5">
                <span className="text-[9px] text-gray-500 block">Yaw (Side)</span>
                <span className="text-xs font-bold text-white">{averageYaw >= 0 ? '+' : ''}{averageYaw}°</span>
              </div>
              <div className="bg-white/2 p-2 rounded-xl border border-white/5">
                <span className="text-[9px] text-gray-500 block">Pitch (Tilt)</span>
                <span className="text-xs font-bold text-white">{averagePitch >= 0 ? '+' : ''}{averagePitch}°</span>
              </div>
              <div className="bg-white/2 p-2 rounded-xl border border-white/5">
                <span className="text-[9px] text-gray-500 block">Roll (Side)</span>
                <span className="text-xs font-bold text-white">{averageRoll >= 0 ? '+' : ''}{averageRoll}°</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Gestural Event Timeline */}
      <div className="rounded-2xl bg-[#060b14] border border-white/8 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">
            Gestural Event Timeline
          </span>
          <span className="text-[9px] text-gray-600 font-mono">
            {gesturalEvents.length} gesture{gesturalEvents.length !== 1 ? 's' : ''} detected
          </span>
        </div>

        {gesturalEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <span className="text-2xl">🧍</span>
            <p className="text-[11px] text-gray-400 font-semibold">
              Steady composure maintained throughout session
            </p>
            <p className="text-[10px] text-gray-600 font-mono">
              No sudden head movements or posture slumps recorded
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {gesturalEvents.map((evt, idx) => {
              const cfg = GESTURE_CONFIG[evt.gestureType] ?? {
                label: evt.gestureType,
                icon: '📌',
                desc: 'Gestural motion event',
              };
              const style = INTENSITY_STYLE[evt.intensity];

              return (
                <div key={idx} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.01] transition">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{cfg.icon}</span>
                    <div className="space-y-0.5 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white font-mono">{cfg.label}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border font-mono ${style.bg} ${style.border} ${style.text}`}>
                          {evt.intensity}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 font-mono">{cfg.desc}</p>
                    </div>
                  </div>

                  <div className="text-right font-mono text-[10px] text-gray-500">
                    <span className="text-white font-bold block">{evt.durationSeconds}s</span>
                    <span>{fmtTime(evt.startTimeMs)} → {fmtTime(evt.endTimeMs)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
