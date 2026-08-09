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
      <div className="max-w-md w-full bg-[#111827] border border-red-500/20 rounded-2xl p-6 text-center space-y-4">
        <div className="h-10 w-10 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center text-lg mx-auto">
          ⚠️
        </div>
        <h3 className="text-base font-bold text-white">Workspace Error</h3>
        <p className="text-xs text-gray-400">
          An error occurred in this workspace view.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition"
        >
          Reset View
        </button>
      </div>
    </div>
  );
}
