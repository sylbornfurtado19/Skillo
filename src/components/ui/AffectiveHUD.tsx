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
  HAPPY:     { label: 'Composure Signal (Beta): Positive & Happy', icon: '😄', color: 'text-success',        bg: 'bg-success/10 border-success/20' },
  CONFIDENT: { label: 'Composure Signal (Beta): Calm',            icon: '🟢', color: 'text-success',        bg: 'bg-success/10 border-success/20' },
  STRESSED:  { label: 'Composure Signal (Beta): High Activation', icon: '⚠️', color: 'text-danger',         bg: 'bg-danger/10 border-danger/20'   },
  HESITANT:  { label: 'Composure Signal (Beta): Subtle Shift',    icon: '❓', color: 'text-warning',        bg: 'bg-warning/10 border-warning/20' },
  THINKING:  { label: 'Composure Signal (Beta): Reflective',      icon: '💡', color: 'text-info',           bg: 'bg-info/10 border-info/20'       },
  SURPRISED: { label: 'Composure Signal (Beta): Dynamic Arousal', icon: '😲', color: 'text-primary',        bg: 'bg-primary-soft border-primary/20'},
  NEUTRAL:   { label: 'Composure Signal (Beta): Baseline',        icon: '😐', color: 'text-text-secondary', bg: 'bg-surface-alt border-border'   },
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
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface border border-border shadow-soft">
      {/* Mini V-A Quadrant SVG */}
      <div className="relative shrink-0">
        <svg width="48" height="48" viewBox="0 0 48 48" className="bg-surface-alt rounded-lg border border-border">
          {/* Axis lines */}
          <line x1="24" y1="0" x2="24" y2="48" stroke="rgba(43,37,35,0.12)" strokeWidth="1" />
          <line x1="0" y1="24" x2="48" y2="24" stroke="rgba(43,37,35,0.12)" strokeWidth="1" />
          {/* Ideal target zone dot */}
          <circle cx="32" cy="20" r="3" fill="rgba(63,125,88,0.25)" />
          {/* Current V-A coordinate dot */}
          <circle
            cx={dotX}
            cy={dotY}
            r="3.5"
            fill={badge.color.includes('success') ? '#3F7D58' : badge.color.includes('danger') ? '#B3261E' : badge.color.includes('warning') ? '#C98A1B' : '#9B2218'}
            className="transition-all duration-300"
          />
        </svg>
      </div>

      {/* Composure Pill & Metrics */}
      <div className="flex-1 space-y-1 text-left">
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-mono font-bold ${badge.bg} ${badge.color}`}>
          <span aria-hidden="true">{badge.icon}</span>
          <span>{badge.label}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-text-secondary font-mono">
          <span>V: {vaCoordinates.valence >= 0 ? '+' : ''}{vaCoordinates.valence.toFixed(2)}</span>
          <span>A: {vaCoordinates.arousal >= 0 ? '+' : ''}{vaCoordinates.arousal.toFixed(2)}</span>
          <span>Composure: <strong className="text-text-primary">{composureScore.toFixed(0)}%</strong></span>
        </div>
      </div>
    </div>
  );
}
