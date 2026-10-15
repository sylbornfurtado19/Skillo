/**
 * tests/resultsGroundingDisplay.test.ts
 *
 * Unit tests for Results view grounding displays:
 * 1. Grounding score badge on breakdown question items.
 * 2. Feedback card grounding score display.
 * 3. Highlighted candidate response with <mark> citations from verified grounded evidence.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/results',
}));

jest.mock('next/dynamic', () => () => {
  const DynamicComponent = () => null;
  DynamicComponent.displayName = 'DynamicComponent';
  return DynamicComponent;
});

jest.mock('next/image', () => (props: any) => React.createElement('img', props));

jest.mock('../src/lib/chartSetup', () => ({}));

let mockInterviewState: any = {
  resumeData: null,
  results: null,
  setResults: jest.fn(),
  setQuestions: jest.fn(),
  setCurrentQuestionIndex: jest.fn(),
  setAnswers: jest.fn(),
  resetSession: jest.fn(),
  sessionHistory: [],
  setIsRetry: jest.fn(),
  setRetryQuestionIndex: jest.fn(),
};

jest.mock('../src/context/InterviewContext', () => ({
  useInterview: () => mockInterviewState,
}));

jest.mock('../src/components/ui/Toast', () => ({
  useToast: () => ({
    showToast: jest.fn(),
  }),
}));

import Results from '../src/views/Results';

describe('Results View - Evidence Grounding Surfacing', () => {
  const quoteToFind = 'Redis locks with a 30-second TTL to avoid duplicate transactions';
  const candidateAnswer = `In our payments engine, we implemented ${quoteToFind} during checkout bursts.`;

  const resultsWithGrounding = {
    overallScore: 85,
    personaId: 'sarah',
    interviewerComments: 'Strong answers with evidence-grounded feedback.',
    categories: {
      technicalAccuracy: 85,
      systemDesignLogic: 80,
      edgeCaseHandling: 80,
      communication: 85,
    },
    suqEvaluation: {
      semanticEntropy: 0.15,
      confidenceLevel: 'HIGH',
      requiresValidationPass: false,
      latencyMs: 1200,
      groundingScore: 0.9,
      excludedPassesCount: 0,
      source: 'live',
      passes: [
        {
          overallScore: 4.2,
          scores: { technicalAccuracy: 4.2, systemDesignLogic: 4.2, edgeCaseHandling: 4.2, communicationClarity: 4.2 },
          groundingScore: 1.0,
          isUngrounded: false,
          criterionEvidence: {
            technicalAccuracy: {
              claim: 'Used Redis locks for idempotency',
              quote: quoteToFind,
              verified: true,
            },
          },
          feedback: 'Accurate distributed lock implementation.',
        },
      ],
    },
    breakdown: [
      {
        id: 'q1',
        question: 'How do you handle idempotency?',
        userAnswer: candidateAnswer,
        score: 85,
        feedback: 'Solid structural explanation.',
        idealConcepts: 'Distributed locks, idempotency keys',
        suggestions: ['Quantify peak QPS.'],
        strengths: ['Clear terminology'],
        groundingScore: 0.9,
      },
    ],
  };

  beforeEach(() => {
    mockInterviewState.results = resultsWithGrounding;
  });

  it('renders item grounding badge and feedback card grounding score', () => {
    // Force accordion open by mocking useState
    const origUseState = React.useState;
    const useStateSpy = jest.spyOn(React, 'useState').mockImplementation(((init: any) => {
      // expandedQuestions state defaults to null
      if (init === null) {
        return ['q1', jest.fn()]; // expand question 'q1'
      }
      return origUseState(init);
    }) as any);

    try {
      const html = renderToStaticMarkup(React.createElement(Results));

      // 1. Verify item grounding badge
      expect(html).toContain('data-testid="item-grounding-badge"');
      expect(html).toContain('Grounding: 90%');

      // 2. Verify feedback card grounding score
      expect(html).toContain('data-testid="feedback-card-grounding"');

      // 3. Verify highlighted candidate quote mark
      expect(html).toContain('data-testid="highlighted-candidate-quote"');
      expect(html).toContain(quoteToFind);
    } finally {
      useStateSpy.mockRestore();
    }
  });
});
