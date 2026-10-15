'use client';

import React, { useState } from 'react';
import type { LATSTreeNode, LATSTreeState, LATSActionType } from '@/types/index';
import Badge from './Badge';
import Card from './Card';
import {
  FaSitemap,
  FaBolt,
  FaRandom,
  FaShieldAlt,
  FaInfoCircle,
  FaCheckCircle,
  FaSpinner,
  FaExclamationTriangle,
} from 'react-icons/fa';

export interface LATSTreeVisualizerProps {
  treeState?: LATSTreeState;
  className?: string;
}

export default function LATSTreeVisualizer({
  treeState,
  className = '',
}: LATSTreeVisualizerProps) {
  const [hoveredNode, setHoveredNode] = useState<LATSTreeNode | null>(null);

  const getBadgeVariant = (type: LATSActionType) => {
    switch (type) {
      case 'DEEP_DIVE': return 'primary';
      case 'PIVOT': return 'secondary';
      case 'EDGE_CASE_CHALLENGE': return 'accent';
      default: return 'neutral';
    }
  };

  const getActionIcon = (type: LATSActionType) => {
    switch (type) {
      case 'DEEP_DIVE': return <FaBolt className="text-primary text-xs shrink-0" />;
      case 'PIVOT': return <FaRandom className="text-secondary text-xs shrink-0" />;
      case 'EDGE_CASE_CHALLENGE': return <FaShieldAlt className="text-accent text-xs shrink-0" />;
    }
  };

  const renderNodeTree = (node: LATSTreeNode, level: number = 0) => {
    const isSelected = node.isSelectedTrajectory;
    return (
      <div key={node.id} className="relative space-y-2 pl-4 sm:pl-6 border-l border-border my-2 text-left">
        <div
          onMouseEnter={() => setHoveredNode(node)}
          onMouseLeave={() => setHoveredNode(null)}
          className={`p-3 rounded-xl transition-all duration-200 cursor-pointer relative ${
            isSelected
              ? 'bg-surface border-2 border-primary shadow-soft ring-2 ring-primary/20'
              : 'bg-surface-alt/50 border border-border opacity-70 hover:opacity-100 hover:border-border'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {getActionIcon(node.actionType)}
              <Badge variant={getBadgeVariant(node.actionType)} size="sm">
                {node.actionType.replace(/_/g, ' ')}
              </Badge>
              {isSelected ? (
                <span className="text-[9px] font-mono font-bold text-success uppercase tracking-wider flex items-center gap-1">
                  <FaCheckCircle size={9} /> Selected Trajectory
                </span>
              ) : (
                <span className="text-[9px] font-mono text-text-secondary uppercase tracking-wider">
                  Pruned Branch
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="text-text-secondary">
                PRM Score: <strong className={isSelected ? 'text-success' : 'text-text-secondary'}>{(node.prmScore * 100).toFixed(0)}%</strong>
              </span>
              <span className="text-text-secondary">N(s,a): {node.visitCount}</span>
              <span className="text-text-secondary">UCT: {node.uctValue.toFixed(2)}</span>
            </div>
          </div>
          <p className="text-xs text-text-primary font-semibold mt-2 leading-relaxed">{node.questionText}</p>
          <p className="text-[11px] text-text-secondary italic mt-1 font-mono">"{node.rationale}"</p>
        </div>
        {node.children && node.children.length > 0 && (
          <div className="space-y-2 mt-2">
            {node.children.map((child) => renderNodeTree(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // Empty state — no tree data yet
  if (!treeState) {
    return (
      <Card variant="default" className={`p-5 ${className}`}>
        <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
          <FaSitemap className="text-4xl text-text-secondary/40" />
          <p className="text-sm text-text-secondary font-mono">
            LATS decision tree will appear here after question generation.
          </p>
          <p className="text-[11px] text-text-secondary">
            The MCTS engine runs 3 simulations per turn to select the optimal follow-up trajectory.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="default" className={`p-5 space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-border pb-3 text-left">
        <div className="flex items-center gap-2">
          <FaSitemap className="text-primary text-base" />
          <div>
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-heading">
              Adaptive Decision Tree (LATS Agent Engine)
            </h4>
            <p className="text-[10px] text-text-secondary font-mono">
              MCTS &bull; PRM V ∈ [0,1] &bull; c_puct = 1.414 &bull; {treeState.trajectoryHistory.length} nodes traversed
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(treeState.source === 'fallback' || treeState.fallback) && (
            <Badge variant="warning" size="sm" className="flex items-center gap-1.5 px-2.5 py-1 text-[11px]">
              <FaExclamationTriangle className="text-warning text-[10px]" aria-hidden="true" />
              <span>Offline estimate, not a live AI evaluation</span>
            </Badge>
          )}
          <div className="flex items-center gap-2 text-[10px] font-mono text-text-secondary">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-primary inline-block" /> Selected Trajectory
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-border inline-block" /> Pruned Branch
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto py-2">
        {renderNodeTree(treeState.rootNode)}
      </div>

      {hoveredNode && (
        <div className="p-3.5 rounded-xl bg-surface border border-border text-xs space-y-1.5 text-left font-mono shadow-soft">
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-primary font-bold uppercase tracking-wider flex items-center gap-1">
              <FaInfoCircle /> Node Diagnostic Inspector
            </span>
            <span className="text-text-secondary">ID: {hoveredNode.id}</span>
          </div>
          <p className="text-text-secondary text-[11px]"><strong>Rationale:</strong> {hoveredNode.rationale}</p>
          <div className="grid grid-cols-3 gap-2 text-[10px] pt-1 border-t border-border">
            <div><span className="text-text-secondary block">PRM Value:</span><span className="text-success font-bold">{(hoveredNode.prmScore * 100).toFixed(1)}%</span></div>
            <div><span className="text-text-secondary block">Visit Count:</span><span className="text-text-primary font-bold">{hoveredNode.visitCount}</span></div>
            <div><span className="text-text-secondary block">UCT:</span><span className="text-primary font-bold">{hoveredNode.uctValue.toFixed(3)}</span></div>
          </div>
          {hoveredNode.gapsDetected.length > 0 && (
            <div className="pt-1">
              <span className="text-[10px] text-warning font-bold block">Gaps Detected:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {hoveredNode.gapsDetected.map((gap, i) => (
                  <Badge key={i} variant="warning" size="sm">{gap}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
