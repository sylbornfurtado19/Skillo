import React from 'react';
import { motion } from 'framer-motion';

// Circular Spinner Loader
export function Loader({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`rounded-full border-primary/20 border-t-primary animate-spin ${sizes[size]}`} />
    </div>
  );
}

// Progress Bar Component (Linear or Circular)
export function Progress({
  value = 0,
  max = 100,
  variant = 'primary', // primary, secondary, accent, success
  showLabel = false,
  label = '',
  size = 'md', // sm, md, lg
  className = '',
}) {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  const variants = {
    primary: 'bg-primary',
    secondary: 'bg-secondary',
    accent: 'bg-accent',
    success: 'bg-emerald-500',
  };

  const sizes = {
    sm: 'h-1',
    md: 'h-1.5',
    lg: 'h-3',
  };

  return (
    <div className={`w-full space-y-1.5 ${className}`}>
      {(showLabel || label) && (
        <div className="flex justify-between text-[10px] font-semibold text-gray-400 uppercase font-mono tracking-wider">
          <span>{label}</span>
          <span>{percentage}%</span>
        </div>
      )}
      <div className={`w-full bg-white/5 rounded-full overflow-hidden border border-white/5 ${sizes[size]}`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={`h-full rounded-full ${variants[variant]}`}
        />
      </div>
    </div>
  );
}

// Skeleton loading loader
export function Skeleton({ variant = 'text', className = '' }) {
  const variants = {
    text: 'h-4 w-full rounded',
    avatar: 'h-12 w-12 rounded-full shrink-0',
    rect: 'h-24 w-full rounded-xl',
  };

  return (
    <div className={`bg-white/5 animate-pulse ${variants[variant]} ${className}`} />
  );
}
