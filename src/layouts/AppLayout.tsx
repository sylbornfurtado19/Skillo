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
  FaGithub,
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
    <div className="flex h-screen bg-[#030712] text-[#F9FAFB] overflow-hidden font-body">
      <ToastContainer />

      {/* 1. DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 bg-[#111827] border-r border-white/5 relative z-30">
        <div className="h-20 flex items-center px-6 border-b border-white/5">
          <Link href="/" className="hover:opacity-90 transition duration-200">
            <span className="font-heading font-extrabold text-xl text-white tracking-tight">Skillo</span>
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
                className={`relative flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition duration-250 ${
                  isActive
                    ? 'text-white font-bold'
                    : 'text-[#94A3B8] hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute inset-0 bg-primary/5 border-l-2 border-l-primary rounded-xl pointer-events-none shadow-[inset_4px_0_12px_-4px_rgba(99,102,241,0.15)]"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className={`text-base relative z-10 ${isActive ? 'text-primary' : 'text-[#94A3B8]'}`} />
                <span className="relative z-10">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5 bg-[#0f1522]">
          <Link href="/profile" className="flex items-center gap-3 mb-3 hover:opacity-80 transition cursor-pointer">
            <div className="relative h-10 w-10 rounded-full border border-white/10 overflow-hidden shrink-0 bg-primary/20 flex items-center justify-center">
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
                <span className="text-sm font-bold text-primary">{userInitial}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{userName}</p>
              <p className="text-[10px] text-[#94A3B8] truncate">{user?.email ?? 'candidate@skillo.ai'}</p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-white/5 bg-white/5 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/25 transition duration-250 text-xs font-medium cursor-pointer"
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
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed top-0 bottom-0 left-0 w-64 bg-[#111827] z-50 flex flex-col md:hidden"
            >
              <div className="h-20 flex items-center justify-between px-6 border-b border-white/5">
                <LogoFull />
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 hover:bg-white/10 text-[#94A3B8]"
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
                      className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition duration-250 ${
                        isActive
                          ? 'text-white bg-primary/10 border border-primary/25 font-bold shadow-lg shadow-primary/5'
                          : 'text-[#94A3B8] hover:text-white hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <Icon className={isActive ? 'text-primary' : 'text-[#94A3B8]'} />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-auto px-6 py-4 pb-20 border-t border-white/5">
                <a
                  href="https://github.com/sylbornfurtado19/Skillo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition duration-200 flex items-center gap-1.5 text-[#94A3B8]"
                >
                  <FaGithub />
                  <span>GitHub</span>
                </a>
              </div>

              <div className="p-4 border-t border-white/5 bg-[#0f1522]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative h-10 w-10 rounded-full border border-white/10 overflow-hidden shrink-0 bg-primary/20 flex items-center justify-center">
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
                      <span className="text-sm font-bold text-primary">{userInitial}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate">{userName}</p>
                    <p className="text-[10px] text-[#94A3B8] truncate text-ellipsis overflow-hidden">
                      {user?.email}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-white/5 bg-white/5 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/25 transition duration-250 text-xs font-medium cursor-pointer"
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
        <div className="absolute top-[-10%] left-[10%] w-[35%] h-[35%] rounded-full bg-primary/3 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[20%] right-[-10%] w-[30%] h-[30%] rounded-full bg-accent/3 blur-[120px] pointer-events-none" />

        <header className="h-20 border-b border-white/5 flex items-center justify-between px-6 bg-[#030712]/80 backdrop-blur-md relative z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden h-10 w-10 rounded-xl bg-[#111827] border border-white/8 flex items-center justify-center text-white cursor-pointer hover:bg-white/5"
            >
              <FaBars />
            </button>

            <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-[#94A3B8]">
              <span>Console</span>
              <FaChevronRight className="text-[10px] text-gray-600" />
              <span className="text-white font-semibold text-sm">{pageTitle}</span>
            </div>

            <div className="sm:hidden font-heading font-extrabold text-white text-base">
              {pageTitle}
            </div>
          </div>

          <div className="flex items-center gap-4 relative">
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="h-10 w-10 rounded-xl bg-[#111827] border border-white/8 hover:bg-white/5 hover:border-white/12 flex items-center justify-center text-[#94A3B8] hover:text-white transition duration-200 cursor-pointer relative"
              >
                <FaBell />
                <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-primary border-2 border-[#111827]" />
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
                      className="absolute right-0 mt-2 w-80 rounded-2xl bg-[#111827] border border-white/8 shadow-2xl p-4 z-40 space-y-3"
                    >
                      <div className="flex justify-between items-center pb-2 border-b border-white/5">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          Notifications
                        </span>
                        <span className="text-[10px] text-primary cursor-pointer hover:underline">
                          Mark as read
                        </span>
                      </div>
                      <div className="space-y-2">
                        {mockNotifications.map((notif) => (
                          <div
                            key={notif.id}
                            className="text-xs bg-white/3 rounded-xl p-2.5 border border-white/5 hover:bg-white/5 transition"
                          >
                            <p className="text-gray-200 leading-normal mb-1">{notif.text}</p>
                            <span className="text-[9px] text-gray-500 font-mono">{notif.time}</span>
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
              className="relative h-10 w-10 rounded-full border border-white/10 overflow-hidden cursor-pointer hover:scale-105 active:scale-95 transition duration-200 bg-primary/20 flex items-center justify-center"
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
                <span className="text-sm font-bold text-primary">{userInitial}</span>
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
