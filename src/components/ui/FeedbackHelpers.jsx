import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaCheckCircle, FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa';

// Section Header Component
export function SectionHeader({ title, description, badge = '', className = '' }) {
  return (
    <div className={`space-y-2 text-center md:text-left ${className}`}>
      {badge && (
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-xs text-primary font-medium tracking-wide uppercase">
          {badge}
        </span>
      )}
      <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-white tracking-tight">{title}</h2>
      {description && <p className="text-sm text-gray-400 max-w-2xl leading-relaxed">{description}</p>}
    </div>
  );
}

// Modal Component
export function Modal({ isOpen, onClose, title, children, size = 'md', className = '' }) {
  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-[1000] backdrop-blur-sm"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[1001] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className={`w-full bg-[#111827] border border-white/8 rounded-2xl shadow-2xl p-6 pointer-events-auto overflow-hidden relative ${sizes[size]} ${className}`}
            >
              {/* Header */}
              <div className="flex justify-between items-center pb-4 border-b border-white/5 mb-4">
                <h3 className="text-lg font-heading font-bold text-white leading-none">{title}</h3>
                <button
                  onClick={onClose}
                  className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition duration-200 cursor-pointer"
                >
                  <FaTimes />
                </button>
              </div>

              {/* Body */}
              <div className="text-gray-300 text-sm">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// Simple Tooltip
export function Tooltip({ content, children, className = '' }) {
  return (
    <div className={`relative group inline-block ${className}`}>
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded bg-[#030712] border border-white/10 shadow-xl text-[10px] text-gray-300 font-medium tracking-wide whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-50">
        {content}
      </div>
    </div>
  );
}

// Toast notification component (Can be controlled outside or static)
export function Toast({ message, type = 'success', onClose, duration = 4000 }) {
  const icons = {
    success: <FaCheckCircle className="text-emerald-400 text-base" />,
    warning: <FaExclamationTriangle className="text-yellow-400 text-base" />,
    error: <FaTimes className="text-red-400 text-base" />,
    info: <FaInfoCircle className="text-primary text-base" />,
  };

  const borders = {
    success: 'border-emerald-500/20 bg-emerald-500/5',
    warning: 'border-yellow-500/20 bg-yellow-500/5',
    error: 'border-red-500/20 bg-red-500/5',
    info: 'border-primary/20 bg-primary/5',
  };

  React.useEffect(() => {
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
      className={`fixed bottom-6 right-6 z-[10000] rounded-xl border p-4 shadow-2xl flex items-center gap-3.5 max-w-sm ${borders[type]}`}
    >
      <div className="shrink-0">{icons[type]}</div>
      <p className="text-xs font-semibold text-white leading-tight">{message}</p>
      {onClose && (
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white transition duration-200 cursor-pointer ml-auto shrink-0"
        >
          <FaTimes size={10} />
        </button>
      )}
    </motion.div>
  );
}
