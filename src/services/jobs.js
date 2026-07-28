import { supabase } from '../lib/supabase';

export const getJobs = async () => {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const createJob = async (userId, jobData) => {
  const { data, error } = await supabase
    .from('jobs')
    .insert([{ user_id: userId, ...jobData }])
    .select()
    .single();
  if (error) throw error;
  return data;
};
