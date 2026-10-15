/**
 * Utility to retrieve computed CSS variable colors from the active theme.
 * Safe for SSR (returns fallback if window/document is unavailable).
 */

const FALLBACK_COLORS: Record<string, string> = {
  '--primary': '#9B2218',
  '--primary-hover': '#7F1B13',
  '--primary-soft': '#F3E1DE',
  '--secondary': '#6B6E70',
  '--border': '#E2DDD5',
  '--bg-page': '#F6F3EE',
  '--bg-surface': '#FBF9F6',
  '--bg-surface-alt': '#EFEBE5',
  '--text-primary': '#2B2523',
  '--text-secondary': '#6A625E',
  '--text-on-primary': '#FFFFFF',
  '--success': '#3A7552',
  '--warning': '#C98A1B',
  '--danger': '#B3261E',
  '--info': '#4A6B8A',
};

export function getThemeColor(name: string, fallback?: string): string {
  const varName = name.startsWith('--') ? name : `--${name}`;

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return fallback ?? FALLBACK_COLORS[varName] ?? '#9B2218';
  }

  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  if (value) {
    return value;
  }

  return fallback ?? FALLBACK_COLORS[varName] ?? '#9B2218';
}

/**
 * Returns a set of commonly used theme colors.
 */
export function getThemePalette() {
  return {
    primary: getThemeColor('--primary'),
    primaryHover: getThemeColor('--primary-hover'),
    primarySoft: getThemeColor('--primary-soft'),
    secondary: getThemeColor('--secondary'),
    border: getThemeColor('--border'),
    bgPage: getThemeColor('--bg-page'),
    bgSurface: getThemeColor('--bg-surface'),
    bgSurfaceAlt: getThemeColor('--bg-surface-alt'),
    textPrimary: getThemeColor('--text-primary'),
    textSecondary: getThemeColor('--text-secondary'),
    textOnPrimary: getThemeColor('--text-on-primary'),
    success: getThemeColor('--success'),
    warning: getThemeColor('--warning'),
    danger: getThemeColor('--danger'),
    info: getThemeColor('--info'),
  };
}
