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
    <div className="min-h-screen bg-[#030712] text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#111827] border border-red-500/20 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
        <div className="h-14 w-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-2xl mx-auto">
          ⚠️
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-heading font-extrabold">Something went wrong!</h2>
          <p className="text-xs text-gray-400 leading-relaxed">
            An unexpected error occurred. Please try resetting the view.
          </p>
        </div>
        <button
          onClick={reset}
          className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-primary to-accent text-white text-xs font-semibold hover:opacity-90 transition shadow-lg cursor-pointer"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
