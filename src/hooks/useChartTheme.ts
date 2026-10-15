'use client';

import { useState, useEffect } from 'react';
import { getThemePalette } from '../lib/themeColors';

export interface ChartThemeColors {
  primary: string;
  primaryHover: string;
  primarySoft: string;
  secondary: string;
  border: string;
  bgPage: string;
  bgSurface: string;
  bgSurfaceAlt: string;
  textPrimary: string;
  textSecondary: string;
  textOnPrimary: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  themeKey: string;
}

export function useChartTheme(): ChartThemeColors {
  const [themeKey, setThemeKey] = useState<string>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.getAttribute('data-theme') || 'onyx';
    }
    return 'onyx';
  });

  const [palette, setPalette] = useState(() => getThemePalette());

  useEffect(() => {
    const updateTheme = () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'onyx';
      setThemeKey(currentTheme);
      setPalette(getThemePalette());
    };

    updateTheme();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          updateTheme();
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return {
    ...palette,
    themeKey,
  };
}
