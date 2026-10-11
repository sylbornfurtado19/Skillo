'use client';

import React, { useState } from 'react';
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
  FaChevronRight,
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

  const currentItem = navigationItems.find((item) => pathname.startsWith(item.path));
  const pageTitle = currentItem ? currentItem.name : 'Product Workspace';

  const mockNotifications = [
    { id: 1, text: "Resume 'alex_frontend_lead.pdf' match index is 84%", time: '10m ago' },
    { id: 2, text: 'Your assessment report for Technical - Senior is ready', time: '2h ago' },
  ];

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

  return (
    <div className="flex h-screen bg-[var(--bg-page)] text-[var(--text-primary)] overflow-hidden font-body transition-colors duration-300">
      <ToastContainer />

      {/* 1. DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 bg-[var(--bg-surface)] border-r border-[var(--border)] relative z-30 transition-colors duration-300">
        <div className="h-20 flex items-center px-6 border-b border-[var(--border)]">
          <Link href="/" className="hover:opacity-90 transition duration-200">
            <span className="font-heading font-extrabold text-xl text-[var(--primary)] tracking-tight">Skillo</span>
          </Link>
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
                <Icon className={`text-base relative z-10 ${isActive ? 'text-[var(--primary)]' : 'text-[var(--text-secondary)]'}`} />
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
                  alt="Avatar"
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
              <p className="text-[10px] text-[var(--text-secondary)] truncate">{user?.email ?? 'candidate@skillo.ai'}</p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] hover:border-[var(--danger)]/30 transition duration-200 text-xs font-medium text-[var(--text-secondary)] cursor-pointer"
          >
            <FaSignOutAlt />
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
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed top-0 bottom-0 left-0 w-64 bg-[var(--bg-surface)] border-r border-[var(--border)] shadow-[var(--shadow)] z-50 flex flex-col md:hidden"
            >
              <div className="h-20 flex items-center justify-between px-6 border-b border-[var(--border)]">
                <LogoFull />
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="h-8 w-8 rounded-lg bg-[var(--bg-surface-alt)] flex items-center justify-center border border-[var(--border)] hover:bg-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <FaTimes />
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
                      <Icon className={isActive ? 'text-[var(--primary)]' : 'text-[var(--text-secondary)]'} />
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
                        alt="Avatar"
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
                    <p className="text-[10px] text-[var(--text-secondary)] truncate text-ellipsis overflow-hidden">
                      {user?.email}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] hover:border-[var(--danger)]/30 transition duration-200 text-xs font-medium text-[var(--text-secondary)] cursor-pointer"
                >
                  <FaSignOutAlt />
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
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden h-10 w-10 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)] flex items-center justify-center text-[var(--text-primary)] cursor-pointer hover:bg-[var(--border)]"
            >
              <FaBars />
            </button>

            <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
              <span>Console</span>
              <FaChevronRight className="text-[10px] text-[var(--text-secondary)]" />
              <span className="text-[var(--text-primary)] font-semibold text-sm">{pageTitle}</span>
            </div>

            <div className="sm:hidden font-heading font-extrabold text-[var(--text-primary)] text-base">
              {pageTitle}
            </div>
          </div>

          <div className="flex items-center gap-4 relative">
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="h-10 w-10 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)] hover:border-[var(--primary)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--primary)] transition duration-200 cursor-pointer relative"
              >
                <FaBell />
                <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-[var(--primary)] border-2 border-[var(--bg-surface)]" />
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
                      className="absolute right-0 mt-2 w-80 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-[var(--shadow)] p-4 z-40 space-y-3"
                    >
                      <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
                        <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                          Notifications
                        </span>
                        <span className="text-[10px] text-[var(--primary)] cursor-pointer hover:underline">
                          Mark as read
                        </span>
                      </div>
                      <div className="space-y-2">
                        {mockNotifications.map((notif) => (
                          <div
                            key={notif.id}
                            className="text-xs bg-[var(--bg-surface-alt)] rounded-xl p-2.5 border border-[var(--border)] transition"
                          >
                            <p className="text-[var(--text-primary)] leading-normal mb-1">{notif.text}</p>
                            <span className="text-[9px] text-[var(--text-secondary)] font-mono">{notif.time}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div
              onClick={() => router.push('/profile')}
              className="relative h-10 w-10 rounded-full border border-[var(--border)] overflow-hidden cursor-pointer hover:scale-105 active:scale-95 transition duration-200 bg-[var(--primary-soft)] flex items-center justify-center"
              title="View Profile"
            >
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt="User Avatar"
                  width={40}
                  height={40}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-sm font-bold text-[var(--primary)]">{userInitial}</span>
              )}
            </div>

          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8 relative">
          <AnimatePresence mode="wait">
            <PageTransition key={pathname}>{children}</PageTransition>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
