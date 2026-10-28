'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
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
  FaExclamationTriangle,
  FaRoute,
} from 'react-icons/fa';

export interface LATSTreeVisualizerProps {
  treeState?: LATSTreeState;
  className?: string;
}

function calculateMaxDepth(node: LATSTreeNode, current: number = 0): number {
  if (!node.children || node.children.length === 0) return current;
  return Math.max(...node.children.map((c) => calculateMaxDepth(c, current + 1)));
}

function getSelectedPathLabels(node: LATSTreeNode): string[] {
  const currentLabel = node.parentId === null ? 'Root' : node.actionType.replace(/_/g, ' ');
  const path = [currentLabel];
  if (node.children) {
    const selectedChild = node.children.find((c) => c.isSelectedTrajectory);
    if (selectedChild) {
      path.push(...getSelectedPathLabels(selectedChild));
    }
  }
  return path;
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
    const qDisplay = node.qValue !== undefined ? (node.qValue * 100).toFixed(0) : (node.prmScore * 100).toFixed(0);
    const connectorPath = "M 0 0 L 0 14 Q 0 22 8 22 L 16 22";

    return (
      <div key={node.id} className="relative space-y-2 pl-4 sm:pl-6 border-l-2 border-border my-2 text-left">
        {level > 0 && (
          <svg
            className="absolute -left-4 sm:-left-6 top-0 w-4 sm:w-6 h-8 overflow-visible pointer-events-none z-10"
            aria-hidden="true"
          >
            <motion.path
              d={connectorPath}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, delay: Math.min(level * 0.15, 0.6), ease: 'easeOut' }}
              stroke={isSelected ? 'var(--primary)' : 'var(--border)'}
              strokeWidth={isSelected ? 2.5 : 1.5}
              fill="none"
            />
          </svg>
        )}
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: Math.min(level * 0.15, 0.6) }}
          onMouseEnter={() => setHoveredNode(node)}
          onMouseLeave={() => setHoveredNode(null)}
          data-testid={`lats-node-${node.id}`}
          className={`p-3 rounded-xl transition-all duration-200 cursor-pointer relative ${
            isSelected
              ? 'bg-surface border-2 border-primary shadow-soft ring-2 ring-primary/20'
              : 'bg-surface-alt/50 border border-border opacity-70 hover:opacity-100 hover:border-border'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {getActionIcon(node.actionType)}
              <Badge variant={getBadgeVariant(node.actionType)} size="sm">
                {node.actionType.replace(/_/g, ' ')}
              </Badge>
              <Badge variant="neutral" size="sm" className="font-mono text-[9px]">
                Depth {node.depth ?? level}
              </Badge>
              {isSelected ? (
                <span className="text-[9px] font-mono font-bold text-success uppercase tracking-wider flex items-center gap-1">
                  <FaCheckCircle size={9} /> Selected Path
                </span>
              ) : (
                <span className="text-[9px] font-mono text-text-secondary uppercase tracking-wider">
                  Pruned Branch
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono">
              <span className="text-text-secondary">
                Q-Mean: <strong className={isSelected ? 'text-success' : 'text-text-secondary'}>{qDisplay}%</strong>
              </span>
              <span className="text-text-secondary">
                Visits: <strong className="text-text-primary">{node.visitCount}</strong>
              </span>
              <span className="text-text-secondary">UCT: {node.uctValue.toFixed(2)}</span>
            </div>
          </div>
          <p className="text-xs text-text-primary font-semibold mt-2 leading-relaxed">{node.questionText}</p>
          <p className="text-[11px] text-text-secondary italic mt-1 font-mono">"{node.rationale}"</p>
        </motion.div>
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
            The MCTS engine runs multi-iteration simulations with persistent tree memory.
          </p>
        </div>
      </Card>
    );
  }

  const maxDepth = treeState.depth ?? calculateMaxDepth(treeState.rootNode);
  const selectedPath = getSelectedPathLabels(treeState.rootNode);
  const totalVisits = treeState.rootNode.visitCount;

  return (
    <Card variant="default" className={`p-5 space-y-4 ${className}`}>
      {/* 1. Header & Diagnostics Stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-3 text-left">
        <div className="flex items-center gap-2">
          <FaSitemap className="text-primary text-base" />
          <div>
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-heading">
              Adaptive Decision Tree (LATS MCTS Engine)
            </h4>
            <p className="text-[10px] text-text-secondary font-mono">
              Depth: {maxDepth} &bull; Visits: {totalVisits} &bull; Trajectory: {treeState.trajectoryHistory.length} turns
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
              <span className="h-2 w-2 rounded-full bg-primary inline-block" /> Selected Path
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-border inline-block" /> Pruned Branch
            </span>
          </div>
        </div>
      </div>

      {/* 2. Selected Trajectory Path Breadcrumb */}
      {selectedPath.length > 0 && (
        <div
          className="p-2.5 rounded-lg bg-bg-surface-alt border border-border flex flex-wrap items-center gap-2 text-xs font-mono"
          data-testid="selected-path-breadcrumb"
        >
          <div className="flex items-center gap-1.5 text-primary font-bold text-[11px] shrink-0">
            <FaRoute className="text-xs" />
            <span>Selected Path:</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-text-primary text-[11px]">
            {selectedPath.map((step, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="text-text-secondary/60">&rarr;</span>}
                <span className="px-2 py-0.5 rounded bg-bg-surface border border-border font-semibold">
                  {step}
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* 3. Rendered Decision Tree */}
      <div className="overflow-x-auto py-2">
        {renderNodeTree(treeState.rootNode)}
      </div>

      {/* 4. Hover Inspector */}
      {hoveredNode && (
        <div className="p-3.5 rounded-xl bg-surface border border-border text-xs space-y-1.5 text-left font-mono shadow-soft">
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-primary font-bold uppercase tracking-wider flex items-center gap-1">
              <FaInfoCircle /> Node Diagnostic Inspector
            </span>
            <span className="text-text-secondary">ID: {hoveredNode.id}</span>
          </div>
          <p className="text-text-secondary text-[11px]"><strong>Rationale:</strong> {hoveredNode.rationale}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] pt-1 border-t border-border">
            <div>
              <span className="text-text-secondary block">Depth:</span>
              <span className="text-text-primary font-bold">{hoveredNode.depth ?? 0}</span>
            </div>
            <div>
              <span className="text-text-secondary block">PRM Value:</span>
              <span className="text-success font-bold">{(hoveredNode.prmScore * 100).toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-text-secondary block">Visit Count:</span>
              <span className="text-text-primary font-bold">{hoveredNode.visitCount}</span>
            </div>
            <div>
              <span className="text-text-secondary block">UCT Score:</span>
              <span className="text-primary font-bold">{hoveredNode.uctValue.toFixed(3)}</span>
            </div>
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
