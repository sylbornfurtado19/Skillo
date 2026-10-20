import * as firebaseProfile from '../lib/firebase/services/profile.firebase';
import type { ServiceResponse, UserProfile } from '../types/index';

export const getProfile = async (
  userId: string,
  authEmail?: string,
  authName?: string
): Promise<ServiceResponse<UserProfile>> => {
  return firebaseProfile.getProfile(userId, authEmail, authName);
};

export const updateProfile = async (
  userId: string,
  updates: Partial<UserProfile>
): Promise<ServiceResponse<UserProfile>> => {
  return firebaseProfile.updateProfile(userId, updates);
};

