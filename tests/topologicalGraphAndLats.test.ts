/**
 * topologicalGraphAndLats.test.ts
 * Jest suite for Part 2: entity normalization, topological DAG clustering,
 * and LATS UCT branch selection.
 */

import { normalizeEntityName, ENTITY_ALIAS_MAP, validateEntityAliasMap } from '../src/lib/schemas/graphSchema';
import { executeLeidenHierarchicalClustering, synthesizePrerequisiteGapChains, executeGraphRAGAnalysis } from '../src/lib/services/graphRAG.server';
import { computeUCT, runLATSMCTS } from '../src/lib/services/latsEngine.server';

// === Entity Normalization ===

describe('Entity Normalization — normalizeEntityName', () => {
  it('normalizes "React.js" to "React"', () => {
    expect(normalizeEntityName('React.js')).toBe('React');
  });

  it('normalizes "ReactJS" to "React"', () => {
    expect(normalizeEntityName('ReactJS')).toBe('React');
  });

  it('normalizes "react 19" (case-insensitive) to "React"', () => {
    expect(normalizeEntityName('React 19')).toBe('React');
  });

  it('normalizes "K8s" to "Kubernetes"', () => {
    expect(normalizeEntityName('K8s')).toBe('Kubernetes');
  });

  it('normalizes "kube" to "Kubernetes"', () => {
    expect(normalizeEntityName('kube')).toBe('Kubernetes');
  });

  it('normalizes "postgres" to "PostgreSQL"', () => {
    expect(normalizeEntityName('postgres')).toBe('PostgreSQL');
  });

  it('normalizes "nodejs" to "Node.js"', () => {
    expect(normalizeEntityName('nodejs')).toBe('Node.js');
  });

  it('normalizes "golang" to "Go"', () => {
    expect(normalizeEntityName('golang')).toBe('Go');
  });

  it('normalizes "apache kafka" to "Kafka"', () => {
    expect(normalizeEntityName('apache kafka')).toBe('Kafka');
  });

  it('returns original name (trimmed) when no alias matches', () => {
    expect(normalizeEntityName('  CustomFrameworkXYZ  ')).toBe('CustomFrameworkXYZ');
  });

  it('ENTITY_ALIAS_MAP passes Zod schema validation', () => {
    expect(validateEntityAliasMap()).toBe(true);
  });

  it('ENTITY_ALIAS_MAP has at least 30 entries', () => {
    expect(Object.keys(ENTITY_ALIAS_MAP).length).toBeGreaterThanOrEqual(30);
  });

  it('normalization is case-insensitive: "REACT.JS" normalizes to "React"', () => {
    expect(normalizeEntityName('REACT.JS')).toBe('React');
  });

  it('normalizes "ts" to "TypeScript"', () => {
    expect(normalizeEntityName('ts')).toBe('TypeScript');
  });

  it('normalizes "node.js 20" and variants to "Node.js"', () => {
    expect(normalizeEntityName('Node.js 20')).toBe('Node.js');
    expect(normalizeEntityName('Node 20')).toBe('Node.js');
    expect(normalizeEntityName('NodeJS')).toBe('Node.js');
    expect(normalizeEntityName('Node')).toBe('Node.js');
  });
});

// === Entity Normalization applied before clustering ===

describe('Entity Normalization — deduplication in clustering', () => {
  it('two alias spellings of React produce single canonical node after normalization', () => {
    const entities = [
      { name: normalizeEntityName('React.js'), type: 'FRAMEWORK' as const, description: 'React framework' },
      { name: normalizeEntityName('ReactJS'), type: 'FRAMEWORK' as const, description: 'React variant' },
    ];
    // Both normalize to 'React' — clustering receives duplicates
    const uniqueNames = new Set(entities.map(e => e.name));
    expect(uniqueNames.size).toBe(1);
    expect([...uniqueNames][0]).toBe('React');
  });

  it('K8s and Kubernetes normalize to the same canonical name', () => {
    expect(normalizeEntityName('K8s')).toBe(normalizeEntityName('Kubernetes'));
  });

  it('postgres and pg both normalize to PostgreSQL', () => {
    expect(normalizeEntityName('postgres')).toBe('PostgreSQL');
    expect(normalizeEntityName('pg')).toBe('PostgreSQL');
  });
});

// === Topological DAG: 3-tier hierarchy ===

