import React from 'react';

export function LogoIcon({ className = '', size = 40 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className}`}
    >
      <defs>
        {/* Violet to Blue Gradient for 'I' and 'Q' circle body */}
        <linearGradient id="iq-grad-violet-blue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" /> {/* Secondary / Violet */}
          <stop offset="100%" stopColor="#6366F1" /> {/* Primary / Indigo */}
        </linearGradient>
        
        {/* Cyan to Electric Blue Gradient for the Arrow */}
        <linearGradient id="iq-grad-cyan-blue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06B6D4" /> {/* Accent / Cyan */}
          <stop offset="100%" stopColor="#3B82F6" /> {/* Blue */}
        </linearGradient>
      </defs>

      {/* The 'I' rounded vertical pill */}
      <rect
        x="16"
        y="22"
        width="10"
        height="56"
        rx="5"
        fill="url(#iq-grad-violet-blue)"
      />

      {/* The 'Q' circular body with bottom-right cutout */}
      <path
        d="M 43.86 63.86 A 20 20 0 1 1 72.14 63.86"
        stroke="url(#iq-grad-violet-blue)"
        strokeWidth="10"
        strokeLinecap="round"
        fill="none"
      />

      {/* The Arrow slicing through */}
      {/* Arrow Shaft */}
      <path
        d="M 46 72 C 52 66 56 61 63 54"
        stroke="url(#iq-grad-cyan-blue)"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />
      {/* Arrow Head */}
      <path
        d="M 52 48 L 74 38 L 64 60 L 60 52 Z"
        fill="url(#iq-grad-cyan-blue)"
      />
    </svg>
  );
}

export function LogoFull({ className = '', iconSize = 36 }) {
  return (
    <div className={`flex items-center gap-2.5 text-left select-none ${className}`}>
      <LogoIcon size={iconSize} />
      
      <div className="flex flex-col justify-center leading-none">
        <span className="font-heading font-bold text-lg tracking-tight text-white">
          Interview<span className="bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] bg-clip-text text-transparent">IQ</span>
        </span>
        <span className="text-[7.5px] font-bold text-gray-500 tracking-[0.2em] font-mono mt-0.5 uppercase">
          Practice. Analyze. Improve.
        </span>
      </div>
    </div>
  );
}
