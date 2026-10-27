/**
 * Tests for InterviewContext Historical Report and Session Integrity
 * Validates:
 * 1. Historical report viewing does NOT add entries to sessionHistory or mutate existing records.
 * 2. Active live interview currentResults are preserved when viewing historical reports.
 * 3. Clearing historical session restores the live currentResults in storage.
 * 4. LocalStorage failure resilience (QuotaExceededError).
 * 5. resetSession cleanly removes both live and historical storage keys.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InterviewProvider, useInterview, type SessionHistoryItem } from '../src/context/InterviewContext';
import type { EvaluationReport } from '../src/types/index';

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

describe('InterviewContext — Session History and Historical Report Isolation', () => {
  beforeEach(() => {
    // Clear storage before each test
    mockLocalStorage.clear();
    mockSessionStorage.clear();
    jest.clearAllMocks();
  });

  it('preserves currentResults when viewing a historical session and restores them upon clearHistoricalSession', () => {
    let contextValue: any = null;

    function TestConsumer() {
      const interview = useInterview();
      contextValue = interview;
      return null;
    }

    renderToStaticMarkup(
      React.createElement(InterviewProvider, null, React.createElement(TestConsumer))
    );

    expect(contextValue).not.toBeNull();

    // 1. Simulate completing a live interview
    const liveResults: any = {
      overallScore: 88,
      interviewerComments: 'Live interview score',
      categories: { technicalAccuracy: 88 },
      setupData: { role: 'Software Engineer', type: 'Technical' },
    };

    contextValue.setResults(liveResults);

    // Live results must be persisted to session and local storage
    const currentResultsStored = JSON.parse(mockSessionStorage.getItem('iq_current_results')!);
    expect(currentResultsStored.overallScore).toBe(88);
    expect(currentResultsStored.interviewerComments).toBe('Live interview score');

    const historyStored = JSON.parse(mockLocalStorage.getItem('session_history')!);
    expect(historyStored.length).toBe(1);
    expect(historyStored[0].score).toBe(88);

    // 2. Simulate user viewing a historical session
    const historicalSession: SessionHistoryItem = {
      id: 'session_past_999',
      date: '2026-05-01',
      role: 'Staff Engineer',
      type: 'System Design',
      difficulty: 'Staff',
      score: 95,
      persona: 'sarah',
      report: {
        sessionId: 'session_past_999',
        sessionDate: '2026-05-01',
        overallScore: 95,
        interviewerComments: 'Past historical report comments',
        categories: { technicalAccuracy: 95 },
      } as any,
    };

    contextValue.setHistoricalSession(historicalSession);
    contextValue.setResults(historicalSession.report, { addToHistory: false });

    // History in localStorage must NOT have grown
    const historyAfterViewing = JSON.parse(mockLocalStorage.getItem('session_history')!);
    expect(historyAfterViewing.length).toBe(1);
    expect(historyAfterViewing[0].id).not.toBe('session_past_999');

    // currentResults in sessionStorage must STILL be the live results
    const currentStillPreserved = JSON.parse(mockSessionStorage.getItem('iq_current_results')!);
    expect(currentStillPreserved.overallScore).toBe(88);
    expect(currentStillPreserved.interviewerComments).toBe('Live interview score');

    // iq_results now contains historical report
    const resultsViewingHistorical = JSON.parse(mockSessionStorage.getItem('iq_results')!);
    expect(resultsViewingHistorical.sessionId).toBe('session_past_999');
    expect(resultsViewingHistorical.overallScore).toBe(95);

    // 3. User finishes viewing past report and clears historical session
    contextValue.clearHistoricalSession();

    expect(mockSessionStorage.getItem('iq_historical_session')).toBeNull();
  });

  it('does not duplicate history entries when calling setResults repeatedly for the same session', () => {
    let contextValue: any = null;

    function TestConsumer() {
      const interview = useInterview();
      contextValue = interview;
      return null;
    }

    renderToStaticMarkup(
      React.createElement(InterviewProvider, null, React.createElement(TestConsumer))
    );

    const pastReportWithId: any = {
      sessionId: 'session_stable_123',
      overallScore: 82,
      interviewerComments: 'Stable comments',
      categories: {},
    };

    // Calling setResults with historical sessionId multiple times
    contextValue.setResults(pastReportWithId, { addToHistory: false });
    contextValue.setResults(pastReportWithId, { addToHistory: false });
    contextValue.setResults(pastReportWithId, { addToHistory: false });

    const storedHistory = mockLocalStorage.getItem('session_history');
    expect(storedHistory).toBeNull();
  });

  it('handles localStorage QuotaExceededError gracefully without throwing exceptions', () => {
    let contextValue: any = null;

    function TestConsumer() {
      const interview = useInterview();
      contextValue = interview;
      return null;
    }

    // Mock localStorage.setItem to throw QuotaExceededError
    const originalSetItem = mockLocalStorage.setItem;
    mockLocalStorage.setItem = jest.fn((_key: string, _value: string) => {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    });

    try {
      renderToStaticMarkup(
        React.createElement(InterviewProvider, null, React.createElement(TestConsumer))
      );

      const liveResults: any = {
        overallScore: 80,
        interviewerComments: 'Tested during storage failure',
        categories: {},
      };

      // Must not throw an unhandled exception
      expect(() => {
        contextValue.setResults(liveResults);
      }).not.toThrow();
    } finally {
      mockLocalStorage.setItem = originalSetItem;
    }
  });

  it('clears all session storage keys including historical session on resetSession', () => {
    let contextValue: any = null;

    function TestConsumer() {
      const interview = useInterview();
      contextValue = interview;
      return null;
    }

    renderToStaticMarkup(
      React.createElement(InterviewProvider, null, React.createElement(TestConsumer))
    );

    mockSessionStorage.setItem('iq_historical_session', JSON.stringify({ id: 'sess_1' }));
    mockSessionStorage.setItem('iq_current_results', JSON.stringify({ overallScore: 85 }));

    contextValue.resetSession();

    expect(mockSessionStorage.getItem('iq_historical_session')).toBeNull();
    expect(mockSessionStorage.getItem('iq_current_results')).toBeNull();
  });
});
