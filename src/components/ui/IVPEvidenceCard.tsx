'use client';

import React, { useState } from 'react';
import {
  FaMicrochip,
  FaCheckCircle,
  FaInfoCircle,
  FaCopy,
  FaCheck,
  FaFileContract,
  FaLock,
} from 'react-icons/fa';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import type { IVPEvidenceReceipt } from '@/types/ivpEvidence';

export interface IVPEvidenceCardProps {
  evidence?: IVPEvidenceReceipt | null;
  observations?: Array<{ evidenceId: string; observation: string }> | null;
  className?: string;
}

export default function IVPEvidenceCard({
  evidence,
  observations,
  className = '',
}: IVPEvidenceCardProps) {
  const [copiedDigest, setCopiedDigest] = useState(false);

  if (!evidence) {
    return (
      <Card variant="default" className={`p-6 bg-bg-surface border-border shadow-soft text-center space-y-3 ${className}`}>
        <div className="flex justify-center">
          <div className="p-3 bg-neutral/10 rounded-full text-text-secondary">
            <FaMicrochip className="text-xl" />
          </div>
        </div>
        <h3 className="text-base font-semibold text-text-primary">
          Classical IVP Evidence Not Recorded
        </h3>
        <p className="text-xs text-text-secondary max-w-md mx-auto">
          Classical on-device image and video processing evidence was not recorded for this session.
          Practice in the live interview to generate cryptographic edge receipts.
        </p>
      </Card>
    );
  }

  const handleCopyDigest = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(evidence.digestSha256);
        setCopiedDigest(true);
        setTimeout(() => setCopiedDigest(false), 2000);
      }
    } catch {
      // Ignored
    }
  };

  const shortDigest = `${evidence.digestSha256.slice(0, 10)}...${evidence.digestSha256.slice(-8)}`;

  return (
    <Card
      variant="default"
      data-testid="ivp-evidence-card"
      className={`p-6 bg-bg-surface border-border shadow-soft space-y-6 text-left ${className}`}
    >
      {/* Header with Title and Evaluator Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/20 text-accent">
            <FaMicrochip className="text-xl" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-heading font-extrabold text-text-primary tracking-tight">
                Classical IVP Evidence Receipt
              </h3>
              <Badge variant="primary" size="sm" className="font-mono text-[10px]">
                {evidence.kernelVersion}
              </Badge>
            </div>
            <p className="text-xs text-text-secondary">
              Deterministic on-device sensor telemetry with cryptographic SHA-256 seal
            </p>
          </div>
        </div>

        {/* Consumed by Evaluator Badge (O5) */}
        <div>
          {evidence.consumedByEvaluator ? (
            <Badge variant="success" size="md" className="flex items-center gap-1.5 font-mono text-xs">
              <FaCheckCircle aria-hidden="true" />
              <span>Consumed by AI Evaluator</span>
            </Badge>
          ) : (
            <Badge variant="neutral" size="md" className="flex items-center gap-1.5 font-mono text-xs">
              <FaInfoCircle aria-hidden="true" />
              <span>Telemetry Preserved (Unconsumed)</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
        <div className="rounded-xl border border-border bg-bg-surface-alt/50 p-3 space-y-1">
          <span className="text-[10px] uppercase text-text-secondary font-bold tracking-wider">Frames Analyzed</span>
          <div className="text-base font-extrabold text-text-primary">{evidence.framesAnalyzed}</div>
          <span className="text-[10px] text-text-tertiary">@ ~{evidence.samplingHz} Hz cadence</span>
        </div>

        <div className="rounded-xl border border-border bg-bg-surface-alt/50 p-3 space-y-1">
          <span className="text-[10px] uppercase text-text-secondary font-bold tracking-wider">Avg Latency</span>
          <div className="text-base font-extrabold text-accent">{evidence.avgKernelMs.toFixed(1)} ms</div>
          <span className="text-[10px] text-text-tertiary">Single-thread CPU budget</span>
        </div>

        <div className="rounded-xl border border-border bg-bg-surface-alt/50 p-3 space-y-1">
          <span className="text-[10px] uppercase text-text-secondary font-bold tracking-wider">Kernel Executions</span>
          <div className="text-base font-extrabold text-text-primary">
            {Object.values(evidence.kernelCounts).reduce((a, b) => a + b, 0)}
          </div>
          <span className="text-[10px] text-text-tertiary">5 classical pipelines</span>
        </div>

        <div className="rounded-xl border border-border bg-bg-surface-alt/50 p-3 space-y-1">
          <span className="text-[10px] uppercase text-text-secondary font-bold tracking-wider">Cryptographic Seal</span>
          <div className="flex items-center justify-between">
            <span className="font-bold text-text-primary text-[11px] truncate" title={evidence.digestSha256}>
              {shortDigest}
            </span>
            <button
              type="button"
              onClick={handleCopyDigest}
              aria-label="Copy SHA-256 digest"
              className="p-1 hover:text-accent transition-colors ml-1"
            >
              {copiedDigest ? <FaCheck className="text-success text-xs" /> : <FaCopy className="text-xs" />}
            </button>
          </div>
          <span className="text-[10px] text-text-tertiary">SHA-256 client seal</span>
        </div>
      </div>

      {/* Per-Question Evidence Table */}
      <div className="space-y-2">
        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-text-secondary">
          Per-Question Sensor Analysis
        </h4>
        <div className="overflow-x-auto rounded-xl border border-border bg-bg-surface-alt/20">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-bg-surface-alt text-text-secondary text-[11px]">
                <th className="py-2.5 px-3 font-semibold">Evidence ID</th>
                <th className="py-2.5 px-3 font-semibold">Question</th>
                <th className="py-2.5 px-3 font-semibold">Illumination</th>
                <th className="py-2.5 px-3 font-semibold">Face Presence</th>
                <th className="py-2.5 px-3 font-semibold">Sharpness</th>
                <th className="py-2.5 px-3 font-semibold">Motion Energy</th>
                <th className="py-2.5 px-3 font-semibold">Dynamics</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {evidence.perQuestion.map((q) => (
                <tr key={q.evidenceId} className="hover:bg-bg-surface-alt/40 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-accent">{q.evidenceId}</td>
                  <td className="py-2.5 px-3 text-text-primary">Q{q.questionIndex + 1}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        q.illumination === 'ok'
                          ? 'bg-success/10 text-success'
                          : 'bg-warning/10 text-warning'
                      }`}
                    >
                      {q.illumination}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-text-secondary">
                    {q.presenceRatio !== null && q.presenceRatio !== undefined
                      ? `${(q.presenceRatio * 100).toFixed(0)}% (skin: ${q.skinMaskCoveragePct}%)`
                      : `Unknown (skin: ${q.skinMaskCoveragePct}%)`}
                  </td>
                  <td className="py-2.5 px-3 text-text-secondary">{q.sharpnessScore.toFixed(0)} / 100</td>
                  <td className="py-2.5 px-3 text-text-secondary">{q.motionEnergy.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-text-tertiary text-[11px]">
                    {q.blinkRatePerMin !== undefined ? `${q.blinkRatePerMin} blk/m` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Evaluator Delivery Commentary (O5) */}
      {observations && observations.length > 0 && (
        <div className="space-y-2 border-t border-border/80 pt-4">
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
            <FaFileContract className="text-accent" />
            AI Evaluator Delivery Observations
          </h4>
          <div className="space-y-2">
            {observations.map((obs, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 p-3 rounded-lg border border-border bg-bg-surface-alt/40 text-xs"
              >
                <Badge variant="accent" size="sm" className="font-mono mt-0.5 text-[10px]">
                  {obs.evidenceId}
                </Badge>
                <p className="text-text-primary leading-relaxed font-sans">{obs.observation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Privacy Notice (D9) */}
      <div className="flex items-center gap-2 p-3 rounded-lg border border-border/60 bg-bg-surface-alt/30 text-xs text-text-secondary font-sans">
        <FaLock className="text-accent shrink-0" aria-hidden="true" />
        <p className="text-[11px] leading-relaxed">
          <strong className="text-text-primary">Biometric Privacy Guarantee:</strong> All image analysis
          runs entirely on your local device via client-side WebAssembly kernels. Zero facial images or video frames
          are ever transmitted or stored on remote databases. Only mathematical scalars and cryptographic receipts
          are retained.
        </p>
      </div>
    </Card>
  );
}
