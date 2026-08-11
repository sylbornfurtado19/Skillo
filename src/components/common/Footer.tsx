import React from 'react';
import { FaGithub, FaHeart } from 'react-icons/fa';
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

        <div className="flex items-center gap-4 text-gray-400">
          <a
            href="https://github.com/sylbornfurtado19/Skillo"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-xs text-gray-300 hover:text-white hover:scale-105 active:scale-95 transition-all duration-200 shadow-md group"
            aria-label="GitHub Repository"
          >
            <FaGithub size={16} className="group-hover:rotate-12 transition duration-200 text-primary" />
            <span className="font-mono text-[11px]">GitHub Repo</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
