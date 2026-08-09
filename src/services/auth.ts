import { supabase } from '../lib/supabase';
import type { ServiceResponse } from '../types/index';

const getOrigin = (): string => {
  if (typeof window !== 'undefined') return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
};

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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    return { data, error };
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
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const signInWithGoogle = async (
  token?: string
): Promise<ServiceResponse<unknown>> => {
  try {
    if (token && typeof token === 'string') {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token,
      });
      return { data, error };
    }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${getOrigin()}/dashboard`,
      },
    });
    return { data, error };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const resetPassword = async (
  email: string
): Promise<ServiceResponse<unknown>> => {
  try {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getOrigin()}/login?reset=true`,
    });
    return { data, error };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const signOut = async (): Promise<ServiceResponse<boolean>> => {
  try {
    const { error } = await supabase.auth.signOut();
    return { data: true, error };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const getSession = async (): Promise<ServiceResponse<unknown>> => {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    return { data: session, error };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const getCurrentUser = async (): Promise<ServiceResponse<unknown>> => {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    return { data: user, error };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};
