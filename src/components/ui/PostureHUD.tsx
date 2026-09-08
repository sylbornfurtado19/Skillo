'use client';

/**
 * PostureHUD
 * IVP Feature 3 SP2 — HopeNet Client-Side Integration
 *
 * Live interview HUD widget displaying:
 * - Active posture badge (Stable Posture / Frequent Motion / Slumping)
 * - Real-time gestural detection toasts (Nodding / Head Shaking)
 */

import React, { useEffect, useState } from 'react';
import type { HeadPoseFrameResult } from '@/types/index';

interface PostureHUDProps {
  currentFrame: HeadPoseFrameResult | null;
  latestGestureToast?: {
    type: 'NODDING' | 'HEAD_SHAKING' | 'POSTURE_SLUMP';
    timestampMs: number;
  } | null;
}

export default function PostureHUD({
  currentFrame,
  latestGestureToast,
}: PostureHUDProps) {
  const [toastMessage, setToastMessage] = useState<{ text: string; icon: string; bg: string } | null>(null);

  // Auto-dismiss gesture toasts after 2.5s
  useEffect(() => {
    if (!latestGestureToast) return;

    let config = { text: '', icon: '', bg: '' };
    if (latestGestureToast.type === 'NODDING') {
      config = {
        text: 'Gestural Affirmation: Nodding Detected',
        icon: '👍',
        bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
      };
    } else if (latestGestureToast.type === 'HEAD_SHAKING') {
      config = {
        text: 'Hesitation Flag: Head Shaking Detected',
        icon: '❓',
        bg: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
      };
    } else if (latestGestureToast.type === 'POSTURE_SLUMP') {
      config = {
        text: 'Posture Notice: Off-Center Posture Shift',
        icon: '⚠️',
        bg: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
      };
    }

    setToastMessage(config);
    const timer = setTimeout(() => setToastMessage(null), 2500);
    return () => clearTimeout(timer);
  }, [latestGestureToast]);

  if (!currentFrame) {
    return null;
  }

  const isExcessive = currentFrame.detectedGesture === 'EXCESSIVE_MOTION';
  const isNod = currentFrame.detectedGesture === 'NODDING';
  const isShake = currentFrame.detectedGesture === 'HEAD_SHAKING';

  return (
    <div className="flex flex-col gap-2 transition-all duration-300">
      {/* ── Active Posture Badge ───────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#060b14]/90 border border-white/8 backdrop-blur-sm font-mono text-[10px]">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${isExcessive ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
          <span className={isExcessive ? 'text-amber-400 font-bold' : 'text-emerald-400 font-semibold'}>
            {isExcessive
              ? '⚠️ Notice: Frequent Motion / Motion Spikes'
              : isNod
              ? '👍 Active Affirmation (Nodding)'
              : isShake
              ? '❓ Hesitation (Head Shaking)'
              : '🟢 Composure: Stable Posture'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-gray-500 text-[9px]">
          <span>Y: {currentFrame.angles.yawDegrees.toFixed(0)}°</span>
          <span>P: {currentFrame.angles.pitchDegrees.toFixed(0)}°</span>
          <span>R: {currentFrame.angles.rollDegrees.toFixed(0)}°</span>
        </div>
      </div>

      {/* ── Real-Time Floating Toast ───────────────────────────────── */}
      {toastMessage && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border shadow-lg backdrop-blur-md animate-bounce ${toastMessage.bg}`}>
          <span className="text-sm">{toastMessage.icon}</span>
          <span className="text-[11px] font-mono font-bold">{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
}
