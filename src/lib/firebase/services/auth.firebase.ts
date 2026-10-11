import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  updateProfile,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../config';
import type { ServiceResponse } from '../../../types/index';

/**
 * Normalizes Firebase User to match Skillo's expected user structure across all views.
 */
export function normalizeFirebaseUser(user: FirebaseUser | null): any {
  if (!user) return null;
  return {
    id: user.uid,
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    avatar_url: user.photoURL || '',
    user_metadata: {
      name: user.displayName || user.email?.split('@')[0] || '',
      avatar_url: user.photoURL || '',
    },
    created_at: user.metadata.creationTime,
  };
}

export const signUp = async ({
  email,
  password,
  name,
}: {
  email: string;
  password: string;
  name?: string;
}): Promise<ServiceResponse<unknown>> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (name && userCredential.user) {
      await updateProfile(userCredential.user, { displayName: name });
    }
    const normalized = normalizeFirebaseUser(userCredential.user);
    return { data: { user: normalized }, error: null };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const signIn = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<ServiceResponse<unknown>> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const normalized = normalizeFirebaseUser(userCredential.user);
    return { data: { user: normalized }, error: null };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const signInWithGoogle = async (
  token?: string
): Promise<ServiceResponse<unknown>> => {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    let userCredential;
    if (token && typeof token === 'string') {
      const credential = GoogleAuthProvider.credential(token);
      userCredential = await signInWithCredential(auth, credential);
    } else {
      userCredential = await signInWithPopup(auth, provider);
    }

    const normalized = normalizeFirebaseUser(userCredential.user);
    return { data: { user: normalized }, error: null };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const resetPassword = async (
  email: string
): Promise<ServiceResponse<unknown>> => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { data: true, error: null };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const signOut = async (): Promise<ServiceResponse<boolean>> => {
  try {
    await firebaseSignOut(auth);
    return { data: true, error: null };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const getCurrentUser = async (): Promise<ServiceResponse<unknown>> => {
  try {
    const user = auth.currentUser;
    return { data: normalizeFirebaseUser(user), error: null };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const subscribeToAuthState = (callback: (user: any) => void) => {
  return onAuthStateChanged(auth, (firebaseUser) => {
    callback(normalizeFirebaseUser(firebaseUser));
  });
};
