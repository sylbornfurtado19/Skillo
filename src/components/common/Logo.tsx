import React from 'react';

export interface LogoIconProps {
  className?: string;
  size?: number;
}

export function LogoIcon({ className = '', size = 40 }: LogoIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="iq-grad-violet-blue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>

        <linearGradient id="iq-grad-cyan-blue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
      </defs>

      <rect x="16" y="22" width="10" height="56" rx="5" fill="url(#iq-grad-violet-blue)" />

      <path
        d="M 43.86 63.86 A 20 20 0 1 1 72.14 63.86"
        stroke="url(#iq-grad-violet-blue)"
        strokeWidth="10"
        strokeLinecap="round"
        fill="none"
      />

      <path
        d="M 46 72 C 52 66 56 61 63 54"
        stroke="url(#iq-grad-cyan-blue)"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />

      <path d="M 52 48 L 74 38 L 64 60 L 60 52 Z" fill="url(#iq-grad-cyan-blue)" />
    </svg>
  );
}

export interface LogoFullProps {
  className?: string;
  iconSize?: number;
  showTagline?: boolean;
}

export function LogoFull({ className = '', iconSize = 34, showTagline = true }: LogoFullProps) {
  return (
    <div className={`flex items-center gap-2.5 text-left select-none ${className}`}>
      <LogoIcon size={iconSize} />

      <div className="flex flex-col justify-center leading-none">
        <span className="font-heading font-extrabold text-lg tracking-tight text-white flex items-center">
          Skil<span className="bg-gradient-to-r from-[#8B5CF6] via-[#6366F1] to-[#06B6D4] bg-clip-text text-transparent">lo</span>
        </span>
        {showTagline && (
          <span className="text-[7.5px] font-bold text-gray-400 tracking-[0.2em] font-mono mt-0.5 uppercase">
            AI Interview & Resume Assistant
          </span>
        )}
      </div>
    </div>
  );
}

