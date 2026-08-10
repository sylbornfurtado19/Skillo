'use client';

import React, { useState } from 'react';
import type { LATSTreeState, LATSActionType } from '@/types/index';
import Badge from './Badge';
import Button from './Button';
import LATSTreeVisualizer from './LATSTreeVisualizer';
import {
  FaBolt,
  FaRandom,
  FaShieldAlt,
  FaSitemap,
  FaChevronDown,
  FaChevronUp,
} from 'react-icons/fa';

export interface AdaptiveHUDHeaderProps {
  latsState?: LATSTreeState;
  className?: string;
}

export default function AdaptiveHUDHeader({
  latsState,
  className = '',
}: AdaptiveHUDHeaderProps) {
  const [showTreeDrawer, setShowTreeDrawer] = useState(false);

  // Fallback defaults if latsState is unpopulated
  const defaultState: LATSTreeState = {
    currentNodeId: 'node_1',
    trajectoryHistory: ['node_root', 'node_1'],
    rootNode: {
      id: 'node_root',
      parentId: null,
      actionType: 'DEEP_DIVE',
      questionText: 'Baseline Question',
      rationale: 'Root question',
      prmScore: 0.85,
      visitCount: 5,
      uctValue: 1.4,
      gapsDetected: [],
      isVisited: true,
      isSelectedTrajectory: true,
      children: [],
    },
    simulatedBranches: [],
    activeActionType: 'DEEP_DIVE',
    currentPRMScore: 88,
    currentGaps: ['Concurrency boundary condition', 'State rollback handling'],
  };

  const state = latsState || defaultState;
  const actionType = state.activeActionType || 'DEEP_DIVE';
  const prmPct = Math.round(
    state.currentPRMScore > 1 ? state.currentPRMScore : state.currentPRMScore * 100
  );

  const getBadgeContent = (type: LATSActionType) => {
    switch (type) {
      case 'DEEP_DIVE':
        return {
          label: '⚡ Trajectory: Deep Dive Probe',
          variant: 'primary' as const,
        };
      case 'PIVOT':
        return {
          label: '🔀 Trajectory: Topic Pivot',
          variant: 'secondary' as const,
        };
      case 'EDGE_CASE_CHALLENGE':
        return {
          label: '🛡️ Trajectory: Edge Case Challenge',
          variant: 'accent' as const,
        };
    }
  };

  const badgeInfo = getBadgeContent(actionType);

  return (
    <div className={`space-y-3 text-left ${className}`}>
      {/* 1. Main Adaptive HUD Bar */}
      <div className="bg-[#0B0F17]/90 border border-white/10 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
        <div className="flex flex-wrap items-center gap-3">
          {/* Trajectory Action Badge */}
          <Badge variant={badgeInfo.variant} size="md" className="py-1 px-3 text-xs font-bold">
            {badgeInfo.label}
          </Badge>

          {/* PRM Score Meter */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-gray-400 text-[10px] uppercase tracking-wider">PRM Confidence:</span>
            <div className="w-24 h-2 rounded-full bg-white/10 overflow-hidden shrink-0 border border-white/5">
              <div
                className={`h-full transition-all duration-500 ${
                  prmPct >= 80 ? 'bg-emerald-400' : prmPct >= 60 ? 'bg-yellow-400' : 'bg-red-400'
                }`}
                style={{ width: `${prmPct}%` }}
              />
            </div>
            <span className="text-white font-bold text-xs">{prmPct}%</span>
          </div>
        </div>

        {/* MCTS Tree Drawer Toggle */}
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

      {/* 2. Candidate Gaps Detected Tag Pills */}
      {state.currentGaps && state.currentGaps.length > 0 && (
        <div className="flex items-center gap-2 bg-[#030712]/50 p-2.5 rounded-lg border border-white/5 text-xs">
          <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider font-mono shrink-0">
            Identified Focus Gaps:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {state.currentGaps.map((gap, idx) => (
              <Badge key={idx} variant="warning" size="sm">
                {gap}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* 3. Collapsible Live MCTS Tree Visualizer Drawer */}
      {showTreeDrawer && (
        <LATSTreeVisualizer treeState={state} className="mt-3 animate-fadeIn" />
      )}
    </div>
  );
}
