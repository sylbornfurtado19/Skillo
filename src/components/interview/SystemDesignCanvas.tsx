'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  SystemDesignDiagramState,
  SystemDesignNode,
  SystemDesignEdge,
  SystemDesignNodeType,
  NODE_PRESET_CONFIGS,
  createInitialDiagramState,
  serializeDiagram,
} from '@/types/systemDesign';
import {
  FaDesktop,
  FaNetworkWired,
  FaDoorOpen,
  FaCogs,
  FaMemory,
  FaDatabase,
  FaStream,
  FaCloud,
  FaBox,
  FaSquare,
  FaCircle,
  FaUndo,
  FaRedo,
  FaSearchPlus,
  FaSearchMinus,
  FaExpandArrowsAlt,
  FaTrash,
  FaDownload,
  FaSave,
  FaTimes,
  FaPlug,
  FaCheckCircle,
} from 'react-icons/fa';

interface SystemDesignCanvasProps {
  initialState?: SystemDesignDiagramState;
  onChange?: (state: SystemDesignDiagramState) => void;
  onSave?: (state: SystemDesignDiagramState) => void;
  readOnly?: boolean;
}

export const SystemDesignCanvas: React.FC<SystemDesignCanvasProps> = ({
  initialState,
  onChange,
  onSave,
  readOnly = false,
}) => {
  // Diagram State & Undo/Redo Stacks
  const [diagramState, setDiagramState] = useState<SystemDesignDiagramState>(
    initialState || createInitialDiagramState()
  );
  const [historyStack, setHistoryStack] = useState<SystemDesignDiagramState[]>([]);
  const [redoStack, setRedoStack] = useState<SystemDesignDiagramState[]>([]);

  // Canvas Viewport & Interactivity State
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Connecting Edge Mode State
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [connectLabel, setConnectLabel] = useState<string>('HTTPS');

  // Dragging Node State
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Label Edit Modal
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editLabelText, setEditLabelText] = useState<string>('');

  const containerRef = useRef<HTMLDivElement>(null);

  // Helper: Commit new state with Undo push
  const updateState = useCallback(
    (newState: SystemDesignDiagramState) => {
      setHistoryStack((prev) => [...prev, diagramState]);
      setRedoStack([]);
      setDiagramState(newState);
      if (onChange) onChange(newState);
    },
    [diagramState, onChange]
  );

  // Undo / Redo Actions
  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const previous = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, prev.length - 1));
    setRedoStack((prev) => [diagramState, ...prev]);
    setDiagramState(previous);
    if (onChange) onChange(previous);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setRedoStack((prev) => prev.slice(1));
    setHistoryStack((prev) => [...prev, diagramState]);
    setDiagramState(next);
    if (onChange) onChange(next);
  };

  // Node Dragging Handlers
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (readOnly) return;
    e.stopPropagation();

    // If connecting mode active, select target
    if (connectingSourceId) {
      if (connectingSourceId !== nodeId) {
        // Create new edge
        const newEdge: SystemDesignEdge = {
          id: `edge_${Date.now()}`,
          source: connectingSourceId,
          target: nodeId,
          label: connectLabel,
        };
        updateState({
          ...diagramState,
          edges: [...diagramState.edges, newEdge],
          updatedAt: new Date().toISOString(),
        });
      }
      setConnectingSourceId(null);
      return;
    }

    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setDraggingNodeId(nodeId);

    const node = diagramState.nodes.find((n) => n.id === nodeId);
    if (node && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) / zoom - pan.x;
      const mouseY = (e.clientY - rect.top) / zoom - pan.y;
      setDragOffset({
        x: mouseX - node.position.x,
        y: mouseY - node.position.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingNodeId || !containerRef.current || readOnly) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / zoom - pan.x;
    const mouseY = (e.clientY - rect.top) / zoom - pan.y;

    const newX = Math.max(0, Math.round(mouseX - dragOffset.x));
    const newY = Math.max(0, Math.round(mouseY - dragOffset.y));

    setDiagramState((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === draggingNodeId ? { ...n, position: { x: newX, y: newY } } : n
      ),
    }));
  };

  const handleMouseUp = () => {
    if (draggingNodeId) {
      setDraggingNodeId(null);
      if (onChange) onChange(diagramState);
    }
  };

  // Add Node from Palette
  const handleAddNode = (type: SystemDesignNodeType) => {
    const config = NODE_PRESET_CONFIGS[type];
    const newNode: SystemDesignNode = {
      id: `node_${Date.now()}`,
      type,
      label: config.label,
      position: { x: 100 + Math.random() * 50, y: 100 + Math.random() * 50 },
    };

    updateState({
      ...diagramState,
      nodes: [...diagramState.nodes, newNode],
      updatedAt: new Date().toISOString(),
    });
    setSelectedNodeId(newNode.id);
  };

  // Delete Selected Node or Edge
  const handleDeleteSelected = () => {
    if (readOnly) return;
    if (selectedNodeId) {
      updateState({
        ...diagramState,
        nodes: diagramState.nodes.filter((n) => n.id !== selectedNodeId),
        edges: diagramState.edges.filter(
          (e) => e.source !== selectedNodeId && e.target !== selectedNodeId
        ),
        updatedAt: new Date().toISOString(),
      });
      setSelectedNodeId(null);
    } else if (selectedEdgeId) {
      updateState({
        ...diagramState,
        edges: diagramState.edges.filter((e) => e.id !== selectedEdgeId),
        updatedAt: new Date().toISOString(),
      });
      setSelectedEdgeId(null);
    }
  };

  // Clear Canvas
  const handleClearCanvas = () => {
    if (readOnly) return;
    if (window.confirm('Are you sure you want to clear the whiteboard canvas?')) {
      updateState({
        nodes: [],
        edges: [],
        version: 1,
        updatedAt: new Date().toISOString(),
      });
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    }
  };

  // Rename Node Label
  const handleSaveNodeLabel = () => {
    if (!editingNodeId) return;
    updateState({
      ...diagramState,
      nodes: diagramState.nodes.map((n) =>
        n.id === editingNodeId ? { ...n, label: editLabelText } : n
      ),
      updatedAt: new Date().toISOString(),
    });
    setEditingNodeId(null);
  };

  // Export JSON
  const handleExportJSON = () => {
    const jsonStr = serializeDiagram(diagramState);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system_design_architecture_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Render Icon for Preset
  const renderIcon = (type: SystemDesignNodeType) => {
    switch (type) {
      case 'client':
        return <FaDesktop />;
      case 'load_balancer':
        return <FaNetworkWired />;
      case 'api_gateway':
        return <FaDoorOpen />;
      case 'microservice':
        return <FaCogs />;
      case 'cache':
        return <FaMemory />;
      case 'database':
        return <FaDatabase />;
      case 'message_queue':
        return <FaStream />;
      case 'cloud':
        return <FaCloud />;
      case 'container':
        return <FaBox />;
      case 'rectangle':
        return <FaSquare />;
      case 'circle':
        return <FaCircle />;
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#050B14] border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative select-none">
      {/* ── TOP TOOLBAR ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0B0F19] border-b border-white/10 text-xs gap-2 flex-wrap z-20">
        {/* Undo/Redo & Zoom Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleUndo}
            disabled={historyStack.length === 0 || readOnly}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 disabled:opacity-40 transition-all"
            title="Undo"
          >
            <FaUndo size={11} />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0 || readOnly}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 disabled:opacity-40 transition-all"
            title="Redo"
          >
            <FaRedo size={11} />
          </button>
          <div className="h-4 w-px bg-white/10 mx-1" />
          <button
            onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-all"
            title="Zoom In"
          >
            <FaSearchPlus size={11} />
          </button>
          <span className="text-[10px] font-mono text-gray-400 w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-all"
            title="Zoom Out"
          >
            <FaSearchMinus size={11} />
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-all"
            title="Reset View"
          >
            <FaExpandArrowsAlt size={11} />
          </button>
        </div>

        {/* Mode Indicators */}
        <div className="flex items-center gap-2">
          {connectingSourceId ? (
            <span className="animate-pulse flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300">
              <FaPlug size={10} />
              Click target node to connect edge ({connectLabel})
            </span>
          ) : (
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-400">
              <span>Protocol Label:</span>
              <select
                value={connectLabel}
                onChange={(e) => setConnectLabel(e.target.value)}
                className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white font-mono text-[10px]"
              >
                <option value="HTTPS">HTTPS</option>
                <option value="gRPC">gRPC</option>
                <option value="TCP/IP">TCP/IP</option>
                <option value="Pub/Sub">Pub/Sub</option>
                <option value="Read/Write">Read/Write</option>
                <option value="SQL Query">SQL Query</option>
              </select>
            </div>
          )}
        </div>

        {/* Delete, Clear, Export, Save */}
        <div className="flex items-center gap-1.5">
          {(selectedNodeId || selectedEdgeId) && (
            <button
              onClick={handleDeleteSelected}
              disabled={readOnly}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 transition-all text-[10px] font-semibold"
            >
              <FaTrash size={10} />
              Delete
            </button>
          )}
          <button
            onClick={handleClearCanvas}
            disabled={readOnly}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-all"
            title="Clear Whiteboard"
          >
            <FaTimes size={11} />
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition-all text-[10px] font-semibold"
          >
            <FaDownload size={10} />
            Export JSON
          </button>
          {onSave && (
            <button
              onClick={() => onSave(diagramState)}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold transition-all text-[10px] shadow-lg shadow-primary/20"
            >
              <FaSave size={10} />
              Save Design
            </button>
          )}
        </div>
      </div>

      {/* ── MAIN CANVAS AREA & TOOL PALETTE ───────────────────────────────────── */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left Side Tool Palette */}
        {!readOnly && (
          <div className="w-14 bg-[#080D1A] border-r border-white/10 flex flex-col items-center py-3 gap-2 z-10 shrink-0 overflow-y-auto">
            <span className="text-[8px] font-mono text-gray-500 uppercase tracking-tighter mb-1">
              Nodes
            </span>
            {(Object.keys(NODE_PRESET_CONFIGS) as SystemDesignNodeType[]).map((type) => {
              const cfg = NODE_PRESET_CONFIGS[type];
              return (
                <button
                  key={type}
                  onClick={() => handleAddNode(type)}
                  className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center border transition-all ${cfg.bgColor} ${cfg.borderColor} ${cfg.textColor} hover:scale-105`}
                  title={`Add ${cfg.label}`}
                >
                  <span className="text-xs">{renderIcon(type)}</span>
                  <span className="text-[7px] font-mono leading-none truncate max-w-[36px] mt-0.5">
                    {type.split('_')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* SVG/HTML Canvas Viewport */}
        <div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={() => {
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
            setConnectingSourceId(null);
          }}
          className="flex-1 relative cursor-crosshair overflow-hidden bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]"
        >
          <div
            style={{
              transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
              transformOrigin: '0 0',
              width: '100%',
              height: '100%',
              position: 'absolute',
            }}
          >
            {/* SVG Connecting Edges */}
            <svg className="absolute inset-0 w-[3000px] h-[3000px] pointer-events-none z-0 overflow-visible">
              <defs>
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#6366F1" />
                </marker>
              </defs>
              {diagramState.edges.map((edge) => {
                const srcNode = diagramState.nodes.find((n) => n.id === edge.source);
                const tgtNode = diagramState.nodes.find((n) => n.id === edge.target);
                if (!srcNode || !tgtNode) return null;

                const srcCfg = NODE_PRESET_CONFIGS[srcNode.type];
                const tgtCfg = NODE_PRESET_CONFIGS[tgtNode.type];

                const x1 = srcNode.position.x + (srcNode.width || srcCfg.defaultWidth) / 2;
                const y1 = srcNode.position.y + (srcNode.height || srcCfg.defaultHeight) / 2;
                const x2 = tgtNode.position.x + (tgtNode.width || tgtCfg.defaultWidth) / 2;
                const y2 = tgtNode.position.y + (tgtNode.height || tgtCfg.defaultHeight) / 2;

                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;

                const isSelected = selectedEdgeId === edge.id;

                return (
                  <g
                    key={edge.id}
                    className="pointer-events-auto cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEdgeId(edge.id);
                      setSelectedNodeId(null);
                    }}
                  >
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={isSelected ? '#EC4899' : '#6366F1'}
                      strokeWidth={isSelected ? 3 : 2}
                      strokeDasharray={edge.label?.includes('Queue') ? '4' : undefined}
                      markerEnd="url(#arrow)"
                    />
                    {/* Edge Label Badge */}
                    <rect
                      x={midX - 30}
                      y={midY - 10}
                      width={60}
                      height={18}
                      rx={4}
                      fill="#0B0F19"
                      stroke={isSelected ? '#EC4899' : '#312E81'}
                      strokeWidth={1}
                    />
                    <text
                      x={midX}
                      y={midY + 3}
                      fill="#C7D2FE"
                      fontSize={9}
                      fontFamily="monospace"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {edge.label || 'connect'}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* HTML Nodes */}
            {diagramState.nodes.map((node) => {
              const cfg = NODE_PRESET_CONFIGS[node.type];
              const isSelected = selectedNodeId === node.id;
              const isConnectSource = connectingSourceId === node.id;

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingNodeId(node.id);
                    setEditLabelText(node.label);
                  }}
                  style={{
                    left: `${node.position.x}px`,
                    top: `${node.position.y}px`,
                    width: `${node.width || cfg.defaultWidth}px`,
                    height: `${node.height || cfg.defaultHeight}px`,
                  }}
                  className={`absolute rounded-xl border p-2 flex items-center justify-start gap-2 shadow-lg backdrop-blur-md transition-shadow cursor-grab active:cursor-grabbing z-10 ${
                    cfg.bgColor
                  } ${
                    isSelected
                      ? 'ring-2 ring-primary border-primary shadow-primary/20 scale-[1.02]'
                      : isConnectSource
                      ? 'ring-2 ring-amber-400 border-amber-400 animate-pulse'
                      : cfg.borderColor
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg bg-black/40 flex items-center justify-center shrink-0 ${cfg.textColor}`}
                  >
                    {renderIcon(node.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate font-heading leading-tight">
                      {node.label}
                    </p>
                    <p className="text-[8px] font-mono text-gray-400 uppercase tracking-tighter truncate">
                      {node.type.replace('_', ' ')}
                    </p>
                  </div>

                  {/* Connect Pin Handle */}
                  {!readOnly && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConnectingSourceId(isConnectSource ? null : node.id);
                      }}
                      className="w-5 h-5 rounded-full bg-white/10 hover:bg-primary text-gray-300 hover:text-white flex items-center justify-center shrink-0 transition-colors"
                      title="Connect edge to target"
                    >
                      <FaPlug size={8} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── EDIT LABEL MODAL ─────────────────────────────────────────────────── */}
      {editingNodeId && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-30 p-4">
          <div className="bg-[#0B0F19] border border-white/15 rounded-2xl p-5 max-w-xs w-full space-y-4 shadow-2xl">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Rename Component Node
            </h4>
            <input
              type="text"
              value={editLabelText}
              onChange={(e) => setEditLabelText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveNodeLabel()}
              autoFocus
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:border-primary focus:outline-none"
              placeholder="Node Label"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingNodeId(null)}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNodeLabel}
                className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-xs text-white font-bold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
