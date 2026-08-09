import { supabase } from '../lib/supabase';
import type { ResumeAnalysis, ServiceResponse } from '../types/index';

export const saveAnalysis = async (
  userId: string,
  analysisData: Omit<ResumeAnalysis, 'id' | 'user_id'>
): Promise<ServiceResponse<ResumeAnalysis>> => {
  try {
    const { data, error } = await supabase
      .from('resume_analysis')
      .insert([{ user_id: userId, ...analysisData }])
      .select()
      .single();
    return { data: data as ResumeAnalysis, error };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const getAnalyses = async (
  userId: string
): Promise<ServiceResponse<ResumeAnalysis[]>> => {
  try {
    const { data, error } = await supabase
      .from('resume_analysis')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data: data as ResumeAnalysis[], error };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const getAnalysisById = async (
  analysisId: string
): Promise<ServiceResponse<ResumeAnalysis>> => {
  try {
    const { data, error } = await supabase
      .from('resume_analysis')
      .select('*')
      .eq('id', analysisId)
      .single();
    return { data: data as ResumeAnalysis, error };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};
