/**
 * Focused Unit Tests for Landing View FAQ Copy
 * Verifies that:
 * 1. The backend FAQ accurately describes the Next.js App Router API architecture.
 * 2. Outdated references to FastAPI and the nonexistent backend/ directory are removed.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

jest.mock('next/image', () => (props: any) => React.createElement('img', props));

jest.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, prop) => ({ children, whileInView, whileHover, whileTap, initial, animate, exit, transition, viewport, ...domProps }: any) =>
        React.createElement(typeof prop === 'string' ? prop : 'div', domProps, children),
    }
  ),
  AnimatePresence: ({ children }: any) => children,
}));

import Landing from '../src/views/Landing';

describe('Landing View FAQ', () => {
  it('renders accurate Next.js App Router backend architecture copy in FAQ when expanded', () => {
    const origUseState = React.useState;
    const useStateSpy = jest.spyOn(React, 'useState').mockImplementation(((init: any) => {
      if (init === null) {
        return [3, jest.fn()];
      }
      return origUseState(init);
    }) as any);

    const html = renderToStaticMarkup(React.createElement(Landing));
    useStateSpy.mockRestore();

    // Must render the question
    expect(html).toContain('Is there a backend I can connect?');

    // Must describe Next.js App Router API architecture
    expect(html).toContain('Next.js App Router');
    expect(html).toContain('app/api/');
    expect(html).toContain('without needing a separate backend server');

    // Must NOT contain outdated FastAPI or backend/ folder references
    expect(html).not.toContain('FastAPI');
    expect(html).not.toContain('backend/ folder');
  });

  it('does not contain FastAPI or backend/ anywhere in the unexpanded markup', () => {
    const html = renderToStaticMarkup(React.createElement(Landing));

    expect(html).toContain('Is there a backend I can connect?');
    expect(html).not.toContain('FastAPI');
    expect(html).not.toContain('backend/ folder');
  });
});
