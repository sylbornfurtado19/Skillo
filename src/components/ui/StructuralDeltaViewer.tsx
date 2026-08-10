'use client';

import React from 'react';
import type { StructuralDelta } from '@/types/index';
import Card from './Card';
import Badge from './Badge';
import {
  FaLayerGroup,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
  FaArrowRight,
  FaSlidersH,
} from 'react-icons/fa';

export interface StructuralDeltaViewerProps {
  deltas?: StructuralDelta[];
  className?: string;
}

export default function StructuralDeltaViewer({
  deltas,
  className = '',
}: StructuralDeltaViewerProps) {
  const defaultDeltas: StructuralDelta[] = [
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
  ];

  const list = deltas && deltas.length > 0 ? deltas : defaultDeltas;

  const getDimensionLabel = (dimension: StructuralDelta['dimension']) => {
    switch (dimension) {
      case 'COMPLEXITY':
        return <Badge variant="primary" size="sm">Big-O Complexity</Badge>;
      case 'SYSTEM_ARCHITECTURE':
        return <Badge variant="secondary" size="sm">System Architecture</Badge>;
      case 'EDGE_CASES':
        return <Badge variant="warning" size="sm">Edge Cases</Badge>;
      case 'TERMINOLOGY':
        return <Badge variant="neutral" size="sm">Technical Rigor</Badge>;
    }
  };

  return (
    <div className={`space-y-4 text-left ${className}`}>
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2 font-heading">
          <FaSlidersH className="text-accent" />
          <span>Key Architectural & Complexity Deltas (&Delta;)</span>
        </h4>
        <span className="text-[10px] text-gray-500 font-mono">
          {list.length} Structural Dimension(s) Evaluated
        </span>
      </div>

      <div className="space-y-3">
        {list.map((item, idx) => (
          <Card variant="glass" key={idx} className="p-4 space-y-3">
            {/* Header: Dimension & Impact Score */}
            <div className="flex justify-between items-center text-xs font-mono">
              <div className="flex items-center gap-2">
                {getDimensionLabel(item.dimension)}
                <span className="text-[10px] text-gray-400">Delta #{idx + 1}</span>
              </div>

              {/* Impact Score Bar ($0.0$ to $10.0$) */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-gray-400 uppercase">Impact Score</span>
                <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-400 via-accent to-red-400"
                    style={{ width: `${(item.impactScore / 10) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-accent">{item.impactScore}/10</span>
              </div>
            </div>

            {/* Metric Comparison Row: Deficiency vs Target Benchmark */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* Candidate Deficiency Pill */}
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 space-y-1">
                <span className="text-[9px] text-red-400 font-bold uppercase tracking-wider flex items-center gap-1 font-mono">
                  <FaTimesCircle size={9} /> Candidate Deficiency
                </span>
                <p className="text-gray-200 leading-relaxed text-[11px] font-mono">
                  {item.candidateDeficiency}
                </p>
              </div>

              {/* Target Benchmark Pill */}
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1 font-mono">
                  <FaCheckCircle size={9} /> Optimal FAANG Benchmark
                </span>
                <p className="text-gray-200 leading-relaxed text-[11px] font-mono">
                  {item.preferredBenchmark}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
