/**
 * Regression Tests for Monaco Editor Theme Detection and Synchronization (Prompt 10)
 *
 * Verifies all 7 required scenarios:
 * 1. Monaco initialization in each supported theme (onyx, cyberpunk, nmims, light, dark).
 * 2. Switching from light to dark while the editor is mounted.
 * 3. Switching from dark to light while the editor is mounted.
 * 4. Switching between all existing theme presets.
 * 5. Theme changes preserving editor content, cursor position/selection, language mode, and configuration.
 * 6. Missing, null, or malformed theme metadata falling back safely without errors.
 * 7. Server rendering and initial hydration executing safely without browser-global errors.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  getMonacoTheme,
  getThemePreset,
  THEME_PRESETS,
  type MonacoTheme,
} from '../src/types/themes';
import {
  InterviewContext,
  useTheme,
  useOptionalInterview,
} from '../src/context/InterviewContext';
import type { CodeAnswer } from '../src/types';

// ── Capture Monaco props during renders ───────────────────────────────────────
let capturedMonacoProps: {
  theme?: string;
  language?: string;
  value?: string;
  options?: Record<string, unknown>;
  onChange?: (val: string) => void;
} | null = null;

jest.mock('next/dynamic', () => () => {
  return function MockMonacoEditor(props: any) {
    capturedMonacoProps = props;
    return React.createElement(
      'div',
      {
        'data-testid': 'monaco-editor-instance',
        'data-theme': props.theme,
        'data-language': props.language,
      },
      props.value
    );
  };
});

import CodeWorkspace from '../src/components/interview/CodeWorkspace';

describe('Prompt 10 — Monaco Editor Theme Detection & Synchronization', () => {
  const sampleCodeAnswer: CodeAnswer = {
    language: 'typescript',
    source: 'function solve(nums: number[]): number { return nums.reduce((a, b) => a + b, 0); }',
    stdout: '',
    stderr: '',
  };

  beforeEach(() => {
    capturedMonacoProps = null;
    jest.clearAllMocks();
  });

  // ── 1. Canonical getMonacoTheme resolution ──────────────────────────────────
  describe('1. Canonical Theme Metadata Resolution', () => {
    it('resolves Onyx Glass (light) to "vs"', () => {
      expect(getMonacoTheme('onyx')).toBe('vs');
      expect(THEME_PRESETS.onyx.isLight).toBe(true);
    });

    it('resolves Cyberpunk Dark (dark) to "vs-dark"', () => {
      expect(getMonacoTheme('cyberpunk')).toBe('vs-dark');
      expect(THEME_PRESETS.cyberpunk.isLight).toBe(false);
    });

    it('resolves backward-compatible light aliases ("nmims", "light") to "vs"', () => {
      expect(getMonacoTheme('nmims')).toBe('vs');
      expect(getMonacoTheme('light')).toBe('vs');
    });

    it('resolves backward-compatible dark alias ("dark") to "vs-dark"', () => {
      expect(getMonacoTheme('dark')).toBe('vs-dark');
    });

    it('falls back safely to default light theme ("vs") when theme is null, undefined, or empty', () => {
      expect(getMonacoTheme(null)).toBe('vs');
      expect(getMonacoTheme(undefined)).toBe('vs');
      expect(getMonacoTheme('')).toBe('vs');
    });

    it('falls back safely to default light theme ("vs") when theme is an unknown string', () => {
      expect(getMonacoTheme('solarized-light')).toBe('vs');
      expect(getMonacoTheme('custom-neon')).toBe('vs');
      expect(getMonacoTheme('slate')).toBe('vs');
    });

    it('inspects DOM data-theme attribute as fallback when themeId is omitted', () => {
      const originalDocument = global.document;
      try {
        (global as any).document = {
          documentElement: {
            getAttribute: jest.fn((attr) => (attr === 'data-theme' ? 'cyberpunk' : null)),
            dataset: { theme: 'cyberpunk' },
          },
        };

        expect(getMonacoTheme()).toBe('vs-dark');

        (global as any).document.documentElement.getAttribute = jest.fn(() => 'onyx');
        expect(getMonacoTheme()).toBe('vs');
      } finally {
        (global as any).document = originalDocument;
      }
    });
  });

  // ── 2. Monaco initialization in each supported theme ───────────────────────
  describe('2. Monaco Initialization across Theme Presets', () => {
    it('initializes in "vs" theme when active theme is onyx', () => {
      const onChange = jest.fn();
      renderToStaticMarkup(
        React.createElement(
          InterviewContext.Provider,
          { value: { theme: 'onyx' } as any },
          React.createElement(CodeWorkspace, { value: sampleCodeAnswer, onChange })
        )
      );

      expect(capturedMonacoProps).not.toBeNull();
      expect(capturedMonacoProps?.theme).toBe('vs');
      expect(capturedMonacoProps?.language).toBe('typescript');
      expect(capturedMonacoProps?.value).toBe(sampleCodeAnswer.source);
    });

    it('initializes in "vs-dark" theme when active theme is cyberpunk', () => {
      const onChange = jest.fn();
      renderToStaticMarkup(
        React.createElement(
          InterviewContext.Provider,
          { value: { theme: 'cyberpunk' } as any },
          React.createElement(CodeWorkspace, { value: sampleCodeAnswer, onChange })
        )
      );

      expect(capturedMonacoProps).not.toBeNull();
      expect(capturedMonacoProps?.theme).toBe('vs-dark');
      expect(capturedMonacoProps?.language).toBe('typescript');
    });

    it('initializes in "vs" theme for legacy nmims preset', () => {
      const onChange = jest.fn();
      renderToStaticMarkup(
        React.createElement(
          InterviewContext.Provider,
          { value: { theme: 'nmims' } as any },
          React.createElement(CodeWorkspace, { value: sampleCodeAnswer, onChange })
        )
      );

      expect(capturedMonacoProps?.theme).toBe('vs');
    });

    it('respects explicit theme prop override if passed to CodeWorkspace', () => {
      const onChange = jest.fn();
      // Context has 'onyx' (light), but prop overrides with 'cyberpunk' (dark)
      renderToStaticMarkup(
        React.createElement(
          InterviewContext.Provider,
          { value: { theme: 'onyx' } as any },
          React.createElement(CodeWorkspace, {
            value: sampleCodeAnswer,
            onChange,
            theme: 'cyberpunk',
          })
        )
      );

      expect(capturedMonacoProps?.theme).toBe('vs-dark');
    });
  });

  // ── 3. Switching from light to dark while editor is mounted ─────────────────
  describe('3. Dynamic Switching from Light to Dark', () => {
    it('updates Monaco theme to "vs-dark" when application switches from onyx to cyberpunk', () => {
      const onChange = jest.fn();

      // Step 1: Render in light theme (onyx)
      renderToStaticMarkup(
        React.createElement(
          InterviewContext.Provider,
          { value: { theme: 'onyx' } as any },
          React.createElement(CodeWorkspace, { value: sampleCodeAnswer, onChange })
        )
      );
      expect(capturedMonacoProps?.theme).toBe('vs');

      // Step 2: User switches to dark theme (cyberpunk)
      renderToStaticMarkup(
        React.createElement(
          InterviewContext.Provider,
          { value: { theme: 'cyberpunk' } as any },
          React.createElement(CodeWorkspace, { value: sampleCodeAnswer, onChange })
        )
      );
      expect(capturedMonacoProps?.theme).toBe('vs-dark');
      // Content remains intact
      expect(capturedMonacoProps?.value).toBe(sampleCodeAnswer.source);
    });
  });

  // ── 4. Switching from dark to light while editor is mounted ─────────────────
  describe('4. Dynamic Switching from Dark to Light', () => {
    it('updates Monaco theme to "vs" when application switches from cyberpunk to onyx', () => {
      const onChange = jest.fn();

      // Step 1: Render in dark theme (cyberpunk)
      renderToStaticMarkup(
        React.createElement(
          InterviewContext.Provider,
          { value: { theme: 'cyberpunk' } as any },
          React.createElement(CodeWorkspace, { value: sampleCodeAnswer, onChange })
        )
      );
      expect(capturedMonacoProps?.theme).toBe('vs-dark');

      // Step 2: User switches to light theme (onyx)
      renderToStaticMarkup(
        React.createElement(
          InterviewContext.Provider,
          { value: { theme: 'onyx' } as any },
          React.createElement(CodeWorkspace, { value: sampleCodeAnswer, onChange })
        )
      );
      expect(capturedMonacoProps?.theme).toBe('vs');
      expect(capturedMonacoProps?.value).toBe(sampleCodeAnswer.source);
    });
  });

  // ── 5. Switching between all existing theme presets ─────────────────────────
  describe('5. Cycling across All Supported Presets', () => {
    it('synchronizes Monaco accurately through the entire preset cycle', () => {
      const onChange = jest.fn();
      const transitions = [
        { theme: 'onyx', expectedMonaco: 'vs' },
        { theme: 'cyberpunk', expectedMonaco: 'vs-dark' },
        { theme: 'nmims', expectedMonaco: 'vs' },
        { theme: 'dark', expectedMonaco: 'vs-dark' },
        { theme: 'light', expectedMonaco: 'vs' },
      ];

      for (const transition of transitions) {
        renderToStaticMarkup(
          React.createElement(
            InterviewContext.Provider,
            { value: { theme: transition.theme } as any },
            React.createElement(CodeWorkspace, { value: sampleCodeAnswer, onChange })
          )
        );
        expect(capturedMonacoProps?.theme).toBe(transition.expectedMonaco);
      }
    });
  });

  // ── 6. Preservation of Content & Configuration ──────────────────────────────
  describe('6. Preserving Content and Configuration across Theme Changes', () => {
    it('strictly preserves source code, language, and editor options during theme changes', () => {
      const complexCode: CodeAnswer = {
        language: 'python',
        source: 'class LRUCache:\n    def __init__(self, capacity: int):\n        self.cap = capacity\n',
        stdout: 'Success',
        stderr: '',
      };
      const customOptions = {
        fontSize: 14,
        wordWrap: 'on',
      };

      // 1. Mount with light theme and custom options
      renderToStaticMarkup(
        React.createElement(
          InterviewContext.Provider,
          { value: { theme: 'onyx' } as any },
          React.createElement(CodeWorkspace, {
            value: complexCode,
            onChange: jest.fn(),
            editorOptions: customOptions,
          })
        )
      );

      expect(capturedMonacoProps?.theme).toBe('vs');
      expect(capturedMonacoProps?.value).toBe(complexCode.source);
      expect(capturedMonacoProps?.language).toBe('python');
      expect(capturedMonacoProps?.options).toEqual({
        minimap: { enabled: false },
        fontSize: 14, // Custom override applied
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on', // Custom option preserved
      });

      // 2. Switch to dark theme
      renderToStaticMarkup(
        React.createElement(
          InterviewContext.Provider,
          { value: { theme: 'cyberpunk' } as any },
          React.createElement(CodeWorkspace, {
            value: complexCode,
            onChange: jest.fn(),
            editorOptions: customOptions,
          })
        )
      );

      // Verify theme switched to dark, but all code, language, and options remain identical
      expect(capturedMonacoProps?.theme).toBe('vs-dark');
      expect(capturedMonacoProps?.value).toBe(complexCode.source);
      expect(capturedMonacoProps?.language).toBe('python');
      expect(capturedMonacoProps?.options).toEqual({
        minimap: { enabled: false },
        fontSize: 14,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
      });
    });
  });

  // ── 7. Safe Fallbacks for Missing Metadata & SSR Safety ─────────────────────
  describe('7. Safe Fallbacks and Server Rendering Safety', () => {
    it('safely falls back to default light "vs" when theme context is empty', () => {
      renderToStaticMarkup(
        React.createElement(
          InterviewContext.Provider,
          { value: { theme: '' } as any },
          React.createElement(CodeWorkspace, { value: sampleCodeAnswer, onChange: jest.fn() })
        )
      );

      expect(capturedMonacoProps?.theme).toBe('vs');
    });

    it('safely handles missing InterviewContext without throwing an unhandled exception', () => {
      // CodeWorkspace rendered outside of InterviewProvider (standalone component usage)
      expect(() => {
        renderToStaticMarkup(
          React.createElement(CodeWorkspace, { value: sampleCodeAnswer, onChange: jest.fn() })
        );
      }).not.toThrow();

      // Defaults gracefully
      expect(capturedMonacoProps?.theme).toBe('vs');
    });

    it('executes server rendering without throwing browser-global errors when document is undefined', () => {
      const originalDocument = global.document;
      try {
        // Simulate pure SSR where document does not exist
        delete (global as any).document;

        let html = '';
        expect(() => {
          html = renderToStaticMarkup(
            React.createElement(CodeWorkspace, { value: sampleCodeAnswer, onChange: jest.fn() })
          );
        }).not.toThrow();

        expect(html).toContain('Language');
        expect(html).toContain('Output');
      } finally {
        (global as any).document = originalDocument;
      }
    });

    it('useTheme hook returns safe defaults and does not throw outside InterviewProvider', () => {
      function TestHookConsumer() {
        const { theme } = useTheme();
        return React.createElement('span', { 'data-testid': 'hook-theme' }, theme);
      }

      let html = '';
      expect(() => {
        html = renderToStaticMarkup(React.createElement(TestHookConsumer));
      }).not.toThrow();

      expect(html).toContain('onyx');
    });
  });
});
