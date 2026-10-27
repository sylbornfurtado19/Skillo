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
    subtitle: 'Deep Space Black & Indigo Glass',
    description: 'Official dark glassmorphic studio aesthetic with deep space black canvas, crisp card surfaces, and indigo accents.',
    bgHex: '#030712',
    cardHex: '#111827',
    primaryHex: '#6366F1',
    secondaryHex: '#818CF8',
    accentHex: '#818CF8',
    isLight: false,
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk Dark',
    subtitle: 'Synthwave Dark & Hot Pink',
    description: 'High-contrast synthwave dark mode with deep canvas, warm dark surfaces, and hot pink highlights.',
    bgHex: '#090414',
    cardHex: '#190A2E',
    primaryHex: '#EC4899',
    secondaryHex: '#F472B6',
    accentHex: '#F472B6',
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
