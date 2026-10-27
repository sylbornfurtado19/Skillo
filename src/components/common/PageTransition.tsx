'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { Variants } from 'framer-motion';

export interface PageTransitionProps {
  children?: React.ReactNode;
  duration?: number;
  className?: string;
}

export interface PageVariants {
  initial: {
    opacity: number;
    y: number;
  };
  animate: {
    opacity: number;
    y: number;
    transition: {
      duration: number;
      ease: [number, number, number, number];
    };
  };
  exit: {
    opacity: number;
    y: number;
    pointerEvents: 'none';
    transition: {
      duration: number;
      ease: 'easeIn';
    };
  };
}

/**
 * Transition variants optimized for smooth navigation without layout jumps.
 * - Enter: subtle 4px vertical settle with smooth cubic-bezier deceleration.
 * - Exit: opacity-only fade with pointer-events: none (no vertical shift to avoid jarring movement).
 * - Reduced motion: durations set to 0 and all transforms eliminated.
 */
export const getPageVariants = (reducedMotion: boolean, duration: number = 0.2): PageVariants => {
  const enterDuration = reducedMotion ? 0 : duration;
  const exitDuration = reducedMotion ? 0 : Math.min(duration * 0.7, 0.14);

  return {
    initial: {
      opacity: 0,
      y: reducedMotion ? 0 : 4,
    },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: enterDuration,
        ease: [0.16, 1, 0.3, 1], // easeOutQuart: rapid initial start with smooth deceleration
      },
    },
    exit: {
      opacity: 0,
      y: 0, // Keep y at 0 to prevent content jumping or jerking on exit
      pointerEvents: 'none' as const, // Prevents clicks or taps on stale outgoing page elements
      transition: {
        duration: exitDuration,
        ease: 'easeIn' as const,
      },
    },
  };
};

export default function PageTransition({
  children,
  duration = 0.2,
  className = '',
}: PageTransitionProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const variants = getPageVariants(shouldReduceMotion, duration);

  return (
    <motion.div
      variants={variants as unknown as Variants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={`w-full flex-1 flex flex-col min-h-full ${className}`.trim()}
    >
      {children}
    </motion.div>
  );
}

