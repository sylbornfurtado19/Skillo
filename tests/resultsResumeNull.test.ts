/**
 * Focused Unit Tests for Results View Guard Logic
 * Verifies that valid interview results render properly when resumeData is null,
 * and that the hard "Resume Required" blocking screen is no longer shown.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// ── Mocks for Next.js and browser-only dependencies ─────────────────────────
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

// ── Mock Interview Context ──────────────────────────────────────────────────
let mockInterviewState: {
  resumeData: unknown;
  results: any;
  setResults: jest.Mock;
  setQuestions: jest.Mock;
  setCurrentQuestionIndex: jest.Mock;
  setAnswers: jest.Mock;
  resetSession: jest.Mock;
  sessionHistory: any[];
  setIsRetry: jest.Mock;
  setRetryQuestionIndex: jest.Mock;
} = {
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

describe('Results View - Rendering without resumeData', () => {
  const sampleValidResults = {
    overallScore: 88,
    personaId: 'sarah',
    interviewerComments: 'Strong technical articulation and system design fundamentals.',
    categories: {
      technicalAccuracy: 85,
      systemDesignLogic: 82,
      edgeCaseHandling: 80,
      communication: 90,
    },
    setupData: {
      role: 'Staff Infrastructure Engineer',
      company: 'Datadog',
      experienceLevel: 'Senior',
    },
    breakdown: [
      {
        id: 'q_1',
        question: 'Explain raft consensus and leader election dynamics.',
        score: 90,
        feedback: 'Excellent breakdown of term indices and heartbeat timeouts.',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render valid interview results when resumeData is null', () => {
    mockInterviewState = {
      ...mockInterviewState,
      resumeData: null,
      results: sampleValidResults,
    };

    const html = renderToStaticMarkup(React.createElement(Results));

    // Must NOT render the blocking "Resume Required" card
    expect(html).not.toContain('Resume Required');
    expect(html).not.toContain('You must upload your resume and specify job details');

    // Must render the actual interview evaluation results
    expect(html).toContain('88');
    expect(html).toContain('Out of 100');
    expect(html).toContain('Exceptional Fit');
    expect(html).toContain('Staff Infrastructure Engineer');
    expect(html).toContain('Datadog');
    expect(html).toContain('Explain raft consensus and leader election dynamics.');
    expect(html).toContain('Strong technical articulation and system design fundamentals.');
  });

  it('should still return empty output when results is null even if resumeData is null', () => {
    mockInterviewState = {
      ...mockInterviewState,
      resumeData: null,
      results: null,
    };

    const html = renderToStaticMarkup(React.createElement(Results));

    // Results guard: if (!results) return null;
    expect(html).toBe('');
    expect(html).not.toContain('Resume Required');
  });

  it('should also render when resumeData is present without errors', () => {
    mockInterviewState = {
      ...mockInterviewState,
      resumeData: { text: 'Candidate resume text', name: 'resume.pdf' },
      results: sampleValidResults,
    };

    const html = renderToStaticMarkup(React.createElement(Results));

    expect(html).not.toContain('Resume Required');
    expect(html).toContain('Staff Infrastructure Engineer');
    expect(html).toContain('88');
    expect(html).toContain('Datadog');
  });
});
