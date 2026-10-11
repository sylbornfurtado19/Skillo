'use client';

/**
 * VisualDocumentCanvas
 * IVP Feature 1 — LayoutLMv3 Multi-Column Document Parser (Subprompt 2)
 *
 * Renders an SVG-based interactive canvas that maps VisualLayoutElement
 * bounding boxes (normalized [0,1000] grid) over a virtual document frame.
 * SVG viewBox="0 0 1000 1000" means no manual coordinate scaling is needed.
 */

import React, { useState, useCallback } from 'react';
import type { VisualLayoutElement, LayoutFormattingPenalty, BoundingBox2D } from '@/types/index';

// ── Color palette by element type ─────────────────────────────────────────────
const TYPE_STYLES: Record<
  VisualLayoutElement['type'],
  { stroke: string; fill: string; strokeWidth: number }
> = {
  HEADER:        { stroke: '#9B2218', fill: 'rgba(155,34,24,0.12)', strokeWidth: 1.5 },
  SECTION_TITLE: { stroke: '#7F1B13', fill: 'rgba(127,27,19,0.08)', strokeWidth: 1.5 },
  BODY_TEXT:     { stroke: '#6A625E', fill: 'rgba(106,98,94,0.05)',   strokeWidth: 0.8 },
  COLUMN_BLOCK:  { stroke: '#6B6E70', fill: 'rgba(107,110,112,0.08)', strokeWidth: 1.2 },
  LIST_ITEM:     { stroke: '#55585A', fill: 'rgba(85,88,90,0.04)',   strokeWidth: 0.8 },
};

const SEVERITY_COLORS: Record<string, { stroke: string; fill: string; glow: string }> = {
  CRITICAL: { stroke: '#B3261E', fill: 'rgba(179,38,30,0.18)', glow: '#B3261E' },
  MODERATE: { stroke: '#C98A1B', fill: 'rgba(201,138,27,0.15)', glow: '#C98A1B' },
  MINOR:    { stroke: '#4A6B8A', fill: 'rgba(74,107,138,0.12)', glow: '#4A6B8A' },
};

