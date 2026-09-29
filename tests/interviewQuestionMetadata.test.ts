/**
 * Focused Unit Tests for Interview Setup Flow Question Metadata Preservation
 * Verifies that:
 * 1. CareerSetup preserves question metadata (id, hint, duration, targetedWeakness, idealConcepts)
 * 2. InterviewSession uses the real hint and duration from structured questions
 * 3. Backward compatibility with plain string questions is maintained
 * 4. Evaluation receives idealConcepts when provided
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// ── Mocks for Next.js & Subcomponents ───────────────────────────────────────
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/interview',
}));

jest.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
  }),
}));

jest.mock('../src/hooks/useInterviewCamera', () => ({
  useInterviewCamera: () => ({
    cameraStream: null,
    isCameraActive: false,
    cameraError: null,
    startCamera: jest.fn(),
    stopCamera: jest.fn(),
  }),
}));

jest.mock('../src/hooks/useIVPSessionPipeline', () => ({
  useIVPSessionPipeline: () => ({
    videoRef: { current: null },
    liveGazeFrame: null,
    livePoseFrame: null,
    liveAffectFrame: null,
    gazeEyeContactPct: 85,
    showGazeWarning: false,
    latestGestureToast: null,
    isVisionReady: true,
    isONNXReady: true,
    clearPerQuestionFrames: jest.fn(),
    getCapturedTelemetry: () => ({
      capturedGazeFrames: [],
      capturedPoseFrames: [],
      capturedAffectFrames: [],
    }),
  }),
}));

jest.mock('../src/components/interview/SystemDesignCanvas', () => ({
  SystemDesignCanvas: () => null,
}));

jest.mock('../src/components/ui/IVPCameraPreview', () => () => null);
jest.mock('../src/components/ui/IVPSyncTracker', () => () => null);
jest.mock('../src/components/ui/AdaptiveHUDHeader', () => () => null);
jest.mock('../src/components/ui/EyeContactHUD', () => () => null);
jest.mock('../src/components/ui/PostureHUD', () => () => null);
jest.mock('../src/components/ui/AffectiveHUD', () => () => null);
jest.mock('../src/components/ui/LipSyncHUD', () => () => null);

// ── Mock Interview Context ──────────────────────────────────────────────────
let mockInterviewState = {
  resumeData: { text: 'Candidate resume sample' },
  questions: [] as any[],
  setQuestions: jest.fn(),
  currentQuestionIndex: 0,
  setCurrentQuestionIndex: jest.fn(),
  answers: [] as any[],
  setAnswers: jest.fn(),
  setupData: {
    role: 'Staff Systems Engineer',
    persona: 'sarah',
    type: 'Technical',
    experienceLevel: 'Senior',
  },
  setSetupData: jest.fn(),
  results: null,
  setResults: jest.fn(),
  isRetry: false,
  retryQuestionIndex: null,
};

jest.mock('../src/context/InterviewContext', () => ({
  useInterview: () => mockInterviewState,
}));

jest.mock('../src/components/ui/Toast', () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
  isSupabaseConfigured: false,
}));

import InterviewSession from '../src/views/InterviewSession';
import { performInterviewEvaluation } from '../src/lib/services/interviewEvaluation.server';
import { getQuestionsForSetup, submitInterviewAnswers } from '../src/services/constants';
import type { InterviewQuestion } from '../src/types/index';

describe('Interview Setup Flow - Question Metadata Preservation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Preset Question Pool Metadata', () => {
    it('getQuestionsForSetup generates questions with id, duration, and hint metadata', () => {
      const questions = getQuestionsForSetup({
        company: 'Generic',
        domain: 'Computer Science',
        questionCount: 3,
      });

      expect(questions.length).toBe(3);
      questions.forEach((q, idx) => {
        expect(q.id).toBe(`q_${idx + 1}`);
        expect(typeof q.question).toBe('string');
        expect(q.question.length).toBeGreaterThan(0);
        expect(typeof q.duration).toBe('number');
        expect(typeof q.hint).toBe('string');
        expect(q.hint.length).toBeGreaterThan(0);
      });
    });
  });

  describe('2. InterviewSession Structured Question Handling', () => {
    it('uses the real hint and renders hint toggle when hint is provided', () => {
      const structuredQuestion: InterviewQuestion = {
        id: 'q_custom_99',
        question: 'How do you design a partitioned raft group for consensus?',
        duration: 180,
        hint: 'Discuss election timeouts, log compaction, and leader heartbeats.',
        targetedWeakness: 'Distributed Consensus',
        idealConcepts: 'Raft, Paxos, Quorum, Log Replication',
      };

      mockInterviewState = {
        ...mockInterviewState,
        questions: [structuredQuestion],
        currentQuestionIndex: 0,
      };

      const html = renderToStaticMarkup(React.createElement(InterviewSession));

      // Question text must be rendered
      expect(html).toContain('How do you design a partitioned raft group for consensus?');

      // Real hint trigger must be rendered because hint is non-empty
      expect(html).toContain('Show Hint');
    });

    it('omits hint toggle when hint is absent or empty', () => {
      const questionWithoutHint: InterviewQuestion = {
        id: 'q_no_hint',
        question: 'Describe basic binary search algorithm mechanics.',
        duration: 120,
      };

      mockInterviewState = {
        ...mockInterviewState,
        questions: [questionWithoutHint],
        currentQuestionIndex: 0,
      };

      const html = renderToStaticMarkup(React.createElement(InterviewSession));

      expect(html).toContain('Describe basic binary search algorithm mechanics.');
      expect(html).not.toContain('Show Hint');
    });

    it('uses the real duration from structured questions to set the timer', () => {
      const questionWithCustomDuration: InterviewQuestion = {
        id: 'q_custom_duration',
        question: 'Design an end-to-end distributed rate limiter.',
        duration: 240, // 4 minutes
        hint: 'Consider token bucket algorithm and Redis cluster.',
      };

      mockInterviewState = {
        ...mockInterviewState,
        questions: [questionWithCustomDuration],
        currentQuestionIndex: 0,
      };

      const html = renderToStaticMarkup(React.createElement(InterviewSession));

      // 240 seconds must format to 4:00
      expect(html).toContain('4:00');
    });

    it('defaults timer to 2:00 when question is a plain string', () => {
      mockInterviewState = {
        ...mockInterviewState,
        questions: ['What is the event loop in JavaScript?'],
        currentQuestionIndex: 0,
      };

      const html = renderToStaticMarkup(React.createElement(InterviewSession));

      // Default duration is 120s -> 2:00
      expect(html).toContain('2:00');
    });

    it('maintains backward compatibility when questions are plain strings', () => {
      mockInterviewState = {
        ...mockInterviewState,
        questions: ['What is the event loop in JavaScript?'],
        currentQuestionIndex: 0,
      };

      const html = renderToStaticMarkup(React.createElement(InterviewSession));

      expect(html).toContain('What is the event loop in JavaScript?');
      expect(html).not.toContain('Show Hint');
    });
  });

  describe('3. Evaluation receives idealConcepts & Metadata Forwarding', () => {
    it('passes idealConcepts to evaluation breakdown when provided', async () => {
      const evalInput = {
        setupData: {
          role: 'Full Stack Engineer',
          experienceLevel: 'Senior',
          type: 'Technical',
        },
        questionsList: [
          {
            id: 'q_eval_1',
            question: 'What is database indexing and B+ Tree traversal?',
            hint: 'Mention time complexity and balanced trees',
            idealConcepts: 'B+ Tree nodes, disk block I/O, cache locality, clustered index',
          },
        ],
        answersList: [
          'A B+ tree is a self-balancing tree data structure that maintains sorted data with logarithmic search time.',
        ],
      };

      const report = await performInterviewEvaluation(evalInput, 'test-user-123');

      expect(report.breakdown).toBeDefined();
      expect(report.breakdown.length).toBe(1);
      // idealConcepts must equal the provided idealConcepts string
      expect(report.breakdown[0].idealConcepts).toBe(
        'B+ Tree nodes, disk block I/O, cache locality, clustered index'
      );
    });

    it('falls back to hint when idealConcepts is not provided', async () => {
      const evalInput = {
        setupData: {
          role: 'Frontend Engineer',
          experienceLevel: 'Mid-Level',
          type: 'Technical',
        },
        questionsList: [
          {
            id: 'q_eval_2',
            question: 'Explain CSS specificity hierarchy.',
            hint: 'Inline styles > IDs > Classes > Elements',
          },
        ],
        answersList: ['Specificity is calculated based on element selector weights.'],
      };

      const report = await performInterviewEvaluation(evalInput, 'test-user-123');

      expect(report.breakdown[0].idealConcepts).toBe('Inline styles > IDs > Classes > Elements');
    });

    it('falls back to default core concepts when neither idealConcepts nor hint is provided', async () => {
      const evalInput = {
        setupData: {
          role: 'DevOps Engineer',
          experienceLevel: 'Senior',
          type: 'Technical',
        },
        questionsList: [
          {
            id: 'q_eval_3',
            question: 'How do Kubernetes replica sets operate?',
          },
        ],
        answersList: ['They maintain a stable set of replica Pods running at any given time.'],
      };

      const report = await performInterviewEvaluation(evalInput, 'test-user-123');

      expect(report.breakdown[0].idealConcepts).toBe('Core concepts related to the topic.');
    });

    it('submitInterviewAnswers forwards full question metadata to /api/interview/evaluate', async () => {
      const originalFetch = global.fetch;
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'success', data: { overallScore: 85 } }),
      });
      global.fetch = mockFetch;

      try {
        const setup = {
          role: 'Backend Engineer',
          domain: 'Computer Science',
          type: 'Technical',
          experienceLevel: 'Senior',
          company: 'Generic',
        } as any;

        const structuredQuestions = [
          {
            id: 'q_test_101',
            question: 'How do you structure database transactions?',
            duration: 180,
            hint: 'ACID properties and isolation levels',
            idealConcepts: 'Atomicity, 2PC, MVCC, Snapshot Isolation',
            targetedWeakness: 'Transaction Isolation',
          },
        ];

        const answers = [{ answerText: 'Use appropriate isolation levels such as Read Committed or Serializable.' }];

        await submitInterviewAnswers(setup, structuredQuestions, answers);

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url, options] = mockFetch.mock.calls[0];
        expect(url).toBe('/api/interview/evaluate');
        const parsedBody = JSON.parse(options.body);

        expect(parsedBody.questionsList).toHaveLength(1);
        expect(parsedBody.questionsList[0]).toEqual({
          id: 'q_test_101',
          question: 'How do you structure database transactions?',
          duration: 180,
          hint: 'ACID properties and isolation levels',
          idealConcepts: 'Atomicity, 2PC, MVCC, Snapshot Isolation',
          targetedWeakness: 'Transaction Isolation',
        });
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
