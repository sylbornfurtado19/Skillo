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
import { FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
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
  HIGH:   { bg: 'bg-danger/10',    border: 'border-danger/25',   badge: 'bg-danger/20 text-danger border-danger/30',     text: 'text-danger'    },
  MEDIUM: { bg: 'bg-warning/10',  border: 'border-warning/25', badge: 'bg-warning/20 text-warning border-warning/30', text: 'text-warning' },
  LOW:    { bg: 'bg-bg-surface-alt', border: 'border-border',      badge: 'bg-bg-surface-alt text-text-secondary border-border', text: 'text-text-secondary' },
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
  if (pitchAbs <= 12 && yawAbs <= 15) return 'var(--success)';
  if (pitchAbs > 35 || yawAbs > 40) return 'var(--danger)';
  return 'var(--warning)';
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
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-heading font-bold text-text-primary">
                Webcam Focus & Gaze Estimator
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-bg-surface-alt text-text-secondary border border-border">
                [Canvas Heuristic]
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              Screen Alignment Tracker · {gazeFrames.length} frames · {totalVideoDurationSeconds.toFixed(1)}s session
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-mono border flex items-center gap-1.5 font-bold ${
              distractionEvents.length === 0 ? 'bg-success/10 border-success/20 text-success' : 'bg-warning/10 border-warning/20 text-warning'
            }`}>
              {distractionEvents.length === 0 ? (
                <>
                  <FaCheckCircle className="text-success text-xs" aria-hidden="true" />
                  <span>No Distractions</span>
                </>
              ) : (
                <>
                  <FaExclamationTriangle className="text-warning text-xs" aria-hidden="true" />
                  <span>{distractionEvents.length} Event{distractionEvents.length !== 1 ? 's' : ''}</span>
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* ── Row 1: Score gauges + Quadrant ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Left: Dual concentric score rings */}
        <div className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-bg-surface border border-border shadow-soft">
          <span className="text-xs text-text-secondary font-mono uppercase tracking-widest self-start">
            Session Score Overview
          </span>

          {/* Concentric SVG rings */}
          <div className="relative">
            <svg width="160" height="160" viewBox="0 0 160 160">
              <defs>
                <linearGradient id="gazeOuterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--primary)" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.7" />
                </linearGradient>
                <linearGradient id="gazeInnerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--secondary)" />
                  <stop offset="100%" stopColor="var(--secondary)" stopOpacity="0.7" />
                </linearGradient>
              </defs>

              {/* Outer track + arc — Eye Contact % */}
              <circle cx="80" cy="80" r={OUTER_R} fill="none" stroke="var(--border)" strokeWidth="8" />
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
              <circle cx="80" cy="80" r={INNER_R} fill="none" stroke="var(--border)" strokeWidth="6" />
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
              <span className="text-xs text-primary font-mono font-bold">
                {eyeContactPercentage.toFixed(1)}%
              </span>
              <span className="text-[10px] text-text-secondary font-mono">eye contact</span>
              <div className="my-1 h-px w-8 bg-border" />
              <span className="text-xs text-secondary font-mono font-bold">
                {focusStabilityScore.toFixed(1)}%
              </span>
              <span className="text-[10px] text-text-secondary font-mono">stability</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-text-secondary font-mono">
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>Eye Contact</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-secondary" />
              <span>Stability</span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 w-full text-center border-t border-border pt-3">
            <div>
              <p className="text-xs text-text-secondary font-mono">Avg Pitch</p>
              <p className="text-sm font-bold font-mono text-text-primary">
                {averagePitch >= 0 ? '+' : ''}{averagePitch.toFixed(1)}°
              </p>
            </div>
            <div>
              <p className="text-xs text-text-secondary font-mono">Avg Yaw</p>
              <p className="text-sm font-bold font-mono text-text-primary">
                {averageYaw >= 0 ? '+' : ''}{averageYaw.toFixed(1)}°
              </p>
            </div>
          </div>
        </div>

        {/* Right: 2D Gaze Distribution Quadrant */}
        <div className="flex flex-col gap-3 p-5 rounded-2xl bg-bg-surface border border-border shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary font-mono uppercase tracking-widest">
              Gaze Distribution Map
            </span>
            <span className="text-xs text-text-secondary font-mono">
              {quadrantPoints.length} samples
            </span>
          </div>

          {/* SVG quadrant */}
          <div className="flex justify-center">
            <svg
              width={QUAD_W}
              height={QUAD_H}
              viewBox={`0 0 ${QUAD_W} ${QUAD_H}`}
              className="rounded-lg overflow-hidden border border-border"
              style={{ background: 'var(--bg-surface-alt)' }}
            >
              {/* Grid lines */}
              <line x1="100" y1="0" x2="100" y2={QUAD_H} stroke="var(--border)" strokeWidth="1" />
              <line x1="0" y1="100" x2={QUAD_W} y2="100" stroke="var(--border)" strokeWidth="1" />

              {/* Eye contact zone rect */}
              <rect
                x={toQX(-15)} y={toQY(12)}
                width={toQX(15) - toQX(-15)}
                height={toQY(-12) - toQY(12)}
                fill="var(--success)"
                fillOpacity="0.1"
                stroke="var(--success)"
                strokeOpacity="0.3"
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
                  opacity="0.75"
                />
              ))}

              {/* Axis labels */}
              <text x="102" y="10" fill="var(--text-secondary)" fontSize="9" fontFamily="monospace">Up</text>
              <text x="102" y={QUAD_H - 3} fill="var(--text-secondary)" fontSize="9" fontFamily="monospace">Down</text>
              <text x="3" y="98" fill="var(--text-secondary)" fontSize="9" fontFamily="monospace">L</text>
              <text x={QUAD_W - 12} y="98" fill="var(--text-secondary)" fontSize="9" fontFamily="monospace">R</text>

              {/* Center crosshair */}
              <circle cx="100" cy="100" r="3" fill="var(--success)" fillOpacity="0.5" />
            </svg>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 text-xs text-text-secondary font-mono">
            <div className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-success" /><span>Center</span></div>
            <div className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-warning" /><span>Off-center</span></div>
            <div className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-danger" /><span>Off-screen</span></div>
          </div>
        </div>
      </div>

      {/* ── Row 2: Distraction Event Timeline ───────────────────────────── */}
      <div className="rounded-2xl bg-bg-surface border border-border shadow-soft overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-xs text-text-secondary font-mono uppercase tracking-widest">
            Distraction Event Timeline
          </span>
          <span className="text-xs text-text-secondary font-mono">
            {distractionEvents.length} event{distractionEvents.length !== 1 ? 's' : ''} detected
          </span>
        </div>

        {distractionEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <span className="text-2xl" aria-hidden="true">🎯</span>
            <p className="text-xs text-success font-semibold flex items-center gap-1.5">
              <FaCheckCircle className="text-success text-xs" aria-hidden="true" />
              Excellent — no distraction events recorded
            </p>
            <p className="text-xs text-text-secondary font-mono">
              Sustained eye contact maintained throughout the session
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {distractionEvents.map((evt, idx) => {
              const style = SEVERITY_STYLE[evt.severity];
              return (
                <div key={idx} className={`flex items-start gap-3 px-4 py-3 ${style.bg} border-l-2 ${style.border}`}>
                  {/* Timeline dot + index */}
                  <div className="shrink-0 flex flex-col items-center gap-1 pt-0.5">
                    <div className={`h-5 w-5 rounded-full border flex items-center justify-center text-xs font-bold font-mono ${style.badge}`}>
                      {idx + 1}
                    </div>
                  </div>

                  {/* Event details */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold font-mono ${style.text}`}>
                        {DIRECTION_ICON[evt.direction] ?? evt.direction}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-bold border ${style.badge}`}>
                        {evt.severity}
                      </span>
                      <span className="text-xs text-text-secondary font-mono">
                        {evt.durationSeconds.toFixed(1)}s duration
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-secondary font-mono">
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
