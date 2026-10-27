export type ThemeId = 'onyx' | 'cyberpunk';

export interface ThemePreset {
  id: ThemeId;
  name: string;
  subtitle: string;
  description: string;
  bgHex: string;
  cardHex: string;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  isLight?: boolean;
}

export const THEME_PRESETS: Record<ThemeId, ThemePreset> = {
  onyx: {
    id: 'onyx',
    name: 'Onyx Glass',
    subtitle: 'Warm Ivory & Deep Maroon',
    description: 'Academic light studio aesthetic with warm ivory canvas, paper-toned card surfaces, and deep maroon accents.',
    bgHex: '#F6F3EE',
    cardHex: '#FBF9F6',
    primaryHex: '#9B2218',
    secondaryHex: '#6B6E70',
    accentHex: '#6B6E70',
    isLight: true,
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk Dark',
    subtitle: 'Warm Charcoal & Crimson Dark',
    description: 'High-contrast dark mode with deep charcoal canvas, warm dark surfaces, and vivid crimson accents.',
    bgHex: '#1E1A19',
    cardHex: '#272221',
    primaryHex: '#CC3F33',
    secondaryHex: '#9B9E9F',
    accentHex: '#9B9E9F',
    isLight: false,
  },
};

export function getThemePreset(id?: string | null): ThemePreset {
  if (!id) return THEME_PRESETS.onyx;
  if (id === 'nmims' || id === 'light') return THEME_PRESETS.onyx;
  if (id === 'dark') return THEME_PRESETS.cyberpunk;
  if (id in THEME_PRESETS) {
    return THEME_PRESETS[id as ThemeId];
  }
  return THEME_PRESETS.onyx;
}

export type MonacoTheme = 'vs' | 'vs-dark';

/**
 * Resolves the corresponding Monaco editor theme ('vs' or 'vs-dark')
 * based on canonical theme metadata.
 *
 * Light presets (e.g. 'onyx', 'light', 'nmims') resolve to 'vs'.
 * Dark presets (e.g. 'cyberpunk', 'dark') resolve to 'vs-dark'.
 * Unrecognized, missing, or null themes fall back safely to the default light theme 'vs'.
 */
export function getMonacoTheme(themeId?: string | null): MonacoTheme {
  let effectiveId = themeId;
  if (!effectiveId && typeof document !== 'undefined') {
    try {
      effectiveId =
        document.documentElement.getAttribute('data-theme') ||
        document.documentElement.dataset?.theme ||
        null;
    } catch {
      // In case document attributes are not accessible in restricted environments
    }
  }

  const preset = getThemePreset(effectiveId);
  return preset.isLight ? 'vs' : 'vs-dark';
}
