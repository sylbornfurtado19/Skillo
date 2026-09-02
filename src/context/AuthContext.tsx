'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import * as authService from '../services/auth';
import type { ServiceResponse } from '../types/index';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  signUp: (credentials: { email: string; password: string; name?: string }) => Promise<ServiceResponse<unknown>>;
  signIn: (credentials: { email: string; password: string }) => Promise<ServiceResponse<unknown>>;
  signInWithGoogle: (token?: string) => Promise<ServiceResponse<unknown>>;
  signOut: () => Promise<ServiceResponse<unknown>>;
}

// ── Context ────────────────────────────────────────────────────────────────────

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// ── Provider ───────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      // Fetch initial active session — with .catch() to handle network failures
      supabase.auth
        .getSession()
        .then(({ data: { session } }) => {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        })
        .catch((err: unknown) => {
          console.error('[AuthContext] Failed to get session:', err);
          setLoading(false);
        });

      // Subscribe to auth state changes
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      });

      return () => subscription?.unsubscribe?.();
    } catch (err: unknown) {
      console.warn(
        '[AuthContext] Supabase initialization failed. Environment variables may be missing on this deployment host:',
        err instanceof Error ? err.message : err
      );
      setLoading(false);
    }
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    loading,
    isAuthenticated: !!user,
    signUp: (credentials) => authService.signUp(credentials),
    signIn: (credentials) => authService.signIn(credentials),
    signInWithGoogle: (token) => authService.signInWithGoogle(token),
    signOut: () => authService.signOut(),
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
