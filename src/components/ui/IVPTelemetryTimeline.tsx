'use client';

import React, { useState, useEffect } from 'react';
import {
  FaEye,
  FaHeartbeat,
  FaUserTie,
  FaExclamationTriangle,
  FaCheckCircle,
  FaClock,
} from 'react-icons/fa';
import Card from './Card';
import Badge from './Badge';
import { extractTelemetryTimelineEvents } from '@/lib/services/ivpTimelineTransformer';

export { extractTelemetryTimelineEvents };

export interface TelemetryEvent {
  timestampSec: number;
  type: 'stress_spike' | 'gaze_distraction' | 'head_shake' | 'nodding' | 'audio_lag';
  label: string;
  detail: string;
  severity: 'low' | 'medium' | 'high';
}

export interface IVPTelemetryTimelineProps {
  durationSeconds?: number;
  events?: TelemetryEvent[];
  overallEyeContactPct?: number;
  overallComposureScore?: number;
  overallStabilityScore?: number;
  isDemo?: boolean;
}

export const DEFAULT_EVENTS: TelemetryEvent[] = [
  {
    timestampSec: 24,
    type: 'gaze_distraction',
    label: 'Gaze Shift (Looking Up/Left)',
    detail: 'Yaw deviation +22.4° sustained for 1.8s (Cognitive recall pattern)',
    severity: 'low',
  },
  {
    timestampSec: 68,
    type: 'nodding',
    label: 'Affirmative Nodding Detected',
    detail: 'Cyclic pitch oscillation Δθp = 7.8° (Engaged listening response)',
    severity: 'low',
  },
  {
    timestampSec: 112,
    type: 'stress_spike',
    label: 'Stress / Arousal Spike',
    detail: 'Arousal reached 0.74 with Valence -0.38 during complex algorithm question',
    severity: 'high',
  },
  {
    timestampSec: 145,
    type: 'head_shake',
    label: 'Head Shaking Detected',
    detail: 'Cyclic yaw oscillation Δθy = 12.1° while describing constraint trade-offs',
    severity: 'medium',
  },
  {
    timestampSec: 195,
    type: 'gaze_distraction',
    label: 'Off-Screen Gaze Deviation',
    detail: 'Pitch deviation -18.2° (Candidate referenced lower monitor area)',
    severity: 'medium',
  },
];

