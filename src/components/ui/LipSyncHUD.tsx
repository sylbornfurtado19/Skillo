'use client';

/**
 * LipSyncHUD
 * IVP Feature 5 — Audio Presence & Latency Live HUD
 *
 * Displays live audio-sync status:
 * - 🟢 Audio-Visual Sync: Verified Genuine
 * - 🟡 Sync Warning: Audio Lag (+120ms)
 * - ⚪ Sync Tracker: Audio Muted
 */

import React from 'react';
import type { SyncWindowResult } from '@/types/index';

interface LipSyncHUDProps {
  currentWindow: SyncWindowResult | null;
}

const BADGE_CONFIG: Record<
  SyncWindowResult['status'],
  { label: string; icon: string; bg: string; text: string }
> = {
  VERIFIED_GENUINE: {
    label: 'Audio-Visual Sync: Verified Genuine',
    icon: '🟢',
    bg: 'bg-success/10 border-success/20',
    text: 'text-success',
  },
  LATENCY_LAG_WARNING: {
    label: 'Sync Warning: Audio Lag',
    icon: '🟡',
    bg: 'bg-warning/10 border-warning/20',
    text: 'text-warning',
  },
  NO_AUDIO_DETECTED: {
    label: 'Sync Tracker: Audio Muted',
    icon: '⚪',
    bg: 'bg-surface-alt border-border',
    text: 'text-text-secondary',
  },
};

export default function LipSyncHUD({ currentWindow }: LipSyncHUDProps) {
  if (!currentWindow) return null;

  const cfg = BADGE_CONFIG[currentWindow.status];
  const offsetStr = `${currentWindow.optimalOffsetMs >= 0 ? '+' : ''}${currentWindow.optimalOffsetMs}ms`;

  return (
    <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-surface border border-border shadow-soft font-mono text-xs">
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-bold ${cfg.bg} ${cfg.text}`}>
        <span aria-hidden="true">{cfg.icon}</span>
        <span>{cfg.label}</span>
      </div>

      <div className="flex items-center gap-3 text-text-secondary text-xs">
        <span>Offset: <strong className="text-text-primary">{offsetStr}</strong></span>
        <span>D(v,a): <strong className="text-text-primary">{currentWindow.crossModalDistance.toFixed(2)}</strong></span>
      </div>
    </div>
  );
}
