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

  const chainsList = chains ?? [];

  if (chainsList.length === 0) {
    return (
      <div className="p-5 rounded-2xl border border-success/20 bg-success/5 text-center">
        <p className="text-sm text-success font-semibold">✓ No skill gaps detected</p>
        <p className="text-xs text-text-secondary mt-1">Your profile demonstrates complete prerequisite coverage for this role.</p>
      </div>
    );
  }

  const list = chainsList;

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
        return <Badge variant="secondary" size="sm">MINOR GAP</Badge>;
    }
  };

  return (
    <div className={`space-y-4 text-left ${className}`}>
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-2 font-heading">
          <FaLayerGroup className="text-primary" />
          <span>Prerequisite Skill Gap Analysis (Graph Traversal)</span>
        </h4>
        <span className="text-[10px] text-text-secondary font-mono">
          {list.length} Blocked Chains Identified
        </span>
      </div>

      <div className="space-y-3">
        {list.map((chain, idx) => {
          const chainId = chain.id || `chain_${idx + 1}`;
          const isExpanded = !!expandedChains[chainId];

          return (
            <Card variant="default" key={chainId} className="p-4 space-y-3">
              {/* Card Header & Severity */}
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-text-primary font-mono">Chain #{idx + 1}</span>
                {getSeverityBadge(chain.severity)}
              </div>

              {/* Stepped Dependency Chain Visualizer */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center bg-bg-surface-alt p-3 rounded-xl border border-border text-xs font-mono">
                {/* Step 1: Missing Foundation */}
                <div className="p-2 rounded-lg bg-danger/10 border border-danger/20 space-y-0.5">
                  <span className="text-xs text-danger font-bold uppercase block tracking-wider">
                    Missing Foundation
                  </span>
                  <p className="text-text-primary font-medium text-xs leading-tight">
                    {chain.missingFoundation || chain.missingSkill || 'Foundational Skill'}
                  </p>
                </div>

                {/* Step 2: Blocked Capability */}
                <div className="p-2 rounded-lg bg-warning/10 border border-warning/20 space-y-0.5 relative">
                  <div className="hidden md:block absolute -left-2 top-1/2 -translate-y-1/2 text-text-secondary z-10" aria-hidden="true">
                    <FaArrowRight size={10} />
                  </div>
                  <span className="text-xs text-warning font-bold uppercase block tracking-wider">
                    Blocks Capability
                  </span>
                  <p className="text-text-primary font-medium text-xs leading-tight">
                    {chain.blockedCapability}
                  </p>
                </div>

                {/* Step 3: Downstream Impact */}
                <div className="p-2 rounded-lg bg-primary-soft border border-primary/20 space-y-0.5 relative">
                  <div className="hidden md:block absolute -left-2 top-1/2 -translate-y-1/2 text-text-secondary z-10" aria-hidden="true">
                    <FaArrowRight size={10} />
                  </div>
                  <span className="text-xs text-primary font-bold uppercase block tracking-wider">
                    Downstream Impact
                  </span>
                  <p className="text-text-primary font-medium text-xs leading-tight">
                    {chain.downstreamImpact || chain.macroDomainImpact || 'System Impact'}
                  </p>
                </div>
              </div>

              {/* Expandable Remediation Learning Path */}
              <div className="border-t border-border pt-2">
                <button
                  type="button"
                  onClick={() => toggleExpand(chainId)}
                  aria-expanded={isExpanded}
                  className="w-full flex items-center justify-between text-xs text-text-secondary hover:text-text-primary font-mono cursor-pointer transition"
                >
                  <span className="flex items-center gap-1.5 text-primary font-semibold">
                    <FaGraduationCap aria-hidden="true" />
                    Remediation Learning Path ({chain.remediationPath.length} Action Items)
                  </span>
                  {isExpanded ? <FaChevronUp size={9} aria-hidden="true" /> : <FaChevronDown size={9} aria-hidden="true" />}
                </button>

                {isExpanded && (
                  <div className="mt-2.5 space-y-1.5 bg-bg-surface p-3 rounded-lg border border-border text-xs text-left">
                    {chain.remediationPath.map((step, sIdx) => (
                      <div key={sIdx} className="flex gap-2 items-start text-text-secondary leading-relaxed text-xs">
                        <span className="text-success font-bold shrink-0 mt-0.5">&bull;</span>
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
