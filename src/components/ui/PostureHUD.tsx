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
  subjectDetected?: boolean;
}

export default function PostureHUD({
  currentFrame,
  latestGestureToast,
  subjectDetected,
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
        bg: 'bg-success/15 border-success/30 text-success',
      };
    } else if (latestGestureToast.type === 'HEAD_SHAKING') {
      config = {
        text: 'Hesitation Flag: Head Shaking Detected',
        icon: '❓',
        bg: 'bg-warning/15 border-warning/30 text-warning',
      };
    } else if (latestGestureToast.type === 'POSTURE_SLUMP') {
      config = {
        text: 'Posture Notice: Off-Center Posture Shift',
        icon: '⚠️',
        bg: 'bg-warning/15 border-warning/30 text-warning',
      };
    }

    setToastMessage(config);
    const timer = setTimeout(() => setToastMessage(null), 2500);
    return () => clearTimeout(timer);
  }, [latestGestureToast]);

  const isSubjectAbsent = subjectDetected === false || (currentFrame && currentFrame.isSubjectPresent === false);

  if (isSubjectAbsent) {
    return (
      <div className="flex flex-col gap-2 transition-all duration-300">
        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-danger/15 border border-danger/30 backdrop-blur-sm font-mono text-xs">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-danger animate-pulse" />
            <span className="text-danger font-bold">
              ⚠️ Alert: Subject Not Detected / Left Frame
            </span>
          </div>
          <span className="text-danger text-xs uppercase tracking-wider">Zero Presence</span>
        </div>
      </div>
    );
  }

  if (!currentFrame || !currentFrame.angles) {
    return null;
  }

  const isExcessive = currentFrame.detectedGesture === 'EXCESSIVE_MOTION';
  const isNod = currentFrame.detectedGesture === 'NODDING';
  const isShake = currentFrame.detectedGesture === 'HEAD_SHAKING';

  const yaw = Number.isFinite(currentFrame.angles?.yawDegrees) ? currentFrame.angles.yawDegrees.toFixed(0) : '0';
  const pitch = Number.isFinite(currentFrame.angles?.pitchDegrees) ? currentFrame.angles.pitchDegrees.toFixed(0) : '0';
  const roll = Number.isFinite(currentFrame.angles?.rollDegrees) ? currentFrame.angles.rollDegrees.toFixed(0) : '0';
  const me = Number.isFinite(currentFrame.motionEnergy) ? currentFrame.motionEnergy!.toFixed(1) : undefined;

  return (
    <div className="flex flex-col gap-2 transition-all duration-300">
      {/* ── Active Posture Badge ───────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-surface border border-border shadow-soft font-mono text-xs">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${isExcessive ? 'bg-warning animate-ping' : 'bg-success'}`} />
          <span className={isExcessive ? 'text-warning font-bold' : 'text-success font-semibold'}>
            {isExcessive
              ? '⚠️ Notice: Frequent Motion / Motion Spikes'
              : isNod
              ? '👍 Active Affirmation (Nodding)'
              : isShake
              ? '❓ Hesitation (Head Shaking)'
              : '🟢 Composure: Stable Posture'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-text-secondary text-xs">
          {me !== undefined && (
            <span className="text-text-secondary">ME: {me}</span>
          )}
          <span>Y: {yaw}°</span>
          <span>P: {pitch}°</span>
          <span>R: {roll}°</span>
        </div>
      </div>

      {/* ── Real-Time Floating Toast ───────────────────────────────── */}
      {toastMessage && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border shadow-lg backdrop-blur-md animate-bounce ${toastMessage.bg}`}>
          <span className="text-sm">{toastMessage.icon}</span>
          <span className="text-xs font-mono font-bold">{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
}
