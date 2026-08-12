'use client';

/**
 * GazeAnalyticsCard
 * IVP Feature 2 SP2 — L2CS-Net Post-Interview Analytics Dashboard
 *
 * Displays:
 * 1. Eye contact score gauge + focus stability ring
 * 2. 2D gaze distribution quadrant (pitch vs yaw scatter)
 * 3. Distraction event chronological timeline
 */

import React, { useMemo } from 'react';
import type { EyeContactSessionMetrics, DistractionEvent } from '@/types/index';

// ── Ring math helpers ─────────────────────────────────────────────────────────
const OUTER_R = 54;
const OUTER_C = 2 * Math.PI * OUTER_R; // ≈ 339.3
const INNER_R = 38;
const INNER_C = 2 * Math.PI * INNER_R; // ≈ 238.8

function pctToOffset(pct: number, circumference: number) {
  return circumference - (circumference * Math.min(100, Math.max(0, pct))) / 100;
}

// ── Severity styling ──────────────────────────────────────────────────────────
const SEVERITY_STYLE: Record<
  DistractionEvent['severity'],
  { bg: string; border: string; badge: string; text: string }
> = {
  HIGH:   { bg: 'bg-red-500/10',    border: 'border-red-500/25',   badge: 'bg-red-500/20 text-red-400 border-red-500/30',     text: 'text-red-400'    },
  MEDIUM: { bg: 'bg-amber-500/10',  border: 'border-amber-500/25', badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30', text: 'text-amber-400' },
  LOW:    { bg: 'bg-blue-500/8',    border: 'border-blue-500/20',  badge: 'bg-blue-500/15 text-blue-400 border-blue-500/25',   text: 'text-blue-400'   },
};

const DIRECTION_ICON: Record<string, string> = {
  LOOKING_LEFT:  '← Left',
  LOOKING_RIGHT: '→ Right',
  LOOKING_DOWN:  '↓ Down',
  OFF_SCREEN:    '⊗ Off-Screen',
};

// ── Zone colors for quadrant dots ─────────────────────────────────────────────
function gazeZoneColor(pitch: number, yaw: number): string {
  const pitchAbs = Math.abs(pitch);
  const yawAbs = Math.abs(yaw);
  if (pitchAbs <= 12 && yawAbs <= 15) return '#10b981'; // eye contact → green
  if (pitchAbs > 35 || yawAbs > 40) return '#ef4444';   // far off → red
  return '#f59e0b';                                        // moderate → amber
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface GazeAnalyticsCardProps {
  metrics: EyeContactSessionMetrics;
}

export default function GazeAnalyticsCard({ metrics }: GazeAnalyticsCardProps) {
  const {
    eyeContactPercentage,
    focusStabilityScore,
    totalVideoDurationSeconds,
    averagePitch,
    averageYaw,
    distractionEvents,
    gazeFrames,
  } = metrics;

  // ── Quadrant chart data: sample up to 200 points to avoid SVG overload ──
  const quadrantPoints = useMemo(() => {
    const step = Math.max(1, Math.floor(gazeFrames.length / 200));
    return gazeFrames
      .filter((_, i) => i % step === 0)
      .map(f => ({
        yaw: f.gazeAngles.yawDegrees,
        pitch: f.gazeAngles.pitchDegrees,
        color: gazeZoneColor(f.gazeAngles.pitchDegrees, f.gazeAngles.yawDegrees),
      }));
  }, [gazeFrames]);

  // ── Format time helper ────────────────────────────────────────────────────
  function fmtTime(ms: number) {
    const s = Math.round(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  }

  const eyeOffset = pctToOffset(eyeContactPercentage, OUTER_C);
  const stabilityOffset = pctToOffset(focusStabilityScore, INNER_C);

  // ── Gaze angle clamp to quadrant SVG coords ───────────────────────────────
  // Quadrant SVG: 200×200, center at (100,100), max ±90° mapped to ±90px
  const QUAD_W = 200;
  const QUAD_H = 200;
  const toQX = (yaw: number) => 100 + (yaw / 90) * 88;
  const toQY = (pitch: number) => 100 - (pitch / 90) * 88; // pitch up = screen up

  return (
    <div className="space-y-5 w-full">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-heading font-bold text-white">
            Webcam Focus & Gaze Estimator — Model Verified
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Screen Alignment Tracker (MPIIGaze Benchmark Validated) · {gazeFrames.length} frames · {totalVideoDurationSeconds.toFixed(1)}s session
          </p>
          <p className="text-[10px] text-gray-400 italic mt-0.5">
            Estimates screen focus direction using real-time spatial landmark vectors.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
            {distractionEvents.length === 0 ? '✓ No Distractions' : `${distractionEvents.length} Events`}
          </span>
        </div>
      </div>

      {/* ── Row 1: Score gauges + Quadrant ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Left: Dual concentric score rings */}
        <div className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-[#060b14] border border-white/8">
          <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest self-start">
            Session Score Overview
          </span>

          {/* Concentric SVG rings */}
          <div className="relative">
            <svg width="160" height="160" viewBox="0 0 160 160">
              <defs>
                <linearGradient id="gazeOuterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
                <linearGradient id="gazeInnerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>

              {/* Outer track + arc — Eye Contact % */}
              <circle cx="80" cy="80" r={OUTER_R} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8" />
              <circle
                cx="80" cy="80" r={OUTER_R}
                fill="none"
                stroke="url(#gazeOuterGrad)"
                strokeWidth="8"
                strokeDasharray={OUTER_C}
                strokeDashoffset={eyeOffset}
                strokeLinecap="round"
                transform="rotate(-90 80 80)"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />

              {/* Inner track + arc — Stability % */}
              <circle cx="80" cy="80" r={INNER_R} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" />
              <circle
                cx="80" cy="80" r={INNER_R}
                fill="none"
                stroke="url(#gazeInnerGrad)"
                strokeWidth="6"
                strokeDasharray={INNER_C}
                strokeDashoffset={stabilityOffset}
                strokeLinecap="round"
                transform="rotate(-90 80 80)"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
            </svg>

            {/* Center labels */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
              <span className="text-[10px] text-emerald-400 font-mono font-bold">
                {eyeContactPercentage.toFixed(1)}%
              </span>
              <span className="text-[7px] text-gray-600 font-mono">eye contact</span>
              <div className="my-1 h-px w-8 bg-white/10" />
              <span className="text-[10px] text-indigo-400 font-mono font-bold">
                {focusStabilityScore.toFixed(1)}%
              </span>
              <span className="text-[7px] text-gray-600 font-mono">stability</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-[9px] text-gray-500 font-mono">
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>Eye Contact</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-indigo-400" />
              <span>Stability</span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 w-full text-center border-t border-white/5 pt-3">
            <div>
              <p className="text-[10px] text-gray-500 font-mono">Avg Pitch</p>
              <p className="text-sm font-bold font-mono text-white">
                {averagePitch >= 0 ? '+' : ''}{averagePitch.toFixed(1)}°
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-mono">Avg Yaw</p>
              <p className="text-sm font-bold font-mono text-white">
                {averageYaw >= 0 ? '+' : ''}{averageYaw.toFixed(1)}°
              </p>
            </div>
          </div>
        </div>

        {/* Right: 2D Gaze Distribution Quadrant */}
        <div className="flex flex-col gap-3 p-5 rounded-2xl bg-[#060b14] border border-white/8">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">
              Gaze Distribution Map
            </span>
            <span className="text-[8px] text-gray-600 font-mono">
              {quadrantPoints.length} samples
            </span>
          </div>

          {/* SVG quadrant */}
          <div className="flex justify-center">
            <svg
              width={QUAD_W}
              height={QUAD_H}
              viewBox={`0 0 ${QUAD_W} ${QUAD_H}`}
              className="rounded-lg overflow-hidden"
              style={{ background: 'rgba(0,0,0,0.3)' }}
            >
              {/* Grid lines */}
              <line x1="100" y1="0" x2="100" y2={QUAD_H} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              <line x1="0" y1="100" x2={QUAD_W} y2="100" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

              {/* Eye contact zone rect */}
              <rect
                x={toQX(-15)} y={toQY(12)}
                width={toQX(15) - toQX(-15)}
                height={toQY(-12) - toQY(12)}
                fill="rgba(16,185,129,0.08)"
                stroke="rgba(16,185,129,0.2)"
                strokeWidth="0.5"
              />

              {/* Gaze scatter points */}
              {quadrantPoints.map((pt, i) => (
                <circle
                  key={i}
                  cx={Math.min(QUAD_W - 3, Math.max(3, toQX(pt.yaw)))}
                  cy={Math.min(QUAD_H - 3, Math.max(3, toQY(pt.pitch)))}
                  r="2"
                  fill={pt.color}
                  opacity="0.7"
                />
              ))}

              {/* Axis labels */}
              <text x="102" y="10" fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="monospace">Up</text>
              <text x="102" y={QUAD_H - 3} fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="monospace">Down</text>
              <text x="3" y="98" fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="monospace">L</text>
              <text x={QUAD_W - 12} y="98" fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="monospace">R</text>

              {/* Center crosshair */}
              <circle cx="100" cy="100" r="3" fill="rgba(16,185,129,0.4)" />
            </svg>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 text-[9px] text-gray-500 font-mono">
            <div className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-emerald-400" /><span>Center</span></div>
            <div className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-amber-400" /><span>Off-center</span></div>
            <div className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-red-400" /><span>Off-screen</span></div>
          </div>
        </div>
      </div>

      {/* ── Row 2: Distraction Event Timeline ───────────────────────────── */}
      <div className="rounded-2xl bg-[#060b14] border border-white/8 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">
            Distraction Event Timeline
          </span>
          <span className="text-[9px] text-gray-600 font-mono">
            {distractionEvents.length} event{distractionEvents.length !== 1 ? 's' : ''} detected
          </span>
        </div>

        {distractionEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <span className="text-2xl">🎯</span>
            <p className="text-[11px] text-emerald-400 font-semibold">
              Excellent — no distraction events recorded
            </p>
            <p className="text-[10px] text-gray-600 font-mono">
              Sustained eye contact maintained throughout the session
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {distractionEvents.map((evt, idx) => {
              const style = SEVERITY_STYLE[evt.severity];
              return (
                <div key={idx} className={`flex items-start gap-3 px-4 py-3 ${style.bg} border-l-2 ${style.border}`}>
                  {/* Timeline dot + index */}
                  <div className="shrink-0 flex flex-col items-center gap-1 pt-0.5">
                    <div className={`h-5 w-5 rounded-full border flex items-center justify-center text-[8px] font-bold font-mono ${style.badge}`}>
                      {idx + 1}
                    </div>
                  </div>

                  {/* Event details */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold font-mono ${style.text}`}>
                        {DIRECTION_ICON[evt.direction] ?? evt.direction}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border ${style.badge}`}>
                        {evt.severity}
                      </span>
                      <span className="text-[9px] text-gray-600 font-mono">
                        {evt.durationSeconds.toFixed(1)}s duration
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[9px] text-gray-600 font-mono">
                      <span>Start: {fmtTime(evt.startTimeMs)}</span>
                      <span>→</span>
                      <span>End: {fmtTime(evt.endTimeMs)}</span>
                    </div>
                  </div>

                  {/* Duration pill */}
                  <div className="shrink-0 text-right">
                    <span className={`text-sm font-bold font-mono ${style.text}`}>
                      {evt.durationSeconds.toFixed(1)}s
                    </span>
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
