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
// All heavy pixel math runs on this 320×240 scratch buffer. The result is
// upscaled to the display canvas via drawImage (GPU-accelerated bilinear).
// ---------------------------------------------------------------------------
const PROC_W = 320;
const PROC_H = 240;

export type DiagnosticMode =
  | 'SOBEL_GRADIENTS'
  | 'YCRCB_SKIN_OTSU'
  | 'LUMINANCE_HISTEQ'
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
  activeMode?: DiagnosticMode;
  onModeChange?: (mode: DiagnosticMode) => void;
  show3DAxes?: boolean;
  showHistogram?: boolean;
  showBoundingBox?: boolean;
  poseAngles?: { yaw: number; pitch: number; roll: number };
  gazeCoords?: { x: number; y: number };
  onMetricsUpdate?: (metrics: DiagnosticMetrics) => void;
  className?: string;
}

// Static academic syllabus titles
const MODE_TITLES: Record<DiagnosticMode, string> = {
  SOBEL_GRADIENTS:  'UNIT 4/5: SOBEL 3x3 GRADIENT VECTOR FIELD',
  YCRCB_SKIN_OTSU:   'UNIT 6/7: YCrCb CHROMINANCE & MORPHOLOGICAL OTSU MASK',
  LUMINANCE_HISTEQ:  'UNIT 2: CLAHE RADIOMETRIC HISTOGRAM EQUALIZATION',
  TEMPORAL_MAD:      'UNIT 8: INTER-FRAME TEMPORAL MAD MOTION HEATMAP',
};

