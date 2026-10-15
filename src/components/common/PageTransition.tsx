import React from 'react';
import { motion } from 'framer-motion';

export interface PageTransitionProps {
  children?: React.ReactNode;
  duration?: number;
}

export default function PageTransition({ children, duration = 0.2 }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration, ease: 'easeOut' }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
}

