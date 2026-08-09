import { supabase } from '../lib/supabase';
import type { JobRecord, ServiceResponse } from '../types/index';

export const getJobs = async (): Promise<ServiceResponse<JobRecord[]>> => {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });
    return { data: data as JobRecord[], error };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const createJob = async (
  userId: string,
  jobData: Omit<JobRecord, 'id' | 'user_id'>
): Promise<ServiceResponse<JobRecord>> => {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .insert([{ user_id: userId, ...jobData }])
      .select()
      .single();
    return { data: data as JobRecord, error };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};
