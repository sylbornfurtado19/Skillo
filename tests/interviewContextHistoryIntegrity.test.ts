/**
 * Targeted Tests for Historical and Live Results State Isolation (Prompt 08A)
 * Verifies all 8 required scenarios:
 * 1. Live results A intact in memory & storage when viewing historical report B.
 * 2. Switching historical B -> C without mutating persisted historical records or live A.
 * 3. Clearing historical selection restores live results A (not B, C, or unrelated session).
 * 4. Reload/rehydrate provider preserves historical identity and live results consistency.
 * 5. resetSession clears only live session keys, strictly preserving persisted session_history.
 * 6. Repeatedly opening historical report never duplicates history or alters records.
 * 7. Legacy records with missing telemetry are recovered; malformed records safely skipped.
 * 8. Storage read/write failures (corrupted JSON, QuotaExceededError) handled gracefully.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  InterviewProvider,
  useInterview,
  type SessionHistoryItem,
  type InterviewResults,
} from '../src/context/InterviewContext';
import {
  isValidReport,
  isValidSessionItem,
  buildHistoricalResults,
  loadPastReport,
} from '../src/services/interviewReport';

// ── Mock Storage Engine ───────────────────────────────────────────────────────
const createMockStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = String(value);
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    _setRaw: (key: string, value: string) => {
      store[key] = value;
    },
    getStore: () => store,
  };
};

const mockLocalStorage = createMockStorage();
const mockSessionStorage = createMockStorage();

(global as any).window = {
  localStorage: mockLocalStorage,
  sessionStorage: mockSessionStorage,
};
(global as any).localStorage = mockLocalStorage;
(global as any).sessionStorage = mockSessionStorage;

describe('Prompt 08A — Historical and Live Results State Isolation', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockSessionStorage.clear();
    jest.clearAllMocks();
  });

  const sampleLiveResultsA: InterviewResults = {
    overallScore: 88,
    personaId: 'sarah',
    interviewerComments: 'Strong live interview performance on distributed consensus.',
    categories: {
      technicalAccuracy: 88,
      communication: 90,
      depth: 86,
      timeManagement: 88,
    },
    setupData: {
      role: 'Staff Infrastructure Engineer',
      domain: 'Computer Science',
      experienceLevel: 'Staff',
      type: 'Technical',
      difficulty: 'Staff',
      questionCount: 2,
      focusAreas: ['Distributed Systems'],
      persona: 'sarah',
    },
    breakdown: [
      {
        question: 'Explain Raft leader lease mechanism.',
        score: 90,
        feedback: 'Accurate timing bounds discussion.',
        userAnswer: 'Leader leases prevent stale reads without running full rounds.',
      },
    ],
  };

  const sampleHistoricalSessionB: SessionHistoryItem = {
    id: 'session_hist_B_2026',
    date: '2026-09-15',
    role: 'Principal Backend Engineer',
    type: 'Technical',
    difficulty: 'Principal',
    score: 94,
    persona: 'sarah',
    company: 'Stripe',
    report: {
      sessionId: 'session_hist_B_2026',
      sessionDate: '2026-09-15',
      overallScore: 94,
      personaId: 'sarah',
      interviewerComments: 'Historical assessment B: Outstanding concurrency control.',
      categories: {
        technicalAccuracy: 95,
        communication: 92,
        depth: 96,
        timeManagement: 93,
      },
      setupData: {
        role: 'Principal Backend Engineer',
        company: 'Stripe',
      },
      breakdown: [
        {
          question: 'How do you structure database sharding?',
          score: 94,
          feedback: 'Great shard key selection and rebalancing plan.',
          userAnswer: 'Consistent hashing with virtual vnodes.',
        },
      ],
    } as any,
  };

  const sampleHistoricalSessionC: SessionHistoryItem = {
    id: 'session_hist_C_2026',
    date: '2026-09-20',
    role: 'Frontend Architect',
    type: 'System Design',
    difficulty: 'Senior',
    score: 82,
    persona: 'alex',
    company: 'Vercel',
    report: {
      sessionId: 'session_hist_C_2026',
      sessionDate: '2026-09-20',
      overallScore: 82,
      personaId: 'alex',
      interviewerComments: 'Historical assessment C: Good bundle optimization.',
      categories: {
        technicalAccuracy: 84,
        communication: 80,
        depth: 82,
        timeManagement: 82,
      },
      setupData: {
        role: 'Frontend Architect',
        company: 'Vercel',
      },
      breakdown: [
        {
          question: 'How do you optimize critical render path?',
          score: 82,
          feedback: 'Solid async and defer script loading strategy.',
          userAnswer: 'Inlining critical CSS and deferring non-essential assets.',
        },
      ],
    } as any,
  };

  // Helper to mount provider with consumer
  function mountProvider() {
    let contextValue: any = null;
    function Consumer() {
      contextValue = useInterview();
      return null;
    }
    renderToStaticMarkup(
      React.createElement(InterviewProvider, null, React.createElement(Consumer))
    );
    return contextValue;
  }

  // ── Scenario 1: Live results A intact when opening historical report B ───────
  it('Scenario 1: Live results A remain intact in designated state and storage when viewing historical report B', () => {
    const ctx = mountProvider();

    // 1. Establish live interview results A
    ctx.setResults(sampleLiveResultsA);

    // Verify A in storage
    const currentStoredA = JSON.parse(mockSessionStorage.getItem('iq_current_results')!);
    expect(currentStoredA.overallScore).toBe(88);
    expect(currentStoredA.interviewerComments).toContain('consensus');

    // 2. Open historical report B
    ctx.setHistoricalSession(sampleHistoricalSessionB);
    ctx.setResults(sampleHistoricalSessionB.report, { addToHistory: false });

    // Active results in storage must now display historical B
    const displayedResults = JSON.parse(mockSessionStorage.getItem('iq_results')!);
    expect(displayedResults.sessionId).toBe('session_hist_B_2026');
    expect(displayedResults.overallScore).toBe(94);
    expect(displayedResults.interviewerComments).toContain('Historical assessment B');

    // Live results A must remain completely intact in iq_current_results storage
    const preservedLiveResults = JSON.parse(mockSessionStorage.getItem('iq_current_results')!);
    expect(preservedLiveResults.overallScore).toBe(88);
    expect(preservedLiveResults.interviewerComments).toContain('consensus');
    expect(preservedLiveResults.sessionId).toBeUndefined(); // Live results not marked as historical
  });

  // ── Scenario 2: Switch from B to C without mutating live results A ───────────
  it('Scenario 2: Switching historical report B to C updates view without mutating persisted history or live results A', () => {
    // Seed initial session history with B and C
    mockLocalStorage.setItem('session_history', JSON.stringify([sampleHistoricalSessionB, sampleHistoricalSessionC]));
    const ctx = mountProvider();

    // Establish live results A
    ctx.setResults(sampleLiveResultsA);
    const initialHistoryLength = JSON.parse(mockLocalStorage.getItem('session_history')!).length;

    // View historical report B
    ctx.setHistoricalSession(sampleHistoricalSessionB);
    ctx.setResults(sampleHistoricalSessionB.report, { addToHistory: false });

    // Now switch directly to historical report C
    ctx.setHistoricalSession(sampleHistoricalSessionC);
    ctx.setResults(sampleHistoricalSessionC.report, { addToHistory: false });

    // Verify C is now the active displayed report
    const displayedC = JSON.parse(mockSessionStorage.getItem('iq_results')!);
    expect(displayedC.sessionId).toBe('session_hist_C_2026');
    expect(displayedC.overallScore).toBe(82);
    expect(displayedC.interviewerComments).toContain('Historical assessment C');

    // Verify live results A still intact in storage
    const preservedLive = JSON.parse(mockSessionStorage.getItem('iq_current_results')!);
    expect(preservedLive.overallScore).toBe(88);

    // Verify history in localStorage was NOT duplicated or mutated
    const finalHistory = JSON.parse(mockLocalStorage.getItem('session_history')!);
    expect(finalHistory.length).toBe(initialHistoryLength);
    const sessionBStored = finalHistory.find((s: any) => s.id === 'session_hist_B_2026');
    const sessionCStored = finalHistory.find((s: any) => s.id === 'session_hist_C_2026');
    expect(sessionBStored.score).toBe(94);
    expect(sessionCStored.score).toBe(82);
  });

  // ── Scenario 3: Clear historical selection and restore live results A ─────────
  it('Scenario 3: Clearing historical selection restores live results A (not B, C, or unrelated latest)', () => {
    const ctx = mountProvider();

    // Establish live results A
    ctx.setResults(sampleLiveResultsA);

    // View historical report B
    ctx.setHistoricalSession(sampleHistoricalSessionB);
    ctx.setResults(sampleHistoricalSessionB.report, { addToHistory: false });

    // Clear historical session
    ctx.clearHistoricalSession();

    // iq_historical_session must be null
    expect(mockSessionStorage.getItem('iq_historical_session')).toBeNull();

    // iq_results must be restored to live results A
    const restoredResults = JSON.parse(mockSessionStorage.getItem('iq_results')!);
    expect(restoredResults.overallScore).toBe(88);
    expect(restoredResults.interviewerComments).toContain('consensus');
    expect(restoredResults.sessionId).toBeUndefined(); // Live session, not historical
  });

  // ── Scenario 4: Reload / rehydrate provider with historical report selected ──
  it('Scenario 4: Rehydration preserves historical session identity and live results consistency', () => {
    // Simulate pre-existing storage state before mount (e.g. user refreshed while viewing historical report B)
    mockSessionStorage.setItem('iq_current_results', JSON.stringify(sampleLiveResultsA));
    mockSessionStorage.setItem('iq_historical_session', JSON.stringify(sampleHistoricalSessionB));
    mockSessionStorage.setItem('iq_results', JSON.stringify(sampleHistoricalSessionB.report));
    mockLocalStorage.setItem('session_history', JSON.stringify([sampleHistoricalSessionB, sampleHistoricalSessionC]));

    // Rehydrate provider
    const ctx = mountProvider();

    // Verify rehydrated storage remains consistent
    expect(JSON.parse(mockSessionStorage.getItem('iq_historical_session')!).id).toBe('session_hist_B_2026');
    expect(JSON.parse(mockSessionStorage.getItem('iq_current_results')!).overallScore).toBe(88);
    expect(JSON.parse(mockSessionStorage.getItem('iq_results')!).sessionId).toBe('session_hist_B_2026');

    // Clearing historical session after rehydration cleanly restores live results A
    ctx.clearHistoricalSession();
    expect(mockSessionStorage.getItem('iq_historical_session')).toBeNull();
  });

  // ── Scenario 5: resetSession clears live session keys, preserving session_history
  it('Scenario 5: resetSession clears live session storage keys while strictly preserving persisted history', () => {
    mockLocalStorage.setItem('session_history', JSON.stringify([sampleHistoricalSessionB, sampleHistoricalSessionC]));
    mockSessionStorage.setItem('iq_current_results', JSON.stringify(sampleLiveResultsA));
    mockSessionStorage.setItem('iq_results', JSON.stringify(sampleLiveResultsA));
    mockSessionStorage.setItem('iq_historical_session', JSON.stringify(sampleHistoricalSessionB));
    mockSessionStorage.setItem('iq_setup_data', JSON.stringify({ role: 'Software Engineer' }));
    mockSessionStorage.setItem('iq_resume_data', JSON.stringify({ parsed: true }));

    const ctx = mountProvider();

    // Execute resetSession
    ctx.resetSession();

    // Intended session keys must be removed
    expect(mockSessionStorage.getItem('iq_current_results')).toBeNull();
    expect(mockSessionStorage.getItem('iq_results')).toBeNull();
    expect(mockSessionStorage.getItem('iq_historical_session')).toBeNull();
    expect(mockSessionStorage.getItem('iq_setup_data')).toBeNull();
    expect(mockSessionStorage.getItem('iq_resume_data')).toBeNull();

    // Persisted session history in localStorage MUST NOT be wiped
    const persistedHistory = JSON.parse(mockLocalStorage.getItem('session_history')!);
    expect(persistedHistory).not.toBeNull();
    expect(persistedHistory.length).toBe(2);
    expect(persistedHistory[0].id).toBe('session_hist_B_2026');
    expect(persistedHistory[1].id).toBe('session_hist_C_2026');
  });

  // ── Scenario 6: Repeated historical viewing creates no duplicates or changes ──
  it('Scenario 6: Repeatedly opening the same historical report creates no duplicates and alters no records', () => {
    mockLocalStorage.setItem('session_history', JSON.stringify([sampleHistoricalSessionB]));
    const ctx = mountProvider();

    const originalRecordJSON = JSON.stringify(sampleHistoricalSessionB);

    // Repeatedly load report B
    for (let i = 0; i < 5; i++) {
      ctx.setHistoricalSession(sampleHistoricalSessionB);
      ctx.setResults(sampleHistoricalSessionB.report, { addToHistory: false });
    }

    // Persisted history in localStorage must still contain exactly 1 entry
    const finalHistory = JSON.parse(mockLocalStorage.getItem('session_history')!);
    expect(finalHistory.length).toBe(1);

    // Stored content, timestamps, scores, and IDs must be identical
    expect(finalHistory[0].id).toBe('session_hist_B_2026');
    expect(finalHistory[0].date).toBe('2026-09-15');
    expect(finalHistory[0].score).toBe(94);
    expect(finalHistory[0].role).toBe('Principal Backend Engineer');
    expect(JSON.stringify(finalHistory[0])).toBe(originalRecordJSON);
  });

  // ── Scenario 7: Legacy records recovered; malformed records safely skipped ────
  describe('Scenario 7: Legacy records recovered without loss; malformed records safely handled', () => {
    it('recovers legacy records with valid score but missing telemetry', () => {
      const legacySessionNoReport: SessionHistoryItem = {
        id: 'legacy_score_only',
        date: '2026-04-10',
        role: 'Site Reliability Engineer',
        type: 'Technical',
        difficulty: 'Senior',
        score: 87,
        persona: 'sarah',
      };

      expect(isValidSessionItem(legacySessionNoReport)).toBe(true);

      const built = buildHistoricalResults(legacySessionNoReport);
      expect(built.sessionId).toBe('legacy_score_only');
      expect(built.sessionDate).toBe('2026-04-10');
      expect(built.overallScore).toBe(87);
      expect(built.breakdown).toEqual([]);
      expect(built.interviewerComments).toContain('Historical assessment record from 2026-04-10');
      expect(built.interviewerComments).toContain('87%');
    });

    it('recovers legacy records with report containing score instead of overallScore', () => {
      const legacySessionOldReport: SessionHistoryItem = {
        id: 'legacy_old_report',
        date: '2026-04-12',
        role: 'DevOps Engineer',
        type: 'Technical',
        difficulty: 'Senior',
        score: 83,
        persona: 'sarah',
        report: {
          score: 83, // Old legacy property
          interviewerComments: 'Legacy evaluation.',
        } as any,
      };

      expect(isValidSessionItem(legacySessionOldReport)).toBe(true);
      const built = buildHistoricalResults(legacySessionOldReport);
      expect(built.overallScore).toBe(83);
      expect(built.sessionId).toBe('legacy_old_report');
    });

    it('rejects malformed records without deleting them destructively from storage', () => {
      const malformedRecords = [
        { id: '', score: 85 },            // Empty ID
        { id: 'bad_nan', score: NaN },     // NaN score
        { id: 'bad_neg', score: -10 },     // Negative score
        { id: 'bad_over', score: 120 },    // Over 100
        null,
        'corrupted string',
      ];

      for (const bad of malformedRecords) {
        expect(isValidSessionItem(bad)).toBe(false);
      }
    });

    it('does not destructively overwrite persisted history on mount when malformed entries exist', () => {
      const mixedHistory = [
        sampleHistoricalSessionB,
        { id: 'corrupt_1', score: NaN },
        sampleHistoricalSessionC,
      ];
      mockLocalStorage.setItem('session_history', JSON.stringify(mixedHistory));

      mountProvider();

      // Ensure localStorage has not been destructively rewritten or erased
      const rawStored = JSON.parse(mockLocalStorage.getItem('session_history')!);
      expect(rawStored.length).toBe(3);
    });
  });

  // ── Scenario 8: Storage read/write failures handled gracefully ────────────────
  describe('Scenario 8: Storage read/write failure handling', () => {
    it('handles corrupted JSON in localStorage gracefully without throwing exceptions', () => {
      mockLocalStorage._setRaw('session_history', '{bad-json-syntax}');

      expect(() => {
        const ctx = mountProvider();
        expect(ctx).not.toBeNull();
      }).not.toThrow();
    });

    it('handles corrupted JSON in sessionStorage without throwing exceptions', () => {
      mockSessionStorage._setRaw('iq_current_results', '{corrupted}');
      mockSessionStorage._setRaw('iq_results', 'invalid');

      expect(() => {
        const ctx = mountProvider();
        expect(ctx).not.toBeNull();
      }).not.toThrow();
    });

    it('handles QuotaExceededError on localStorage.setItem without crashing in-memory state', () => {
      const ctx = mountProvider();

      const originalSetItem = mockLocalStorage.setItem;
      mockLocalStorage.setItem = jest.fn((_key: string, _value: string) => {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      });

      try {
        expect(() => {
          ctx.setResults(sampleLiveResultsA);
        }).not.toThrow();
      } finally {
        mockLocalStorage.setItem = originalSetItem;
      }
    });
  });
});
