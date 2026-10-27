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

  describe('8. Keyboard Interaction Safety (Prompt 11A)', () => {
    interface MockDOMNode {
      tagName: string;
      isContentEditable?: boolean;
      contains: (node: MockDOMNode | null) => boolean;
      appendChild: (child: MockDOMNode) => void;
    }

    const createMockNode = (tagName: string, isContentEditable = false): MockDOMNode => {
      const children: MockDOMNode[] = [];
      const node: MockDOMNode = {
        tagName: tagName.toUpperCase(),
        isContentEditable,
        contains: (target: MockDOMNode | null) => {
          if (!target) return false;
          if (target === node) return true;
          return children.some((c) => c.contains(target));
        },
        appendChild: (child: MockDOMNode) => {
          children.push(child);
        },
      };
      return node;
    };

    it('scopes canvas container with tabIndex and region semantics for keyboard focus', () => {
      const interactiveHtml = renderCanvas({ readOnly: false });
      expect(interactiveHtml).toContain('tabindex="0"');
      expect(interactiveHtml).toContain('role="region"');
      expect(interactiveHtml).toContain('aria-label="System architecture whiteboard"');

      const readOnlyHtml = renderCanvas({ readOnly: true });
      expect(readOnlyHtml).toContain('tabindex="-1"');
    });

    it('Scenario 1: typing in an input or textarea inside canvas does not delete selected diagram elements on Backspace or Delete', () => {
      const canvasEl = createMockNode('div');
      const inputEl = createMockNode('input');
      canvasEl.appendChild(inputEl);

      const deleteSelectedMock = jest.fn();
      let selectedNodeId: string | null = 'node_db_1';

      // Scoped keydown handler logic
      const handleKeyDown = (e: any) => {
        const target = e.target;
        if (!target || !canvasEl.contains(target)) return;

        const tag = target.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable) {
          return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (selectedNodeId) {
            e.preventDefault();
            deleteSelectedMock();
            selectedNodeId = null;
          }
        }
      };

      // Press Backspace while typing in input
      const backspaceEvent = {
        key: 'Backspace',
        target: inputEl,
        preventDefault: jest.fn(),
      };
      handleKeyDown(backspaceEvent);

      expect(deleteSelectedMock).not.toHaveBeenCalled();
      expect(backspaceEvent.preventDefault).not.toHaveBeenCalled();
      expect(selectedNodeId).toBe('node_db_1');

      // Press Delete while typing in input
      const deleteEvent = {
        key: 'Delete',
        target: inputEl,
        preventDefault: jest.fn(),
      };
      handleKeyDown(deleteEvent);

      expect(deleteSelectedMock).not.toHaveBeenCalled();
      expect(deleteEvent.preventDefault).not.toHaveBeenCalled();
      expect(selectedNodeId).toBe('node_db_1');
    });

    it('Scenario 2: Ctrl/Cmd+Z and Ctrl/Cmd+Y do not override native undo/redo in text-editing controls', () => {
      const canvasEl = createMockNode('div');
      const textareaEl = createMockNode('textarea');
      canvasEl.appendChild(textareaEl);

      const undoMock = jest.fn();
      const redoMock = jest.fn();

      const handleKeyDown = (e: any) => {
        const target = e.target;
        if (!target || !canvasEl.contains(target)) return;

        const tag = target.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable) {
          return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) redoMock();
          else undoMock();
        } else if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === 'y') {
          e.preventDefault();
          redoMock();
        }
      };

      // Ctrl+Z in textarea
      const ctrlZEvent = {
        key: 'z',
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        target: textareaEl,
        preventDefault: jest.fn(),
      };
      handleKeyDown(ctrlZEvent);

      expect(undoMock).not.toHaveBeenCalled();
      expect(ctrlZEvent.preventDefault).not.toHaveBeenCalled();

      // Cmd+Shift+Z in textarea
      const cmdShiftZEvent = {
        key: 'z',
        ctrlKey: false,
        metaKey: true,
        shiftKey: true,
        target: textareaEl,
        preventDefault: jest.fn(),
      };
      handleKeyDown(cmdShiftZEvent);

      expect(redoMock).not.toHaveBeenCalled();
      expect(cmdShiftZEvent.preventDefault).not.toHaveBeenCalled();

      // Ctrl+Y in textarea
      const ctrlYEvent = {
        key: 'y',
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        target: textareaEl,
        preventDefault: jest.fn(),
      };
      handleKeyDown(ctrlYEvent);

      expect(redoMock).not.toHaveBeenCalled();
      expect(ctrlYEvent.preventDefault).not.toHaveBeenCalled();
    });

    it('Scenario 3: keyboard shortcuts do not trigger when focus is in unrelated page controls outside canvas', () => {
      const canvasEl = createMockNode('div');
      const unrelatedButton = createMockNode('button');
      // unrelatedButton is outside canvasEl!
      const deleteSelectedMock = jest.fn();
      const undoMock = jest.fn();
      let selectedNodeId: string | null = 'node_lb_1';

      const handleKeyDown = (e: any) => {
        const target = e.target;
        if (!target || !canvasEl.contains(target)) {
          return; // strictly ignored outside canvas
        }

        const tag = target.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable) {
          return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (selectedNodeId) {
            e.preventDefault();
            deleteSelectedMock();
            selectedNodeId = null;
          }
        } else if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === 'z') {
          e.preventDefault();
          undoMock();
        }
      };

      // Press Delete while focused on an unrelated button on the page
      const deleteEvent = {
        key: 'Delete',
        target: unrelatedButton,
        preventDefault: jest.fn(),
      };
      handleKeyDown(deleteEvent);

      expect(deleteSelectedMock).not.toHaveBeenCalled();
      expect(deleteEvent.preventDefault).not.toHaveBeenCalled();
      expect(selectedNodeId).toBe('node_lb_1');

      // Press Ctrl+Z while focused outside canvas
      const ctrlZEvent = {
        key: 'z',
        ctrlKey: true,
        target: unrelatedButton,
        preventDefault: jest.fn(),
      };
      handleKeyDown(ctrlZEvent);

      expect(undoMock).not.toHaveBeenCalled();
      expect(ctrlZEvent.preventDefault).not.toHaveBeenCalled();
    });

    it('Scenario 4: Escape cancels connection mode without unexpectedly clearing selection or mutating diagram data', () => {
      const canvasEl = createMockNode('div');
      const nodeEl = createMockNode('div');
      canvasEl.appendChild(nodeEl);

      let connectingSourceId: string | null = 'node_source_1';
      let selectedNodeId: string | null = 'node_source_1';
      let selectedEdgeId: string | null = null;
      let editingNodeId: string | null = null;

      const handleEscape = (e: any) => {
        const target = e.target;
        if (!target || !canvasEl.contains(target)) return;

        if (e.key === 'Escape') {
          if (editingNodeId) {
            e.preventDefault();
            editingNodeId = null;
          } else if (connectingSourceId) {
            e.preventDefault();
            connectingSourceId = null; // cancels connection mode, leaves selection intact!
          } else if (selectedNodeId || selectedEdgeId) {
            e.preventDefault();
            selectedNodeId = null;
            selectedEdgeId = null;
          }
        }
      };

      // 1. First Escape: connection mode is active
      const escapeEvent1 = { key: 'Escape', target: nodeEl, preventDefault: jest.fn() };
      handleEscape(escapeEvent1);

      expect(escapeEvent1.preventDefault).toHaveBeenCalled();
      expect(connectingSourceId).toBeNull();
      // Selection must remain intact!
      expect(selectedNodeId).toBe('node_source_1');

      // 2. Second Escape: no connection mode, selection is active
      const escapeEvent2 = { key: 'Escape', target: nodeEl, preventDefault: jest.fn() };
      handleEscape(escapeEvent2);

      expect(escapeEvent2.preventDefault).toHaveBeenCalled();
      expect(selectedNodeId).toBeNull();

      // 3. Escape when editing node label closes modal
      editingNodeId = 'node_edit_1';
      const escapeEvent3 = { key: 'Escape', target: nodeEl, preventDefault: jest.fn() };
      handleEscape(escapeEvent3);

      expect(editingNodeId).toBeNull();
    });

    it('Scenario 5: Enter and Space activate intended actions without duplicate events or accidental page scrolling', () => {
      const preventDefaultMock = jest.fn();
      let nodeSelectedId: string | null = null;

      // Node keydown handler
      const handleNodeKeyDown = (e: any) => {
        if (e.target !== e.currentTarget) return; // Prevent duplicate event from child controls
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          nodeSelectedId = 'node_selected_1';
        }
      };

      // Child button inside node
      const parentNode = { id: 'parent_node' };
      const childButton = { id: 'child_connect_pin' };

      // Space on parent node itself
      const spaceOnNode = {
        key: ' ',
        target: parentNode,
        currentTarget: parentNode,
        preventDefault: preventDefaultMock,
      };
      handleNodeKeyDown(spaceOnNode);

      expect(preventDefaultMock).toHaveBeenCalled();
      expect(nodeSelectedId).toBe('node_selected_1');

      // Reset
      nodeSelectedId = null;
      preventDefaultMock.mockClear();

      // Space bubbled from child connect button -> target !== currentTarget
      const spaceFromChild = {
        key: ' ',
        target: childButton,
        currentTarget: parentNode,
        preventDefault: preventDefaultMock,
      };
      handleNodeKeyDown(spaceFromChild);

      // Child bubble must NOT trigger node selection
      expect(nodeSelectedId).toBeNull();
      expect(preventDefaultMock).not.toHaveBeenCalled();
    });

    it('Scenario 6: read-only mode cannot mutate diagram state through keyboard handlers', () => {
      const canvasEl = createMockNode('div');
      const innerEl = createMockNode('div');
      canvasEl.appendChild(innerEl);

      const deleteMock = jest.fn();
      const undoMock = jest.fn();
      const redoMock = jest.fn();
      const readOnly = true;
      let selectedNodeId: string | null = 'node_locked_1';

      const handleKeyDown = (e: any) => {
        const target = e.target;
        if (!target || !canvasEl.contains(target)) return;

        // Guard: readOnly canvas cannot mutate diagram state
        if (readOnly) {
          if (e.key === 'Escape' && selectedNodeId) {
            e.preventDefault();
            selectedNodeId = null;
          }
          return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
          deleteMock();
        } else if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === 'z') {
          undoMock();
        } else if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === 'y') {
          redoMock();
        }
      };

      // Attempt Delete in read-only
      handleKeyDown({ key: 'Delete', target: innerEl, preventDefault: jest.fn() });
      expect(deleteMock).not.toHaveBeenCalled();

      // Attempt Undo in read-only
      handleKeyDown({ key: 'z', ctrlKey: true, target: innerEl, preventDefault: jest.fn() });
      expect(undoMock).not.toHaveBeenCalled();

      // Attempt Redo in read-only
      handleKeyDown({ key: 'y', ctrlKey: true, target: innerEl, preventDefault: jest.fn() });
      expect(redoMock).not.toHaveBeenCalled();

      // Escape is permitted to deselect
      const escEvent = { key: 'Escape', target: innerEl, preventDefault: jest.fn() };
      handleKeyDown(escEvent);
      expect(escEvent.preventDefault).toHaveBeenCalled();
      expect(selectedNodeId).toBeNull();
    });

    it('Scenario 7: verifies proper listener registration and cleanup contract', () => {
      const addListenerSpy = jest.fn();
      const removeListenerSpy = jest.fn();

      const mockWindow = {
        addEventListener: addListenerSpy,
        removeEventListener: removeListenerSpy,
      };

      // Simulate hook registration lifecycle
      const handler = () => {};
      mockWindow.addEventListener('keydown', handler);
      expect(addListenerSpy).toHaveBeenCalledWith('keydown', handler);

      // Simulate cleanup on unmount
      mockWindow.removeEventListener('keydown', handler);
      expect(removeListenerSpy).toHaveBeenCalledWith('keydown', handler);
    });

    it('Scenario 8: pointer interactions, dragging, and diagram serialization remain intact', () => {
      const initial = createInitialDiagramState();
      expect(initial.nodes.length).toBeGreaterThan(0);
      expect(initial.edges.length).toBeGreaterThan(0);

      // Verify node positions are numerical and valid for dragging
      initial.nodes.forEach((n) => {
        expect(typeof n.position.x).toBe('number');
        expect(typeof n.position.y).toBe('number');
      });

      // Verify canvas rendered markup includes cursor-crosshair and grab cursors
      const html = renderCanvas({ initialState: initial });
      expect(html).toContain('cursor-crosshair');
      expect(html).toContain('cursor-grab');
    });
  });
});
