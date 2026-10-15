'use client';

import React from 'react';
import { useInterview } from '@/context/InterviewContext';
import { THEME_PRESETS, ThemeId, getThemePreset } from '@/types/themes';
import Card from '../ui/Card';
import { FaCheckCircle, FaPalette } from 'react-icons/fa';

interface ThemeSwitcherProps {
  className?: string;
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ className = '' }) => {
  const { theme, setTheme } = useInterview();

  const activeThemeId: ThemeId = getThemePreset(theme).id;

  return (
    <div className={`space-y-4 text-left ${className}`}>
      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
        <FaPalette className="text-[var(--primary)] text-sm" />
        <h3 className="text-xs font-heading font-bold text-[var(--text-primary)] uppercase tracking-wider">
          Visual Studio Theme Presets
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(Object.keys(THEME_PRESETS) as ThemeId[]).map((themeId) => {
          const preset = THEME_PRESETS[themeId];
          const isActive = activeThemeId === themeId;

          return (
            <Card
              key={themeId}
              onClick={() => setTheme(themeId)}
              variant={isActive ? 'glow-primary' : 'glass'}
              className={`hover:scale-[1.02] transition-all p-4 border flex flex-col justify-between cursor-pointer relative overflow-hidden ${
                isActive ? 'border-[var(--primary)]' : 'border-[var(--border)] hover:border-[var(--text-secondary)]'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[var(--text-primary)] font-heading">{preset.name}</span>
                    {preset.isLight && (
                      <span className="px-1.5 py-0.5 rounded bg-[var(--warning)]/20 text-[var(--warning)] border border-[var(--warning)]/30 text-xs font-mono font-bold">
                        Light
                      </span>
                    )}
                  </div>
                  {isActive && <FaCheckCircle className="text-[var(--primary)] text-sm shrink-0" />}
                </div>
                <p className="text-xs text-[var(--text-secondary)] font-mono leading-tight">{preset.subtitle}</p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed pt-1">{preset.description}</p>
              </div>

              {/* Color Swatches Preview */}
              <div className="pt-4 flex items-center gap-1.5 border-t border-[var(--border)] mt-3">
                <div
                  className="w-5 h-5 rounded-full border border-[var(--border)] shadow-sm"
                  style={{ backgroundColor: preset.bgHex }}
                  title="Canvas Background"
                />
                <div
                  className="w-5 h-5 rounded-full border border-[var(--border)] shadow-sm"
                  style={{ backgroundColor: preset.primaryHex }}
                  title="Primary Color"
                />
                <div
                  className="w-5 h-5 rounded-full border border-[var(--border)] shadow-sm"
                  style={{ backgroundColor: preset.secondaryHex }}
                  title="Secondary Color"
                />
                <div
                  className="w-5 h-5 rounded-full border border-[var(--border)] shadow-sm"
                  style={{ backgroundColor: preset.accentHex }}
                  title="Accent Color"
                />
              </div>
            </Card>
          );
        })}
      </div>

    </div>
  );
};
