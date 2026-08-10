'use client';

import React, { useState } from 'react';
import type { PrerequisiteGapChain } from '@/types/index';
import Card from './Card';
import Badge from './Badge';
import {
  FaExclamationTriangle,
  FaArrowRight,
  FaGraduationCap,
  FaChevronDown,
  FaChevronUp,
  FaCheckCircle,
  FaLayerGroup,
} from 'react-icons/fa';

export interface PrerequisiteChainViewerProps {
  chains?: PrerequisiteGapChain[];
  className?: string;
}

export default function PrerequisiteChainViewer({
  chains,
  className = '',
}: PrerequisiteChainViewerProps) {
  const [expandedChains, setExpandedChains] = useState<Record<string, boolean>>({});

  const defaultChains: PrerequisiteGapChain[] = [
    {
      id: 'gap_1',
      missingFoundation: 'Distributed Locks & Mutex protocols',
      blockedCapability: 'Concurrent Cache Mutation Safety',
      downstreamImpact: 'High-Concurrency Distributed Data Consistency',
      severity: 'CRITICAL',
      remediationPath: [
        'Study Redis Redlock algorithm and lock TTL auto-renewal.',
        'Implement idempotency keys for mutative server endpoint handlers.',
        'Design split-brain network failure handling tests.',
      ],
    },
    {
      id: 'gap_2',
      missingFoundation: 'B-Tree & LSM-Tree Storage Engine Mechanics',
      blockedCapability: 'High-Throughput Write Indexing Optimization',
      downstreamImpact: 'Sub-Millisecond Query Latency at Scale',
      severity: 'MODERATE',
      remediationPath: [
        'Analyze WAL (Write-Ahead Logging) vs MemTable flushing pipelines.',
        'Optimize composite index cardinality for multi-column lookup filters.',
      ],
    },
  ];

  const list = chains && chains.length > 0 ? chains : defaultChains;

  const toggleExpand = (id: string) => {
    setExpandedChains((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getSeverityBadge = (severity: 'CRITICAL' | 'MODERATE' | 'MINOR') => {
    switch (severity) {
      case 'CRITICAL':
        return <Badge variant="danger" size="sm">CRITICAL GAP</Badge>;
      case 'MODERATE':
        return <Badge variant="warning" size="sm">MODERATE GAP</Badge>;
      case 'MINOR':
        return <Badge variant="accent" size="sm">MINOR GAP</Badge>;
    }
  };

  return (
    <div className={`space-y-4 text-left ${className}`}>
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2 font-heading">
          <FaLayerGroup className="text-accent" />
          <span>Prerequisite Skill Gap Analysis (Graph Traversal)</span>
        </h4>
        <span className="text-[10px] text-gray-500 font-mono">
          {list.length} Blocked Chains Identified
        </span>
      </div>

      <div className="space-y-3">
        {list.map((chain, idx) => {
          const isExpanded = !!expandedChains[chain.id];

          return (
            <Card variant="glass" key={chain.id || idx} className="p-4 space-y-3">
              {/* Card Header & Severity */}
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-white font-mono">Chain #{idx + 1}</span>
                {getSeverityBadge(chain.severity)}
              </div>

              {/* Stepped Dependency Chain Visualizer */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center bg-[#030712]/60 p-3 rounded-xl border border-white/5 text-xs font-mono">
                {/* Step 1: Missing Foundation */}
                <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 space-y-0.5">
                  <span className="text-[9px] text-red-400 font-bold uppercase block tracking-wider">
                    Missing Foundation
                  </span>
                  <p className="text-gray-200 font-medium text-[11px] leading-tight">
                    {chain.missingFoundation}
                  </p>
                </div>

                {/* Step 2: Blocked Capability */}
                <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 space-y-0.5 relative">
                  <div className="hidden md:block absolute -left-2 top-1/2 -translate-y-1/2 text-gray-500 z-10">
                    <FaArrowRight size={10} />
                  </div>
                  <span className="text-[9px] text-yellow-400 font-bold uppercase block tracking-wider">
                    Blocks Capability
                  </span>
                  <p className="text-gray-200 font-medium text-[11px] leading-tight">
                    {chain.blockedCapability}
                  </p>
                </div>

                {/* Step 3: Downstream Impact */}
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 space-y-0.5 relative">
                  <div className="hidden md:block absolute -left-2 top-1/2 -translate-y-1/2 text-gray-500 z-10">
                    <FaArrowRight size={10} />
                  </div>
                  <span className="text-[9px] text-primary font-bold uppercase block tracking-wider">
                    Downstream Impact
                  </span>
                  <p className="text-gray-200 font-medium text-[11px] leading-tight">
                    {chain.downstreamImpact}
                  </p>
                </div>
              </div>

              {/* Expandable Remediation Learning Path */}
              <div className="border-t border-white/5 pt-2">
                <button
                  type="button"
                  onClick={() => toggleExpand(chain.id)}
                  className="w-full flex items-center justify-between text-[10px] text-gray-400 hover:text-white font-mono cursor-pointer transition"
                >
                  <span className="flex items-center gap-1.5 text-accent font-semibold">
                    <FaGraduationCap />
                    Remediation Learning Path ({chain.remediationPath.length} Action Items)
                  </span>
                  {isExpanded ? <FaChevronUp size={9} /> : <FaChevronDown size={9} />}
                </button>

                {isExpanded && (
                  <div className="mt-2.5 space-y-1.5 bg-[#030712]/50 p-3 rounded-lg border border-white/5 text-xs text-left">
                    {chain.remediationPath.map((step, sIdx) => (
                      <div key={sIdx} className="flex gap-2 items-start text-gray-300 leading-relaxed text-[11px]">
                        <span className="text-emerald-400 font-bold shrink-0 mt-0.5">&bull;</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
