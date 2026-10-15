import React from 'react';
import { motion } from 'framer-motion';
import type { IconType } from 'react-icons';

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd'> {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'glass' | 'ghost' | 'danger' | 'default';
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
    'inline-flex flex-row items-center justify-center gap-2 rounded-xl font-semibold transition duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none relative overflow-hidden group whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

  const variants = {
    primary:
      'bg-primary hover:bg-primary-hover active:bg-primary-active text-text-on-primary shadow-soft border border-primary',
    secondary:
      'bg-secondary hover:bg-secondary-hover active:bg-secondary-hover text-text-on-primary shadow-soft border border-secondary',
    default:
      'bg-bg-surface-alt hover:bg-bg-surface-alt/80 text-text-primary border border-border shadow-soft',
    glass:
      'bg-bg-surface-alt hover:bg-bg-surface-alt/80 text-text-primary border border-border shadow-soft',
    ghost:
      'bg-transparent hover:bg-bg-surface-alt text-text-secondary hover:text-text-primary border border-transparent',
    danger:
      'bg-danger hover:bg-danger/90 text-text-on-primary border border-danger shadow-soft',
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
      {children && <span>{children}</span>}
      {Icon && <Icon className="text-xs shrink-0" />}
    </motion.button>
  );
}
