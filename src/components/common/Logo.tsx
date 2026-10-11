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
        <linearGradient id="skillo-grad-nmims-primary" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--primary, #9B2218)" />
          <stop offset="100%" stopColor="var(--primary-hover, #7F1B13)" />
        </linearGradient>

        <linearGradient id="skillo-grad-nmims-secondary" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--secondary, #6B6E70)" />
          <stop offset="100%" stopColor="var(--secondary-hover, #55585A)" />
        </linearGradient>
      </defs>

      <rect x="16" y="22" width="10" height="56" rx="5" fill="url(#skillo-grad-nmims-primary)" />

      <path
        d="M 43.86 63.86 A 20 20 0 1 1 72.14 63.86"
        stroke="url(#skillo-grad-nmims-primary)"
        strokeWidth="10"
        strokeLinecap="round"
        fill="none"
      />

      <path
        d="M 46 72 C 52 66 56 61 63 54"
        stroke="url(#skillo-grad-nmims-secondary)"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />

      <path d="M 52 48 L 74 38 L 64 60 L 60 52 Z" fill="url(#skillo-grad-nmims-secondary)" />
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
        <span className="font-heading font-extrabold text-lg tracking-tight text-[var(--text-primary)]">
          Skillo
        </span>
        {showTagline && (
          <span className="text-[7.5px] font-bold text-[var(--text-secondary)] tracking-[0.2em] font-mono mt-0.5 uppercase">
            AI Interview & Resume Assistant
          </span>
        )}
      </div>
    </div>
  );
}
