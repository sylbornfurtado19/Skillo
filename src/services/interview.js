import { supabase } from '../lib/supabase';

export const saveInterviewSession = async (userId, sessionData) => {
  const { data, error } = await supabase
    .from('interviews')
    .insert([{ user_id: userId, ...sessionData }])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getInterviewHistory = async (userId) => {
  const { data, error } = await supabase
    .from('interviews')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const getInterviewById = async (interviewId) => {
  const { data, error } = await supabase
    .from('interviews')
    .select('*')
    .eq('id', interviewId)
    .single();
  if (error) throw error;
  return data;
};
