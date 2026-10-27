import type { SessionHistoryItem, InterviewResults } from '../context/InterviewContext';
import type { EvaluationReport } from '../types/index';

/**
 * Checks if an object is a valid evaluation report / interview results structure.
 */
export function isValidReport(report: unknown): report is InterviewResults | EvaluationReport {
  return Boolean(
    report &&
      typeof report === 'object' &&
      typeof (report as any).overallScore === 'number' &&
      !isNaN((report as any).overallScore)
  );
}

/**
 * Checks if a session history item is valid and has either an authentic report or a valid score.
 */
export function isValidSessionItem(item: unknown): item is SessionHistoryItem {
  if (!item || typeof item !== 'object') return false;
  const s = item as SessionHistoryItem;
  if (s.report && isValidReport(s.report)) {
    return true;
  }
  if (typeof s.score === 'number' && !isNaN(s.score)) {
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
 * Never synthesizes fabricated answers or fake rubric scores.
 */
export function buildHistoricalResults(interview: SessionHistoryItem): InterviewResults {
  if (interview.report && isValidReport(interview.report)) {
    return interview.report as InterviewResults;
  }

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
 * Preserves real questions, candidate answers, rubric feedback, and avoids fabricating data.
 */
export function loadPastReport(
  interview: SessionHistoryItem,
  callbacks: {
    setResults: (results: any) => void;
    setSetupData: (data: any) => void;
    setQuestions: (q: string[]) => void;
    setAnswers: (a: any[]) => void;
    router?: { push: (path: string) => void };
  }
): void {
  const { setResults, setSetupData, setQuestions, setAnswers, router } = callbacks;

  if (interview.report && isValidReport(interview.report)) {
    setResults(interview.report);

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
    return;
  }

  // Fallback for legacy session history records lacking a full EvaluationReport
  const fallbackResults = buildHistoricalResults(interview);
  setSetupData(fallbackResults.setupData as any);
  setResults(fallbackResults);
  setQuestions([]);
  setAnswers([]);

  if (router?.push) {
    router.push('/results');
  }
}
