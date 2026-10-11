'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-[var(--bg-page)] text-[var(--text-primary)] min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[var(--bg-surface)] border border-[var(--danger)]/30 rounded-2xl p-8 text-center space-y-6 shadow-[var(--shadow)]">
          <div className="h-14 w-14 rounded-full bg-[var(--danger)]/10 border border-[var(--danger)]/30 flex items-center justify-center text-[var(--danger)] text-2xl mx-auto">
            💥
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Critical Application Error</h2>
            <p className="text-xs text-[var(--danger)] bg-[var(--primary-soft)]/50 p-3 rounded-lg border border-[var(--danger)]/20 font-mono break-words">
              {error?.message || 'A root-level system error occurred.'}
            </p>
          </div>
          <button
            onClick={reset}
            className="w-full py-3 px-6 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:bg-[var(--primary-active)] text-[var(--text-on-primary)] text-xs font-semibold shadow-[var(--shadow)] cursor-pointer"
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
