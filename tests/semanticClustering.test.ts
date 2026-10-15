/**
 * tests/semanticClustering.test.ts
 *
 * Verification suite for B1: Semantic clustering for Semantic Entropy (Kuhn et al. 2023).
 * Tests bidirectional-entailment-style clustering via LLM, score-variance fallback on malformed JSON,
 * entropy calculation, clusteringMethod tracking, and SUQConfidenceDashboard display.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SinglePassEvaluation, SUQEvaluationResult } from '../src/types/index';

var mockExecuteAnthropicRequest = jest.fn();

jest.mock('@/lib/ai/aiConfig', () => {
  const actual = jest.requireActual('@/lib/ai/aiConfig');
  return {
    ...actual,
    executeAnthropicRequest: (...args: any[]) => mockExecuteAnthropicRequest(...args),
  };
});

jest.mock('../src/lib/ai/aiConfig', () => {
  const actual = jest.requireActual('../src/lib/ai/aiConfig');
  return {
    ...actual,
    executeAnthropicRequest: (...args: any[]) => mockExecuteAnthropicRequest(...args),
  };
});

import {
  computeSemanticEquivalenceAndEntropy,
  computeScoreVarianceClustering,
  buildPassComparisonText,
} from '../src/lib/services/interviewEvaluation.server';
import SUQConfidenceDashboard from '../src/components/ui/SUQConfidenceDashboard';

function createMockPass(
  score: number,
  overrides?: Partial<SinglePassEvaluation>
): SinglePassEvaluation {
  return {
    overallScore: score,
    scores: {
      technicalAccuracy: score,
      systemDesignLogic: score,
      edgeCaseHandling: score,
      communicationClarity: score,
    },
    criterionEvidence: {
      technicalAccuracy: `Candidate demonstrated accurate concepts for score ${score}.`,
      systemDesignLogic: `Decomposed system into microservices with modular boundaries for score ${score}.`,
      edgeCaseHandling: `Identified null boundary conditions and failovers for score ${score}.`,
      communicationClarity: `Clear STAR structured response for score ${score}.`,
    },
    decisionSummary: `Candidate achieved score ${score}/5 with competent reasoning.`,
    feedback: `Focus on scaling and database index tuning for score ${score}.`,
    cotReasoning: `Step-by-step evaluation for pass at score ${score}.`,
    ...overrides,
  };
}

describe('B1: Semantic Clustering for Semantic Entropy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Comparison Text Builder', () => {
    it('builds comparison text incorporating criterionEvidence, decisionSummary, and feedback', () => {
      const pass = createMockPass(4.2);
      const text = buildPassComparisonText(pass);

      expect(text).toContain('Candidate demonstrated accurate concepts for score 4.2.');
      expect(text).toContain('Decomposed system into microservices');
      expect(text).toContain('Identified null boundary conditions');
      expect(text).toContain('Clear STAR structured response');
      expect(text).toContain('Candidate achieved score 4.2/5');
      expect(text).toContain('Focus on scaling and database index tuning');
    });

    it('falls back to cotReasoning when criterionEvidence is absent', () => {
      const pass: SinglePassEvaluation = {
        overallScore: 3.0,
        scores: { technicalAccuracy: 3, systemDesignLogic: 3, edgeCaseHandling: 3, communicationClarity: 3 },
        cotReasoning: 'Reasoning without criterion evidence.',
        decisionSummary: 'Summary text.',
        feedback: 'Feedback text.',
      };
      const text = buildPassComparisonText(pass);

      expect(text).toContain('Reasoning without criterion evidence.');
      expect(text).toContain('Summary text.');
      expect(text).toContain('Feedback text.');
    });

    it('handles minimal pass with only overallScore safely', () => {
      const pass: SinglePassEvaluation = {
        overallScore: 2.5,
        scores: { technicalAccuracy: 2.5, systemDesignLogic: 2.5, edgeCaseHandling: 2.5, communicationClarity: 2.5 },
        feedback: '',
      };
      const text = buildPassComparisonText(pass);
      expect(text).toContain('Overall Score: 2.5/5');
    });
  });

  describe('LLM Semantic Equivalence Clustering', () => {
    it('identical passes: clusters all 3 passes into 1 cluster with SE = 0 and clusteringMethod: "semantic-llm"', async () => {
      mockExecuteAnthropicRequest.mockResolvedValueOnce({
        success: true,
        text: JSON.stringify({
          clusters: [
            { passIndices: [0, 1, 2] },
          ],
        }),
        latencyMs: 120,
        modelId: 'claude-sonnet-5-5',
        status: 'live',
      });

      const passes = [
        createMockPass(4.0, { feedback: 'Strong grasp of distributed caches.' }),
        createMockPass(4.0, { feedback: 'Solid architectural explanation of Redis.' }),
        createMockPass(4.0, { feedback: 'Deep understanding of in-memory caching.' }),
      ];

      const result = await computeSemanticEquivalenceAndEntropy(passes, 0.5, {
        anthropicApiKey: 'mock-key',
      });

      expect(result.clusteringMethod).toBe('semantic-llm');
      expect(result.clusters).toHaveLength(1);
      expect(result.clusters[0].passIndices).toEqual([0, 1, 2]);
      expect(result.clusters[0].probability).toBe(1.0);
      expect(result.semanticEntropy).toBeCloseTo(0, 5);
      expect(result.confidenceLevel).toBe('HIGH');
      expect(result.requiresValidationPass).toBe(false);
      expect(mockExecuteAnthropicRequest).toHaveBeenCalledTimes(1);

      // Verify prompt was called with temperature 0
      const callArgs = mockExecuteAnthropicRequest.mock.calls[0][0];
      expect(callArgs.temperature).toBe(0);
    });

    it('split passes: clusters 3 passes into [0, 1] and [2] with SE > 0.8 and clusteringMethod: "semantic-llm"', async () => {
      mockExecuteAnthropicRequest.mockResolvedValueOnce({
        success: true,
        text: JSON.stringify({
          clusters: [
            { passIndices: [0, 1] },
            { passIndices: [2] },
          ],
        }),
        latencyMs: 150,
        modelId: 'claude-sonnet-5-5',
        status: 'live',
      });

      const passes = [
        createMockPass(4.0, { feedback: 'Pass 0: Strong architecture.' }),
        createMockPass(4.0, { feedback: 'Pass 1: Equivalent strong architecture.' }),
        createMockPass(1.5, { feedback: 'Pass 2: Fundamental concurrency omissions.' }),
      ];

      const result = await computeSemanticEquivalenceAndEntropy(passes, 0.5, {
        anthropicApiKey: 'mock-key',
      });

      expect(result.clusteringMethod).toBe('semantic-llm');
      expect(result.clusters).toHaveLength(2);
      expect(result.clusters[0].passIndices).toEqual([0, 1]);
      expect(result.clusters[0].probability).toBeCloseTo(2 / 3, 3);
      expect(result.clusters[1].passIndices).toEqual([2]);
      expect(result.clusters[1].probability).toBeCloseTo(1 / 3, 3);
      // For 2+1 split: SE = -(2/3*log2(2/3) + 1/3*log2(1/3)) ≈ 0.918 > 0.8
      expect(result.semanticEntropy).toBeGreaterThan(0.8);
      expect(result.confidenceLevel).toBe('LOW');
      expect(result.requiresValidationPass).toBe(true);
    });

    it('three-way split passes: assigns each pass to its own cluster', async () => {
      mockExecuteAnthropicRequest.mockResolvedValueOnce({
        success: true,
        text: JSON.stringify({
          clusters: [
            { passIndices: [0] },
            { passIndices: [1] },
            { passIndices: [2] },
          ],
        }),
        latencyMs: 140,
        modelId: 'claude-sonnet-5-5',
        status: 'live',
      });

      const passes = [
        createMockPass(4.5),
        createMockPass(3.0),
        createMockPass(1.5),
      ];

      const result = await computeSemanticEquivalenceAndEntropy(passes, 0.5, {
        anthropicApiKey: 'mock-key',
      });

      expect(result.clusteringMethod).toBe('semantic-llm');
      expect(result.clusters).toHaveLength(3);
      expect(result.semanticEntropy).toBeCloseTo(Math.log2(3), 1);
      expect(result.confidenceLevel).toBe('LOW');
    });

    it('supports array-of-arrays format from model response', async () => {
      mockExecuteAnthropicRequest.mockResolvedValueOnce({
        success: true,
        text: JSON.stringify({
          clusters: [[0, 2], [1]],
        }),
        latencyMs: 110,
        modelId: 'claude-sonnet-5-5',
        status: 'live',
      });

      const passes = [createMockPass(4), createMockPass(2), createMockPass(4)];
      const result = await computeSemanticEquivalenceAndEntropy(passes, 0.5, {
        anthropicApiKey: 'mock-key',
      });

      expect(result.clusteringMethod).toBe('semantic-llm');
      expect(result.clusters).toHaveLength(2);
      expect(result.clusters[0].passIndices).toEqual([0, 2]);
      expect(result.clusters[1].passIndices).toEqual([1]);
    });
  });

  describe('Fallback to Score-Variance Clustering', () => {
    it('malformed JSON response falls back to score-variance clustering without throwing', async () => {
      mockExecuteAnthropicRequest.mockResolvedValueOnce({
        success: true,
        text: 'This is invalid JSON output { "clusters": broken',
        latencyMs: 80,
        modelId: 'claude-sonnet-5-5',
        status: 'live',
      });

      const passes = [
        createMockPass(3.0),
        createMockPass(3.2),
        createMockPass(5.0),
      ];

      const result = await computeSemanticEquivalenceAndEntropy(passes, 0.5, {
        anthropicApiKey: 'mock-key',
      });

      expect(result.clusteringMethod).toBe('score-variance');
      expect(result.clusters.length).toBeGreaterThan(0);
      expect(typeof result.semanticEntropy).toBe('number');
      expect(Number.isFinite(result.semanticEntropy)).toBe(true);
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(result.confidenceLevel);
    });

    it('invalid cluster partition (missing pass index) falls back to score-variance', async () => {
      mockExecuteAnthropicRequest.mockResolvedValueOnce({
        success: true,
        text: JSON.stringify({
          clusters: [{ passIndices: [0, 1] }], // Missing pass index 2 for N=3
        }),
        latencyMs: 90,
        modelId: 'claude-sonnet-5-5',
        status: 'live',
      });

      const passes = [createMockPass(2.0), createMockPass(2.0), createMockPass(4.0)];
      const result = await computeSemanticEquivalenceAndEntropy(passes, 0.5, {
        anthropicApiKey: 'mock-key',
      });

      expect(result.clusteringMethod).toBe('score-variance');
      expect(result.clusters).toHaveLength(2);
    });

    it('invalid cluster partition (out-of-bounds index) falls back to score-variance', async () => {
      mockExecuteAnthropicRequest.mockResolvedValueOnce({
        success: true,
        text: JSON.stringify({
          clusters: [{ passIndices: [0, 1, 99] }], // 99 is invalid for N=3
        }),
        latencyMs: 90,
        modelId: 'claude-sonnet-5-5',
        status: 'live',
      });

      const passes = [createMockPass(3.0), createMockPass(3.0), createMockPass(3.0)];
      const result = await computeSemanticEquivalenceAndEntropy(passes, 0.5, {
        anthropicApiKey: 'mock-key',
      });

      expect(result.clusteringMethod).toBe('score-variance');
      expect(result.clusters).toHaveLength(1);
    });

    it('duplicate pass index across clusters falls back to score-variance', async () => {
      mockExecuteAnthropicRequest.mockResolvedValueOnce({
        success: true,
        text: JSON.stringify({
          clusters: [
            { passIndices: [0, 1] },
            { passIndices: [1, 2] }, // index 1 appears twice
          ],
        }),
        latencyMs: 85,
        modelId: 'claude-sonnet-5-5',
        status: 'live',
      });

      const passes = [createMockPass(3.0), createMockPass(3.0), createMockPass(3.0)];
      const result = await computeSemanticEquivalenceAndEntropy(passes, 0.5, {
        anthropicApiKey: 'mock-key',
      });

      expect(result.clusteringMethod).toBe('score-variance');
    });

    it('LLM API error (e.g. rate limit / network error) falls back to score-variance', async () => {
      mockExecuteAnthropicRequest.mockResolvedValueOnce({
        success: false,
        error: 'Anthropic rate limit exceeded (HTTP 429)',
        latencyMs: 50,
        modelId: 'claude-sonnet-5-5',
        status: 'rate_limited',
      });

      const passes = [createMockPass(2.0), createMockPass(2.2), createMockPass(4.5)];
      const result = await computeSemanticEquivalenceAndEntropy(passes, 0.5, {
        anthropicApiKey: 'mock-key',
      });

      expect(result.clusteringMethod).toBe('score-variance');
      expect(result.clusters).toHaveLength(2);
    });

    it('missing API key falls back to score-variance synchronously', () => {
      const passes = [createMockPass(3.0), createMockPass(3.0), createMockPass(3.0)];
      const result = computeSemanticEquivalenceAndEntropy(passes, 0.5);

      expect(result.clusteringMethod).toBe('score-variance');
      expect(result.clusters).toHaveLength(1);
      expect(result.semanticEntropy).toBeCloseTo(0, 5);
    });
  });

  describe('SUQConfidenceDashboard UI Display', () => {
    const mockSUQBase: SUQEvaluationResult = {
      finalScore: 4.2,
      confidenceLevel: 'HIGH',
      semanticEntropy: 0.12,
      clusters: [
        {
          clusterId: 1,
          representativeScore: 4.2,
          passIndices: [0, 1, 2],
          probability: 1.0,
        },
      ],
      passes: [createMockPass(4.2), createMockPass(4.2), createMockPass(4.2)],
      aggregatedRubricFeedback: {
        technicalAccuracy: 'Solid tech depth.',
        systemDesignLogic: 'Modular architecture.',
        edgeCaseHandling: 'Addressed edge cases.',
        communicationClarity: 'Clear presentation.',
      },
      requiresValidationPass: false,
      latencyMs: 850,
      passCount: 3,
      evaluationMode: 'live',
      providerStatus: 'available',
      modelId: 'claude-sonnet-5-5',
      source: 'live',
      clusteringMethod: 'semantic-llm',
    };

    it('renders "semantic-llm" clustering method on the dashboard', () => {
      const suq: SUQEvaluationResult = {
        ...mockSUQBase,
        clusteringMethod: 'semantic-llm',
      };

      const html = renderToStaticMarkup(
        React.createElement(SUQConfidenceDashboard, { suqEvaluation: suq })
      );

      expect(html).toContain('Method: semantic-llm');
      expect(html).toContain('clustering-method-badge');
      expect(html).toContain('clustering-method-tag');
      expect(html).toContain('Semantic LLM (Bidirectional Entailment)');
    });

    it('renders "score-variance" clustering method on the dashboard when fallback occurs', () => {
      const suq: SUQEvaluationResult = {
        ...mockSUQBase,
        clusteringMethod: 'score-variance',
      };

      const html = renderToStaticMarkup(
        React.createElement(SUQConfidenceDashboard, { suqEvaluation: suq })
      );

      expect(html).toContain('Method: score-variance');
      expect(html).toContain('clustering-method-badge');
      expect(html).toContain('clustering-method-tag');
      expect(html).toContain('Score Variance');
    });
  });
});