// ── Tooltip state ─────────────────────────────────────────────────────────────
interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  element: VisualLayoutElement | null;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface VisualDocumentCanvasProps {
  elements: VisualLayoutElement[];
  penalties: LayoutFormattingPenalty[];
  highlightedPenaltyBBox: BoundingBox2D | null;
  selectedElementId: string | null;
  onElementClick: (id: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function VisualDocumentCanvas({
  elements,
  penalties,
  highlightedPenaltyBBox,
  selectedElementId,
  onElementClick,
}: VisualDocumentCanvasProps) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    element: null,
  });

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<SVGRectElement>, el: VisualLayoutElement) => {
      const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement)
        .getBoundingClientRect();
      setTooltip({
        visible: true,
        // Position tooltip relative to SVG container
        x: e.clientX - rect.left + 12,
        y: e.clientY - rect.top - 10,
        element: el,
      });
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGRectElement>) => {
      const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement)
        .getBoundingClientRect();
      setTooltip(prev => ({
        ...prev,
        x: e.clientX - rect.left + 12,
        y: e.clientY - rect.top - 10,
      }));
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(prev => ({ ...prev, visible: false }));
  }, []);

  // Set of penalty-affected bbox signatures for O(1) lookup
  const penaltyBBoxKeys = new Set(
    penalties.map(p => `${p.affectedBoundingBox.x0}_${p.affectedBoundingBox.y0}`)
  );

  const isPenaltyAffected = (el: VisualLayoutElement) =>
    penaltyBBoxKeys.has(`${el.boundingBox.x0}_${el.boundingBox.y0}`);

  const penaltyForEl = (el: VisualLayoutElement) =>
    penalties.find(
      p =>
        p.affectedBoundingBox.x0 === el.boundingBox.x0 &&
        p.affectedBoundingBox.y0 === el.boundingBox.y0
    );

  return (
    <div className="relative w-full select-none">
      {/* Document Frame */}
      <div className="relative w-full rounded-xl overflow-hidden border border-border bg-surface shadow-soft">
        {/* Header Bar */}
        <div className="flex flex-col gap-1 px-4 py-3 border-b border-border bg-surface-alt">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-danger/70" />
              <div className="h-2.5 w-2.5 rounded-full bg-warning/70" />
              <div className="h-2.5 w-2.5 rounded-full bg-success/70" />
            </div>
            <span className="text-xs font-heading font-bold text-text-primary ml-2">
              Document Layout & Formatting Inspector
            </span>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-[9px] text-primary font-mono">● HEADER</span>
              <span className="text-[9px] text-secondary font-mono">● COLUMN</span>
              <span className="text-[9px] text-danger font-mono">● PENALTY</span>
            </div>
          </div>
          <p className="text-[10px] text-text-secondary">
            Analyzes document structure, column boundaries, and typography hierarchy using deterministic spatial geometry rules.
          </p>
        </div>

        {/* SVG Canvas — viewBox 0 0 1000 1000 matches the normalized grid directly */}
        <svg
          viewBox="0 0 1000 1000"
          className="w-full h-auto block"
          style={{ aspectRatio: '800 / 1100', maxHeight: '620px' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* SVG defs: glow filter for penalty highlights */}
          <defs>
            <filter id="glow-red" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-amber" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Margin safety guides */}
            <line id="margin-l" x1="20" y1="0" x2="20" y2="1000" />
            <line id="margin-r" x1="980" y1="0" x2="980" y2="1000" />
          </defs>

          {/* Page background */}
          <rect x="0" y="0" width="1000" height="1000" fill="#FBF9F6" stroke="#E2DDD5" strokeWidth="2" />

          {/* Margin safety guide lines */}
          <line x1="20" y1="0" x2="20" y2="1000" stroke="rgba(179,38,30,0.15)" strokeWidth="1" strokeDasharray="4 6" />
          <line x1="980" y1="0" x2="980" y2="1000" stroke="rgba(179,38,30,0.15)" strokeWidth="1" strokeDasharray="4 6" />

          {/* Render all elements */}
          {elements.map(el => {
            const { x0, y0, x1, y1, width, height } = el.boundingBox;
            const isAffected = isPenaltyAffected(el);
            const pen = isAffected ? penaltyForEl(el) : null;
            const isSelected = selectedElementId === el.id;
            const isHighlighted =
              highlightedPenaltyBBox !== null &&
              highlightedPenaltyBBox.x0 === x0 &&
              highlightedPenaltyBBox.y0 === y0;

            const baseStyle = TYPE_STYLES[el.type];

            let stroke = baseStyle.stroke;
            let fill = baseStyle.fill;
            let strokeWidth = baseStyle.strokeWidth;
            let filter: string | undefined;

            if (isHighlighted && pen) {
              const sc = SEVERITY_COLORS[pen.severity];
              stroke = sc.stroke;
              fill = sc.fill;
              strokeWidth = 2.5;
              filter = pen.severity === 'CRITICAL' ? 'url(#glow-red)' : 'url(#glow-amber)';
            } else if (isAffected && pen) {
              stroke = SEVERITY_COLORS[pen.severity].stroke;
              fill = SEVERITY_COLORS[pen.severity].fill;
              strokeWidth = 1.8;
            } else if (isSelected) {
              stroke = '#9B2218';
              fill = 'rgba(155,34,24,0.18)';
              strokeWidth = 2;
            }

            // Ensure minimum visible size
            const renderW = Math.max(width, 20);
            const renderH = Math.max(height, 8);

            return (
              <g key={el.id}>
                <rect
                  x={x0}
                  y={y0}
                  width={renderW}
                  height={renderH}
                  stroke={stroke}
                  fill={fill}
                  strokeWidth={strokeWidth}
                  rx={2}
                  style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                  filter={filter}
                  onMouseEnter={evt => handleMouseEnter(evt, el)}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => onElementClick(el.id)}
                />
                {/* Element type label for headers/section titles */}
                {(el.type === 'HEADER' || el.type === 'SECTION_TITLE') &&
                  renderW > 60 && (
                    <text
                      x={x0 + 4}
                      y={y0 + renderH - 3}
                      fontSize="5"
                      fill={stroke}
                      opacity={0.7}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {el.type}
                    </text>
                  )}
              </g>
            );
          })}

          {/* Highlighted penalty bbox overlay (from penalty card click) */}
          {highlightedPenaltyBBox && (
            <rect
              x={highlightedPenaltyBBox.x0 - 4}
              y={highlightedPenaltyBBox.y0 - 4}
              width={Math.max(highlightedPenaltyBBox.width + 8, 40)}
              height={Math.max(highlightedPenaltyBBox.height + 8, 16)}
              stroke="#B3261E"
              fill="none"
              strokeWidth="3"
              strokeDasharray="6 3"
              rx={4}
              filter="url(#glow-red)"
              style={{ pointerEvents: 'none' }}
            />
          )}
        </svg>

        {/* Floating Tooltip */}
        {tooltip.visible && tooltip.element && (
          <div
            className="absolute z-50 pointer-events-none"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <div className="bg-surface border border-border rounded-lg px-3 py-2 shadow-soft text-xs space-y-1 min-w-[180px] max-w-[260px]">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: TYPE_STYLES[tooltip.element.type].stroke }}
                />
                <span className="font-mono font-bold text-text-primary">
                  {tooltip.element.type}
                </span>
              </div>
              <p className="text-text-secondary leading-relaxed line-clamp-2">
                {tooltip.element.text}
              </p>
              <div className="flex gap-3 text-[10px] text-text-secondary font-mono pt-0.5 border-t border-border">
                <span>col span: {tooltip.element.columnSpan}</span>
                <span>level: H{tooltip.element.visualHierarchyLevel}</span>
                <span>
                  bbox [{tooltip.element.boundingBox.x0},{tooltip.element.boundingBox.y0}]
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend row */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 px-1">
        {(
          Object.entries(TYPE_STYLES) as [VisualLayoutElement['type'], (typeof TYPE_STYLES)[VisualLayoutElement['type']]][]
        ).map(([type, style]) => (
          <div key={type} className="flex items-center gap-1.5 text-[9px] text-text-secondary font-mono">
            <div
              className="h-2 w-4 rounded-sm border"
              style={{ borderColor: style.stroke, background: style.fill }}
            />
            {type}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-[9px] text-danger font-mono ml-auto">
          <div className="h-2 w-4 rounded-sm border border-danger bg-danger/15" />
          PENALTY
        </div>
      </div>
    </div>
  );
}
