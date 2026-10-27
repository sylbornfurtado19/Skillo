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

  it('should render the designed empty state when results is null and session history is empty', () => {
    mockInterviewState = {
      ...mockInterviewState,
      resumeData: null,
      results: null,
      sessionHistory: [],
    };

    const html = renderToStaticMarkup(React.createElement(Results));

    expect(html).toContain('No assessment results yet');
    expect(html).toContain('Start Mock Interview');
    expect(html).toContain('Return to Dashboard');
    expect(html).not.toContain('Resume Required');
  });

  it('should restore and render latest valid historical session report when results is null', () => {
    mockInterviewState = {
      ...mockInterviewState,
      resumeData: null,
      results: null,
      sessionHistory: [
        {
          id: 'session_hist_001',
          role: 'Staff Infrastructure Engineer',
          type: 'Technical',
          difficulty: 'Senior',
          date: '2026-10-25',
          score: 92,
          persona: 'sarah',
          company: 'Datadog',
          categories: { technicalAccuracy: 95, communication: 90 },
          report: {
            overallScore: 92,
            personaId: 'sarah',
            interviewerComments: 'Superb architecture deep-dive on distributed consensus.',
            categories: { technicalAccuracy: 95, communication: 90 },
            setupData: {
              role: 'Staff Infrastructure Engineer',
              company: 'Datadog',
              experienceLevel: 'Senior',
            },
            breakdown: [
              {
                id: 'q_hist_1',
                question: 'Explain raft consensus and leader election dynamics.',
                userAnswer: 'Nodes transition from follower to candidate upon election timeout.',
                score: 95,
                feedback: 'Clear explanation of term leadership.',
              },
            ],
          },
        },
      ],
    };

    const html = renderToStaticMarkup(React.createElement(Results));

    expect(html).not.toContain('No assessment results yet');
    expect(html).toContain('92');
    expect(html).toContain('Staff Infrastructure Engineer');
    expect(html).toContain('Datadog');
    expect(html).toContain('Superb architecture deep-dive on distributed consensus.');
    expect(html).toContain('Explain raft consensus and leader election dynamics.');
  });

  it('should skip malformed or incomplete latest session and restore previous valid report', () => {
    mockInterviewState = {
      ...mockInterviewState,
      resumeData: null,
      results: null,
      sessionHistory: [
        // Malformed / incomplete session at index 0
        {
          id: 'session_corrupt_001',
          role: 'Corrupt Role',
          type: 'Technical',
          difficulty: 'Senior',
          date: '2026-10-26',
          score: NaN,
          persona: 'sarah',
          report: {
            corrupted: true,
          } as any,
        },
        // Valid session at index 1
        {
          id: 'session_valid_002',
          role: 'Principal Systems Architect',
          type: 'Technical',
          difficulty: 'Principal',
          date: '2026-10-24',
          score: 89,
          persona: 'sarah',
          company: 'Cloudflare',
          report: {
            overallScore: 89,
            personaId: 'sarah',
            interviewerComments: 'Strong systems acumen and network architecture analysis.',
            categories: { technicalAccuracy: 88, communication: 90 },
            setupData: {
              role: 'Principal Systems Architect',
              company: 'Cloudflare',
              experienceLevel: 'Principal',
            },
            breakdown: [
              {
                id: 'q_valid_1',
                question: 'Design an Anycast edge CDN architecture.',
                userAnswer: 'BGP Anycast routing directing clients to closest PoP with tier-1 peering.',
                score: 89,
                feedback: 'Good BGP routing overview.',
              },
            ],
          },
        },
      ],
    };

    const html = renderToStaticMarkup(React.createElement(Results));

    expect(html).not.toContain('No assessment results yet');
    expect(html).toContain('89');
    expect(html).toContain('Principal Systems Architect');
    expect(html).toContain('Cloudflare');
    expect(html).toContain('Design an Anycast edge CDN architecture.');
  });

  it('should render empty state gracefully when all historical sessions are malformed', () => {
    mockInterviewState = {
      ...mockInterviewState,
      resumeData: null,
      results: null,
      sessionHistory: [
        { id: 'corrupt_1', report: null, score: NaN } as any,
        { id: 'corrupt_2', report: {} } as any,
      ],
    };

    const html = renderToStaticMarkup(React.createElement(Results));

    expect(html).toContain('No assessment results yet');
    expect(html).toContain('Start Mock Interview');
  });

  it('should handle optional and missing analytics safely without crashing', () => {
    mockInterviewState = {
      ...mockInterviewState,
      resumeData: null,
      results: {
        overallScore: 78,
      },
      sessionHistory: [],
    };

    const html = renderToStaticMarkup(React.createElement(Results));

    expect(html).not.toContain('No assessment results yet');
    expect(html).toContain('78');
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