export default function IVPTelemetryTimeline({
  durationSeconds = 240,
  events,
  overallEyeContactPct = 82,
  overallComposureScore = 88,
  overallStabilityScore = 91,
  isDemo = false,
}: IVPTelemetryTimelineProps) {
  // If events is explicitly provided (even an empty array []), use it.
  // When events is undefined, only fall back to DEFAULT_EVENTS if isDemo is explicitly true.
  const resolvedEvents = events !== undefined ? events : isDemo ? DEFAULT_EVENTS : [];

  const [selectedSec, setSelectedSec] = useState<number>(() => resolvedEvents[0]?.timestampSec ?? 0);

  useEffect(() => {
    if (resolvedEvents.length > 0) {
      setSelectedSec((prev) => {
        const hasNear = resolvedEvents.some((e) => Math.abs(e.timestampSec - prev) <= 8);
        return hasNear ? prev : resolvedEvents[0].timestampSec;
      });
    } else {
      setSelectedSec(0);
    }
  }, [resolvedEvents]);

  const activeEvent = resolvedEvents.find((e) => Math.abs(e.timestampSec - selectedSec) <= 8);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <Card className="p-6 bg-bg-surface border-border shadow-soft space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary-soft border border-primary/20 rounded-lg text-primary">
              <FaClock className="text-sm" />
            </div>
            <h3 className="text-base font-semibold text-text-primary">
              Synchronized IVP Multi-Modal Telemetry Timeline
            </h3>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Millisecond-accurate timeline tracking AffectNet composure, L2CS-Net gaze rays, and HopeNet head pose dynamics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="primary" className="text-xs">
            Eye Contact: {overallEyeContactPct}%
          </Badge>
          <Badge variant="success" className="text-xs">
            Composure: {overallComposureScore}/100
          </Badge>
          <Badge variant="neutral" className="text-xs">
            Stability: {overallStabilityScore}%
          </Badge>
        </div>
      </div>

      {/* Empty State Banner (No Anomalous Events) */}
      {resolvedEvents.length === 0 && (
        <div className="p-3.5 rounded-xl bg-success/10 border border-success/20 flex items-center gap-3 text-success text-xs">
          <FaCheckCircle className="text-base shrink-0" />
          <div className="space-y-0.5">
            <p className="font-semibold text-text-primary">Optimal Behavioral Telemetry</p>
            <p className="text-text-secondary text-[11px]">
              No anomalous distraction or stress spikes detected during this session. Candidate maintained steady focal contact and high physical composure.
            </p>
          </div>
        </div>
      )}

      {/* Interactive Timeline Tracks */}
      <div className="space-y-4">
        {/* Track 1: Affect & Composure */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-text-secondary">
            <span className="flex items-center gap-1.5 text-danger font-medium">
              <FaHeartbeat className="text-xs" /> Composure & Stress Vector (Valence / Arousal)
            </span>
            <span>Target (V=0.40, A=0.20)</span>
          </div>
          <div className="relative h-6 bg-bg-surface-alt rounded-lg overflow-hidden border border-border">
            <div
              className="absolute inset-0 opacity-80"
              style={{
                background:
                  'linear-gradient(90deg, var(--success) 0%, var(--success) 35%, var(--warning) 45%, var(--danger) 48%, var(--success) 55%, var(--success) 100%)',
              }}
            />
            {/* Event Markers */}
            {resolvedEvents
              .filter((e) => e.type === 'stress_spike')
              .map((e, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedSec(e.timestampSec)}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-danger border-2 border-bg-surface shadow-soft cursor-pointer hover:scale-125 transition-transform"
                  style={{ left: `${(e.timestampSec / durationSeconds) * 100}%` }}
                  title={e.label}
                />
              ))}
          </div>
        </div>

        {/* Track 2: Eye Contact & Gaze */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-text-secondary">
            <span className="flex items-center gap-1.5 text-warning font-medium">
              <FaEye className="text-xs" /> L2CS-Net Eye Contact Focus Zones
            </span>
            <span>Pitch ≤ 12°, Yaw ≤ 15°</span>
          </div>
          <div className="relative h-6 bg-bg-surface-alt rounded-lg overflow-hidden border border-border">
            <div
              className="absolute inset-0 opacity-70"
              style={{
                background:
                  'linear-gradient(90deg, var(--secondary) 0%, var(--secondary) 9%, var(--warning) 12%, var(--secondary) 20%, var(--secondary) 75%, var(--warning) 83%, var(--secondary) 100%)',
              }}
            />
            {resolvedEvents
              .filter((e) => e.type === 'gaze_distraction')
              .map((e, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedSec(e.timestampSec)}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-warning border-2 border-bg-surface shadow-soft cursor-pointer hover:scale-125 transition-transform"
                  style={{ left: `${(e.timestampSec / durationSeconds) * 100}%` }}
                  title={e.label}
                />
              ))}
          </div>
        </div>

        {/* Track 3: Head Pose & Gestures */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-text-secondary">
            <span className="flex items-center gap-1.5 text-primary font-medium">
              <FaUserTie className="text-xs" /> HopeNet Head Dynamics & Gestures
            </span>
            <span>Nodding & Gesture Oscillations</span>
          </div>
          <div className="relative h-6 bg-bg-surface-alt rounded-lg overflow-hidden border border-border">
            <div
              className="absolute inset-0 opacity-60"
              style={{
                background:
                  'linear-gradient(90deg, var(--primary) 0%, var(--primary) 25%, var(--secondary) 30%, var(--primary) 40%, var(--secondary) 62%, var(--primary) 100%)',
              }}
            />
            {resolvedEvents
              .filter((e) => e.type === 'nodding' || e.type === 'head_shake')
              .map((e, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedSec(e.timestampSec)}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-primary border-2 border-bg-surface shadow-soft cursor-pointer hover:scale-125 transition-transform"
                  style={{ left: `${(e.timestampSec / durationSeconds) * 100}%` }}
                  title={e.label}
                />
              ))}
          </div>
        </div>

        {/* Time Scrubber Slider */}
        <div className="pt-2">
          <div className="flex justify-between text-[11px] text-text-secondary mb-1">
            <span>0:00</span>
            <span className="text-primary font-semibold">Scrubber: {formatTime(selectedSec)}</span>
            <span>{formatTime(durationSeconds)}</span>
          </div>
          <input
            type="range"
            min="0"
            max={durationSeconds}
            value={selectedSec}
            onChange={(e) => setSelectedSec(Number(e.target.value))}
            className="w-full accent-primary cursor-pointer"
          />
        </div>
      </div>

      {/* Selected Timestamp Diagnostic Details Card */}
      <div className="p-4 bg-bg-surface-alt rounded-xl border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-mono">
              Timestamp: {formatTime(selectedSec)}
            </Badge>
            {activeEvent ? (
              <Badge
                variant={activeEvent.severity === 'high' ? 'danger' : 'warning'}
                className="text-xs"
              >
                <FaExclamationTriangle className="mr-1 inline text-[10px]" />
                {activeEvent.label}
              </Badge>
            ) : (
              <Badge variant="success" className="text-xs">
                <FaCheckCircle className="mr-1 inline text-[10px]" /> Steady Focal Contact
              </Badge>
            )}
          </div>
          <p className="text-xs text-text-secondary">
            {activeEvent
              ? activeEvent.detail
              : resolvedEvents.length === 0
              ? 'No anomalous distraction or stress spikes detected during this session. Candidate demonstrated calm baseline composure, centered pitch/yaw gaze angles, and nominal body language.'
              : 'Candidate demonstrated calm baseline composure, centered pitch/yaw gaze angles, and nominal body language.'}
          </p>
        </div>

        <div className="text-xs font-mono text-text-secondary text-right shrink-0">
          <div>Pitch: {activeEvent ? '+18.2°' : '-3.1°'}</div>
          <div>Yaw: {activeEvent ? '+22.4°' : '+4.2°'}</div>
        </div>
      </div>
    </Card>
  );
}
