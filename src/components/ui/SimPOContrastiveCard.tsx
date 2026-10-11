'use client';

import React from 'react';
import type { ContrastiveEvaluationResult } from '@/types/index';
import Card from './Card';
import Badge from './Badge';
import StructuralDeltaViewer from './StructuralDeltaViewer';
import {
  FaExchangeAlt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaChartLine,
  FaLightbulb,
  FaBolt,
} from 'react-icons/fa';

export interface SimPOContrastiveCardProps {
  contrastiveResult?: ContrastiveEvaluationResult;
  className?: string;
}

export default function SimPOContrastiveCard({
  contrastiveResult,
  className = '',
}: SimPOContrastiveCardProps) {
  // Empty state
  if (!contrastiveResult) {
    return (
      <div className={`space-y-6 text-left ${className}`}>
        <Card variant="solid" className="p-6">
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
            <FaExchangeAlt className="text-4xl text-text-secondary/40" />
            <h3 className="text-sm font-heading font-bold text-text-primary">SimPO Benchmark Analysis</h3>
            <p className="text-xs text-text-secondary leading-relaxed max-w-sm">
              Side-by-side contrastive evaluation (Candidate vs FAANG Target) will appear here after evaluation.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const data = contrastiveResult;
  const { contrastivePair, summaryDeltaText } = data;
  const { dispreferredAnswer, preferredAnswer, rewardMargin, marginSatisfied, structuralDeltas } =
    contrastivePair;

  return (
    <div className={`space-y-6 text-left ${className}`}>
      <Card variant="solid" className="p-6 space-y-5">
        {/* Header Bar & Reward Margin Badge */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary-soft border border-primary/20 flex items-center justify-center text-primary text-lg shrink-0">
              <FaExchangeAlt />
            </div>
            <div>
              <h3 className="text-sm font-heading font-bold text-text-primary flex items-center gap-2">
                SimPO Benchmark Analysis (Candidate vs. FAANG Target)
              </h3>
              <p className="text-[11px] text-text-secondary font-mono">
                Simple Preference Optimization &bull; Meng et al., ICML 2024
              </p>
            </div>
          </div>

          {/* Preference Reward Margin Badge */}
          <div className="flex items-center gap-2 bg-surface-alt px-3.5 py-2 rounded-xl border border-border text-xs font-mono w-full sm:w-auto justify-between sm:justify-end shadow-soft">
            <FaBolt className="text-primary shrink-0 animate-pulse" />
            <span className="text-text-secondary font-semibold">Preference Reward Margin:</span>
            <span className="text-success font-extrabold">
              &Delta;r = {rewardMargin >= 0 ? '+' : ''}{rewardMargin.toFixed(2)}
            </span>
            <Badge variant={marginSatisfied ? 'success' : 'warning'} size="sm">
              {marginSatisfied ? 'Target Satisfied' : 'Pending Margin'}
            </Badge>
          </div>
        </div>

        {/* 2-Column Comparative Layout (Stacks on mobile) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          {/* Left Column: Candidate Submission Baseline (y_dispreferred) */}
          <div className="p-4 rounded-xl bg-surface-alt border border-border space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex justify-between items-center border-b border-border pb-2">
                <span className="text-[10px] text-warning font-bold uppercase tracking-wider flex items-center gap-1">
                  <FaExclamationTriangle size={9} /> Candidate Baseline (y_dispreferred)
                </span>
                <span className="text-[9px] text-text-secondary">{dispreferredAnswer.tokenLength} tokens</span>
              </div>
              <p className="text-text-secondary leading-relaxed text-[11px] font-normal">
                &ldquo;{dispreferredAnswer.text}&rdquo;
              </p>
            </div>

            <div className="pt-2 border-t border-border flex justify-between items-center text-[10px] text-text-secondary">
              <span>Implicit Reward (r_SimPO):</span>
              <span className="text-warning font-bold">{dispreferredAnswer.implicitReward}</span>
            </div>
          </div>

          {/* Right Column: Optimal FAANG Target Benchmark (y_preferred) */}
          <div className="p-4 rounded-xl bg-surface border-2 border-primary/30 space-y-3 flex flex-col justify-between shadow-soft">
            <div className="space-y-2">
              <div className="flex justify-between items-center border-b border-border pb-2">
                <span className="text-[10px] text-primary font-bold uppercase tracking-wider flex items-center gap-1">
                  <FaCheckCircle size={9} /> FAANG Target Benchmark (y_preferred)
                </span>
                <span className="text-[9px] text-primary">{preferredAnswer.tokenLength} tokens</span>
              </div>
              <p className="text-text-primary leading-relaxed text-[11px] font-normal">
                &ldquo;{preferredAnswer.text}&rdquo;
              </p>
            </div>

            <div className="pt-2 border-t border-border flex justify-between items-center text-[10px] text-text-secondary">
              <span>Implicit Reward (r_SimPO):</span>
              <span className="text-success font-bold">{preferredAnswer.implicitReward}</span>
            </div>
          </div>
        </div>

        {/* Structural Summary Text */}
        <div className="bg-surface-alt p-3.5 rounded-xl border border-border text-xs text-text-secondary font-mono">
          {summaryDeltaText}
        </div>

        {/* FAANG Benchmark Delta Card */}
        {data.benchmarkDeltaCard && (
          <div className="p-4 rounded-xl bg-surface border border-border space-y-3 shadow-soft">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FaChartLine className="text-primary text-sm" />
                <span className="text-xs font-heading font-bold text-text-primary uppercase tracking-wider">
                  FAANG Benchmark Delta Card
                </span>
              </div>
              <span className="text-primary font-mono text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-primary-soft border border-primary/30">
                Reward Score: {data.benchmarkDeltaCard.rewardScore.toFixed(2)}
              </span>
            </div>

            <p className="text-xs text-text-secondary italic leading-relaxed">
              &ldquo;{data.benchmarkDeltaCard.faangComparison}&rdquo;
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] font-mono pt-1">
              {data.benchmarkDeltaCard.architecturalGap.length > 0 && (
                <div className="space-y-1">
                  <span className="text-warning font-bold uppercase tracking-wider text-[10px] block">
                    Architectural Gaps:
                  </span>
                  <ul className="space-y-1 text-text-secondary">
                    {data.benchmarkDeltaCard.architecturalGap.map((gap, i) => (
                      <li key={i} className="flex gap-1.5 items-start">
                        <span className="text-warning">&bull;</span>
                        <span>{gap}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.benchmarkDeltaCard.edgeCaseOversights.length > 0 && (
                <div className="space-y-1">
                  <span className="text-warning font-bold uppercase tracking-wider text-[10px] block">
                    Edge-Case Oversights:
                  </span>
                  <ul className="space-y-1 text-text-secondary">
                    {data.benchmarkDeltaCard.edgeCaseOversights.map((ec, i) => (
                      <li key={i} className="flex gap-1.5 items-start">
                        <span className="text-warning">&bull;</span>
                        <span>{ec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Structural Delta Viewer */}
      <StructuralDeltaViewer deltas={structuralDeltas} />
    </div>
  );
}
