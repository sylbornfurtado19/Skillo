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
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    text: 'text-emerald-400',
  },
  LATENCY_LAG_WARNING: {
    label: 'Sync Warning: Audio Lag',
    icon: '🟡',
    bg: 'bg-amber-500/10 border-amber-500/20',
    text: 'text-amber-400',
  },
  NO_AUDIO_DETECTED: {
    label: 'Sync Tracker: Audio Muted',
    icon: '⚪',
    bg: 'bg-white/5 border-white/10',
    text: 'text-gray-400',
  },
};

export default function LipSyncHUD({ currentWindow }: LipSyncHUDProps) {
  if (!currentWindow) return null;

  const cfg = BADGE_CONFIG[currentWindow.status];
  const offsetStr = `${currentWindow.optimalOffsetMs >= 0 ? '+' : ''}${currentWindow.optimalOffsetMs}ms`;

  return (
    <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#060b14]/90 border border-white/8 backdrop-blur-sm font-mono text-[10px]">
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${cfg.bg} ${cfg.text}`}>
        <span>{cfg.icon}</span>
        <span>{cfg.label}</span>
      </div>

      <div className="flex items-center gap-3 text-gray-500 text-[9px]">
        <span>Offset: <strong className="text-white">{offsetStr}</strong></span>
        <span>D(v,a): <strong className="text-white">{currentWindow.crossModalDistance.toFixed(2)}</strong></span>
      </div>
    </div>
  );
}
