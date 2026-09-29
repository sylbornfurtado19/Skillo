import { supabase } from '../lib/supabase';
import type { MockInterview, MockInterviewInsert, ServiceResponse, EvaluationReport } from '../types/index';

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
    ...(report.evaluatedAt ? { created_at: report.evaluatedAt } : {}),
  };
}

export const saveMockInterview = async (
  userId: string,
  interviewData: MockInterviewInsert
): Promise<ServiceResponse<MockInterview>> => {
  try {
    const payload = {
      user_id: userId,
      domain: interviewData.domain,
      role: interviewData.role,
      experience_level: interviewData.experience_level,
      interview_type: interviewData.interview_type,
      persona: interviewData.persona,
      overall_score: interviewData.overall_score,
      categories: interviewData.categories,
      breakdown: interviewData.breakdown,
      interviewer_comments: interviewData.interviewer_comments,
      company: interviewData.company ?? 'Generic',
      duration: interviewData.duration ?? 45,
      interview_mode_id: interviewData.interview_mode_id ?? 'generic-technical',
      system_design_diagram: interviewData.system_design_diagram ?? {},
      ...(interviewData.created_at ? { created_at: interviewData.created_at } : {}),
    };

    const { data, error } = await supabase
      .from('mock_interviews')
      .insert([payload])
      .select()
      .single();
    return { data: data as MockInterview, error };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const getMockInterviews = async (
  userId: string
): Promise<ServiceResponse<MockInterview[]>> => {
  try {
    const { data, error } = await supabase
      .from('mock_interviews')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data: data as MockInterview[], error };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const getMockInterviewById = async (
  interviewId: string
): Promise<ServiceResponse<MockInterview>> => {
  try {
    const { data, error } = await supabase
      .from('mock_interviews')
      .select('*')
      .eq('id', interviewId)
      .single();
    return { data: data as MockInterview, error };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};
