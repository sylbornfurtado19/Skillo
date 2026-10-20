import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../config';
import type { ServiceResponse, UserProfile, CandidateSkillMemoryStore } from '../../../types/index';

const COLLECTION_NAME = 'profiles';

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
    const docRef = doc(db, COLLECTION_NAME, userId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      const email = authEmail || `${userId}@user.skillo`;
      const name = authName || email.split('@')[0];
      const newProfile: Partial<UserProfile> = {
        id: userId,
        email,
        name,
        created_at: new Date().toISOString(),
        profileSettings: {},
      };

      await setDoc(docRef, newProfile);
      return { data: newProfile as UserProfile, error: null };
    }

    const data = docSnap.data();
    const formatted: UserProfile = {
      id: docSnap.id,
      email: data.email || '',
      name: data.name || '',
      avatar_url: data.avatar_url || data.photoURL || '',
      title: data.title || '',
      location: data.location || '',
      experience: data.experience || '',
      created_at: data.created_at || '',
      profileSettings: data.profileSettings || data.profile_settings || {},
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
    const docRef = doc(db, COLLECTION_NAME, userId);
    const payload: Record<string, any> = {
      ...updates,
      updated_at: new Date().toISOString(),
    };
    if (updates.skillMemoryStore !== undefined) {
      payload.skill_memory_store = updates.skillMemoryStore;
    }

    await updateDoc(docRef, payload);
    return getProfile(userId);
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};
