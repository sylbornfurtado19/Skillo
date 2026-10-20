import * as firebaseInterview from '../lib/firebase/services/interview.firebase';
import type { MockInterview, MockInterviewInsert, ServiceResponse, EvaluationReport } from '../types/index';
import { toServerSafeEvidence } from '../lib/services/ivpEvidenceAggregator';

export type { MockInterviewInsert };

/**
 * Maps an EvaluationReport and optional setupData into the mock_interviews database payload schema.
 */
export function mapEvaluationToMockInterviewPayload(
  report: EvaluationReport,
  fallbackSetupData?: Record<string, any>
): MockInterviewInsert {
  const setup = report.setupData || fallbackSetupData || {};
  return {
    domain: (setup.domain as string) || 'Computer Science',
    role: (setup.role as string) || 'Software Engineer',
    experience_level: (setup.experienceLevel as string) || (setup.difficulty as string) || 'Mid-Level',
    interview_type: (setup.type as string) || 'Technical',
    persona: report.personaId || (setup.persona as string) || 'sarah',
    overall_score: report.overallScore,
    categories: report.categories || {},
    breakdown: report.breakdown || [],
    interviewer_comments: report.interviewerComments || '',
    company: (setup.company as string) || 'Generic',
    duration: typeof setup.duration === 'number' ? setup.duration : 45,
    interview_mode_id: (setup.interviewModeId as string) || 'generic-technical',
    system_design_diagram: setup.systemDesignDiagram || {},
    ...(report.ivpEvidence ? { ivp_evidence: toServerSafeEvidence(report.ivpEvidence) } : {}),
    ...(report.sessionIntegrity ? { session_integrity: report.sessionIntegrity } : {}),
    ...(report.evaluatedAt ? { created_at: report.evaluatedAt } : {}),
  };
}

export const saveMockInterview = async (
  userId: string,
  interviewData: MockInterviewInsert
): Promise<ServiceResponse<MockInterview>> => {
  return firebaseInterview.saveMockInterview(userId, interviewData);
};

export const getMockInterviews = async (
  userId: string
): Promise<ServiceResponse<MockInterview[]>> => {
  return firebaseInterview.getMockInterviews(userId);
};

export const getMockInterviewById = async (
  interviewId: string
): Promise<ServiceResponse<MockInterview>> => {
  return firebaseInterview.getMockInterviewById(interviewId);
};

