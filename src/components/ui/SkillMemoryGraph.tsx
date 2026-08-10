'use client';

import React, { useState } from 'react';
import type { CandidateSkillMemoryStore, SkillMemoryNode } from '@/types/index';
import Card from './Card';
import Badge from './Badge';
import ReflectionTimelineDrawer from './ReflectionTimelineDrawer';
import {
  FaBrain,
  FaCheckCircle,
  FaExclamationTriangle,
  FaFire,
  FaHistory,
  FaChartLine,
  FaGraduationCap,
} from 'react-icons/fa';

export interface SkillMemoryGraphProps {
  memoryStore?: CandidateSkillMemoryStore;
  className?: string;
}

export default function SkillMemoryGraph({
  memoryStore,
  className = '',
}: SkillMemoryGraphProps) {
  const [selectedNode, setSelectedNode] = useState<SkillMemoryNode | null>(null);

  const defaultMemoryStore: CandidateSkillMemoryStore = {
    userId: 'default_user',
    globalReflectionSummary:
      'Candidate has logged 3 skill memory node(s). 1 skill mastered, 1 proficient, 1 developing. 1 high-severity deficiency trace requiring targeted practice.',
    nodes: {
      react_architecture: {
        skillId: 'react_architecture',
        skillName: 'React 19 & State Architecture',
        proficiencyLevel: 'MASTERED',
        attemptsCount: 6,
        reflections: [
          {
            id: 'sr_101',
            sessionId: 'sess_1',
            skillTag: 'React 19 & State Architecture',
            timestamp: new Date().toISOString(),
            mistakeSummary: 'Minor memoization delay in high-frequency list rendering.',
            rootCauseAnalysis: 'Candidate relied on manual useMemo instead of leveraging React 19 Compiler automatic optimization.',
            actionableRemediation: 'Adopt React 19 compiler primitives and transition actions.',
            severity: 'LOW',
          },
        ],
        persistentDeficiencies: [],
        remediationProgress: 95,
        lastUpdated: new Date().toISOString(),
      },
      distributed_locking: {
        skillId: 'distributed_locking',
        skillName: 'Distributed Locks & Redlock',
        proficiencyLevel: 'DEVELOPING',
        attemptsCount: 3,
        reflections: [
          {
            id: 'sr_102',
            sessionId: 'sess_2',
            skillTag: 'Distributed Locks & Redlock',
            timestamp: new Date().toISOString(),
            mistakeSummary: 'Did not specify TTL auto-renewal for Redis mutex locks.',
            rootCauseAnalysis: 'Root cause: Missing familiarity with split-brain network failure modes under high write lock contention.',
            actionableRemediation: 'Implement lock lease extension heartbeat loop.',
            severity: 'HIGH',
          },
        ],
        persistentDeficiencies: ['Did not specify TTL auto-renewal for Redis mutex locks.'],
        remediationProgress: 45,
        lastUpdated: new Date().toISOString(),
      },
      system_design: {
        skillId: 'system_design',
        skillName: 'System Scalability & Caching',
        proficiencyLevel: 'PROFICIENT',
        attemptsCount: 4,
        reflections: [
          {
            id: 'sr_103',
            sessionId: 'sess_3',
            skillTag: 'System Scalability & Caching',
            timestamp: new Date().toISOString(),
            mistakeSummary: 'Omitted double-delete pattern in cache invalidation.',
            rootCauseAnalysis: 'Root cause: Focused on read latency without verifying write propagation consistency.',
            actionableRemediation: 'Incorporate pub-sub cache invalidation handlers.',
            severity: 'MEDIUM',
          },
        ],
        persistentDeficiencies: ['Omitted double-delete pattern in cache invalidation.'],
        remediationProgress: 75,
        lastUpdated: new Date().toISOString(),
      },
    },
  };

  const store = memoryStore || defaultMemoryStore;
  const nodesList = Object.values(store.nodes);

  const getProficiencyBadge = (level: SkillMemoryNode['proficiencyLevel']) => {
    switch (level) {
      case 'MASTERED':
        return <Badge variant="success" size="sm">MASTERED</Badge>;
      case 'PROFICIENT':
        return <Badge variant="secondary" size="sm">PROFICIENT</Badge>;
      case 'DEVELOPING':
        return <Badge variant="primary" size="sm">DEVELOPING</Badge>;
      case 'NOVICE':
        return <Badge variant="warning" size="sm">NOVICE</Badge>;
    }
  };

  return (
    <div className={`space-y-6 text-left ${className}`}>
      {/* Header & Global Reflection Narrative */}
      <Card variant="glow-primary" className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-lg shrink-0">
              <FaBrain />
            </div>
            <div>
              <h3 className="text-base font-heading font-bold text-white">
                Candidate Skill Knowledge Graph & Memory Store (Reflexion)
              </h3>
              <p className="text-[11px] text-gray-400 font-mono">
                Episodic-Semantic Dual Memory Architecture &bull; NeurIPS 2023
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
            <FaChartLine className="text-emerald-400" />
            <span className="text-gray-300">{nodesList.length} Skill Memory Nodes Tracked</span>
          </div>
        </div>

        {/* Global AI Narrative Summary */}
        <p className="text-xs text-gray-300 leading-relaxed bg-[#030712]/60 p-3.5 rounded-xl border border-white/5 font-mono">
          {store.globalReflectionSummary}
        </p>
      </Card>

      {/* Interactive Skill Nodes Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {nodesList.map((node) => {
          const hasHighDeficiency = node.reflections.some((r) => r.severity === 'HIGH');

          return (
            <Card
              key={node.skillId}
              variant="glass"
              onClick={() => setSelectedNode(node)}
              className={`p-5 space-y-3 cursor-pointer hover:border-primary/50 transition duration-200 text-left relative ${
                node.proficiencyLevel === 'MASTERED'
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : node.proficiencyLevel === 'PROFICIENT'
                  ? 'bg-indigo-500/5 border-indigo-500/20'
                  : node.proficiencyLevel === 'DEVELOPING'
                  ? 'bg-blue-500/5 border-blue-500/20'
                  : 'bg-amber-500/5 border-amber-500/20'
              }`}
            >
              {/* High Severity Animated Attention Badge */}
              {hasHighDeficiency && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1 animate-pulse font-mono z-10">
                  <FaFire size={8} /> HIGH DEFICIENCY
                </div>
              )}

              <div className="flex justify-between items-start">
                <h4 className="text-xs font-bold text-white font-heading truncate max-w-[70%]">
                  {node.skillName}
                </h4>
                {getProficiencyBadge(node.proficiencyLevel)}
              </div>

              {/* Progress Gauge & Stats */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-gray-400">Remediation Progress</span>
                  <span className="text-emerald-400 font-bold">{node.remediationProgress}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary via-accent to-emerald-400 transition-all duration-500"
                    style={{ width: `${node.remediationProgress}%` }}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 flex justify-between items-center text-[10px] text-gray-500 font-mono">
                <span>{node.attemptsCount} Sessions</span>
                <span className="text-primary flex items-center gap-1 hover:underline">
                  <FaHistory size={8} /> View Timeline &rarr;
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Reflection History Drawer */}
      <ReflectionTimelineDrawer
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  );
}
