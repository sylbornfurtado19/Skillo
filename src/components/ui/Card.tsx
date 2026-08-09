import React from 'react';
import { motion } from 'framer-motion';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  variant?: 'glass' | 'solid' | 'glow-primary' | 'glow-secondary' | 'glow-accent';
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
  const baseStyle = 'rounded-2xl border p-6 relative overflow-hidden';

  const variants = {
    glass: 'bg-[#111827]/50 border-white/5 shadow-2xl backdrop-blur-md',
    solid: 'bg-[#111827] border-white/5 shadow-2xl',
    'glow-primary': 'bg-[#111827]/50 border-white/5 shadow-2xl glow-primary backdrop-blur-md',
    'glow-secondary': 'bg-[#111827]/50 border-white/5 shadow-2xl glow-secondary backdrop-blur-md',
    'glow-accent': 'bg-[#111827]/50 border-white/5 shadow-2xl glow-accent backdrop-blur-md',
  };

  if (hoverLift) {
    return (
      <motion.div
        onClick={onClick}
        className={`${baseStyle} ${variants[variant]} ${onClick ? 'cursor-pointer' : ''} ${className}`}
        whileHover={{ y: -6, borderColor: 'rgba(255, 255, 255, 0.15)' }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
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
