'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { InterviewQuestion, EvaluationReport } from '../types/index';
import type { IVPEvidenceReceipt } from '@/types/ivpEvidence';
import type { SessionIntegrityReport } from '@/types/integrity';
import { isValidSessionItem, buildHistoricalResults } from '../services/interviewReport';

export type { InterviewQuestion };
export type QuestionItem = string | InterviewQuestion;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SetupData {
  company?: string;
  domain: string;
  role: string;
  experienceLevel: string;
  type: string;
  difficulty: string;
  duration?: number;
  questionCount: number;
  focusAreas: string[];
  persona: string;
  interviewModeId?: string;
  modeConfig?: unknown;
  [key: string]: unknown;
}

export interface AnswerRecord {
  questionId?: string;
  answerText: string;
  timeSpent?: number;
  speakMode?: boolean;
}

export interface AnswerBreakdown {
  question: string;
  score: number;
  feedback: string;
  strengths?: string[];
  improvements?: string[];
  userAnswer?: string;
  answerText?: string;
  [key: string]: unknown;
}

export interface InterviewResults {
  overallScore: number;
  setupData?: SetupData | Record<string, any>;
  personaId?: string;
  breakdown?: AnswerBreakdown[];
  deliveryComposite?: number;
  ivpEvidence?: IVPEvidenceReceipt;
  sessionIntegrity?: SessionIntegrityReport;
  ivpObservations?: Array<{ evidenceId: string; observation: string }>;
  [key: string]: unknown;
}

export interface SessionHistoryItem {
  id: string;
  company?: string;
  role: string;
  type: string;
  difficulty: string;
  duration?: number;
  date: string;
  score: number;
  categories?: {
    techKnowledge?: number;
    communication?: number;
    confidence?: number;
    problemSolving?: number;
    technicalAccuracy?: number;
    depth?: number;
    timeManagement?: number;
  };
  persona: string;
  interviewModeId?: string;
  report?: EvaluationReport | InterviewResults;
}


export interface InterviewContextValue {
  // Session state
  resumeData: unknown;
  setResumeData: (data: unknown) => void;
  jobTitle: string;
  setJobTitle: (title: string) => void;
  jobDescription: string;
  setJobDescription: (desc: string) => void;
  analysisResult: unknown;
  setAnalysisResult: (result: unknown) => void;
  setupData: SetupData;
  setSetupData: (data: SetupData) => void;
  questions: (string | InterviewQuestion)[];
  setQuestions: (questions: (string | InterviewQuestion)[]) => void;
  currentQuestionIndex: number;
  setCurrentQuestionIndex: (index: number) => void;
  answers: AnswerRecord[];
  setAnswers: (answers: AnswerRecord[]) => void;
  results: InterviewResults | null;
  setResults: (results: InterviewResults | null, options?: { addToHistory?: boolean }) => void;
  currentResults: InterviewResults | null;
  historicalSession: SessionHistoryItem | null;
  setHistoricalSession: (session: SessionHistoryItem | null) => void;
  clearHistoricalSession: () => void;
  sessionHistory: SessionHistoryItem[];
  setSessionHistory: React.Dispatch<React.SetStateAction<SessionHistoryItem[]>>;
  isRetry: boolean;
  setIsRetry: (isRetry: boolean) => void;
  retryQuestionIndex: number | null;
  setRetryQuestionIndex: (index: number | null) => void;
  updateQuestionScore: (questionIndex: number, newAnswerText: string, newScore: number, feedback: string) => void;
  resetSession: () => void;
  // Reflexion historical memory
  pastCritiques: Array<{
    skillId: string;
    skillName: string;
    summary: string;
    proficiencyLevel: string;
    remediation?: string;
  }>;
  setPastCritiques: (critiques: Array<{
    skillId: string;
    skillName: string;
    summary: string;
    proficiencyLevel: string;
    remediation?: string;
  }>) => void;
  recalledMemoryNotice: string;
  setRecalledMemoryNotice: (notice: string) => void;
  // Theme
  theme: string;
  setTheme: (theme: string) => void;
}



