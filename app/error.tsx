'use client';

import React, { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Root Error Boundary]:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[var(--bg-surface)] border border-[var(--danger)]/30 rounded-2xl p-8 text-center space-y-6 shadow-[var(--shadow)]">
        <div className="h-14 w-14 rounded-full bg-[var(--danger)]/10 border border-[var(--danger)]/20 flex items-center justify-center text-[var(--danger)] text-2xl mx-auto">
          ⚠️
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-heading font-extrabold text-[var(--text-primary)]">Something went wrong!</h2>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            An unexpected error occurred. Please try resetting the view.
          </p>
        </div>
        <button
          onClick={reset}
          className="w-full py-3 px-6 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:bg-[var(--primary-active)] text-[var(--text-on-primary)] text-xs font-semibold transition shadow-[var(--shadow)] cursor-pointer"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
