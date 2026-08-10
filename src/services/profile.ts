import { supabase } from '../lib/supabase';
import type { ServiceResponse, UserProfile, CandidateSkillMemoryStore } from '../types/index';

export const getProfile = async (
  userId: string
): Promise<ServiceResponse<UserProfile>> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return {
        data: {
          id: userId,
          email: 'user@skillo.dev',
          name: 'Developer Candidate',
          created_at: new Date().toISOString(),
          // No fake skillMemoryStore here — returns undefined, which shows empty state
        },
        error: null,
      };
    }

    const profileData = data as UserProfile;
    // skillMemoryStore will be null/undefined for new users — that is correct
    // SkillMemoryGraph renders an empty state when undefined

    return { data: profileData, error: null };
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
