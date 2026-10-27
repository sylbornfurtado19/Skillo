/**
 * Regression and Behavioral Tests for Page Transitions & Layout Stability
 * Covers:
 * 1. Route transitions render cleanly during SSR and hydration.
 * 2. Outgoing content does not remain interactable during exit transitions (pointer-events: none).
 * 3. Reduced-motion preferences eliminate transforms and zero-out durations.
 * 4. Rapid route changes do not retain stale interactive state.
 * 5. Keyboard focus & skip-to-content accessibility remain preserved.
 * 6. Loading states render with proper accessibility roles and design tokens.
 * 7. Server rendering and hydration produce valid markup without crashing.
 * 8. Scrollbar gutter stability is enforced in CSS to prevent horizontal shifts.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'fs';
import path from 'path';
import PageTransition, { getPageVariants } from '../src/components/common/PageTransition';
import Loading from '../app/loading';
import AppLoading from '../app/(app)/loading';

describe('Page Transitions & Layout Stability', () => {
  describe('1. Server Rendering & Hydration Safety', () => {
    it('renders child content into static markup cleanly without throwing errors', () => {
      const element = React.createElement(
        PageTransition,
        null,
        React.createElement('div', { id: 'page-content' }, 'Welcome to Dashboard')
      );

      const html = renderToStaticMarkup(element);
      expect(html).toContain('id="page-content"');
      expect(html).toContain('Welcome to Dashboard');
    });

    it('applies flex-1, w-full, and min-h-full classes to prevent container height collapse', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          PageTransition,
          { className: 'custom-page-class' },
          React.createElement('span', null, 'Content')
        )
      );

      expect(html).toContain('w-full');
      expect(html).toContain('flex-1');
      expect(html).toContain('flex');
      expect(html).toContain('flex-col');
      expect(html).toContain('min-h-full');
      expect(html).toContain('custom-page-class');
    });

    it('handles nested forms, buttons, and headings without layout breaking', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          PageTransition,
          null,
          React.createElement('main', { id: 'main-content' }, [
            React.createElement('h1', { key: 'h1' }, 'Interview Practice'),
            React.createElement('form', { key: 'form' }, [
              React.createElement('input', { key: 'input', type: 'text', placeholder: 'Domain' }),
              React.createElement('button', { key: 'btn', type: 'submit' }, 'Start'),
            ]),
          ])
        )
      );

      expect(html).toContain('Interview Practice');
      expect(html).toContain('placeholder="Domain"');
      expect(html).toContain('Start');
    });
  });

  describe('2. Outgoing Content Non-Interactivity (pointer-events: none)', () => {
    it('sets pointerEvents to "none" immediately on the exit variant to prevent stale clicks', () => {
      const variants = getPageVariants(false);
      expect(variants.exit.pointerEvents).toBe('none');
    });

    it('fades out completely (opacity: 0) on exit without introducing vertical displacement jumps', () => {
      const variants = getPageVariants(false);
      expect(variants.exit.opacity).toBe(0);
      // y must remain 0 during exit so outgoing content does not shift or jump
      expect(variants.exit.y).toBe(0);
    });

    it('keeps exit duration bounded and snappy (<= 0.14s) to avoid sluggish route wait states', () => {
      const defaultVariants = getPageVariants(false, 0.2);
      expect(defaultVariants.exit.transition.duration).toBeLessThanOrEqual(0.14);
      expect(defaultVariants.exit.transition.ease).toBe('easeIn');

      const customLongVariants = getPageVariants(false, 0.5);
      expect(customLongVariants.exit.transition.duration).toBeLessThanOrEqual(0.14);
    });
  });

  describe('3. Reduced-Motion Preferences (prefers-reduced-motion)', () => {
    it('eliminates all vertical displacement (y: 0) when reduced motion is preferred', () => {
      const reducedVariants = getPageVariants(true);
      expect(reducedVariants.initial.y).toBe(0);
      expect(reducedVariants.animate.y).toBe(0);
      expect(reducedVariants.exit.y).toBe(0);
    });

    it('sets enter and exit transition durations to 0 when reduced motion is preferred', () => {
      const reducedVariants = getPageVariants(true, 0.2);
      expect(reducedVariants.animate.transition.duration).toBe(0);
      expect(reducedVariants.exit.transition.duration).toBe(0);
    });

    it('uses subtle 4px vertical settle and smooth cubic-bezier easing under standard motion', () => {
      const standardVariants = getPageVariants(false, 0.2);
      expect(standardVariants.initial.y).toBe(4);
      expect(standardVariants.animate.y).toBe(0);
      expect(standardVariants.animate.transition.duration).toBe(0.2);
      expect(standardVariants.animate.transition.ease).toEqual([0.16, 1, 0.3, 1]);
    });
  });

  describe('4. Rapid Navigation & Transition State Cleanup', () => {
    it('maintains consistent transition parameters across consecutive route transitions', () => {
      const route1Variants = getPageVariants(false, 0.2);
      const route2Variants = getPageVariants(false, 0.2);

      expect(route1Variants.exit.pointerEvents).toBe('none');
      expect(route2Variants.exit.pointerEvents).toBe('none');
      expect(route1Variants.animate.transition.duration).toEqual(route2Variants.animate.transition.duration);
    });

    it('custom duration proportionally scales enter duration while capping exit duration', () => {
      const customVariants = getPageVariants(false, 0.15);
      expect(customVariants.animate.transition.duration).toBe(0.15);
      expect(customVariants.exit.transition.duration).toBeCloseTo(0.105, 3);
      expect(customVariants.exit.pointerEvents).toBe('none');
    });
  });

  describe('5. Layout Structure & Scrollbar Shift Prevention', () => {
    it('defines scrollbar-gutter: stable in index.css to prevent horizontal layout jumping', () => {
      const cssPath = path.resolve(__dirname, '../src/index.css');
      const cssContent = fs.readFileSync(cssPath, 'utf8');

      expect(cssContent).toMatch(/scrollbar-gutter:\s*stable/);
    });

    it('AppLayout contains AnimatePresence mode="wait" wrapping PageTransition', () => {
      const appLayoutPath = path.resolve(__dirname, '../src/layouts/AppLayout.tsx');
      const content = fs.readFileSync(appLayoutPath, 'utf8');

      expect(content).toContain('<AnimatePresence mode="wait">');
      expect(content).toContain('<PageTransition key={pathname}>{children}</PageTransition>');
    });

    it('MainLayout contains AnimatePresence mode="wait" wrapping PageTransition', () => {
      const mainLayoutPath = path.resolve(__dirname, '../src/layouts/MainLayout.tsx');
      const content = fs.readFileSync(mainLayoutPath, 'utf8');

      expect(content).toContain('<AnimatePresence mode="wait">');
      expect(content).toContain('<PageTransition key={pathname}>');
    });

    it('ensures main landmark with tabIndex={-1} exists for accessible focus handoff', () => {
      const mainLayoutPath = path.resolve(__dirname, '../src/layouts/MainLayout.tsx');
      const appLayoutPath = path.resolve(__dirname, '../src/layouts/AppLayout.tsx');

      const mainContent = fs.readFileSync(mainLayoutPath, 'utf8');
      const appContent = fs.readFileSync(appLayoutPath, 'utf8');

      expect(mainContent).toContain('id="main-content"');
      expect(mainContent).toContain('tabIndex={-1}');

      expect(appContent).toContain('id="main-content"');
      expect(appContent).toContain('tabIndex={-1}');
    });
  });

  describe('6. Loading State Accessibility & Visual Consistency', () => {
    it('renders root Loading component with role="status" and aria-live="polite"', () => {
      const html = renderToStaticMarkup(React.createElement(Loading));

      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('Loading Skillo...');
      expect(html).toContain('var(--primary)');
      expect(html).toContain('var(--text-secondary)');
    });

    it('renders AppLoading component with role="status", aria-live="polite", and theme tokens', () => {
      const html = renderToStaticMarkup(React.createElement(AppLoading));

      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('Loading Workspace...');
      expect(html).toContain('var(--primary)');
      expect(html).toContain('var(--text-secondary)');
      expect(html).toContain('min-h-[50vh]');
    });
  });
});
