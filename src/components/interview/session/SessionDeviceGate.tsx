'use client';

import React from 'react';
import { FaVideo, FaMicrophone, FaCheckCircle, FaTimesCircle, FaExclamationTriangle } from 'react-icons/fa';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { describeMediaError, type MediaReadiness } from '@/lib/media/mediaReadiness';

export interface SessionDeviceGateProps {
  readiness: MediaReadiness;
  /** DOMException name from the last failed getUserMedia call, if any. */
  errorName?: string | null;
  requesting: boolean;
  /** True when the interview had already started and a device was lost mid-session. */
  interrupted?: boolean;
  onEnable: () => void;
  onBack: () => void;
}

function DeviceRow({ label, on, icon }: { label: string; on: boolean; icon: React.ReactNode }) {
  return (
    <li
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
        on ? 'border-success/40 bg-success/5' : 'border-border bg-bg-surface-alt'
      }`}
    >
      <span className="flex items-center gap-3 text-sm font-semibold text-text-primary">
        <span className="text-text-secondary" aria-hidden="true">{icon}</span>
        {label}
      </span>
      <span
        className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${
          on ? 'text-success' : 'text-danger'
        }`}
      >
        {on ? <FaCheckCircle aria-hidden="true" /> : <FaTimesCircle aria-hidden="true" />}
        {on ? 'On' : 'Off'}
      </span>
    </li>
  );
}

/**
 * Blocks the interview until BOTH camera and microphone are on.
 * Also shown if either device drops out during the interview (the session is paused).
 */
export default function SessionDeviceGate({
  readiness,
  errorName,
  requesting,
  interrupted = false,
  onEnable,
  onBack,
}: SessionDeviceGateProps) {
  const errorInfo = describeMediaError(errorName);

  return (
    <div className="max-w-xl mx-auto mt-10" data-testid="device-gate">
      <Card variant="default" className="space-y-5 text-left" role="alertdialog" aria-labelledby="device-gate-title">
        <div className="space-y-2">
          <h2 id="device-gate-title" className="font-heading font-extrabold text-xl text-text-primary">
            {interrupted ? 'Interview paused: a device turned off' : 'Turn on your camera and microphone to begin'}
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            {interrupted
              ? 'Your camera or microphone stopped working, so the interview is paused. Your answer so far is kept. Turn both back on and the question will be read again.'
              : 'The interviewer asks questions out loud and needs to see and hear you. The interview will not start until both are on.'}
          </p>
        </div>

        <ul className="space-y-2" aria-live="polite">
          <DeviceRow label="Camera" on={readiness.cameraLive} icon={<FaVideo />} />
          <DeviceRow label="Microphone" on={readiness.microphoneLive} icon={<FaMicrophone />} />
        </ul>

        {errorInfo && (
          <div
            className="flex gap-3 rounded-xl border border-danger/40 bg-danger/5 p-4"
            role="alert"
          >
            <FaExclamationTriangle className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-text-primary">{errorInfo.title}</p>
              <p className="text-xs text-text-secondary leading-relaxed">{errorInfo.detail}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <Button onClick={onEnable} variant="primary" size="md" disabled={requesting} className="sm:flex-1">
            {requesting ? 'Waiting for permission...' : 'Enable camera & microphone'}
          </Button>
          <Button onClick={onBack} variant="ghost" size="md">
            Back to setup
          </Button>
        </div>
      </Card>
    </div>
  );
}
