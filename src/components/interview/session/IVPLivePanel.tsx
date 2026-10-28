'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  FaMicrochip,
  FaThLarge,
  FaAdjust,
  FaUserTag,
  FaWaveSquare,
  FaRunning,
  FaCheckCircle,
  FaPauseCircle,
} from 'react-icons/fa';
import Badge from '@/components/ui/Badge';
import type { IVPEvidenceRunnerHandle } from '@/hooks/useIVPEvidenceRunner';

export type IVPDiagnosticViewMode = 'grid' | 'equalized' | 'otsu' | 'sobel' | 'motion';

export interface IVPLivePanelProps {
  runner: IVPEvidenceRunnerHandle;
  className?: string;
  defaultMode?: IVPDiagnosticViewMode;
  sparklineSignal?: number; // e.g. EAR or motion energy (0..1)
}

interface KernelCanvasProps {
  imageData: ImageData | null | undefined;
  width?: number;
  height?: number;
  label: string;
  unit: string;
  isActive?: boolean;
  onClick?: () => void;
}

function KernelCanvas({
  imageData,
  width = 160,
  height = 120,
  label,
  unit,
  isActive = false,
  onClick,
}: KernelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageData) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      ctx.putImageData(imageData, 0, 0);
    } catch {
      // Ignored if dimensions mismatch
    }
  }, [imageData]);

  return (
    <div
      onClick={onClick}
      className={`group relative rounded-lg border overflow-hidden transition-all cursor-pointer ${
        isActive
          ? 'border-accent shadow-sm ring-1 ring-accent/40'
          : 'border-border/70 hover:border-border-hover bg-bg-surface-alt/50'
      }`}
    >
      <div className="relative aspect-[4/3] w-full bg-black/60 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full h-full object-contain"
          aria-label={`${label} diagnostic canvas`}
        />
        {!imageData && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-text-tertiary font-mono">
            Awaiting frames...
          </div>
        )}
        <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-xs text-[9px] font-mono text-text-primary flex items-center gap-1 border border-white/10">
          <span className="font-bold text-accent">{label}</span>
          <span className="text-text-tertiary">·</span>
          <span className="text-text-secondary">{unit}</span>
        </div>
      </div>
    </div>
  );
}

