import React from 'react';
import { LogoFull } from './Logo';

export default function Footer() {
  return (
    <footer className="w-full bg-[var(--bg-surface)] transition-colors duration-300 relative mt-auto border-t border-[var(--border)]">
      <div className="py-12 px-6 mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-center md:items-start gap-2">
          <LogoFull iconSize={30} showTagline={true} />
        </div>

        <p className="text-xs text-[var(--text-secondary)] text-center md:text-left font-medium leading-relaxed max-w-md">
          &copy; {new Date().getFullYear()} Skillo. Intelligent Resume Screening & AI Interview Assistant.
        </p>

      </div>
    </footer>
  );
}
