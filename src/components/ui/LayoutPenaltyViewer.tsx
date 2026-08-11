'use client';

/**
 * LayoutPenaltyViewer
 * IVP Feature 1 — LayoutLMv3 Multi-Column Document Parser (Subprompt 2)
 *
 * Sidebar dashboard displaying:
 * - Circular layout integrity score gauge (0–100%)
 * - Detected layout type badge
 * - Penalty cards with severity, rule, description, deduction points
 * - Click-to-focus: clicking a penalty card highlights its bbox on the canvas
 */

import React from 'react';
import type { VisualLayoutAnalysisResult, LayoutFormattingPenalty } from '@/types/index';

// ── Score ring math ───────────────────────────────────────────────────────────
const RING_R = 38;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R; // ≈ 238.8

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function scoreToOffset(score: number): number {
  return RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * clamp(score, 0, 100)) / 100;
}

// ── Score color ───────────────────────────────────────────────────────────────
function scoreColor(score: number): { stroke: string; text: string } {
  if (score >= 85) return { stroke: '#10b981', text: 'text-emerald-400' };
  if (score >= 65) return { stroke: '#f59e0b', text: 'text-amber-400' };
  return { stroke: '#ef4444', text: 'text-red-400' };
}

// ── Layout type styles ────────────────────────────────────────────────────────
const LAYOUT_TYPE_STYLES: Record<
  VisualLayoutAnalysisResult['detectedLayoutType'],
  { label: string; color: string; bg: string; icon: string }
> = {
  SINGLE_COLUMN: {
    label: 'Single Column',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    icon: '▐',
  },
  TWO_COLUMN: {
    label: 'Two Column',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/20',
    icon: '▐▐',
  },
  HYBRID_GRID: {
    label: 'Hybrid Grid',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/20',
    icon: '▐▐▐',
  },
};

// ── Penalty rule labels ───────────────────────────────────────────────────────
const RULE_LABELS: Record<LayoutFormattingPenalty['ruleId'], { title: string; icon: string }> = {
  COLUMN_OVERLAP:     { title: 'Multi-Column Overlap Detected',   icon: '⚡' },
  MARGIN_VIOLATION:   { title: 'Margin Boundary Violation',       icon: '⚠️' },
  HIERARCHY_MISMATCH: { title: 'Typography Hierarchy Mismatch',   icon: '📐' },
  DENSITY_OVERFLOW:   { title: 'Content Density Overflow',        icon: '📋' },
};

const SEVERITY_STYLES: Record<
  LayoutFormattingPenalty['severity'],
  { badge: string; border: string; glow: string }
