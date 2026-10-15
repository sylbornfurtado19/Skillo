/**
 * tests/groundingVerifier.test.ts
 *
 * Verification suite for B4: Evidence-grounded feedback guard.
 * Tests quote verification (exact, paraphrased, fabricated), pass-level grounding,
 * multi-pass ungrounded pass exclusion from entropy, and dashboard/UI grounding displays.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SinglePassEvaluation, SUQEvaluationResult, CriterionEvidence } from '../src/types/index';
import {
  normalizeForGrounding,
  levenshteinDistance,
  diceBigramSimilarity,
  verifyQuoteInText,
  verifyPassGrounding,
  verifyMultiPassGrounding,
} from '../src/lib/services/groundingVerifier.server';
import SUQConfidenceDashboard from '../src/components/ui/SUQConfidenceDashboard';

function makeCriterionEvidence(
  partial: Partial<CriterionEvidence>
): CriterionEvidence {
  return {
    technicalAccuracy: partial.technicalAccuracy ?? { claim: '', quote: '' },
    systemDesignLogic: partial.systemDesignLogic ?? { claim: '', quote: '' },
    edgeCaseHandling: partial.edgeCaseHandling ?? { claim: '', quote: '' },
    communicationClarity: partial.communicationClarity ?? { claim: '', quote: '' },
  };
}

function makeSuqResult(partial: Partial<SUQEvaluationResult>): SUQEvaluationResult {
  return {
    finalScore: 4.0,
    confidenceLevel: 'HIGH',
    semanticEntropy: 0.15,
    clusters: [],
    passes: [],
    aggregatedRubricFeedback: {},
    requiresValidationPass: false,
    latencyMs: 1000,
    passCount: partial.passes?.length ?? 1,
    evaluationMode: 'live',
    providerStatus: 'available',
    clusteringMethod: 'score-variance',
    modelId: 'claude-sonnet-5-5',
    source: 'live',
    ...partial,
  };
}

describe('B4: Evidence-Grounded Feedback Guard', () => {
  const sampleCandidateSubmission = `
    In our payment service architecture, we deployed an idempotent queue processing mechanism using Redis locks
    with a 30-second TTL to prevent double charges. When network timeouts occurred between our service and Stripe,
    we implemented exponential backoff with jitter and stored failed events in a dead letter queue for manual reconciliation.
  `;

  describe('1. Normalization and Similarity Primitives', () => {
    it('normalizes text by lowercasing, converting quotes, and stripping extra whitespace', () => {
      const raw = '  “Idempotent   Queue”\n\tProcessing   MECHANISM!  ';
      const normalized = normalizeForGrounding(raw);
      expect(normalized).toBe('"idempotent queue" processing mechanism');
    });

    it('computes exact levenshtein distance correctly', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('', 'hello')).toBe(5);
      expect(levenshteinDistance('same', 'same')).toBe(0);
    });

    it('computes dice bigram coefficient correctly', () => {
      expect(diceBigramSimilarity('payment', 'payment')).toBe(1.0);
      expect(diceBigramSimilarity('payment service', 'payment services')).toBeGreaterThan(0.85);
      expect(diceBigramSimilarity('apple', 'banana')).toBeLessThan(0.2);
    });
  });

  describe('2. Quote Verification (Exact, Paraphrased, Fabricated)', () => {
    it('verifies an EXACT quote with similarity 1.0', () => {
      const exactQuote = 'idempotent queue processing mechanism using Redis locks';
      const result = verifyQuoteInText(exactQuote, sampleCandidateSubmission);

      expect(result.verified).toBe(true);
      expect(result.similarity).toBe(1.0);
      expect(result.matchedSubstring).toBeDefined();
    });

    it('verifies a case/whitespace-insensitive quote with similarity 1.0', () => {
      const caseQuote = 'IDEMPOTENT   QUEUE   PROCESSING MECHANISM';
      const result = verifyQuoteInText(caseQuote, sampleCandidateSubmission);

      expect(result.verified).toBe(true);
      expect(result.similarity).toBe(1.0);
    });

    it('verifies a PARAPHRASED quote with fuzzy match >= 0.85', () => {
      // "exponential backoff with jitter and stored failed events" paraphrased slightly:
      // "exponential backoff with jitter and saving failed events"
      const paraphrasedQuote = 'exponential backoff with jitter and saving failed events';
      const result = verifyQuoteInText(paraphrasedQuote, sampleCandidateSubmission, 0.85);

      expect(result.verified).toBe(true);
      expect(result.similarity).toBeGreaterThanOrEqual(0.85);
      expect(result.matchedSubstring).toBeDefined();
    });

    it('flags and rejects a FABRICATED quote that never appears in the candidate answer', () => {
      const fabricatedQuote = 'we configured a Kubernetes operator in Rust with Raft consensus protocol';
      const result = verifyQuoteInText(fabricatedQuote, sampleCandidateSubmission, 0.85);

      expect(result.verified).toBe(false);
      expect(result.similarity).toBeLessThan(0.5);
    });

    it('safely handles empty or missing inputs', () => {
      expect(verifyQuoteInText('', sampleCandidateSubmission).verified).toBe(false);
      expect(verifyQuoteInText('some quote', '').verified).toBe(false);
      expect(verifyQuoteInText('   ', '   ').verified).toBe(false);
    });
  });

  describe('3. Single-Pass Grounding Verification', () => {
    it('computes groundingScore = 1.0 and isUngrounded = false for fully verified quotes', () => {
      const pass: SinglePassEvaluation = {
        overallScore: 4.5,
        scores: { technicalAccuracy: 4.5, systemDesignLogic: 4.5, edgeCaseHandling: 4.5, communicationClarity: 4.5 },
        criterionEvidence: makeCriterionEvidence({
          technicalAccuracy: {
            claim: 'Implemented Redis locks for idempotency',
            quote: 'Redis locks with a 30-second TTL to prevent double charges',
          },
          edgeCaseHandling: {
            claim: 'Handled Stripe network timeouts with exponential backoff',
            quote: 'implemented exponential backoff with jitter',
          },
        }),
        decisionSummary: 'Strong response with practical idempotency mechanism.',
        feedback: 'Good use of Redis and exponential backoff.',
      };

      const verifiedPass = verifyPassGrounding(pass, sampleCandidateSubmission);

      expect(verifiedPass.groundingScore).toBe(1.0);
      expect(verifiedPass.isUngrounded).toBe(false);

      const ce = verifiedPass.criterionEvidence!;
      const techEv = ce.technicalAccuracy as any;
      expect(techEv.verified).toBe(true);
      expect(techEv.flagged).toBe(false);
    });

    it('flags fabricated quote and marks pass as ungrounded when groundingScore < 0.5', () => {
      const pass: SinglePassEvaluation = {
        overallScore: 4.0,
        scores: { technicalAccuracy: 4, systemDesignLogic: 4, edgeCaseHandling: 4, communicationClarity: 4 },
        criterionEvidence: makeCriterionEvidence({
          technicalAccuracy: {
            claim: 'Claimed to use CockroachDB multi-region transactions',
            quote: 'configured CockroachDB distributed transactions with Raft protocol',
          },
          systemDesignLogic: {
            claim: 'Claimed to build Envoy service mesh filter in C++',
            quote: 'authored custom Envoy C++ WASM filters for dynamic routing',
          },
          edgeCaseHandling: {
            claim: 'Mentioned dead letter queue',
            quote: 'stored failed events in a dead letter queue',
          },
        }),
        decisionSummary: 'Evaluator hallucinated high-scale distributed systems features.',
        feedback: 'Candidate showed advanced C++ and CockroachDB skills.',
      };

      // 1 verified (dead letter queue) out of 3 quotes = 0.33 < 0.5 -> isUngrounded = true
      const verifiedPass = verifyPassGrounding(pass, sampleCandidateSubmission);

      expect(verifiedPass.groundingScore).toBe(0.33);
      expect(verifiedPass.isUngrounded).toBe(true);

      const ce = verifiedPass.criterionEvidence!;
      const techEv = ce.technicalAccuracy as any;
      const designEv = ce.systemDesignLogic as any;
      const edgeEv = ce.edgeCaseHandling as any;

      expect(techEv.verified).toBe(false);
      expect(techEv.flagged).toBe(true);
      expect(designEv.verified).toBe(false);
      expect(designEv.flagged).toBe(true);
      expect(edgeEv.verified).toBe(true);
      expect(edgeEv.flagged).toBe(false);
    });

    it('supports backward-compatible string-format criterion evidence with embedded quotes', () => {
      const pass: SinglePassEvaluation = {
        overallScore: 3.5,
        scores: { technicalAccuracy: 3.5, systemDesignLogic: 3.5, edgeCaseHandling: 3.5, communicationClarity: 3.5 },
        criterionEvidence: makeCriterionEvidence({
          technicalAccuracy: 'Candidate mentioned "dead letter queue for manual reconciliation" effectively.',
          edgeCaseHandling: 'Candidate said "fabricated quantum encryption layer" for edge cases.',
        }),
        decisionSummary: 'Moderate response.',
        feedback: 'Feedback here.',
      };

      const verifiedPass = verifyPassGrounding(pass, sampleCandidateSubmission);
      // 1 verified out of 2 quotes = 0.5 -> not ungrounded (threshold is < 0.5)
      expect(verifiedPass.groundingScore).toBe(0.5);
      expect(verifiedPass.isUngrounded).toBe(false);
    });
  });

  describe('4. Multi-Pass Grounding and Exclusion from Entropy', () => {
    it('excludes ungrounded passes (groundingScore < 0.5) and counts excludedPassesCount', () => {
      const pass1: SinglePassEvaluation = {
        overallScore: 4.5,
        scores: { technicalAccuracy: 4.5, systemDesignLogic: 4.5, edgeCaseHandling: 4.5, communicationClarity: 4.5 },
        criterionEvidence: makeCriterionEvidence({
          technicalAccuracy: {
            claim: 'Redis locks for idempotency',
            quote: 'Redis locks with a 30-second TTL to prevent double charges',
          },
        }),
        feedback: 'Pass 1 feedback',
      };

      const pass2: SinglePassEvaluation = {
        overallScore: 4.2,
        scores: { technicalAccuracy: 4.2, systemDesignLogic: 4.2, edgeCaseHandling: 4.2, communicationClarity: 4.2 },
        criterionEvidence: makeCriterionEvidence({
          edgeCaseHandling: {
            claim: 'Exponential backoff with jitter',
            quote: 'implemented exponential backoff with jitter',
          },
        }),
        feedback: 'Pass 2 feedback',
      };

      // pass 3 is completely fabricated
      const pass3: SinglePassEvaluation = {
        overallScore: 1.5,
        scores: { technicalAccuracy: 1.5, systemDesignLogic: 1.5, edgeCaseHandling: 1.5, communicationClarity: 1.5 },
        criterionEvidence: makeCriterionEvidence({
          technicalAccuracy: {
            claim: 'Candidate talked about quantum computing',
            quote: 'we wired up a D-Wave quantum annealer for transaction routing',
          },
        }),
        feedback: 'Pass 3 hallucinated feedback',
      };

      const result = verifyMultiPassGrounding([pass1, pass2, pass3], sampleCandidateSubmission);

      expect(result.excludedPassesCount).toBe(1);
      expect(result.passesForEntropy.length).toBe(2);
      expect(result.verifiedPasses[2].isUngrounded).toBe(true);
      expect(result.verifiedPasses[0].isUngrounded).toBe(false);
      expect(result.verifiedPasses[1].isUngrounded).toBe(false);
      expect(result.overallGroundingScore).toBe(0.67); // 2 of 3 quotes verified
    });

    it('falls back to verifiedPasses if all passes are ungrounded to prevent empty entropy set', () => {
      const pass: SinglePassEvaluation = {
        overallScore: 2.0,
        scores: { technicalAccuracy: 2, systemDesignLogic: 2, edgeCaseHandling: 2, communicationClarity: 2 },
        criterionEvidence: makeCriterionEvidence({
          technicalAccuracy: {
            claim: 'Fabricated',
            quote: 'completely invented claim not in text',
          },
        }),
        feedback: 'Feedback',
      };

      const result = verifyMultiPassGrounding([pass], sampleCandidateSubmission);

      expect(result.excludedPassesCount).toBe(1);
      expect(result.passesForEntropy.length).toBe(1); // falls back to the array so entropy has >= 1 element
    });
  });

  describe('5. SUQ Confidence Dashboard Rendering', () => {
    it('renders grounding badge and excluded passes badge and alert banner when passes are excluded', () => {
      const mockSuq: SUQEvaluationResult = makeSuqResult({
        semanticEntropy: 0.15,
        confidenceLevel: 'HIGH',
        requiresValidationPass: false,
        latencyMs: 1450,
        groundingScore: 0.67,
        excludedPassesCount: 1,
        source: 'live',
        passes: [
          {
            overallScore: 4.5,
            scores: { technicalAccuracy: 4.5, systemDesignLogic: 4.5, edgeCaseHandling: 4.5, communicationClarity: 4.5 },
            groundingScore: 1.0,
            isUngrounded: false,
            criterionEvidence: makeCriterionEvidence({
              technicalAccuracy: {
                claim: 'Idempotency with Redis',
                quote: 'Redis locks with a 30-second TTL',
                verified: true,
              },
            }),
            feedback: 'Great response',
          },
          {
            overallScore: 2.0,
            scores: { technicalAccuracy: 2, systemDesignLogic: 2, edgeCaseHandling: 2, communicationClarity: 2 },
            groundingScore: 0.0,
            isUngrounded: true,
            criterionEvidence: makeCriterionEvidence({
              technicalAccuracy: {
                claim: 'Fabricated claim',
                quote: 'quantum annealer',
                verified: false,
                flagged: true,
              },
            }),
            feedback: 'Hallucinated pass',
          },
        ],
      });

      const html = renderToStaticMarkup(
        React.createElement(SUQConfidenceDashboard, { suqEvaluation: mockSuq })
      );

      // Verify Grounding badge
      expect(html).toContain('Grounding: 67%');
      expect(html).toContain('data-testid="grounding-score-badge"');

      // Verify Excluded Passes badge and alert banner
      expect(html).toContain('Excluded Passes: 1');
      expect(html).toContain('data-testid="excluded-passes-badge"');
      expect(html).toContain('data-testid="ungrounded-passes-alert"');
      expect(html).toContain('Hallucination Guard: 1 Pass(es) Excluded');
      expect(html).toContain('groundingScore &lt; 0.50');
    });

    it('renders clean state with no excluded passes banner when all passes are grounded', () => {
      const cleanSuq: SUQEvaluationResult = makeSuqResult({
        semanticEntropy: 0.12,
        confidenceLevel: 'HIGH',
        requiresValidationPass: false,
        latencyMs: 1200,
        groundingScore: 1.0,
        excludedPassesCount: 0,
        source: 'live',
        passes: [
          {
            overallScore: 4.5,
            scores: { technicalAccuracy: 4.5, systemDesignLogic: 4.5, edgeCaseHandling: 4.5, communicationClarity: 4.5 },
            groundingScore: 1.0,
            isUngrounded: false,
            feedback: 'Verified feedback',
          },
        ],
      });

      const html = renderToStaticMarkup(
        React.createElement(SUQConfidenceDashboard, { suqEvaluation: cleanSuq })
      );

      expect(html).toContain('Grounding: 100%');
      expect(html).not.toContain('data-testid="excluded-passes-badge"');
      expect(html).not.toContain('data-testid="ungrounded-passes-alert"');
    });
  });

  describe('6. Integration with performInterviewEvaluation', () => {
    it('populates groundingScore and excludedPassesCount in suqEvaluation and breakdown', async () => {
      const { performInterviewEvaluation } = await import('../src/lib/services/interviewEvaluation.server');

      const input = {
        setupData: {
          role: 'Backend Engineer',
          experienceLevel: 'Senior',
          type: 'Technical',
        },
        questionsList: [
          {
            id: 'q1',
            question: 'How do you prevent duplicate charges in distributed payments?',
            idealConcepts: 'Idempotency keys, distributed locks, database uniqueness constraints',
          },
        ],
        answersList: [
          'We used Redis distributed locks with a 30-second TTL and recorded idempotency keys in PostgreSQL.',
        ],
      };

      const result = await performInterviewEvaluation(input as any, 'test-grounding-user');

      expect(result.suqEvaluation).toBeDefined();
      expect(result.suqEvaluation?.groundingScore).toBeDefined();
      expect(typeof result.suqEvaluation?.groundingScore).toBe('number');
      expect(result.suqEvaluation?.groundingScore).toBeGreaterThanOrEqual(0);
      expect(result.suqEvaluation?.groundingScore).toBeLessThanOrEqual(1);

      expect(result.suqEvaluation?.excludedPassesCount).toBeDefined();
      expect(typeof result.suqEvaluation?.excludedPassesCount).toBe('number');

      expect(result.breakdown).toBeDefined();
      expect(result.breakdown[0].groundingScore).toBeDefined();
      expect(typeof result.breakdown[0].groundingScore).toBe('number');
    });
  });
});
