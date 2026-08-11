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
  badgeClass: string;
}

export const THEME_PRESETS: Record<ThemeId, ThemePreset> = {
  onyx: {
    id: 'onyx',
    name: 'Onyx Glass',
    subtitle: 'Deep Obsidian & Indigo Glows',
    description: 'Ultra-deep space black background with translucent glassmorphic cards and indigo/violet neon accents.',
    bgHex: '#030712',
    cardHex: '#0B0F19',
    primaryHex: '#6366F1',
    secondaryHex: '#8B5CF6',
    accentHex: '#06B6D4',
    badgeClass: 'from-indigo-500/20 to-purple-500/20 text-indigo-400 border-indigo-500/30',
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk Dark',
    subtitle: 'Neon Pink & Electric Cyan',
    description: 'High-contrast synthwave dark purple canvas with vibrant electric cyan and hot pink neon highlights.',
    bgHex: '#090414',
    cardHex: '#140A23',
    primaryHex: '#EC4899',
    secondaryHex: '#A855F7',
    accentHex: '#00F0FF',
    badgeClass: 'from-pink-500/20 to-cyan-500/20 text-pink-400 border-pink-500/30',
  },
  slate: {
    id: 'slate',
    name: 'Enterprise Slate',
    subtitle: 'Minimalist Corporate Slate',
    description: 'Refined dark slate blue-gray background with minimalist sky blue and emerald executive accents.',
    bgHex: '#0F172A',
    cardHex: '#1E293B',
    primaryHex: '#38BDF8',
    secondaryHex: '#6366F1',
    accentHex: '#10B981',
    badgeClass: 'from-sky-500/20 to-emerald-500/20 text-sky-400 border-sky-500/30',
  },
};

export function getThemePreset(id: string): ThemePreset {
  if (id in THEME_PRESETS) {
    return THEME_PRESETS[id as ThemeId];
  }
  return THEME_PRESETS.onyx;
}
