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

  // Empty state: no memory store yet
  if (!memoryStore || Object.keys(memoryStore.nodes).length === 0) {
    return (
      <div className={`space-y-6 text-left ${className}`}>
        <div className="bg-bg-surface rounded-2xl p-8 border border-border flex flex-col items-center justify-center gap-4 text-center shadow-soft">
          <FaBrain className="text-4xl text-text-secondary/40" />
          <h3 className="text-sm font-heading font-bold text-text-primary">Skill Memory Graph</h3>
          <p className="text-xs text-text-secondary leading-relaxed max-w-sm">
            Your personalized skill memory graph will populate after completing your first interview session.
            Reflexion traces are generated automatically post-evaluation.
          </p>
          <div className="flex items-center gap-2 text-xs font-mono text-text-secondary bg-bg-surface-alt px-3 py-1.5 rounded-lg border border-border">
            <FaGraduationCap aria-hidden="true" />
            <span>0 Skill Memory Nodes Tracked</span>
          </div>
        </div>
      </div>
    );
  }

  const store = memoryStore;
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
      <Card variant="default" className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary-soft border border-primary/20 flex items-center justify-center text-primary text-lg shrink-0">
              <FaBrain aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base font-heading font-bold text-text-primary">
                Candidate Skill Knowledge Graph &amp; Memory Store (Reflexion)
              </h3>
              <p className="text-xs text-text-secondary font-mono">
                Episodic-Semantic Dual Memory Architecture &bull; NeurIPS 2023
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono bg-bg-surface-alt px-3 py-1.5 rounded-xl border border-border">
            <FaChartLine className="text-primary" aria-hidden="true" />
            <span className="text-text-secondary">{nodesList.length} Skill Memory Nodes Tracked</span>
          </div>
        </div>

        {/* Global AI Narrative Summary */}
        <p className="text-xs text-text-secondary leading-relaxed bg-bg-surface-alt p-3.5 rounded-xl border border-border font-mono">
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
              variant="default"
              onClick={() => setSelectedNode(node)}
              className={`p-5 space-y-3 cursor-pointer hover:border-primary/50 transition duration-200 text-left relative ${
                node.proficiencyLevel === 'MASTERED'
                  ? 'bg-success/5 border-success/30'
                  : node.proficiencyLevel === 'PROFICIENT'
                  ? 'bg-primary-soft/40 border-primary/25'
                  : node.proficiencyLevel === 'DEVELOPING'
                  ? 'bg-bg-surface-alt border-border'
                  : 'bg-warning/10 border-warning/30'
              }`}
            >
              {/* High Severity Animated Attention Badge */}
              {hasHighDeficiency && (
                <div className="absolute -top-2 -right-2 bg-danger text-text-on-primary text-xs font-bold px-2 py-0.5 rounded-full shadow-soft flex items-center gap-1 animate-pulse font-mono z-10">
                  <FaFire size={8} aria-hidden="true" /> HIGH DEFICIENCY
                </div>
              )}

              <div className="flex justify-between items-start">
                <h4 className="text-xs font-bold text-text-primary font-heading truncate max-w-[70%]">
                  {node.skillName}
                </h4>
                {getProficiencyBadge(node.proficiencyLevel)}
              </div>

              {/* Progress Gauge & Stats */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-text-secondary">Remediation Progress</span>
                  <span className="text-success font-bold">{node.remediationProgress}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-bg-surface-alt border border-border overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${node.remediationProgress}%` }}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-border flex justify-between items-center text-xs text-text-secondary font-mono">
                <span>{node.attemptsCount} Sessions</span>
                <span className="text-primary flex items-center gap-1 hover:underline">
                  <FaHistory size={8} aria-hidden="true" /> View Timeline &rarr;
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
