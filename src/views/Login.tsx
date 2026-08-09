'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FaEnvelope, FaLock, FaArrowRight, FaSpinner } from 'react-icons/fa';
import { useAuth } from '../hooks/useAuth';
import { LogoIcon } from '../components/common/Logo';

export default function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signUp, signInWithGoogle } = useAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoggingIn, setGoogleLoggingIn] = useState(false);

  const from = searchParams.get('from') ?? '/dashboard';

  const handleTraditionalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (activeTab === 'signup' && !name) return;

    setSubmitting(true);
    try {
      const res =
        activeTab === 'signup'
          ? await signUp({ email, password, name })
          : await signIn({ email, password });

      if (res.error) {
        const errObj = res.error as { message?: string };
        alert(`Authentication Error: ${errObj.message ?? 'Sign in failed'}`);
      } else {
        router.replace(from);
      }
    } catch (error: unknown) {
      console.error('Auth error:', error);
      const errObj = error as { message?: string };
      alert(`Authentication error: ${errObj.message ?? 'An unknown error occurred'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSuccess = async () => {
    setGoogleLoggingIn(true);
    try {
      const res = await signInWithGoogle();
      if (res.error) {
        const errObj = res.error as { message?: string };
        alert(`Google Auth Error: ${errObj.message ?? 'OAuth failed'}`);
      } else if (res.data && typeof res.data === 'object' && 'url' in res.data && typeof res.data.url === 'string') {
        window.location.href = res.data.url;
      } else {
        router.replace(from);
      }
    } catch (error: unknown) {
      console.error('Auth error:', error);
      const errObj = error as { message?: string };
      alert(`Google authentication error: ${errObj.message ?? 'An unknown error occurred'}`);
    } finally {
      setGoogleLoggingIn(false);
    }
  };

  return (
    <div className="relative min-h-[580px] flex items-center justify-center py-6">
      <div className="absolute w-[350px] h-[350px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

      <AnimatePresence>
        {googleLoggingIn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="glass-card rounded-2xl p-6 border border-white/10 max-w-sm w-full text-center space-y-5 shadow-2xl"
            >
              <div className="flex items-center justify-center gap-2.5">
                <svg width="22" height="22" viewBox="0 0 18 18" className="shrink-0">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.173 0 7.548 0 9s.347 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.806 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                <span className="font-heading font-bold text-white text-sm">Sign in with Google</span>
              </div>

              <div className="py-4 space-y-3">
                <div className="h-10 w-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin mx-auto" />
                <p className="text-xs text-gray-400 font-mono">Connecting to accounts.google.com...</p>
              </div>

              <p className="text-[10px] text-gray-500 leading-normal">
                Skillo will securely extract your public email address and name to build your profile database.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-card rounded-2xl p-8 border border-white/5 w-full max-w-md glow-primary relative overflow-hidden"
      >
        <div className="flex flex-col items-center text-center space-y-2 mb-8">
          <LogoIcon size={46} />
          <h2 className="text-xl font-heading font-extrabold text-white mt-3">
            {activeTab === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-xs text-gray-400">Practice, analyze, and improve your technical scope.</p>
        </div>

        <div className="bg-[#030712] p-1 rounded-xl border border-white/5 flex gap-1 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition duration-200 cursor-pointer ${
              activeTab === 'login' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('signup')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition duration-200 cursor-pointer ${
              activeTab === 'signup' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:text-white'
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleTraditionalSubmit} className="space-y-4">
          {activeTab === 'signup' && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Full Name</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Mercer"
                  className="w-full rounded-xl bg-background border border-white/10 pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50 transition duration-200"
                />
                <FaEnvelope className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Email Address</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full rounded-xl bg-background border border-white/10 pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50 transition duration-200"
              />
              <FaEnvelope className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Password</label>
              {activeTab === 'login' && (
                <a href="#" className="text-[10px] text-primary hover:text-accent font-semibold">
                  Forgot?
                </a>
              )}
            </div>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl bg-background border border-white/10 pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50 transition duration-200"
              />
              <FaLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary-dark font-bold text-sm text-white shadow-lg shadow-primary/10 transition duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <FaSpinner className="animate-spin text-sm" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>{activeTab === 'login' ? 'Sign In' : 'Create Account'}</span>
                <FaArrowRight className="text-xs" />
              </>
            )}
          </button>
        </form>

        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-white/5" />
          </div>
          <span className="relative bg-[#111827] px-3.5 text-[9px] font-bold text-gray-500 uppercase tracking-wider">
            or continue with
          </span>
        </div>

        <div className="flex justify-center w-full mt-4">
          <button
            type="button"
            onClick={handleGoogleSuccess}
            className="w-full py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-medium text-xs flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Continue with Google</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
