export type SystemDesignNodeType =
  | 'client'
  | 'load_balancer'
  | 'api_gateway'
  | 'microservice'
  | 'cache'
  | 'database'
  | 'message_queue'
  | 'cloud'
  | 'container'
  | 'rectangle'
  | 'circle';

export interface SystemDesignNode {
  id: string;
  type: SystemDesignNodeType;
  label: string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  metadata?: Record<string, any>;
}

export interface SystemDesignEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
}

export interface SystemDesignDiagramState {
  nodes: SystemDesignNode[];
  edges: SystemDesignEdge[];
  version: number;
  updatedAt?: string;
}

// ── Node Preset Configurations ───────────────────────────────────────────────

export interface NodePresetConfig {
  type: SystemDesignNodeType;
  label: string;
  defaultWidth: number;
  defaultHeight: number;
  bgColor: string;
  borderColor: string;
  textColor: string;
  iconName: string;
}

export const NODE_PRESET_CONFIGS: Record<SystemDesignNodeType, NodePresetConfig> = {
  client: {
    type: 'client',
    label: 'Client App',
    defaultWidth: 130,
    defaultHeight: 60,
    bgColor: 'bg-primary-soft/40',
    borderColor: 'border-primary/30',
    textColor: 'text-primary',
    iconName: 'FaDesktop',
  },
  load_balancer: {
    type: 'load_balancer',
    label: 'Load Balancer',
    defaultWidth: 140,
    defaultHeight: 60,
    bgColor: 'bg-success/10',
    borderColor: 'border-success/30',
    textColor: 'text-success',
    iconName: 'FaNetworkWired',
  },
  api_gateway: {
    type: 'api_gateway',
    label: 'API Gateway',
    defaultWidth: 140,
    defaultHeight: 60,
    bgColor: 'bg-primary-soft/60',
    borderColor: 'border-primary/40',
    textColor: 'text-primary',
    iconName: 'FaDoorOpen',
  },
  microservice: {
    type: 'microservice',
    label: 'Microservice',
    defaultWidth: 140,
    defaultHeight: 60,
    bgColor: 'bg-secondary/15',
    borderColor: 'border-secondary/30',
    textColor: 'text-secondary',
    iconName: 'FaCogs',
  },
  cache: {
    type: 'cache',
    label: 'Redis Cache',
    defaultWidth: 130,
    defaultHeight: 60,
    bgColor: 'bg-danger/10',
    borderColor: 'border-danger/30',
    textColor: 'text-danger',
    iconName: 'FaMemory',
  },
  database: {
    type: 'database',
    label: 'Database',
    defaultWidth: 130,
    defaultHeight: 65,
    bgColor: 'bg-info/10',
    borderColor: 'border-info/30',
    textColor: 'text-info',
    iconName: 'FaDatabase',
  },
  message_queue: {
    type: 'message_queue',
    label: 'Kafka / Queue',
    defaultWidth: 140,
    defaultHeight: 60,
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/30',
    textColor: 'text-warning',
    iconName: 'FaStream',
  },
  cloud: {
    type: 'cloud',
    label: 'Cloud Storage',
    defaultWidth: 140,
    defaultHeight: 60,
    bgColor: 'bg-info/15',
    borderColor: 'border-info/40',
    textColor: 'text-info',
    iconName: 'FaCloud',
  },
  container: {
    type: 'container',
    label: 'Docker Container',
    defaultWidth: 150,
    defaultHeight: 70,
    bgColor: 'bg-success/15',
    borderColor: 'border-success/40',
    textColor: 'text-success',
    iconName: 'FaBox',
  },
  rectangle: {
    type: 'rectangle',
    label: 'Custom Block',
    defaultWidth: 130,
    defaultHeight: 60,
    bgColor: 'bg-bg-surface-alt',
    borderColor: 'border-border',
    textColor: 'text-text-primary',
    iconName: 'FaSquare',
  },
  circle: {
    type: 'circle',
    label: 'Node',
    defaultWidth: 80,
    defaultHeight: 80,
    bgColor: 'bg-bg-surface-alt',
    borderColor: 'border-border',
    textColor: 'text-text-primary',
    iconName: 'FaCircle',
  },
};

// ── Serialization & Helper Utilities ─────────────────────────────────────────

export function createInitialDiagramState(): SystemDesignDiagramState {
  return {
    nodes: [
      { id: 'node_1', type: 'client', label: 'Client App', position: { x: 50, y: 150 } },
      { id: 'node_2', type: 'load_balancer', label: 'Load Balancer', position: { x: 240, y: 150 } },
      { id: 'node_3', type: 'api_gateway', label: 'API Gateway', position: { x: 430, y: 150 } },
      { id: 'node_4', type: 'microservice', label: 'Auth Service', position: { x: 620, y: 80 } },
      { id: 'node_5', type: 'microservice', label: 'Core API', position: { x: 620, y: 220 } },
      { id: 'node_6', type: 'cache', label: 'Redis Cache', position: { x: 810, y: 80 } },
      { id: 'node_7', type: 'database', label: 'PostgreSQL DB', position: { x: 810, y: 220 } },
    ],
    edges: [
      { id: 'edge_1', source: 'node_1', target: 'node_2', label: 'HTTPS' },
      { id: 'edge_2', source: 'node_2', target: 'node_3', label: 'Round-Robin' },
      { id: 'edge_3', source: 'node_3', target: 'node_4', label: 'gRPC' },
      { id: 'edge_4', source: 'node_3', target: 'node_5', label: 'gRPC' },
      { id: 'edge_5', source: 'node_4', target: 'node_6', label: 'Read/Write' },
      { id: 'edge_6', source: 'node_5', target: 'node_7', label: 'SQL Query' },
    ],
    version: 1,
    updatedAt: new Date().toISOString(),
  };
}

export function serializeDiagram(state: SystemDesignDiagramState): string {
  return JSON.stringify(state);
}

export function deserializeDiagram(rawJson: string): SystemDesignDiagramState {
  try {
    const parsed = JSON.parse(rawJson);
    if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
      return {
        nodes: parsed.nodes,
        edges: parsed.edges,
        version: parsed.version || 1,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };
    }
  } catch {
    // Fallback if parsing fails
  }
  return createInitialDiagramState();
}

export function summarizeDiagramTopology(state: SystemDesignDiagramState): string {
  if (!state || !state.nodes || state.nodes.length === 0) {
    return 'Empty System Design Diagram.';
  }

  const nodeSummary = state.nodes.map((n) => `${n.label} (${n.type})`).join(', ');
  const edgeSummary = state.edges
    .map((e) => {
      const srcNode = state.nodes.find((n) => n.id === e.source)?.label || e.source;
      const tgtNode = state.nodes.find((n) => n.id === e.target)?.label || e.target;
      return `${srcNode} -> [${e.label || 'connects'}] -> ${tgtNode}`;
    })
    .join('; ');

  return `System Architecture Components (${state.nodes.length} nodes): [${nodeSummary}]. Data Flows (${state.edges.length} edges): [${edgeSummary}].`;
}
