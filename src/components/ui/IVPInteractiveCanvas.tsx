'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  applyHistogramEqualization,
  applyYCrCbOtsuSegmentation,
  applySobelGradientField,
  computeTemporalMAD,
  computeLuminanceHistogram,
  drawProjected3DAxes,
  ensureKernelBuffers,
  histogramMax,
  type LuminanceHistogramResult,
  type OtsuSegmentationResult,
  type SobelGradientResult,
  type TemporalMADResult,
} from '../../lib/services/ivpDiagnosticKernels';

// ---------------------------------------------------------------------------
// Internal canvas dimensions for the diagnostic processing pipeline.
// All heavy pixel math runs on this 320×240 scratch buffer.  The result is
// upscaled to the display canvas via drawImage (GPU-accelerated bilinear).
// ---------------------------------------------------------------------------
const PROC_W = 320;
const PROC_H = 240;

export type DiagnosticMode =
  | 'RAW'
  | 'LUMINANCE_HISTEQ'
  | 'YCRCB_SKIN_OTSU'
  | 'SOBEL_GRADIENTS'
  | 'TEMPORAL_MAD';

export interface DiagnosticMetrics {
  histStats?: LuminanceHistogramResult;
  otsuStats?: OtsuSegmentationResult;
  sobelStats?: SobelGradientResult;
  madStats?: TemporalMADResult;
  fps: number;
  targetLost: boolean;
}

export interface IVPInteractiveCanvasProps {
  sourceElement: HTMLVideoElement | HTMLImageElement | null;
  activeMode: DiagnosticMode;
  onModeChange: (mode: DiagnosticMode) => void;
  show3DAxes?: boolean;
  showHistogram?: boolean;
  poseAngles?: { yaw: number; pitch: number; roll: number };
  gazeCoords?: { x: number; y: number };
  onMetricsUpdate?: (metrics: DiagnosticMetrics) => void;
  className?: string;
}

// Static label map — created once at module scope, NOT inside the RAF callback
const MODE_LABELS: Record<DiagnosticMode, string> = {
  RAW:                'PASSTHROUGH',
  LUMINANCE_HISTEQ:   'UNIT 2: CLAHE HIST-EQ ▶',
  YCRCB_SKIN_OTSU:    'UNIT 6/7: YCRCB OTSU SKIN MASK ▶',
  SOBEL_GRADIENTS:    'UNIT 4/5: SOBEL GRADIENT FIELD ▶',
  TEMPORAL_MAD:       'UNIT 8: TEMPORAL MAD HEATMAP ▶',
};

