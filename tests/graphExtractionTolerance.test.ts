import { graphRAGOutputSchema } from '../src/lib/services/graphRAG.server';

describe('GraphRAG extraction output is tolerant of model label drift', () => {
  it('coerces unknown entity types instead of rejecting the whole graph', () => {
    const result = graphRAGOutputSchema.safeParse({
      entities: [
        { name: 'Go', type: 'LANGUAGE', description: 'Compiled language' },
        { name: 'Kafka', type: 'tool', description: 'Event streaming platform' },
        { name: 'Express', type: 'Library', description: 'Web framework' },
        { name: 'Event Sourcing', type: 'Design Pattern', description: 'Architectural pattern' },
        { name: 'Fintech', type: 'Industry', description: 'Business domain' },
        { name: 'Node.js', type: 'FRAMEWORK', description: 'Runtime' },
      ],
      relationships: [],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.entities.map((e) => e.type)).toEqual([
      'SKILL',
      'SKILL',
      'FRAMEWORK',
      'CONCEPT',
      'DOMAIN',
      'FRAMEWORK',
    ]);
  });

  it('coerces relationship labels, clamps weights and fills short descriptions', () => {
    const result = graphRAGOutputSchema.safeParse({
      entities: [],
      relationships: [
        { source: 'A', target: 'B', relationshipType: 'uses', weight: 1.4, description: '' },
        { source: 'B', target: 'C', relationshipType: 'is a prerequisite of', weight: 0.01, description: 'ok' },
        { source: 'C', target: 'D', relationshipType: 'BLOCKS', weight: 0.5, description: 'blocks it' },
        { source: 'D', target: 'E', relationshipType: 'something else', weight: 0.5, description: 'related' },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    const [a, b, c, d] = result.data.relationships;
    expect(a.relationshipType).toBe('APPLIED_IN');
    expect(a.weight).toBe(1);
    expect(a.description.length).toBeGreaterThanOrEqual(3);
    expect(b.relationshipType).toBe('REQUIRES');
    expect(b.weight).toBe(0.1);
    expect(c.relationshipType).toBe('BLOCKS');
    expect(d.relationshipType).toBe('DEPENDS_ON');
  });

  it('still rejects structurally invalid output', () => {
    expect(graphRAGOutputSchema.safeParse({ entities: 'nope', relationships: [] }).success).toBe(false);
    expect(graphRAGOutputSchema.safeParse({ entities: [{ type: 'SKILL' }], relationships: [] }).success).toBe(false);
  });
});
