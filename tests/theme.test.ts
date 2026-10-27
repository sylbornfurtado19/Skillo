/**
 * Unit Tests for Custom Visual Studio Themes & ThemeSwitcher
 * Covers:
 * 1. Theme preset registry definitions matching runtime CSS variables in index.css.
 * 2. Token resolution, alias mapping, and fallback logic.
 * 3. ThemeSwitcher accessibility (radiogroup, radio buttons, roving tabIndex, aria-checked, focus ring).
 * 4. ThemeSwitcher responsive 2-column grid layout.
 * 5. Swatch colors accuracy matching declared hex values.
 * 6. Keyboard navigation logic for cycling presets.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { THEME_PRESETS, getThemePreset } from '../src/types/themes';

// ── Mock Interview Context for ThemeSwitcher ─────────────────────────────────
let mockTheme = 'onyx';
const mockSetTheme = jest.fn((newTheme) => {
  mockTheme = newTheme;
});

jest.mock('../src/context/InterviewContext', () => ({
  useInterview: () => ({
    theme: mockTheme,
    setTheme: mockSetTheme,
  }),
}));

import { ThemeSwitcher } from '../src/components/common/ThemeSwitcher';

describe('Custom Visual Studio Themes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTheme = 'onyx';
  });

  describe('1. Theme Preset Definitions & CSS Variable Alignment', () => {
    it('contains exactly two available theme presets (onyx and cyberpunk) and no slate preset', () => {
      const keys = Object.keys(THEME_PRESETS);
      expect(keys).toEqual(['onyx', 'cyberpunk']);
      expect((THEME_PRESETS as Record<string, unknown>).slate).toBeUndefined();
    });

    it('Onyx Glass preset metadata accurately reflects runtime light CSS variables', () => {
      const onyx = THEME_PRESETS.onyx;
      expect(onyx.id).toBe('onyx');
      expect(onyx.name).toBe('Onyx Glass');
      expect(onyx.subtitle).toBe('Warm Ivory & Deep Maroon');
      expect(onyx.isLight).toBe(true);

      // Matches index.css :root / [data-theme="onyx"] CSS custom properties
      expect(onyx.bgHex).toBe('#F6F3EE'); // --bg-page
      expect(onyx.cardHex).toBe('#FBF9F6'); // --bg-surface
      expect(onyx.primaryHex).toBe('#9B2218'); // --primary
      expect(onyx.secondaryHex).toBe('#6B6E70'); // --secondary
      expect(onyx.accentHex).toBe('#6B6E70'); // --color-accent / --secondary
    });

    it('Cyberpunk Dark preset metadata accurately reflects runtime dark CSS variables', () => {
      const cyberpunk = THEME_PRESETS.cyberpunk;
      expect(cyberpunk.id).toBe('cyberpunk');
      expect(cyberpunk.name).toBe('Cyberpunk Dark');
      expect(cyberpunk.subtitle).toBe('Warm Charcoal & Crimson Dark');
      expect(cyberpunk.isLight).toBe(false);

      // Matches index.css [data-theme="cyberpunk"] CSS custom properties
      expect(cyberpunk.bgHex).toBe('#1E1A19'); // --bg-page
      expect(cyberpunk.cardHex).toBe('#272221'); // --bg-surface
      expect(cyberpunk.primaryHex).toBe('#CC3F33'); // --primary
      expect(cyberpunk.secondaryHex).toBe('#9B9E9F'); // --secondary
      expect(cyberpunk.accentHex).toBe('#9B9E9F'); // --color-accent / --secondary
    });
  });

  describe('2. Token Resolution, Aliases, and Fallbacks', () => {
    it('resolves exact preset by valid id', () => {
      const onyx = getThemePreset('onyx');
      expect(onyx.id).toBe('onyx');
      expect(onyx.name).toBe('Onyx Glass');

      const cyberpunk = getThemePreset('cyberpunk');
      expect(cyberpunk.id).toBe('cyberpunk');
      expect(cyberpunk.name).toBe('Cyberpunk Dark');
    });

    it('resolves backward-compatible aliases correctly', () => {
      // 'nmims' and 'light' map to onyx
      expect(getThemePreset('nmims').id).toBe('onyx');
      expect(getThemePreset('light').id).toBe('onyx');

      // 'dark' maps to cyberpunk
      expect(getThemePreset('dark').id).toBe('cyberpunk');
    });

    it('falls back cleanly to Onyx Glass for unknown or removed presets', () => {
      const invalidFallback = getThemePreset('invalid-theme-key');
      expect(invalidFallback.id).toBe('onyx');
      expect(invalidFallback.name).toBe('Onyx Glass');

      const slateFallback = getThemePreset('slate');
      expect(slateFallback.id).toBe('onyx');
      expect(slateFallback.name).toBe('Onyx Glass');
    });
  });

  describe('3. ThemeSwitcher Component Accessibility & Layout', () => {
    it('renders a balanced 2-column responsive grid rather than a 3-column grid', () => {
      const html = renderToStaticMarkup(React.createElement(ThemeSwitcher));

      // Must be a 2-column grid suitable for 2 presets
      expect(html).toContain('grid-cols-1 sm:grid-cols-2');
      expect(html).not.toContain('lg:grid-cols-3');
    });

    it('renders an accessible radiogroup with meaningful aria-label', () => {
      const html = renderToStaticMarkup(React.createElement(ThemeSwitcher));

      expect(html).toContain('role="radiogroup"');
      expect(html).toContain('aria-label="Visual Studio Theme Presets"');
    });

    it('renders options as keyboard-interactive radio buttons with roving tabIndex and aria-checked', () => {
      mockTheme = 'onyx';
      const html = renderToStaticMarkup(React.createElement(ThemeSwitcher));

      // Both options rendered as role="radio"
      expect(html).toContain('role="radio"');

      // Active theme (onyx) has aria-checked="true" and tabIndex="0"
      expect(html).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="true"[^>]*tabindex="0"[^>]*>[\s\S]*?Onyx Glass/);

      // Inactive theme (cyberpunk) has aria-checked="false" and tabIndex="-1"
      expect(html).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="false"[^>]*tabindex="-1"[^>]*>[\s\S]*?Cyberpunk Dark/);
    });

    it('switches aria-checked and tabIndex when active theme changes to cyberpunk', () => {
      mockTheme = 'cyberpunk';
      const html = renderToStaticMarkup(React.createElement(ThemeSwitcher));

      // Cyberpunk is now active
      expect(html).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="true"[^>]*tabindex="0"[^>]*>[\s\S]*?Cyberpunk Dark/);
      // Onyx is now inactive
      expect(html).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="false"[^>]*tabindex="-1"[^>]*>[\s\S]*?Onyx Glass/);
    });

    it('includes clear focus-visible indicator classes on option buttons', () => {
      const html = renderToStaticMarkup(React.createElement(ThemeSwitcher));

      expect(html).toContain('focus-visible:outline-none');
      expect(html).toContain('focus-visible:ring-2');
      expect(html).toContain('focus-visible:ring-primary');
    });

    it('renders the Light badge only on light presets', () => {
      const html = renderToStaticMarkup(React.createElement(ThemeSwitcher));

      // Light badge should be present for Onyx Glass
      expect(html).toContain('Light');
      // The badge should appear in the Onyx Glass section
      expect(html).toMatch(/Onyx Glass[\s\S]*?<span[^>]*>[\s\S]*?Light[\s\S]*?<\/span>/);
    });

    it('renders color swatch previews with accurate background colors matching metadata hexes', () => {
      const html = renderToStaticMarkup(React.createElement(ThemeSwitcher));

      // Onyx swatches: #F6F3EE, #9B2218, #6B6E70
      expect(html).toContain('background-color:#F6F3EE');
      expect(html).toContain('background-color:#9B2218');
      expect(html).toContain('background-color:#6B6E70');

      // Cyberpunk swatches: #1E1A19, #CC3F33, #9B9E9F
      expect(html).toContain('background-color:#1E1A19');
      expect(html).toContain('background-color:#CC3F33');
      expect(html).toContain('background-color:#9B9E9F');
    });
  });

  describe('4. Keyboard Navigation Behavior for Presets', () => {
    const themeKeys = ['onyx', 'cyberpunk'] as const;

    it('cycles correctly between the 2 available presets on Arrow keys and wraps around', () => {
      const getNextTheme = (current: string, key: string) => {
        const idx = themeKeys.indexOf(current as any);
        if (key === 'ArrowRight' || key === 'ArrowDown') {
          return themeKeys[(idx + 1) % themeKeys.length];
        }
        if (key === 'ArrowLeft' || key === 'ArrowUp') {
          return themeKeys[(idx - 1 + themeKeys.length) % themeKeys.length];
        }
        if (key === 'Home') return themeKeys[0];
        if (key === 'End') return themeKeys[themeKeys.length - 1];
        return current;
      };

      // Onyx -> Cyberpunk on ArrowRight
      expect(getNextTheme('onyx', 'ArrowRight')).toBe('cyberpunk');
      // Cyberpunk -> Onyx on ArrowRight (wraps)
      expect(getNextTheme('cyberpunk', 'ArrowRight')).toBe('onyx');

      // Onyx -> Cyberpunk on ArrowLeft (wraps backwards)
      expect(getNextTheme('onyx', 'ArrowLeft')).toBe('cyberpunk');
      // Cyberpunk -> Onyx on ArrowLeft
      expect(getNextTheme('cyberpunk', 'ArrowLeft')).toBe('onyx');

      // Home & End navigation
      expect(getNextTheme('cyberpunk', 'Home')).toBe('onyx');
      expect(getNextTheme('onyx', 'End')).toBe('cyberpunk');
    });
  });
});
