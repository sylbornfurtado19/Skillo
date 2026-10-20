import * as firebaseAuth from '../lib/firebase/services/auth.firebase';
import type { ServiceResponse } from '../types/index';
export * from './backendProvider';

export const signUp = async ({
  email,
  password,
  name,
}: {
  email: string;
  password: string;
  name?: string;
}): Promise<ServiceResponse<unknown>> => {
  return firebaseAuth.signUp({ email, password, name });
};

export const signIn = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<ServiceResponse<unknown>> => {
  return firebaseAuth.signIn({ email, password });
};

export const signInWithGoogle = async (
  token?: string
): Promise<ServiceResponse<unknown>> => {
  return firebaseAuth.signInWithGoogle(token);
};

export const resetPassword = async (
  email: string
): Promise<ServiceResponse<unknown>> => {
  return firebaseAuth.resetPassword(email);
};

export const signOut = async (): Promise<ServiceResponse<boolean>> => {
  return firebaseAuth.signOut();
};


export const getCurrentUser = async (): Promise<ServiceResponse<unknown>> => {
  return firebaseAuth.getCurrentUser();
};

export const getAuthToken = async (): Promise<string | undefined> => {
  // Demo/test session override: return the test token so API routes accept the request
  if (
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('skillo_test_session') === 'true' ||
      document.cookie.includes('skillo_test_session=true'))
  ) {
    return 'test-token';
  }

  try {
    const { auth } = await import('../lib/firebase/config');
    if (!auth.currentUser && typeof (auth as any).authStateReady === 'function') {
      await (auth as any).authStateReady();
    }
    return (await auth.currentUser?.getIdToken()) || undefined;
  } catch {
    return undefined;
  }
};

