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
      <body className="bg-[#030712] text-white min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#111827] border border-red-500/30 rounded-2xl p-8 text-center space-y-6">
          <div className="h-14 w-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 text-2xl mx-auto">
            💥
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold">Critical Application Error</h2>
            <p className="text-xs text-red-300/80 bg-red-950/40 p-3 rounded-lg border border-red-500/20 font-mono break-words">
              {error?.message || 'A root-level system error occurred.'}
            </p>
          </div>
          <button
            onClick={reset}
            className="w-full py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
