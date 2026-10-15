'use client';

import React from 'react';
import type { SkillMemoryNode, VerbalReflection } from '@/types/index';
import Badge from './Badge';
import Card from './Card';
import {
  FaTimes,
  FaExclamationTriangle,
  FaCheckCircle,
  FaLightbulb,
  FaHistory,
  FaGraduationCap,
  FaFire,
} from 'react-icons/fa';

export interface ReflectionTimelineDrawerProps {
  node: SkillMemoryNode | null;
  onClose: () => void;
  className?: string;
}

export default function ReflectionTimelineDrawer({
  node,
  onClose,
  className = '',
}: ReflectionTimelineDrawerProps) {
  if (!node) return null;

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

  const getSeverityBadge = (severity: VerbalReflection['severity']) => {
    switch (severity) {
      case 'HIGH':
        return (
          <Badge variant="danger" size="sm" className="animate-pulse flex items-center gap-1">
            <FaExclamationTriangle size={8} /> HIGH DEFICIENCY
          </Badge>
        );
      case 'MEDIUM':
        return <Badge variant="warning" size="sm">MEDIUM DEFICIENCY</Badge>;
      case 'LOW':
        return <Badge variant="success" size="sm">LOW / RESOLVED</Badge>;
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity ${className}`}
      style={{ WebkitBackdropFilter: 'blur(4px)', backdropFilter: 'blur(4px)' }}
    >
      {/* Backdrop overlay */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Container */}
      <div className="relative w-full max-w-lg bg-bg-surface border-l border-border h-full overflow-y-auto p-6 space-y-6 shadow-soft z-10 text-left">
        {/* Drawer Header */}
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FaHistory className="text-primary text-sm" />
              <h3 className="text-sm font-heading font-bold text-text-primary uppercase tracking-wider">
                Verbal Reflection Timeline (Reflexion SR)
              </h3>
            </div>
            <h2 className="text-xl font-heading font-extrabold text-text-primary">{node.skillName}</h2>
            <div className="flex items-center gap-2 pt-1">
              {getProficiencyBadge(node.proficiencyLevel)}
              <span className="text-xs text-text-secondary font-mono">
                {node.attemptsCount} Session Attempts &bull; {node.remediationProgress}% Remediated
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close reflection details drawer"
            className="p-2 text-text-secondary hover:text-text-primary rounded-lg hover:bg-bg-surface-alt transition cursor-pointer"
          >
            <FaTimes size={14} aria-hidden="true" />
          </button>
        </div>

        {/* Remediation Progress Bar */}
        <div className="bg-bg-surface-alt p-4 rounded-xl border border-border space-y-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-text-secondary font-semibold">Remediation Progress Index</span>
            <span className="text-success font-bold">{node.remediationProgress}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-bg-surface border border-border overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${node.remediationProgress}%` }}
            />
          </div>
        </div>

        {/* Persistent Deficiencies List */}
        {node.persistentDeficiencies.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block font-mono">
              Active Persistent Deficiencies
            </span>
            <div className="space-y-1.5">
              {node.persistentDeficiencies.map((def, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-danger/10 border border-danger/20 text-xs text-danger flex items-start gap-2"
                >
                  <FaFire className="text-danger shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="leading-tight">{def}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Episodic Verbal Reflection History List */}
        <div className="space-y-4">
          <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block font-mono">
            Episodic Reflection Traces ({node.reflections.length})
          </span>

          <div className="space-y-4">
            {node.reflections.map((ref, idx) => (
              <Card key={ref.id || idx} variant="default" className="p-4 space-y-3 relative text-left">
                {/* Reflection Header */}
                <div className="flex justify-between items-center text-xs border-b border-border pb-2">
                  <span className="font-mono text-text-secondary text-xs">
                    Trace #{node.reflections.length - idx} &bull; {new Date(ref.timestamp).toLocaleDateString()}
                  </span>
                  {getSeverityBadge(ref.severity)}
                </div>

                {/* 1. Mistake Summary */}
                <div className="space-y-1">
                  <span className="text-xs font-bold text-warning uppercase tracking-wider flex items-center gap-1 font-mono">
                    <FaExclamationTriangle size={9} aria-hidden="true" /> Mistake Summary
                  </span>
                  <p className="text-xs text-text-secondary leading-relaxed bg-bg-surface-alt p-2.5 rounded-lg border border-border">
                    {ref.mistakeSummary}
                  </p>
                </div>

                {/* 2. Root-Cause Analysis */}
                <div className="space-y-1">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1 font-mono">
                    <FaLightbulb size={9} aria-hidden="true" /> Root-Cause Analysis (Why it occurred)
                  </span>
                  <p className="text-xs text-text-secondary leading-relaxed bg-bg-surface-alt p-2.5 rounded-lg border border-border">
                    {ref.rootCauseAnalysis}
                  </p>
                </div>

                {/* 3. Actionable Remediation Checklist */}
                <div className="space-y-1">
                  <span className="text-xs font-bold text-success uppercase tracking-wider flex items-center gap-1 font-mono">
                    <FaGraduationCap size={9} aria-hidden="true" /> Actionable Remediation Step
                  </span>
                  <div className="flex items-start gap-2 bg-success/5 p-2.5 rounded-lg border border-success/20 text-xs text-success">
                    <FaCheckCircle size={10} className="shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{ref.actionableRemediation}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
