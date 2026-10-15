import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ToastItem {
  id: number;
  message: string;
  variant: 'info' | 'success' | 'error';
}

export interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (message: string, variant?: 'info' | 'success' | 'error') => void;
  removeToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, variant: 'info' | 'success' | 'error' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const ToastContainer = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-[999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            role={toast.variant === 'error' ? 'alert' : 'status'}
            layout
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={`pointer-events-auto flex items-center justify-between p-4 rounded-xl shadow-[var(--shadow)] border text-xs sm:text-sm font-medium ${
              toast.variant === 'success'
                ? 'bg-[var(--bg-surface)] text-[var(--success)] border-[var(--success)]/40'
                : toast.variant === 'error'
                ? 'bg-[var(--bg-surface)] text-[var(--danger)] border-[var(--danger)]/40'
                : 'bg-[var(--bg-surface)] text-[var(--primary)] border-[var(--primary)]/40'
            }`}
          >
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
              className="ml-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)] shrink-0 cursor-pointer text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
