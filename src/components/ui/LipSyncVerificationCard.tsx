'use client';

/**
 * LipSyncVerificationCard
 * IVP Feature 5 — SyncNet Post-Interview Anti-Spoofing Audit Dashboard
 *
 * Displays:
 * 1. Integrity Confidence Gauge (overallSyncScore) + Verification Status Badge
 * 2. Audio-Visual Cross-Correlation Curve (time series plot of offset Δt & distance D(v,a))
 * 3. Itemized Spoofing Audit Log table listing flagged events
 */

import React, { useMemo } from 'react';
import type { LipSyncSessionMetrics, SpoofingAlertEvent } from '@/types/index';

const RING_R = 48;
const RING_C = 2 * Math.PI * RING_R; // ≈ 301.6

function pctToOffset(pct: number) {
  return RING_C - (RING_C * Math.min(100, Math.max(0, pct))) / 100;
}

const REASON_CONFIG: Record<
  SpoofingAlertEvent['reason'],
  { label: string; icon: string; desc: string }
> = {
  LIP_AUDIO_MISMATCH:     { label: 'Lip-Audio Mismatch',     icon: '🔴', desc: 'High cross-modal L2 distance between visual lips and spoken audio' },
  EXCESSIVE_TIME_OFFSET:  { label: 'Excessive Latency Shift',icon: '⚠️', desc: 'Time-offset correlation Δt exceeds 250ms limit' },
  SYNTHETIC_VOICE_SUSPECTED:{ label: 'Synthetic Voice Flag',   icon: '🤖', desc: 'Acoustic feature mismatch against visual facial motion' },
};

interface LipSyncVerificationCardProps {
  metrics: LipSyncSessionMetrics;
}

