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
  FaTimesCircle,
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

  // Fallback default sample LATS tree if treeState is unpopulated
  const defaultTree: LATSTreeNode = {
    id: 'node_root',
    parentId: null,
    actionType: 'DEEP_DIVE',
    questionText: 'Explain React 19 server actions & optimistic UI updates.',
    rationale: 'Root question establishing baseline architectural concepts.',
    prmScore: 0.85,
    visitCount: 5,
    uctValue: 1.42,
    gapsDetected: ['Optimistic UI error handling'],
    isVisited: true,
    isSelectedTrajectory: true,
    children: [
      {
        id: 'node_1_deep',
        parentId: 'node_root',
        actionType: 'DEEP_DIVE',
        questionText: 'How does useActionState manage pending state transitions internally?',
        rationale: 'Deep dive into concurrent React flight stream payload mechanics.',
        prmScore: 0.92,
        visitCount: 3,
        uctValue: 1.68,
        gapsDetected: [],
        isVisited: true,
        isSelectedTrajectory: true,
        children: [
          {
            id: 'node_2_edge',
            parentId: 'node_1_deep',
            actionType: 'EDGE_CASE_CHALLENGE',
            questionText: 'What occurs during a server action network rollback when state is dirty?',
            rationale: 'Edge-case challenge probing distributed state consistency failure modes.',
            prmScore: 0.88,
            visitCount: 2,
            uctValue: 1.54,
            gapsDetected: ['Rollback boundary strategy'],
            isVisited: true,
            isSelectedTrajectory: true,
            children: [],
          },
        ],
      },
      {
        id: 'node_1_pivot',
        parentId: 'node_root',
        actionType: 'PIVOT',
        questionText: 'Compare cache invalidation in Next.js revalidatePath vs revalidateTag.',
        rationale: 'Pivot branch testing caching and ISR protocol knowledge.',
        prmScore: 0.74,
        visitCount: 2,
        uctValue: 1.21,
        gapsDetected: ['Tag invalidation scope'],
        isVisited: true,
        isSelectedTrajectory: false,
        children: [],
      },
      {
        id: 'node_1_edge',
        parentId: 'node_root',
        actionType: 'EDGE_CASE_CHALLENGE',
        questionText: 'How do you handle SSR streaming hydration mismatches in production?',
        rationale: 'Edge case branch checking boundary condition awareness.',
        prmScore: 0.65,
        visitCount: 1,
        uctValue: 0.98,
        gapsDetected: ['Hydration error boundaries'],
        isVisited: false,
        isSelectedTrajectory: false,
        children: [],
      },
    ],
  };

  const root = treeState?.rootNode || defaultTree;

  const getBadgeVariant = (type: LATSActionType) => {
    switch (type) {
      case 'DEEP_DIVE':
        return 'primary';
      case 'PIVOT':
        return 'secondary';
      case 'EDGE_CASE_CHALLENGE':
        return 'accent';
      default:
        return 'neutral';
    }
  };

  const getActionIcon = (type: LATSActionType) => {
    switch (type) {
      case 'DEEP_DIVE':
        return <FaBolt className="text-primary text-xs shrink-0" />;
      case 'PIVOT':
        return <FaRandom className="text-secondary text-xs shrink-0" />;
      case 'EDGE_CASE_CHALLENGE':
        return <FaShieldAlt className="text-accent text-xs shrink-0" />;
    }
  };

  // Helper to render tree nodes recursively
  const renderNodeTree = (node: LATSTreeNode, level: number = 0) => {
    const isSelected = node.isSelectedTrajectory;

    return (
      <div key={node.id} className="relative space-y-2 pl-4 sm:pl-6 border-l border-white/10 my-2 text-left">
        {/* Node Box */}
        <div
          onMouseEnter={() => setHoveredNode(node)}
          onMouseLeave={() => setHoveredNode(null)}
          className={`p-3 rounded-xl transition-all duration-200 cursor-pointer relative ${
            isSelected
              ? 'bg-[#0B0F17]/90 border-2 border-primary shadow-lg shadow-primary/10 ring-2 ring-primary/20'
              : 'bg-white/2 border border-white/5 opacity-60 hover:opacity-100 hover:border-white/20'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {getActionIcon(node.actionType)}
              <Badge variant={getBadgeVariant(node.actionType)} size="sm">
                {node.actionType.replace('_', ' ')}
              </Badge>
              {isSelected ? (
                <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <FaCheckCircle size={9} /> Selected Trajectory
                </span>
              ) : (
                <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">
                  Pruned Branch
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="text-gray-400">
                PRM Score ($V$):{' '}
                <strong className={isSelected ? 'text-emerald-400' : 'text-gray-400'}>
                  {(node.prmScore * 100).toFixed(0)}%
                </strong>
              </span>
              <span className="text-gray-500">N(s,a): {node.visitCount}</span>
              <span className="text-gray-500">UCT: {node.uctValue.toFixed(2)}</span>
            </div>
          </div>

          <p className="text-xs text-white font-semibold mt-2 leading-relaxed">
            {node.questionText}
          </p>

          <p className="text-[11px] text-gray-400 italic mt-1 font-mono">
            "{node.rationale}"
          </p>
        </div>

        {/* Render Child Branches */}
        {node.children && node.children.length > 0 && (
          <div className="space-y-2 mt-2">
            {node.children.map((child) => renderNodeTree(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card variant="glass" className={`p-5 space-y-4 ${className}`}>
      {/* Visualizer Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/5 pb-3 text-left">
        <div className="flex items-center gap-2">
          <FaSitemap className="text-primary text-base" />
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-heading">
              Adaptive Decision Tree (LATS Agent Engine)
            </h4>
            <p className="text-[10px] text-gray-400 font-mono">
              Monte Carlo Tree Search (MCTS) &bull; Process Reward Model (PRM $V \in [0, 1]$)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono text-gray-400">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-primary inline-block" /> Selected Trajectory
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-white/20 inline-block" /> Pruned Branch
          </span>
        </div>
      </div>

      {/* Tree Node Structure Graph */}
      <div className="overflow-x-auto py-2">
        {renderNodeTree(root)}
      </div>

      {/* Hovered Node Tooltip Diagnostics */}
      {hoveredNode && (
        <div className="p-3.5 rounded-xl bg-[#030712]/90 border border-primary/30 text-xs space-y-1.5 text-left font-mono shadow-xl transition-all">
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-primary font-bold uppercase tracking-wider flex items-center gap-1">
              <FaInfoCircle /> Node Diagnostic Inspector
            </span>
            <span className="text-gray-400">ID: {hoveredNode.id}</span>
          </div>

          <p className="text-gray-300 text-[11px]">
            <strong>Action Rationale:</strong> {hoveredNode.rationale}
          </p>

          <div className="grid grid-cols-3 gap-2 text-[10px] pt-1 border-t border-white/5">
            <div>
              <span className="text-gray-400 block">PRM Value (V):</span>
              <span className="text-emerald-400 font-bold">{(hoveredNode.prmScore * 100).toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-gray-400 block">Visit Count N(s,a):</span>
              <span className="text-white font-bold">{hoveredNode.visitCount}</span>
            </div>
            <div>
              <span className="text-gray-400 block">UCT Bound:</span>
              <span className="text-accent font-bold">{hoveredNode.uctValue.toFixed(3)}</span>
            </div>
          </div>

          {hoveredNode.gapsDetected && hoveredNode.gapsDetected.length > 0 && (
            <div className="pt-1">
              <span className="text-[10px] text-yellow-400 font-bold block">Gaps Identified:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {hoveredNode.gapsDetected.map((gap, i) => (
                  <Badge key={i} variant="warning" size="sm">
                    {gap}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
