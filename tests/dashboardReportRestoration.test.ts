/**
 * Unit Tests for Historical Assessment Report Restoration in Dashboard
 * Verifies that:
 * 1. Selecting a historical session restores the authentic stored EvaluationReport.
 * 2. Fabricated dummy answers ("Demonstrated strong modular architecture...") are NEVER injected.
 * 3. Real questions, submitted answers, rubric grades, and feedback are preserved.
 * 4. Legacy sessions lacking a full report are handled gracefully without synthesizing fake answers.
 */

import React from 'react';
import type { SessionHistoryItem } from '../src/context/InterviewContext';
import { loadPastReport } from '../src/services/interviewReport';

describe('Dashboard Historical Assessment Report Restoration', () => {
  let mockSetResults: jest.Mock;
  let mockSetSetupData: jest.Mock;
  let mockSetQuestions: jest.Mock;
  let mockSetAnswers: jest.Mock;
  let mockRouterPush: jest.Mock;

  beforeEach(() => {
    mockSetResults = jest.fn();
    mockSetSetupData = jest.fn();
    mockSetQuestions = jest.fn();
    mockSetAnswers = jest.fn();
    mockRouterPush = jest.fn();
  });

  const authenticReportSession: SessionHistoryItem = {
    id: 'session_real_987',
    role: 'Staff Site Reliability Engineer',
    type: 'System Design',
    difficulty: 'Senior',
    date: '2026-10-20',
    score: 91,
    persona: 'sarah',
    company: 'Stripe',
    duration: 50,
    report: {
      overallScore: 91,
      personaId: 'sarah',
      interviewerComments: 'Exceptional incident management and circuit breaking logic.',
      categories: {
        technicalAccuracy: 94,
        communication: 90,
        depth: 92,
        timeManagement: 88,
      },
      setupData: {
        domain: 'Computer Science',
        role: 'Staff Site Reliability Engineer',
        experienceLevel: 'Senior',
        type: 'System Design',
        difficulty: 'Senior',
        questionCount: 2,
        focusAreas: ['High Availability', 'Distributed Tracing'],
        persona: 'sarah',
        company: 'Stripe',
        duration: 50,
      },
      breakdown: [
        {
          id: 'q_1',
          question: 'How do you prevent cascading failure in distributed service meshes?',
          userAnswer: 'I implement adaptive concurrency limits, deadline propagation, and jittered exponential backoff.',
          score: 93,
          feedback: 'Excellent response covering client-side load shedding and gRPC deadlines.',
          strengths: ['Adaptive concurrency', 'Clear terminology'],
        },
        {
          id: 'q_2',
          question: 'Explain how you design an SLO error-budget alerting policy.',
          userAnswer: 'Multi-window multi-burn-rate alerts using 1h and 6h windows for pager, 24h for ticketing.',
          score: 89,
          feedback: 'Spot-on implementation of Google SRE workbook patterns.',
          strengths: ['Multi-burn-rate alerts', 'Actionable pages'],
        },
      ],
    },
  };

  it('restores authentic stored report without synthesizing placeholder answers', () => {
    loadPastReport(authenticReportSession, {
      setResults: mockSetResults,
      setSetupData: mockSetSetupData,
      setQuestions: mockSetQuestions,
      setAnswers: mockSetAnswers,
      router: { push: mockRouterPush },
    });

    // 1. Must restore authentic results
    expect(mockSetResults).toHaveBeenCalledWith(
      expect.objectContaining({
        ...authenticReportSession.report,
        sessionId: 'session_real_987',
        sessionDate: '2026-10-20',
      }),
      { addToHistory: false }
    );
    const restoredResults = mockSetResults.mock.calls[0][0];
    expect(restoredResults.overallScore).toBe(91);
    expect(restoredResults.interviewerComments).toBe('Exceptional incident management and circuit breaking logic.');

    // 2. Must restore authentic setupData
    expect(mockSetSetupData).toHaveBeenCalledWith(authenticReportSession.report!.setupData);

    // 3. Must restore authentic questions
    expect(mockSetQuestions).toHaveBeenCalledWith([
      'How do you prevent cascading failure in distributed service meshes?',
      'Explain how you design an SLO error-budget alerting policy.',
    ]);

    // 4. Must restore candidate real answers
    expect(mockSetAnswers).toHaveBeenCalledWith([
      { answerText: 'I implement adaptive concurrency limits, deadline propagation, and jittered exponential backoff.' },
      { answerText: 'Multi-window multi-burn-rate alerts using 1h and 6h windows for pager, 24h for ticketing.' },
    ]);

    // 5. Must NOT contain the old hardcoded synthetic answers
    const passedAnswers = mockSetAnswers.mock.calls[0][0];
    const stringifiedAnswers = JSON.stringify(passedAnswers);
    expect(stringifiedAnswers).not.toContain('Demonstrated strong modular architecture and technical depth.');
    expect(stringifiedAnswers).not.toContain('Detailed error handling and edge cases.');

    // 6. Must navigate to /results
    expect(mockRouterPush).toHaveBeenCalledWith('/results');
  });

  it('gracefully handles legacy session without report without manufacturing fake assessment answers', () => {
    const legacySession: SessionHistoryItem = {
      id: 'session_legacy_101',
      role: 'Frontend Architect',
      type: 'Technical',
      difficulty: 'Senior',
      date: '2026-08-15',
      score: 85,
      persona: 'sarah',
      company: 'Generic',
      categories: {
        technicalAccuracy: 86,
        communication: 88,
        depth: 82,
        timeManagement: 84,
      },
    };

    loadPastReport(legacySession, {
      setResults: mockSetResults,
      setSetupData: mockSetSetupData,
      setQuestions: mockSetQuestions,
      setAnswers: mockSetAnswers,
      router: { push: mockRouterPush },
    });

    // 1. Must build clean results from score and categories
    expect(mockSetResults).toHaveBeenCalled();
    const restoredResults = mockSetResults.mock.calls[0][0];
    expect(restoredResults.overallScore).toBe(85);
    expect(restoredResults.categories.technicalAccuracy).toBe(86);
    expect(restoredResults.breakdown).toEqual([]);

    // 2. Must NOT manufacture fake questions or answers
    expect(mockSetQuestions).toHaveBeenCalledWith([]);
    expect(mockSetAnswers).toHaveBeenCalledWith([]);

    // 3. Must navigate to /results
    expect(mockRouterPush).toHaveBeenCalledWith('/results');
  });
});
