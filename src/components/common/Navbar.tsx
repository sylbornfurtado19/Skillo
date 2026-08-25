'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FaBars, FaTimes, FaUser, FaSignOutAlt, FaRocket, FaPalette } from 'react-icons/fa';
import { LogoFull } from './Logo';
import { useAuth } from '../../hooks/useAuth';
import { useInterview } from '../../context/InterviewContext';
import { THEME_PRESETS, ThemeId } from '../../types/themes';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, signOut } = useAuth();
  const { resetSession, theme, setTheme } = useInterview();

  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on path change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const links = [
    { name: 'Features', href: '#features' },
    { name: 'Domains', href: '#domains' },
    { name: 'How It Works', href: '#how-it-works' },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    setMobileMenuOpen(false);
    if (pathname === '/') {
      e.preventDefault();
      const targetId = href.substring(1);
      const element = document.getElementById(targetId);
      if (element) {
        const yOffset = -100;
        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    } else {
      e.preventDefault();
      router.push(`/${href}`);
    }
  };

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    await signOut();
    resetSession();
    router.push('/');
  };

  const avatarUrl =
    (user?.user_metadata?.avatar_url as string | undefined) ??
    (user?.user_metadata?.picture as string | undefined) ??
    null;

  const userName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email ??
    'User';

  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <header className="fixed top-4 inset-x-0 z-50 w-full px-4 pointer-events-none">
      <nav
        className={`mx-auto max-w-7xl h-16 rounded-2xl transition-all duration-300 px-5 sm:px-6 flex items-center justify-between pointer-events-auto relative ${
          scrolled
            ? 'bg-card/90 backdrop-blur-xl border border-primary/30 shadow-[0_10px_30px_rgba(0,0,0,0.8)]'
            : 'bg-card/75 backdrop-blur-lg border border-white/10 shadow-2xl shadow-black/80'
        }`}
      >
        <div className="flex items-center gap-6 lg:gap-10">
          <Link href="/" className="hover:scale-102 active:scale-98 transition duration-200 shrink-0">
            <LogoFull iconSize={32} showTagline={false} />
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-7">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className="text-xs font-semibold text-gray-300 hover:text-white hover:scale-105 transition-all duration-200 relative group"
              >
                {link.name}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-accent group-hover:w-full transition-all duration-300 rounded-full" />
              </a>
            ))}
          </div>

        </div>

        {/* Desktop CTA / Auth actions */}
        <div className="hidden md:flex items-center gap-3 ml-auto">
          {/* Theme Quick Cycle Button */}
          <button
            onClick={() => {
              const currentTheme: ThemeId = (theme in THEME_PRESETS ? theme : 'onyx') as ThemeId;
              const themeKeys: ThemeId[] = ['onyx', 'cyberpunk', 'slate'];
              const nextIndex = (themeKeys.indexOf(currentTheme) + 1) % themeKeys.length;
              setTheme(themeKeys[nextIndex]);
            }}
            className="h-9 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-primary/30 hover:border-primary/60 text-xs font-semibold text-white transition-all flex items-center gap-2 cursor-pointer shadow-md hover:scale-105 active:scale-95"
            title={`Current Theme: ${THEME_PRESETS[(theme in THEME_PRESETS ? theme : 'onyx') as ThemeId]?.name || 'Onyx Glass'}. Click to toggle.`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full animate-pulse shadow-sm"
              style={{
                backgroundColor:
                  THEME_PRESETS[(theme in THEME_PRESETS ? theme : 'onyx') as ThemeId]?.primaryHex || '#6366F1',
              }}
            />
            <FaPalette className="text-primary text-xs" />
            <span className="capitalize text-[11px] font-mono font-bold text-gray-200">
              {THEME_PRESETS[(theme in THEME_PRESETS ? theme : 'onyx') as ThemeId]?.name || 'Onyx Glass'}
            </span>
          </button>

          <button
            onClick={() => router.push('/dashboard')}
            className="h-9 px-4 rounded-xl bg-gradient-to-r from-primary via-indigo-500 to-accent text-xs font-semibold text-white shadow-lg shadow-primary/25 hover:shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer flex items-center gap-2 relative overflow-hidden group"
          >
            <span className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
            <FaRocket className="text-xs" />
            <span>Start Preparing</span>
          </button>

          {isAuthenticated ? (
            <>
              {/* User Google Profile Avatar Badge */}
              <Link
                href="/profile"
                className="relative group h-9 w-9 rounded-xl flex items-center justify-center p-[1px] bg-gradient-to-tr from-primary to-accent hover:shadow-lg hover:shadow-primary/30 transition-all duration-300 active:scale-95"
                title={`${userName} (Profile)`}
              >
                <div className="h-full w-full rounded-[11px] overflow-hidden bg-[#030712] p-[1.5px] relative flex items-center justify-center">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={userName}
                      width={36}
                      height={36}
                      unoptimized
                      className="h-full w-full rounded-[10px] object-cover group-hover:scale-105 transition duration-200"
                    />
                  ) : (
                    <div className="h-full w-full rounded-[10px] bg-primary/20 text-primary font-bold text-xs flex items-center justify-center">
                      {userInitial}
                    </div>
                  )}
                </div>
                <span className="absolute bottom-[-1.5px] right-[-1.5px] h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-[#030712] shadow-sm animate-pulse" />
              </Link>

              {/* Log Out button */}
              <button
                onClick={handleLogout}
                className="px-3 h-9 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/10 hover:scale-102 active:scale-98 transition duration-200 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <FaSignOutAlt size={12} />
                <span>Log Out</span>
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="px-4 h-9 rounded-xl border border-white/15 hover:border-white/30 bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-200 hover:text-white hover:scale-105 active:scale-95 transition-all duration-200 shadow-md flex items-center justify-center"
            >
              Sign In
            </Link>
          )}
        </div>

        {/* Mobile Hamburger Toggle Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition duration-200 cursor-pointer ml-auto"
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <FaTimes size={18} /> : <FaBars size={18} />}
        </button>
      </nav>

      {/* Mobile Dropdown Panel */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="mx-auto max-w-7xl mt-3 rounded-2xl bg-[#0b0f19]/95 backdrop-blur-2xl border border-white/15 p-5 shadow-2xl pointer-events-auto space-y-4 md:hidden"
          >
            <div className="flex flex-col space-y-3 pb-3 border-b border-white/10">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className="text-sm font-semibold text-gray-300 hover:text-white py-1.5 px-3 rounded-lg hover:bg-white/5 transition duration-150 flex items-center justify-between"
                >
                  <span>{link.name}</span>
                  <span className="text-xs text-primary font-mono">&rarr;</span>
                </a>
              ))}

            </div>

            <div className="flex flex-col gap-2.5 pt-1">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  router.push('/dashboard');
                }}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-primary via-indigo-500 to-accent text-xs font-bold text-white shadow-lg shadow-primary/25 flex items-center justify-center gap-2 active:scale-98 transition duration-200"
              >
                <FaRocket size={14} />
                <span>Start Preparing Now</span>
              </button>

              {isAuthenticated ? (
                <div className="flex items-center gap-2 pt-1">
                  <Link
                    href="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 h-10 rounded-xl bg-white/5 border border-white/10 px-3 flex items-center gap-2 text-xs text-gray-200 font-medium"
                  >
                    <FaUser className="text-primary" />
                    <span className="truncate">{userName}</span>
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="h-10 px-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-400 flex items-center gap-1.5"
                  >
                    <FaSignOutAlt size={12} />
                    <span>Logout</span>
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full h-10 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-200 flex items-center justify-center transition duration-200"
                >
                  Sign In
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
