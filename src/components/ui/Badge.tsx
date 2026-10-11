import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger' | 'neutral';
  size?: 'sm' | 'md';
  className?: string;
}

export default function Badge({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: BadgeProps) {
  const baseStyle =
    'inline-flex items-center justify-center font-mono font-medium rounded-full border tracking-wide uppercase shrink-0';

  const variants = {
    primary: 'border-[var(--primary)]/20 bg-[var(--primary-soft)] text-[var(--primary)]',
    secondary: 'border-[var(--secondary)]/20 bg-[var(--bg-surface-alt)] text-[var(--secondary)]',
    accent: 'border-[var(--primary)]/20 bg-[var(--primary-soft)] text-[var(--primary)]',
    success: 'border-[var(--success)]/20 bg-[var(--success)]/10 text-[var(--success)]',
    warning: 'border-[var(--warning)]/20 bg-[var(--warning)]/10 text-[var(--warning)]',
    danger: 'border-[var(--danger)]/20 bg-[var(--danger)]/10 text-[var(--danger)]',
    neutral: 'border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-secondary)]',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[9px]',
    md: 'px-3 py-1 text-[10px]',
  };

  return (
    <span className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </span>
  );
}
