import React from 'react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="h-10 w-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-xs text-gray-400 font-mono tracking-wider uppercase">Loading Skillo...</p>
      </div>
    </div>
  );
}
