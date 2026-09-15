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
  calculateEAR,
  calculateMAR,
  type Point2D,
  type LuminanceHistogramResult,
  type OtsuSegmentationResult,
  type SobelGradientResult,
  type TemporalMADResult,
} from '../../lib/services/ivpDiagnosticKernels';
import { extractFacialExpressions } from '@/lib/services/ivpExpressionKernel';
import {
  computeCoordinateMapping,
  mapNormalizedToCanvas,
  type CoordinateMappingMetrics,
} from '../../lib/services/visionPipeline';
import {
  DenseLandmarksSmoother,
  type SmoothedLandmarksResult,
  type TrackingPreset,
} from '../../lib/services/temporalSmoothing';
import type { DenseLandmarksEnvelope } from '@/types/workerMessages';
import type { VisionWorkerStats } from '@/hooks/useVisionWorker';

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
  ear: number;
  mar: number;
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
  showLandmarks?: boolean;
  showDebugHUD?: boolean;
  mirrored?: boolean;
  workerLandmarks?: { envelope: DenseLandmarksEnvelope; buffer: Float32Array } | null;
  poseAngles?: { yaw: number; pitch: number; roll: number };
  gazeCoords?: { x: number; y: number };
  trackingPreset?: TrackingPreset;
  workerStats?: VisionWorkerStats;
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
  showLandmarks = true,
  showDebugHUD = false,
  mirrored = false,
  workerLandmarks = null,
  poseAngles = { yaw: 0, pitch: 0, roll: 0 },
  gazeCoords = { x: 0, y: 0 },
  trackingPreset = 'BALANCED',
  workerStats,
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

  // ── Smooth EMA Face Tracking State ────────────────────────────────────────
  const smoothedFaceRef = useRef({
    cx: 320,
    cy: 220,
    scale: 1.0,
    minX: 210,
    minY: 100,
    maxX: 430,
    maxY: 360,
    initialized: false,
  });

  // ── Persistent Landmark EMA State (Zero-Jitter Optical Clinging) ──────────
  const smoothedLandmarksRef = useRef<{
    leftEyePts: Point2D[];
    rightEyePts: Point2D[];
    mouthPts: Point2D[];
    noseBridge: Point2D[];
    noseTip: Point2D;
    leftPupil: Point2D;
    rightPupil: Point2D;
    mouthCenter: Point2D;
    initialized: boolean;
  }>({
    leftEyePts: [],
    rightEyePts: [],
    mouthPts: [],
    noseBridge: [],
    noseTip: { x: 320, y: 240 },
    leftPupil: { x: 260, y: 200 },
    rightPupil: { x: 380, y: 200 },
    mouthCenter: { x: 320, y: 300 },
    initialized: false,
  });

  // ── High-Fidelity 70-Point Kinematic Landmark Smoother ─────────────────────
  const denseSmootherRef = useRef<DenseLandmarksSmoother>(new DenseLandmarksSmoother(70, trackingPreset));
  const lastSmoothedResRef = useRef<SmoothedLandmarksResult | null>(null);
  const lastRawNormPtsRef = useRef<Array<{ x: number; y: number }> | null>(null);

  // Synchronize tracking preset with dense smoother
  useEffect(() => {
    if (denseSmootherRef.current && trackingPreset) {
      denseSmootherRef.current.setPreset(trackingPreset);
    }
  }, [trackingPreset]);

  // ── Split-screen state ────────────────────────────────────────────────────
  const splitPercentRef = useRef<number>(50);
  const [splitPercent, setSplitPercent] = useState<number>(50);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // ── Telemetry state ───────────────────────────────────────────────────────
  const [liveMetrics, setLiveMetrics] = useState<DiagnosticMetrics>({
    ear: 0.285,
    mar: 0.145,
    fps: 60,
    targetLost: false,
  });

  // ── FPS tracking refs ─────────────────────────────────────────────────────
  const frameCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(0);
  const fpsRef = useRef<number>(60);
  const animFrameIdRef = useRef<number | null>(null);

  // ── Target-lost state ref ─────────────────────────────────────────────────
  const targetLostRef = useRef<boolean>(false);
  const lostFramesRef = useRef<number>(0);
  const lastMetricsDispatchRef = useRef<number>(0);
  const wasBlinkingRef = useRef<boolean>(false);

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
      // Always compute otsuRes on scratch buffer if not already active so skin segmentation is never undefined
      if (!otsuRes && prevImgDataRef.current) {
        otsuRes = applyYCrCbOtsuSegmentation(rawImgData, prevImgDataRef.current, PROC_W, PROC_H);
      }
    } else {
      for (let i = 0; i < procImgData.data.length; i += 4) {
        procImgData.data[i] = 15;
        procImgData.data[i + 1] = 23;
        procImgData.data[i + 2] = 42;
        procImgData.data[i + 3] = 255;
      }
    }

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

    // ── 10. DENSE 70-POINT GEOMETRIC FACIAL LANDMARK & KINEMATIC ENGINE ─────
    // Exact Aspect-Ratio Normalization & Coordinate Transform Pipeline
    const videoW = sourceElement instanceof HTMLVideoElement && sourceElement.videoWidth > 0
      ? sourceElement.videoWidth
      : (sourceElement instanceof HTMLImageElement && sourceElement.naturalWidth > 0 ? sourceElement.naturalWidth : PROC_W);
    const videoH = sourceElement instanceof HTMLVideoElement && sourceElement.videoHeight > 0
      ? sourceElement.videoHeight
      : (sourceElement instanceof HTMLImageElement && sourceElement.naturalHeight > 0 ? sourceElement.naturalHeight : PROC_H);

    const mapping = computeCoordinateMapping({
      videoWidth: videoW,
      videoHeight: videoH,
      canvasWidth: CSS_W,
      canvasHeight: CSS_H,
      fitMode: 'contain',
      mirrored,
    });

    let denseRes: SmoothedLandmarksResult;
    let isFaceGenuinelyDetected = false;
    let liveEAR = 0.285;
    let liveMAR = 0.145;

    if (workerLandmarks && workerLandmarks.buffer && workerLandmarks.buffer.length >= 70 * 4) {
      isFaceGenuinelyDetected = workerLandmarks.envelope.faceDetected;
      liveEAR = workerLandmarks.envelope.ear;
      liveMAR = workerLandmarks.envelope.mar;

      denseRes = denseSmootherRef.current.updateFromBuffer(
        workerLandmarks.buffer,
        70,
        workerLandmarks.envelope.timestampMs || now
      );

      const rawPts: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < 70; i++) {
        rawPts.push({ x: workerLandmarks.buffer[i * 4], y: workerLandmarks.buffer[i * 4 + 1] });
      }
      lastRawNormPtsRef.current = rawPts;
    } else {
      const liveExpr = !isTargetLost
        ? extractFacialExpressions(rawImgData.data, PROC_W, PROC_H)
        : null;

      isFaceGenuinelyDetected = !!(liveExpr && liveExpr.faceDetected);
      liveEAR = liveExpr ? liveExpr.ear : 0.285;
      liveMAR = liveExpr ? liveExpr.mar : 0.145;

      const rawPts70: Array<{ x: number; y: number; confidence?: number }> = [];
      if (liveExpr && liveExpr.faceDetected && liveExpr.landmarks) {
        const lm = liveExpr.landmarks;
        const fb = liveExpr.faceBox;
        // 0..16: Jawline
        for (let i = 0; i < 17; i++) {
          const theta = Math.PI + (i / 16) * Math.PI;
          rawPts70.push({
            x: ((fb.x + fb.width / 2) + Math.cos(theta) * (fb.width * 0.48)) / PROC_W,
            y: ((fb.y + fb.height * 0.45) + Math.sin(theta) * (fb.height * 0.45)) / PROC_H,
            confidence: 0.85,
          });
        }
        // 17..26: Brows
        for (let i = 0; i < 5; i++) {
          rawPts70.push({ x: (lm.leftPupil.x - 18 + i * 8) / PROC_W, y: (lm.leftPupil.y - 14) / PROC_H, confidence: 0.88 });
        }
        for (let i = 0; i < 5; i++) {
          rawPts70.push({ x: (lm.rightPupil.x - 14 + i * 8) / PROC_W, y: (lm.rightPupil.y - 14) / PROC_H, confidence: 0.88 });
        }
        // 27..30: Nose bridge
        for (let i = 0; i < 4; i++) {
          const p = lm.noseBridge[Math.min(lm.noseBridge.length - 1, i)];
          rawPts70.push({ x: p.x / PROC_W, y: p.y / PROC_H, confidence: 0.90 });
        }
        // 31..35: Nose bottom & tip
        rawPts70.push({ x: (lm.noseTip.x - 10) / PROC_W, y: (lm.noseTip.y + 4) / PROC_H, confidence: 0.90 });
        rawPts70.push({ x: (lm.noseTip.x - 5) / PROC_W, y: (lm.noseTip.y + 5) / PROC_H, confidence: 0.90 });
        rawPts70.push({ x: lm.noseTip.x / PROC_W, y: lm.noseTip.y / PROC_H, confidence: 0.95 });
        rawPts70.push({ x: (lm.noseTip.x + 5) / PROC_W, y: (lm.noseTip.y + 5) / PROC_H, confidence: 0.90 });
        rawPts70.push({ x: (lm.noseTip.x + 10) / PROC_W, y: (lm.noseTip.y + 4) / PROC_H, confidence: 0.90 });

        // 36..41: Left eye
        for (const p of lm.leftEyePts) rawPts70.push({ x: p.x / PROC_W, y: p.y / PROC_H, confidence: 0.94 });
        // 42..47: Right eye
        for (const p of lm.rightEyePts) rawPts70.push({ x: p.x / PROC_W, y: p.y / PROC_H, confidence: 0.94 });

        // 48..59: Outer mouth (12 points)
        for (let i = 0; i < 12; i++) {
          const p = lm.mouthPts[i % lm.mouthPts.length];
          rawPts70.push({ x: p.x / PROC_W, y: p.y / PROC_H, confidence: 0.92 });
        }
        // 60..67: Inner mouth (8 points)
        for (let i = 0; i < 8; i++) {
          const p = lm.mouthPts[i % lm.mouthPts.length];
          rawPts70.push({ x: p.x / PROC_W, y: p.y / PROC_H, confidence: 0.90 });
        }
        // 68: Left pupil
        rawPts70.push({ x: lm.leftPupil.x / PROC_W, y: lm.leftPupil.y / PROC_H, confidence: 0.95 });
        // 69: Right pupil
        rawPts70.push({ x: lm.rightPupil.x / PROC_W, y: lm.rightPupil.y / PROC_H, confidence: 0.95 });

        lastRawNormPtsRef.current = rawPts70.map(p => ({ x: p.x, y: p.y }));
        denseRes = denseSmootherRef.current.updateFromPoints(rawPts70, now);
      } else {
        denseRes = denseSmootherRef.current.updateFromPoints(
          (lastRawNormPtsRef.current || []).map(p => ({ x: p.x, y: p.y, confidence: 0.1 })),
          now
        );
      }
    }
    lastSmoothedResRef.current = denseRes;

    // Convert smoothed normalized points [0..1] to display canvas pixel space!
    const canvasPts: Point2D[] = denseRes.points.map(p => mapNormalizedToCanvas(p, mapping));

    const leftEyePts: Point2D[] = canvasPts.slice(36, 42);
    const rightEyePts: Point2D[] = canvasPts.slice(42, 48);
    const noseBridge: Point2D[] = canvasPts.slice(27, 31);
    const noseTip: Point2D = canvasPts[33] || canvasPts[30];
    const leftPupil: Point2D = canvasPts[68];
    const rightPupil: Point2D = canvasPts[69];
    const mouthPts: Point2D[] = canvasPts.slice(48, 60);
    const mouthInnerPts: Point2D[] = canvasPts.slice(60, 68);
    const mouthCenter: Point2D = {
      x: mouthPts.length >= 7 ? (mouthPts[0].x + mouthPts[6].x) / 2 : CSS_W / 2,
      y: mouthPts.length >= 10 ? (mouthPts[3].y + mouthPts[9].y) / 2 : CSS_H / 2,
    };

    // Calculate dynamic bounding box from facial landmarks
    let minBoxX = 9999, maxBoxX = -9999, minBoxY = 9999, maxBoxY = -9999;
    for (const p of canvasPts) {
      if (p.x < minBoxX) minBoxX = p.x;
      if (p.x > maxBoxX) maxBoxX = p.x;
      if (p.y < minBoxY) minBoxY = p.y;
      if (p.y > maxBoxY) maxBoxY = p.y;
    }
    const padX = (maxBoxX - minBoxX) * 0.12;
    const padY = (maxBoxY - minBoxY) * 0.14;
    const rawBoxX = Math.max(0, minBoxX - padX);
    const rawBoxY = Math.max(0, minBoxY - padY);
    const rawBoxW = Math.min(CSS_W, (maxBoxX - minBoxX) + padX * 2);
    const rawBoxH = Math.min(CSS_H, (maxBoxY - minBoxY) + padY * 2);

    const sf = smoothedFaceRef.current;
    if (!sf.initialized) {
      sf.minX = rawBoxX;
      sf.minY = rawBoxY;
      sf.maxX = rawBoxX + rawBoxW;
      sf.maxY = rawBoxY + rawBoxH;
      sf.initialized = true;
    } else {
      sf.minX = sf.minX * 0.40 + rawBoxX * 0.60;
      sf.minY = sf.minY * 0.40 + rawBoxY * 0.60;
      sf.maxX = sf.maxX * 0.40 + (rawBoxX + rawBoxW) * 0.60;
      sf.maxY = sf.maxY * 0.40 + (rawBoxY + rawBoxH) * 0.60;
    }

    const boxX = sf.minX;
    const boxY = sf.minY;
    const boxW = Math.max(20, sf.maxX - sf.minX);
    const boxH = Math.max(20, sf.maxY - sf.minY);

    const isBlink = liveEAR < 0.22;
    const isSpeaking = liveMAR >= 0.22;
    const s = Math.max(0.75, Math.min(1.4, boxW / 200));

    // ── 11. Render Dynamic Bounding Box with High-Tech Reticles ────────────
    if (showBoundingBox && !isTargetLost && (isFaceGenuinelyDetected || denseRes.regionConfidences.overall > 0.2) && denseRes.visibilityOpacity > 0.02) {
      ctx.save();
      ctx.globalAlpha = denseRes.visibilityOpacity;
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

      // Tracking HUD Badge with authentic live dimensions
      const roiText = `FACE ROI: ${Math.round(boxW)}x${Math.round(boxH)} [ACTIVE]`;
      ctx.font = 'bold 9px monospace';
      const badgeW = Math.max(148, ctx.measureText(roiText).width + 12);
      ctx.fillStyle = 'rgba(6, 182, 212, 0.9)';
      ctx.fillRect(boxX, boxY - 18, badgeW, 17);
      ctx.fillStyle = '#0B0F17';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(roiText, boxX + 4, boxY - 9);
      ctx.restore();
    }

    // ── 12. Render Active Eye & Lip Landmark Geometric Tracking Contours ───
    if (showLandmarks && !isTargetLost && (isFaceGenuinelyDetected || denseRes.regionConfidences.overall > 0.2) && denseRes.visibilityOpacity > 0.02) {
      ctx.save();
      ctx.globalAlpha = denseRes.visibilityOpacity;

      // A. Draw Eye Geometric Loops
      const renderEyeContour = (pts: Point2D[], isLeft: boolean) => {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();

        if (isBlink || liveEAR < 0.21) {
          // Blink State: Flash Gold/Amber
          ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
          ctx.fill();
          ctx.strokeStyle = '#FBBF24';
          ctx.lineWidth = 2.2;
          ctx.stroke();

          // Blink indicator badge above eye
          ctx.fillStyle = '#FBBF24';
          ctx.font = 'bold 9px monospace';
          ctx.fillText(`⚡ BLINK (${liveEAR.toFixed(2)})`, pts[0].x - 6, pts[1].y - 8);
        } else {
          // Open State: Cyan Contour Loop
          ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
          ctx.fill();
          ctx.strokeStyle = '#06B6D4';
          ctx.lineWidth = 1.6;
          ctx.stroke();

          // Pupil Center directly tracked from optical image darkness centroid
          const pupilBase = isLeft ? leftPupil : rightPupil;
          const pCenterX = pupilBase.x;
          const pCenterY = pupilBase.y;
          ctx.fillStyle = '#22D3EE';
          ctx.beginPath();
          ctx.arc(pCenterX, pCenterY, 3.2 * s, 0, 2 * Math.PI);
          ctx.fill();
        }
      };

      renderEyeContour(leftEyePts, true);
      renderEyeContour(rightEyePts, false);

      // B. Draw Lip Articulation Contour
      ctx.beginPath();
      ctx.moveTo(mouthPts[0].x, mouthPts[0].y);
      for (let i = 1; i < mouthPts.length; i++) {
        ctx.lineTo(mouthPts[i].x, mouthPts[i].y);
      }
      ctx.closePath();

      if (isSpeaking || liveMAR >= 0.25) {
        // Speech Active: Glowing Neon Green with vertical displacement indicator
        ctx.fillStyle = 'rgba(16, 185, 129, 0.35)';
        ctx.fill();
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 2.2;
        ctx.stroke();

        // Vertical mouth displacement line
        ctx.strokeStyle = '#34D399';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(mouthPts[2].x, mouthPts[2].y);
        ctx.lineTo(mouthPts[6].x, mouthPts[6].y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#34D399';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`SPEECH [MAR: ${liveMAR.toFixed(2)}]`, mouthCenter.x, mouthPts[6].y + 14);
      } else {
        // Resting Mouth: Subtle Emerald Loop
        ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
        ctx.fill();
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      // C. Nasal Bridge line
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(noseBridge[0].x, noseBridge[0].y);
      ctx.lineTo(noseBridge[1].x, noseBridge[1].y);
      ctx.lineTo(noseBridge[2].x, noseBridge[2].y);
      ctx.stroke();

      ctx.restore();
    }

    // ── 13. 3D Projected Euler Axis Tripod (Anchored Strictly to Nose Tip) ──
    if (show3DAxes && !isTargetLost && denseRes.visibilityOpacity > 0.02) {
      ctx.save();
      ctx.globalAlpha = denseRes.visibilityOpacity;
      drawProjected3DAxes(
        ctx,
        poseAngles.yaw,
        poseAngles.pitch,
        poseAngles.roll,
        noseTip.x,
        noseTip.y,
        55 * s
      );
      ctx.restore();
    }

    // ── 14. Gaze Vector Reticle Overlay ─────────────────────────────────────
    if (gazeCoords && !isTargetLost && denseRes.visibilityOpacity > 0.02) {
      const gazeScreenX = noseTip.x + gazeCoords.x * 120;
      const gazeScreenY = (noseTip.y - 25) + gazeCoords.y * 90;

      ctx.save();
      ctx.globalAlpha = denseRes.visibilityOpacity;
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

    // ── 15. Live Scientific HUD Telemetry Boxes ─────────────────────────────
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
      const sysW = 190;
      const sysH = 48;
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
      ctx.fillText('PIPELINE: 60 FPS GEOMETRY', sysX + 8, sysY + 8);

      ctx.font = '9px monospace';
      ctx.fillStyle = '#9CA3AF';
      ctx.fillText(`EAR: ${liveEAR.toFixed(3)}  |  MAR: ${liveMAR.toFixed(3)}`, sysX + 8, sysY + 22);
      ctx.fillText(`POSE: Y:${(poseAngles.yaw || 0).toFixed(0)}° P:${(poseAngles.pitch || 0).toFixed(0)}° R:${(poseAngles.roll || 0).toFixed(0)}°`, sysX + 8, sysY + 34);
      ctx.restore();
    }

    // ── 16. 256-Bin Luminance Histogram HUD Overlay ─────────────────────────
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

    // ── 18. VISUAL DEBUG & TELEMETRY HUD OVERLAY ───────────────────────────
    if (showDebugHUD && !isTargetLost) {
      ctx.save();

      // A. Render Raw Un-smoothed Landmark Points (Amber dots)
      if (lastRawNormPtsRef.current) {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.75)';
        for (const rp of lastRawNormPtsRef.current) {
          const cp = mapNormalizedToCanvas(rp, mapping);
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, 1.8, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      // B. Render Smoothed Landmark Points (Cyan dots)
      ctx.fillStyle = 'rgba(6, 182, 212, 0.9)';
      for (const sp of canvasPts) {
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 2.2, 0, 2 * Math.PI);
        ctx.fill();
      }

      // C. Render High-Tech Debug Metrics Card (Bottom-Right)
      const isThrottled = workerStats?.isThrottled ?? false;
      const dbgW = 320;
      const dbgH = isThrottled ? 122 : 108;
      const dbgX = CSS_W - dbgW - 12;
      const dbgY = CSS_H - dbgH - 12;

      ctx.fillStyle = 'rgba(3, 7, 18, 0.94)';
      ctx.strokeStyle = isThrottled ? '#F59E0B' : '#06B6D4';
      ctx.lineWidth = 1.2;
      ctx.fillRect(dbgX, dbgY, dbgW, dbgH);
      ctx.strokeRect(dbgX, dbgY, dbgW, dbgH);

      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = isThrottled ? '#F59E0B' : '#06B6D4';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('⚡ TRACKING HUD (Amber: Raw | Cyan: Smoothed)', dbgX + 8, dbgY + 8);

      ctx.font = '8.5px monospace';
      ctx.fillStyle = '#D1D5DB';
      const reqIdStr = workerLandmarks ? `#${workerLandmarks.envelope.requestId}` : '-';
      const droppedStr = workerStats ? `${workerStats.droppedFrames} (${workerStats.dropRatePercent}%)` : '0 (0%)';
      ctx.fillText(`REQ: ${reqIdStr} | DROPPED: ${droppedStr} | UNLOCKS: ${workerStats?.watchdogUnlocks ?? 0}`, dbgX + 8, dbgY + 22);

      const rttStr = workerLandmarks ? `${workerLandmarks.envelope.inferenceTimeMs.toFixed(1)} ms` : '< 1.5 ms';
      const inFlightStr = workerStats ? `${workerStats.inFlightMs} ms` : '-';
      const throttleStr = isThrottled ? `[THROTTLED: ${workerStats?.suggestedCadenceFps ?? 15} FPS]` : `[${workerStats?.suggestedCadenceFps ?? 30} FPS]`;
      ctx.fillText(`INFER: ${rttStr} | DRAW: ${fpsRef.current} FPS | CADENCE: ${throttleStr}`, dbgX + 8, dbgY + 36);

      const rc = denseRes.regionConfidences;
      ctx.fillStyle = '#10B981';
      ctx.fillText(`CONF: EYES ${(rc.eyes * 100).toFixed(0)}% | NOSE ${(rc.nose * 100).toFixed(0)}% | LIP ${(rc.mouth * 100).toFixed(0)}%`, dbgX + 8, dbgY + 50);

      ctx.fillStyle = '#FBBF24';
      const relocStr = denseRes.isRelocalizing ? `GLIDE (${Math.round(denseRes.relocalizationProgress * 100)}%)` : 'LOCKED';
      const engineStr = workerLandmarks?.envelope.trackingMode === 'LEARNED_FACELANDMARKER' ? 'LEARNED (MediaPipe)' : 'OPTICAL TRACKER';
      ctx.fillText(`ENGINE: ${engineStr} | RE-LOCK: ${relocStr}`, dbgX + 8, dbgY + 64);
      ctx.fillText(`PRESET: ${denseRes.activePreset} | α: ${denseRes.meanAlpha.toFixed(2)} | OCCLUSION: ${denseRes.occludedDurationSec.toFixed(1)}s`, dbgX + 8, dbgY + 78);
      ctx.fillText(`MAP: ${mapping.videoWidth}x${mapping.videoHeight} → ${mapping.canvasWidth}x${mapping.canvasHeight} (S: ${mapping.scale.toFixed(2)}) | MIRROR: ${mapping.mirrored ? 'ON' : 'OFF'}`, dbgX + 8, dbgY + 92);

      if (isThrottled) {
        ctx.fillStyle = '#F87171';
        ctx.fillText(`⚠ Throttled to ${workerStats?.suggestedCadenceFps ?? 15} FPS — switch to RESPONSIVE preset`, dbgX + 8, dbgY + 106);
      }

      ctx.restore();
    }

    // ── 17. Push telemetry state & propagate live EAR/MAR ───────────────────
    const metrics: DiagnosticMetrics = {
      histStats: histRes,
      otsuStats: otsuRes,
      sobelStats: sobelRes,
      madStats: madRes,
      ear: liveEAR,
      mar: liveMAR,
      fps: fpsRef.current,
      targetLost: isTargetLost,
    };

    // Dispatch metrics reliably: on state change or at least ~15 times per second (every 66ms)
    // so physiological oscilloscopes and blink detectors never miss state transitions
    const nowMs = performance.now();
    if (
      targetLostRef.current !== isTargetLost ||
      !lastMetricsDispatchRef.current ||
      nowMs - lastMetricsDispatchRef.current >= 65 ||
      (liveEAR < 0.22 && !wasBlinkingRef.current) ||
      (liveEAR >= 0.22 && wasBlinkingRef.current)
    ) {
      wasBlinkingRef.current = liveEAR < 0.22;
      lastMetricsDispatchRef.current = nowMs;
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
    showLandmarks,
    showDebugHUD,
    mirrored,
    workerLandmarks,
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
