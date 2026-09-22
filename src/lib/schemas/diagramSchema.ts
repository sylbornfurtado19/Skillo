import { z } from 'zod';

export const systemDesignNodeTypeSchema = z.enum([
  'client',
  'load_balancer',
  'api_gateway',
  'microservice',
  'cache',
  'database',
  'message_queue',
  'cloud',
  'container',
  'rectangle',
  'circle',
]);

export const systemDesignNodeSchema = z.object({
  id: z.string().min(1).max(64),
  type: systemDesignNodeTypeSchema,
  label: z.string().max(100),
  position: z.object({
    x: z.number().finite().min(-10000).max(10000),
    y: z.number().finite().min(-10000).max(10000),
  }),
  width: z.number().finite().min(10).max(2000).optional(),
  height: z.number().finite().min(10).max(2000).optional(),
  metadata: z.record(z.string().max(50), z.union([z.string().max(200), z.number(), z.boolean()])).optional(),
});

export const systemDesignEdgeSchema = z.object({
  id: z.string().min(1).max(64),
  source: z.string().min(1).max(64),
  target: z.string().min(1).max(64),
  label: z.string().max(100).optional(),
  type: z.string().max(50).optional(),
});

export const systemDesignDiagramStateSchema = z.object({
  nodes: z.array(systemDesignNodeSchema).max(50, 'Diagram exceeds maximum limit of 50 nodes'),
  edges: z.array(systemDesignEdgeSchema).max(100, 'Diagram exceeds maximum limit of 100 edges'),
  version: z.number().int().min(1).max(1000).default(1),
  updatedAt: z.string().max(50).optional(),
});

export type ValidatedDiagramState = z.infer<typeof systemDesignDiagramStateSchema>;
