import React from 'react';
import Image from 'next/image';

export interface LogoIconProps {
  className?: string;
  size?: number;
}

export function LogoIcon({ className = '', size = 40 }: LogoIconProps) {
  // Master icon aspect ratio: 139 x 173 (height / width = 1.2446)
  const height = Math.round(size * (173 / 139));

  return (
    <span
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: size, height }}
      role="img"
      aria-label="Skillo Logo"
    >
      <Image
        src="/images/logo/skillo-owl.png"
        alt="Skillo Logo"
        width={139}
        height={173}
        className="w-full h-full object-contain filter drop-shadow-sm"
        priority
      />
    </span>
  );
}

export interface LogoFullProps {
  className?: string;
  iconSize?: number;
  showTagline?: boolean;
}

export function LogoFull({ className = '', iconSize = 34, showTagline = true }: LogoFullProps) {
  return (
    <div className={`flex items-center gap-3 text-left select-none ${className}`}>
      <LogoIcon size={iconSize} />

      <div className="flex flex-col justify-center leading-none">
        <span className="font-heading font-extrabold text-lg sm:text-xl tracking-tight text-[var(--text-primary)] inline-flex items-center">
          Skill
          <span className="relative inline-flex items-center justify-center">
            o
            <span
              className="absolute w-[30%] h-[30%] rounded-full bg-[#D48B28] shadow-[0_0_2px_rgba(212,139,40,0.5)] pointer-events-none"
              style={{ top: '38%', left: '35%' }}
              aria-hidden="true"
            />
          </span>
        </span>
        {showTagline && (
          <span className="text-[7.5px] sm:text-[8px] font-bold text-[var(--text-secondary)] tracking-[0.2em] font-mono mt-0.5 uppercase">
            AI Interview &amp; Resume Assistant
          </span>
        )}
      </div>
    </div>
  );
}
