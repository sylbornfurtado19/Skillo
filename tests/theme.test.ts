/**
 * Unit Tests for Custom Visual Studio Themes
 * Covers: Theme preset registry definitions, token resolution, fallback logic.
 */

import { THEME_PRESETS, getThemePreset } from '../src/types/themes';

describe('Custom Visual Studio Themes', () => {
  it('should contain all 3 custom visual studio theme presets', () => {
    expect(THEME_PRESETS.onyx).toBeDefined();
    expect(THEME_PRESETS.cyberpunk).toBeDefined();
    expect(THEME_PRESETS.slate).toBeDefined();
  });

  it('Onyx Glass preset should have deep space black background (#030712)', () => {
    const onyx = THEME_PRESETS.onyx;
    expect(onyx.name).toBe('Onyx Glass');
    expect(onyx.bgHex).toBe('#030712');
    expect(onyx.primaryHex).toBe('#6366F1');
  });

  it('Cyberpunk Dark preset should have synthwave background (#090414) and hot pink accent (#EC4899)', () => {
    const cyberpunk = THEME_PRESETS.cyberpunk;
    expect(cyberpunk.name).toBe('Cyberpunk Dark');
    expect(cyberpunk.bgHex).toBe('#090414');
    expect(cyberpunk.primaryHex).toBe('#EC4899');
  });

  it('Enterprise Slate preset should have executive slate background (#0F172A)', () => {
    const slate = THEME_PRESETS.slate;
    expect(slate.name).toBe('Enterprise Slate');
    expect(slate.bgHex).toBe('#0F172A');
    expect(slate.primaryHex).toBe('#38BDF8');
  });

  it('getThemePreset should resolve exact preset by valid id', () => {
    const preset = getThemePreset('cyberpunk');
    expect(preset.id).toBe('cyberpunk');
    expect(preset.name).toBe('Cyberpunk Dark');
  });

  it('getThemePreset should fallback cleanly to Onyx Glass when given unknown theme id', () => {
    const fallback = getThemePreset('invalid-theme-key');
    expect(fallback.id).toBe('onyx');
    expect(fallback.name).toBe('Onyx Glass');
  });
});
