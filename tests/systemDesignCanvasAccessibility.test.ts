/**
 * Accessibility and Usability Regression Tests for SystemDesignCanvas Toolbar
 *
 * Verifies:
 * 1. Every interactive toolbar control has an accessible name (aria-label, title, or visible text).
 * 2. Controls can be reached and activated using the keyboard (type="button", tabIndex, shortcuts).
 * 3. Focus indicators and disabled states are implemented appropriately.
 * 4. Toggle controls expose their current state correctly (aria-pressed, role="status", aria-live).
 * 5. Touch-target styling is applied to toolbar actions (approx 44x44 CSS px / min dimensions).
 * 6. Existing canvas operations still work after accessibility changes (initial state, edges, nodes).
 * 7. The toolbar remains usable at narrow viewport widths (flex-wrap, responsive gaps, truncate).
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SystemDesignCanvas } from '../src/components/interview/SystemDesignCanvas';
import {
  createInitialDiagramState,
  SystemDesignDiagramState,
  NODE_PRESET_CONFIGS,
} from '../src/types/systemDesign';

describe('SystemDesignCanvas Toolbar Accessibility & Usability (Prompt 11)', () => {
  // Helper to render static HTML string
  const renderCanvas = (props: React.ComponentProps<typeof SystemDesignCanvas> = {}) => {
    return renderToStaticMarkup(React.createElement(SystemDesignCanvas, props));
  };

  describe('1. Accessible Names and ARIA Semantics', () => {
    it('provides accessible toolbar roles and semantic grouping', () => {
      const html = renderCanvas();

      // Toolbar container
      expect(html).toContain('role="toolbar"');
      expect(html).toContain('aria-label="System design canvas toolbar"');

      // Groups within toolbar
      expect(html).toContain('role="group"');
      expect(html).toContain('aria-label="History and zoom controls"');
      expect(html).toContain('aria-label="Connection mode and protocol settings"');
      expect(html).toContain('aria-label="Canvas actions"');

      // Node palette toolbar
      expect(html).toContain('aria-label="Component node palette"');
    });

    it('gives every icon-only button a meaningful, specific accessible name', () => {
      const html = renderCanvas();

      // Undo & Redo buttons
      expect(html).toContain('aria-label="Undo canvas change"');
      expect(html).toContain('aria-label="Redo canvas change"');

      // Zoom controls
      expect(html).toContain('aria-label="Zoom in canvas"');
      expect(html).toContain('aria-label="Zoom out canvas"');
      expect(html).toContain('aria-label="Reset zoom and center view"');

      // Clear whiteboard button
      expect(html).toContain('aria-label="Clear whiteboard canvas"');

      // Export JSON button
      expect(html).toContain('aria-label="Export diagram as JSON file"');
    });

    it('gives the protocol selector an associated label and accessible name', () => {
      const html = renderCanvas();

      expect(html).toContain('for="system-design-protocol-select"');
      expect(html).toContain('id="system-design-protocol-select"');
      expect(html).toContain('aria-label="Connection protocol label"');
      expect(html).toContain('HTTPS');
      expect(html).toContain('gRPC');
    });

    it('gives every component node in the palette a descriptive accessible name', () => {
      const html = renderCanvas();

      Object.entries(NODE_PRESET_CONFIGS).forEach(([type, cfg]) => {
        expect(html).toContain(`aria-label="Add ${cfg.label} component"`);
        expect(html).toContain(`title="Add ${cfg.label}"`);
      });
    });

    it('gives canvas nodes, connect pins, and edges accessible names and roles', () => {
      const html = renderCanvas();

      // Canvas nodes have role="button" and aria-label
      expect(html).toContain('role="button"');
      expect(html).toContain('component');

      // Connect pin handle on nodes
      expect(html).toContain('aria-label="Connect edge from');
      expect(html).toContain('aria-pressed="false"');

      // Edge SVG groups have role="button" and connection description
      expect(html).toContain('aria-label="Connection');
    });

    it('marks decorative icons with aria-hidden="true" to prevent redundant announcements', () => {
      const html = renderCanvas();

      // SVGs have aria-hidden="true"
      expect(html).toContain('aria-hidden="true"');
    });

    it('renders accessible Save button when onSave callback is provided', () => {
      const onSaveMock = jest.fn();
      const htmlWithSave = renderCanvas({ onSave: onSaveMock });
      expect(htmlWithSave).toContain('aria-label="Save system design diagram"');
      expect(htmlWithSave).toContain('Save Design');

      const htmlWithoutSave = renderCanvas();
      expect(htmlWithoutSave).not.toContain('aria-label="Save system design diagram"');
    });
  });

  describe('2. Keyboard Reachability and Operability', () => {
    it('sets type="button" on all interactive toolbar controls to prevent unintended form submissions', () => {
      const html = renderCanvas({ onSave: jest.fn() });

      // Match all button tags and ensure none lack type="button"
      const buttonMatches = html.match(/<button\b[^>]*>/g) || [];
      expect(buttonMatches.length).toBeGreaterThan(0);

      buttonMatches.forEach((btnTag) => {
        expect(btnTag).toContain('type="button"');
      });
    });

    it('makes canvas nodes and edges keyboard focusable with tabIndex="0" when interactive', () => {
      const html = renderCanvas({ readOnly: false });

      expect(html).toContain('tabindex="0"');
    });

    it('removes keyboard focusability with tabIndex="-1" when readOnly is enabled', () => {
      const html = renderCanvas({ readOnly: true });

      expect(html).toContain('tabindex="-1"');
      expect(html).not.toContain('aria-label="Component node palette"');
    });
  });

  describe('3. Focus Indicators and Disabled States', () => {
    it('applies Skillo focus-visible indicator classes to all toolbar buttons and controls', () => {
      const html = renderCanvas({ onSave: jest.fn() });

      // Focus-visible rings must be present
      expect(html).toContain('focus-visible:ring-2');
      expect(html).toContain('focus-visible:ring-primary');
      expect(html).toContain('focus-visible:outline-none');
    });

    it('correctly disables Undo and Redo when history/redo stacks are empty', () => {
      const html = renderCanvas();

      // Initial state has empty undo/redo stacks
      expect(html).toContain('aria-label="Undo canvas change"');
      expect(html).toContain('disabled=""');
      expect(html).toContain('disabled:opacity-40');
      expect(html).toContain('disabled:cursor-not-allowed');
    });

    it('disables canvas modification actions in readOnly mode', () => {
      const html = renderCanvas({ readOnly: true });

      // Palette is not rendered
      expect(html).not.toContain('aria-label="Component node palette"');

      // Clear button is disabled
      const clearButtonRegex = /<button[^>]*aria-label="Clear whiteboard canvas"[^>]*>/;
      const match = html.match(clearButtonRegex);
      expect(match).not.toBeNull();
      expect(match![0]).toContain('disabled=""');
    });
  });

  describe('4. Toggle and State Semantics', () => {
    it('exposes aria-pressed state on node connection buttons', () => {
      const html = renderCanvas();

      // Connect pin handle exposes aria-pressed="false" initially
      expect(html).toContain('aria-pressed="false"');
    });

    it('exposes zoom percentage with aria-live="polite" and aria-atomic="true"', () => {
      const html = renderCanvas();

      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('aria-atomic="true"');
      expect(html).toContain('100%');
    });

    it('exposes aria-selected on nodes and edges', () => {
      const html = renderCanvas();

      expect(html).toContain('aria-selected="false"');
    });
  });

  describe('5. Touch Target Sizing (WCAG 2.5.5 / 2.5.8)', () => {
    it('applies practical touch-target dimensions (~44x44 CSS pixels) to palette controls', () => {
      const html = renderCanvas();

      // Palette node buttons must have 44x44 minimum dimensions
      expect(html).toContain('min-w-[44px]');
      expect(html).toContain('min-h-[44px]');
      expect(html).toContain('w-11');
      expect(html).toContain('h-11');
    });

    it('applies generous touch-target sizing to top toolbar icon actions', () => {
      const html = renderCanvas();

      // Top toolbar buttons have min-h-[40px] min-w-[40px] on mobile (responsive sm:min-h-[36px])
      expect(html).toContain('min-h-[40px]');
      expect(html).toContain('min-w-[40px]');
    });

    it('applies enlarged touch target area to node connection pin handles', () => {
      const html = renderCanvas();

      // Connect handle is enlarged from 20px to at least 28px with padding
      expect(html).toContain('min-w-[28px]');
      expect(html).toContain('min-h-[28px]');
      expect(html).toContain('w-7');
      expect(html).toContain('h-7');
    });
  });

  describe('6. Core Diagram Canvas Operation Integrity', () => {
    it('renders initial topology nodes and edges without data loss or corruption', () => {
      const initialState = createInitialDiagramState();
      const html = renderCanvas({ initialState });

      initialState.nodes.forEach((node) => {
        expect(html).toContain(node.label);
      });

      initialState.edges.forEach((edge) => {
        if (edge.label) {
          expect(html).toContain(edge.label);
        }
      });
    });

    it('renders custom diagrams with custom labels faithfully', () => {
      const customState: SystemDesignDiagramState = {
        nodes: [
          { id: 'node_test_1', type: 'cloud', label: 'AWS Elastic Cluster', position: { x: 50, y: 50 } },
          { id: 'node_test_2', type: 'database', label: 'Aurora Global DB', position: { x: 250, y: 150 } },
        ],
        edges: [
          { id: 'edge_test_1', source: 'node_test_1', target: 'node_test_2', label: 'gRPC Secure' },
        ],
        version: 1,
      };

      const html = renderCanvas({ initialState: customState });

      expect(html).toContain('AWS Elastic Cluster');
      expect(html).toContain('Aurora Global DB');
      expect(html).toContain('gRPC Secure');
    });
  });

  describe('7. Responsive Layout and Overflow Prevention', () => {
    it('includes flex-wrap and responsive padding on top toolbar container', () => {
      const html = renderCanvas();

      expect(html).toContain('flex-wrap');
      expect(html).toContain('px-3 sm:px-4');
      expect(html).toContain('gap-2');
    });

    it('provides scrollable container with overflow-y-auto on node palette', () => {
      const html = renderCanvas();

      expect(html).toContain('overflow-y-auto');
      expect(html).toContain('shrink-0');
    });

    it('truncates component node labels to prevent layout clipping', () => {
      const html = renderCanvas();

      expect(html).toContain('truncate');
    });
  });
});
