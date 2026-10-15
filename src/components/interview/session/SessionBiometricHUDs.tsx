'use client';

import React from 'react';
import AdaptiveHUDHeader from '@/components/ui/AdaptiveHUDHeader';
import EyeContactHUD from '@/components/ui/EyeContactHUD';
import PostureHUD from '@/components/ui/PostureHUD';
import AffectiveHUD from '@/components/ui/AffectiveHUD';
import LipSyncHUD from '@/components/ui/LipSyncHUD';
import type {
  GazeFrameResult,
  HeadPoseFrameResult,
  AffectFrameResult,
  SyncWindowResult,
} from '@/types/index';

export interface SessionBiometricHUDsProps {
  liveGazeFrame: GazeFrameResult | null;
  gazeEyeContactPct: number;
  showGazeWarning: boolean;
  livePoseFrame: HeadPoseFrameResult | null;
  latestGestureToast: {
    type: 'NODDING' | 'HEAD_SHAKING' | 'POSTURE_SLUMP';
    timestampMs: number;
  } | null;
  liveAffectFrame: AffectFrameResult | null;
  liveSyncWindow: SyncWindowResult | null;
}

export default function SessionBiometricHUDs({
  liveGazeFrame,
  gazeEyeContactPct,
  showGazeWarning,
  livePoseFrame,
  latestGestureToast,
  liveAffectFrame,
  liveSyncWindow,
}: SessionBiometricHUDsProps) {
  return (
    <>
      {/* LATS Adaptive Questioning HUD Indicator */}
      <AdaptiveHUDHeader className="mt-4" />

      {/* L2CS-Net Live Gaze HUD */}
      <div className="mt-3">
        <EyeContactHUD
          currentFrame={liveGazeFrame}
          eyeContactPercentage={gazeEyeContactPct}
          showDistraction={showGazeWarning}
        />
      </div>

      {/* HopeNet Live Posture HUD */}
      <div className="mt-2">
        <PostureHUD
          currentFrame={livePoseFrame}
          latestGestureToast={latestGestureToast}
        />
      </div>

      {/* AffectNet Live Affective HUD */}
      <div className="mt-2">
        <AffectiveHUD currentFrame={liveAffectFrame} />
      </div>

      {/* SyncNet Live Anti-Spoofing HUD */}
      <div className="mt-2">
        <LipSyncHUD currentWindow={liveSyncWindow} />
      </div>
    </>
  );
}
