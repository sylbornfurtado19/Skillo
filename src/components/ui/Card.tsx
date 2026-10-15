import React from 'react';
import { motion } from 'framer-motion';

export type CardVariant =
  | 'default'
  | 'elevated'
  /** @deprecated use 'default' */
  | 'glass'
  /** @deprecated use 'default' */
  | 'solid'
  /** @deprecated use 'default' */
  | 'glow-primary'
  /** @deprecated use 'default' */
  | 'glow-secondary'
  /** @deprecated use 'default' */
  | 'glow-accent';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  variant?: CardVariant;
  hoverLift?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export default function Card({
  children,
  variant = 'default',
  hoverLift = false,
  className = '',
  onClick,
  ...props
}: CardProps) {
  const baseStyle =
    'rounded-2xl border border-border p-6 relative overflow-hidden bg-bg-surface text-text-primary shadow-soft';

  const variants: Record<CardVariant, string> = {
    default: 'bg-bg-surface border-border shadow-soft',
    elevated: 'bg-bg-surface border-border shadow-md ring-1 ring-border/50',
    // Deprecated aliases mapped to default
    glass: 'bg-bg-surface border-border shadow-soft',
    solid: 'bg-bg-surface border-border shadow-soft',
    'glow-primary': 'bg-bg-surface border-border shadow-soft',
    'glow-secondary': 'bg-bg-surface border-border shadow-soft',
    'glow-accent': 'bg-bg-surface border-border shadow-soft',
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
