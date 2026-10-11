import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaCheckCircle, FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa';

// Section Header Component
export interface SectionHeaderProps {
  title: string;
  description?: string;
  badge?: string;
  className?: string;
}

export function SectionHeader({ title, description, badge = '', className = '' }: SectionHeaderProps) {
  return (
    <div className={`flex flex-col items-center text-center space-y-2.5 mx-auto ${className}`}>
      {badge && (
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--primary)]/20 bg-[var(--primary-soft)] text-xs text-[var(--primary)] font-medium tracking-wide uppercase">
          {badge}
        </span>
      )}
      <div className="nmims-section-banner">
        <h2 className="text-lg sm:text-xl font-heading font-extrabold text-[var(--text-on-primary)] tracking-wider uppercase text-center leading-tight">
          {title}
        </h2>
      </div>
      {description && <p className="text-sm text-[var(--text-secondary)] max-w-2xl leading-relaxed text-center">{description}</p>}
    </div>
  );
}


// Modal Component
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, size = 'md', className = '' }: ModalProps) {
  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-[1000] backdrop-blur-sm"
          />

          <div className="fixed inset-0 flex items-center justify-center p-4 z-[1001] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className={`w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow)] p-6 pointer-events-auto overflow-hidden relative ${sizes[size]} ${className}`}
            >
              <div className="flex justify-between items-center pb-4 border-b border-[var(--border)] mb-4">
                <h3 className="text-lg font-heading font-bold text-[var(--text-primary)] leading-none">{title}</h3>
                <button
                  onClick={onClose}
                  className="h-8 w-8 rounded-lg bg-[var(--bg-surface-alt)] flex items-center justify-center border border-[var(--border)] hover:bg-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition duration-200 cursor-pointer"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="text-[var(--text-primary)] text-sm">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// Tooltip Component
export interface TooltipProps {
  content: string;
  children: React.ReactNode;
  className?: string;
}

export function Tooltip({ content, children, className = '' }: TooltipProps) {
  return (
    <div className={`relative group inline-block ${className}`}>
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded bg-[var(--bg-surface-alt)] border border-[var(--border)] shadow-[var(--shadow)] text-[10px] text-[var(--text-primary)] font-medium tracking-wide whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-50">
        {content}
      </div>
    </div>
  );
}

// Toast notification component
export interface ToastProps {
  message: string;
  type?: 'success' | 'warning' | 'error' | 'info';
  onClose?: () => void;
  duration?: number;
}

export function Toast({ message, type = 'success', onClose, duration = 4000 }: ToastProps) {
  const icons = {
    success: <FaCheckCircle className="text-[var(--success)] text-base" />,
    warning: <FaExclamationTriangle className="text-[var(--warning)] text-base" />,
    error: <FaTimes className="text-[var(--danger)] text-base" />,
    info: <FaInfoCircle className="text-[var(--primary)] text-base" />,
  };

  const borders = {
    success: 'border-[var(--success)]/30 bg-[var(--bg-surface)] text-[var(--success)]',
    warning: 'border-[var(--warning)]/30 bg-[var(--bg-surface)] text-[var(--warning)]',
    error: 'border-[var(--danger)]/30 bg-[var(--bg-surface)] text-[var(--danger)]',
    info: 'border-[var(--primary)]/30 bg-[var(--bg-surface)] text-[var(--primary)]',
  };

  useEffect(() => {
    if (onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [onClose, duration]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className={`fixed bottom-6 right-6 z-[10000] rounded-xl border p-4 shadow-[var(--shadow)] flex items-center gap-3.5 max-w-sm ${borders[type]}`}
    >
      <div className="shrink-0">{icons[type]}</div>
      <p className="text-xs font-semibold text-[var(--text-primary)] leading-tight">{message}</p>
      {onClose && (
        <button
          onClick={onClose}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition duration-200 cursor-pointer ml-auto shrink-0"
        >
          <FaTimes size={10} />
        </button>
      )}
    </motion.div>
  );
}