> = {
  CRITICAL: { badge: 'bg-red-500/15 text-red-400 border-red-500/30',   border: 'border-red-500/20',   glow: 'hover:border-red-500/40' },
  MODERATE: { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30', border: 'border-amber-500/20', glow: 'hover:border-amber-500/40' },
  MINOR:    { badge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',   border: 'border-white/10',     glow: 'hover:border-white/20' },
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface LayoutPenaltyViewerProps {
  result: VisualLayoutAnalysisResult;
  highlightedPenaltyIndex: number | null;
  onPenaltyClick: (index: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function LayoutPenaltyViewer({
  result,
  highlightedPenaltyIndex,
  onPenaltyClick,
}: LayoutPenaltyViewerProps) {
  const { layoutIntegrityScore, detectedLayoutType, penalties, elements, pageCount } = result;
  const sc = scoreColor(layoutIntegrityScore);
  const offset = scoreToOffset(layoutIntegrityScore);
  const layoutStyle = LAYOUT_TYPE_STYLES[detectedLayoutType];

  const headerCount = elements.filter(e => e.type === 'HEADER' || e.type === 'SECTION_TITLE').length;
  const bodyCount = elements.filter(e => e.type === 'BODY_TEXT').length;
  const columnCount = elements.filter(e => e.type === 'COLUMN_BLOCK').length;

  return (
    <div className="space-y-4">
      {/* ── Layout Score Ring ─────────────────────────────────────────────── */}
      <div className="bg-[#060b14] border border-white/8 rounded-2xl p-5 space-y-4">
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Visual Layout & Design Quality
        </h4>

        <div className="flex items-center gap-5">
          {/* Score Ring */}
          <div className="relative shrink-0">
            <svg width="96" height="96" viewBox="0 0 96 96">
              {/* Gradient defs */}
              <defs>
                <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={sc.stroke} />
                  <stop offset="100%" stopColor={sc.stroke} stopOpacity="0.6" />
                </linearGradient>
              </defs>
              {/* Track */}
              <circle
                cx="48" cy="48" r={RING_R}
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="7"
              />
              {/* Score arc */}
              <circle
                cx="48" cy="48" r={RING_R}
                fill="none"
                stroke="url(#scoreGrad)"
                strokeWidth="7"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform="rotate(-90 48 48)"
                style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
              />
            </svg>
            {/* Score label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-xl font-extrabold font-heading ${sc.text}`}>
                {Math.round(layoutIntegrityScore)}
              </span>
              <span className="text-[8px] text-gray-600 font-mono">/ 100</span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex-1 space-y-2.5">
            {/* Layout type badge */}
            <div
              className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-mono font-bold ${layoutStyle.bg} ${layoutStyle.color}`}
            >
              <span className="text-[11px]">{layoutStyle.icon}</span>
              {layoutStyle.label}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Pages', value: pageCount },
                { label: 'Sections', value: headerCount },
                { label: 'Penalties', value: penalties.length },
              ].map(stat => (
                <div
                  key={stat.label}
                  className="bg-[#0d1117] border border-white/5 rounded-lg px-2 py-1.5 text-center"
                >
                  <div className="text-sm font-bold text-white font-heading">{stat.value}</div>
                  <div className="text-[9px] text-gray-500 font-mono">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Element distribution mini bar */}
        <div className="space-y-1">
          <span className="text-[9px] text-gray-600 font-mono uppercase tracking-wider">
            Element Distribution
          </span>
          <div className="flex gap-1 h-1.5 w-full rounded-full overflow-hidden">
            {elements.length > 0 && (
              <>
                <div
                  className="bg-indigo-500 rounded-full"
                  style={{ width: `${(headerCount / elements.length) * 100}%` }}
                  title={`${headerCount} headers`}
                />
                <div
                  className="bg-sky-500 rounded-full"
                  style={{ width: `${(columnCount / elements.length) * 100}%` }}
                  title={`${columnCount} column blocks`}
                />
                <div
                  className="bg-gray-600 rounded-full flex-1"
                  title={`${bodyCount} body blocks`}
                />
              </>
            )}
          </div>
          <div className="flex gap-3 text-[8px] text-gray-600 font-mono">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" /> Headers
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block" /> Columns
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-600 inline-block" /> Body
            </span>
          </div>
        </div>
      </div>

      {/* ── Penalty Cards ─────────────────────────────────────────────────── */}
      {penalties.length === 0 ? (
        <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4 text-center space-y-1">
          <div className="text-emerald-400 text-lg">✓</div>
          <p className="text-xs font-semibold text-emerald-400">No layout violations detected</p>
          <p className="text-[10px] text-gray-500">
            Visual structure meets ATS formatting standards.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <h5 className="text-[9px] text-gray-500 font-mono uppercase tracking-widest px-1">
            Formatting Penalties · {penalties.length} issue{penalties.length !== 1 ? 's' : ''} found
          </h5>
          {penalties.map((penalty, idx) => {
            const ruleInfo = RULE_LABELS[penalty.ruleId];
            const sevStyle = SEVERITY_STYLES[penalty.severity];
            const isActive = highlightedPenaltyIndex === idx;

            return (
              <button
                key={`${penalty.ruleId}_${idx}`}
                onClick={() => onPenaltyClick(idx)}
                className={`w-full text-left rounded-xl border p-3.5 space-y-2 transition-all duration-200 cursor-pointer group ${
                  isActive
                    ? `${sevStyle.border} bg-[#0d1117] ring-1 ring-current`
                    : `border-white/8 bg-[#060b14] ${sevStyle.glow}`
                }`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">{ruleInfo.icon}</span>
                    <span className="text-xs font-semibold text-white leading-tight truncate">
                      {ruleInfo.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold font-mono border ${sevStyle.badge}`}
                    >
                      {penalty.severity}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">
                  {penalty.description}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between text-[9px] font-mono pt-0.5 border-t border-white/5">
                  <span className="text-gray-600">
                    {penalty.ruleId.replace(/_/g, ' ')}
                  </span>
                  <span className="text-red-400 font-bold">
                    −{penalty.deductionPoints} pts
                  </span>
                </div>

                {/* Bbox coordinates */}
                <div className="text-[8px] text-gray-700 font-mono">
                  bbox [{penalty.affectedBoundingBox.x0}, {penalty.affectedBoundingBox.y0}] →
                  [{penalty.affectedBoundingBox.x1}, {penalty.affectedBoundingBox.y1}]
                </div>

                {/* Focus hint */}
                {isActive && (
                  <div className="text-[9px] text-amber-400 font-mono animate-pulse">
                    ↑ highlighted on canvas
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
