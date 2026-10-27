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

  // First-time usage hint tooltip state (persisted via localStorage)
  const [showTooltip, setShowTooltip] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const seen = localStorage.getItem('skillo_seen_system_design_hint');
        if (!seen) {
          setShowTooltip(true);
        }
      } catch (e) {
        console.warn('Failed to access localStorage:', e);
      }
    }
  }, []);

  const dismissTooltip = () => {
    setShowTooltip(false);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('skillo_seen_system_design_hint', 'true');
      } catch (e) {
        console.warn('Failed to save tooltip state to localStorage:', e);
      }
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRootRef = useRef<HTMLDivElement>(null);

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

  // Undo / Redo Actions (guarded against readOnly)
  const handleUndo = () => {
    if (readOnly || historyStack.length === 0) return;
    const previous = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, prev.length - 1));
    setRedoStack((prev) => [diagramState, ...prev]);
    setDiagramState(previous);
    if (onChange) onChange(previous);
  };

  const handleRedo = () => {
    if (readOnly || redoStack.length === 0) return;
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
    if (readOnly || !editingNodeId) return;
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

  // Keyboard navigation & shortcuts for canvas (scoped to canvas boundaries)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const canvasEl = canvasRootRef.current;
      if (!canvasEl) return;

      const target = e.target as HTMLElement | null;
      // Guard: strictly ignore keyboard events when focus is outside this canvas
      if (!target || !canvasEl.contains(target)) {
        return;
      }

      // Guard: do not intercept typing inside text inputs, textareas, selects, or contenteditable
      const tag = target.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable) {
        return;
      }

      // Guard: readOnly canvas cannot mutate diagram state via keyboard
      if (readOnly) {
        if (e.key === 'Escape' && (selectedNodeId || selectedEdgeId)) {
          e.preventDefault();
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
        }
        return;
      }

      // 1. Delete / Backspace: delete selected element
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId || selectedEdgeId) {
          e.preventDefault();
          handleDeleteSelected();
        }
      }
      // 2. Escape: hierarchical cancel (rename modal -> connection mode -> deselect)
      else if (e.key === 'Escape') {
        if (editingNodeId) {
          e.preventDefault();
          setEditingNodeId(null);
        } else if (connectingSourceId) {
          e.preventDefault();
          setConnectingSourceId(null);
        } else if (selectedNodeId || selectedEdgeId) {
          e.preventDefault();
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
        }
      }
      // 3. F2: rename selected component node
      else if (e.key === 'F2') {
        if (selectedNodeId) {
          const node = diagramState.nodes.find((n) => n.id === selectedNodeId);
          if (node) {
            e.preventDefault();
            setEditingNodeId(node.id);
            setEditLabelText(node.label);
          }
        }
      }
      // 4. Undo / Redo: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          if (redoStack.length > 0) {
            e.preventDefault();
            handleRedo();
          }
        } else {
          if (historyStack.length > 0) {
            e.preventDefault();
            handleUndo();
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        if (redoStack.length > 0) {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedNodeId,
    selectedEdgeId,
    connectingSourceId,
    editingNodeId,
    diagramState.nodes,
    historyStack,
    redoStack,
    readOnly,
  ]);

  // Render Icon for Preset
  const renderIcon = (type: SystemDesignNodeType) => {
    switch (type) {
      case 'client':
        return <FaDesktop aria-hidden="true" />;
      case 'load_balancer':
        return <FaNetworkWired aria-hidden="true" />;
      case 'api_gateway':
        return <FaDoorOpen aria-hidden="true" />;
      case 'microservice':
        return <FaCogs aria-hidden="true" />;
      case 'cache':
        return <FaMemory aria-hidden="true" />;
      case 'database':
        return <FaDatabase aria-hidden="true" />;
      case 'message_queue':
        return <FaStream aria-hidden="true" />;
      case 'cloud':
        return <FaCloud aria-hidden="true" />;
      case 'container':
        return <FaBox aria-hidden="true" />;
      case 'rectangle':
        return <FaSquare aria-hidden="true" />;
      case 'circle':
        return <FaCircle aria-hidden="true" />;
    }
  };

  return (
    <div
      ref={canvasRootRef}
      tabIndex={readOnly ? -1 : 0}
      role="region"
      aria-label="System architecture whiteboard"
      className="flex flex-col h-full w-full bg-bg-surface border border-border rounded-2xl overflow-hidden shadow-2xl relative select-none focus:outline-none"
    >
      {/* ── TOP TOOLBAR ──────────────────────────────────────────────────────── */}
      <div
        role="toolbar"
        aria-label="System design canvas toolbar"
        className="flex items-center justify-between px-3 sm:px-4 py-2 bg-bg-surface-alt border-b border-border text-xs gap-2 flex-wrap z-20"
      >
        {/* Undo/Redo & Zoom Controls */}
        <div
          role="group"
          aria-label="History and zoom controls"
          className="flex items-center gap-1 sm:gap-1.5 flex-wrap"
        >
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyStack.length === 0 || readOnly}
            aria-label="Undo canvas change"
            title="Undo canvas change (Ctrl+Z)"
            className="min-h-[40px] min-w-[40px] sm:min-h-[36px] sm:min-w-[36px] p-2 rounded-lg bg-bg-surface hover:bg-border/40 text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all border border-border flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          >
            <FaUndo size={12} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0 || readOnly}
            aria-label="Redo canvas change"
            title="Redo canvas change (Ctrl+Y)"
            className="min-h-[40px] min-w-[40px] sm:min-h-[36px] sm:min-w-[36px] p-2 rounded-lg bg-bg-surface hover:bg-border/40 text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all border border-border flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          >
            <FaRedo size={12} aria-hidden="true" />
          </button>
          <div className="h-5 w-px bg-border mx-1" aria-hidden="true" />
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
            aria-label="Zoom in canvas"
            title="Zoom In"
            className="min-h-[40px] min-w-[40px] sm:min-h-[36px] sm:min-w-[36px] p-2 rounded-lg bg-bg-surface hover:bg-border/40 text-text-primary transition-all border border-border flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          >
            <FaSearchPlus size={12} aria-hidden="true" />
          </button>
          <span
            aria-live="polite"
            aria-atomic="true"
            className="text-[11px] font-mono text-text-secondary min-w-[40px] text-center select-none"
          >
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
            aria-label="Zoom out canvas"
            title="Zoom Out"
            className="min-h-[40px] min-w-[40px] sm:min-h-[36px] sm:min-w-[36px] p-2 rounded-lg bg-bg-surface hover:bg-border/40 text-text-primary transition-all border border-border flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          >
            <FaSearchMinus size={12} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            aria-label="Reset zoom and center view"
            title="Reset View"
            className="min-h-[40px] min-w-[40px] sm:min-h-[36px] sm:min-w-[36px] p-2 rounded-lg bg-bg-surface hover:bg-border/40 text-text-primary transition-all border border-border flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          >
            <FaExpandArrowsAlt size={12} aria-hidden="true" />
          </button>
        </div>

        {/* Mode Indicators */}
        <div
          role="group"
          aria-label="Connection mode and protocol settings"
          className="flex items-center gap-2"
        >
          {connectingSourceId ? (
            <div className="flex items-center gap-2">
              <span
                role="status"
                aria-live="polite"
                className="animate-pulse flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono font-bold bg-warning/20 border border-warning/40 text-warning"
              >
                <FaPlug size={11} aria-hidden="true" />
                Click target node to connect edge ({connectLabel})
              </span>
              <button
                type="button"
                onClick={() => setConnectingSourceId(null)}
                aria-label="Cancel active connection"
                className="min-h-[36px] px-2.5 py-1 text-xs font-semibold rounded-lg bg-bg-surface hover:bg-border/40 text-text-secondary border border-border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-mono text-text-secondary">
              <label htmlFor="system-design-protocol-select" className="shrink-0 cursor-pointer text-text-secondary">
                Protocol:
              </label>
              <select
                id="system-design-protocol-select"
                value={connectLabel}
                onChange={(e) => setConnectLabel(e.target.value)}
                aria-label="Connection protocol label"
                className="min-h-[38px] bg-bg-surface border border-border rounded-lg px-2.5 py-1 text-text-primary font-mono text-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
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
        <div
          role="group"
          aria-label="Canvas actions"
          className="flex items-center gap-1.5 flex-wrap"
        >
          {(selectedNodeId || selectedEdgeId) && (
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={readOnly}
              aria-label={selectedNodeId ? 'Delete selected component' : 'Delete selected connection'}
              title={selectedNodeId ? 'Delete component (Delete/Backspace)' : 'Delete connection (Delete/Backspace)'}
              className="min-h-[40px] sm:min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger/20 hover:bg-danger/30 text-danger border border-danger/30 transition-all text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <FaTrash size={11} aria-hidden="true" />
              <span>Delete</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleClearCanvas}
            disabled={readOnly}
            aria-label="Clear whiteboard canvas"
            title="Clear Whiteboard"
            className="min-h-[40px] min-w-[40px] sm:min-h-[36px] sm:min-w-[36px] p-2 rounded-lg bg-bg-surface hover:bg-border/40 text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-all border border-border flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 cursor-pointer"
          >
            <FaTimes size={12} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleExportJSON}
            aria-label="Export diagram as JSON file"
            title="Export diagram JSON"
            className="min-h-[40px] sm:min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-surface hover:bg-border/40 text-text-primary border border-border transition-all text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 cursor-pointer"
          >
            <FaDownload size={11} aria-hidden="true" />
            <span>Export JSON</span>
          </button>
          {onSave && (
            <button
              type="button"
              onClick={() => onSave(diagramState)}
              aria-label="Save system design diagram"
              title="Save diagram"
              className="min-h-[40px] sm:min-h-[36px] flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-text-on-primary font-bold transition-all text-xs shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 cursor-pointer"
            >
              <FaSave size={11} aria-hidden="true" />
              <span>Save Design</span>
            </button>
          )}
        </div>
      </div>

      {/* ── MAIN CANVAS AREA & TOOL PALETTE ───────────────────────────────────── */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left Side Tool Palette */}
        {!readOnly && (
          <aside
            role="toolbar"
            aria-label="Component node palette"
            className="w-16 bg-bg-surface-alt border-r border-border flex flex-col items-center py-3 gap-2.5 z-10 shrink-0 overflow-y-auto"
          >
            <span className="text-[9px] font-mono text-text-secondary uppercase tracking-tight mb-1 select-none font-semibold">
              Nodes
            </span>
            {(Object.keys(NODE_PRESET_CONFIGS) as SystemDesignNodeType[]).map((type) => {
              const cfg = NODE_PRESET_CONFIGS[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleAddNode(type)}
                  aria-label={`Add ${cfg.label} component`}
                  title={`Add ${cfg.label}`}
                  className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex flex-col items-center justify-center border transition-all cursor-pointer ${cfg.bgColor} ${cfg.borderColor} ${cfg.textColor} hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1`}
                >
                  <span className="text-sm">{renderIcon(type)}</span>
                  <span className="text-[8px] font-mono leading-none truncate max-w-[38px] mt-0.5">
                    {type.split('_')[0]}
                  </span>
                </button>
              );
            })}
          </aside>
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
          className="flex-1 relative cursor-crosshair overflow-hidden bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:24px_24px]"
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
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--primary)" />
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
                    tabIndex={readOnly ? -1 : 0}
                    role="button"
                    aria-label={`Connection ${edge.label || 'edge'} from ${srcNode.label} to ${tgtNode.label}`}
                    aria-selected={isSelected}
                    onKeyDown={(e) => {
                      if (readOnly) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedEdgeId(edge.id);
                        setSelectedNodeId(null);
                      }
                    }}
                    className="pointer-events-auto cursor-pointer focus-visible:outline-none"
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
                      stroke={isSelected ? 'var(--secondary)' : 'var(--primary)'}
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
                      fill="var(--bg-surface-alt)"
                      stroke={isSelected ? 'var(--secondary)' : 'var(--border)'}
                      strokeWidth={1}
                    />
                    <text
                      x={midX}
                      y={midY + 3}
                      fill="var(--text-primary)"
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
                  tabIndex={readOnly ? -1 : 0}
                  role="button"
                  aria-label={`${node.label}, ${node.type.replace('_', ' ')} component`}
                  aria-selected={isSelected}
                  onKeyDown={(e) => {
                    if (readOnly) return;
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (connectingSourceId) {
                        if (connectingSourceId !== node.id) {
                          const newEdge: SystemDesignEdge = {
                            id: `edge_${Date.now()}`,
                            source: connectingSourceId,
                            target: node.id,
                            label: connectLabel,
                          };
                          updateState({
                            ...diagramState,
                            edges: [...diagramState.edges, newEdge],
                            updatedAt: new Date().toISOString(),
                          });
                        }
                        setConnectingSourceId(null);
                      } else {
                        setSelectedNodeId(node.id);
                        setSelectedEdgeId(null);
                      }
                    } else if (e.key === 'F2') {
                      e.preventDefault();
                      setEditingNodeId(node.id);
                      setEditLabelText(node.label);
                    }
                  }}
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
                  className={`absolute rounded-xl border p-2 flex items-center justify-start gap-2 shadow-soft backdrop-blur-md transition-shadow cursor-grab active:cursor-grabbing z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    cfg.bgColor
                  } ${
                    isSelected
                      ? 'ring-2 ring-primary border-primary shadow-soft scale-[1.02]'
                      : isConnectSource
                      ? 'ring-2 ring-warning border-warning animate-pulse'
                      : cfg.borderColor
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg bg-bg-surface-alt/80 flex items-center justify-center shrink-0 ${cfg.textColor}`}
                  >
                    {renderIcon(node.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-text-primary truncate font-heading leading-tight">
                      {node.label}
                    </p>
                    <p className="text-[8px] font-mono text-text-secondary uppercase tracking-tighter truncate">
                      {node.type.replace('_', ' ')}
                    </p>
                  </div>

                  {/* Connect Pin Handle */}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConnectingSourceId(isConnectSource ? null : node.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                        }
                      }}
                      aria-label={
                        isConnectSource
                          ? `Cancel connecting edge from ${node.label}`
                          : `Connect edge from ${node.label}`
                      }
                      aria-pressed={isConnectSource}
                      title={isConnectSource ? `Cancel connection from ${node.label}` : `Connect edge from ${node.label}`}
                      className={`w-7 h-7 min-w-[28px] min-h-[28px] rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                        isConnectSource
                          ? 'bg-warning text-text-on-primary ring-2 ring-warning'
                          : 'bg-border/60 hover:bg-primary text-text-secondary hover:text-text-on-primary'
                      }`}
                    >
                      <FaPlug size={10} aria-hidden="true" />
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
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rename-node-dialog-title"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setEditingNodeId(null);
            }
          }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-30 p-4"
        >
          <div className="bg-bg-surface border border-border rounded-2xl p-5 max-w-xs w-full space-y-4 shadow-soft">
            <h4
              id="rename-node-dialog-title"
              className="text-xs font-bold text-text-primary uppercase tracking-wider"
            >
              Rename Component Node
            </h4>
            <input
              type="text"
              value={editLabelText}
              onChange={(e) => setEditLabelText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveNodeLabel();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  setEditingNodeId(null);
                }
              }}
              autoFocus
              aria-label="Component node label"
              className="w-full px-3 py-2 bg-bg-surface-alt border border-border rounded-xl text-xs text-text-primary focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              placeholder="Node Label"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingNodeId(null)}
                aria-label="Cancel renaming component"
                className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-bg-surface-alt hover:bg-border text-xs text-text-primary font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNodeLabel}
                aria-label="Save component label"
                className="min-h-[40px] px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-xs text-text-on-primary font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FIRST-TIME USAGE SYSTEM DESIGN TOOLTIP OVERLAY ──────────────────── */}
      {showTooltip && (
        <aside
          role="region"
          aria-label="System design canvas guide"
          className="absolute top-12 left-4 right-4 z-40 bg-bg-surface/95 backdrop-blur-md border border-primary/40 rounded-2xl p-4 shadow-soft space-y-3"
        >
          <div className="flex items-start justify-between gap-3 border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <span
                className="h-6 w-6 rounded-lg bg-primary-soft text-primary flex items-center justify-center font-bold text-xs"
                aria-hidden="true"
              >
                💡
              </span>
              <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                System Design Canvas Guide
              </h4>
            </div>
            <button
              type="button"
              onClick={dismissTooltip}
              aria-label="Dismiss System Design Guide"
              title="Dismiss Guide"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors p-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
            >
              <FaTimes size={13} aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-text-primary font-mono">
            <div className="bg-bg-surface-alt p-2.5 rounded-xl border border-border space-y-1">
              <span className="text-primary font-bold block">1. Add & Drag Components</span>
              <p className="text-[10px] text-text-secondary leading-tight">
                Click preset nodes in the left palette to add them. Drag to position.
              </p>
            </div>
            <div className="bg-bg-surface-alt p-2.5 rounded-xl border border-border space-y-1">
              <span className="text-secondary font-bold block">2. Connect Data Flows</span>
              <p className="text-[10px] text-text-secondary leading-tight">
                Click the plug pin on a node to select it, then click any target node to draw a connected edge.
              </p>
            </div>
            <div className="bg-bg-surface-alt p-2.5 rounded-xl border border-border space-y-1">
              <span className="text-primary font-bold block">3. Rename & Adjust</span>
              <p className="text-[10px] text-text-secondary leading-tight">
                Double-click nodes to edit labels. Select and click delete or press Backspace/Delete to remove components or edges.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={dismissTooltip}
              aria-label="Acknowledge and dismiss guide"
              className="min-h-[40px] px-4 py-2 rounded-xl bg-primary text-text-on-primary text-xs font-bold shadow-soft hover:scale-102 active:scale-98 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Got it, start designing!
            </button>
          </div>
        </aside>
      )}
    </div>
  );
};

