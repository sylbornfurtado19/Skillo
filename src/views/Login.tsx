'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FaEnvelope, FaLock, FaArrowRight, FaSpinner, FaEye, FaEyeSlash } from 'react-icons/fa';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ui/Toast';
import { LogoFull } from '../components/common/Logo';
import Modal from '../components/ui/Modal';

export default function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoggingIn, setGoogleLoggingIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 3D Tilt state for Card
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  const from = searchParams.get('from') ?? '/dashboard';

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rX = ((y - centerY) / centerY) * -6;
    const rY = ((x - centerX) / centerX) * 6;

    setRotateX(rX);
    setRotateY(rY);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'bg-[var(--border)]' };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 2) return { score: 33, label: 'Weak', color: 'bg-[var(--danger)]' };
    if (score <= 4) return { score: 66, label: 'Medium', color: 'bg-[var(--warning)]' };
    return { score: 100, label: 'Strong', color: 'bg-[var(--success)]' };
  };

  const strength = getPasswordStrength(password);

  const handleTraditionalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (activeTab === 'signup' && !name) return;

    setErrorMessage(null);
    setSubmitting(true);
    try {
      const res =
        activeTab === 'signup'
          ? await signUp({ email, password, name })
          : await signIn({ email, password });

      if (res.error) {
        const errObj = res.error as { message?: string };
        const msg = errObj.message ?? 'Authentication failed';
        setErrorMessage(msg);
        showToast(msg, 'error');
      } else {
        router.replace(from);
      }
    } catch (error: unknown) {
      console.error('Auth error:', error);
      const errObj = error as { message?: string };
      const msg = errObj.message ?? 'An unexpected authentication error occurred';
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSuccess = async () => {
    setErrorMessage(null);
    setGoogleLoggingIn(true);
    try {
      const res = await signInWithGoogle();
      if (res.error) {
        const errObj = res.error as { message?: string };
        const msg = errObj.message ?? 'Google authentication failed';
        setErrorMessage(msg);
        showToast(msg, 'error');
      } else if (res.data && typeof res.data === 'object' && 'url' in res.data && typeof res.data.url === 'string') {
        window.location.href = res.data.url;
      } else {
        router.replace(from);
      }
    } catch (error: unknown) {
      console.error('Auth error:', error);
      const errObj = error as { message?: string };
      const msg = errObj.message ?? 'Google authentication error';
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setGoogleLoggingIn(false);
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotSent(true);
  };

  return (
    <div className="relative min-h-[calc(100vh-9rem)] flex items-center justify-center px-4 py-8 overflow-hidden bg-[var(--bg-page)] text-[var(--text-primary)]">
      {/* Forgot Password Modal */}
      <Modal
        isOpen={forgotModalOpen}
        onClose={() => {
          setForgotModalOpen(false);
          setForgotSent(false);
        }}
        title="Reset Password"
        maxWidth="max-w-sm"
      >
        {forgotSent ? (
          <div className="space-y-3 py-2 text-center">
            <div className="h-10 w-10 rounded-full bg-[var(--success)]/20 text-[var(--success)] border border-[var(--success)]/30 flex items-center justify-center mx-auto text-lg">
              <span aria-hidden="true">✓</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Reset instructions sent to <strong className="text-[var(--text-primary)]">{forgotEmail}</strong>. Please check your inbox.
            </p>
            <button
              type="button"
              onClick={() => {
                setForgotModalOpen(false);
                setForgotSent(false);
              }}
              className="w-full py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:bg-[var(--primary-active)] text-xs font-semibold text-[var(--text-on-primary)] mt-2 shadow-[var(--shadow)]"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Enter the email address tied to your account and we&apos;ll send you a password reset link.
            </p>

            <div className="space-y-1.5">
              <label htmlFor="forgot-email" className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
                Email Address
              </label>
              <div className="relative">
                <input
                  id="forgot-email"
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] pl-10 pr-4 py-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] focus:ring-[3px] focus:ring-[var(--primary)]/25"
                />
                <FaEnvelope aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--secondary)] text-xs" />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:bg-[var(--primary-active)] font-semibold text-xs text-[var(--text-on-primary)] shadow-[var(--shadow)]"
            >
              Send Reset Instructions
            </button>
          </form>
        )}
      </Modal>

      {/* Google Overlay Loader */}
      <AnimatePresence>
        {googleLoggingIn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="rounded-2xl p-6 border border-[var(--border)] bg-[var(--bg-surface)] max-w-sm w-full text-center space-y-5 shadow-[var(--shadow)]"
            >
              <div className="flex items-center justify-center gap-2.5">
                <svg width="22" height="22" viewBox="0 0 18 18" className="shrink-0">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.173 0 7.548 0 9s.347 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.806 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                <span className="font-heading font-bold text-[var(--text-primary)] text-sm">Sign in with Google</span>
              </div>

              <div className="py-4 space-y-3">
                <div className="h-10 w-10 rounded-full border-2 border-[var(--primary)]/20 border-t-[var(--primary)] animate-spin mx-auto" />
                <p className="text-xs text-[var(--text-secondary)] font-mono">Connecting to accounts.google.com...</p>
              </div>

              <p className="text-xs text-[var(--text-secondary)] leading-normal">
                Skillo will securely extract your public email address and name to build your profile database.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Card Container */}
      <motion.div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
        initial={{ opacity: 0, scale: 0.95, y: 25 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-md rounded-2xl bg-[var(--bg-surface)] p-8 border border-[var(--border)] shadow-[var(--shadow)] transition-transform duration-200 ease-out"
      >
        <div className="flex flex-col items-center text-center space-y-3 mb-7">
          <LogoFull iconSize={42} showTagline={true} />
          <h2 className="text-lg font-heading font-bold text-[var(--text-primary)] pt-2">
            {activeTab === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">Practice, analyze, and improve your technical scope.</p>
        </div>

        {/* Sign In / Sign Up Tabs */}
        <div className="bg-[var(--bg-surface-alt)] p-1 rounded-xl border border-[var(--border)] flex gap-1 mb-6 shadow-inner">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              activeTab === 'login'
                ? 'bg-[var(--primary)] text-[var(--text-on-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('signup');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              activeTab === 'signup'
                ? 'bg-[var(--primary)] text-[var(--text-on-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleTraditionalSubmit} className="space-y-4">
          {activeTab === 'signup' && (
            <div className="space-y-1.5 text-left">
              <label htmlFor="login-name" className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
                Full Name
              </label>
              <div className="relative">
                <input
                  id="login-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Mercer"
                  aria-invalid={!!errorMessage}
                  aria-describedby={errorMessage ? 'login-error-msg' : undefined}
                  className="w-full rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] pl-10 pr-4 py-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/60 focus:outline-none focus:border-[var(--primary)] focus:ring-[3px] focus:ring-[var(--primary)]/25 transition duration-200"
                />
                <FaEnvelope aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--secondary)] text-xs" />
              </div>
            </div>
          )}

          <div className="space-y-1.5 text-left">
            <label htmlFor="login-email" className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
              Email Address
            </label>
            <div className="relative">
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                aria-invalid={!!errorMessage}
                aria-describedby={errorMessage ? 'login-error-msg' : undefined}
                className="w-full rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] pl-10 pr-4 py-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/60 focus:outline-none focus:border-[var(--primary)] focus:ring-[3px] focus:ring-[var(--primary)]/25 transition duration-200"
              />
              <FaEnvelope aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--secondary)] text-xs" />
            </div>
          </div>

          <div className="space-y-1.5 text-left">
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
                Password
              </label>
              {activeTab === 'login' && (
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotModalOpen(true);
                  }}
                  className="text-xs text-[var(--primary)] hover:text-[var(--primary-hover)] font-semibold transition duration-150 cursor-pointer"
                >
                  Forgot?
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                aria-invalid={!!errorMessage}
                aria-describedby={errorMessage ? 'login-error-msg' : undefined}
                className="w-full rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] pl-10 pr-10 py-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/60 focus:outline-none focus:border-[var(--primary)] focus:ring-[3px] focus:ring-[var(--primary)]/25 transition duration-200"
              />
              <FaLock aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--secondary)] text-xs" />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition duration-150 cursor-pointer"
                aria-label={showPassword ? 'Hide Password' : 'Show Password'}
              >
                {showPassword ? <FaEyeSlash aria-hidden="true" size={13} /> : <FaEye aria-hidden="true" size={13} />}
              </button>
            </div>

            {/* Password Strength Meter on Sign Up */}
            {activeTab === 'signup' && password.length > 0 && (
              <div className="space-y-1 pt-1">
                <div className="h-1.5 w-full bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-full overflow-hidden flex">
                  <div
                    className={`h-full ${strength.color} transition-all duration-300 rounded-full`}
                    style={{ width: `${strength.score}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-xs font-mono text-[var(--text-secondary)]">
                  <span>Strength: <strong className="text-[var(--text-primary)]">{strength.label}</strong></span>
                  <span>{password.length} chars</span>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:bg-[var(--primary-active)] font-bold text-xs text-[var(--text-on-primary)] shadow-[var(--shadow)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <FaSpinner aria-hidden="true" className="animate-spin text-xs" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>{activeTab === 'login' ? 'Sign In' : 'Create Account'}</span>
                <FaArrowRight aria-hidden="true" className="text-xs" />
              </>
            )}
          </button>

          {/* Inline Error Message */}
          {errorMessage && (
            <motion.div
              id="login-error-msg"
              role="alert"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] text-xs text-left flex items-start gap-2"
            >
              <span aria-hidden="true" className="font-bold mt-0.5">⚠</span>
              <span className="leading-relaxed">{errorMessage}</span>
            </motion.div>
          )}
        </form>

        <div className="relative my-5 text-center">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[var(--border)]" />
          </div>
          <span className="relative bg-[var(--bg-surface)] px-3 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            or continue with
          </span>
        </div>

        {/* OAuth Buttons */}
        <div className="w-full">
          <button
            type="button"
            onClick={handleGoogleSuccess}
            className="w-full py-2.5 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)] hover:border-[var(--secondary)] text-[var(--text-primary)] font-medium text-xs flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Google</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
