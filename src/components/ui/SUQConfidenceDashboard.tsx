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
  FaShieldAlt,
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
        <div className="bg-bg-surface p-5 rounded-2xl border border-border shadow-soft flex flex-col items-center justify-center gap-3 text-center py-10">
          <FaBrain className="text-4xl text-text-secondary/40" />
          <h3 className="text-sm font-heading font-bold text-text-primary">Prometheus-2 Evaluation</h3>
          <p className="text-xs text-text-secondary leading-relaxed max-w-sm">
            N=3 multi-pass Chain-of-Thought results will appear here after your interview evaluation is complete.
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-bg-surface p-4 sm:p-5 rounded-2xl border border-border shadow-soft">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary-soft border border-primary/20 flex items-center justify-center text-primary text-lg shrink-0">
            <FaBrain />
          </div>
          <div>
            <h3 className="text-sm font-heading font-bold text-text-primary flex items-center gap-2">
              Prometheus-2 Rubric &amp; Semantic Uncertainty Engine
            </h3>
            <p className="text-xs text-text-secondary">
              N = 3 Multi-Pass CoT Evaluation &bull; Latency: {suq.latencyMs}ms
            </p>
          </div>
        </div>

        {/* Confidence Badge, Grounding Score & Clustering Method */}
        <div className="flex flex-wrap items-center gap-2">
          {suq.clusteringMethod && (
            <Badge
              variant={suq.clusteringMethod === 'semantic-llm' ? 'primary' : 'warning'}
              size="md"
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-mono"
              data-testid="clustering-method-badge"
            >
              <span>Method: {suq.clusteringMethod}</span>
            </Badge>
          )}

          {suq.groundingScore !== undefined && (
            <Badge
              variant={suq.groundingScore >= 0.85 ? 'success' : suq.groundingScore >= 0.5 ? 'warning' : 'danger'}
              size="md"
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-mono"
              data-testid="grounding-score-badge"
            >
              <FaShieldAlt className="text-xs" aria-hidden="true" />
              <span>Grounding: {Math.round(suq.groundingScore * 100)}%</span>
            </Badge>
          )}

          {suq.excludedPassesCount !== undefined && suq.excludedPassesCount > 0 && (
            <Badge
              variant="danger"
              size="md"
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-mono animate-pulse"
              data-testid="excluded-passes-badge"
            >
              <FaExclamationTriangle className="text-danger text-xs" aria-hidden="true" />
              <span>Excluded Passes: {suq.excludedPassesCount}</span>
            </Badge>
          )}

          {suq.source === 'fallback' && (
            <Badge variant="warning" size="md" className="flex items-center gap-1.5 px-3 py-1 text-xs">
              <FaExclamationTriangle className="text-warning text-xs" aria-hidden="true" />
              <span>Offline estimate, not a live AI evaluation</span>
            </Badge>
          )}

          {suq.confidenceLevel === 'HIGH' && (
            <Badge variant="success" size="md" className="flex items-center gap-1.5 px-3 py-1 text-xs">
              <FaCheckCircle className="text-success text-xs" aria-hidden="true" />
              <span>Model Agreement: High (SE: {seFormatted})</span>
            </Badge>
          )}

          {suq.confidenceLevel === 'MEDIUM' && (
            <Badge variant="warning" size="md" className="flex items-center gap-1.5 px-3 py-1 text-xs">
              <FaExclamationTriangle className="text-warning text-xs" aria-hidden="true" />
              <span>Model Agreement: Moderate (SE: {seFormatted})</span>
            </Badge>
          )}

          {suq.confidenceLevel === 'LOW' && (
            <Badge variant="danger" size="md" className="flex items-center gap-1.5 px-3 py-1 text-xs">
              <FaTimesCircle className="text-danger text-xs" aria-hidden="true" />
              <span>Model Variance Detected (SE: {seFormatted})</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Ungrounded Passes Alert Banner */}
      {suq.excludedPassesCount !== undefined && suq.excludedPassesCount > 0 && (
        <div
          className="p-4 rounded-xl border border-warning/40 bg-warning/10 flex items-center gap-3 text-xs"
          role="alert"
          data-testid="ungrounded-passes-alert"
        >
          <div className="h-9 w-9 rounded-lg bg-warning/20 flex items-center justify-center text-warning text-base shrink-0" aria-hidden="true">
            <FaExclamationTriangle />
          </div>
          <div className="space-y-0.5 text-left">
            <h5 className="font-bold text-text-primary">Hallucination Guard: {suq.excludedPassesCount} Pass(es) Excluded</h5>
            <p className="text-text-secondary leading-relaxed">
              {suq.excludedPassesCount} evaluation pass(es) contained unverified or fabricated quotes (groundingScore &lt; 0.50) and were excluded from entropy and confidence calculations.
            </p>
          </div>
        </div>
      )}

      {/* Low-Confidence Alert Banner */}
      {(suq.requiresValidationPass || suq.confidenceLevel === 'LOW') && (
        <div className="p-4 rounded-xl border border-danger/30 bg-danger/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" role="alert">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-danger/20 flex items-center justify-center text-danger text-base shrink-0" aria-hidden="true">
              <FaExclamationTriangle />
            </div>
            <div className="space-y-0.5 text-xs text-left">
              <h5 className="font-bold text-text-primary leading-none">High Model Variance Detected</h5>
              <p className="text-danger leading-relaxed text-xs">
                Multi-pass sampling detected variance across evaluation outputs (Semantic Entropy SE = {seFormatted}).
              </p>
            </div>
          </div>
          {onTriggerValidationPass && (
            <Button
              onClick={onTriggerValidationPass}
              variant="glass"
              size="sm"
              className="border-danger/40 text-danger hover:bg-danger/20 shrink-0 text-xs"
            >
              <FaRedo className="mr-1 text-xs" aria-hidden="true" />
              Trigger Secondary Review
            </Button>
          )}
        </div>
      )}

      {/* 2. Prometheus-2 Fine-Grained 4-Dimensional Rubric Grid */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary pl-1 flex items-center gap-2">
          <span>Prometheus-2 Fine-Grained Rubric Dimensions</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rubricDimensions.map((dim) => {
            const isExpanded = !!expandedCoT[dim.key];
            const descriptor = getDescriptor(dim.score);

            return (
              <Card variant="default" key={dim.key} className="p-4 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-text-primary block">{dim.title}</span>
                      <span className="text-xs text-text-secondary font-mono">Weight: {dim.weight}</span>
                    </div>
                    <Badge variant="primary" size="sm">
                      {dim.score.toFixed(1)} / 5.0
                    </Badge>
                  </div>

                  {/* Rating Stars & Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-primary font-semibold">{descriptor}</span>
                      <span className="text-text-secondary font-mono">{Math.round((dim.score / 5) * 100)}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-bg-surface-alt border border-border overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${(dim.score / 5) * 100}%` }}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-text-secondary leading-relaxed bg-bg-surface-alt p-2.5 rounded-lg border border-border">
                    {dim.feedback}
                  </p>
                </div>

                {/* Collapsible Chain-of-Thought Reasoning Accordion */}
                <div className="border-t border-border pt-2">
                  <button
                    type="button"
                    onClick={() => toggleCoT(dim.key)}
                    aria-expanded={isExpanded}
                    className="w-full flex items-center justify-between text-xs text-text-secondary hover:text-text-primary transition cursor-pointer font-mono"
                  >
                    <span>Chain-of-Thought Reasoning</span>
                    {isExpanded ? <FaChevronUp size={9} aria-hidden="true" /> : <FaChevronDown size={9} aria-hidden="true" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-2 p-3 rounded-lg bg-bg-surface-alt border border-border text-xs font-mono text-text-secondary leading-relaxed break-words space-y-1">
                      <span className="text-xs text-primary font-bold uppercase block tracking-wider">
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
      <Card variant="default" className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <FaChartPie className="text-primary text-sm" />
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
              Semantic Uncertainty Quantification (SUQ)
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
            {suq.clusteringMethod && (
              <div className="flex items-center gap-1.5">
                <span className="text-text-secondary text-xs">Clustering:</span>
                <span
                  className="text-text-primary font-bold px-2 py-0.5 rounded bg-bg-surface-alt border border-border"
                  data-testid="clustering-method-tag"
                >
                  {suq.clusteringMethod}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="text-text-secondary text-xs">Semantic Entropy (SE):</span>
              <span className="text-text-primary font-bold px-2 py-0.5 rounded bg-bg-surface-alt border border-border">
                {seFormatted}
              </span>
            </div>
          </div>
        </div>

        {/* Cluster Distribution Grid */}
        <div className="space-y-3">
          <span className="text-xs text-text-secondary font-bold uppercase tracking-wider block font-mono">
            Equivalence Clusters (C = {'{c_1, ..., c_k}'}) &bull;{' '}
            {suq.clusteringMethod === 'semantic-llm'
              ? 'Semantic LLM (Bidirectional Entailment)'
              : 'Score Variance \u03B4 \u2264 0.5'}
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(suq.clusters ?? []).map((cluster) => {
              const probPct = Math.round(cluster.probability * 100);
              return (
                <div
                  key={cluster.clusterId}
                  className="p-3 rounded-xl bg-bg-surface-alt border border-border space-y-2 text-xs"
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-text-primary">Cluster {cluster.clusterId}</span>
                    <Badge variant="primary" size="sm">
                      P(c): {probPct}%
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-mono text-text-secondary">
                      <span>Representative Score:</span>
                      <span className="text-success font-bold">{cluster.representativeScore.toFixed(1)} / 5.0</span>
                    </div>
                    <div className="w-full h-1 rounded-full bg-bg-surface border border-border overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${probPct}%` }}
                      />
                    </div>
                  </div>

                  <span className="text-xs text-text-secondary font-mono block">
                    Passes assigned: [{cluster.passIndices.map((i) => i + 1).join(', ')}]
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pass Sampling Drawer Toggle */}
        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setShowPassDrawer(!showPassDrawer)}
            aria-expanded={showPassDrawer}
            className="w-full flex items-center justify-between text-xs text-text-secondary hover:text-text-primary transition cursor-pointer font-mono"
          >
            <span>View All N = 5 Sampling Pass CoT Diagnostics</span>
            {showPassDrawer ? <FaChevronUp size={10} aria-hidden="true" /> : <FaChevronDown size={10} aria-hidden="true" />}
          </button>

          {showPassDrawer && (
            <div className="mt-3 space-y-3">
              {suq.passes.map((pass: SinglePassEvaluation, idx: number) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border space-y-2 text-xs ${
                    pass.isUngrounded ? 'bg-danger/10 border-danger/40' : 'bg-bg-surface-alt border-border'
                  }`}
                  data-testid={`pass-diagnostic-${idx + 1}`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-text-primary">Pass {idx + 1}</span>
                      {pass.isUngrounded && (
                        <Badge variant="danger" size="sm" data-testid={`pass-${idx + 1}-ungrounded-badge`}>
                          Ungrounded (Excluded)
                        </Badge>
                      )}
                      {pass.groundingScore !== undefined && (
                        <span className="font-mono text-xs text-text-secondary">
                          Grounding: {Math.round(pass.groundingScore * 100)}%
                        </span>
                      )}
                    </div>
                    <span className="text-primary font-mono text-xs">
                      Overall: {pass.overallScore.toFixed(2)} / 5.0
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary font-mono bg-bg-surface p-2.5 rounded-lg border border-border">
                    {pass.cotReasoning}
                  </p>
                  {pass.criterionEvidence && (
                    <div className="text-[11px] font-mono space-y-1 text-text-secondary pt-1">
                      {Object.entries(pass.criterionEvidence).map(([crit, ev]) => {
                        if (typeof ev === 'object' && ev !== null && 'quote' in ev) {
                          return (
                            <div key={crit} className="flex items-center gap-1.5 flex-wrap">
                              <span className={ev.verified ? 'text-success font-bold' : 'text-danger font-bold'}>
                                {ev.verified ? '✓' : '✗'}
                              </span>
                              <span className="capitalize text-text-primary">{crit}:</span>
                              <span className="italic truncate max-w-xs">&ldquo;{ev.quote}&rdquo;</span>
                              {ev.flagged && (
                                <span className="text-danger font-semibold">[Fabricated / Unverified]</span>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
