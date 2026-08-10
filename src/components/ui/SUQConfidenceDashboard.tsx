'use client';

import React, { useState } from 'react';
import type { SUQEvaluationResult, SinglePassEvaluation } from '@/types/index';
import Card from './Card';
import Badge from './Badge';
import Button from './Button';
import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaChevronDown,
  FaChevronUp,
  FaBrain,
  FaChartPie,
  FaRedo,
} from 'react-icons/fa';

export interface SUQConfidenceDashboardProps {
  suqEvaluation?: SUQEvaluationResult;
  onTriggerValidationPass?: () => void;
  className?: string;
}

export default function SUQConfidenceDashboard({
  suqEvaluation,
  onTriggerValidationPass,
  className = '',
}: SUQConfidenceDashboardProps) {
  const [expandedCoT, setExpandedCoT] = useState<Record<string, boolean>>({});
  const [showPassDrawer, setShowPassDrawer] = useState(false);

  // Empty state: no evaluation data yet
  if (!suqEvaluation) {
    return (
      <div className={`space-y-6 text-left ${className}`}>
        <div className="bg-[#0B0F17]/80 p-5 rounded-2xl border border-white/10 flex flex-col items-center justify-center gap-3 text-center py-10">
          <FaBrain className="text-4xl text-white/20" />
          <h3 className="text-sm font-heading font-bold text-white">Prometheus-2 Evaluation</h3>
          <p className="text-xs text-gray-400 leading-relaxed max-w-sm">
            N=5 multi-pass Chain-of-Thought results will appear here after your interview evaluation is complete.
          </p>
        </div>
      </div>
    );
  }

  const suq = suqEvaluation;

  const toggleCoT = (key: string) => {
    setExpandedCoT((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const seFormatted = suq.semanticEntropy.toFixed(2);

  // Helper to determine rubric score descriptor text
  const getDescriptor = (score: number) => {
    if (score >= 4.5) return 'FAANG-Level Mastery';
    if (score >= 3.8) return 'Strong / Above Average';
    if (score >= 2.8) return 'Average / Partial';
    if (score >= 1.8) return 'Below Average';
    return 'Poor / Inaccurate';
  };

  // Rubric Dimensions Definition
  const rubricDimensions = [
    {
      key: 'technicalAccuracy',
      title: 'Technical Accuracy',
      weight: '35%',
      score: suq.passes[0]?.scores.technicalAccuracy ?? 0,
      feedback: suq.aggregatedRubricFeedback?.technicalAccuracy ?? 'No feedback available.',
    },
    {
      key: 'systemDesignLogic',
      title: 'System Architecture & Logic',
      weight: '30%',
      score: suq.passes[0]?.scores.systemDesignLogic ?? 0,
      feedback: suq.aggregatedRubricFeedback?.systemDesignLogic ?? 'No feedback available.',
    },
    {
      key: 'edgeCaseHandling',
      title: 'Edge-Case Awareness',
      weight: '20%',
      score: suq.passes[0]?.scores.edgeCaseHandling ?? 0,
      feedback: suq.aggregatedRubricFeedback?.edgeCaseHandling ?? 'No feedback available.',
    },
    {
      key: 'communicationClarity',
      title: 'Communication & Tone',
      weight: '15%',
      score: suq.passes[0]?.scores.communicationClarity ?? 0,
      feedback: suq.aggregatedRubricFeedback?.communicationClarity ?? 'No feedback available.',
    },
  ];

  return (
    <div className={`space-y-6 text-left ${className}`}>
      {/* 1. Header & Confidence Badge */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0B0F17]/80 p-4 sm:p-5 rounded-2xl border border-white/10 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-lg shrink-0">
            <FaBrain />
          </div>
          <div>
            <h3 className="text-sm font-heading font-bold text-white flex items-center gap-2">
              Prometheus-2 Rubric &amp; Semantic Uncertainty Engine
            </h3>
            <p className="text-[11px] text-gray-400">
              N = 5 Multi-Pass CoT Evaluation &bull; Latency: {suq.latencyMs}ms
            </p>
          </div>
        </div>

        {/* Confidence Badge */}
        <div>
          {suq.confidenceLevel === 'HIGH' && (
            <Badge variant="success" size="md" className="flex items-center gap-1.5 px-3 py-1 text-xs">
              <FaCheckCircle className="text-emerald-400 text-xs" />
              <span>Model Agreement: High (SE: {seFormatted})</span>
            </Badge>
          )}

          {suq.confidenceLevel === 'MEDIUM' && (
            <Badge variant="warning" size="md" className="flex items-center gap-1.5 px-3 py-1 text-xs">
              <FaExclamationTriangle className="text-yellow-400 text-xs" />
              <span>Model Agreement: Moderate (SE: {seFormatted})</span>
            </Badge>
          )}

          {suq.confidenceLevel === 'LOW' && (
            <Badge variant="danger" size="md" className="flex items-center gap-1.5 px-3 py-1 text-xs">
              <FaTimesCircle className="text-red-400 text-xs" />
              <span>Model Variance Detected (SE: {seFormatted})</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Low-Confidence Alert Banner */}
      {(suq.requiresValidationPass || suq.confidenceLevel === 'LOW') && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 text-base shrink-0">
              <FaExclamationTriangle />
            </div>
            <div className="space-y-0.5 text-xs text-left">
              <h5 className="font-bold text-white leading-none">High Model Variance Detected</h5>
              <p className="text-red-200/80 leading-relaxed text-[11px]">
                Multi-pass sampling detected variance across evaluation outputs (Semantic Entropy SE = {seFormatted}).
              </p>
            </div>
          </div>
          {onTriggerValidationPass && (
            <Button
              onClick={onTriggerValidationPass}
              variant="glass"
              size="sm"
              className="border-red-500/40 text-red-300 hover:bg-red-500/20 shrink-0 text-xs"
            >
              <FaRedo className="mr-1 text-xs" />
              Trigger Secondary Review
            </Button>
          )}
        </div>
      )}

      {/* 2. Prometheus-2 Fine-Grained 4-Dimensional Rubric Grid */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 pl-1 flex items-center gap-2">
          <span>Prometheus-2 Fine-Grained Rubric Dimensions</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rubricDimensions.map((dim) => {
            const isExpanded = !!expandedCoT[dim.key];
            const descriptor = getDescriptor(dim.score);

            return (
              <Card variant="glass" key={dim.key} className="p-4 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-white block">{dim.title}</span>
                      <span className="text-[10px] text-gray-400 font-mono">Weight: {dim.weight}</span>
                    </div>
                    <Badge variant="primary" size="sm">
                      {dim.score.toFixed(1)} / 5.0
                    </Badge>
                  </div>

                  {/* Rating Stars & Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-accent font-semibold">{descriptor}</span>
                      <span className="text-gray-400 font-mono">{Math.round((dim.score / 5) * 100)}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                        style={{ width: `${(dim.score / 5) * 100}%` }}
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-300 leading-relaxed bg-white/2 p-2.5 rounded-lg border border-white/5">
                    {dim.feedback}
                  </p>
                </div>

                {/* Collapsible Chain-of-Thought Reasoning Accordion */}
                <div className="border-t border-white/5 pt-2">
                  <button
                    type="button"
                    onClick={() => toggleCoT(dim.key)}
                    className="w-full flex items-center justify-between text-[10px] text-gray-400 hover:text-white transition cursor-pointer font-mono"
                  >
                    <span>Chain-of-Thought Reasoning</span>
                    {isExpanded ? <FaChevronUp size={9} /> : <FaChevronDown size={9} />}
                  </button>

                  {isExpanded && (
                    <div className="mt-2 p-3 rounded-lg bg-[#030712]/60 border border-white/5 text-[11px] font-mono text-gray-300 leading-relaxed break-words space-y-1">
                      <span className="text-[9px] text-primary font-bold uppercase block tracking-wider">
                        LLM CoT Logic Path
                      </span>
                      <p>{suq.passes[0]?.cotReasoning ?? 'Step-by-step reasoning evaluated across 5 parallel sampling passes.'}</p>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 3. Semantic Entropy & Cluster Distribution Visualizer */}
      <Card variant="glass" className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <FaChartPie className="text-accent text-sm" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Semantic Uncertainty Quantification (SUQ)
            </h4>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-gray-400 text-[10px]">Semantic Entropy (SE):</span>
            <span className="text-white font-bold px-2 py-0.5 rounded bg-white/5 border border-white/10">
              {seFormatted}
            </span>
          </div>
        </div>

        {/* Cluster Distribution Grid */}
        <div className="space-y-3">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block font-mono">
            Equivalence Clusters (C = {'{c_1, ..., c_k}'}) &bull; Score Variance &delta; &le; 0.5
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {suq.clusters.map((cluster) => {
              const probPct = Math.round(cluster.probability * 100);
              return (
                <div
                  key={cluster.clusterId}
                  className="p-3 rounded-xl bg-[#030712]/50 border border-white/5 space-y-2 text-xs"
                >
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-semibold text-white">Cluster {cluster.clusterId}</span>
                    <Badge variant="primary" size="sm">
                      P(c): {probPct}%
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-gray-400">
                      <span>Representative Score:</span>
                      <span className="text-emerald-400 font-bold">{cluster.representativeScore.toFixed(1)} / 5.0</span>
                    </div>
                    <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full bg-emerald-400"
                        style={{ width: `${probPct}%` }}
                      />
                    </div>
                  </div>

                  <span className="text-[9px] text-gray-500 font-mono block">
                    Passes assigned: [{cluster.passIndices.map((i) => i + 1).join(', ')}]
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pass Sampling Drawer Toggle */}
        <div className="border-t border-white/5 pt-3">
          <button
            type="button"
            onClick={() => setShowPassDrawer(!showPassDrawer)}
            className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-white transition cursor-pointer font-mono"
          >
            <span>View All N = 5 Sampling Pass CoT Diagnostics</span>
            {showPassDrawer ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
          </button>

          {showPassDrawer && (
            <div className="mt-3 space-y-3">
              {suq.passes.map((pass: SinglePassEvaluation, idx: number) => (
                <div key={idx} className="p-3 rounded-xl bg-white/2 border border-white/5 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">Pass {idx + 1}</span>
                    <span className="text-accent font-mono text-[10px]">
                      Overall: {pass.overallScore.toFixed(2)} / 5.0
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-300 font-mono bg-[#030712]/60 p-2.5 rounded-lg border border-white/5">
                    {pass.cotReasoning}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
