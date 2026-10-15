'use client';

import React from 'react';

export interface WarmupWarningBannerProps {
  warning: string | null;
  onDismiss: () => void;
}

export default function WarmupWarningBanner({ warning, onDismiss }: WarmupWarningBannerProps) {
  if (!warning) return null;

  return (
    <div
      id="warmup-warning-banner"
      className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-warning/15 border border-warning/40 text-warning text-xs font-mono px-4 py-2 rounded-xl shadow-soft backdrop-blur-md flex items-center gap-2 animate-bounce max-w-[90%]"
    >
      <span className="text-warning font-bold">⚠</span>
      <span>{warning}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-2 text-warning/80 hover:text-text-primary text-[10px] cursor-pointer"
      >
        ✕
      </button>
    </div>
  );
}