describe('Topological DAG — 3-tier hierarchy allocation', () => {
  const entities = [
    { name: 'Distributed Systems', type: 'DOMAIN' as const, description: 'Macro domain for large-scale systems' },
    { name: 'Concurrency Primitives', type: 'CONCEPT' as const, description: 'Core concurrency building blocks' },
    { name: 'Redis', type: 'SKILL' as const, description: 'In-memory data store' },
  ];

  const relationships = [
    { source: 'Distributed Systems', target: 'Concurrency Primitives', relationshipType: 'DEPENDS_ON', weight: 0.9, description: 'Architecture depends on concurrency' },
    { source: 'Concurrency Primitives', target: 'Redis', relationshipType: 'APPLIED_IN', weight: 0.85, description: 'Concurrency applied in Redis' },
  ];

  it('returns nodes at all 3 levels (L0, L1, L2)', () => {
    const { nodes } = executeLeidenHierarchicalClustering(entities, relationships, 'Software Engineer');
    const levels = nodes.map(n => n.level);
    expect(levels).toContain(0);
    expect(levels).toContain(1);
    expect(levels).toContain(2);
  });

  it('root node (no incoming, has outgoing) assigned L0', () => {
    const { nodes } = executeLeidenHierarchicalClustering(entities, relationships, 'Software Engineer');
    const root = nodes.find(n => n.name === 'Distributed Systems');
    expect(root?.level).toBe(0);
  });

  it('intermediate node (has incoming and outgoing) assigned L1', () => {
    const { nodes } = executeLeidenHierarchicalClustering(entities, relationships, 'Software Engineer');
    const pillar = nodes.find(n => n.name === 'Concurrency Primitives');
    expect(pillar?.level).toBe(1);
  });

  it('leaf node (has incoming, no outgoing) assigned L2', () => {
    const { nodes } = executeLeidenHierarchicalClustering(entities, relationships, 'Software Engineer');
    const leaf = nodes.find(n => n.name === 'Redis');
    expect(leaf?.level).toBe(2);
  });

  it('communities contain entries at L0, L1, and L2', () => {
    const { communities } = executeLeidenHierarchicalClustering(entities, relationships, 'Software Engineer');
    const communityLevels = communities.map(c => c.level);
    expect(communityLevels).toContain(0);
    expect(communityLevels).toContain(1);
    expect(communityLevels).toContain(2);
  });

  it('VERIFIED node has degree >= 2', () => {
    const entitiesConnected = [
      { name: 'NodeA', type: 'DOMAIN' as const, description: 'Root' },
      { name: 'NodeB', type: 'CONCEPT' as const, description: 'Middle' },
      { name: 'NodeC', type: 'SKILL' as const, description: 'Leaf' },
    ];
    const rels = [
      { source: 'NodeA', target: 'NodeB', relationshipType: 'DEPENDS_ON', weight: 1.0, description: '' },
      { source: 'NodeA', target: 'NodeC', relationshipType: 'DEPENDS_ON', weight: 0.9, description: '' },
      { source: 'NodeB', target: 'NodeC', relationshipType: 'APPLIED_IN', weight: 0.8, description: '' },
    ];
    const { nodes } = executeLeidenHierarchicalClustering(entitiesConnected, rels, 'Engineer');
    const nodeA = nodes.find(n => n.name === 'NodeA');
    expect(nodeA?.status).toBe('VERIFIED');
  });

  it('isolated node has status MISSING', () => {
    const { nodes } = executeLeidenHierarchicalClustering(
      [{ name: 'IsolatedSkill', type: 'SKILL' as const, description: 'No connections' }],
      [], 'Engineer'
    );
    expect(nodes[0].status).toBe('MISSING');
  });
});

// === LATS UCT Formula ===

