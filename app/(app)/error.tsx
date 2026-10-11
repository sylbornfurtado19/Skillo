'use client';

import React, { useEffect } from 'react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[App Workspace Error]:', error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-[var(--bg-surface)] border border-[var(--danger)]/30 rounded-2xl p-6 text-center space-y-4 shadow-[var(--shadow)]">
        <div className="h-10 w-10 rounded-full bg-[var(--danger)]/10 text-[var(--danger)] flex items-center justify-center text-lg mx-auto">
          ⚠️
        </div>
        <h3 className="text-base font-bold text-[var(--text-primary)]">Workspace Error</h3>
        <p className="text-xs text-[var(--text-secondary)]">
          An error occurred in this workspace view.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:bg-[var(--primary-active)] text-[var(--text-on-primary)] text-xs font-semibold transition shadow-[var(--shadow)] cursor-pointer"
        >
          Reset View
        </button>
      </div>
    </div>
  );
}
