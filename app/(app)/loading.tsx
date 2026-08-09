import React from 'react';

export default function AppLoading() {
  return (
    <div className="flex-1 flex items-center justify-center p-12">
      <div className="flex flex-col items-center space-y-3">
        <div className="h-8 w-8 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-[11px] text-gray-500 font-mono tracking-wider uppercase">Loading Workspace...</p>
      </div>
    </div>
  );
}
