'use client';

/**
 * AffectiveHUD
 * IVP Feature 4 — AffectNet Live UI HUD
 *
 * Displays:
 * 1. Mini 2D Valence-Arousal quadrant grid showing live (V, A) coordinate drift.
 * 2. Dynamic composure pill badge (Calm & Confident / Elevated Stress / Hesitation / Thinking).
 */

import React from 'react';
import type { AffectFrameResult } from '@/types/index';

interface AffectiveHUDProps {
  currentFrame: AffectFrameResult | null;
}

const EMOTION_BADGES: Record<
  string,
  { label: string; icon: string; color: string; bg: string }
> = {
  CONFIDENT: { label: 'Composure Signal (Beta): Calm',            icon: '🟢', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  STRESSED:  { label: 'Composure Signal (Beta): High Activation', icon: '⚠️', color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20'     },
  HESITANT:  { label: 'Composure Signal (Beta): Subtle Shift',    icon: '❓', color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
  THINKING:  { label: 'Composure Signal (Beta): Reflective',      icon: '💡', color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20'   },
  SURPRISED: { label: 'Composure Signal (Beta): Dynamic Arousal', icon: '😲', color: 'text-purple-400',  bg: 'bg-purple-500/10 border-purple-500/20'},
  NEUTRAL:   { label: 'Composure Signal (Beta): Baseline',        icon: '😐', color: 'text-gray-300',    bg: 'bg-white/5 border-white/10'           },
};

export default function AffectiveHUD({ currentFrame }: AffectiveHUDProps) {
  if (!currentFrame) return null;

  const { vaCoordinates, dominantEmotion, composureScore } = currentFrame;
  const badge = EMOTION_BADGES[dominantEmotion] ?? EMOTION_BADGES.NEUTRAL;

  // Map (V, A) in [-1, 1] x [-1, 1] to mini quadrant 48x48 px
  // V = X axis (left: -1, right: +1), A = Y axis (bottom: -1, top: +1)
  const dotX = Math.max(4, Math.min(44, 24 + vaCoordinates.valence * 20));
  const dotY = Math.max(4, Math.min(44, 24 - vaCoordinates.arousal * 20)); // Y inverted in SVG

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[#060b14]/90 border border-white/8 backdrop-blur-sm">
      {/* Mini V-A Quadrant SVG */}
      <div className="relative shrink-0">
        <svg width="48" height="48" viewBox="0 0 48 48" className="bg-black/40 rounded-lg border border-white/10">
          {/* Axis lines */}
          <line x1="24" y1="0" x2="24" y2="48" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <line x1="0" y1="24" x2="48" y2="24" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          {/* Ideal target zone dot */}
          <circle cx="32" cy="20" r="3" fill="rgba(16,185,129,0.3)" />
          {/* Current V-A coordinate dot */}
          <circle
            cx={dotX}
            cy={dotY}
            r="3.5"
            fill={badge.color.includes('emerald') ? '#10b981' : badge.color.includes('red') ? '#ef4444' : badge.color.includes('amber') ? '#f59e0b' : '#3b82f6'}
            className="transition-all duration-300"
          />
        </svg>
      </div>

      {/* Composure Pill & Metrics */}
      <div className="flex-1 space-y-1 text-left">
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-bold ${badge.bg} ${badge.color}`}>
          <span>{badge.icon}</span>
          <span>{badge.label}</span>
        </div>
        <div className="flex items-center gap-3 text-[9px] text-gray-500 font-mono">
          <span>V: {vaCoordinates.valence >= 0 ? '+' : ''}{vaCoordinates.valence.toFixed(2)}</span>
          <span>A: {vaCoordinates.arousal >= 0 ? '+' : ''}{vaCoordinates.arousal.toFixed(2)}</span>
          <span>Composure: <strong className="text-white">{composureScore.toFixed(0)}%</strong></span>
        </div>
      </div>
    </div>
  );
}
