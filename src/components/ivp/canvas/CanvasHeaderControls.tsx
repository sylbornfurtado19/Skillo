'use client';

import React from 'react';
import type { DiagnosticMode, DiagnosticMetrics, TrackingLifecycleState } from './types';
import type { IVPFeatureFlags } from '@/lib/services/ivpFeatureFlags';

export interface CanvasHeaderControlsProps {
  activeMode: DiagnosticMode;
  onModeChange?: (mode: DiagnosticMode) => void;
  trackingState: TrackingLifecycleState;
  liveMetrics: DiagnosticMetrics;
  splitPercent: number;
  faceList: Array<{ id: string; x: number; y: number; w: number; h: number }>;
  selectedFaceId: string | null;
  onSelectFace: (faceId: string) => void;
  featureFlags: IVPFeatureFlags;
  onToggleWarmup: () => void;
  onOpenCalibration: () => void;
  onExportTelemetry: () => void;
  onToggleSafeMode: () => void;
  isMicroPaused: boolean;
  onToggleMicroPause: () => void;
}

export default function CanvasHeaderControls({
  activeMode,
  onModeChange,
  trackingState,
  liveMetrics,
  splitPercent,
  faceList,
  selectedFaceId,
  onSelectFace,
  featureFlags,
  onToggleWarmup,
  onOpenCalibration,
  onExportTelemetry,
  onToggleSafeMode,
  isMicroPaused,
  onToggleMicroPause,
}: CanvasHeaderControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            ['SOBEL_GRADIENTS',     'Unit 4/5: Sobel Vector Field'],
            ['YCRCB_SKIN_OTSU',     'Unit 6/7: YCrCb Otsu Mask'],
            ['LUMINANCE_HISTEQ',    'Unit 2: CLAHE Equalization'],
            ['TEMPORAL_MAD',        'Unit 8: Temporal MAD Heatmap'],
            ['PERSON_SEGMENTATION', 'Unit 2/8: Person Segmentation'],
          ] as [DiagnosticMode, string][]
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => onModeChange?.(mode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
              activeMode === mode
                ? 'bg-primary text-text-on-primary shadow-soft'
                : 'bg-surface-alt text-text-secondary hover:text-text-primary hover:bg-surface-alt/80 border border-border'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* FPS & Target Status */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
        {trackingState !== 'MODEL_READY' && (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-warning/15 text-warning border border-warning/30 animate-pulse">
            ⚡ WARMING UP ({trackingState})
          </span>
        )}
        {liveMetrics.targetLost && (
          <span className="text-danger font-bold animate-pulse">⚠ TARGET LOST</span>
        )}
        <span className="text-text-secondary">
          Render:{' '}
          <strong className={liveMetrics.fps >= 30 ? 'text-success' : 'text-warning'}>
            {liveMetrics.fps} FPS
          </strong>
        </span>
        <span className="text-text-secondary">Split: {Math.round(splitPercent)}%</span>

        {/* Multi-Face Selector Pills */}
        <div id="face-selector-list" className="flex items-center gap-1">
          <span className="text-text-secondary text-[10px]">Face:</span>
          {(faceList.length > 0 ? faceList : [{ id: String(selectedFaceId || '1'), x: 0, y: 0, w: 0, h: 0 }]).map((f, i) => {
            const isActive = (selectedFaceId === f.id) || (!selectedFaceId && i === 0);
            return (
              <button
                key={f.id}
                id={`select-face-btn-${f.id}`}
                type="button"
                onClick={() => onSelectFace(f.id)}
                className={`px-2 py-0.5 rounded border text-[10px] font-mono transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-primary-soft border-primary/30 text-primary font-bold'
                    : 'bg-surface-alt border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                Face #{i + 1} {f.id.length > 8 ? f.id.slice(0, 6) : f.id} {isActive ? '★' : ''}
              </button>
            );
          })}
        </div>

        {/* Warmup Mode Toggle */}
        <button
          id="warmup-mode-btn"
          type="button"
          onClick={onToggleWarmup}
          className={`px-2 py-0.5 rounded border text-[10px] font-mono transition-colors ${
            featureFlags.enableWarmup
              ? 'bg-warning/15 border-warning/30 text-warning'
              : 'bg-surface-alt border-border text-text-secondary hover:text-text-primary'
          }`}
        >
          {featureFlags.enableWarmup ? '⚡ WARMUP: ON' : '⚡ WARMUP: OFF'}
        </button>

        {/* Calibrate Face Button */}
        <button
          id="calibrate-face-btn"
          type="button"
          onClick={onOpenCalibration}
          className="px-2 py-0.5 rounded border border-border bg-surface-alt text-text-primary hover:bg-surface-alt/80 text-[10px] font-mono transition-colors"
        >
          🎯 CALIBRATE
        </button>

        {/* Freeze & Export Button */}
        <button
          id="freeze-export-btn"
          type="button"
          onClick={onExportTelemetry}
          className="px-2 py-0.5 rounded border border-border bg-surface-alt text-text-primary hover:bg-surface-alt/80 text-[10px] font-mono transition-colors"
        >
          💾 EXPORT TELEMETRY
        </button>

        {/* Safe Mode Toggle */}
        <button
          id="safe-mode-btn"
          type="button"
          onClick={onToggleSafeMode}
          className={`px-2 py-0.5 rounded border text-[10px] font-mono transition-colors ${
            featureFlags.enableSafeMode
              ? 'bg-danger/15 border-danger/30 text-danger'
              : 'bg-surface-alt border-border text-text-secondary hover:text-text-primary'
          }`}
        >
          {featureFlags.enableSafeMode ? '🛡 SAFE MODE: ON' : '🛡 SAFE MODE: OFF'}
        </button>

        {/* Pause Micro Updates Button */}
        <button
          id="pause-micro-btn"
          type="button"
          onClick={onToggleMicroPause}
          className={`px-2 py-0.5 rounded border text-[10px] font-mono transition-colors ${
            isMicroPaused
              ? 'bg-warning/15 border-warning/30 text-warning'
              : 'bg-surface-alt border-border text-text-secondary hover:text-text-primary'
          }`}
        >
          {isMicroPaused ? '▶ RESUME MICRO' : '⏸ PAUSE MICRO'}
        </button>
      </div>
    </div>
  );
}
