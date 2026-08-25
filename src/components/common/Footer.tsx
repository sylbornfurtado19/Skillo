import React from 'react';
import { LogoFull } from './Logo';

export default function Footer() {
  return (
    <footer className="w-full bg-background transition-colors duration-500 relative mt-auto border-t border-transparent">
      {/* Animated Top Border Gradient Glow Line */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent shadow-[0_0_15px_rgba(99,102,241,0.5)]" />

      <div className="py-12 px-6 mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-center md:items-start gap-2">
          <LogoFull iconSize={30} showTagline={true} />
        </div>

        <p className="text-xs text-gray-400 text-center md:text-left font-medium leading-relaxed max-w-md">
          &copy; {new Date().getFullYear()} Skillo. Intelligent Resume Screening & AI Interview Assistant.
        </p>

      </div>
    </footer>
  );
}
