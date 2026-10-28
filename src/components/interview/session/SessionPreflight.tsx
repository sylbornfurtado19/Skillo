'use client';

import React, { useState } from 'react';
import {
  FaVideo,
  FaMicrophone,
  FaCheckCircle,
  FaTimesCircle,
  FaShieldAlt,
  FaLock,
  FaUserCheck,
  FaExpand,
  FaExclamationTriangle,
} from 'react-icons/fa';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { describeMediaError, type MediaReadiness } from '@/lib/media/mediaReadiness';

export interface SessionPreflightProps {
  readiness: MediaReadiness;
  errorName?: string | null;
  requesting: boolean;
  onEnableDevices: () => void;
  onBeginInterview: () => void;
  onBack: () => void;
  cameraStream?: MediaStream | null;
}

export default function SessionPreflight({
  readiness,
  errorName,
  requesting,
  onEnableDevices,
  onBeginInterview,
  onBack,
  cameraStream,
}: SessionPreflightProps) {
  const [fullscreenNotice, setFullscreenNotice] = useState<string | null>(null);
  const errorInfo = describeMediaError(errorName);
  const bothDevicesLive = readiness.cameraLive && readiness.microphoneLive;

  const handleBeginClick = async () => {
    // Attempt fullscreen from user gesture (D14)
    if (typeof document !== 'undefined' && document.documentElement.requestFullscreen) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (err) {
        console.warn('[SessionPreflight] Fullscreen request rejected or unavailable:', err);
        setFullscreenNotice('Fullscreen was declined or unavailable in your browser. Continuing in secure windowed mode.');
      }
    }
    onBeginInterview();
  };

  return (
    <div className="max-w-2xl mx-auto my-6 px-4" data-testid="session-preflight">
      <Card variant="default" className="space-y-6 text-left p-6 sm:p-8">
        {/* Header */}
        <div className="space-y-2 border-b border-border pb-5">
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm">
              <FaShieldAlt className="mr-1.5" />
              Proctored Placement Environment
            </Badge>
          </div>
          <h1 className="font-heading font-extrabold text-2xl text-text-primary tracking-tight">
            Interview Preflight &amp; Integrity Verification
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed">
            Welcome to your assessed placement interview. Before starting, verify your audiovisual
            hardware and review the exam integrity protocols.
          </p>
        </div>

        {/* Device Status Matrix */}
        <div className="space-y-3">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-text-secondary">
            Hardware Verification (Camera &amp; Microphone Required)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              className={`flex items-center justify-between p-3.5 rounded-xl border ${
                readiness.cameraLive ? 'border-success/40 bg-success/5' : 'border-border bg-bg-surface-alt'
              }`}
            >
              <div className="flex items-center gap-3">
                <FaVideo className={readiness.cameraLive ? 'text-success' : 'text-text-secondary'} />
                <span className="text-sm font-semibold text-text-primary">Camera Feed</span>
              </div>
              <span
                className={`text-xs font-bold uppercase flex items-center gap-1.5 ${
                  readiness.cameraLive ? 'text-success' : 'text-danger'
                }`}
              >
                {readiness.cameraLive ? <FaCheckCircle /> : <FaTimesCircle />}
                {readiness.cameraLive ? 'Live' : 'Required'}
              </span>
            </div>

            <div
              className={`flex items-center justify-between p-3.5 rounded-xl border ${
                readiness.microphoneLive ? 'border-success/40 bg-success/5' : 'border-border bg-bg-surface-alt'
              }`}
            >
              <div className="flex items-center gap-3">
                <FaMicrophone className={readiness.microphoneLive ? 'text-success' : 'text-text-secondary'} />
                <span className="text-sm font-semibold text-text-primary">Microphone Feed</span>
              </div>
              <span
                className={`text-xs font-bold uppercase flex items-center gap-1.5 ${
                  readiness.microphoneLive ? 'text-success' : 'text-danger'
                }`}
              >
                {readiness.microphoneLive ? <FaCheckCircle /> : <FaTimesCircle />}
                {readiness.microphoneLive ? 'Live' : 'Required'}
              </span>
            </div>
          </div>
        </div>

        {/* Camera Preview Thumbnail if Live */}
        {bothDevicesLive && cameraStream && (
          <div className="relative rounded-2xl overflow-hidden border border-border bg-black max-h-48 aspect-video mx-auto">
            <video
              ref={(videoEl) => {
                if (videoEl && videoEl.srcObject !== cameraStream) {
                  videoEl.srcObject = cameraStream;
                  videoEl.play().catch(() => {});
                }
              }}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover -scale-x-100"
            />
            <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-mono text-white flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              Camera verified
            </div>
          </div>
        )}

        {/* Media Access Error Message */}
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

        {fullscreenNotice && (
          <p className="text-xs text-warning bg-warning/10 border border-warning/30 p-3 rounded-xl">
            {fullscreenNotice}
          </p>
        )}

        {/* Privacy & Academic Fairness Accord (D8 & D9) */}
        <div className="rounded-xl border border-border/80 bg-bg-surface-alt/70 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-text-primary font-mono uppercase">
            <FaLock className="text-primary" />
            Privacy &amp; Fairness Guarantees
          </div>
          <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside leading-relaxed">
            <li>
              <strong className="text-text-primary">100% On-Device CV:</strong> Visual analysis runs strictly in your local browser thread/worker. No video or audio is ever uploaded or recorded.
            </li>
            <li>
              <strong className="text-text-primary">Evaluation Independence:</strong> Vision and delivery indicators provide physical feedback only and never change your technical problem-solving scores.
            </li>
            <li>
              <strong className="text-text-primary">Integrity Deterrence:</strong> Tab switches, window blurring, and text copying from questions are monitored and summarized on the assessment report.
            </li>
          </ul>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {!bothDevicesLive ? (
            <Button
              onClick={onEnableDevices}
              variant="primary"
              size="lg"
              disabled={requesting}
              className="sm:flex-1"
            >
              <FaUserCheck className="mr-2" />
              {requesting ? 'Requesting Permissions...' : 'Grant Camera & Microphone Access'}
            </Button>
          ) : (
            <Button
              onClick={handleBeginClick}
              variant="primary"
              size="lg"
              className="sm:flex-1 font-bold text-base shadow-lg"
              data-testid="begin-secure-interview-btn"
            >
              <FaExpand className="mr-2" />
              Begin Secure Interview
            </Button>
          )}

          <Button onClick={onBack} variant="ghost" size="lg">
            Back to Setup
          </Button>
        </div>
      </Card>
    </div>
  );
}
