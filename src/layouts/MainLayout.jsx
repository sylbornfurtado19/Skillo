import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import { motion, AnimatePresence } from 'framer-motion';
import PageTransition from '../components/common/PageTransition';

export default function MainLayout({ children }) {
  const location = useLocation();
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    setTransitioning(true);
    const timer = setTimeout(() => {
      setTransitioning(false);
    }, 700);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  return (
    <div className="relative min-h-screen flex flex-col bg-[#030712] overflow-x-hidden">
      {/* Page loading transition screen */}
      <AnimatePresence>
        {transitioning && <PageTransition />}
      </AnimatePresence>

      {/* Background radial highlights */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-secondary/5 blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] right-[10%] w-[35%] h-[35%] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />

      {/* Floating Navbar */}
      <Navbar />

      {/* Main page content area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-8 relative z-10">
        <motion.div
          key={location.pathname}
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

