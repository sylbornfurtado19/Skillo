import { supabase } from '../lib/supabase';
import type { ServiceResponse, UserProfile, CandidateSkillMemoryStore } from '../types/index';

const resolveSkillMemoryStore = (raw: any): CandidateSkillMemoryStore | undefined => {
  const store = raw?.skill_memory_store ?? raw?.skillMemoryStore;
  if (!store || typeof store !== 'object') return undefined;
  if (Object.keys(store).length === 0) return undefined;
  return store as CandidateSkillMemoryStore;
};

export const getProfile = async (
  userId: string,
  authEmail?: string,
  authName?: string
): Promise<ServiceResponse<UserProfile>> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // Check if error is PGRST116 (JSON / row missing error code from Supabase) or missing data
    if (error && (error.code === 'PGRST116' || error.message?.includes('JSON object requested'))) {
      const newEmail = authEmail || `${userId}@user.skillo`;
      const newName = authName || newEmail.split('@')[0];

      // Auto-create minimal real profile row via upsert
      const { data: createdData, error: createError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email: newEmail,
          name: newName,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError || !createdData) {
        return { data: null, error: createError || error };
      }

      const formatted: UserProfile = {
        ...createdData,
        profileSettings: createdData.profile_settings || createdData.profileSettings || {},
        skillMemoryStore: resolveSkillMemoryStore(createdData),
      };

      return { data: formatted, error: null };
    }

    if (error) {
      return { data: null, error };
    }

    if (!data) {
      return { data: null, error: new Error('No profile data returned') };
    }

    const formatted: UserProfile = {
      ...data,
      profileSettings: data.profile_settings || data.profileSettings || {},
      skillMemoryStore: resolveSkillMemoryStore(data),
    };

    return { data: formatted, error: null };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const updateProfile = async (
  userId: string,
  updates: Partial<UserProfile>
): Promise<ServiceResponse<UserProfile>> => {
  try {
    // Explicit field mapping between camelCase TS fields and snake_case DB columns
    const payload: Record<string, any> = {
      id: userId,
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.avatar_url !== undefined) payload.avatar_url = updates.avatar_url;
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.location !== undefined) payload.location = updates.location;
    if (updates.experience !== undefined) payload.experience = updates.experience;

    // Map profileSettings or profile_settings to DB profile_settings JSONB column
    const settingsPayload = updates.profile_settings || updates.profileSettings;
    if (settingsPayload !== undefined) {
      payload.profile_settings = settingsPayload;
    }

    // Map skillMemoryStore or skill_memory_store to DB skill_memory_store JSONB column
    const memoryStorePayload = (updates as any).skill_memory_store !== undefined
      ? (updates as any).skill_memory_store
      : updates.skillMemoryStore;
    if (memoryStorePayload !== undefined) {
      payload.skill_memory_store = memoryStorePayload;
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    const formatted: UserProfile = {
      ...data,
      profileSettings: data?.profile_settings || data?.profileSettings || {},
      skillMemoryStore: resolveSkillMemoryStore(data),
    };

    return { data: formatted, error: null };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};
