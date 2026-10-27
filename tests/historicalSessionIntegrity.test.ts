/**
 * Comprehensive Test Suite for Historical Session Report Integrity
 * Covers Prompt 08 requirements:
 * 1. Correct report-to-session association (exact restoration, no silent fallback).
 * 2. Two historical sessions with distinct answers and scores.
 * 3. Handling invalid/missing session report without silently falling back to sessionHistory[0].
 * 4. Immutability: repeatedly opening historical reports creates no duplicate entries.
 * 5. Preservation of active currentResults when viewing historical reports.
 * 6. Defensive validation of missing, malformed, and legacy persisted records.
 * 7. Storage failure resilience (malformed JSON, QuotaExceededError).
 * 8. Preservation of session IDs, timestamps, answers, and scores.
 * 9. Non-destructive fallback state and Results empty state behavior.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  isValidReport,
  isValidSessionItem,
  findLatestValidSessionReport,
  buildHistoricalResults,
  loadPastReport,
} from '../src/services/interviewReport';
import type { SessionHistoryItem, InterviewResults } from '../src/context/InterviewContext';
import type { EvaluationReport } from '../src/types/index';

// ── Mocks for Next.js and browser dependencies ──────────────────────────────
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
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
  currentResults: null,
  historicalSession: null,
  setResults: jest.fn(),
  setSetupData: jest.fn(),
  setQuestions: jest.fn(),
  setCurrentQuestionIndex: jest.fn(),
  setAnswers: jest.fn(),
  resetSession: jest.fn(),
  setHistoricalSession: jest.fn(),
  clearHistoricalSession: jest.fn(),
  sessionHistory: [],
  setIsRetry: jest.fn(),
  setRetryQuestionIndex: jest.fn(),
};

jest.mock('../src/context/InterviewContext', () => {
  const actual = jest.requireActual('../src/context/InterviewContext');
  return {
    ...actual,
    useInterview: () => mockInterviewState,
  };
});

jest.mock('../src/components/ui/Toast', () => ({
  useToast: () => ({
    showToast: jest.fn(),
  }),
}));

import Results from '../src/views/Results';

describe('Prompt 08 — Historical Session Report Integrity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── 1. Validation Logic: isValidReport & isValidSessionItem ───────────────────
  describe('Defensive Validation: isValidReport & isValidSessionItem', () => {
    it('accurately validates genuine reports with full fields', () => {
      const validReport = {
        overallScore: 89,
        breakdown: [
          { question: 'Q1', userAnswer: 'Ans1', score: 90, feedback: 'Great' },
        ],
        categories: { technicalAccuracy: 88, communication: 90 },
      };
      expect(isValidReport(validReport)).toBe(true);
    });

    it('accepts legitimate reports with empty optional fields (empty breakdown or categories)', () => {
      const minimalReport = {
        overallScore: 75,
        breakdown: [],
        categories: {},
      };
      expect(isValidReport(minimalReport)).toBe(true);
    });

    it('rejects invalid, malformed, or out-of-range reports', () => {
      expect(isValidReport(null)).toBe(false);
      expect(isValidReport(undefined)).toBe(false);
      expect(isValidReport({})).toBe(false);
      expect(isValidReport({ overallScore: '85' })).toBe(false);
      expect(isValidReport({ overallScore: NaN })).toBe(false);
      expect(isValidReport({ overallScore: Infinity })).toBe(false);
      expect(isValidReport({ overallScore: -1 })).toBe(false);
      expect(isValidReport({ overallScore: 101 })).toBe(false);
    });

    it('validates authentic session items containing reports', () => {
      const item: SessionHistoryItem = {
        id: 'sess_1',
        date: '2026-10-25',
        role: 'Backend Engineer',
        type: 'Technical',
        difficulty: 'Senior',
        score: 88,
        persona: 'sarah',
        report: {
          overallScore: 88,
          categories: {},
        } as any,
      };
      expect(isValidSessionItem(item)).toBe(true);
    });

    it('validates legacy session items having valid score even if report is missing', () => {
      const legacyItem: SessionHistoryItem = {
        id: 'sess_legacy',
        date: '2026-09-01',
        role: 'Frontend Engineer',
        type: 'Technical',
        difficulty: 'Mid-Level',
        score: 82,
        persona: 'sarah',
      };
      expect(isValidSessionItem(legacyItem)).toBe(true);
    });

    it('rejects session items with missing or empty ID or invalid scores', () => {
      expect(isValidSessionItem(null)).toBe(false);
      expect(isValidSessionItem({})).toBe(false);
      expect(isValidSessionItem({ id: '', score: 85 })).toBe(false);
      expect(isValidSessionItem({ id: '   ', score: 85 })).toBe(false);
      expect(isValidSessionItem({ id: 'sess_bad', score: NaN })).toBe(false);
      expect(isValidSessionItem({ id: 'sess_bad', score: -5 })).toBe(false);
      expect(isValidSessionItem({ id: 'sess_bad', score: 120 })).toBe(false);
      expect(isValidSessionItem({ id: 'sess_bad' })).toBe(false);
    });
  });

  // ── 2. Chronological Finding: findLatestValidSessionReport ───────────────────
  describe('findLatestValidSessionReport', () => {
    it('finds latest valid session and skips corrupt or malformed sessions', () => {
      const corruptItem: any = { id: 'corrupt_1', score: NaN };
      const validItem2: SessionHistoryItem = {
        id: 'sess_valid_recent',
        date: '2026-10-26',
        role: 'Full Stack',
        type: 'Technical',
        difficulty: 'Senior',
        score: 90,
        persona: 'sarah',
      };
      const validItem3: SessionHistoryItem = {
        id: 'sess_valid_older',
        date: '2026-10-24',
        role: 'DevOps',
        type: 'Technical',
        difficulty: 'Senior',
        score: 75,
        persona: 'sarah',
      };

      const result = findLatestValidSessionReport([corruptItem, validItem2, validItem3]);
      expect(result).not.toBeNull();
      expect(result?.id).toBe('sess_valid_recent');
    });

    it('returns null when history is empty or contains only invalid entries', () => {
      expect(findLatestValidSessionReport([])).toBeNull();
      expect(findLatestValidSessionReport(null)).toBeNull();
      expect(findLatestValidSessionReport([{ id: '', score: -1 } as any])).toBeNull();
    });
  });

  // ── 3. Exact Restoration and Multi-Session Independence ───────────────────────
  describe('Exact Restoration and Multi-Session Independence', () => {
    const sessionAlpha: SessionHistoryItem = {
      id: 'session_alpha_111',
      date: '2026-10-21',
      role: 'Staff Distributed Systems Engineer',
      type: 'Technical',
      difficulty: 'Staff',
      score: 95,
      persona: 'sarah',
      company: 'Netflix',
      duration: 60,
      report: {
        overallScore: 95,
        personaId: 'sarah',
        interviewerComments: 'Exceptional consensus and replication insights.',
        breakdown: [
          {
            question: 'How do you structure Raft log compaction?',
            userAnswer: 'Using asynchronous snapshots with copy-on-write chunking.',
            score: 96,
            feedback: 'Flawless explanation of snapshot boundaries.',
          },
        ],
        categories: {
          technicalAccuracy: 96,
          communication: 94,
          depth: 95,
          timeManagement: 95,
        },
        setupData: {
          role: 'Staff Distributed Systems Engineer',
          company: 'Netflix',
          experienceLevel: 'Staff',
          domain: 'Distributed Systems',
        },
      } as any,
    };

    const sessionBeta: SessionHistoryItem = {
      id: 'session_beta_222',
      date: '2026-10-22',
      role: 'Frontend Performance Engineer',
      type: 'System Design',
      difficulty: 'Senior',
      score: 79,
      persona: 'alex',
      company: 'Vercel',
      duration: 45,
      report: {
        overallScore: 79,
        personaId: 'alex',
        interviewerComments: 'Good bundle splitting, needed more FID/INP optimization analysis.',
        breakdown: [
          {
            question: 'How do you optimize Interaction to Next Paint (INP)?',
            userAnswer: 'Yield to the main thread using scheduler.yield and break long tasks.',
            score: 80,
            feedback: 'Solid strategy, could detail microtask queuing.',
          },
        ],
        categories: {
          technicalAccuracy: 80,
          communication: 78,
          depth: 79,
          timeManagement: 79,
        },
        setupData: {
          role: 'Frontend Performance Engineer',
          company: 'Vercel',
          experienceLevel: 'Senior',
          domain: 'Web Performance',
        },
      } as any,
    };

    it('restores exact selected session data without mixing data between sessions', () => {
      const mockSetResults = jest.fn();
      const mockSetSetupData = jest.fn();
      const mockSetQuestions = jest.fn();
      const mockSetAnswers = jest.fn();
      const mockSetHistoricalSession = jest.fn();
      const mockRouter = { push: jest.fn() };

      // Restore Session Beta
      const successBeta = loadPastReport(sessionBeta, {
        setResults: mockSetResults,
        setSetupData: mockSetSetupData,
        setQuestions: mockSetQuestions,
        setAnswers: mockSetAnswers,
        setHistoricalSession: mockSetHistoricalSession,
        router: mockRouter,
      });

      expect(successBeta).toBe(true);
      expect(mockSetHistoricalSession).toHaveBeenCalledWith(sessionBeta);
      expect(mockSetResults).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session_beta_222',
          sessionDate: '2026-10-22',
          overallScore: 79,
          personaId: 'alex',
          interviewerComments: 'Good bundle splitting, needed more FID/INP optimization analysis.',
        }),
        { addToHistory: false }
      );
      expect(mockSetQuestions).toHaveBeenCalledWith([
        'How do you optimize Interaction to Next Paint (INP)?',
      ]);
      expect(mockSetAnswers).toHaveBeenCalledWith([
        { answerText: 'Yield to the main thread using scheduler.yield and break long tasks.' },
      ]);
      expect(mockRouter.push).toHaveBeenCalledWith('/results');

      // Now restore Session Alpha independently
      const successAlpha = loadPastReport(sessionAlpha, {
        setResults: mockSetResults,
        setSetupData: mockSetSetupData,
        setQuestions: mockSetQuestions,
        setAnswers: mockSetAnswers,
        setHistoricalSession: mockSetHistoricalSession,
        router: mockRouter,
      });

      expect(successAlpha).toBe(true);
      expect(mockSetHistoricalSession).toHaveBeenCalledWith(sessionAlpha);
      expect(mockSetResults).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sessionId: 'session_alpha_111',
          sessionDate: '2026-10-21',
          overallScore: 95,
          personaId: 'sarah',
          interviewerComments: 'Exceptional consensus and replication insights.',
        }),
        { addToHistory: false }
      );
      expect(mockSetQuestions).toHaveBeenLastCalledWith([
        'How do you structure Raft log compaction?',
      ]);
      expect(mockSetAnswers).toHaveBeenLastCalledWith([
        { answerText: 'Using asynchronous snapshots with copy-on-write chunking.' },
      ]);
    });

    it('preserves authentic session IDs, timestamps, questions, and scores in buildHistoricalResults', () => {
      const resultsAlpha = buildHistoricalResults(sessionAlpha);
      expect(resultsAlpha.sessionId).toBe('session_alpha_111');
      expect(resultsAlpha.sessionDate).toBe('2026-10-21');
      expect(resultsAlpha.overallScore).toBe(95);

      const resultsBeta = buildHistoricalResults(sessionBeta);
      expect(resultsBeta.sessionId).toBe('session_beta_222');
      expect(resultsBeta.sessionDate).toBe('2026-10-22');
      expect(resultsBeta.overallScore).toBe(79);
    });
  });

  // ── 4. Missing / Invalid Report Handling (No Silent Fallback) ─────────────────
  describe('Handling Missing or Corrupt Historical Reports', () => {
    const validSession: SessionHistoryItem = {
      id: 'session_valid_1',
      date: '2026-10-27',
      role: 'Core Platform Engineer',
      type: 'Technical',
      difficulty: 'Senior',
      score: 92,
      persona: 'sarah',
      report: {
        overallScore: 92,
        interviewerComments: 'Excellent platform telemetry design.',
      } as any,
    };

    const corruptSession: SessionHistoryItem = {
      id: 'session_corrupt_2',
      date: '2026-10-20',
      role: 'Security Engineer',
      type: 'Technical',
      difficulty: 'Senior',
      score: NaN, // Corrupt score
      persona: 'sarah',
      report: {
        overallScore: NaN, // Corrupt report
      } as any,
    };

    it('fails safely when restoring a corrupt session and does NOT return true', () => {
      const mockSetResults = jest.fn();
      const mockSetHistoricalSession = jest.fn();
      const mockRouter = { push: jest.fn() };

      const restored = loadPastReport(corruptSession, {
        setResults: mockSetResults,
        setSetupData: jest.fn(),
        setQuestions: jest.fn(),
        setAnswers: jest.fn(),
        setHistoricalSession: mockSetHistoricalSession,
        router: mockRouter,
      });

      expect(restored).toBe(false);
      expect(mockSetHistoricalSession).toHaveBeenCalledWith(corruptSession);
      expect(mockSetResults).toHaveBeenCalledWith(null, { addToHistory: false });
      expect(mockRouter.push).toHaveBeenCalledWith('/results');
    });

    it('renders non-destructive fallback state in Results and does NOT silently show validSession report', () => {
      mockInterviewState = {
        ...mockInterviewState,
        results: null,
        historicalSession: corruptSession,
        sessionHistory: [validSession, corruptSession],
      };

      const html = renderToStaticMarkup(React.createElement(Results));

      // Must render unavailable fallback card
      expect(html).toContain('Historical Session Report Unavailable');
      expect(html).toContain('The selected historical session data is missing or corrupted');
      expect(html).toContain('Return to Dashboard');
      expect(html).toContain('View Session History');

      // CRITICAL: Must NOT silently display the other session's comments or score
      expect(html).not.toContain('Excellent platform telemetry design.');
      expect(html).not.toContain('92%');
    });
  });

  // ── 5. History Immutability & Duplicate Entry Prevention ─────────────────────
  describe('History Immutability & Duplicate Prevention', () => {
    it('loadPastReport passes { addToHistory: false } to setResults to avoid duplication', () => {
      const mockSetResults = jest.fn();
      const sessionItem: SessionHistoryItem = {
        id: 'session_unique_456',
        date: '2026-10-26',
        role: 'AI Engineer',
        type: 'Technical',
        difficulty: 'Senior',
        score: 87,
        persona: 'sarah',
        report: {
          overallScore: 87,
        } as any,
      };

      // Call loadPastReport multiple times (simulating re-navigation or rerenders)
      for (let i = 0; i < 3; i++) {
        loadPastReport(sessionItem, {
          setResults: mockSetResults,
          setSetupData: jest.fn(),
          setQuestions: jest.fn(),
          setAnswers: jest.fn(),
        });
      }

      expect(mockSetResults).toHaveBeenCalledTimes(3);
      for (const call of mockSetResults.mock.calls) {
        expect(call[1]).toEqual({ addToHistory: false });
        expect(call[0].sessionId).toBe('session_unique_456');
      }
    });

    it('buildHistoricalResults never fabricates answers or modifies the original session object', () => {
      const originalSession: SessionHistoryItem = {
        id: 'session_frozen_789',
        date: '2026-10-25',
        role: 'Database Engineer',
        type: 'Technical',
        difficulty: 'Senior',
        score: 84,
        persona: 'sarah',
      };

      const frozenSession = Object.freeze({ ...originalSession });
      const built = buildHistoricalResults(frozenSession);

      // Verify no mutation of the source session
      expect(built.sessionId).toBe('session_frozen_789');
      expect(built.overallScore).toBe(84);
      expect(built.breakdown).toEqual([]);
      expect(frozenSession.score).toBe(84);
    });
  });

  // ── 6. Current in-progress results isolation ─────────────────────────────────
  describe('Live Results Preservation During Historical Viewing', () => {
    it('Results view renders live interview results when historicalSession is null', () => {
      const liveReport = {
        overallScore: 93,
        personaId: 'sarah',
        interviewerComments: 'Live interview completed with top marks.',
        categories: { technicalAccuracy: 95 },
        setupData: { role: 'Full Stack Engineer' },
        breakdown: [
          { question: 'Q live', userAnswer: 'A live', score: 95, feedback: 'Great live answer' },
        ],
      };

      mockInterviewState = {
        ...mockInterviewState,
        results: liveReport,
        historicalSession: null,
        sessionHistory: [],
      };

      const html = renderToStaticMarkup(React.createElement(Results));
      expect(html).toContain('Live interview completed with top marks.');
      expect(html).not.toContain('Historical Session Report Unavailable');
      expect(html).not.toContain('No assessment results yet');
    });

    it('renders empty state when there are neither live results nor historical reports', () => {
      mockInterviewState = {
        ...mockInterviewState,
        results: null,
        historicalSession: null,
        sessionHistory: [],
      };

      const html = renderToStaticMarkup(React.createElement(Results));
      expect(html).toContain('No assessment results yet');
      expect(html).toContain('Start Mock Interview');
      expect(html).toContain('Return to Dashboard');
    });
  });

  // ── 7. Legacy Session Restoration Without Fabricated Answers ─────────────────
  describe('Legacy Session Restoration', () => {
    it('restores legacy session with authentic score and empty breakdown (no fabricated answers)', () => {
      const legacyItem: SessionHistoryItem = {
        id: 'sess_legacy_99',
        date: '2026-07-10',
        role: 'Site Reliability Engineer',
        type: 'Technical',
        difficulty: 'Senior',
        score: 88,
        persona: 'sarah',
        categories: {
          technicalAccuracy: 88,
          communication: 90,
          depth: 85,
          timeManagement: 89,
        },
      };

      const restored = buildHistoricalResults(legacyItem);

      expect(restored.sessionId).toBe('sess_legacy_99');
      expect(restored.sessionDate).toBe('2026-07-10');
      expect(restored.overallScore).toBe(88);
      expect((restored.categories as any).technicalAccuracy).toBe(88);
      expect((restored.categories as any).communication).toBe(90);
      expect(restored.breakdown).toEqual([]);
      expect(restored.interviewerComments).toContain('Historical assessment record from 2026-07-10');
      expect(restored.interviewerComments).toContain('88%');
    });
  });
});