export default function IVPInteractiveCanvas({
  sourceElement,
  activeMode = 'SOBEL_GRADIENTS',
  onModeChange,
  show3DAxes = true,
  showHistogram = true,
  showBoundingBox = true,
  poseAngles = { yaw: 0, pitch: 0, roll: 0 },
  gazeCoords = { x: 0, y: 0 },
  onMetricsUpdate,
  className = '',
}: IVPInteractiveCanvasProps) {
  // ── DOM refs ──────────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ── Offscreen pipeline canvases (320x240) ─────────────────────────────────
  const offscreenRawRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenProcRef = useRef<HTMLCanvasElement | null>(null);

  // ── Pre-allocated ImageData objects (zero-GC in RAF loop) ────────────────
  const rawImgDataRef = useRef<ImageData | null>(null);
  const procImgDataRef = useRef<ImageData | null>(null);
  const prevImgDataRef = useRef<ImageData | null>(null);

  // ── Split-screen state ────────────────────────────────────────────────────
  const splitPercentRef = useRef<number>(50);
  const [splitPercent, setSplitPercent] = useState<number>(50);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // ── Telemetry state ───────────────────────────────────────────────────────
  const [liveMetrics, setLiveMetrics] = useState<DiagnosticMetrics>({ fps: 60, targetLost: false });

  // ── FPS tracking refs ─────────────────────────────────────────────────────
  const frameCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(0);
  const fpsRef = useRef<number>(60);
  const animFrameIdRef = useRef<number | null>(null);

  // ── Target-lost state ref ─────────────────────────────────────────────────
  const targetLostRef = useRef<boolean>(false);
  const lostFramesRef = useRef<number>(0);

  // ─────────────────────────────────────────────────────────────────────────
  // Initialise offscreen canvases & pre-allocated ImageData buffers on mount
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    ensureKernelBuffers(PROC_W * PROC_H);

    const raw = document.createElement('canvas');
    raw.width = PROC_W;
    raw.height = PROC_H;
    offscreenRawRef.current = raw;

    const proc = document.createElement('canvas');
    proc.width = PROC_W;
    proc.height = PROC_H;
    offscreenProcRef.current = proc;

    const rawCtx = raw.getContext('2d', { willReadFrequently: true });
    const procCtx = proc.getContext('2d', { willReadFrequently: true });
    if (rawCtx && procCtx) {
      rawImgDataRef.current = rawCtx.createImageData(PROC_W, PROC_H);
      procImgDataRef.current = procCtx.createImageData(PROC_W, PROC_H);
      prevImgDataRef.current = rawCtx.createImageData(PROC_W, PROC_H);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // High-DPI canvas setup — run on mount and resize
  // ─────────────────────────────────────────────────────────────────────────
  const setupCanvasDPI = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const cssW = 640;
    const cssH = 480;

    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
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
    const canvas = canvasRef.current;
    const rawCanvas = offscreenRawRef.current;
    const procCanvas = offscreenProcRef.current;
    const rawImgData = rawImgDataRef.current;
    const procImgData = procImgDataRef.current;

    if (!canvas || !rawCanvas || !procCanvas || !rawImgData || !procImgData) {
      animFrameIdRef.current = requestAnimationFrame(processAndRenderFrame);
      return;
    }

    const ctx = canvas.getContext('2d');
    const rawCtx = rawCanvas.getContext('2d', { willReadFrequently: true });
    const procCtx = procCanvas.getContext('2d', { willReadFrequently: true });

    if (!ctx || !rawCtx || !procCtx) {
      animFrameIdRef.current = requestAnimationFrame(processAndRenderFrame);
      return;
    }

    // ── FPS counter ────────────────────────────────────────────────────────
    frameCountRef.current++;
    const now = performance.now();
    if (now - lastFpsTimeRef.current >= 500) {
      fpsRef.current = Math.round((frameCountRef.current * 1000) / (now - lastFpsTimeRef.current));
      frameCountRef.current = 0;
      lastFpsTimeRef.current = now;
    }

    // Logical canvas dimensions (640x480)
    const CSS_W = 640;
    const CSS_H = 480;

    // ── 1. Draw source into raw offscreen buffer (320x240) ─────────────────
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
      console.warn('[IVP] Source draw frame warning:', err);
    }

    // ── Target-lost detection (graceful 3-frame decay) ──────────────────────
    if (!frameValid || !sourceElement) {
      lostFramesRef.current++;
    } else {
      lostFramesRef.current = 0;
    }
    const isTargetLost = lostFramesRef.current > 3;

    // ── 2. Read raw pixels into pre-allocated buffer ───────────────────────
    const freshRaw = rawCtx.getImageData(0, 0, PROC_W, PROC_H);
    rawImgData.data.set(freshRaw.data);

    // ── 3. Execute Selected Academic Diagnostic Kernel ─────────────────────
    let histRes: LuminanceHistogramResult | undefined;
    let otsuRes: OtsuSegmentationResult | undefined;
    let sobelRes: SobelGradientResult | undefined;
    let madRes: TemporalMADResult | undefined;

    if (!isTargetLost) {
      switch (activeMode) {
        case 'SOBEL_GRADIENTS': {
          sobelRes = applySobelGradientField(rawImgData, procImgData, PROC_W, PROC_H, true);
          break;
        }
        case 'YCRCB_SKIN_OTSU': {
          otsuRes = applyYCrCbOtsuSegmentation(rawImgData, procImgData, PROC_W, PROC_H);
          break;
        }
        case 'LUMINANCE_HISTEQ': {
          histRes = applyHistogramEqualization(rawImgData, procImgData, PROC_W, PROC_H);
          break;
        }
        case 'TEMPORAL_MAD': {
          const prevToUse = prevImgDataRef.current;
          madRes = computeTemporalMAD(rawImgData, prevToUse, procImgData, PROC_W, PROC_H);
          break;
        }
      }
    } else {
      // Dark solid overlay if target lost
      for (let i = 0; i < procImgData.data.length; i += 4) {
        procImgData.data[i] = 15;
        procImgData.data[i + 1] = 23;
        procImgData.data[i + 2] = 42;
        procImgData.data[i + 3] = 255;
      }
    }

    // Always keep luminance histogram updated for overlay HUD
    if (!histRes && !isTargetLost) {
      histRes = computeLuminanceHistogram(rawImgData, PROC_W, PROC_H);
    }

    // ── 4. Save current frame for Temporal MAD differencing ────────────────
    if (frameValid && prevImgDataRef.current) {
      prevImgDataRef.current.data.set(rawImgData.data);
    }

    // ── 5. Blit processed pixels to offscreen proc canvas (320x240) ────────
    procCtx.putImageData(procImgData, 0, 0);

    // ── 6. Robust 9-Parameter Blit to Viewport Canvas (640x480) ────────────
    ctx.clearRect(0, 0, CSS_W, CSS_H);

    const splitPct = Math.max(0.02, Math.min(0.98, splitPercentRef.current / 100));
    const splitX = Math.round(splitPct * CSS_W);
    const splitSrcX = splitPct * PROC_W;

    // Draw Left Slice (Raw Input Video)
    if (splitX > 0) {
      ctx.drawImage(
        rawCanvas,
        0, 0, splitSrcX, PROC_H,
        0, 0, splitX, CSS_H
      );
    }

    // Draw Right Slice (Transformed Computer Vision Output)
    const rightW = CSS_W - splitX;
    const rightSrcW = PROC_W - splitSrcX;
    if (rightW > 0 && rightSrcW > 0) {
      ctx.drawImage(
        procCanvas,
        splitSrcX, 0, rightSrcW, PROC_H,
        splitX, 0, rightW, CSS_H
      );
    }

    // ── 7. Target-Lost Banner (if occluded) ─────────────────────────────────
    if (isTargetLost) {
      ctx.save();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.fillRect(0, 0, CSS_W, CSS_H);

      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#EF4444';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚠ STATUS: TARGET OCCLUDED / LOST', CSS_W / 2, CSS_H / 2 - 10);

      ctx.font = '10px monospace';
      ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.fillText('Align face with camera or select a sample image', CSS_W / 2, CSS_H / 2 + 12);
      ctx.restore();
    }

    // ── 8. Split Divider Line & Handle ──────────────────────────────────────
    ctx.save();
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#10B981';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(splitX, 0);
    ctx.lineTo(splitX, CSS_H);
    ctx.stroke();
    ctx.shadowBlur = 0;

    const gripY = CSS_H / 2;
    ctx.fillStyle = '#0B0F17';
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(splitX, gripY, 13, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⬌', splitX, gripY);
    ctx.restore();

    // ── 9. Viewport Academic Labels ─────────────────────────────────────────
    ctx.save();
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('◀ RAW CAMERA FEED', 14, 14);

    ctx.textAlign = 'right';
    ctx.fillText('IVP TRANSFORMED OUTPUT ▶', CSS_W - 14, 14);
    ctx.restore();

    // ── 10. Face Bounding Box & 3D Nose-Tip Anchor ──────────────────────────
    let faceCenterX = CSS_W * 0.5;
    let faceCenterY = CSS_H * 0.46;

    if (otsuRes && otsuRes.skinPixelCount > 400) {
      const mappedX = (otsuRes.centroidX / PROC_W) * CSS_W;
      const mappedY = (otsuRes.centroidY / PROC_H) * CSS_H;
      faceCenterX = Math.max(CSS_W * 0.25, Math.min(CSS_W * 0.75, mappedX));
      faceCenterY = Math.max(CSS_H * 0.25, Math.min(CSS_H * 0.70, mappedY));
    }

    const boxW = 190;
    const boxH = 240;
    const boxX = faceCenterX - boxW / 2;
    const boxY = faceCenterY - boxH * 0.45;
    const noseTipX = faceCenterX;
    const noseTipY = faceCenterY + 5;

    if (showBoundingBox && !isTargetLost) {
      ctx.save();
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(boxX, boxY, boxW, boxH);
      ctx.setLineDash([]);

      const cLen = 16;
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 2.5;

      // Top-Left Corner
      ctx.beginPath();
      ctx.moveTo(boxX, boxY + cLen);
      ctx.lineTo(boxX, boxY);
      ctx.lineTo(boxX + cLen, boxY);
      ctx.stroke();

      // Top-Right Corner
      ctx.beginPath();
      ctx.moveTo(boxX + boxW - cLen, boxY);
      ctx.lineTo(boxX + boxW, boxY);
      ctx.lineTo(boxX + boxW, boxY + cLen);
      ctx.stroke();

      // Bottom-Left Corner
      ctx.beginPath();
      ctx.moveTo(boxX, boxY + boxH - cLen);
      ctx.lineTo(boxX, boxY + boxH);
      ctx.lineTo(boxX + cLen, boxY + boxH);
      ctx.stroke();

      // Bottom-Right Corner
      ctx.beginPath();
      ctx.moveTo(boxX + boxW - cLen, boxY + boxH);
      ctx.lineTo(boxX + boxW, boxY + boxH);
      ctx.lineTo(boxX + boxW, boxY + boxH - cLen);
      ctx.stroke();

      // ROI Badge
      ctx.fillStyle = 'rgba(6, 182, 212, 0.85)';
      ctx.fillRect(boxX, boxY - 16, 120, 15);
      ctx.fillStyle = '#0B0F17';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('FACE ROI: 224x224', boxX + 4, boxY - 8);
      ctx.restore();
    }

    // ── 11. 3D Projected Euler Axis Tripod (Anchored to Nose Tip) ───────────
    if (show3DAxes && !isTargetLost) {
      drawProjected3DAxes(
        ctx,
        poseAngles.yaw,
        poseAngles.pitch,
        poseAngles.roll,
        noseTipX,
        noseTipY,
        55
      );
    }

    // ── 12. Gaze Vector Reticle Overlay ─────────────────────────────────────
    if (gazeCoords && !isTargetLost) {
      const gazeScreenX = noseTipX + gazeCoords.x * 120;
      const gazeScreenY = (noseTipY - 25) + gazeCoords.y * 90;

      ctx.save();
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(gazeScreenX, gazeScreenY, 14, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.fillStyle = '#06B6D4';
      ctx.beginPath();
      ctx.arc(gazeScreenX, gazeScreenY, 3, 0, 2 * Math.PI);
      ctx.fill();

      // Crosshairs
      ctx.beginPath();
      ctx.moveTo(gazeScreenX - 18, gazeScreenY);
      ctx.lineTo(gazeScreenX + 18, gazeScreenY);
      ctx.moveTo(gazeScreenX, gazeScreenY - 18);
      ctx.lineTo(gazeScreenX, gazeScreenY + 18);
      ctx.stroke();

      ctx.font = '9px monospace';
      ctx.fillStyle = '#06B6D4';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `GAZE [${gazeCoords.x.toFixed(2)}, ${gazeCoords.y.toFixed(2)}]`,
        gazeScreenX + 16,
        gazeScreenY
      );
      ctx.restore();
    }

    // ── 13. Live Scientific HUD Telemetry Boxes ─────────────────────────────
    if (!isTargetLost) {
      // TOP-RIGHT SCIENTIFIC HUD BOX (Over the IVP Transformed Side)
      const hudW = 280;
      const hudH = 58;
      const hudX = CSS_W - hudW - 12;
      const hudY = 32;

      ctx.save();
      ctx.fillStyle = 'rgba(11, 15, 23, 0.88)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.fillRect(hudX, hudY, hudW, hudH);
      ctx.strokeRect(hudX, hudY, hudW, hudH);

      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = '#10B981';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`[KERNEL] ${MODE_TITLES[activeMode]}`, hudX + 8, hudY + 8);

      ctx.font = '9px monospace';
      ctx.fillStyle = '#E5E7EB';

      if (activeMode === 'SOBEL_GRADIENTS' && sobelRes) {
        ctx.fillText(`|∇I| MAX: ${sobelRes.maxMagnitude} px  |  |∇I| MEAN: ${sobelRes.meanMagnitude.toFixed(1)} px`, hudX + 8, hudY + 24);
        ctx.fillStyle = '#FCD34D';
        ctx.fillText(`EDGE DENSITY: ${sobelRes.edgePixelRatio.toFixed(1)}%  |  θ = atan2(Gy, Gx)`, hudX + 8, hudY + 40);
      } else if (activeMode === 'YCRCB_SKIN_OTSU' && otsuRes) {
        ctx.fillText(`OTSU THRESHOLD t*: ${otsuRes.otsuThreshold}  |  Cr MASK: OPTIMAL`, hudX + 8, hudY + 24);
        ctx.fillStyle = '#22D3EE';
        ctx.fillText(`SKIN COVERAGE: ${otsuRes.skinPixelRatio.toFixed(1)}%  |  3x3 MORPHOLOGY`, hudX + 8, hudY + 40);
      } else if (activeMode === 'LUMINANCE_HISTEQ' && histRes) {
        ctx.fillText(`MEAN LUMA: ${histRes.meanVal.toFixed(1)}  |  RANGE: [${histRes.minVal}..${histRes.maxVal}]`, hudX + 8, hudY + 24);
        ctx.fillStyle = '#34D399';
        ctx.fillText(`TRANSFORMATION: s_k = 255 · CDF(r_k)`, hudX + 8, hudY + 40);
      } else if (activeMode === 'TEMPORAL_MAD' && madRes) {
        ctx.fillText(`INTER-FRAME MAD: ${madRes.madScore.toFixed(2)}  |  MAX Δ: ${madRes.maxPixelDiff}`, hudX + 8, hudY + 24);
        ctx.fillStyle = '#F87171';
        ctx.fillText(`MOTION COVERAGE: ${madRes.motionAreaRatio.toFixed(1)}%  |  THERMAL JET`, hudX + 8, hudY + 40);
      }
      ctx.restore();

      // TOP-LEFT TELEMETRY HUD BOX
      const sysW = 180;
      const sysH = 46;
      const sysX = 12;
      const sysY = 32;

      ctx.save();
      ctx.fillStyle = 'rgba(11, 15, 23, 0.88)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.fillRect(sysX, sysY, sysW, sysH);
      ctx.strokeRect(sysX, sysY, sysW, sysH);

      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = '#06B6D4';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('PIPELINE: 60 FPS DIAGNOSTIC', sysX + 8, sysY + 8);

      ctx.font = '9px monospace';
      ctx.fillStyle = '#9CA3AF';
      ctx.fillText(`POSE: Y:${poseAngles.yaw.toFixed(0)}° P:${poseAngles.pitch.toFixed(0)}° R:${poseAngles.roll.toFixed(0)}°`, sysX + 8, sysY + 22);
      ctx.fillText(`BUFFER: ${PROC_W}x${PROC_H} px`, sysX + 8, sysY + 34);
      ctx.restore();
    }

    // ── 14. 256-Bin Luminance Histogram HUD Overlay ─────────────────────────
    if (showHistogram && histRes && !isTargetLost) {
      const histW = 160;
      const histH = 48;
      const histX = 12;
      const histY = CSS_H - histH - 12;

      ctx.save();
      ctx.fillStyle = 'rgba(11, 15, 23, 0.88)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.fillRect(histX, histY, histW, histH);
      ctx.strokeRect(histX, histY, histW, histH);

      const maxBin = histogramMax(histRes.hist);
      if (maxBin > 0) {
        ctx.fillStyle = '#10B981';
        const binStep = histW / 256;
        const invMax = (histH - 4) / maxBin;
        for (let k = 0; k < 256; k++) {
          const binH = histRes.hist[k] * invMax;
          if (binH < 0.5) continue;
          ctx.fillRect(histX + k * binStep, histY + histH - binH - 2, Math.max(1, binStep), binH);
        }
      }

      ctx.font = '8px monospace';
      ctx.fillStyle = '#9CA3AF';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('256-Bin Luma Hist (Unit 2)', histX + 4, histY + 4);
      ctx.restore();
    }

    // ── 15. Push telemetry state ───────────────────────────────────────────
    const metrics: DiagnosticMetrics = {
      histStats: histRes,
      otsuStats: otsuRes,
      sobelStats: sobelRes,
      madStats: madRes,
      fps: fpsRef.current,
      targetLost: isTargetLost,
    };

    if (
      targetLostRef.current !== isTargetLost ||
      frameCountRef.current === 0
    ) {
      targetLostRef.current = isTargetLost;
      setLiveMetrics(metrics);
      if (onMetricsUpdate) onMetricsUpdate(metrics);
    }

    animFrameIdRef.current = requestAnimationFrame(processAndRenderFrame);
  }, [
    sourceElement,
    activeMode,
    show3DAxes,
    showHistogram,
    showBoundingBox,
    poseAngles,
    gazeCoords,
    onMetricsUpdate,
  ]);

  // Start / restart RAF loop
  useEffect(() => {
    setupCanvasDPI();
    lastFpsTimeRef.current = performance.now();
    animFrameIdRef.current = requestAnimationFrame(processAndRenderFrame);
    return () => {
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [processAndRenderFrame, setupCanvasDPI]);

  return (
    <div className={`space-y-3 text-left ${className}`}>
      {/* Diagnostic Mode Tabs (All 4 Academic Units) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ['SOBEL_GRADIENTS',  'Unit 4/5: Sobel Vector Field'],
              ['YCRCB_SKIN_OTSU',  'Unit 6/7: YCrCb Otsu Mask'],
              ['LUMINANCE_HISTEQ', 'Unit 2: CLAHE Equalization'],
              ['TEMPORAL_MAD',     'Unit 8: Temporal MAD Heatmap'],
            ] as [DiagnosticMode, string][]
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => onModeChange?.(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
                activeMode === mode
                  ? 'bg-primary text-white shadow-md shadow-primary/20 ring-1 ring-primary/40'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* FPS & Target Status */}
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

      {/* Main Dual-Viewport Inspection Canvas */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#030712] shadow-2xl select-none cursor-ew-resize"
      >
        <canvas
          ref={canvasRef}
          className="w-full h-auto block"
          style={{ width: '640px', height: '480px' }}
        />

        {/* Dynamic Metric HUD Pill */}
        <div className="absolute bottom-3 right-3 bg-[#0B0F17]/90 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-xl text-[10px] font-mono flex items-center gap-3">
          {activeMode === 'SOBEL_GRADIENTS' && liveMetrics.sobelStats && (
            <>
              <span className="text-gray-400">
                Max |∇|: <strong className="text-emerald-400">{liveMetrics.sobelStats.maxMagnitude} px</strong>
              </span>
              <span className="text-gray-400">
                Edge Coverage: <strong className="text-yellow-400">{liveMetrics.sobelStats.edgePixelRatio.toFixed(1)}%</strong>
              </span>
            </>
          )}

          {activeMode === 'YCRCB_SKIN_OTSU' && liveMetrics.otsuStats && (
            <>
              <span className="text-gray-400">
                Otsu Threshold t*: <strong className="text-emerald-400">{liveMetrics.otsuStats.otsuThreshold}</strong>
              </span>
              <span className="text-gray-400">
                Skin Area: <strong className="text-cyan-400">{liveMetrics.otsuStats.skinPixelRatio.toFixed(1)}%</strong>
              </span>
            </>
          )}

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

          {activeMode === 'TEMPORAL_MAD' && liveMetrics.madStats && (
            <>
              <span className="text-gray-400">
                MAD Score: <strong className="text-red-400">{liveMetrics.madStats.madScore.toFixed(2)}</strong>
              </span>
              <span className="text-gray-400">
                Motion Area: <strong className="text-orange-400">{liveMetrics.madStats.motionAreaRatio.toFixed(1)}%</strong>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
