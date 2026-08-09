import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#030712] text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#111827] border border-white/5 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
        <div className="text-6xl font-heading font-extrabold text-indigo-500">404</div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold">Page Not Found</h2>
          <p className="text-xs text-gray-400 leading-relaxed">
            The page you are looking for doesn't exist or has been moved.
          </p>
        </div>
        <Link
          href="/"
          className="inline-block w-full py-3 px-6 rounded-xl bg-gradient-to-r from-primary to-accent text-white text-xs font-semibold hover:opacity-90 transition shadow-lg"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
}
