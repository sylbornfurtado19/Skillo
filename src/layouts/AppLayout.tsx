'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaHome,
  FaFileAlt,
  FaSlidersH,
  FaChartLine,
  FaCog,
  FaSignOutAlt,
  FaBars,
  FaTimes,
  FaBell,
  FaUserTie,
  FaFlask,
} from 'react-icons/fa';
import { useAuth } from '../hooks/useAuth';
import { useInterview } from '../context/InterviewContext';
import { LogoFull } from '../components/common/Logo';
import { ToastContainer } from '../components/ui/Toast';
import PageTransition from '../components/common/PageTransition';

export interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { resetSession } = useInterview();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const mobileDrawerRef = useRef<HTMLElement>(null);
  const previousMenuTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMobileMenuOpen(false);
        previousMenuTriggerRef.current?.focus();
        return;
      }

      if (e.key === 'Tab' && mobileDrawerRef.current) {
        const focusables = Array.from(
          mobileDrawerRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !mobileDrawerRef.current.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !mobileDrawerRef.current.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const navigationItems = [
    { name: 'Dashboard', path: '/dashboard', icon: FaHome },
    { name: 'Resume', path: '/resume', icon: FaFileAlt },
    { name: 'Career Setup', path: '/setup', icon: FaSlidersH },
    { name: 'Interview', path: '/interview', icon: FaUserTie },
    { name: 'IVP Lab', path: '/ivp-lab', icon: FaFlask },
    { name: 'Results', path: '/results', icon: FaChartLine },
    { name: 'Settings', path: '/settings', icon: FaCog },
  ];

  const handleLogout = async () => {
    await signOut();
    resetSession();
    router.push('/');
  };

  const ROUTE_INFO: Record<string, { title: string; subtitle: string }> = {
    '/dashboard': {
      title: 'Dashboard',
      subtitle: 'Overview of your interview performance, skill mastery, and readiness.',
    },
    '/resume': {
      title: 'Resume Analysis',
      subtitle: 'Inspect ATS match scores, identified keywords, and gap remediation.',
    },
    '/setup': {
      title: 'Career Setup',
      subtitle: 'Configure your target domain, role seniority, and interview assessor.',
    },
    '/interview': {
      title: 'Interview Studio',
      subtitle: 'Live simulation with real-time feedback, speech transcription, and vision tracking.',
    },
    '/ivp-lab': {
      title: 'IVP Telemetry Lab',
      subtitle: 'Real-time edge neural diagnostics for gaze, posture, and facial composure.',
    },
    '/results': {
      title: 'Assessment Results',
      subtitle: 'In-depth rubric grading, Prometheus-2 confidence, and actionable feedback.',
    },
    '/settings': {
      title: 'Settings',
      subtitle: 'Manage account profile, audio voice synthesis, and interface preferences.',
    },
    '/profile': {
      title: 'Candidate Profile',
      subtitle: 'Review your verified track record and episodic skill memory graph.',
    },
  };

  const matchedRoute = Object.keys(ROUTE_INFO).find((route) => pathname.startsWith(route));
  const pageInfo = matchedRoute
    ? ROUTE_INFO[matchedRoute]
    : { title: 'Product Workspace', subtitle: 'Practice and refine your professional interview skills.' };
  

  const isExamMode = pathname.startsWith('/interview');

  // Exam-mode navigation deterrence (D17)
  useEffect(() => {
    if (!isExamMode || typeof window === 'undefined') return;
    const handlePopState = () => {
      const confirmLeave = window.confirm(
        'Warning: An assessed interview is in progress. Leaving will pause your session and be logged as an integrity violation. Are you sure you want to exit?'
      );
      if (!confirmLeave) {
        window.history.pushState(null, '', window.location.href);
      }
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isExamMode]);

  const avatarUrl =
    (user?.user_metadata?.avatar_url as string | undefined) ??
    (user?.user_metadata?.picture as string | undefined) ??
    null;
  const userName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split('@')[0] ??
    'Candidate';
  const userInitial = userName.charAt(0).toUpperCase();

  // Focused proctored exam viewport with no sidebar/nav distractions
  if (isExamMode) {
    return (
      <div className="flex h-screen bg-[var(--bg-page)] text-[var(--text-primary)] overflow-hidden font-body transition-colors duration-300">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-text-on-primary focus:rounded-xl focus:shadow-soft font-semibold text-xs transition duration-200"
        >
          Skip to main content
        </a>
        <ToastContainer />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto w-full relative outline-none">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[var(--bg-page)] text-[var(--text-primary)] overflow-hidden font-body transition-colors duration-300">
      {/* Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-text-on-primary focus:rounded-xl focus:shadow-soft focus:outline-none focus:ring-2 focus:ring-primary/40 font-semibold text-xs transition duration-200"
      >
        Skip to main content
      </a>

      <ToastContainer />

      {/* 1. DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 bg-[var(--bg-surface)] border-r border-[var(--border)] relative z-30 transition-colors duration-300">
        <div className="h-20 flex items-center px-6 border-b border-[var(--border)]">
          <LogoFull />
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navigationItems.map((item) => {
            const isActive = pathname.startsWith(item.path);
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                href={item.path}
                className={`relative flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition duration-200 ${
                  isActive
                    ? 'text-[var(--primary)] font-bold bg-[var(--primary-soft)] border-l-2 border-l-[var(--primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--bg-surface-alt)] border border-transparent'
                }`}
              >
                <Icon aria-hidden="true" className={`text-base relative z-10 ${isActive ? 'text-[var(--primary)]' : 'text-[var(--text-secondary)]'}`} />
                <span className="relative z-10">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-surface-alt)]">
          <Link href="/profile" className="flex items-center gap-3 mb-3 hover:opacity-85 transition cursor-pointer">
            <div className="relative h-10 w-10 rounded-full border border-[var(--border)] overflow-hidden shrink-0 bg-[var(--primary-soft)] flex items-center justify-center">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={userName}
                  width={40}
                  height={40}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-sm font-bold text-[var(--primary)]">{userInitial}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{userName}</p>
              <p className="text-xs text-[var(--text-secondary)] truncate">{user?.email ?? 'candidate@skillo.ai'}</p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] hover:border-[var(--danger)]/30 transition duration-200 text-xs font-medium text-[var(--text-secondary)] cursor-pointer"
          >
            <FaSignOutAlt aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>


      {/* 2. MOBILE MENU DRAWER OVERLAY */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setMobileMenuOpen(false);
                previousMenuTriggerRef.current?.focus();
              }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.aside
              ref={mobileDrawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Mobile Navigation Menu"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed top-0 bottom-0 left-0 w-64 bg-[var(--bg-surface)] border-r border-[var(--border)] shadow-[var(--shadow)] z-50 flex flex-col md:hidden"
            >
              <div className="h-20 flex items-center justify-between px-6 border-b border-[var(--border)]">
                <LogoFull />
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    previousMenuTriggerRef.current?.focus();
                  }}
                  aria-label="Close navigation menu"
                  className="h-8 w-8 rounded-lg bg-[var(--bg-surface-alt)] flex items-center justify-center border border-[var(--border)] hover:bg-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <FaTimes aria-hidden="true" />
                </button>
              </div>

              <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
                {navigationItems.map((item) => {
                  const isActive = pathname.startsWith(item.path);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition duration-200 ${
                        isActive
                          ? 'text-[var(--primary)] bg-[var(--primary-soft)] border-l-2 border-l-[var(--primary)] font-bold shadow-sm'
                          : 'text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--bg-surface-alt)] border border-transparent'
                      }`}
                    >
                      <Icon aria-hidden="true" className={isActive ? 'text-[var(--primary)]' : 'text-[var(--text-secondary)]'} />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-surface-alt)]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative h-10 w-10 rounded-full border border-[var(--border)] overflow-hidden shrink-0 bg-[var(--primary-soft)] flex items-center justify-center">
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt={userName}
                        width={40}
                        height={40}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-bold text-[var(--primary)]">{userInitial}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{userName}</p>
                    <p className="text-xs text-[var(--text-secondary)] truncate text-ellipsis overflow-hidden">
                      {user?.email}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] hover:border-[var(--danger)]/30 transition duration-200 text-xs font-medium text-[var(--text-secondary)] cursor-pointer"
                >
                  <FaSignOutAlt aria-hidden="true" />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* 3. MAIN WORKSPACE VIEWPORT */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        <header className="h-20 border-b border-[var(--border)] flex items-center justify-between px-6 bg-[var(--bg-surface)] shadow-[var(--shadow)] relative z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={(e) => {
                previousMenuTriggerRef.current = e.currentTarget;
                setMobileMenuOpen(true);
              }}
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
              className="md:hidden h-10 w-10 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)] flex items-center justify-center text-[var(--text-primary)] cursor-pointer hover:bg-[var(--border)]"
            >
              <FaBars aria-hidden="true" />
            </button>

            <div className="flex flex-col justify-center text-left">
              <h1 className="font-heading font-extrabold text-base sm:text-lg text-[var(--text-primary)] leading-tight">
                {pageInfo.title}
              </h1>
              <p className="hidden sm:block text-xs text-[var(--text-secondary)] truncate max-w-md lg:max-w-xl">
                {pageInfo.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 relative">
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="h-10 w-10 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)] hover:border-[var(--primary)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--primary)] transition duration-200 cursor-pointer relative"
                aria-label="View notifications"
                aria-expanded={notificationsOpen}
              >
                <FaBell aria-hidden="true" />
              </button>

              <AnimatePresence>
                {notificationsOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setNotificationsOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 15, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 15, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 mt-2 w-72 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-[var(--shadow)] p-4 z-40 space-y-3"
                    >
                      <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
                        <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                          Notifications
                        </span>
                      </div>
                      <div className="py-6 text-center space-y-1">
                        <p className="text-xs font-semibold text-[var(--text-primary)]">No notifications yet</p>
                        <p className="text-xs text-[var(--text-secondary)]">You&apos;re all caught up with your assessments.</p>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <Link
              href="/profile"
              aria-label={`View profile for ${userName}`}
              className="relative h-10 w-10 rounded-full border border-[var(--border)] overflow-hidden cursor-pointer hover:scale-105 active:scale-95 transition duration-200 bg-[var(--primary-soft)] flex items-center justify-center"
              title="View Profile"
            >
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={userName}
                  width={40}
                  height={40}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-sm font-bold text-[var(--primary)]">{userInitial}</span>
              )}
            </Link>

          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-6 md:p-8 relative outline-none">
          <AnimatePresence mode="wait">
            <PageTransition key={pathname}>{children}</PageTransition>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
