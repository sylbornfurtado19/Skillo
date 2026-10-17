'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isFirebaseActive } from '../services/backendProvider';
import { subscribeToAuthState } from '../lib/firebase/services/auth.firebase';
import * as authService from '../services/auth';
import type { ServiceResponse } from '../types/index';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AuthContextValue {
  user: User | any | null;
  session: Session | any | null;
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
  const [user, setUser] = useState<User | any | null>(null);
  const [session, setSession] = useState<Session | any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 0. Test / Mock Session Override
    if (
      typeof window !== 'undefined' &&
      (window.localStorage.getItem('skillo_test_session') === 'true' ||
        document.cookie.includes('skillo_test_session=true'))
    ) {
      const mockUser = {
        id: 'test-candidate-id',
        email: 'candidate@skillo.ai',
        user_metadata: { name: 'Test Candidate' },
      };
      setUser(mockUser);
      setSession({ user: mockUser, access_token: 'test-token' });
      setLoading(false);
      return;
    }

    // 1. Firebase Provider Path
    if (isFirebaseActive()) {
      try {
        const unsubscribe = subscribeToAuthState((firebaseUser) => {
          setUser(firebaseUser);
          setSession(firebaseUser ? { user: firebaseUser } : null);
          setLoading(false);
        });
        return () => unsubscribe();
      } catch (err: unknown) {
        console.warn('[AuthContext] Firebase auth subscription error:', err);
        setLoading(false);
      }
      return;
    }

    // 2. Supabase Provider Path (Default fallback)
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
      {children}
    </AuthContext.Provider>
  );
};
