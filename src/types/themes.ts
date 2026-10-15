export type ThemeId = 'onyx' | 'cyberpunk' | 'slate';

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
    name: 'NMIMS Light',
    subtitle: 'Warm Ivory & Heritage Maroon',
    description: 'Official NMIMS university portal aesthetic with warm ivory pages, crisp card surfaces, and deep heritage maroon accents.',
    bgHex: '#F6F3EE',
    cardHex: '#FBF9F6',
    primaryHex: '#9B2218',
    secondaryHex: '#6B6E70',
    accentHex: '#6B6E70',
    isLight: true,
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'NMIMS Dark',
    subtitle: 'Dark Charcoal & Vivid Crimson',
    description: 'High-contrast dark mode with charcoal canvas, warm dark surfaces, and vivid crimson maroon highlights.',
    bgHex: '#1E1A19',
    cardHex: '#272221',
    primaryHex: '#CC3F33',
    secondaryHex: '#9B9E9F',
    accentHex: '#9B9E9F',
    isLight: false,
  },
  slate: {
    id: 'slate',
    name: 'Slate',
    subtitle: 'Executive Slate Navy & Maroon',
    description: 'Refined slate navy background with cool balanced surfaces and authoritative university maroon highlights.',
    bgHex: '#1E2229',
    cardHex: '#262B34',
    primaryHex: '#9B2218',
    secondaryHex: '#8B949E',
    accentHex: '#8B949E',
    isLight: false,
  },
};

export function getThemePreset(id: string): ThemePreset {
  if (id === 'nmims' || id === 'light') return THEME_PRESETS.onyx;
  if (id === 'dark') return THEME_PRESETS.cyberpunk;
  if (id in THEME_PRESETS) {
    return THEME_PRESETS[id as ThemeId];
  }
  return THEME_PRESETS.onyx;
}
