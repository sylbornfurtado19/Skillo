import React from 'react';

export default function AppLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex-1 min-h-[50vh] flex items-center justify-center p-12"
    >
      <div className="flex flex-col items-center space-y-3">
        <div className="h-8 w-8 border-3 border-[var(--primary)]/20 border-t-[var(--primary)] rounded-full animate-spin" />
        <p className="text-[11px] text-[var(--text-secondary)] font-mono tracking-wider uppercase">Loading Workspace...</p>
      </div>
    </div>
  );
}
