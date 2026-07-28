import { supabase } from '../lib/supabase';

const BUCKET_NAME = 'resumes';

export const uploadResume = async (file, userId) => {
  const fileExt = file.name.split('.').pop();
  const filePath = `${userId}/${Date.now()}.${fileExt}`;
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, { upsert: true });

  if (error) throw error;
  return data;
};

export const deleteResume = async (filePath) => {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([filePath]);
  if (error) throw error;
  return data;
};

export const getResumeUrl = (filePath) => {
  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);
  return data?.publicUrl || null;
};

export const saveResumeAnalysis = async (userId, analysisData) => {
  const { data, error } = await supabase
    .from('resume_analysis')
    .insert([{ user_id: userId, ...analysisData }])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getResumeAnalyses = async (userId) => {
  const { data, error } = await supabase
    .from('resume_analysis')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};
