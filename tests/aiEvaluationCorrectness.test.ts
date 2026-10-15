/**
 * tests/aiEvaluationCorrectness.test.ts
 *
 * Verifies AI Correctness, Semantic Uncertainty Quantification (SUQ),
 * safe JSON parsing, fallback marking, and score grounding.
 */

import { z } from 'zod';
import { safeParseModelJson, extractJsonString } from '../src/lib/ai/safeJsonParser';
import { AI_CONFIG } from '../src/lib/ai/aiConfig';
import {
  performInterviewEvaluation,
  computeSemanticEquivalenceAndEntropy,
  type EvaluateInterviewInput,
} from '../src/lib/services/interviewEvaluation.server';
import {
  generateSimPOContrastiveEvaluation,
  calculateLengthNormalizedReward,
  benchmarkDeltaCardSchema,
} from '../src/lib/services/simpoEngine.server';
import { generateVerbalSelfReflection } from '../src/lib/services/reflexionService';
import { runLATSMCTS } from '../src/lib/services/latsEngine.server';
import { executeGraphRAGAnalysis } from '../src/lib/services/graphRAG.server';

describe('AI Evaluation Correctness & Grounding Suite', () => {
  describe('Safe JSON Parser & Guardrails', () => {
    const testSchema = z.object({
      name: z.string(),
      score: z.number().min(1).max(5),
    });

    it('parses raw JSON string adhering to schema', () => {
      const input = '{"name": "React Hooks", "score": 4.5}';
      const result = safeParseModelJson(input, testSchema);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'React Hooks', score: 4.5 });
    });

    it('extracts and parses markdown-fenced JSON', () => {
      const input = 'Here is the analysis:\n```json\n{"name": "Distributed Consensus", "score": 5}\n```\nHope this helps!';
      const result = safeParseModelJson(input, testSchema);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'Distributed Consensus', score: 5 });
    });

    it('returns success: false without throwing on malformed JSON syntax', () => {
      const malformedInput = '{"name": "Broken JSON", "score": 4, ';
      const result = safeParseModelJson(malformedInput, testSchema);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns success: false when JSON does not conform to Zod schema', () => {
      const outOfBoundsInput = '{"name": "Out of Range", "score": 99}';
      const result = safeParseModelJson(outOfBoundsInput, testSchema);
      expect(result.success).toBe(false);
      expect(result.error).toContain('score');
    });

    it('extracts inner json braces using extractJsonString correctly', () => {
      const rawText = 'Preamble text { "key": "value" } trailing notes';
      expect(extractJsonString(rawText)).toBe('{ "key": "value" }');
    });
  });

  describe('SUQ Pass Count Configuration (N=3 Default vs N=5 Deep Mode)', () => {
    const sampleInput: EvaluateInterviewInput = {
      setupData: {
        role: 'Distributed Systems Engineer',
        experienceLevel: 'Senior',
        type: 'System Design',
      },
      questionsList: [
        { id: 'q1', question: 'How would you design a distributed key-value store like Dynamo?' },
      ],
      answersList: [
        'I would use consistent hashing with virtual nodes to distribute keys across the ring. For replication, I would use quorum reads and writes (R + W > N) to guarantee strong consistency, with vector clocks for version reconciliation and gossip protocols for cluster membership and failure detection.',
      ],
    };

    it('executes N=3 passes by default when deepAnalysisMode is false or omitted', async () => {
      const report = await performInterviewEvaluation(sampleInput, 'test-user-1');
      expect(report.suqEvaluation).toBeDefined();
      expect(report.suqEvaluation?.passCount).toBe(3);
      expect(report.suqEvaluation?.passes).toHaveLength(3);
    });

    it('executes N=5 passes when deepAnalysisMode is explicitly enabled', async () => {
      const deepInput: EvaluateInterviewInput = {
        ...sampleInput,
        deepAnalysisMode: true,
      };
      const report = await performInterviewEvaluation(deepInput, 'test-user-2');
      expect(report.suqEvaluation).toBeDefined();
      expect(report.suqEvaluation?.passCount).toBe(5);
      expect(report.suqEvaluation?.passes).toHaveLength(5);
    });
  });

  describe('Fallback Result Transparency', () => {
    it('visibly marks evaluation result as fallback when live provider is not configured or offline', async () => {
      // Running without Anthropic API key
      const input: EvaluateInterviewInput = {
        setupData: { role: 'Frontend Engineer', experienceLevel: 'Mid-Level', type: 'Technical' },
        questionsList: [{ id: 'q1', question: 'Explain CSS specificity.' }],
        answersList: ['Specificity is calculated based on inline styles, IDs, classes, and element selectors.'],
      };

      const report = await performInterviewEvaluation(input, 'test-user-3');
      expect(report.evaluationMode).toBe('fallback');
      expect(report.suqEvaluation?.evaluationMode).toBe('fallback');
      expect(['unconfigured', 'available', 'fallback']).toContain(report.suqEvaluation?.providerStatus);
    });
  });

  describe('Downstream Question Selection Logic', () => {
    it('accurately identifies and selects the weakest/shortest answer for targeted reflexion', async () => {
      const multiQInput: EvaluateInterviewInput = {
        setupData: { role: 'Full Stack Engineer', experienceLevel: 'Senior', type: 'Technical' },
        questionsList: [
          { id: 'q1', question: 'Explain React Server Components.' },
          { id: 'q2', question: 'Explain PostgreSQL indexing and B-Trees.' },
          { id: 'q3', question: 'Explain Docker container isolation.' },
        ],
        answersList: [
          'React Server Components execute strictly on the server and stream serialized UI over the wire without bundling client-side JavaScript.',
          'B-Trees allow logarithmic O(log N) search, insertion, and deletion while keeping disk block access sequential and minimal.',
          'idk', // noticeably deficient answer!
        ],
      };

      const report = await performInterviewEvaluation(multiQInput, 'test-user-4');
      expect(report.selectedQuestionIndex).toBe(2);
      expect(report.selectedQuestionId).toBe('q3');
    });
  });

  describe('Grounding & Anti-Hallucination: Empty Answer Floor', () => {
    it('assigns a bottom score (<= 2.0 / 5) and does not hallucinate high scores for empty answers', async () => {
      const emptyInput: EvaluateInterviewInput = {
        setupData: { role: 'Cloud Architect', experienceLevel: 'Principal', type: 'Architecture' },
        questionsList: [{ id: 'q1', question: 'Design a multi-region disaster recovery strategy.' }],
        answersList: [''], // completely empty answer
      };

      const report = await performInterviewEvaluation(emptyInput, 'test-user-5');
      expect(report.overallScore).toBeLessThanOrEqual(35); // 0-100 scale: <= 35%
      expect(report.suqEvaluation?.finalScore).toBeLessThanOrEqual(2.0); // 1-5 scale: <= 2.0
      expect(report.suqEvaluation?.passes[0].scores.technicalAccuracy).toBeLessThanOrEqual(2.0);
    });
  });

  describe('Semantic Equivalence Clustering Math', () => {
    it('computes entropy accurately across clusters', () => {
      const passes = [
        {
          scores: { technicalAccuracy: 4, systemDesignLogic: 4, edgeCaseHandling: 4, communicationClarity: 4 },
          overallScore: 4.0,
          feedback: '',
        },
        {
          scores: { technicalAccuracy: 4.1, systemDesignLogic: 3.9, edgeCaseHandling: 4, communicationClarity: 4 },
          overallScore: 4.0,
          feedback: '',
        },
        {
          scores: { technicalAccuracy: 2, systemDesignLogic: 2, edgeCaseHandling: 2, communicationClarity: 2 },
          overallScore: 2.0,
          feedback: '',
        },
      ];

      const { clusters, semanticEntropy, confidenceLevel } = computeSemanticEquivalenceAndEntropy(passes as any, 0.5);
      expect(clusters.length).toBe(2); // 4.0 cluster and 2.0 cluster
      expect(semanticEntropy).toBeGreaterThan(0);
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(confidenceLevel);
    });

    it('guards against NaN or -0 when all passes fall into a single cluster (SE = 0.0)', () => {
      const identicalPasses = [
        {
          scores: { technicalAccuracy: 4, systemDesignLogic: 4, edgeCaseHandling: 4, communicationClarity: 4 },
          overallScore: 4.0,
          feedback: '',
        },
        {
          scores: { technicalAccuracy: 4, systemDesignLogic: 4, edgeCaseHandling: 4, communicationClarity: 4 },
          overallScore: 4.0,
          feedback: '',
        },
        {
          scores: { technicalAccuracy: 4, systemDesignLogic: 4, edgeCaseHandling: 4, communicationClarity: 4 },
          overallScore: 4.0,
          feedback: '',
        },
      ];

      const { clusters, semanticEntropy, confidenceLevel } = computeSemanticEquivalenceAndEntropy(identicalPasses as any, 0.5);
      expect(clusters.length).toBe(1);
      expect(semanticEntropy).toBe(0);
      expect(Object.is(semanticEntropy, -0)).toBe(false);
      expect(confidenceLevel).toBe('HIGH');
    });
  });

  describe('SimPO Length-Normalized Contrastive Evaluation', () => {
    it('enforces empty answer floor: <= 2.0/5.0, score <= 35%, q <= 0.35, r <= 0.1, marginSatisfied: true, and valid Zod delta card', async () => {
      const result = await generateSimPOContrastiveEvaluation({
        question: 'Explain distributed locks.',
        candidateAnswer: '   ',
        role: 'Distributed Systems Engineer',
        score: 10,
      });

      expect(result.contrastivePair.dispreferredAnswer.implicitReward).toBeLessThanOrEqual(0.1);
      expect(result.contrastivePair.dispreferredAnswer.qualityScore).toBeLessThanOrEqual(0.35);
      expect(result.contrastivePair.preferredAnswer.qualityScore).toBe(0.85);
      expect(result.contrastivePair.qualityMargin).toBeGreaterThanOrEqual(0.50);
      expect(result.contrastivePair.marginSatisfied).toBe(true);

      expect(result.benchmarkDeltaCard).toBeDefined();
      const parsedCard = benchmarkDeltaCardSchema.safeParse(result.benchmarkDeltaCard);
      expect(parsedCard.success).toBe(true);
      expect(parsedCard.data?.architecturalGap.length).toBeGreaterThan(0);
      expect(parsedCard.data?.edgeCaseOversights.length).toBeGreaterThan(0);
      expect(typeof parsedCard.data?.faangComparison).toBe('string');
      expect(parsedCard.data?.rewardScore).toBeGreaterThan(0);
    });

    it('evaluates weak candidate: benchmark is meaningfully better by gamma on quality scale (marginSatisfied: true)', async () => {
      const result = await generateSimPOContrastiveEvaluation({
        question: 'Design a scalable rate limiter.',
        candidateAnswer: 'I would store user IDs in MySQL and count requests with a SQL query.',
        role: 'Senior Backend Engineer',
        score: 30,
      });

      const { dispreferredAnswer, preferredAnswer, qualityMargin, rewardMargin, marginSatisfied } =
        result.contrastivePair;

      // Candidate quality score is 0.30, benchmark is 0.85
      expect(dispreferredAnswer.qualityScore).toBeCloseTo(0.30, 2);
      expect(preferredAnswer.qualityScore).toBeCloseTo(0.85, 2);

      // Quality margin = 0.85 - 0.30 = 0.55
      expect(qualityMargin).toBeCloseTo(0.55, 2);
      expect(rewardMargin).toBeCloseTo(0.55, 2);

      // Benchmark is meaningfully better by gamma (0.25) -> marginSatisfied must be true
      expect(marginSatisfied).toBe(true);

      // Exposed length-normalized rewards (SimPO surrogate) exist as separate metrics
      expect(typeof dispreferredAnswer.implicitReward).toBe('number');
      expect(typeof preferredAnswer.implicitReward).toBe('number');
      expect(dispreferredAnswer.tokenLength).toBeGreaterThan(0);
      expect(preferredAnswer.tokenLength).toBeGreaterThan(0);
    });

    it('evaluates strong candidate: candidate >= benchmark yields marginSatisfied: false', async () => {
      const result = await generateSimPOContrastiveEvaluation({
        question: 'Design a distributed consensus mechanism.',
        candidateAnswer:
          'Implement Raft consensus using leader election with randomized election timeouts, log replication with term IDs, persistent write-ahead logging (WAL), quorum ACKs, and commit index advancement for linearizable consistency with O(log N) state transfer.',
        role: 'Staff Infrastructure Engineer',
        score: 90,
      });

      const { dispreferredAnswer, preferredAnswer, qualityMargin, rewardMargin, marginSatisfied } =
        result.contrastivePair;

      // Candidate quality score is 0.90, benchmark is 0.85
      expect(dispreferredAnswer.qualityScore).toBeCloseTo(0.90, 2);
      expect(preferredAnswer.qualityScore).toBeCloseTo(0.85, 2);

      // Quality margin = 0.85 - 0.90 = -0.05 (candidate meets or exceeds benchmark)
      expect(qualityMargin).toBeLessThanOrEqual(0);
      expect(rewardMargin).toBeLessThanOrEqual(0);

      // Crucial requirement: marginSatisfied must be strictly false when candidate >= benchmark
      expect(marginSatisfied).toBe(false);

      // Both answers still expose length-normalized SimPO surrogate rewards
      expect(dispreferredAnswer.implicitReward).toBeGreaterThan(0);
      expect(preferredAnswer.implicitReward).toBeGreaterThan(0);
    });
  });

  describe('Dynamic Model Configuration & Source Transparency', () => {
    const originalEnv = process.env.ANTHROPIC_MODEL;

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.ANTHROPIC_MODEL = originalEnv;
      } else {
        delete process.env.ANTHROPIC_MODEL;
      }
    });

    it('defaults AI_CONFIG.model to claude-sonnet-5-5 when ANTHROPIC_MODEL is unset', () => {
      delete process.env.ANTHROPIC_MODEL;
      expect(AI_CONFIG.model).toBe('claude-sonnet-5-5');
    });

    it('dynamically reads ANTHROPIC_MODEL from environment when set', () => {
      process.env.ANTHROPIC_MODEL = 'claude-3-7-sonnet-latest';
      expect(AI_CONFIG.model).toBe('claude-3-7-sonnet-latest');
    });

    it('scores answers via measurable heuristics, caps fallback at 3.0, and marks source: fallback with confidenceLevel: LOW', async () => {
      const input: EvaluateInterviewInput = {
        setupData: { role: 'Backend Engineer', experienceLevel: 'Senior', type: 'System Design' },
        questionsList: [{ id: 'q1', question: 'How do you handle distributed locks?' }],
        // Answer with length, numbers, and edge-case keywords
        answersList: [
          'We use Redlock with 5 Redis nodes. Lock lease timeout is 3000ms with a retry limit of 3 attempts. When network partitions or split-brain conditions occur, graceful failover and exception handling prevent deadlocks.',
        ],
      };

      const report = await performInterviewEvaluation(input, 'test-heuristics-user');
      expect(report.source).toBe('fallback');
      expect(report.evaluationMode).toBe('fallback');
      expect(report.suqEvaluation?.source).toBe('fallback');
      expect(report.suqEvaluation?.confidenceLevel).toBe('LOW');
      // Must be capped at 3.0 / 5 (60 / 100)
      expect(report.suqEvaluation?.finalScore).toBeLessThanOrEqual(3.0);
      expect(report.overallScore).toBeLessThanOrEqual(60);
      report.suqEvaluation?.passes.forEach((p) => {
        expect(p.overallScore).toBeLessThanOrEqual(3.0);
        expect(p.scores.technicalAccuracy).toBeLessThanOrEqual(3.0);
        expect(p.scores.systemDesignLogic).toBeLessThanOrEqual(3.0);
        expect(p.scores.edgeCaseHandling).toBeLessThanOrEqual(3.0);
        expect(p.scores.communicationClarity).toBeLessThanOrEqual(3.0);
      });
    });

    it('every engine result carries explicit source: live | fallback', async () => {
      // 1. SimPO Engine
      const simpoResult = await generateSimPOContrastiveEvaluation({
        question: 'Explain LRU cache.',
        candidateAnswer: 'I would use a hash map and a doubly linked list with O(1) time complexity.',
        role: 'Software Engineer',
        score: 75,
      });
      expect(['live', 'fallback']).toContain(simpoResult.source);
      expect(simpoResult.source).toBe('fallback'); // Since no live key is active in unit test

      // 2. Reflexion Engine
      const reflexionResult = await generateVerbalSelfReflection({
        sessionId: 'test_session',
        question: 'Explain thread safety.',
        candidateAnswer: 'Use mutex locks and atomics.',
        score: 60,
        role: 'Backend Engineer',
      });
      expect(['live', 'fallback']).toContain(reflexionResult.source);
      expect(reflexionResult.source).toBe('fallback');

      // 3. LATS Engine
      const latsResult = await runLATSMCTS({
        sessionId: 'test_lats_session',
        role: 'Frontend Engineer',
        currentQuestion: 'Explain React rendering cycle.',
        candidateAnswer: 'React diffs virtual DOM trees and applies minimal DOM updates.',
        priorGaps: [],
      });
      expect(['live', 'fallback']).toContain(latsResult.source);
      expect(latsResult.source).toBe('fallback');

      // 4. GraphRAG Engine
      const graphResult = await executeGraphRAGAnalysis({
        jobTitle: 'Full Stack Engineer',
        jobDescription: 'React and Node.js microservices',
        fileName: 'resume.txt',
        resumeText: 'Experienced with React, Node.js, TypeScript, and Redis caching architectures.',
      });
      expect(['live', 'fallback']).toContain(graphResult.source);
      expect(graphResult.source).toBe('fallback');
    });
  });
});
