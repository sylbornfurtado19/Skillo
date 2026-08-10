/**
 * Unit Tests for System Architecture Whiteboard Diagram Utilities
 * Covers: Serialization, deserialization, node/edge topology summary, initial state generation, invalid payload handling.
 */

import {
  createInitialDiagramState,
  serializeDiagram,
  deserializeDiagram,
  summarizeDiagramTopology,
  SystemDesignDiagramState,
} from '../src/types/systemDesign';

describe('System Architecture Whiteboard Diagram Utilities', () => {
  it('createInitialDiagramState should return a valid non-empty architecture topology', () => {
    const state = createInitialDiagramState();
    expect(state.nodes.length).toBeGreaterThan(0);
    expect(state.edges.length).toBeGreaterThan(0);
    expect(state.nodes.some((n) => n.type === 'load_balancer')).toBe(true);
    expect(state.nodes.some((n) => n.type === 'database')).toBe(true);
  });

  it('serializeDiagram and deserializeDiagram should round-trip cleanly', () => {
    const initial = createInitialDiagramState();
    const serialized = serializeDiagram(initial);
    expect(typeof serialized).toBe('string');

    const restored = deserializeDiagram(serialized);
    expect(restored.nodes.length).toBe(initial.nodes.length);
    expect(restored.edges.length).toBe(initial.edges.length);
    expect(restored.nodes[0].label).toBe(initial.nodes[0].label);
  });

  it('deserializeDiagram should fallback to initial diagram when given invalid JSON', () => {
    const restored = deserializeDiagram('{ invalid json syntax');
    expect(restored.nodes).toBeDefined();
    expect(restored.nodes.length).toBeGreaterThan(0);
  });

  it('deserializeDiagram should fallback when given empty or non-diagram object', () => {
    const restored = deserializeDiagram(JSON.stringify({ foo: 'bar' }));
    expect(restored.nodes).toBeDefined();
    expect(restored.nodes.length).toBeGreaterThan(0);
  });

  it('summarizeDiagramTopology should generate clear textual topology summary for AI evaluation', () => {
    const mockState: SystemDesignDiagramState = {
      nodes: [
        { id: 'n1', type: 'client', label: 'Web Client', position: { x: 0, y: 0 } },
        { id: 'n2', type: 'load_balancer', label: 'NGINX LB', position: { x: 100, y: 0 } },
        { id: 'n3', type: 'database', label: 'Postgres Master', position: { x: 200, y: 0 } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', label: 'HTTPS' },
        { id: 'e2', source: 'n2', target: 'n3', label: 'SQL Query' },
      ],
      version: 1,
    };

    const summary = summarizeDiagramTopology(mockState);
    expect(summary).toContain('Web Client (client)');
    expect(summary).toContain('NGINX LB (load_balancer)');
    expect(summary).toContain('Web Client -> [HTTPS] -> NGINX LB');
    expect(summary).toContain('NGINX LB -> [SQL Query] -> Postgres Master');
  });
});
