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
      <div className={`bg-[#0B0F17]/90 border border-white/10 rounded-xl p-3.5 flex items-center gap-3 text-xs font-mono text-gray-500 ${className}`}>
        <FaSitemap className="text-white/20" />
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
      <div className="bg-[#0B0F17]/90 border border-white/10 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={badgeInfo.variant} size="md" className="py-1 px-3 text-xs font-bold">
            {badgeInfo.label}
          </Badge>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-gray-400 text-[10px] uppercase tracking-wider">PRM Confidence:</span>
            <div className="w-24 h-2 rounded-full bg-white/10 overflow-hidden shrink-0 border border-white/5">
              <div
                className={`h-full transition-all duration-500 ${prmPct >= 80 ? 'bg-emerald-400' : prmPct >= 60 ? 'bg-yellow-400' : 'bg-red-400'}`}
                style={{ width: `${prmPct}%` }}
              />
            </div>
            <span className="text-white font-bold text-xs">{prmPct}%</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowTreeDrawer(!showTreeDrawer)}
          className="text-[11px] font-mono text-primary hover:text-accent font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0"
        >
          <FaSitemap size={12} />
          <span>{showTreeDrawer ? 'Hide Decision Tree' : 'View Decision Tree (LATS)'}</span>
          {showTreeDrawer ? <FaChevronUp size={9} /> : <FaChevronDown size={9} />}
        </button>
      </div>

      {latsState.currentGaps && latsState.currentGaps.length > 0 && (
        <div className="flex items-center gap-2 bg-[#030712]/50 p-2.5 rounded-lg border border-white/5 text-xs">
          <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider font-mono shrink-0">Identified Focus Gaps:</span>
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
