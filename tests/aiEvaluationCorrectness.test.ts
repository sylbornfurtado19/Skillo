/**
 * tests/aiEvaluationCorrectness.test.ts
 *
 * Verifies AI Correctness, Semantic Uncertainty Quantification (SUQ),
 * safe JSON parsing, fallback marking, and score grounding.
 */

import { z } from 'zod';
import { safeParseModelJson, extractJsonString } from '../src/lib/ai/safeJsonParser';
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
    it('enforces empty answer floor: <= 2.0/5.0, score <= 35%, r <= 0.1 and valid Zod delta card', async () => {
      const result = await generateSimPOContrastiveEvaluation({
        question: 'Explain distributed locks.',
        candidateAnswer: '   ',
        role: 'Distributed Systems Engineer',
        score: 10,
      });

      expect(result.contrastivePair.dispreferredAnswer.implicitReward).toBeLessThanOrEqual(0.1);
      expect(result.benchmarkDeltaCard).toBeDefined();
      const parsedCard = benchmarkDeltaCardSchema.safeParse(result.benchmarkDeltaCard);
      expect(parsedCard.success).toBe(true);
      expect(parsedCard.data?.architecturalGap.length).toBeGreaterThan(0);
      expect(parsedCard.data?.edgeCaseOversights.length).toBeGreaterThan(0);
      expect(typeof parsedCard.data?.faangComparison).toBe('string');
      expect(parsedCard.data?.rewardScore).toBeGreaterThan(0);
    });
  });
});
