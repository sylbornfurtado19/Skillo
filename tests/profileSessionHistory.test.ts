/**
 * Focused Unit Tests for Real Session History in Profile View
 * Verifies that:
 * 1. Hardcoded dummy records (past_1, past_2) are replaced with real sessionHistory from useInterview().
 * 2. When there are no completed sessions, a clean empty state is rendered.
 * 3. Populated sessionHistory renders real historical assessments and computes profile metrics.
 * 4. handleLoadPastReport (loadPastReport) loads the actual stored EvaluationReport rather than synthesized fixture data.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SessionHistoryItem } from '../src/context/InterviewContext';
import type { EvaluationReport } from '../src/types/index';

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/profile',
}));

jest.mock('next/dynamic', () => () => {
  const DynamicComponent = () => null;
  DynamicComponent.displayName = 'DynamicComponent';
  return DynamicComponent;
});

jest.mock('next/image', () => (props: any) => React.createElement('img', props));

jest.mock('../src/lib/chartSetup', () => ({}));

// Mock Auth
let mockAuthState = {
  isAuthenticated: true,
  user: {
    id: 'user_test_profile_123',
    email: 'candidate@example.com',
    user_metadata: {
      name: 'Alex Mercer',
      picture: null,
    },
  },
};

jest.mock('../src/hooks/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

// Mock Interview Context
let mockSessionHistory: SessionHistoryItem[] = [];
const mockSetResults = jest.fn();
const mockSetQuestions = jest.fn();
const mockSetAnswers = jest.fn();
const mockSetSetupData = jest.fn();

jest.mock('../src/context/InterviewContext', () => ({
  useInterview: () => ({
    sessionHistory: mockSessionHistory,
    setResults: mockSetResults,
    setQuestions: mockSetQuestions,
    setAnswers: mockSetAnswers,
    setSetupData: mockSetSetupData,
  }),
}));

// Mock profile service
jest.mock('../src/services/profile', () => ({
  getProfile: jest.fn().mockResolvedValue({
    data: {
      id: 'user_test_profile_123',
      name: 'Alex Mercer',
      title: 'Principal Distributed Systems Engineer',
      location: 'San Francisco, CA',
      experience: '10+ years',
      profileSettings: {
        defaultInterviewer: 'sarah',
        defaultDifficulty: 'senior',
        preferredMode: 'speak',
      },
      skillMemoryStore: {
        nodes: {
          'skill-1': { skillId: 'Distributed Systems' },
          'skill-2': { skillId: 'Raft Consensus' },
        },
      },
    },
  }),
  updateProfile: jest.fn().mockResolvedValue({ data: {} }),
}));

// Mock SkillMemoryGraph
jest.mock('../src/components/ui/SkillMemoryGraph', () => () => null);

import Profile, { loadPastReport } from '../src/views/Profile';

describe('Profile - Real Session History Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Empty Session History State', () => {
    beforeEach(() => {
      mockSessionHistory = [];
    });

    it('renders clean empty state when sessionHistory is empty', () => {
      const html = renderToStaticMarkup(React.createElement(Profile));

      // Must show the clean empty state message
      expect(html).toContain('No completed assessments yet');
      expect(html).toContain('Complete an interview session to see your evaluation history and metrics here.');
      expect(html).toContain('Start Practice Interview');

      // Must NOT render any hardcoded dummy interview records
      expect(html).not.toContain('React 19 Core &amp; Architecture');
      expect(html).not.toContain('React 19 Core & Architecture');
      expect(html).not.toContain('Engineering Collaboration &amp; STAR');
      expect(html).not.toContain('Engineering Collaboration & STAR');
      expect(html).not.toContain('Jun 24, 2026');
      expect(html).not.toContain('Jun 20, 2026');

      // Metric checks for zero sessions
      expect(html).toContain('Sessions: 0 completed');
      expect(html).toContain('N/A');
    });
  });

  describe('Populated Session History State', () => {
    const sampleReport1: EvaluationReport = {
      overallScore: 92,
      personaId: 'sarah',
      categories: {
        technicalAccuracy: 95,
        communication: 90,
        depth: 92,
        timeManagement: 88,
      },
      setupData: {
        role: 'Distributed Systems Architect',
        experienceLevel: 'Senior',
        type: 'Technical',
        persona: 'sarah',
        company: 'Cloudflare',
      },
      breakdown: [
        {
          question: 'How do you prevent split-brain scenarios in quorum consensus?',
          score: 95,
          feedback: 'Comprehensive breakdown of term epochs and majority heartbeats.',
          userAnswer: 'Quorum intersection guarantees only one leader can have a majority vote.',
        },
      ],
      interviewerComments: 'Exceptional depth in distributed protocols.',
    };

    const populatedHistory: SessionHistoryItem[] = [
      {
        id: 'session_real_1',
        role: 'Distributed Systems Architect',
        type: 'Technical',
        difficulty: 'Senior',
        date: '2026-09-15',
        score: 92,
        persona: 'sarah',
        company: 'Cloudflare',
        report: sampleReport1,
      },
      {
        id: 'session_real_2',
        role: 'Frontend Infrastructure Lead',
        type: 'Technical',
        difficulty: 'Staff',
        date: '2026-09-10',
        score: 86,
        persona: 'david',
        company: 'Vercel',
      },
    ];

    beforeEach(() => {
      mockSessionHistory = populatedHistory;
    });

    it('renders real historical assessment items and computed statistics', () => {
      const html = renderToStaticMarkup(React.createElement(Profile));

      // Must render real historical session titles and difficulties
      expect(html).toContain('Distributed Systems Architect (Senior)');
      expect(html).toContain('Frontend Infrastructure Lead (Staff)');

      // Must render real dates and assessors
      expect(html).toContain('2026-09-15');
      expect(html).toContain('2026-09-10');
      expect(html).toContain('Assessor: Sarah Chen');
      expect(html).toContain('Assessor: David Vance');

      // Must render real scores
      expect(html).toContain('92/100');
      expect(html).toContain('86/100');

      // Stats: (92 + 86) / 2 = 89%
      expect(html).toContain('89%');
      expect(html).toContain('Sessions: 2 completed');

      // Must NOT render any hardcoded dummy interview records
      expect(html).not.toContain('React 19 Core &amp; Architecture');
      expect(html).not.toContain('React 19 Core & Architecture');
      expect(html).not.toContain('Engineering Collaboration &amp; STAR');
      expect(html).not.toContain('Engineering Collaboration & STAR');
      expect(html).not.toContain('No completed assessments yet');
    });
  });

  describe('handleLoadPastReport / loadPastReport Logic', () => {
    it('loads the actual stored EvaluationReport and does not synthesize fixture data', () => {
      const storedReport: EvaluationReport = {
        overallScore: 94,
        personaId: 'marcus',
        categories: {
          technicalAccuracy: 96,
          communication: 92,
          depth: 95,
          timeManagement: 90,
        },
        setupData: {
          domain: 'Computer Science',
          role: 'Kernel Engineer',
          experienceLevel: 'Principal',
          type: 'Technical',
          difficulty: 'Principal',
          questionCount: 2,
          focusAreas: ['eBPF', 'Linux Kernel'],
          persona: 'marcus',
          company: 'Red Hat',
          duration: 45,
        },
        breakdown: [
          {
            question: 'Explain how eBPF verifier proves memory safety without runtime panics.',
            score: 96,
            feedback: 'Flawless proof-tree reasoning and bounded loop analysis.',
            userAnswer: 'The verifier analyzes all code paths to guarantee register bounds and termination.',
          },
          {
            question: 'Describe lockless ring buffer data sharing between kernel and userspace.',
            score: 92,
            feedback: 'Accurate memory barrier synchronization explanation.',
            userAnswer: 'Memory mapped ring buffer with smp_store_release and smp_load_acquire pointers.',
          },
        ],
        interviewerComments: 'Outstanding mastery of kernel internals.',
      };

      const historicalSession: SessionHistoryItem = {
        id: 'session_kernel_101',
        role: 'Kernel Engineer',
        type: 'Technical',
        difficulty: 'Principal',
        date: '2026-08-20',
        score: 94,
        persona: 'marcus',
        company: 'Red Hat',
        report: storedReport,
      };

      const setResults = jest.fn();
      const setSetupData = jest.fn();
      const setQuestions = jest.fn();
      const setAnswers = jest.fn();
      const router = { push: jest.fn() };

      loadPastReport(historicalSession, {
        setResults,
        setSetupData,
        setQuestions,
        setAnswers,
        router,
      });

      // 1. Must restore the actual stored EvaluationReport directly
      expect(setResults).toHaveBeenCalledWith(storedReport);

      // 2. Must restore setupData from the report
      expect(setSetupData).toHaveBeenCalledWith(storedReport.setupData);

      // 3. Must restore actual questions from the breakdown
      expect(setQuestions).toHaveBeenCalledWith([
        'Explain how eBPF verifier proves memory safety without runtime panics.',
        'Describe lockless ring buffer data sharing between kernel and userspace.',
      ]);

      // 4. Must restore actual user answers from the breakdown
      expect(setAnswers).toHaveBeenCalledWith([
        { answerText: 'The verifier analyzes all code paths to guarantee register bounds and termination.' },
        { answerText: 'Memory mapped ring buffer with smp_store_release and smp_load_acquire pointers.' },
      ]);

      // 5. Must navigate to results
      expect(router.push).toHaveBeenCalledWith('/results');
    });

    it('safely handles legacy historical sessions without stored report without synthetic question generators', () => {
      const legacySession: SessionHistoryItem = {
        id: 'session_legacy_99',
        role: 'Backend Developer',
        type: 'Technical',
        difficulty: 'Mid-Level',
        date: '2026-07-01',
        score: 82,
        categories: {
          technicalAccuracy: 84,
          communication: 80,
          depth: 82,
          timeManagement: 82,
        },
        persona: 'sarah',
        company: 'Stripe',
      };

      const setResults = jest.fn();
      const setSetupData = jest.fn();
      const setQuestions = jest.fn();
      const setAnswers = jest.fn();
      const router = { push: jest.fn() };

      loadPastReport(legacySession, {
        setResults,
        setSetupData,
        setQuestions,
        setAnswers,
        router,
      });

      // 1. Must pass clean score and categories without fake synthesized questions
      expect(setResults).toHaveBeenCalledWith(
        expect.objectContaining({
          overallScore: 82,
          personaId: 'sarah',
          breakdown: [],
          categories: {
            technicalAccuracy: 84,
            communication: 80,
            depth: 82,
            timeManagement: 82,
          },
        })
      );

      // 2. Empty questions and answers
      expect(setQuestions).toHaveBeenCalledWith([]);
      expect(setAnswers).toHaveBeenCalledWith([]);

      // 3. Navigates to results
      expect(router.push).toHaveBeenCalledWith('/results');
    });
  });
});