// ── Context ────────────────────────────────────────────────────────────────────

const InterviewContext = createContext<InterviewContextValue | undefined>(undefined);

export const useInterview = (): InterviewContextValue => {
  const context = useContext(InterviewContext);
  if (!context) {
    throw new Error('useInterview must be used within an InterviewProvider');
  }
  return context;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const DEFAULT_SETUP: SetupData = {
  company: 'Generic',
  domain: 'Computer Science',
  role: 'Software Engineer',
  experienceLevel: 'Mid-Level',
  type: 'Technical',
  difficulty: 'Medium',
  duration: 45,
  questionCount: 5,
  focusAreas: [],
  persona: 'sarah',
  interviewModeId: 'generic-technical',
};

const SESSION_HISTORY_MAX = 20;

export interface StreakInfo {
  currentStreak: number;
  practicedToday: boolean;
  hasActiveStreakYesterday: boolean;
}

export function calculateStreak(history: SessionHistoryItem[]): StreakInfo {
  if (!history || history.length === 0) {
    return { currentStreak: 0, practicedToday: false, hasActiveStreakYesterday: false };
  }

  // Extract unique sorted dates (YYYY-MM-DD) descending
  const uniqueDates = Array.from(
    new Set(
      history
        .map((item) => item.date ? item.date.split('T')[0] : '')
        .filter(Boolean)
    )
  ).sort((a, b) => b.localeCompare(a));

  if (uniqueDates.length === 0) {
    return { currentStreak: 0, practicedToday: false, hasActiveStreakYesterday: false };
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  

  const practicedToday = uniqueDates.includes(todayStr);

  let currentStreak = 0;
  let checkDate = new Date();

  // If candidate hasn't practiced today, start checking from yesterday
  if (!practicedToday) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0];
    if (uniqueDates.includes(dateStr)) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  const hasActiveStreakYesterday = !practicedToday && currentStreak > 0;

  return {
    currentStreak,
    practicedToday,
    hasActiveStreakYesterday,
  };
}

function safeLocalGet<T>(key: string, fallback: T): T {

  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeLocalSet(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // QuotaExceededError or privacy-mode restriction — silently ignore
  }
}

function safeSessionGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeSessionSet(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    if (value !== null && value !== undefined) {
      sessionStorage.setItem(key, JSON.stringify(value));
    } else {
      sessionStorage.removeItem(key);
    }
  } catch {
    // Silently ignore storage errors
  }
}

// ── Provider ───────────────────────────────────────────────────────────────────