describe('LATS UCT formula — computeUCT', () => {
  const C_PUCT = 1.414;

  it('computes UCT correctly with known values (Q=0.8, P=0.9, N_parent=4, N_child=1)', () => {
    const result = computeUCT(0.8, 0.9, 4, 1);
    const expected = 0.8 + C_PUCT * 0.9 * Math.sqrt(4) / (1 + 1);
    expect(result).toBeCloseTo(expected, 5);
  });

  it('unvisited nodes (N_child=0) get higher UCT than visited nodes', () => {
    const visited = computeUCT(0.6, 0.7, 4, 3);
    const unvisited = computeUCT(0.0, 0.7, 4, 0);
    expect(unvisited).toBeGreaterThan(visited);
  });

  it('larger N_parent increases exploration term', () => {
    const lowParent = computeUCT(0.5, 0.5, 1, 1);
    const highParent = computeUCT(0.5, 0.5, 16, 1);
    expect(highParent).toBeGreaterThan(lowParent);
  });

  it('c_puct = 1.414 matches sqrt(2) to 3 decimal places', () => {
    expect(C_PUCT).toBeCloseTo(Math.sqrt(2), 3);
  });

  it('UCT is deterministic for same inputs', () => {
    expect(computeUCT(0.7, 0.6, 9, 2)).toBe(computeUCT(0.7, 0.6, 9, 2));
  });

  it('selected branch should be the one with highest PRM score (UCT maximises it)', () => {
    // Simulate 3 branches: UCT values derived from PRM scores
    const branches = [
      { id: 'b1', prmScore: 0.82, nParent: 4, nChild: 1 },
      { id: 'b2', prmScore: 0.55, nParent: 4, nChild: 1 },
      { id: 'b3', prmScore: 0.71, nParent: 4, nChild: 1 },
    ];
    const ucts = branches.map(b => ({ id: b.id, uct: computeUCT(b.prmScore, b.prmScore, b.nParent, b.nChild) }));
    const selected = ucts.reduce((best, b) => b.uct > best.uct ? b : best);
    expect(selected.id).toBe('b1'); // highest prmScore wins
  });
});

// === DAG Cycle Protection & Visualizer Schema ===

describe('DAG Cycle Protection & Visualizer Schema', () => {
  it('protects against infinite loops on circular prerequisite annotations via visited Set', () => {
    const cyclicNodes = [
      {
        id: 'node_a',
        name: 'ServiceA',
        level: 2 as const,
        status: 'MISSING' as const,
        description: 'Leaf A',
        prerequisites: ['ServiceB'],
        downstreamImpacts: ['ServiceB'],
      },
      {
        id: 'node_b',
        name: 'ServiceB',
        level: 1 as const,
        status: 'MISSING' as const,
        description: 'Pillar B',
        prerequisites: ['ServiceA'],
        downstreamImpacts: ['ServiceA'],
      },
    ];

    const gapChains = synthesizePrerequisiteGapChains(cyclicNodes as any, 'Backend Engineer');
    expect(gapChains).toBeDefined();
    expect(gapChains.length).toBe(2);
    expect(gapChains[0].missingSkill).toBe('ServiceA');
  });

  it('executeGraphRAGAnalysis returns valid visualizer schema (nodes, edges, blockedPrerequisites, macroDomain)', async () => {
    const result = await executeGraphRAGAnalysis({
      jobTitle: 'Distributed Systems Architect',
      jobDescription: 'Build scalable architectures with Kubernetes and Kafka.',
      fileName: 'resume.txt',
      resumeText: 'Senior engineer experienced in Go, Kubernetes, and Kafka streaming pipelines.',
    });

    expect(result.nodes).toBeDefined();
    expect(result.edges).toBeDefined();
    expect(result.blockedPrerequisites).toBeDefined();
    expect(result.macroDomain).toBeDefined();
    expect(Array.isArray(result.nodes)).toBe(true);
    expect(Array.isArray(result.edges)).toBe(true);
    expect(Array.isArray(result.blockedPrerequisites)).toBe(true);
  });
});

// === LATS Branch Expansion & Deterministic Fallback ===

describe('LATS Branch Expansion & Deterministic Fallback', () => {
  it('generates 3 distinct action candidates and marks fallback: true when API key is missing', async () => {
    const state = await runLATSMCTS({
      sessionId: 'test_mcts_sess',
      role: 'Backend Engineer',
      currentQuestion: 'How would you mitigate a cascading cache failure?',
      candidateAnswer: 'I would use circuit breakers and rate limiting.',
      priorGaps: ['Concurrency locks'],
    });

    expect(state.fallback).toBe(true);
    expect(state.simulatedBranches).toHaveLength(3);
    const actionTypes = state.simulatedBranches.map(b => b.actionType);
    expect(actionTypes).toContain('DEEP_DIVE');
    expect(actionTypes).toContain('PIVOT');
    expect(actionTypes).toContain('EDGE_CASE_CHALLENGE');

    const selected = state.simulatedBranches.find(b => b.isSelectedTrajectory);
    expect(selected).toBeDefined();
    expect(selected?.uctValue).toBeGreaterThan(0);
    expect(selected?.prmScore).toBeGreaterThan(0);
  });
});
