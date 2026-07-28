import { supabase } from '../lib/supabase';

/**
 * Sign up user with email, password, and additional user metadata.
 */
export const signUp = async ({ email, password, name }) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
    },
  });
  if (error) throw error;
  return data;
};

/**
 * Log in user with email and password.
 */
export const signIn = async ({ email, password }) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

/**
 * Log in with Google OAuth ID token.
 */
export const signInWithGoogle = async (token) => {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token,
  });
  if (error) throw error;
  return data;
};

/**
 * Log out current user session.
 */
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

/**
 * Get current active session.
 */
export const getSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
};

/**
 * Get currently authenticated user.
 */
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
};
