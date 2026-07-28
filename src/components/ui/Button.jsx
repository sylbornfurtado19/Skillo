import React from 'react';
import { motion } from 'framer-motion';

export default function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary', // primary, secondary, accent, glass, ghost, danger
  size = 'md', // sm, md, lg
  disabled = false,
  className = '',
  icon: Icon,
  ...props
}) {
  const baseStyle = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none relative overflow-hidden group whitespace-nowrap';

  const variants = {
    primary: 'bg-primary hover:bg-indigo-600 text-white shadow-lg shadow-primary/20 hover:shadow-primary/30 border border-primary/10',
    secondary: 'bg-secondary hover:bg-purple-600 text-white shadow-lg shadow-secondary/20 hover:shadow-secondary/30 border border-secondary/10',
    accent: 'bg-accent hover:bg-cyan-500 text-white shadow-lg shadow-accent/20 hover:shadow-accent/30 border border-accent/10',
    glass: 'bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 backdrop-blur-md',
    ghost: 'bg-transparent hover:bg-white/5 text-gray-400 hover:text-white border border-transparent',
    danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/30',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-7 py-3.5 text-base',
  };

  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.96 }}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {/* Shimmer Sweep Overlay */}
      {!disabled && (
        <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
      )}
      {Icon && <Icon className="text-sm shrink-0 relative z-10" />}
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}
