'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import PageTransition from '../components/common/PageTransition';

export interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="relative min-h-screen flex flex-col bg-[var(--bg-page)] text-[var(--text-primary)] overflow-x-hidden transition-colors duration-300">
      {/* Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-text-on-primary focus:rounded-xl focus:shadow-soft focus:outline-none focus:ring-2 focus:ring-primary/40 font-semibold text-xs transition duration-200"
      >
        Skip to main content
      </a>

      {/* Floating Navbar */}
      <Navbar />

      {/* Main page content area */}
      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-8 relative z-10 outline-none">
        <PageTransition key={pathname}>
          {children}
        </PageTransition>
      </main>

      {/* Sticky footer */}
      <Footer />
    </div>
  );
}