export default function LipSyncVerificationCard({ metrics }: LipSyncVerificationCardProps) {
  const {
    overallSyncScore,
    averageOffsetMs,
    averageCrossModalDistance,
    totalWindowsAnalyzed,
    verificationStatus,
    spoofingAlerts,
    syncTrace,
  } = metrics;

  const scoreOffset = pctToOffset(overallSyncScore);

  // Time-series curve rendering (300x120 SVG)
  const chartPoints = useMemo(() => {
    if (syncTrace.length === 0) return { offsetPath: '', distPath: '' };
    const W = 300;
    const H = 120;
    const count = syncTrace.length;

    // Offset mapping: [-300ms, +300ms] -> Y in [0, H]
    const offY = (off: number) => H / 2 - (off / 300) * (H / 2 - 10);
    // Distance mapping: [0.5, 2.0] -> Y in [H, 0]
    const distY = (d: number) => H - ((d - 0.5) / 1.5) * (H - 20) - 10;

    const offsetCoords = syncTrace.map((w, i) => {
      const x = (i / Math.max(1, count - 1)) * W;
      const y = Math.min(H - 4, Math.max(4, offY(w.optimalOffsetMs)));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const distCoords = syncTrace.map((w, i) => {
      const x = (i / Math.max(1, count - 1)) * W;
      const y = Math.min(H - 4, Math.max(4, distY(w.crossModalDistance)));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return {
      offsetPath: `M ${offsetCoords.join(' L ')}`,
      distPath: `M ${distCoords.join(' L ')}`,
    };
  }, [syncTrace]);

  function fmtTime(ms: number) {
    const s = Math.round(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  }

  const isVerified = verificationStatus === 'VERIFIED_GENUINE';

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-heading font-bold text-white">
            Audio Presence & Latency Monitor
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Speech Activity Indicator · {totalWindowsAnalyzed} windows analyzed
          </p>
          <p className="text-[10px] text-gray-400 italic mt-0.5">
            Checks for audio signal presence and basic stream time alignment.
          </p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono border font-bold ${
          isVerified ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
        }`}>
          {isVerified ? '✓ VERIFIED GENUINE' : verificationStatus.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Row 1: Integrity Gauge + Cross-Correlation Curve */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Integrity Score Ring */}
        <div className="md:col-span-5 flex flex-col items-center justify-between p-5 rounded-2xl bg-[#060b14] border border-white/8 space-y-3">
          <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest self-start">
            Sync Integrity Confidence
          </span>

          <div className="relative h-36 w-36 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="72" cy="72" r={RING_R}
                stroke="rgba(255, 255, 255, 0.04)"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="72" cy="72" r={RING_R}
                stroke="url(#syncGrad)"
                strokeWidth="8"
                strokeDasharray={RING_C}
                strokeDashoffset={scoreOffset}
                strokeLinecap="round"
                fill="transparent"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
              <defs>
                <linearGradient id="syncGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-3xl font-heading font-extrabold text-white">
                {overallSyncScore.toFixed(0)}%
              </span>
              <span className="text-[9px] text-gray-500 font-mono">integrity</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full text-center border-t border-white/5 pt-3 font-mono">
            <div>
              <p className="text-[9px] text-gray-500">Mean Offset Δt</p>
              <p className="text-sm font-bold text-white">{averageOffsetMs >= 0 ? '+' : ''}{averageOffsetMs}ms</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-500">Cross-Modal D(v,a)</p>
              <p className="text-sm font-bold text-emerald-400">{averageCrossModalDistance.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Audio-Visual Cross-Correlation Time Series Plot */}
        <div className="md:col-span-7 flex flex-col justify-between p-5 rounded-2xl bg-[#060b14] border border-white/8 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">
              Audio-Visual Time-Series Correlation
            </span>
            <div className="flex items-center gap-4 text-[9px] font-mono">
              <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-emerald-400" /><span className="text-gray-400">Offset Δt</span></div>
              <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-indigo-400" /><span className="text-gray-400">Distance D(v,a)</span></div>
            </div>
          </div>

          <div className="flex justify-center">
            <svg
              width="300"
              height="120"
              viewBox="0 0 300 120"
              className="rounded-lg overflow-hidden w-full"
              style={{ background: '#030712' }}
            >
              {/* Zero-line offset guide */}
              <line x1="0" y1="60" x2="300" y2="60" stroke="rgba(255,255,255,0.08)" strokeDasharray="3,3" />

              {/* Offset curve (Green) */}
              {chartPoints.offsetPath && (
                <path d={chartPoints.offsetPath} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
              )}
              {/* Distance curve (Indigo) */}
              {chartPoints.distPath && (
                <path d={chartPoints.distPath} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="2,2" />
              )}

              {/* Axis labels */}
              <text x="5" y="15" fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="monospace">+Offset</text>
              <text x="5" y="115" fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="monospace">-Offset</text>
            </svg>
          </div>
        </div>
      </div>

      {/* Row 2: Spoofing Audit Log */}
      <div className="rounded-2xl bg-[#060b14] border border-white/8 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">
            Sync Window Analysis Log
          </span>
          <span className="text-[9px] text-gray-600 font-mono">
            {spoofingAlerts.length} anomaly event{spoofingAlerts.length !== 1 ? 's' : ''}
          </span>
        </div>

        {spoofingAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <span className="text-2xl">🛡️</span>
            <p className="text-[11px] text-emerald-400 font-semibold">
              Security Verification Passed — No Spoofing Anomalies Flagged
            </p>
            <p className="text-[10px] text-gray-600 font-mono">
              Spoken audio perfectly matches visual lip dynamics throughout the session
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {spoofingAlerts.map((evt, idx) => {
              const cfg = REASON_CONFIG[evt.reason] ?? {
                label: evt.reason,
                icon: '⚠️',
                desc: 'Lip-audio correlation anomaly',
              };

              return (
                <div key={idx} className="flex items-start justify-between px-4 py-3 bg-red-500/5 border-l-2 border-red-500/40">
                  <div className="space-y-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{cfg.icon}</span>
                      <span className="text-xs font-mono font-bold text-red-400">{cfg.label}</span>
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                        {evt.durationSeconds}s duration
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 font-mono">{cfg.desc}</p>
                    <p className="text-[9px] text-gray-500 font-mono">
                      Average Cross-Modal Distance D(v,a): <strong className="text-red-400">{evt.averageDistance}</strong>
                    </p>
                  </div>

                  <div className="text-right font-mono text-[10px] text-gray-500 shrink-0">
                    <span>{fmtTime(evt.startTimeMs)} → {fmtTime(evt.endTimeMs)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
