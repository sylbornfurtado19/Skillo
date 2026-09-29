/**
 * Focused Unit Tests for AuthProvider SSR Behavior
 * Verifies that:
 * 1. AuthProvider children render during server-side rendering (SSR),
 *    preventing empty HTML shells.
 * 2. Child components consuming useAuth() receive the initial loading state during SSR.
 * 3. ProtectedRoute handling displays the loading state during SSR when wrapped inside AuthProvider.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import ProtectedRoute from '../src/components/common/ProtectedRoute';

// Mock Next.js navigation for ProtectedRoute
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/dashboard',
}));

// Mock Supabase
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
  },
  isSupabaseConfigured: false,
}));

describe('AuthProvider SSR Behavior', () => {
  it('renders children into static markup during SSR (prevents empty HTML shell)', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        AuthProvider,
        null,
        React.createElement('div', { id: 'test-child' }, 'Hello SSR Application')
      )
    );

    expect(html).toContain('id="test-child"');
    expect(html).toContain('Hello SSR Application');
  });

  it('provides initial loading state to consuming children during SSR without withholding output', () => {
    function AuthConsumerChild() {
      const { loading, isAuthenticated, user } = useAuth();
      return React.createElement(
        'div',
        { id: 'auth-status' },
        `Loading: ${loading}, Auth: ${isAuthenticated}, User: ${user === null ? 'null' : 'defined'}`
      );
    }

    const html = renderToStaticMarkup(
      React.createElement(AuthProvider, null, React.createElement(AuthConsumerChild))
    );

    expect(html).toContain('id="auth-status"');
    expect(html).toContain('Loading: true');
    expect(html).toContain('Auth: false');
    expect(html).toContain('User: null');
  });

  it('allows ProtectedRoute to render its loading shell instead of an empty document during SSR', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        AuthProvider,
        null,
        React.createElement(
          ProtectedRoute,
          null,
          React.createElement('div', { id: 'protected-content' }, 'Secret Dashboard')
        )
      )
    );

    // ProtectedRoute renders its loading spinner during initial loading / SSR
    expect(html).toContain('animate-spin');
    // Protected content is safely shielded while loading
    expect(html).not.toContain('Secret Dashboard');
  });
});
