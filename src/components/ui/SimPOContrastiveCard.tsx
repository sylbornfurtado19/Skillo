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
  const defaultResult: ContrastiveEvaluationResult = {
    evaluationId: 'simpo_demo_101',
    summaryDeltaText:
      'SimPO contrastive evaluation verified preference margin Δr = +0.82 (Target Margin Satisfied). Identified 3 structural delta(s).',
    contrastivePair: {
      questionContext: 'How do you design a high-throughput rate limiter for distributed microservices?',
      dispreferredAnswer: {
        text: 'I would use a simple counter variable stored in a memory cache. When a request comes in, we increment the count and check if it is above 100. If it is, we return an HTTP 429 status code.',
        tokenLength: 42,
        implicitReward: -1.30,
      },
      preferredAnswer: {
        text: 'Implement a distributed Sliding Window Counter using Redis Lua scripts for atomic execution. Store timestamps in a Sorted Set (ZSET), removing entries outside the window (ZREMRANGEBYSCORE) before querying cardinality (ZCARD). For cross-region failover, combine local token bucket memory limiters with Redlock mutex sync.',
        tokenLength: 54,
        implicitReward: -0.48,
      },
      rewardMargin: 0.82,
      marginSatisfied: true,
      structuralDeltas: [
        {
          dimension: 'COMPLEXITY',
          candidateDeficiency: 'Omitted explicit Big-O algorithmic time and space complexity bounds.',
          preferredBenchmark: 'Optimal response specifies O(1) memory lookup with O(N) worst-case index rebalancing.',
          impactScore: 8.5,
        },
        {
          dimension: 'SYSTEM_ARCHITECTURE',
          candidateDeficiency: 'Described single-node execution without handling distributed split-brain network failures.',
          preferredBenchmark: 'FAANG benchmark incorporates Redlock distributed locks and circuit breaker auto-failover.',
          impactScore: 9.0,
        },
        {
          dimension: 'TERMINOLOGY',
          candidateDeficiency: 'Used informal phrasing ("save to cache") instead of precise technical nomenclature.',
          preferredBenchmark: 'Leverages industry-standard terms ("cache-aside invalidation pattern", "write-through mutator").',
          impactScore: 7.0,
        },
      ],
    },
  };

  const data = contrastiveResult || defaultResult;
  const { contrastivePair, summaryDeltaText } = data;
  const { dispreferredAnswer, preferredAnswer, rewardMargin, marginSatisfied, structuralDeltas } =
    contrastivePair;

  return (
    <div className={`space-y-6 text-left ${className}`}>
      <Card variant="glow-secondary" className="p-6 space-y-5">
        {/* Header Bar & Reward Margin Badge */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent text-lg shrink-0">
              <FaExchangeAlt />
            </div>
            <div>
              <h3 className="text-sm font-heading font-bold text-white flex items-center gap-2">
                SimPO Benchmark Analysis (Candidate vs. FAANG Target)
              </h3>
              <p className="text-[11px] text-gray-400 font-mono">
                Simple Preference Optimization &bull; Meng et al., ICML 2024
              </p>
            </div>
          </div>

          {/* Preference Reward Margin Badge */}
          <div className="flex items-center gap-2 bg-[#030712]/80 px-3.5 py-2 rounded-xl border border-accent/30 text-xs font-mono w-full sm:w-auto justify-between sm:justify-end">
            <FaBolt className="text-accent shrink-0 animate-pulse" />
            <span className="text-gray-300 font-semibold">Preference Reward Margin:</span>
            <span className="text-emerald-400 font-extrabold">
              &Delta;r = +{rewardMargin.toFixed(2)}
            </span>
            <Badge variant={marginSatisfied ? 'success' : 'warning'} size="sm">
              {marginSatisfied ? 'Target Satisfied' : 'Pending Margin'}
            </Badge>
          </div>
        </div>

        {/* 2-Column Comparative Layout (Stacks on mobile) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          {/* Left Column: Candidate Submission Baseline (y_dispreferred) */}
          <div className="p-4 rounded-xl bg-white/2 border border-white/10 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <FaExclamationTriangle size={9} /> Candidate Baseline (y_dispreferred)
                </span>
                <span className="text-[9px] text-gray-500">{dispreferredAnswer.tokenLength} tokens</span>
              </div>
              <p className="text-gray-300 leading-relaxed text-[11px] font-normal">
                &ldquo;{dispreferredAnswer.text}&rdquo;
              </p>
            </div>

            <div className="pt-2 border-t border-white/5 flex justify-between items-center text-[10px] text-gray-400">
              <span>Implicit Reward (r_SimPO):</span>
              <span className="text-yellow-400 font-bold">{dispreferredAnswer.implicitReward}</span>
            </div>
          </div>

          {/* Right Column: Optimal FAANG Target Benchmark (y_preferred) */}
          <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 space-y-3 flex flex-col justify-between glow-primary">
            <div className="space-y-2">
              <div className="flex justify-between items-center border-b border-indigo-500/20 pb-2">
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <FaCheckCircle size={9} /> FAANG Target Benchmark (y_preferred)
                </span>
                <span className="text-[9px] text-indigo-300">{preferredAnswer.tokenLength} tokens</span>
              </div>
              <p className="text-gray-100 leading-relaxed text-[11px] font-normal">
                &ldquo;{preferredAnswer.text}&rdquo;
              </p>
            </div>

            <div className="pt-2 border-t border-indigo-500/20 flex justify-between items-center text-[10px] text-indigo-300">
              <span>Implicit Reward (r_SimPO):</span>
              <span className="text-emerald-400 font-bold">{preferredAnswer.implicitReward}</span>
            </div>
          </div>
        </div>

        {/* Structural Summary Text */}
        <div className="bg-[#030712]/60 p-3.5 rounded-xl border border-white/5 text-xs text-gray-300 font-mono">
          {summaryDeltaText}
        </div>
      </Card>

      {/* Structural Delta Viewer */}
      <StructuralDeltaViewer deltas={structuralDeltas} />
    </div>
  );
}
