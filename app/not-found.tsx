import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-8 text-center space-y-6 shadow-[var(--shadow)]">
        <div className="text-6xl font-heading font-extrabold text-[var(--primary)]">404</div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Page Not Found</h2>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            The page you are looking for doesn't exist or has been moved.
          </p>
        </div>
        <Link
          href="/"
          className="inline-block w-full py-3 px-6 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:bg-[var(--primary-active)] text-[var(--text-on-primary)] text-xs font-semibold transition shadow-[var(--shadow)]"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
}
