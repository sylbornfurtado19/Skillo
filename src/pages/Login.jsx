import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaEnvelope, FaLock, FaArrowRight, FaSpinner } from 'react-icons/fa';
import { GoogleLogin } from '@react-oauth/google';
import { useInterview } from '../context/InterviewContext';
import { LogoIcon } from '../components/common/Logo';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginMock } = useInterview();

  // Local state
  const [activeTab, setActiveTab] = useState('login'); // login, signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoggingIn, setGoogleLoggingIn] = useState(false);

  // Where to redirect after login (default to /app/dashboard)
  const from = location.state?.from?.pathname || '/app/dashboard';

  const handleTraditionalSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    if (activeTab === 'signup' && !name) return;

    setSubmitting(true);
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const endpoint = activeTab === 'signup' ? '/api/auth/register' : '/api/auth/login';
      const body = activeTab === 'signup' 
        ? { email, password, name } 
        : { email, password };
      
      const res = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        const data = await res.json();
        // Fallback to loginMock for context update
        loginMock(data.user);
        navigate(from, { replace: true });
      } else {
        const errorData = await res.json();
        alert(`Authentication failed: ${errorData.detail || 'Please try again.'}`);
      }
    } catch (error) {
      console.error("Auth error:", error);
      alert(`Network error: Could not connect to the server. Please check your connection or CORS settings. Details: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setGoogleLoggingIn(true);
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credential: credentialResponse.credential })
      });
      if (res.ok) {
        const data = await res.json();
        // Fallback to loginMock for now until context is updated, but pass real data
        loginMock(data.user); 
        navigate(from, { replace: true });
      } else {
        alert("Google authentication failed. Please try again.");
      }
    } catch (error) {
      console.error("Auth error:", error);
      alert(`Network error during Google Sign-In: Could not connect to the server. Please check your connection or CORS settings. Details: ${error.message}`);
    } finally {
      setGoogleLoggingIn(false);
    }
  };

  return (
    <div className="relative min-h-[580px] flex items-center justify-center py-6">
      {/* Background radial highlight */}
      <div className="absolute w-[350px] h-[350px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      
      {/* Authenticator Pop-up Simulation */}
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
                <p className="text-xs text-gray-400 font-mono">
                  Connecting to accounts.google.com...
                </p>
              </div>

              <p className="text-[10px] text-gray-500 leading-normal">
                InterviewIQ will securely extract your public email address and name to build your profile database.
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
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2 mb-8">
          <LogoIcon size={46} />
          <h2 className="text-xl font-heading font-extrabold text-white mt-3">
            {activeTab === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-xs text-gray-400">
            Practice, analyze, and improve your technical scope.
          </p>
        </div>

        {/* Tab switchers */}
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

        {/* Auth form */}
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
                placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                className="w-full rounded-xl bg-background border border-white/10 pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50 transition duration-200"
              />
              <FaLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
            </div>
          </div>

          {/* Sign In CTA */}
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

        {/* Separator */}
        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-white/5" />
          </div>
          <span className="relative bg-[#111827] px-3.5 text-[9px] font-bold text-gray-500 uppercase tracking-wider">
            or continue with
          </span>
        </div>

        {/* Google OAuth component */}
        <div className="flex justify-center w-full mt-4">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => {
              console.log('Login Failed');
            }}
            theme="filled_black"
            size="large"
            text="continue_with"
            width="100%"
          />
        </div>
      </motion.div>
    </div>
  );
}
