'use client';

import React, { useEffect, useRef } from 'react';
import {
  FaExclamationTriangle,
  FaPlay,
  FaVideoSlash,
  FaMicrophoneSlash,
  FaWindowClose,
  FaExpand,
  FaShieldAlt,
  FaSync,
} from 'react-icons/fa';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import type { PauseReason } from '@/types/integrity';

export interface SessionIntegrityOverlayProps {
  reason: PauseReason | null;
  devicesReady: boolean;
  onEnableDevices?: () => void;
  onResume: () => void;
}

const PAUSE_REASON_DETAILS: Record<
  PauseReason,
  {
    title: string;
    description: string;
    actionInstruction: string;
    icon: React.ReactNode;
  }
> = {
  tab_hidden: {
    title: 'Interview Paused: Tab Switched',
    description:
      'You navigated away from the interview tab. In this proctored environment, tab switching is flagged and monitored.',
    actionInstruction:
      'Please return to this tab and press Resume to continue. The timer was frozen and no time was lost.',
    icon: <FaWindowClose className="text-warning text-3xl" />,
  },
  window_blur: {
    title: 'Interview Paused: Window Focus Lost',
    description:
      'The interview window lost focus (another window or application was activated).',
    actionInstruction:
      'Click back into the interview window and press Resume to continue.',
    icon: <FaWindowClose className="text-warning text-3xl" />,
  },
  fullscreen_exit: {
    title: 'Interview Paused: Fullscreen Exited',
    description:
      'The assessment environment requires an uninterrupted focused display.',
    actionInstruction:
      'Press Resume to re-enter fullscreen and continue your interview.',
    icon: <FaExpand className="text-warning text-3xl" />,
  },
  camera_off: {
    title: 'Interview Paused: Camera Disconnected',
    description:
      'Your camera video stream stopped or was unplugged.',
    actionInstruction:
      'Reconnect your camera and re-enable it to resume the interview.',
    icon: <FaVideoSlash className="text-danger text-3xl" />,
  },
  microphone_off: {
    title: 'Interview Paused: Microphone Disconnected',
    description:
      'Your audio input stream was muted or disconnected.',
    actionInstruction:
      'Reconnect your microphone and verify your audio inputs to resume.',
    icon: <FaMicrophoneSlash className="text-danger text-3xl" />,
  },
  permission_revoked: {
    title: 'Interview Paused: Media Permissions Revoked',
    description:
      'Camera or microphone permissions were revoked in your browser settings.',
    actionInstruction:
      'Re-grant audiovisual permissions in your browser URL bar and press Resume.',
    icon: <FaExclamationTriangle className="text-danger text-3xl" />,
  },
  navigation_attempt: {
    title: 'Interview Paused: Navigation Attempted',
    description:
      'You clicked an in-app navigation link or browser back button during an active interview.',
    actionInstruction:
      'External navigation during the exam is restricted. Press Resume to remain in your session.',
    icon: <FaShieldAlt className="text-warning text-3xl" />,
  },
  multi_tab: {
    title: 'Interview Paused: Multiple Tabs Detected',
    description:
      'A second interview instance was opened in another browser window or tab.',
    actionInstruction:
      'Close any duplicate interview tabs and press Resume to continue here.',
    icon: <FaExclamationTriangle className="text-danger text-3xl" />,
  },
  session_reload: {
    title: 'Interview Paused: Page Reloaded',
    description:
      'The page was refreshed. Your progress, answers, and remaining time have been preserved.',
    actionInstruction:
      'Verify your audio/video and press Resume to continue from where you left off.',
    icon: <FaSync className="text-primary text-3xl" />,
  },
};

export default function SessionIntegrityOverlay({
  reason,
  devicesReady,
  onEnableDevices,
  onResume,
}: SessionIntegrityOverlayProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const resumeButtonRef = useRef<HTMLButtonElement>(null);

  const fallbackReason: PauseReason = 'window_blur';
  const info = reason ? PAUSE_REASON_DETAILS[reason] ?? PAUSE_REASON_DETAILS[fallbackReason] : PAUSE_REASON_DETAILS[fallbackReason];

  const isDeviceIssue =
    reason === 'camera_off' ||
    reason === 'microphone_off' ||
    reason === 'permission_revoked';

  const canResume = !isDeviceIssue || devicesReady;

  // Accessible focus trap and auto-focus
  useEffect(() => {
    resumeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault(); // Prevent closing without pressing Resume
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="integrity-pause-title"
      aria-describedby="integrity-pause-desc"
      ref={dialogRef}
      data-testid="session-integrity-overlay"
    >
      <Card
        variant="default"
        className="max-w-lg w-full space-y-6 text-left p-6 sm:p-8 border-warning/40 shadow-2xl"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-warning/10 border border-warning/20 shrink-0">
            {info.icon}
          </div>
          <div className="space-y-1">
            <h2
              id="integrity-pause-title"
              className="text-lg font-heading font-extrabold text-text-primary"
            >
              {info.title}
            </h2>
            <p id="integrity-pause-desc" className="text-xs text-text-secondary leading-relaxed">
              {info.description}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-bg-surface-alt border border-border text-xs text-text-primary leading-relaxed">
          <strong className="block mb-1 font-mono uppercase text-text-secondary">Instructions</strong>
          {info.actionInstruction}
        </div>

        {isDeviceIssue && !devicesReady && onEnableDevices && (
          <div className="pt-1">
            <Button
              onClick={onEnableDevices}
              variant="secondary"
              size="md"
              className="w-full"
            >
              Re-acquire Camera &amp; Microphone
            </Button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            ref={resumeButtonRef}
            onClick={() => {
              if (canResume) {
                // If fullscreen exit, try to re-enter
                if (reason === 'fullscreen_exit' && document.documentElement.requestFullscreen) {
                  document.documentElement.requestFullscreen().catch(() => {});
                }
                onResume();
              }
            }}
            disabled={!canResume}
            className={`flex-1 inline-flex items-center justify-center px-5 py-3 rounded-xl font-bold text-sm transition shadow-md cursor-pointer ${
              canResume
                ? 'bg-primary text-text-on-primary hover:bg-primary-hover'
                : 'bg-border text-text-muted cursor-not-allowed'
            }`}
            data-testid="resume-interview-btn"
          >
            <FaPlay className="mr-2 text-xs" />
            Resume Interview
          </button>
        </div>
      </Card>
    </div>
  );
}
