'use client';

import React, { useState } from 'react';
import type { LATSTreeState, LATSActionType } from '@/types/index';
import Badge from './Badge';
import LATSTreeVisualizer from './LATSTreeVisualizer';
import { FaBolt, FaRandom, FaShieldAlt, FaSitemap, FaChevronDown, FaChevronUp } from 'react-icons/fa';

export interface AdaptiveHUDHeaderProps {
  latsState?: LATSTreeState;
  className?: string;
}

export default function AdaptiveHUDHeader({
  latsState,
  className = '',
}: AdaptiveHUDHeaderProps) {
  const [showTreeDrawer, setShowTreeDrawer] = useState(false);

  // No fake defaults — if no data, show minimal neutral HUD
  if (!latsState) {
    return (
      <div className={`bg-surface border border-border rounded-xl p-3.5 flex items-center gap-3 text-xs font-mono text-text-secondary ${className}`}>
        <FaSitemap className="text-text-secondary/30" />
        <span>LATS adaptive interviewer will activate after first answer is submitted.</span>
      </div>
    );
  }

  const actionType = latsState.activeActionType;
  const prmPct = Math.round(
    latsState.currentPRMScore > 1 ? latsState.currentPRMScore : latsState.currentPRMScore * 100
  );

  const getBadgeContent = (type: LATSActionType) => {
    switch (type) {
      case 'DEEP_DIVE': return { label: '⚡ Trajectory: Deep Dive Probe', variant: 'primary' as const };
      case 'PIVOT': return { label: '🔀 Trajectory: Topic Pivot', variant: 'secondary' as const };
      case 'EDGE_CASE_CHALLENGE': return { label: '🛡️ Trajectory: Edge Case Challenge', variant: 'accent' as const };
    }
  };

  const badgeInfo = getBadgeContent(actionType);

  return (
    <div className={`space-y-3 text-left ${className}`}>
      <div className="bg-surface border border-border rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-soft">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={badgeInfo.variant} size="md" className="py-1 px-3 text-xs font-bold">
            {badgeInfo.label}
          </Badge>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-text-secondary text-xs uppercase tracking-wider">PRM Confidence:</span>
            <div className="w-24 h-2 rounded-full bg-surface-alt overflow-hidden shrink-0 border border-border">
              <div
                className={`h-full transition-all duration-500 ${prmPct >= 80 ? 'bg-success' : prmPct >= 60 ? 'bg-warning' : 'bg-danger'}`}
                style={{ width: `${prmPct}%` }}
              />
            </div>
            <span className="text-text-primary font-bold text-xs">{prmPct}%</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowTreeDrawer(!showTreeDrawer)}
          aria-expanded={showTreeDrawer}
          className="text-xs font-mono text-primary hover:text-primary-hover font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0"
        >
          <FaSitemap size={12} aria-hidden="true" />
          <span>{showTreeDrawer ? 'Hide Decision Tree' : 'View Decision Tree (LATS)'}</span>
          {showTreeDrawer ? <FaChevronUp size={9} aria-hidden="true" /> : <FaChevronDown size={9} aria-hidden="true" />}
        </button>
      </div>

      {latsState.currentGaps && latsState.currentGaps.length > 0 && (
        <div className="flex items-center gap-2 bg-surface-alt p-2.5 rounded-lg border border-border text-xs">
          <span className="text-xs text-warning font-bold uppercase tracking-wider font-mono shrink-0">Identified Focus Gaps:</span>
          <div className="flex flex-wrap gap-1.5">
            {latsState.currentGaps.map((gap, idx) => (
              <Badge key={idx} variant="warning" size="sm">{gap}</Badge>
            ))}
          </div>
        </div>
      )}

      {showTreeDrawer && (
        <LATSTreeVisualizer treeState={latsState} className="mt-3 animate-fadeIn" />
      )}
    </div>
  );
}
