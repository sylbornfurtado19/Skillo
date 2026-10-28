'use client';

import React, { useState, useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';

export interface AnimatedScoreProps {
  value: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  className?: string;
}

/**
 * AnimatedScore
 * Smoothly animates a numerical score counting up from 0 to target value on mount.
 * - Defaults to initial target value for SSR and server-rendered HTML.
 * - Smooth cubic deceleration (easeOutCubic) curve in browser client.
 * - Automatically respects prefers-reduced-motion.
 */
export default function AnimatedScore({
  value,
  duration = 1200,
  suffix = '',
  prefix = '',
  decimals = 0,
  className = '',
}: AnimatedScoreProps) {
  const shouldReduceMotion = useReducedMotion();
  const [display, setDisplay] = useState<number>(() => value);

  useEffect(() => {
    if (shouldReduceMotion || typeof window === 'undefined' || !window.requestAnimationFrame) {
      setDisplay(value);
      return;
    }

    let startTime: number | null = null;
    let animId: number;

    // Reset to 0 at the start of client animation
    setDisplay(0);

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // easeOutCubic deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * value;
      setDisplay(decimals > 0 ? Number(current.toFixed(decimals)) : Math.round(current));

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        setDisplay(value);
      }
    };

    animId = requestAnimationFrame(step);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [value, duration, decimals, shouldReduceMotion]);

  return (
    <span className={className}>
      {prefix}
      {decimals > 0 ? display.toFixed(decimals) : Math.round(display)}
      {suffix}
    </span>
  );
}

