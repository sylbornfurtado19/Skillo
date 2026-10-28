import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AnimatedScore from '../src/components/ui/AnimatedScore';

jest.mock('framer-motion', () => ({
  useReducedMotion: () => false,
}));

describe('AnimatedScore Component', () => {
  it('renders target value in server static markup', () => {
    const html = renderToStaticMarkup(
      React.createElement(AnimatedScore, { value: 85, suffix: '%' })
    );
    expect(html).toContain('85%');
  });

  it('renders prefix and decimals correctly', () => {
    const html = renderToStaticMarkup(
      React.createElement(AnimatedScore, { value: 4.2, prefix: '+', decimals: 1, suffix: ' pts' })
    );
    expect(html).toContain('+4.2 pts');
  });
});

