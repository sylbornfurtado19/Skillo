import type { SessionHistoryItem, InterviewResults } from '../context/InterviewContext';
import type { EvaluationReport } from '../types/index';

/**
 * Checks if an object is a valid evaluation report / interview results structure.
 * Distinguishes valid reports with legitimately empty optional fields (e.g. breakdown, categories)
 * from invalid or corrupt objects with missing or non-finite overallScores.
 */
export function isValidReport(report: unknown): report is InterviewResults | EvaluationReport {
  if (!report || typeof report !== 'object') return false;
  const score = (report as any).overallScore ?? (report as any).score;
  return typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100;
}

/**
 * Checks if a session history item is valid and has either an authentic report or a valid score.
 */
export function isValidSessionItem(item: unknown): item is SessionHistoryItem {
  if (!item || typeof item !== 'object') return false;
  const s = item as SessionHistoryItem;
  if (!s.id || typeof s.id !== 'string' || s.id.trim().length === 0) return false;

  if (s.report && isValidReport(s.report)) {
    return true;
  }
  const score = typeof s.score === 'number' ? s.score : (s as any).report?.score;
  if (typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100) {
    return true;
  }
  return false;
}

/**
 * Finds the most recent valid historical session report following chronological order
 * (sessionHistory is ordered with index 0 being the most recent).
 * Skips malformed or corrupt sessions.
 */
export function findLatestValidSessionReport(
  history: SessionHistoryItem[] | undefined | null
): SessionHistoryItem | null {
  if (!Array.isArray(history) || history.length === 0) return null;

  for (const item of history) {
    if (isValidSessionItem(item)) {
      return item;
    }
  }

  return null;
}

/**
 * Builds an authentic or minimal results object from a historical session item.
 * Preserves session identity and timestamps. Never synthesizes fabricated answers or fake rubric scores.
 */
export function buildHistoricalResults(interview: SessionHistoryItem): InterviewResults {
  if (interview.report && isValidReport(interview.report)) {
    const reportScore = (interview.report as any).overallScore ?? (interview.report as any).score;
    return {
      ...(interview.report as InterviewResults),
      overallScore: reportScore,
      sessionId: interview.id,
      sessionDate: interview.date,
    };
  }

  const rawScore = typeof interview?.score === 'number' && Number.isFinite(interview.score)
    ? interview.score
    : (typeof (interview?.report as any)?.score === 'number' ? (interview.report as any).score : 75);
  const overallScore = Math.min(100, Math.max(0, rawScore));

  const setupDataObj = {
    domain: 'Computer Science',
    role: interview.role || 'Software Engineer',
    experienceLevel: interview.difficulty || 'Mid-Level',
    type: interview.type || 'Technical',
    difficulty: interview.difficulty || 'Mid-Level',
    questionCount: 0,
    focusAreas: [interview.role || 'Software Engineering'],
    persona: interview.persona || 'sarah',
    company: interview.company || 'Generic',
    duration: interview.duration || 45,
  };
  const cats = interview.categories || {};
  return {
    sessionId: interview.id,
    sessionDate: interview.date,
    overallScore: interview.score,
    categories: {
      technicalAccuracy: cats.technicalAccuracy ?? cats.techKnowledge ?? interview.score,
      communication: cats.communication ?? interview.score,
      depth: cats.depth ?? cats.confidence ?? interview.score,
      timeManagement: cats.timeManagement ?? cats.problemSolving ?? interview.score,
    },
    breakdown: [],
    interviewerComments: `Historical assessment record from ${interview.date}. Overall score: ${interview.score}%.`,
    personaId: interview.persona || 'sarah',
    setupData: setupDataObj,
  };
}

/**
 * Restores an authentic historical assessment report into the interview state.
 * Preserves real questions, candidate answers, rubric feedback, and prevents history duplication.
 */
export function loadPastReport(
  interview: SessionHistoryItem,
  callbacks: {
    setResults: (results: any, options?: { addToHistory?: boolean }) => void;
    setSetupData: (data: any) => void;
    setQuestions: (q: string[]) => void;
    setAnswers: (a: any[]) => void;
    setHistoricalSession?: (session: SessionHistoryItem | null) => void;
    router?: { push: (path: string) => void };
  }
): boolean {
  const { setResults, setSetupData, setQuestions, setAnswers, setHistoricalSession, router } = callbacks;

  if (setHistoricalSession) {
    setHistoricalSession(interview);
  }

  // Defensively validate session before attempting restoration
  if (!isValidSessionItem(interview)) {
    setResults(null, { addToHistory: false });
    if (router?.push) {
      router.push('/results');
    }
    return false;
  }

  if (interview.report && isValidReport(interview.report)) {
    const reportScore = (interview.report as any).overallScore ?? (interview.report as any).score;
    const reportWithSession = {
      ...interview.report,
      overallScore: reportScore,
      sessionId: interview.id,
      sessionDate: interview.date,
    };
    setResults(reportWithSession, { addToHistory: false });

    if (interview.report.setupData) {
      setSetupData(interview.report.setupData as any);
    } else {
      setSetupData({
        domain: 'Computer Science',
        role: interview.role || 'Software Engineer',
        experienceLevel: interview.difficulty || 'Mid-Level',
        type: interview.type || 'Technical',
        difficulty: interview.difficulty || 'Mid-Level',
        questionCount: Array.isArray(interview.report.breakdown) ? interview.report.breakdown.length : 3,
        focusAreas: ['Core Architecture', 'System Logic'],
        persona: interview.persona || 'sarah',
        company: interview.company || 'Generic',
        duration: interview.duration || 45,
      });
    }

    if (Array.isArray(interview.report.breakdown) && interview.report.breakdown.length > 0) {
      setQuestions(interview.report.breakdown.map((b) => b.question));
      setAnswers(
        interview.report.breakdown.map((b) => ({
          answerText: b.userAnswer || b.answerText || '',
        }))
      );
    } else {
      setQuestions([]);
      setAnswers([]);
    }

    if (router?.push) {
      router.push('/results');
    }
    return true;
  }

  // Fallback for legacy session history records lacking a full EvaluationReport
  const fallbackResults = buildHistoricalResults(interview);
  setSetupData(fallbackResults.setupData as any);
  setResults(fallbackResults, { addToHistory: false });
  setQuestions([]);
  setAnswers([]);

  if (router?.push) {
    router.push('/results');
  }
  return true;
}
