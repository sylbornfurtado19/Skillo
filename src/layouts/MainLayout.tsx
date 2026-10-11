'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import { motion, AnimatePresence } from 'framer-motion';
import PageTransition from '../components/common/PageTransition';

export interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    setTransitioning(true);
    const timer = setTimeout(() => {
      setTransitioning(false);
    }, 700);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <div className="relative min-h-screen flex flex-col bg-[var(--bg-page)] text-[var(--text-primary)] overflow-x-hidden transition-colors duration-300">
      {/* Page loading transition screen */}
      <AnimatePresence>
        {transitioning && <PageTransition />}
      </AnimatePresence>

      {/* Floating Navbar */}
      <Navbar />

      {/* Main page content area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-8 relative z-10">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>

      {/* Sticky footer */}
      <Footer />
    </div>
  );
}
