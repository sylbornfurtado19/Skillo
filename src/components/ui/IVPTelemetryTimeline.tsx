'use client';

import React, { useState } from 'react';
import {
  FaEye,
  FaHeartbeat,
  FaUserTie,
  FaMicrophone,
  FaExclamationTriangle,
  FaCheckCircle,
  FaClock,
} from 'react-icons/fa';
import Card from './Card';
import Badge from './Badge';

export interface TelemetryEvent {
  timestampSec: number;
  type: 'stress_spike' | 'gaze_distraction' | 'head_shake' | 'nodding' | 'audio_lag';
  label: string;
  detail: string;
  severity: 'low' | 'medium' | 'high';
}

interface IVPTelemetryTimelineProps {
  durationSeconds?: number;
  events?: TelemetryEvent[];
  overallEyeContactPct?: number;
  overallComposureScore?: number;
  overallStabilityScore?: number;
}

const DEFAULT_EVENTS: TelemetryEvent[] = [
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
  events = DEFAULT_EVENTS,
  overallEyeContactPct = 82,
  overallComposureScore = 88,
  overallStabilityScore = 91,
}: IVPTelemetryTimelineProps) {
  const [selectedSec, setSelectedSec] = useState<number>(112);

  const activeEvent = events.find((e) => Math.abs(e.timestampSec - selectedSec) <= 8);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <Card className="p-6 bg-slate-900/90 border-slate-800 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600/20 border border-indigo-500/30 rounded-lg text-indigo-400">
              <FaClock className="text-sm" />
            </div>
            <h3 className="text-base font-semibold text-slate-100">
              Synchronized IVP Multi-Modal Telemetry Timeline
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
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
          <Badge variant="accent" className="text-xs">
            Stability: {overallStabilityScore}%
          </Badge>
        </div>
      </div>

      {/* Interactive Timeline Tracks */}
      <div className="space-y-4">
        {/* Track 1: Affect & Composure */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-rose-400 font-medium">
              <FaHeartbeat className="text-xs" /> Composure & Stress Vector (Valence / Arousal)
            </span>
            <span>Target (V=0.40, A=0.20)</span>
          </div>
          <div className="relative h-6 bg-slate-950 rounded-lg overflow-hidden border border-slate-800/80">
            <div
              className="absolute inset-0 opacity-80"
              style={{
                background:
                  'linear-gradient(90deg, #10b981 0%, #10b981 35%, #f59e0b 45%, #ef4444 48%, #10b981 55%, #10b981 100%)',
              }}
            />
            {/* Event Markers */}
            {events
              .filter((e) => e.type === 'stress_spike')
              .map((e, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedSec(e.timestampSec)}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-rose-500 border-2 border-white shadow-lg cursor-pointer hover:scale-125 transition-transform"
                  style={{ left: `${(e.timestampSec / durationSeconds) * 100}%` }}
                  title={e.label}
                />
              ))}
          </div>
        </div>

        {/* Track 2: Eye Contact & Gaze */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-amber-400 font-medium">
              <FaEye className="text-xs" /> L2CS-Net Eye Contact Focus Zones
            </span>
            <span>Pitch ≤ 12°, Yaw ≤ 15°</span>
          </div>
          <div className="relative h-6 bg-slate-950 rounded-lg overflow-hidden border border-slate-800/80">
            <div
              className="absolute inset-0 opacity-70"
              style={{
                background:
                  'linear-gradient(90deg, #3b82f6 0%, #3b82f6 9%, #f59e0b 12%, #3b82f6 20%, #3b82f6 75%, #f59e0b 83%, #3b82f6 100%)',
              }}
            />
            {events
              .filter((e) => e.type === 'gaze_distraction')
              .map((e, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedSec(e.timestampSec)}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-slate-900 shadow cursor-pointer hover:scale-125 transition-transform"
                  style={{ left: `${(e.timestampSec / durationSeconds) * 100}%` }}
                  title={e.label}
                />
              ))}
          </div>
        </div>

        {/* Track 3: Head Pose & Gestures */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-cyan-400 font-medium">
              <FaUserTie className="text-xs" /> HopeNet Head Dynamics & Gestures
            </span>
            <span>Nodding & Gesture Oscillations</span>
          </div>
          <div className="relative h-6 bg-slate-950 rounded-lg overflow-hidden border border-slate-800/80">
            <div
              className="absolute inset-0 opacity-60"
              style={{
                background:
                  'linear-gradient(90deg, #06b6d4 0%, #06b6d4 25%, #8b5cf6 30%, #06b6d4 40%, #8b5cf6 62%, #06b6d4 100%)',
              }}
            />
            {events
              .filter((e) => e.type === 'nodding' || e.type === 'head_shake')
              .map((e, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedSec(e.timestampSec)}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-slate-900 shadow cursor-pointer hover:scale-125 transition-transform"
                  style={{ left: `${(e.timestampSec / durationSeconds) * 100}%` }}
                  title={e.label}
                />
              ))}
          </div>
        </div>

        {/* Time Scrubber Slider */}
        <div className="pt-2">
          <div className="flex justify-between text-[11px] text-slate-400 mb-1">
            <span>0:00</span>
            <span className="text-indigo-400 font-semibold">Scrubber: {formatTime(selectedSec)}</span>
            <span>{formatTime(durationSeconds)}</span>
          </div>
          <input
            type="range"
            min="0"
            max={durationSeconds}
            value={selectedSec}
            onChange={(e) => setSelectedSec(Number(e.target.value))}
            className="w-full accent-indigo-500 cursor-pointer"
          />
        </div>
      </div>

      {/* Selected Timestamp Diagnostic Details Card */}
      <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
          <p className="text-xs text-slate-300">
            {activeEvent
              ? activeEvent.detail
              : 'Candidate demonstrated calm baseline composure, centered pitch/yaw gaze angles, and nominal body language.'}
          </p>
        </div>

        <div className="text-xs font-mono text-slate-400 text-right shrink-0">
          <div>Pitch: {activeEvent ? '+18.2°' : '-3.1°'}</div>
          <div>Yaw: {activeEvent ? '+22.4°' : '+4.2°'}</div>
        </div>
      </div>
    </Card>
  );
}