export default function IVPInteractiveCanvas({
  sourceElement,
  activeMode,
  onModeChange,
  show3DAxes = true,
  showHistogram = true,
  poseAngles = { yaw: 0, pitch: 0, roll: 0 },
  gazeCoords  = { x: 0, y: 0 },
  onMetricsUpdate,
  className = '',
}: IVPInteractiveCanvasProps) {
  // ── DOM refs ──────────────────────────────────────────────────────────────
  const canvasRef    = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ── Offscreen pipeline canvases ───────────────────────────────────────────
  const offscreenRawRef  = useRef<HTMLCanvasElement | null>(null);
  const offscreenProcRef = useRef<HTMLCanvasElement | null>(null);

  // ── Pre-allocated ImageData objects (zero-GC in RAF loop) ────────────────
  // Allocated once at the fixed PROC_W × PROC_H resolution and reused every frame.
  const rawImgDataRef  = useRef<ImageData | null>(null);
  const procImgDataRef = useRef<ImageData | null>(null);
  const prevImgDataRef = useRef<ImageData | null>(null);   // for MAD temporal diff

  // ── Split-screen state ────────────────────────────────────────────────────
  const splitPercentRef = useRef<number>(50);              // ref to avoid RAF closure stale reads
  const [splitPercent, setSplitPercent] = useState<number>(50);
  const [isDragging, setIsDragging]     = useState<boolean>(false);

  // ── Telemetry state ───────────────────────────────────────────────────────
  const [liveMetrics, setLiveMetrics]   = useState<DiagnosticMetrics>({ fps: 0, targetLost: false });

  // ── FPS tracking refs ─────────────────────────────────────────────────────
  const frameCountRef   = useRef<number>(0);
  const lastFpsTimeRef  = useRef<number>(0);
  const fpsRef          = useRef<number>(60);
  const animFrameIdRef  = useRef<number | null>(null);

  // ── Target-lost state ref (avoids stale closure / setState spam) ──────────
  const targetLostRef   = useRef<boolean>(false);
  const lostFramesRef   = useRef<number>(0);   // consecutive frames with no valid source

  // ─────────────────────────────────────────────────────────────────────────
  // Initialise all offscreen canvases AND pre-allocated ImageData on mount
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Ensure kernel scratch buffers are pre-allocated for the pipeline resolution
    ensureKernelBuffers(PROC_W * PROC_H);

    const raw = document.createElement('canvas');
    raw.width = PROC_W; raw.height = PROC_H;
    offscreenRawRef.current = raw;

    const proc = document.createElement('canvas');
    proc.width = PROC_W; proc.height = PROC_H;
    offscreenProcRef.current = proc;

    // Pre-allocate ImageData objects — reused every frame (zero allocation in RAF)
    const rawCtx  = raw.getContext('2d', { willReadFrequently: true });
    const procCtx = proc.getContext('2d', { willReadFrequently: true });
    if (rawCtx && procCtx) {
      rawImgDataRef.current  = rawCtx.createImageData(PROC_W, PROC_H);
      procImgDataRef.current = procCtx.createImageData(PROC_W, PROC_H);
      prevImgDataRef.current = rawCtx.createImageData(PROC_W, PROC_H);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // High-DPI canvas setup — run once on mount + on resize
  // ─────────────────────────────────────────────────────────────────────────
  const setupCanvasDPI = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr    = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const cssW   = 640;
    const cssH   = 480;

    // Set backing store size = logical × DPR
    canvas.width  = cssW * dpr;
    canvas.height = cssH * dpr;

    // Keep CSS display size fixed
    canvas.style.width  = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    // Scale the context so all draw calls use logical pixel coords
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  useEffect(() => {
    setupCanvasDPI();
  }, [setupCanvasDPI]);

  // ─────────────────────────────────────────────────────────────────────────
  // Split slider pointer handling
  // ─────────────────────────────────────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    updateSplitPosition(e.clientX);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    updateSplitPosition(e.clientX);
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };
  const updateSplitPosition = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
    splitPercentRef.current = pct;
    setSplitPercent(pct);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Main 60 FPS render & diagnostic processing RAF loop
  // ─────────────────────────────────────────────────────────────────────────
  const processAndRenderFrame = useCallback(() => {
    const canvas    = canvasRef.current;
    const rawCanvas = offscreenRawRef.current;
    const procCanvas = offscreenProcRef.current;
    const rawImgData  = rawImgDataRef.current;
    const procImgData = procImgDataRef.current;

    if (!canvas || !rawCanvas || !procCanvas || !rawImgData || !procImgData) {
      animFrameIdRef.current = requestAnimationFrame(processAndRenderFrame);
      return;
    }

    // The getContext call returns the SAME cached context object — no allocation
    const ctx     = canvas.getContext('2d');
    const rawCtx  = rawCanvas.getContext('2d', { willReadFrequently: true });
    const procCtx = procCanvas.getContext('2d', { willReadFrequently: true });

    if (!ctx || !rawCtx || !procCtx) {
      animFrameIdRef.current = requestAnimationFrame(processAndRenderFrame);
      return;
    }

    // ── FPS counter (update every 500 ms) ───────────────────────────────
    frameCountRef.current++;
    const now = performance.now();
    if (now - lastFpsTimeRef.current >= 500) {
      fpsRef.current = Math.round((frameCountRef.current * 1000) / (now - lastFpsTimeRef.current));
      frameCountRef.current  = 0;
      lastFpsTimeRef.current = now;
    }

    // ── 1. Draw source into raw offscreen buffer (PROC_W × PROC_H) ─────
    // CSS logical dimensions — the DPR scale does not affect drawImage coords
    const CSS_W = 640;
    const CSS_H = 480;

    let frameValid = false;
    try {
      if (sourceElement instanceof HTMLVideoElement) {
        if (sourceElement.readyState >= 2 && sourceElement.videoWidth > 0) {
          rawCtx.drawImage(sourceElement, 0, 0, PROC_W, PROC_H);
          frameValid = true;
        }
      } else if (sourceElement instanceof HTMLImageElement) {
        if (sourceElement.complete && sourceElement.naturalWidth > 0) {
          rawCtx.drawImage(sourceElement, 0, 0, PROC_W, PROC_H);
          frameValid = true;
        }
      }
    } catch (err) {
      // Swallow security errors (cross-origin, covered camera, etc.)
      console.warn('[IVP] Source draw warning:', err);
    }

    // ── Target-lost detection (graceful decay) ───────────────────────────
    if (!frameValid || !sourceElement) {
      lostFramesRef.current++;
    } else {
      lostFramesRef.current = 0;
    }
    const isTargetLost = lostFramesRef.current > 3; // grace: 3 frames before flagging

    // ── 2. Copy raw pixels into pre-allocated rawImgData ───────────────
    // getImageData into a pre-created ImageData avoids creating a new object
    const freshRaw = rawCtx.getImageData(0, 0, PROC_W, PROC_H);
    rawImgData.data.set(freshRaw.data);

    // ── 3. Execute the selected diagnostic kernel ───────────────────────
    let histRes: LuminanceHistogramResult | undefined;
    let otsuRes: OtsuSegmentationResult  | undefined;
    let sobelRes: SobelGradientResult    | undefined;
    let madRes: TemporalMADResult        | undefined;

    if (!isTargetLost) {
      switch (activeMode) {
        case 'RAW':
          procImgData.data.set(rawImgData.data);
          histRes = computeLuminanceHistogram(rawImgData, PROC_W, PROC_H);
          break;
        case 'LUMINANCE_HISTEQ':
          histRes = applyHistogramEqualization(rawImgData, procImgData, PROC_W, PROC_H);
          break;
        case 'YCRCB_SKIN_OTSU':
          otsuRes = applyYCrCbOtsuSegmentation(rawImgData, procImgData, PROC_W, PROC_H);
          break;
        case 'SOBEL_GRADIENTS':
          sobelRes = applySobelGradientField(rawImgData, procImgData, PROC_W, PROC_H, true);
          break;
        case 'TEMPORAL_MAD': {
          const prevToUse = prevImgDataRef.current;
          madRes = computeTemporalMAD(rawImgData, prevToUse, procImgData, PROC_W, PROC_H);
          break;
        }
      }
    } else {
      // Target lost: fill processed buffer with dark overlay
      for (let i = 0; i < procImgData.data.length; i += 4) {
        procImgData.data[i]     = 15;
        procImgData.data[i + 1] = 15;
        procImgData.data[i + 2] = 20;
        procImgData.data[i + 3] = 255;
      }
    }

    // ── 4. Save current raw frame into prevImgData for next-frame MAD ───
    // Only update when we have a valid frame (so MAD doesn't decay on lost target)
    if (frameValid && prevImgDataRef.current) {
      prevImgDataRef.current.data.set(rawImgData.data);
    }

    // ── 5. Blit processed pixels onto offscreen proc canvas ─────────────
    procCtx.putImageData(procImgData, 0, 0);

    // ── 6. Composite dual-viewport on main display canvas ───────────────
    // All draw coords are in CSS logical pixels (DPR scale applied via ctx.scale in setupCanvasDPI)
    const splitX = Math.round((splitPercentRef.current / 100) * CSS_W);

    ctx.clearRect(0, 0, CSS_W, CSS_H);

    // Left: raw camera feed
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, splitX, CSS_H);
    ctx.clip();
    ctx.drawImage(rawCanvas, 0, 0, CSS_W, CSS_H);
    ctx.restore();

    // Right: processed diagnostic feed
    ctx.save();
    ctx.beginPath();
    ctx.rect(splitX, 0, CSS_W - splitX, CSS_H);
    ctx.clip();
    ctx.drawImage(procCanvas, 0, 0, CSS_W, CSS_H);
    ctx.restore();

    // ── 7. Target-lost banner ────────────────────────────────────────────
    if (isTargetLost) {
      ctx.save();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
      ctx.fillRect(0, 0, CSS_W, CSS_H);

      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#EF4444';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚠  STATUS: TARGET OCCLUDED / LOST', CSS_W / 2, CSS_H / 2 - 12);

      ctx.font = '10px monospace';
      ctx.fillStyle = 'rgba(239, 68, 68, 0.75)';
      ctx.fillText('Point camera at a face or load an image', CSS_W / 2, CSS_H / 2 + 12);
      ctx.restore();
    }

    // ── 8. Split divider line & grip handle ─────────────────────────────
    ctx.save();
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#10B981';
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    ctx.moveTo(splitX, 0);
    ctx.lineTo(splitX, CSS_H);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Grip circle
    const gripY = CSS_H / 2;
    ctx.fillStyle   = '#0B0F17';
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(splitX, gripY, 13, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    ctx.fillText('⬌', splitX, gripY);
    ctx.restore();

    // ── 9. Viewport watermarks ───────────────────────────────────────────
    ctx.save();
    ctx.font      = 'bold 10px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('◀ RAW INPUT STREAM', 14, 14);

    ctx.textAlign = 'right';
    ctx.fillText(MODE_LABELS[activeMode], CSS_W - 14, 14);
    ctx.restore();

    // ── 10. 3D Pinhole Euler Axes overlay (Unit 1) ───────────────────────
    if (show3DAxes && !isTargetLost) {
      drawProjected3DAxes(
        ctx,
        poseAngles.yaw,
        poseAngles.pitch,
        poseAngles.roll,
        CSS_W * 0.5,
        CSS_H * 0.45,
        55
      );
    }

    // ── 11. Gaze reticle overlay ─────────────────────────────────────────
    if (gazeCoords && !isTargetLost) {
      const gazeScreenX = CSS_W * (0.5 + gazeCoords.x * 0.4);
      const gazeScreenY = CSS_H * (0.5 + gazeCoords.y * 0.4);

      ctx.save();
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.arc(gazeScreenX, gazeScreenY, 16, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.fillStyle = '#06B6D4';
      ctx.beginPath();
      ctx.arc(gazeScreenX, gazeScreenY, 3, 0, 2 * Math.PI);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(gazeScreenX - 22, gazeScreenY);
      ctx.lineTo(gazeScreenX + 22, gazeScreenY);
      ctx.moveTo(gazeScreenX, gazeScreenY - 22);
      ctx.lineTo(gazeScreenX, gazeScreenY + 22);
      ctx.stroke();

      ctx.font      = '9px monospace';
      ctx.fillStyle = '#06B6D4';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `GAZE (${gazeCoords.x.toFixed(2)}, ${gazeCoords.y.toFixed(2)})`,
        gazeScreenX + 18,
        gazeScreenY
      );
      ctx.restore();
    }

    // ── 12. 256-bin Luminance Histogram HUD ─────────────────────────────
    if (showHistogram && histRes && !isTargetLost) {
      const histW = 160;
      const histH = 50;
      const histX = 14;
      const histY = CSS_H - histH - 14;

      ctx.save();
      ctx.fillStyle   = 'rgba(11, 15, 23, 0.85)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth   = 1;
      ctx.fillRect(histX, histY, histW, histH);
      ctx.strokeRect(histX, histY, histW, histH);

      // Use O(256) loop helper instead of expensive spread + Array.from
      const maxBin = histogramMax(histRes.hist);
      if (maxBin > 0) {
        ctx.fillStyle = '#10B981';
        const binStep = histW / 256;
        const invMax  = (histH - 4) / maxBin;
        for (let k = 0; k < 256; k++) {
          const binH = histRes.hist[k] * invMax;
          if (binH < 0.5) continue;   // skip near-zero bars
          ctx.fillRect(histX + k * binStep, histY + histH - binH - 2, Math.max(1, binStep), binH);
        }
      }

      ctx.font      = '8px monospace';
      ctx.fillStyle = '#9CA3AF';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('256-Bin Luma Hist (Unit 2)', histX + 4, histY + 4);
      ctx.restore();
    }

    // ── 13. Push telemetry to React state (throttled — only if changed) ─
    const newTargetLost = isTargetLost;
    const metrics: DiagnosticMetrics = {
      histStats:  histRes,
      otsuStats:  otsuRes,
      sobelStats: sobelRes,
      madStats:   madRes,
      fps:        fpsRef.current,
      targetLost: newTargetLost,
    };

    // Avoid setState spam — only update when meaningful values changed
    if (
      targetLostRef.current !== newTargetLost ||
      frameCountRef.current === 0  // every ~500ms FPS window
    ) {
      targetLostRef.current = newTargetLost;
      setLiveMetrics(metrics);
      if (onMetricsUpdate) onMetricsUpdate(metrics);
    }

    animFrameIdRef.current = requestAnimationFrame(processAndRenderFrame);
  }, [
    sourceElement,
    activeMode,
    show3DAxes,
    showHistogram,
    poseAngles,
    gazeCoords,
    onMetricsUpdate,
  ]);

  // Start / restart the RAF loop when dependencies change
  useEffect(() => {
    // Reset DPR scaling whenever the loop restarts (covers hot reload)
    setupCanvasDPI();
    lastFpsTimeRef.current = performance.now();
    animFrameIdRef.current = requestAnimationFrame(processAndRenderFrame);
    return () => {
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [processAndRenderFrame, setupCanvasDPI]);

  // ─────────────────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className={`space-y-3 text-left ${className}`}>
      {/* Mode Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ['RAW',              'Raw Stream'],
              ['LUMINANCE_HISTEQ', 'Unit 2: CLAHE Equalization'],
              ['YCRCB_SKIN_OTSU',  'Unit 6/7: YCrCb Otsu Mask'],
              ['SOBEL_GRADIENTS',  'Unit 4/5: Sobel Vector Field'],
              ['TEMPORAL_MAD',     'Unit 8: Temporal MAD Heatmap'],
            ] as [DiagnosticMode, string][]
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => onModeChange(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
                activeMode === mode
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* FPS counter + target status */}
        <div className="flex items-center gap-3 text-[11px] font-mono">
          {liveMetrics.targetLost && (
            <span className="text-red-400 font-bold animate-pulse">⚠ TARGET LOST</span>
          )}
          <span className="text-gray-400">
            Render:{' '}
            <strong className={liveMetrics.fps >= 30 ? 'text-emerald-400' : 'text-yellow-400'}>
              {liveMetrics.fps} FPS
            </strong>
          </span>
          <span className="text-gray-500">Split: {Math.round(splitPercent)}%</span>
        </div>
      </div>

      {/* Main Dual-Viewport Canvas */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#030712] shadow-2xl select-none cursor-ew-resize"
      >
        {/* Canvas — actual backing-store size set by DPR logic; CSS size fixed to 640×480 */}
        <canvas
          ref={canvasRef}
          className="w-full h-auto block"
          style={{ width: '640px', height: '480px' }}
        />

        {/* Dynamic Metric HUD Pill */}
        <div className="absolute bottom-3 right-3 bg-[#0B0F17]/90 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-xl text-[10px] font-mono flex items-center gap-3">
          {activeMode === 'LUMINANCE_HISTEQ' && liveMetrics.histStats && (
            <>
              <span className="text-gray-400">
                Mean Luma: <strong className="text-emerald-400">{liveMetrics.histStats.meanVal.toFixed(1)}</strong>
              </span>
              <span className="text-gray-400">
                Range: <strong className="text-white">[{liveMetrics.histStats.minVal}..{liveMetrics.histStats.maxVal}]</strong>
              </span>
            </>
          )}
          {activeMode === 'YCRCB_SKIN_OTSU' && liveMetrics.otsuStats && (
            <>
              <span className="text-gray-400">
                Otsu t*: <strong className="text-emerald-400">{liveMetrics.otsuStats.otsuThreshold}</strong>
              </span>
              <span className="text-gray-400">
                Skin: <strong className="text-cyan-400">{liveMetrics.otsuStats.skinPixelRatio.toFixed(1)}%</strong>
              </span>
            </>
          )}
          {activeMode === 'SOBEL_GRADIENTS' && liveMetrics.sobelStats && (
            <>
              <span className="text-gray-400">
                Max |∇|: <strong className="text-emerald-400">{liveMetrics.sobelStats.maxMagnitude}</strong>
              </span>
              <span className="text-gray-400">
                Edge%: <strong className="text-yellow-400">{liveMetrics.sobelStats.edgePixelRatio.toFixed(1)}%</strong>
              </span>
            </>
          )}
          {activeMode === 'TEMPORAL_MAD' && liveMetrics.madStats && (
            <>
              <span className="text-gray-400">
                MAD: <strong className="text-red-400">{liveMetrics.madStats.madScore.toFixed(2)}</strong>
              </span>
              <span className="text-gray-400">
                Motion: <strong className="text-orange-400">{liveMetrics.madStats.motionAreaRatio.toFixed(1)}%</strong>
              </span>
            </>
          )}
          {activeMode === 'RAW' && (
            <span className="text-gray-400">
              Yaw <strong className="text-emerald-400">{poseAngles.yaw.toFixed(1)}°</strong>
              {' | '}Pitch <strong className="text-red-400">{poseAngles.pitch.toFixed(1)}°</strong>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
