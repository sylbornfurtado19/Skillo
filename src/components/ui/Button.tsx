import React from 'react';
import { motion } from 'framer-motion';
import type { IconType } from 'react-icons';

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd'> {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'accent' | 'glass' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  icon?: IconType;
}

export default function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  icon: Icon,
  ...props
}: ButtonProps) {
  const baseStyle =
    'inline-flex flex-row items-center justify-center gap-2 rounded-xl font-semibold transition duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none relative overflow-hidden group whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30';

  const variants = {
    primary:
      'bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:bg-[var(--primary-active)] text-[var(--text-on-primary)] shadow-[var(--shadow)] border border-[var(--primary)]',
    secondary:
      'bg-[var(--secondary)] hover:bg-[var(--secondary-hover)] active:bg-[var(--secondary-hover)] text-[var(--text-on-primary)] shadow-[var(--shadow)] border border-[var(--secondary)]',
    accent:
      'bg-[var(--primary-soft)] hover:bg-[var(--primary-soft)]/80 text-[var(--primary)] border border-[var(--primary)]/20',
    glass:
      'bg-[var(--bg-surface-alt)] hover:bg-[var(--bg-surface-alt)]/80 text-[var(--text-primary)] border border-[var(--border)] shadow-[var(--shadow)]',
    ghost:
      'bg-transparent hover:bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent',
    danger:
      'bg-[var(--danger)] hover:bg-[var(--danger)]/90 text-[var(--text-on-primary)] border border-[var(--danger)] shadow-[var(--shadow)]',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-7 py-3.5 text-base',
  };

  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      <div className="flex flex-row items-center justify-center gap-2 relative z-10 w-full shrink-0">
        <span>{children}</span>
        {Icon && <Icon className="text-xs shrink-0" />}
      </div>
    </motion.button>
  );
}
