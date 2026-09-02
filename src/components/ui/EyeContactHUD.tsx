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
  CENTER_SCREEN:  { label: 'Eye Contact: Direct',         icon: '🟢', color: 'text-emerald-400', ring: '#10b981', warning: false },
  LOOKING_LEFT:   { label: 'Gaze: Looking Left',          icon: '⚠️', color: 'text-amber-400',   ring: '#f59e0b', warning: true  },
  LOOKING_RIGHT:  { label: 'Gaze: Looking Right',         icon: '⚠️', color: 'text-amber-400',   ring: '#f59e0b', warning: true  },
  LOOKING_UP:     { label: 'Gaze: Looking Up',            icon: '⚠️', color: 'text-amber-400',   ring: '#f59e0b', warning: false },
  LOOKING_DOWN:   { label: 'Gaze: Looking Down',          icon: '⚠️', color: 'text-amber-400',   ring: '#f59e0b', warning: true  },
  OFF_SCREEN:     { label: 'Warning: Secondary Screen',   icon: '🔴', color: 'text-red-400',     ring: '#ef4444', warning: true  },
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
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/3 border border-white/8">
        <div className="h-1.5 w-1.5 rounded-full bg-gray-600 animate-pulse" />
        <span className="text-[10px] text-gray-600 font-mono">Gaze tracker inactive</span>
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
      <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[#060b14]/90 border border-white/8 backdrop-blur-sm">
        {/* Focus Ring Gauge */}
        <div className="relative shrink-0">
          <svg width="56" height="56" viewBox="0 0 56 56">
            <defs>
              <linearGradient id="gazeRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={zone.ring} />
                <stop offset="100%" stopColor={zone.ring} stopOpacity="0.5" />
              </linearGradient>
            </defs>
            {/* Track */}
            <circle cx="28" cy="28" r={RING_R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
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
            <span className={`text-[10px] font-bold font-mono ${zone.color}`}>
              {Math.round(pct)}%
            </span>
          </div>
        </div>

        {/* Zone info */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{zone.icon}</span>
            <span className={`text-[11px] font-semibold truncate ${zone.color}`}>
              {zone.label}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[9px] text-gray-600 font-mono">
            <span>P: {currentFrame.gazeAngles.pitchDegrees.toFixed(1)}°</span>
            <span>Y: {currentFrame.gazeAngles.yawDegrees.toFixed(1)}°</span>
            <span>conf: {(currentFrame.confidenceScore * 100).toFixed(0)}%</span>
          </div>
        </div>

        {/* Live pulse indicator */}
        <div className="shrink-0 flex flex-col items-center gap-0.5">
          <div
            className="h-2 w-2 rounded-full"
            style={{
              background: zone.ring,
              boxShadow: `0 0 6px ${zone.ring}`,
              animation: 'pulse 1.2s infinite',
            }}
          />
          <span className="text-[7px] text-gray-700 font-mono">LIVE</span>
        </div>
      </div>

      {/* ── Distraction Warning Banner ───────────────────────────────── */}
      {showDistraction && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 animate-pulse">
          <span className="text-xs">🔴</span>
          <span className="text-[10px] text-red-400 font-semibold font-mono">
            Gaze deviation detected — maintain screen focus
          </span>
        </div>
      )}
    </div>
  );
}
