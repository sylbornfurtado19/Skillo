import React from 'react';
import { motion } from 'framer-motion';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  variant?: 'glass' | 'solid' | 'glow-primary' | 'glow-secondary' | 'glow-accent' | 'default';
  hoverLift?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export default function Card({
  children,
  variant = 'glass',
  hoverLift = false,
  className = '',
  onClick,
  ...props
}: CardProps) {
  const baseStyle = 'rounded-2xl border border-[var(--border)] p-6 relative overflow-hidden bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[var(--shadow)]';

  const variants = {
    default: 'bg-[var(--bg-surface)] border-[var(--border)] shadow-[var(--shadow)]',
    glass: 'bg-[var(--bg-surface)] border-[var(--border)] shadow-[var(--shadow)]',
    solid: 'bg-[var(--bg-surface)] border-[var(--border)] shadow-[var(--shadow)]',
    'glow-primary': 'bg-[var(--bg-surface)] border-[var(--border)] shadow-[var(--shadow)]',
    'glow-secondary': 'bg-[var(--bg-surface)] border-[var(--border)] shadow-[var(--shadow)]',
    'glow-accent': 'bg-[var(--bg-surface)] border-[var(--border)] shadow-[var(--shadow)]',
  };

  if (hoverLift) {
    return (
      <motion.div
        onClick={onClick}
        className={`${baseStyle} ${variants[variant]} ${onClick ? 'cursor-pointer' : ''} ${className}`}
        whileHover={{ y: -4, borderColor: 'var(--primary)' }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        {...(props as React.ComponentPropsWithoutRef<typeof motion.div>)}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`${baseStyle} ${variants[variant]} ${onClick ? 'cursor-pointer' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
