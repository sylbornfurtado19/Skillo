import { supabase } from '../lib/supabase';
import type { ServiceResponse, UserProfile } from '../types/index';

export const getProfile = async (
  userId: string
): Promise<ServiceResponse<UserProfile>> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return { data: data as UserProfile, error };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const updateProfile = async (
  userId: string,
  updates: Partial<UserProfile>
): Promise<ServiceResponse<UserProfile>> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() })
      .select()
      .single();
    return { data: data as UserProfile, error };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};
