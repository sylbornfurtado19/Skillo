import { supabase } from '../lib/supabase';

export const saveAnalysis = async (userId, analysisData) => {
  try {
    const { data, error } = await supabase
      .from('resume_analysis')
      .insert([{ user_id: userId, ...analysisData }])
      .select()
      .single();
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getAnalyses = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('resume_analysis')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getAnalysisById = async (analysisId) => {
  try {
    const { data, error } = await supabase
      .from('resume_analysis')
      .select('*')
      .eq('id', analysisId)
      .single();
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};
