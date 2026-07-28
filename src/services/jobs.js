import { supabase } from '../lib/supabase';

export const getJobs = async () => {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const createJob = async (userId, jobData) => {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .insert([{ user_id: userId, ...jobData }])
      .select()
      .single();
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};
