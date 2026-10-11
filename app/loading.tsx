import React from 'react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="h-10 w-10 border-4 border-[var(--primary)]/20 border-t-[var(--primary)] rounded-full animate-spin" />
        <p className="text-xs text-[var(--text-secondary)] font-mono tracking-wider uppercase">Loading Skillo...</p>
      </div>
    </div>
  );
}
