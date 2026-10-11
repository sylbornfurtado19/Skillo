'use client';

import React, { useRef, useEffect, useCallback } from 'react';

export interface IVPSignalOscilloscopeProps {
  label: string;
  unit: string;
  currentValue: number;
  threshold?: number;
  thresholdLabel?: string;
  minRange?: number;
  maxRange?: number;
  color?: string;
  historyLength?: number;
  /** CSS height of the waveform canvas in logical pixels. Default 95. */
  height?: number;
  stats?: {
    triggerCount?: number;
    triggerLabel?: string;
    ratePerMin?: number;
    rateLabel?: string;
  };
  className?: string;
}

// Logical canvas width (CSS px). Backing store is scaled by DPR in `setupDPI`.
const CANVAS_CSS_W = 320;

export default function IVPSignalOscilloscope({
  label,
  unit,
  currentValue,
  threshold,
  thresholdLabel,
  minRange = 0,
  maxRange = 1,
  color = '#3F7D58',
  historyLength = 100,
  height = 95,
  stats,
  className = '',
}: IVPSignalOscilloscopeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ── O(1) Circular Ring Buffer — zero array allocations after init ────────
  // Instead of push + shift (which shifts all elements = O(n)), we keep a fixed
  // Float32Array and a write pointer that wraps around.
  const ringBuf  = useRef<Float32Array>(new Float32Array(historyLength).fill(currentValue));
  const writePtr = useRef<number>(0);       // next write position

  // Resize ring buffer if historyLength prop changes
  useEffect(() => {
    const old = ringBuf.current;
    if (old.length !== historyLength) {
      const next = new Float32Array(historyLength);
      next.fill(currentValue);
      ringBuf.current = next;
      writePtr.current = 0;
    }
  }, [historyLength, currentValue]);

  // ── High-DPI canvas initialisation ──────────────────────────────────────
  const setupDPI = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === 'undefined') return;

    const dpr     = window.devicePixelRatio || 1;
    const cssW    = CANVAS_CSS_W;
    const cssH    = height;

    canvas.width  = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width  = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }, [height]);

  useEffect(() => {
    setupDPI();
  }, [setupDPI]);

  // ── Write new sample and render ──────────────────────────────────────────
  useEffect(() => {
    // 1. Write new sample into ring buffer at current write pointer (O(1))
    const buf = ringBuf.current;
    buf[writePtr.current] = currentValue;
    writePtr.current = (writePtr.current + 1) % buf.length;

    // 2. Render
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // CSS logical dimensions (DPR handled by the context scale transform)
    const W = CANVAS_CSS_W;
    const H = height;

    // ── Background ────────────────────────────────────────────────────────
    ctx.fillStyle = '#EFEBE5';
    ctx.fillRect(0, 0, W, H);

    // ── Oscilloscope grid lines ───────────────────────────────────────────
    ctx.strokeStyle = 'rgba(43, 37, 35, 0.08)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([]);

    // 3 horizontal divisions
    for (let i = 1; i <= 3; i++) {
      const y = (H / 4) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    // 5 vertical divisions
    for (let i = 1; i <= 5; i++) {
      const x = (W / 6) * i;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }

    // ── Threshold dashed line ─────────────────────────────────────────────
    const range = maxRange - minRange;
    if (threshold !== undefined && range > 0) {
      const normThresh = Math.max(0, Math.min(1, (threshold - minRange) / range));
      const threshY    = H - normThresh * H;

      ctx.save();
      ctx.strokeStyle = 'rgba(179, 38, 30, 0.75)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, threshY);
      ctx.lineTo(W, threshY);
      ctx.stroke();

      if (thresholdLabel) {
        ctx.fillStyle = '#B3261E';
        ctx.font      = '9px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(thresholdLabel, 6, threshY - 2);
      }
      ctx.restore();
    }

    // ── Waveform trace ────────────────────────────────────────────────────
    const n   = buf.length;
    const dx  = W / (n - 1);
    const invRange = range > 0 ? 1 / range : 1;

    ctx.save();
    ctx.lineWidth   = 2.2;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 5;
    ctx.setLineDash([]);

    // Read from ring buffer in chronological order
    // The oldest sample is at writePtr (the slot that was just overwritten is the newest,
    // so the slot after writePtr is the oldest surviving one).
    const oldest = writePtr.current;  // next write slot = oldest slot after the latest write

    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const sampleIdx = (oldest + i) % n;
      const val       = buf[sampleIdx];
      const normVal   = Math.max(0, Math.min(1, (val - minRange) * invRange));
      const x = i * dx;
      const y = H - normVal * H;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Head dot (latest sample = writePtr - 1 wrapping)
    const latestIdx  = (writePtr.current + n - 1) % n;
    const latestVal  = buf[latestIdx];
    const latestNorm = Math.max(0, Math.min(1, (latestVal - minRange) * invRange));
    const dotX = (n - 1) * dx;
    const dotY = H - latestNorm * H;

    ctx.fillStyle = '#9B2218';
    ctx.beginPath();
    ctx.arc(dotX, dotY, 3.5, 0, 2 * Math.PI);
    ctx.fill();

    ctx.restore();
  }, [currentValue, threshold, thresholdLabel, minRange, maxRange, color, height]);

  return (
    <div className={`bg-surface border border-border shadow-soft rounded-xl p-3 space-y-2 text-left ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-bold text-text-primary uppercase tracking-wider">
            {label}
          </span>
          <span className="text-[10px] text-text-secondary font-mono">
            [{minRange}..{maxRange} {unit}]
          </span>
        </div>
        <span className="text-xs font-bold font-mono" style={{ color }}>
          {currentValue.toFixed(3)} {unit}
        </span>
      </div>

      {/* Waveform — canvas sized by CSS, backed by DPR-scaled pixels */}
      <div className="relative rounded-lg overflow-hidden border border-border bg-surface-alt">
        <canvas
          ref={canvasRef}
          className="block"
          style={{ width: `${CANVAS_CSS_W}px`, height: `${height}px` }}
        />
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="flex items-center justify-between text-[10px] font-mono text-text-secondary border-t border-border pt-1.5">
          {stats.triggerLabel !== undefined && stats.triggerCount !== undefined && (
            <div>
              <span>{stats.triggerLabel}: </span>
              <strong className="text-text-primary">{stats.triggerCount}</strong>
            </div>
          )}
          {stats.rateLabel !== undefined && stats.ratePerMin !== undefined && (
            <div>
              <span>{stats.rateLabel}: </span>
              <strong className="text-success">{stats.ratePerMin.toFixed(1)}/min</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
