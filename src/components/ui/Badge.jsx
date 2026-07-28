import React from 'react';

export default function Badge({
  children,
  variant = 'primary', // primary, secondary, accent, success, warning, danger, neutral
  size = 'md', // sm, md
  className = '',
  ...props
}) {
  const baseStyle = 'inline-flex items-center justify-center font-mono font-medium rounded-full border tracking-wide uppercase shrink-0';

  const variants = {
    primary: 'border-primary/20 bg-primary/10 text-primary',
    secondary: 'border-secondary/20 bg-secondary/10 text-secondary',
    accent: 'border-accent/20 bg-accent/10 text-accent',
    success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
    warning: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-400',
    danger: 'border-red-500/20 bg-red-500/10 text-red-400',
    neutral: 'border-white/5 bg-white/5 text-gray-400',
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
