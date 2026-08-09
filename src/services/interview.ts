import { supabase } from '../lib/supabase';
import type { MockInterview, ServiceResponse } from '../types/index';

export const saveMockInterview = async (
  userId: string,
  interviewData: Omit<MockInterview, 'id' | 'user_id'>
): Promise<ServiceResponse<MockInterview>> => {
  try {
    const { data, error } = await supabase
      .from('mock_interviews')
      .insert([{ user_id: userId, ...interviewData }])
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