export const InterviewProvider = ({ children }: { children: React.ReactNode }) => {
  // Theme State — guarded for SSR
  const [theme, setTheme] = useState<string>('nmims');

  useEffect(() => {
    const saved = safeLocalGet<string>('iq_theme', 'nmims');
    setTheme(saved);
  }, []);

  useEffect(() => {
    safeLocalSet('iq_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Resume & job data
  const [resumeData, setResumeData] = useState<unknown>(null);
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [analysisResult, setAnalysisResult] = useState<unknown>(null);

  // Setup data
  const [setupData, setSetupData] = useState<SetupData>(DEFAULT_SETUP);

  // Interview session
  const [questions, setQuestions] = useState<(string | InterviewQuestion)[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);

  // Active in-progress/just-completed live interview results
  const [currentResults, setCurrentResults] = useState<InterviewResults | null>(null);

  // Historical session currently being viewed (null if viewing live session)
  const [historicalSession, setHistoricalSessionState] = useState<SessionHistoryItem | null>(null);

  // Results currently displayed
  const [results, _setResults] = useState<InterviewResults | null>(null);

  // Session history (persisted to localStorage)
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);

  const setHistoricalSession = (session: SessionHistoryItem | null) => {
    setHistoricalSessionState(session);
    safeSessionSet('iq_historical_session', session);
  };

  const clearHistoricalSession = () => {
    setHistoricalSessionState(null);
    safeSessionSet('iq_historical_session', null);
    const live = currentResults || safeSessionGet<InterviewResults | null>('iq_current_results', null);
    if (live) {
      _setResults(live);
      safeSessionSet('iq_results', live);
    } else {
      _setResults(null);
      safeSessionSet('iq_results', null);
    }
  };

  // Rehydrate from storage on mount (client-only)
  useEffect(() => {
    setResumeData(safeSessionGet<unknown>('iq_resume_data', null));
    setSetupData(safeSessionGet<SetupData>('iq_setup_data', DEFAULT_SETUP));
    setQuestions(safeSessionGet<(string | InterviewQuestion)[]>('iq_questions', []));
    setCurrentQuestionIndex(safeSessionGet<number>('iq_question_index', 0));
    setAnswers(safeSessionGet<AnswerRecord[]>('iq_answers', []));

    const savedCurrent = safeSessionGet<InterviewResults | null>('iq_current_results', null);
    setCurrentResults(savedCurrent);

    const savedHistorical = safeSessionGet<SessionHistoryItem | null>('iq_historical_session', null);
    setHistoricalSessionState(savedHistorical);

    const savedResults = safeSessionGet<InterviewResults | null>('iq_results', null);
    _setResults(
      savedResults ??
      (savedHistorical && isValidSessionItem(savedHistorical)
        ? buildHistoricalResults(savedHistorical)
        : savedCurrent)
    );

    const rawHistory = safeLocalGet<SessionHistoryItem[]>('session_history', []);
    const validHistory = Array.isArray(rawHistory)
      ? rawHistory.filter(isValidSessionItem)
      : [];
    setSessionHistory(validHistory);
  }, []);

  // Persist to sessionStorage on changes
  useEffect(() => {
    safeSessionSet('iq_resume_data', resumeData);
  }, [resumeData]);

  useEffect(() => {
    safeSessionSet('iq_setup_data', setupData);
  }, [setupData]);

  useEffect(() => {
    safeSessionSet('iq_questions', questions);
  }, [questions]);

  useEffect(() => {
    safeSessionSet('iq_question_index', currentQuestionIndex);
  }, [currentQuestionIndex]);

  useEffect(() => {
    safeSessionSet('iq_answers', answers);
  }, [answers]);

  useEffect(() => {
    safeSessionSet('iq_results', results);
  }, [results]);

  useEffect(() => {
    safeSessionSet('iq_current_results', currentResults);
  }, [currentResults]);

  useEffect(() => {
    safeSessionSet('iq_historical_session', historicalSession);
  }, [historicalSession]);

  const setResults = (
    newResults: InterviewResults | null,
    options?: { addToHistory?: boolean }
  ) => {
    _setResults(newResults);
    safeSessionSet('iq_results', newResults);

    // If viewing a historical session or addToHistory is explicitly false, do not mutate current results or history
    const isHistorical = Boolean(
      options?.addToHistory === false ||
      (newResults as any)?.sessionId ||
      (newResults as any)?.isHistorical ||
      historicalSession
    );

    if (!isHistorical && newResults) {
      setCurrentResults(newResults);
      safeSessionSet('iq_current_results', newResults);
    }

    if (newResults && !isHistorical && options?.addToHistory !== false) {
      const cats = (newResults.categories || {}) as Record<string, number>;
      const historyItem: SessionHistoryItem = {
        id: (newResults as any).sessionId || `session_${Date.now()}`,
        role: newResults.setupData?.role ?? 'Software Engineer',
        type: newResults.setupData?.type ?? 'Technical',
        difficulty: newResults.setupData?.experienceLevel ?? 'Mid-Level',
        date: (newResults as any).sessionDate || new Date().toISOString().split('T')[0],
        score: newResults.overallScore,
        categories: {
          techKnowledge: cats.technicalAccuracy ?? 80,
          communication: cats.communication ?? 85,
          confidence: cats.depth ?? 75,
          problemSolving: cats.timeManagement ?? 90,
          technicalAccuracy: cats.technicalAccuracy,
          depth: cats.depth,
          timeManagement: cats.timeManagement,
        },
        persona: newResults.personaId ?? 'sarah',
        company: newResults.setupData?.company,
        duration: newResults.setupData?.duration,
        interviewModeId: newResults.setupData?.interviewModeId,
        report: newResults,
      };
      const currentStored = safeLocalGet<SessionHistoryItem[]>('session_history', sessionHistory);
      const alreadyExists = currentStored.some(
        (item) => item.report === newResults || (item.id && (newResults as any).sessionId === item.id)
      );
      if (!alreadyExists) {
        const updated = [historyItem, ...currentStored].slice(0, SESSION_HISTORY_MAX);
        safeLocalSet('session_history', updated);
        setSessionHistory(updated);
      }
    }
  };


  // Reflexion historical memory
  const [pastCritiques, setPastCritiques] = useState<
    Array<{
      skillId: string;
      skillName: string;
      summary: string;
      proficiencyLevel: string;
      remediation?: string;
    }>
  >([]);
  const [recalledMemoryNotice, setRecalledMemoryNotice] = useState<string>('');

  const resetSession = () => {
    setResumeData(null);
    setJobTitle('');
    setJobDescription('');
    setAnalysisResult(null);
    setSetupData(DEFAULT_SETUP);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setAnswers([]);
    _setResults(null);
    setCurrentResults(null);
    setHistoricalSessionState(null);
    setPastCritiques([]);
    setRecalledMemoryNotice('');
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('iq_resume_data');
        sessionStorage.removeItem('iq_setup_data');
        sessionStorage.removeItem('iq_results');
        sessionStorage.removeItem('iq_current_results');
        sessionStorage.removeItem('iq_historical_session');
      } catch {
        // Silently ignore
      }
    }
  };

  // Single question retry mode state
  const [isRetry, setIsRetry] = useState(false);
  const [retryQuestionIndex, setRetryQuestionIndex] = useState<number | null>(null);

  const updateQuestionScore = (questionIndex: number, newAnswerText: string, newScore: number, feedback: string) => {
    if (!results || !results.breakdown) return;

    const newBreakdown = [...results.breakdown];
    if (newBreakdown[questionIndex]) {
      newBreakdown[questionIndex] = {
        ...newBreakdown[questionIndex],
        score: newScore,
        feedback,
      };
    }

    const updatedOverallScore = Math.round(
      newBreakdown.reduce((sum, item) => sum + item.score, 0) / newBreakdown.length
    );

    const updatedResults: InterviewResults = {
      ...results,
      overallScore: updatedOverallScore,
      breakdown: newBreakdown,
    };

    _setResults(updatedResults);
    safeSessionSet('iq_results', updatedResults);
  };

  const value: InterviewContextValue = {
    resumeData,
    setResumeData,
    jobTitle,
    setJobTitle,
    jobDescription,
    setJobDescription,
    analysisResult,
    setAnalysisResult,
    setupData,
    setSetupData,
    questions,
    setQuestions,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    answers,
    setAnswers,
    results,
    setResults,
    currentResults,
    historicalSession,
    setHistoricalSession,
    clearHistoricalSession,
    sessionHistory,
    setSessionHistory,
    isRetry,
    setIsRetry,
    retryQuestionIndex,
    setRetryQuestionIndex,
    updateQuestionScore,
    resetSession,
    pastCritiques,
    setPastCritiques,
    recalledMemoryNotice,
    setRecalledMemoryNotice,
    theme,
    setTheme,
  };

  return (
    <InterviewContext.Provider value={value}>
      {children}
    </InterviewContext.Provider>
  );
};
