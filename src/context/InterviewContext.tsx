'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

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
}

export interface InterviewResults {
  overallScore: number;
  setupData?: SetupData;
  personaId?: string;
  breakdown?: AnswerBreakdown[];
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
  persona: string;
  interviewModeId?: string;
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
  questions: string[];
  setQuestions: (questions: string[]) => void;
  currentQuestionIndex: number;
  setCurrentQuestionIndex: (index: number) => void;
  answers: AnswerRecord[];
  setAnswers: (answers: AnswerRecord[]) => void;
  results: InterviewResults | null;
  setResults: (results: InterviewResults | null) => void;
  sessionHistory: SessionHistoryItem[];
  setSessionHistory: React.Dispatch<React.SetStateAction<SessionHistoryItem[]>>;
  resetSession: () => void;
  // Theme
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
  const [theme, setTheme] = useState<string>('dark');

  useEffect(() => {
    const saved = safeLocalGet<string>('iq_theme', 'dark');
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
  const [questions, setQuestions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);

  // Results
  const [results, _setResults] = useState<InterviewResults | null>(null);

  // Session history (persisted to localStorage)
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);

  // Rehydrate from storage on mount (client-only)
  useEffect(() => {
    setResumeData(safeSessionGet<unknown>('iq_resume_data', null));
    setSetupData(safeSessionGet<SetupData>('iq_setup_data', DEFAULT_SETUP));
    _setResults(safeSessionGet<InterviewResults | null>('iq_results', null));
    setSessionHistory(safeLocalGet<SessionHistoryItem[]>('session_history', []));
  }, []);

  // Persist to sessionStorage on changes
  useEffect(() => {
    safeSessionSet('iq_resume_data', resumeData);
  }, [resumeData]);

  useEffect(() => {
    safeSessionSet('iq_setup_data', setupData);
  }, [setupData]);

  useEffect(() => {
    safeSessionSet('iq_results', results);
  }, [results]);

  const setResults = (newResults: InterviewResults | null) => {
    _setResults(newResults);
    if (newResults) {
      const historyItem: SessionHistoryItem = {
        id: `session_${Date.now()}`,
        role: newResults.setupData?.role ?? 'Software Engineer',
        type: newResults.setupData?.type ?? 'Technical',
        difficulty: newResults.setupData?.experienceLevel ?? 'Mid-Level',
        date: new Date().toISOString().split('T')[0],
        score: newResults.overallScore,
        persona: newResults.personaId ?? 'sarah',
      };
      setSessionHistory((prev) => {
        const updated = [historyItem, ...prev].slice(0, SESSION_HISTORY_MAX);
        safeLocalSet('session_history', updated);
        return updated;
      });
    }
  };

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
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('iq_resume_data');
        sessionStorage.removeItem('iq_setup_data');
        sessionStorage.removeItem('iq_results');
      } catch {
        // Silently ignore
      }
    }
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
    sessionHistory,
    setSessionHistory,
    resetSession,
    setTheme,
  };

  return (
    <InterviewContext.Provider value={value}>
      {children}
    </InterviewContext.Provider>
  );
};
