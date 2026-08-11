'use client';

import React from 'react';
import { useInterview } from '@/context/InterviewContext';
import { THEME_PRESETS, ThemeId } from '@/types/themes';
import Card from '../ui/Card';
import { FaCheckCircle, FaPalette } from 'react-icons/fa';

interface ThemeSwitcherProps {
  className?: string;
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ className = '' }) => {
  const { theme, setTheme } = useInterview();

  const activeThemeId: ThemeId = (theme in THEME_PRESETS ? theme : 'onyx') as ThemeId;

  return (
    <div className={`space-y-4 text-left ${className}`}>
      <div className="flex items-center gap-2 border-b border-white/5 pb-3">
        <FaPalette className="text-primary text-sm" />
        <h3 className="text-xs font-heading font-bold text-white uppercase tracking-wider">
          Visual Studio Theme Presets
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(Object.keys(THEME_PRESETS) as ThemeId[]).map((themeId) => {
          const preset = THEME_PRESETS[themeId];
          const isActive = activeThemeId === themeId;

          return (
            <Card
              key={themeId}
              onClick={() => setTheme(themeId)}
              variant={isActive ? 'glow-primary' : 'glass'}
              className={`hover:scale-[1.02] transition-all p-4 border flex flex-col justify-between cursor-pointer relative overflow-hidden ${
                isActive ? 'border-primary' : 'border-white/5 hover:border-white/20'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white font-heading">{preset.name}</span>
                  {isActive && <FaCheckCircle className="text-primary text-sm shrink-0" />}
                </div>
                <p className="text-[10px] text-gray-400 font-mono leading-tight">{preset.subtitle}</p>
                <p className="text-[10px] text-gray-500 leading-relaxed pt-1">{preset.description}</p>
              </div>

              {/* Color Swatches Preview */}
              <div className="pt-4 flex items-center gap-1.5 border-t border-white/5 mt-3">
                <div
                  className="w-5 h-5 rounded-full border border-white/20 shadow-md"
                  style={{ backgroundColor: preset.bgHex }}
                  title="Canvas Background"
                />
                <div
                  className="w-5 h-5 rounded-full border border-white/20 shadow-md"
                  style={{ backgroundColor: preset.primaryHex }}
                  title="Primary Color"
                />
                <div
                  className="w-5 h-5 rounded-full border border-white/20 shadow-md"
                  style={{ backgroundColor: preset.secondaryHex }}
                  title="Secondary Color"
                />
                <div
                  className="w-5 h-5 rounded-full border border-white/20 shadow-md"
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