export default function IVPLivePanel({
  runner,
  className = '',
  defaultMode = 'grid',
  sparklineSignal = 0,
}: IVPLivePanelProps) {
  const [activeMode, setActiveMode] = useState<IVPDiagnosticViewMode>(defaultMode);
  const [history, setHistory] = useState<number[]>(() => Array(20).fill(0.3));

  // Update sparkline history
  useEffect(() => {
    if (runner.status !== 'running') return;
    setHistory((prev) => {
      const next = [...prev.slice(1), Math.max(0, Math.min(1, sparklineSignal))];
      return next;
    });
  }, [sparklineSignal, runner.status]);

  const isRunnerActive = runner.status === 'running';
  const isRunnerPaused = runner.status === 'paused';

  const buffers = runner.latestBuffers;

  return (
    <div
      data-testid="ivp-live-panel"
      className={`rounded-xl border border-border/80 bg-bg-surface p-3.5 space-y-3 font-mono shadow-soft ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-accent/10 text-accent">
            <FaMicrochip className="text-xs" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-xs font-bold font-heading text-text-primary tracking-tight">
              Classical Vision Pipeline
            </h3>
            <p className="text-[10px] text-text-secondary">
              Units 2, 4, 6–8 · On-device diagnostics
            </p>
          </div>
        </div>

        {/* Dynamic Status Tag (O4) */}
        <div className="flex items-center gap-1.5">
          {isRunnerActive ? (
            <Badge
              variant="success"
              size="sm"
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold animate-pulse"
              data-testid="ivp-evaluator-feeding-tag"
            >
              <FaCheckCircle className="text-[9px]" />
              Feeding the evaluator
            </Badge>
          ) : isRunnerPaused ? (
            <Badge
              variant="warning"
              size="sm"
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold"
              data-testid="ivp-evaluator-paused-tag"
            >
              <FaPauseCircle className="text-[9px]" />
              PAUSED
            </Badge>
          ) : (
            <Badge variant="neutral" size="sm" className="text-[10px]">
              IDLE
            </Badge>
          )}
        </div>
      </div>

      {/* Mode Switcher Tabs (replicates IVPLab diagnostic switcher) */}
      <div className="flex items-center gap-1 p-0.5 bg-bg-surface-alt rounded-lg border border-border/60 text-[10px]">
        <button
          type="button"
          onClick={() => setActiveMode('grid')}
          className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md font-medium transition-colors ${
            activeMode === 'grid'
              ? 'bg-bg-surface text-accent font-bold shadow-xs'
              : 'text-text-secondary hover:text-text-primary'
          }`}
          title="Show 4-kernel grid"
        >
          <FaThLarge className="text-[9px]" />
          <span>Grid</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMode('equalized')}
          className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md font-medium transition-colors ${
            activeMode === 'equalized'
              ? 'bg-bg-surface text-accent font-bold shadow-xs'
              : 'text-text-secondary hover:text-text-primary'
          }`}
          title="Unit 2: Histogram Equalization"
        >
          <FaAdjust className="text-[9px]" />
          <span>HistEq</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMode('otsu')}
          className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md font-medium transition-colors ${
            activeMode === 'otsu'
              ? 'bg-bg-surface text-accent font-bold shadow-xs'
              : 'text-text-secondary hover:text-text-primary'
          }`}
          title="Units 6-7: Otsu YCrCb Skin Mask"
        >
          <FaUserTag className="text-[9px]" />
          <span>Otsu</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMode('sobel')}
          className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md font-medium transition-colors ${
            activeMode === 'sobel'
              ? 'bg-bg-surface text-accent font-bold shadow-xs'
              : 'text-text-secondary hover:text-text-primary'
          }`}
          title="Unit 4: Sobel Gradient Field"
        >
          <FaWaveSquare className="text-[9px]" />
          <span>Sobel</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMode('motion')}
          className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md font-medium transition-colors ${
            activeMode === 'motion'
              ? 'bg-bg-surface text-accent font-bold shadow-xs'
              : 'text-text-secondary hover:text-text-primary'
          }`}
          title="Unit 8: Temporal MAD Motion"
        >
          <FaRunning className="text-[9px]" />
          <span>Motion</span>
        </button>
      </div>

      {/* Main Diagnostic Display */}
      {activeMode === 'grid' ? (
        <div className="grid grid-cols-2 gap-2" data-testid="ivp-grid-view">
          <KernelCanvas
            imageData={buffers?.equalized}
            label="HIST"
            unit="Unit 2"
            onClick={() => setActiveMode('equalized')}
          />
          <KernelCanvas
            imageData={buffers?.otsu}
            label="OTSU"
            unit="Unit 6-7"
            onClick={() => setActiveMode('otsu')}
          />
          <KernelCanvas
            imageData={buffers?.sobel}
            label="SOBEL"
            unit="Unit 4"
            onClick={() => setActiveMode('sobel')}
          />
          <KernelCanvas
            imageData={buffers?.motion}
            label="MAD"
            unit="Unit 8"
            onClick={() => setActiveMode('motion')}
          />
        </div>
      ) : (
        <div className="space-y-1.5" data-testid="ivp-single-view">
          {activeMode === 'equalized' && (
            <KernelCanvas
              imageData={buffers?.equalized}
              label="HISTOGRAM EQUALIZATION"
              unit="Unit 2 (256-bin CDF)"
              isActive
            />
          )}
          {activeMode === 'otsu' && (
            <KernelCanvas
              imageData={buffers?.otsu}
              label="YCrCb + OTSU SEGMENTATION"
              unit="Units 6-7 (Skin Mask)"
              isActive
            />
          )}
          {activeMode === 'sobel' && (
            <KernelCanvas
              imageData={buffers?.sobel}
              label="SOBEL GRADIENT FIELD"
              unit="Unit 4 (Sharpness Score)"
              isActive
            />
          )}
          {activeMode === 'motion' && (
            <KernelCanvas
              imageData={buffers?.motion}
              label="TEMPORAL MAD HEATMAP"
              unit="Unit 8 (Motion Energy)"
              isActive
            />
          )}
        </div>
      )}

      {/* Sparkline Signal Monitor */}
      <div className="rounded-lg bg-bg-surface-alt/70 border border-border/50 p-2 space-y-1">
        <div className="flex items-center justify-between text-[10px] text-text-secondary">
          <span className="flex items-center gap-1">
            <FaWaveSquare className="text-[9px] text-accent" />
            <span>Temporal Motion &amp; Signal Waveform</span>
          </span>
          <span className="text-text-primary font-bold">
            {(sparklineSignal * 100).toFixed(0)}%
          </span>
        </div>
        {/* SVG Sparkline */}
        <div className="h-6 w-full flex items-end gap-1">
          {history.map((val, idx) => (
            <div
              key={idx}
              className="flex-1 bg-accent/40 hover:bg-accent rounded-xs transition-all duration-150"
              style={{ height: `${Math.max(10, Math.round(val * 100))}%` }}
              title={`Sample ${idx}: ${(val * 100).toFixed(1)}%`}
            />
          ))}
        </div>
      </div>

      {/* Telemetry Metrics Readout */}
      <div className="grid grid-cols-3 gap-1.5 pt-1 text-[10px] text-text-secondary border-t border-border/60">
        <div className="bg-bg-surface-alt/40 p-1.5 rounded border border-border/40">
          <div className="text-text-tertiary text-[9px] uppercase">Frames</div>
          <div className="font-bold text-text-primary" data-testid="ivp-panel-frames-count">
            {runner.framesAnalyzed}
          </div>
        </div>
        <div className="bg-bg-surface-alt/40 p-1.5 rounded border border-border/40">
          <div className="text-text-tertiary text-[9px] uppercase">Cadence</div>
          <div className="font-bold text-text-primary" data-testid="ivp-panel-cadence">
            {runner.samplingHz} Hz
          </div>
        </div>
        <div className="bg-bg-surface-alt/40 p-1.5 rounded border border-border/40">
          <div className="text-text-tertiary text-[9px] uppercase">Kernel Time</div>
          <div className="font-bold text-text-primary">
            {runner.avgKernelMs.toFixed(1)} ms
          </div>
        </div>
      </div>
    </div>
  );
}
