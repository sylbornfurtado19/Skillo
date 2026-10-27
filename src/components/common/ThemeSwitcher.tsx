'use client';

import React from 'react';
import { useInterview } from '@/context/InterviewContext';
import { THEME_PRESETS, ThemeId, getThemePreset } from '@/types/themes';
import { FaCheckCircle, FaPalette } from 'react-icons/fa';

interface ThemeSwitcherProps {
  className?: string;
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ className = '' }) => {
  const { theme, setTheme } = useInterview();

  const activeThemeId: ThemeId = getThemePreset(theme).id;
  const themeIds = Object.keys(THEME_PRESETS) as ThemeId[];

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentId: ThemeId
  ) => {
    const currentIndex = themeIds.indexOf(currentId);
    if (currentIndex === -1) return;

    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % themeIds.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + themeIds.length) % themeIds.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = themeIds.length - 1;
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setTheme(currentId);
      return;
    }

    if (nextIndex !== null) {
      const nextThemeId = themeIds[nextIndex];
      setTheme(nextThemeId);
      const radiogroup = e.currentTarget.closest('[role="radiogroup"]');
      if (radiogroup) {
        const radios = Array.from(radiogroup.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
        radios[nextIndex]?.focus();
      }
    }
  };

  return (
    <div className={`space-y-4 text-left ${className}`}>
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <FaPalette className="text-primary text-sm" aria-hidden="true" />
        <h3 className="text-xs font-heading font-bold text-text-primary uppercase tracking-wider">
          Visual Studio Theme Presets
        </h3>
      </div>

      <div
        role="radiogroup"
        aria-label="Visual Studio Theme Presets"
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl"
      >
        {themeIds.map((themeId) => {
          const preset = THEME_PRESETS[themeId];
          const isActive = activeThemeId === themeId;

          return (
            <button
              key={themeId}
              type="button"
              role="radio"
              aria-checked={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setTheme(themeId)}
              onKeyDown={(e) => handleKeyDown(e, themeId)}
              className={`rounded-2xl border p-4 flex flex-col justify-between text-left transition-all duration-200 cursor-pointer relative overflow-hidden shadow-soft hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface ${
                isActive
                  ? 'border-primary bg-primary-soft/30 text-text-primary ring-1 ring-primary/40'
                  : 'border-border bg-bg-surface text-text-primary hover:border-primary/40'
              }`}
            >
              <div className="space-y-2 w-full">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-text-primary font-heading">{preset.name}</span>
                    {preset.isLight && (
                      <span className="px-1.5 py-0.5 rounded bg-warning/20 text-text-warning border border-warning/30 text-[10px] font-mono font-bold">
                        Light
                      </span>
                    )}
                  </div>
                  {isActive && <FaCheckCircle className="text-primary text-sm shrink-0" aria-hidden="true" />}
                </div>
                <p className="text-xs text-text-secondary font-mono leading-tight">{preset.subtitle}</p>
                <p className="text-xs text-text-secondary leading-relaxed pt-1">{preset.description}</p>
              </div>

              {/* Color Swatches Preview */}
              <div className="pt-4 flex items-center gap-1.5 border-t border-border mt-3 w-full" aria-label="Theme color swatches">
                <div
                  className="w-5 h-5 rounded-full border border-border shadow-sm shrink-0"
                  style={{ backgroundColor: preset.bgHex }}
                  title={`Canvas Background: ${preset.bgHex}`}
                  aria-label={`Canvas Background: ${preset.bgHex}`}
                />
                <div
                  className="w-5 h-5 rounded-full border border-border shadow-sm shrink-0"
                  style={{ backgroundColor: preset.primaryHex }}
                  title={`Primary Color: ${preset.primaryHex}`}
                  aria-label={`Primary Color: ${preset.primaryHex}`}
                />
                <div
                  className="w-5 h-5 rounded-full border border-border shadow-sm shrink-0"
                  style={{ backgroundColor: preset.secondaryHex }}
                  title={`Secondary Color: ${preset.secondaryHex}`}
                  aria-label={`Secondary Color: ${preset.secondaryHex}`}
                />
                <div
                  className="w-5 h-5 rounded-full border border-border shadow-sm shrink-0"
                  style={{ backgroundColor: preset.accentHex }}
                  title={`Accent Color: ${preset.accentHex}`}
                  aria-label={`Accent Color: ${preset.accentHex}`}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
