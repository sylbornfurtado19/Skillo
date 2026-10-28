'use client';

import React from 'react';
import {
  FaVideo,
  FaMicrophone,
  FaShieldAlt,
  FaClock,
  FaCircle,
  FaMicrochip,
} from 'react-icons/fa';
import Badge from '@/components/ui/Badge';

export interface SessionStatusBarProps {
  cameraActive: boolean;
  micActive: boolean;
  audioLevel?: number; // 0.0 to 1.0
  ivpStatus: 'active' | 'paused' | 'stopped';
  framesAnalyzed: number;
  samplingHz: number;
  integrityFlagsCount: number;
  currentQuestionIndex: number;
  totalQuestions: number;
  timeLeftSec: number;
  className?: string;
  /** Diagnostic engine status display. Defaults to false so it is removed from the candidate UI. */
  showIvpEngineChip?: boolean;
}

export default function SessionStatusBar({
  cameraActive,
  micActive,
  audioLevel = 0,
  ivpStatus,
  framesAnalyzed,
  samplingHz,
  integrityFlagsCount,
  currentQuestionIndex,
  totalQuestions,
  timeLeftSec,
  className = '',
  showIvpEngineChip = false,
}: SessionStatusBarProps) {
  const minutes = Math.floor(Math.max(0, timeLeftSec) / 60);
  const seconds = Math.max(0, timeLeftSec) % 60;
  const formattedTime = `${minutes}:${String(seconds).padStart(2, '0')}`;
  const isTimeCritical = timeLeftSec <= 30 && timeLeftSec > 0;

  // Render 4 small level bars for mic energy meter
  const clampedLevel = Math.max(0, Math.min(1, audioLevel));
  const activeBars = Math.round(clampedLevel * 4);

  return (
    <header
      role="banner"
      aria-label="Interview session status"
      data-testid="session-status-bar"
      className={`w-full bg-bg-surface border border-border/80 rounded-xl px-4 py-2.5 shadow-soft flex flex-wrap items-center justify-between gap-3 text-xs font-mono transition-colors ${className}`}
    >
      {/* Left group: Recording dot + Hardware status + Audio level meter */}
      <div className="flex items-center gap-3">
        {/* REC dot */}
        <div className="flex items-center gap-1.5 font-bold tracking-wider text-danger" title="Interview session is recorded for review">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-danger" />
          </span>
          <span>REC</span>
        </div>

        <div className="h-3.5 w-px bg-border" aria-hidden="true" />

        {/* Camera indicator */}
        <div
          className={`flex items-center gap-1.5 ${
            cameraActive ? 'text-success' : 'text-danger font-bold'
          }`}
          title={cameraActive ? 'Camera is active' : 'Camera is off'}
        >
          <FaVideo className="text-[11px]" aria-hidden="true" />
          <span className="hidden sm:inline">{cameraActive ? 'CAM ON' : 'CAM OFF'}</span>
        </div>

        {/* Microphone indicator + Level meter */}
        <div className="flex items-center gap-1.5" title={`Microphone ${micActive ? 'active' : 'off'}`}>
          <FaMicrophone
            className={`text-[11px] ${micActive ? 'text-success' : 'text-danger font-bold'}`}
            aria-hidden="true"
          />
          <span className={`hidden sm:inline ${micActive ? 'text-text-primary' : 'text-danger font-bold'}`}>
            {micActive ? 'MIC' : 'MIC OFF'}
          </span>
          {/* Audio level meter bars */}
          <div
            className="flex items-end gap-0.5 h-3 w-5 py-0.5"
            aria-label={`Microphone level: ${(clampedLevel * 100).toFixed(0)}%`}
            role="meter"
            aria-valuenow={Math.round(clampedLevel * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            {[1, 2, 3, 4].map((barIndex) => (
              <span
                key={barIndex}
                className={`w-1 rounded-sm transition-all duration-75 ${
                  barIndex <= activeBars && micActive
                    ? barIndex === 4
                      ? 'h-3 bg-warning'
                      : 'h-2 bg-success'
                    : 'h-1 bg-border'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Center group: Live IVP Engine Chip (diagnostic-only) + Integrity Status Chip */}
      <div className="flex items-center gap-2">
        {/* IVP Engine Chip (O4) - Hidden by default from candidate frontend */}
        {showIvpEngineChip && (
          <div
            data-testid="ivp-engine-status-chip"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
              ivpStatus === 'active'
                ? 'border-accent/40 bg-accent/10 text-accent'
                : ivpStatus === 'paused'
                ? 'border-warning/40 bg-warning/10 text-warning'
                : 'border-border bg-bg-surface-alt text-text-secondary'
            }`}
            title="On-device classical IVP engine running histogram equalization, Otsu mask, Sobel gradients, and temporal motion analysis"
          >
            <FaMicrochip className="text-[10px]" aria-hidden="true" />
            <span className="font-bold">IVP ENGINE</span>
            <FaCircle
              className={`text-[6px] ${
                ivpStatus === 'active'
                  ? 'text-accent animate-pulse'
                  : ivpStatus === 'paused'
                  ? 'text-warning'
                  : 'text-text-tertiary'
              }`}
              aria-hidden="true"
            />
            <span>
              {ivpStatus === 'active'
                ? `ACTIVE · ${framesAnalyzed} frames · ${samplingHz} Hz`
                : ivpStatus === 'paused'
                ? `PAUSED · ${framesAnalyzed} frames`
                : 'IDLE'}
            </span>
          </div>
        )}

        {/* Integrity status chip */}
        <div
          data-testid="session-integrity-chip"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
            integrityFlagsCount === 0
              ? 'border-success/30 bg-success/5 text-success'
              : integrityFlagsCount <= 2
              ? 'border-warning/40 bg-warning/10 text-warning'
              : 'border-danger/40 bg-danger/10 text-danger font-bold'
          }`}
          title={`${integrityFlagsCount} integrity event flags detected`}
        >
          <FaShieldAlt className="text-[10px]" aria-hidden="true" />
          <span>
            {integrityFlagsCount === 0
              ? 'Secure · 0 flags'
              : `${integrityFlagsCount} flag${integrityFlagsCount === 1 ? '' : 's'}`}
          </span>
        </div>
      </div>

      {/* Right group: Question counter + Countdown clock */}
      <div className="flex items-center gap-3">
        {/* Question Counter */}
        <div className="text-text-secondary font-medium">
          <span className="hidden sm:inline">Question </span>
          <span className="text-text-primary font-bold">
            {currentQuestionIndex + 1}
          </span>
          <span>/{totalQuestions}</span>
        </div>

        <div className="h-3.5 w-px bg-border" aria-hidden="true" />

        {/* Timer */}
        <div
          data-testid="session-timer-display"
          aria-live="polite"
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md font-bold text-sm tracking-tight ${
            isTimeCritical
              ? 'bg-danger/15 text-danger border border-danger/30 animate-pulse'
              : 'text-text-primary'
          }`}
          title="Time remaining for current question"
        >
          <FaClock className="text-xs" aria-hidden="true" />
          <span>{formattedTime}</span>
        </div>
      </div>
    </header>
  );
}
