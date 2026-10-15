'use client';

/**
 * EyeContactHUD
 * IVP Feature 2 SP2 — L2CS-Net Client-Side Integration
 *
 * Live interview HUD widget displaying:
 * - Circular focus ring gauge (real-time eye contact %)
 * - Active focus zone badge (CENTER_SCREEN / LOOKING_LEFT / etc.)
 * - Distraction warning banner (auto-shown when off-screen > 1.5s)
 */

import React, { useEffect, useState } from 'react';
import type { GazeFrameResult } from '@/types/index';

// ── Zone Display Config ───────────────────────────────────────────────────────
const ZONE_CONFIG: Record<
  GazeFrameResult['screenFocusZone'],
  { label: string; icon: string; color: string; ring: string; warning: boolean }
> = {
  CENTER_SCREEN:  { label: 'Eye Contact: Direct',         icon: '🟢', color: 'text-success', ring: 'var(--success)', warning: false },
  LOOKING_LEFT:   { label: 'Gaze: Off-Center',            icon: '⚠️', color: 'text-warning', ring: 'var(--warning)', warning: true  },
  LOOKING_RIGHT:  { label: 'Gaze: Off-Center',            icon: '⚠️', color: 'text-warning', ring: 'var(--warning)', warning: true  },
  LOOKING_UP:     { label: 'Gaze: Off-Center',            icon: '⚠️', color: 'text-warning', ring: 'var(--warning)', warning: false },
  LOOKING_DOWN:   { label: 'Gaze: Off-Center',            icon: '⚠️', color: 'text-warning', ring: 'var(--warning)', warning: true  },
  OFF_SCREEN:     { label: 'Warning: Secondary Screen',   icon: '🔴', color: 'text-danger',  ring: 'var(--danger)',  warning: true  },
};

// ── Ring math ─────────────────────────────────────────────────────────────────
const RING_R = 24;
const RING_C = 2 * Math.PI * RING_R; // ≈ 150.8

interface EyeContactHUDProps {
  currentFrame: GazeFrameResult | null;
  eyeContactPercentage: number; // 0–100, running average for this turn
  showDistraction: boolean;    // true when off-screen persists > 1.5s
}

export default function EyeContactHUD({
  currentFrame,
  eyeContactPercentage,
  showDistraction,
}: EyeContactHUDProps) {
  const [visible, setVisible] = useState(false);

  // Animate in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(t);
  }, []);

  if (!currentFrame) {
    // Camera not started or no frame yet — show collapsed placeholder
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-bg-surface-alt border border-border">
        <div className="h-1.5 w-1.5 rounded-full bg-text-secondary animate-pulse" aria-hidden="true" />
        <span className="text-xs text-text-secondary font-mono">Gaze tracker inactive</span>
      </div>
    );
  }

  const zone = ZONE_CONFIG[currentFrame.screenFocusZone];
  const pct = Math.min(100, Math.max(0, eyeContactPercentage));
  const offset = RING_C - (RING_C * pct) / 100;

  return (
    <div
      className={`flex flex-col gap-2 transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
    >
      {/* ── Main HUD pill ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-bg-surface border border-border shadow-soft">
        {/* Focus Ring Gauge */}
        <div className="relative shrink-0">
          <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
            <defs>
              <linearGradient id="gazeRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={zone.ring} />
                <stop offset="100%" stopColor={zone.ring} stopOpacity="0.5" />
              </linearGradient>
            </defs>
            {/* Track */}
            <circle cx="28" cy="28" r={RING_R} fill="none" stroke="var(--border)" strokeWidth="5" />
            {/* Progress arc */}
            <circle
              cx="28" cy="28" r={RING_R}
              fill="none"
              stroke="url(#gazeRingGrad)"
              strokeWidth="5"
              strokeDasharray={RING_C}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 28 28)"
              style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.3s ease' }}
            />
          </svg>
          {/* Percentage label */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xs font-bold font-mono ${zone.color}`}>
              {Math.round(pct)}%
            </span>
          </div>
        </div>

        {/* Zone info */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm" aria-hidden="true">{zone.icon}</span>
            <span className={`text-xs font-semibold truncate ${zone.color}`}>
              {zone.label}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-secondary font-mono">
            <span>P: {currentFrame.gazeAngles.pitchDegrees.toFixed(1)}°</span>
            <span>Y: {currentFrame.gazeAngles.yawDegrees.toFixed(1)}°</span>
            <span>conf: {(currentFrame.confidenceScore * 100).toFixed(0)}%</span>
          </div>
        </div>

        {/* Live pulse indicator */}
        <div className="shrink-0 flex flex-col items-center gap-0.5" aria-hidden="true">
          <div
            className="h-2 w-2 rounded-full"
            style={{
              background: zone.ring,
              boxShadow: `0 0 4px ${zone.ring}`,
              animation: 'pulse 1.2s infinite',
            }}
          />
          <span className="text-[10px] text-text-secondary font-mono font-bold">LIVE</span>
        </div>
      </div>

      {/* ── Distraction Warning Banner ───────────────────────────────── */}
      {showDistraction && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-danger/10 border border-danger/20 animate-pulse" role="alert">
          <span className="text-xs" aria-hidden="true">🔴</span>
          <span className="text-xs text-danger font-semibold font-mono">
            Gaze deviation detected — maintain screen focus
          </span>
        </div>
      )}
    </div>
  );
}
