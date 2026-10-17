'use client';

import React from 'react';
import {
  FaShieldAlt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaHistory,
  FaInfoCircle,
} from 'react-icons/fa';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import type { SessionIntegrityReport } from '@/types/integrity';

export interface SessionIntegrityCardProps {
  integrity?: SessionIntegrityReport | null;
  className?: string;
}

export default function SessionIntegrityCard({
  integrity,
  className = '',
}: SessionIntegrityCardProps) {
  if (!integrity) {
    return (
      <Card variant="default" className={`p-6 bg-bg-surface border-border shadow-soft text-center space-y-3 ${className}`}>
        <div className="flex justify-center">
          <div className="p-3 bg-neutral/10 rounded-full text-text-secondary">
            <FaShieldAlt className="text-xl" />
          </div>
        </div>
        <h3 className="text-base font-semibold text-text-primary">
          Session Integrity Not Recorded
        </h3>
        <p className="text-xs text-text-secondary max-w-md mx-auto">
          Browser proctoring and integrity monitoring data was not recorded for this session.
        </p>
      </Card>
    );
  }

  const { verdict, totals, events, limitationsNote } = integrity;

  // Verdict badge config with both icon + text (never color alone)
  const verdictConfig = {
    clean: {
      label: 'Verified Clean Integrity',
      badgeVariant: 'success' as const,
      icon: <FaCheckCircle className="text-sm" aria-hidden="true" />,
      description: 'Zero unauthorized window shifts, tab switches, or clipboard tampering detected.',
    },
    minor_flags: {
      label: 'Minor Integrity Flags',
      badgeVariant: 'warning' as const,
      icon: <FaExclamationTriangle className="text-sm" aria-hidden="true" />,
      description: 'Occasional defocus or brief pause recorded. Within normal human accommodation tolerances.',
    },
    flagged: {
      label: 'Security Flags Detected',
      badgeVariant: 'danger' as const,
      icon: <FaTimesCircle className="text-sm" aria-hidden="true" />,
      description: 'Multiple tab switches or prolonged pause durations detected during interview.',
    },
  }[verdict] || {
    label: 'Audit Recorded',
    badgeVariant: 'neutral' as const,
    icon: <FaInfoCircle className="text-sm" aria-hidden="true" />,
    description: 'Proctored environment audit recorded.',
  };

  const pauseEvents = events.filter((e) => e.type === 'pause' || e.pauseReason);

  return (
    <Card
      variant="default"
      data-testid="session-integrity-card"
      className={`p-6 bg-bg-surface border-border shadow-soft space-y-6 text-left ${className}`}
    >
      {/* Header with Title and Verdict */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
            <FaShieldAlt className="text-xl" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-heading font-extrabold text-text-primary tracking-tight">
                Placement Proctoring &amp; Integrity Audit
              </h3>
              <Badge variant="neutral" size="sm" className="font-mono text-[10px]">
                {integrity.policyVersion}
              </Badge>
            </div>
            <p className="text-xs text-text-secondary">{verdictConfig.description}</p>
          </div>
        </div>

        {/* Verdict Badge */}
        <div>
          <Badge
            variant={verdictConfig.badgeVariant}
            size="md"
            className="flex items-center gap-1.5 font-mono text-xs py-1 px-3"
            data-testid="integrity-verdict-badge"
          >
            {verdictConfig.icon}
            <span className="font-bold">{verdictConfig.label}</span>
          </Badge>
        </div>
      </div>

      {/* Totals Metric Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
        <div className="rounded-xl border border-border bg-bg-surface-alt/50 p-3 space-y-1">
          <span className="text-[10px] uppercase text-text-secondary font-bold tracking-wider">Tab Switches</span>
          <div className={`text-base font-extrabold ${totals.tabSwitches > 0 ? 'text-warning' : 'text-text-primary'}`}>
            {totals.tabSwitches}
          </div>
          <span className="text-[10px] text-text-tertiary">Window blur &amp; hidden</span>
        </div>

        <div className="rounded-xl border border-border bg-bg-surface-alt/50 p-3 space-y-1">
          <span className="text-[10px] uppercase text-text-secondary font-bold tracking-wider">Fullscreen Exits</span>
          <div className={`text-base font-extrabold ${totals.fullscreenExits > 0 ? 'text-warning' : 'text-text-primary'}`}>
            {totals.fullscreenExits}
          </div>
          <span className="text-[10px] text-text-tertiary">Secure workspace exits</span>
        </div>

        <div className="rounded-xl border border-border bg-bg-surface-alt/50 p-3 space-y-1">
          <span className="text-[10px] uppercase text-text-secondary font-bold tracking-wider">Copy/Paste Deterred</span>
          <div className={`text-base font-extrabold ${totals.copyPasteAttempts > 0 ? 'text-danger' : 'text-text-primary'}`}>
            {totals.copyPasteAttempts}
          </div>
          <span className="text-[10px] text-text-tertiary">Clipboard events blocked</span>
        </div>

        <div className="rounded-xl border border-border bg-bg-surface-alt/50 p-3 space-y-1">
          <span className="text-[10px] uppercase text-text-secondary font-bold tracking-wider">Total Paused Time</span>
          <div className={`text-base font-extrabold ${totals.pausedMs > 0 ? 'text-warning' : 'text-text-primary'}`}>
            {(totals.pausedMs / 1000).toFixed(1)} s
          </div>
          <span className="text-[10px] text-text-tertiary">{totals.pauses} pause event{totals.pauses === 1 ? '' : 's'}</span>
        </div>
      </div>

      {/* Pause Timeline (O3) */}
      <div className="space-y-3">
        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
          <FaHistory className="text-text-tertiary" />
          Pause &amp; Event Accounting Timeline
        </h4>

        {pauseEvents.length === 0 ? (
          <div className="p-3.5 rounded-xl border border-border bg-bg-surface-alt/30 text-xs text-text-secondary font-mono flex items-center gap-2">
            <FaCheckCircle className="text-success shrink-0" />
            <span>Uninterrupted session. Zero pause interruptions or device disconnections recorded.</span>
          </div>
        ) : (
          <div className="space-y-2 font-mono text-xs">
            {pauseEvents.map((evt, idx) => (
              <div
                key={evt.id || idx}
                className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-bg-surface-alt/40 gap-2"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-warning shrink-0" />
                  <span className="font-bold text-text-primary capitalize">
                    {(evt.pauseReason || evt.type).replace(/_/g, ' ')}
                  </span>
                  {evt.questionIndex !== undefined && (
                    <span className="text-text-secondary">· Question {evt.questionIndex + 1}</span>
                  )}
                </div>
                <div className="text-text-tertiary text-[11px] flex items-center gap-3">
                  <span>At {(evt.atMs / 1000).toFixed(1)}s</span>
                  {evt.durationMs !== undefined && (
                    <span className="font-bold text-warning">Duration: {(evt.durationMs / 1000).toFixed(1)}s</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Honest Proctoring Limitations Sentence (D1, D2, D8) */}
      <div className="flex items-start gap-2.5 p-3 rounded-lg border border-border/60 bg-bg-surface-alt/30 text-xs text-text-secondary">
        <FaInfoCircle className="text-text-tertiary mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-[11px] leading-relaxed">
          <strong className="text-text-primary">System Integrity Transparency:</strong> {limitationsNote ||
            'Browser-level integrity monitoring detects and deters suspicious actions but cannot guarantee complete prevention of external physical devices or operating-system captures.'}{' '}
          Integrity flags provide contextual signals for placement review and do not automatically alter technical criterion scores.
        </p>
      </div>
    </Card>
  );
}
