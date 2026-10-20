'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { subscribeToAuthState } from '../lib/firebase/services/auth.firebase';
import * as authService from '../services/auth';
import type { ServiceResponse } from '../types/index';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AuthContextValue {
  user: User | any | null;
  session: { user: User | any; access_token?: string } | any | null;
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
  const [session, setSession] = useState<{ user: any; access_token?: string } | null>(null);
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
        uid: 'test-candidate-id',
        email: 'candidate@skillo.ai',
        user_metadata: { name: 'Test Candidate' },
        displayName: 'Test Candidate',
      };
      setUser(mockUser);
      setSession({ user: mockUser, access_token: 'test-token' });
      setLoading(false);
      return;
    }

    // 1. Firebase Provider Path
    try {
      const unsubscribe = subscribeToAuthState((firebaseUser) => {
        setUser(firebaseUser);
        setSession(firebaseUser ? { user: firebaseUser } : null);
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (err: unknown) {
      console.warn('[AuthContext] Firebase auth subscription notice:', err);
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

