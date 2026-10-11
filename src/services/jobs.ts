import { supabase } from '../lib/supabase';
import { isFirebaseActive } from './backendProvider';
import * as firebaseJobs from '../lib/firebase/services/jobs.firebase';
import type { JobRecord, ServiceResponse } from '../types/index';

export const getJobs = async (): Promise<ServiceResponse<JobRecord[]>> => {
  if (isFirebaseActive()) {
    return firebaseJobs.getJobs();
  }

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
  if (isFirebaseActive()) {
    return firebaseJobs.createJob({ user_id: userId, ...jobData });
  }

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
