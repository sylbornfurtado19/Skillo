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
  procToVideoX,
  procToVideoY,
  detectDeviceProfile,
  detectFastFaceBootstrap,
  OnlineCalibrationEstimator,
  type CoordinateMappingMetrics,
  type DeviceProfile,
  type FastFaceBootstrapResult,
} from '../../lib/services/visionPipeline';
import {
  DenseLandmarksSmoother,
  type SmoothedLandmarksResult,
  type TrackingPreset,
} from '../../lib/services/temporalSmoothing';
import type { DenseLandmarksEnvelope } from '@/types/workerMessages';
import type { VisionWorkerStats, WorkerTimelineTelemetry } from '@/hooks/useVisionWorker';
import { MicroPatchTracker, type TrackedFeature } from '../../lib/services/microPatchTracker';
import {
  getIVPFeatureFlags,
  setIVPFeatureFlag,
  subscribeIVPFeatureFlags,
  type IVPFeatureFlags,
} from '../../lib/services/ivpFeatureFlags';

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

export type TrackingLifecycleState = 'BOOTSTRAPPING' | 'MODEL_PENDING' | 'MODEL_READY';

export interface CanvasTimelineTelemetry {
  pageLoadTs: number;
  workerSpawnTs: number;
  modelInitStartTs: number;
  modelInitDoneTs: number;
  firstFrameSentTs: number;
  firstModelPacketTs: number;
  firstTemplatesCreatedTs: number;
  firstMicroAcceptedTs: number;
  firstSmoothedRenderTs: number;
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
  workerTimeline?: WorkerTimelineTelemetry;
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
  workerTimeline,
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
  const microTrackerRef = useRef<MicroPatchTracker>(new MicroPatchTracker(8, 8));
  const lastWorkerBufferRef = useRef<Float32Array | null>(null);
  const lastMicroTrackedRef = useRef<Map<number, TrackedFeature>>(new Map());
  const lastMicroTrackMsRef = useRef<number>(0);
  const microMatchesTriedRef = useRef<number>(0);
  const microMatchesAcceptedRef = useRef<number>(0);
  const microTrackMsSamplesRef = useRef<number[]>([]);
  const isMicroPausedRef = useRef<boolean>(false);
  const [isMicroPaused, setIsMicroPaused] = useState<boolean>(false);

  // ── Cold-Start Milestones & State Machine ──────────────────────────────────
  const appMountTsRef = useRef<number>(typeof performance !== 'undefined' ? performance.now() : Date.now());
  const trackingStateRef = useRef<TrackingLifecycleState>('BOOTSTRAPPING');
  const [trackingState, setTrackingState] = useState<TrackingLifecycleState>('BOOTSTRAPPING');

  const timelineRef = useRef<CanvasTimelineTelemetry>({
    pageLoadTs: typeof performance !== 'undefined' ? 0 : Date.now(),
    workerSpawnTs: 0,
    modelInitStartTs: 0,
    modelInitDoneTs: 0,
    firstFrameSentTs: 0,
    firstModelPacketTs: 0,
    firstTemplatesCreatedTs: 0,
    firstMicroAcceptedTs: 0,
    firstSmoothedRenderTs: 0,
  });

  // ── Device profiling & adaptive calibration ─────────────────────────────
  const deviceProfileRef = useRef<DeviceProfile>(detectDeviceProfile());
  const onlineEstimatorRef = useRef<OnlineCalibrationEstimator>(new OnlineCalibrationEstimator(30));
  const [featureFlags, setFeatureFlags] = useState<IVPFeatureFlags>(getIVPFeatureFlags());
  const microEventHistoryRef = useRef<Array<{
    timestamp: number;
    idx: number;
    ncc: number;
    method: 'ZNCC' | 'LK' | 'SOBEL';
    accepted: boolean;
    delta: number;
  }>>([]);

  // ── Calibration modal & personalized user bias ──────────────────────────
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [calibrationStep, setCalibrationStep] = useState<number>(1);
  const [calibrationBias, setCalibrationBias] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Subscribe to feature flag updates across sessions
  useEffect(() => {
    return subscribeIVPFeatureFlags((flags) => {
      setFeatureFlags(flags);
      if (denseSmootherRef.current) {
        denseSmootherRef.current.setEnablePcaProjection(flags.enablePcaProjection, 0.18);
      }
    });
  }, []);

  // Load user calibration if present
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('ivp_user_calibration');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.bias) setCalibrationBias(parsed.bias);
        }
      } catch {}
    }
  }, []);

  const getMicroTrackPercentiles = () => {
    const samples = microTrackMsSamplesRef.current;
    if (samples.length === 0) return { p50: 0, p95: 0 };
    const sorted = [...samples].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.50)];
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    return { p50, p95 };
  };

  const handleFreezeAndExport = (includeImage: boolean = false) => {
    let allowImage = includeImage;
    if (allowImage && typeof window !== 'undefined') {
      const confirmed = window.confirm(
        'Privacy Notice: You requested to include a visual camera screenshot in the exported telemetry JSON. Do you provide explicit consent to export visual data?'
      );
      if (!confirmed) {
        allowImage = false;
      }
    }
    const { p50, p95 } = getMicroTrackPercentiles();
    let imageDataUrl: string | undefined;
    if (allowImage && canvasRef.current) {
      try {
        imageDataUrl = canvasRef.current.toDataURL('image/png');
      } catch {}
    }
    const currentActiveFace = denseSmootherRef.current?.getFaceId() ?? (workerLandmarks?.envelope?.faceDetected ? 'active_face' : null);
    const warmupT = microMatchesTriedRef.current;
    const warmupA = microMatchesAcceptedRef.current;
    const payload = {
      sessionId: `session_${Date.now()}`,
      timestamp: Date.now(),
      timeline: { ...timelineRef.current },
      trackingState: trackingStateRef.current,
      isWarmup: featureFlags.enableWarmup && (performance.now() - appMountTsRef.current < 4000) && (trackingStateRef.current !== 'MODEL_READY'),
      warmupAcceptance: {
        tried: warmupT,
        accepted: warmupA,
        ratePercent: warmupT > 0 ? (warmupA / warmupT) * 100 : 100,
        isPoorLighting: featureFlags.enableWarmup && warmupT > 50 && (warmupA / warmupT) < 0.05,
      },
      deviceProfile: deviceProfileRef.current,
      activeFaceId: currentActiveFace,
      frameNumber: frameCountRef.current,
      envelope: {
        faceBox: workerLandmarks?.envelope?.faceBox ?? null,
        confidence: workerLandmarks?.envelope?.regionConfidences?.overall ?? 0,
      },
      landmarksRaw: (lastRawNormPtsRef.current ?? []).slice(0, 70),
      landmarksSmoothed: (denseSmootherRef.current?.getCurrentResult()?.points ?? []).slice(0, 70),
      microEvents: microEventHistoryRef.current.map(evt => ({
        idx: evt.idx,
        tried: true,
        ncc: evt.ncc,
        method: evt.method,
        accepted: evt.accepted,
        latencyMs: lastMicroTrackMsRef.current,
        delta: evt.delta,
      })),
      microTrackMs: { p50, p95 },
      featureFlags,
      ...(includeImage && imageDataUrl ? { image: imageDataUrl } : {}),
    };
    if (typeof window !== 'undefined') {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ivp_telemetry_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

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
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(null);
  const detectedFacesRef = useRef<Array<{ id: string; x: number; y: number; w: number; h: number }>>([]);

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
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clickX = ((e.clientX - rect.left) / rect.width) * 640;
    const clickY = ((e.clientY - rect.top) / rect.height) * 480;
    const currentSplitX = (splitPercentRef.current / 100) * 640;

    // Check if clicked inside a detected face bounding box
    let clickedFace = false;
    for (const f of detectedFacesRef.current) {
      if (clickX >= f.x && clickX <= f.x + f.w && clickY >= f.y && clickY <= f.y + f.h) {
        setSelectedFaceId(f.id);
        denseSmootherRef.current?.setFaceId(f.id);
        microTrackerRef.current?.setFaceId(f.id);
        clickedFace = true;
        break;
      }
    }

    if (!clickedFace || Math.abs(clickX - currentSplitX) <= 18) {
      setIsDragging(true);
      updateSplitPosition(e.clientX);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
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
          if (mirrored) {
            rawCtx.save();
            rawCtx.translate(PROC_W, 0);
            rawCtx.scale(-1, 1);
            rawCtx.drawImage(sourceElement, 0, 0, PROC_W, PROC_H);
            rawCtx.restore();
          } else {
            rawCtx.drawImage(sourceElement, 0, 0, PROC_W, PROC_H);
          }
          frameValid = true;
        }
      } else if (sourceElement instanceof HTMLImageElement) {
        if (sourceElement.complete && sourceElement.naturalWidth > 0) {
          if (mirrored) {
            rawCtx.save();
            rawCtx.translate(PROC_W, 0);
            rawCtx.scale(-1, 1);
            rawCtx.drawImage(sourceElement, 0, 0, PROC_W, PROC_H);
            rawCtx.restore();
          } else {
            rawCtx.drawImage(sourceElement, 0, 0, PROC_W, PROC_H);
          }
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

    // ── 6. Compute Exact Coordinate Mapping & Letterbox Viewport Blit ────────
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

    if (process.env.NODE_ENV === 'development' && mapping.videoWidth < PROC_W && mapping.videoWidth > 0) {
      console.warn('[IVP] Video width is smaller than PROC_W:', mapping.videoWidth, 'PROC_W:', PROC_W);
    }

    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, CSS_W, CSS_H);

    const destX = Math.round(mapping.offsetX);
    const destY = Math.round(mapping.offsetY);
    const destW = Math.round(mapping.videoWidth * mapping.scaleX);
    const destH = Math.round(mapping.videoHeight * mapping.scaleY);

    const splitPct = Math.max(0.02, Math.min(0.98, splitPercentRef.current / 100));
    const targetW = Math.round(splitPct * destW);
    const splitX = destX + targetW;
    const splitSrcX = splitPct * PROC_W;

    // Draw Left Slice (Raw Input Video)
    if (splitPct > 0) {
      ctx.drawImage(
        rawCanvas,
        0, 0, splitSrcX, PROC_H,
        destX, destY, targetW, destH
      );
    }

    // Draw Right Slice (Transformed Computer Vision Output)
    const targetRightW = destW - targetW;
    const targetRightX = destX + targetW;
    const rightSrcW = PROC_W - splitSrcX;
    if (targetRightW > 0 && rightSrcW > 0) {
      ctx.drawImage(
        procCanvas,
        splitSrcX, 0, rightSrcW, PROC_H,
        targetRightX, destY, targetRightW, destH
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
    let denseRes: SmoothedLandmarksResult = denseSmootherRef.current.getCurrentResult();
    let isFaceGenuinelyDetected = false;
    let liveEAR = 0.285;
    let liveMAR = 0.145;

    // Sync worker timeline milestones
    if (workerTimeline) {
      if (workerTimeline.workerSpawnTs && !timelineRef.current.workerSpawnTs) timelineRef.current.workerSpawnTs = workerTimeline.workerSpawnTs;
      if (workerTimeline.modelInitStartTs && !timelineRef.current.modelInitStartTs) timelineRef.current.modelInitStartTs = workerTimeline.modelInitStartTs;
      if (workerTimeline.modelInitDoneTs && !timelineRef.current.modelInitDoneTs) timelineRef.current.modelInitDoneTs = workerTimeline.modelInitDoneTs;
      if (workerTimeline.firstFrameSentTs && !timelineRef.current.firstFrameSentTs) timelineRef.current.firstFrameSentTs = workerTimeline.firstFrameSentTs;
      if (workerTimeline.firstModelPacketTs && !timelineRef.current.firstModelPacketTs) timelineRef.current.firstModelPacketTs = workerTimeline.firstModelPacketTs;
    }

    const appElapsed = now - appMountTsRef.current;
    const isWarmup = featureFlags.enableWarmup && (appElapsed < 4000) && (trackingStateRef.current !== 'MODEL_READY');
    const thresholds = deviceProfileRef.current.thresholds;
    const warmupTries = microMatchesTriedRef.current;
    const warmupAccepted = microMatchesAcceptedRef.current;
    const warmupRate = warmupTries > 0 ? (warmupAccepted / warmupTries) * 100 : 100;
    const isPoorLighting = isWarmup && warmupTries > 50 && warmupRate < 5;
    const effectiveMinNcc = isPoorLighting
      ? 0.68
      : (isWarmup ? 0.60 : onlineEstimatorRef.current.getThreshold(thresholds.minApplyNcc));

    const hasWorkerLandmarks = !!(workerLandmarks && workerLandmarks.buffer && workerLandmarks.buffer.length >= 70 * 4);

    if (hasWorkerLandmarks && workerLandmarks) {
      // ── Model Packet Available ──
      if (trackingStateRef.current !== 'MODEL_READY') {
        trackingStateRef.current = 'MODEL_READY';
        setTrackingState('MODEL_READY');
        if (timelineRef.current.firstModelPacketTs === 0) {
          timelineRef.current.firstModelPacketTs = performance.now();
        }
      }

      isFaceGenuinelyDetected = workerLandmarks.envelope.faceDetected;
      liveEAR = workerLandmarks.envelope.ear;
      liveMAR = workerLandmarks.envelope.mar;

      const isNewPacket = workerLandmarks.buffer !== lastWorkerBufferRef.current;
      if (isNewPacket) {
        lastWorkerBufferRef.current = workerLandmarks.buffer;
        denseRes = denseSmootherRef.current.updateFromBuffer(
          workerLandmarks.buffer,
          70,
          workerLandmarks.envelope.timestampMs || now
        );
        lastSmoothedResRef.current = denseRes;

        const rawPts: Array<{ x: number; y: number }> = [];
        for (let i = 0; i < 70; i++) {
          rawPts.push({ x: workerLandmarks.buffer[i * 4], y: workerLandmarks.buffer[i * 4 + 1] });
        }
        lastRawNormPtsRef.current = rawPts;

        // Initialize / refresh micro-patch templates on new inference packet
        if (isFaceGenuinelyDetected && rawImgData) {
          const workerEnv = workerLandmarks.envelope;
          const fb = workerEnv.faceBox;
          const faceId = fb ? `${Math.round((fb.x || 0) * 10)}_${Math.round((fb.y || 0) * 10)}` : 'active_face';
          microTrackerRef.current.setFaceId(faceId);
          denseSmootherRef.current.setFaceId(faceId);

          const normMicroX = (x: number) => (mirrored ? (1.0 - x) : x);
          const fbW = workerEnv.faceBox ? (workerEnv.faceBox.width > 1.0 ? workerEnv.faceBox.width : workerEnv.faceBox.width * PROC_W) : 80;
          const lipRadius = Math.max(8, Math.min(20, Math.ceil(fbW * 0.08)));

          microTrackerRef.current.updateTemplates(rawImgData.data, PROC_W, PROC_H, [
            { index: 68, x: normMicroX(rawPts[68].x), y: rawPts[68].y, patchRadius: 8 }, // Right pupil
            { index: 69, x: normMicroX(rawPts[69].x), y: rawPts[69].y, patchRadius: 8 }, // Left pupil
            { index: 48, x: normMicroX(rawPts[48].x), y: rawPts[48].y, patchRadius: lipRadius }, // Mouth right corner
            { index: 54, x: normMicroX(rawPts[54].x), y: rawPts[54].y, patchRadius: lipRadius }, // Mouth left corner
          ]);
        } else if (!isFaceGenuinelyDetected) {
          microTrackerRef.current.setFaceId(null);
          denseSmootherRef.current.setFaceId(null);
        }
      } else {
        // Intermediate 60 FPS RAF frame: track micro-features (pupils & lip corners) using NCC / LK
        if (isFaceGenuinelyDetected && rawImgData && !isMicroPausedRef.current) {
          const t0 = performance.now();
          const fb = workerLandmarks?.envelope?.faceBox;
          const fbW = fb ? (fb.width > 1.0 ? fb.width : fb.width * PROC_W) : 80;
          const fbH = fb ? (fb.height > 1.0 ? fb.height : fb.height * PROC_H) : 80;
          const faceScale = Math.sqrt(fbW * fbH);
          const baseDeltaPx = faceScale * 0.035;
          const maxDeltaNormalized = Math.min(0.08, Math.max(0.025, baseDeltaPx / PROC_W));

          const tracked = microTrackerRef.current.track(
            rawImgData.data,
            PROC_W,
            PROC_H,
            0.50,
            deviceProfileRef.current.cpuTier === 'LOW' ? 2 : 1,
            {
              enableLk: featureFlags.enableLkFallback,
              lkMinEigenvalue: thresholds.lkMinEigenvalue,
            }
          );
          const trackDurationMs = performance.now() - t0;
          lastMicroTrackMsRef.current = trackDurationMs;
          microTrackMsSamplesRef.current.push(trackDurationMs);
          if (microTrackMsSamplesRef.current.length > 200) {
            microTrackMsSamplesRef.current.shift();
          }

          const canonicalTracked = new Map<number, TrackedFeature>();
          microMatchesTriedRef.current += tracked.size;

          for (const [idx, feat] of tracked.entries()) {
            if (feat.ncc > 0.35) {
              onlineEstimatorRef.current.addSample(feat.ncc);
            }

            const procX = mirrored ? (1.0 - feat.x) : feat.x;
            const procY = feat.y;
            const videoNormX = procToVideoX(procX, PROC_W, PROC_W);
            const videoNormY = procToVideoY(procY, PROC_H, PROC_H);

            if (videoNormX < 0.01 || videoNormX > 0.99 || videoNormY < 0.01 || videoNormY > 0.99) continue;

            canonicalTracked.set(idx, {
              landmarkIndex: idx,
              x: videoNormX,
              y: videoNormY,
              ncc: feat.ncc,
              method: feat.method,
            });

            if (featureFlags.enableRegionFusion && lastSmoothedResRef.current?.regionConfidences) {
              const rc = lastSmoothedResRef.current.regionConfidences;
              if ((idx === 68 || idx === 69) && rc.eyes < 0.25) continue;
              if ((idx === 48 || idx === 54) && rc.mouth < 0.25) continue;
            }

            const requiredNcc = feat.method === 'LK' ? effectiveMinNcc * 0.88 : effectiveMinNcc;
            let accepted = false;
            let delta = 0;

            if (feat.ncc >= requiredNcc) {
              const pred = denseSmootherRef.current.predictPoint(idx, 0.016);
              delta = pred ? Math.hypot(pred.x - videoNormX, pred.y - videoNormY) : 0;

              if (delta < maxDeltaNormalized || feat.ncc >= 0.92) {
                const scaledConf = Math.max(0.1, Math.min(1.0, feat.ncc));
                const updatedPos = denseSmootherRef.current.updatePoint(
                  idx,
                  { x: videoNormX, y: videoNormY },
                  scaledConf,
                  now
                );

                if (updatedPos && updatedPos.accepted && workerLandmarks?.buffer && workerLandmarks.buffer.length >= (idx + 1) * 4) {
                  const finalX = updatedPos.pos ? updatedPos.pos.x : updatedPos.x;
                  const finalY = updatedPos.pos ? updatedPos.pos.y : updatedPos.y;
                  workerLandmarks.buffer[idx * 4] = finalX;
                  workerLandmarks.buffer[idx * 4 + 1] = finalY;
                  workerLandmarks.buffer[idx * 4 + 3] = scaledConf;
                  microMatchesAcceptedRef.current++;
                  accepted = true;
                  if (timelineRef.current.firstMicroAcceptedTs === 0) {
                    timelineRef.current.firstMicroAcceptedTs = performance.now();
                  }
                }
              }
            }

            if (microEventHistoryRef.current.length >= 60) {
              microEventHistoryRef.current.shift();
            }
            microEventHistoryRef.current.push({
              timestamp: now,
              idx,
              ncc: feat.ncc,
              method: feat.method || 'ZNCC',
              accepted,
              delta,
            });
          }
          lastMicroTrackedRef.current = canonicalTracked;
        }
        denseRes = denseSmootherRef.current.getCurrentResult();
        lastSmoothedResRef.current = denseRes;
      }
    } else {
      // ── Heuristic & Fast Bootstrap Startup Flow ──
      let bootstrapHandled = false;

      if (!isTargetLost && rawImgData) {
        if (trackingStateRef.current === 'BOOTSTRAPPING') {
          const fastFace = detectFastFaceBootstrap(rawImgData.data, PROC_W, PROC_H, mirrored);
          if (fastFace && fastFace.detected) {
            isFaceGenuinelyDetected = true;
            microTrackerRef.current.setFaceId('bootstrap_face');
            denseSmootherRef.current.setFaceId('bootstrap_face');

            const normMicroX = (x: number) => (mirrored ? (1.0 - x) : x);
            microTrackerRef.current.updateTemplates(rawImgData.data, PROC_W, PROC_H, [
              { index: 68, x: normMicroX(fastFace.rightPupil.x), y: fastFace.rightPupil.y, patchRadius: 8 },
              { index: 69, x: normMicroX(fastFace.leftPupil.x), y: fastFace.leftPupil.y, patchRadius: 8 },
              { index: 48, x: normMicroX(fastFace.mouthRight.x), y: fastFace.mouthRight.y, patchRadius: 10 },
              { index: 54, x: normMicroX(fastFace.mouthLeft.x), y: fastFace.mouthLeft.y, patchRadius: 10 },
            ], { minStdDev: 1.0 });

            if (timelineRef.current.firstTemplatesCreatedTs === 0) {
              timelineRef.current.firstTemplatesCreatedTs = performance.now();
            }

            denseRes = denseSmootherRef.current.updateFromPoints(fastFace.approxLandmarks, now);
            lastSmoothedResRef.current = denseRes;
            lastRawNormPtsRef.current = fastFace.approxLandmarks.map(p => ({ x: p.x, y: p.y }));

            trackingStateRef.current = 'MODEL_PENDING';
            setTrackingState('MODEL_PENDING');
            bootstrapHandled = true;
          }
        } else if (trackingStateRef.current === 'MODEL_PENDING') {
          // Track micro templates during MODEL_PENDING state
          isFaceGenuinelyDetected = true;
          const t0 = performance.now();
          const tracked = microTrackerRef.current.track(
            rawImgData.data,
            PROC_W,
            PROC_H,
            0.50,
            deviceProfileRef.current.cpuTier === 'LOW' ? 2 : 1,
            {
              enableLk: featureFlags.enableLkFallback,
              lkMinEigenvalue: thresholds.lkMinEigenvalue,
            }
          );
          const trackDurationMs = performance.now() - t0;
          lastMicroTrackMsRef.current = trackDurationMs;
          microTrackMsSamplesRef.current.push(trackDurationMs);
          if (microTrackMsSamplesRef.current.length > 200) {
            microTrackMsSamplesRef.current.shift();
          }

          const canonicalTracked = new Map<number, TrackedFeature>();
          microMatchesTriedRef.current += tracked.size;

          for (const [idx, feat] of tracked.entries()) {
            const procX = mirrored ? (1.0 - feat.x) : feat.x;
            const procY = feat.y;
            const videoNormX = procToVideoX(procX, PROC_W, PROC_W);
            const videoNormY = procToVideoY(procY, PROC_H, PROC_H);

            if (videoNormX < 0.01 || videoNormX > 0.99 || videoNormY < 0.01 || videoNormY > 0.99) continue;

            canonicalTracked.set(idx, {
              landmarkIndex: idx,
              x: videoNormX,
              y: videoNormY,
              ncc: feat.ncc,
              method: feat.method,
            });

            const requiredNcc = feat.method === 'LK' ? effectiveMinNcc * 0.88 : effectiveMinNcc;
            let accepted = false;
            let delta = 0;

            if (feat.ncc >= requiredNcc) {
              const pred = denseSmootherRef.current.predictPoint(idx, 0.016);
              delta = pred ? Math.hypot(pred.x - videoNormX, pred.y - videoNormY) : 0;

              if (delta < 0.08 || feat.ncc >= 0.88) {
                const scaledConf = Math.max(0.1, Math.min(1.0, feat.ncc));
                const updatedPos = denseSmootherRef.current.updatePoint(
                  idx,
                  { x: videoNormX, y: videoNormY },
                  scaledConf,
                  now
                );
                if (updatedPos && updatedPos.accepted) {
                  microMatchesAcceptedRef.current++;
                  accepted = true;
                  if (timelineRef.current.firstMicroAcceptedTs === 0) {
                    timelineRef.current.firstMicroAcceptedTs = performance.now();
                  }
                }
              }
            }

            if (microEventHistoryRef.current.length >= 60) microEventHistoryRef.current.shift();
            microEventHistoryRef.current.push({
              timestamp: now,
              idx,
              ncc: feat.ncc,
              method: feat.method || 'ZNCC',
              accepted,
              delta,
            });
          }
          lastMicroTrackedRef.current = canonicalTracked;
          denseRes = denseSmootherRef.current.getCurrentResult();
          lastSmoothedResRef.current = denseRes;
          bootstrapHandled = true;
        }
      }

      if (!bootstrapHandled) {
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
          for (let i = 0; i < 17; i++) {
            const theta = Math.PI + (i / 16) * Math.PI;
            rawPts70.push({
              x: ((fb.x + fb.width / 2) + Math.cos(theta) * (fb.width * 0.48)) / PROC_W,
              y: ((fb.y + fb.height * 0.45) + Math.sin(theta) * (fb.height * 0.45)) / PROC_H,
              confidence: 0.85,
            });
          }
          for (let i = 0; i < 5; i++) rawPts70.push({ x: (lm.leftPupil.x - 18 + i * 8) / PROC_W, y: (lm.leftPupil.y - 14) / PROC_H, confidence: 0.88 });
          for (let i = 0; i < 5; i++) rawPts70.push({ x: (lm.rightPupil.x - 14 + i * 8) / PROC_W, y: (lm.rightPupil.y - 14) / PROC_H, confidence: 0.88 });
          for (let i = 0; i < 4; i++) {
            const p = lm.noseBridge[Math.min(lm.noseBridge.length - 1, i)];
            rawPts70.push({ x: p.x / PROC_W, y: p.y / PROC_H, confidence: 0.90 });
          }
          rawPts70.push({ x: (lm.noseTip.x - 10) / PROC_W, y: (lm.noseTip.y + 4) / PROC_H, confidence: 0.90 });
          rawPts70.push({ x: (lm.noseTip.x - 5) / PROC_W, y: (lm.noseTip.y + 5) / PROC_H, confidence: 0.90 });
          rawPts70.push({ x: lm.noseTip.x / PROC_W, y: lm.noseTip.y / PROC_H, confidence: 0.95 });
          rawPts70.push({ x: (lm.noseTip.x + 5) / PROC_W, y: (lm.noseTip.y + 5) / PROC_H, confidence: 0.90 });
          rawPts70.push({ x: (lm.noseTip.x + 10) / PROC_W, y: (lm.noseTip.y + 4) / PROC_H, confidence: 0.90 });
          for (const p of lm.leftEyePts) rawPts70.push({ x: p.x / PROC_W, y: p.y / PROC_H, confidence: 0.94 });
          for (const p of lm.rightEyePts) rawPts70.push({ x: p.x / PROC_W, y: p.y / PROC_H, confidence: 0.94 });
          for (let i = 0; i < 12; i++) {
            const p = lm.mouthPts[i % lm.mouthPts.length];
            rawPts70.push({ x: p.x / PROC_W, y: p.y / PROC_H, confidence: 0.92 });
          }
          for (let i = 0; i < 8; i++) {
            const p = lm.mouthPts[i % lm.mouthPts.length];
            rawPts70.push({ x: p.x / PROC_W, y: p.y / PROC_H, confidence: 0.90 });
          }
          rawPts70.push({ x: lm.leftPupil.x / PROC_W, y: lm.leftPupil.y / PROC_H, confidence: 0.95 });
          rawPts70.push({ x: lm.rightPupil.x / PROC_W, y: lm.rightPupil.y / PROC_H, confidence: 0.95 });

          lastRawNormPtsRef.current = rawPts70.map(p => ({ x: p.x, y: p.y }));
          denseRes = denseSmootherRef.current.updateFromPoints(rawPts70, now);
        } else {
          denseRes = denseSmootherRef.current.updateFromPoints(
            (lastRawNormPtsRef.current || []).map(p => ({ x: p.x, y: p.y, confidence: 0.1 })),
            now
          );
        }
        lastSmoothedResRef.current = denseRes;
      }
    }

    if (isWarmup) {
      denseRes.visibilityOpacity = Math.max(0.65, denseRes.visibilityOpacity);
    }

    if (timelineRef.current.firstSmoothedRenderTs === 0 && (isFaceGenuinelyDetected || denseRes.regionConfidences.overall > 0.2)) {
      timelineRef.current.firstSmoothedRenderTs = performance.now();
    }

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
    const rawMouthX = mouthPts.length >= 7 ? (mouthPts[0].x + mouthPts[6].x) / 2 : CSS_W / 2;
    const rawMouthY = mouthPts.length >= 10 ? (mouthPts[3].y + mouthPts[9].y) / 2 : CSS_H / 2;

    // ── Canonical Face Bounding Box Transformation ─────────────────────────
    // Directly transform worker envelope faceBox via computeCoordinateMapping.
    // This replaces loose/stale heuristic landmark loops that distort when points wander.
    let rawBoxX = 0;
    let rawBoxY = 0;
    let rawBoxW = 0;
    let rawBoxH = 0;
    let authenticBoxW = 0;
    let authenticBoxH = 0;

    const workerEnv = workerLandmarks?.envelope;
    if (workerEnv && workerEnv.faceDetected && workerEnv.faceBox && workerEnv.faceBox.width > 0) {
      const fb = workerEnv.faceBox;
      const envW = workerEnv.videoWidth || mapping.videoWidth || 320;
      const envH = workerEnv.videoHeight || mapping.videoHeight || 240;

      // Normalize faceBox coordinates to [0..1]
      const normX = fb.width > 1.0 ? fb.x / envW : fb.x;
      const normY = fb.height > 1.0 ? fb.y / envH : fb.y;
      const normW = fb.width > 1.0 ? fb.width / envW : fb.width;
      const normH = fb.height > 1.0 ? fb.height / envH : fb.height;

      const scaleX = mapping.videoWidth * mapping.scaleX;
      const scaleY = mapping.videoHeight * mapping.scaleY;

      // When mirrored: horizontal coordinates invert: [normX, normX + normW] -> [1 - (normX + normW), 1 - normX]
      rawBoxX = (mapping.mirrored ? (1.0 - (normX + normW)) : normX) * scaleX + mapping.offsetX;
      rawBoxY = normY * scaleY + mapping.offsetY;
      rawBoxW = normW * scaleX;
      rawBoxH = normH * scaleY;

      authenticBoxW = fb.width > 1.0 ? fb.width : Math.round(rawBoxW);
      authenticBoxH = fb.height > 1.0 ? fb.height : Math.round(rawBoxH);
    } else {
      // Fallback: derive from canvasPts
      let minBoxX = 9999, maxBoxX = -9999, minBoxY = 9999, maxBoxY = -9999;
      for (const p of canvasPts) {
        if (p.x < minBoxX) minBoxX = p.x;
        if (p.x > maxBoxX) maxBoxX = p.x;
        if (p.y < minBoxY) minBoxY = p.y;
        if (p.y > maxBoxY) maxBoxY = p.y;
      }
      const padX = (maxBoxX - minBoxX) * 0.12;
      const padY = (maxBoxY - minBoxY) * 0.14;
      rawBoxX = Math.max(0, minBoxX - padX);
      rawBoxY = Math.max(0, minBoxY - padY);
      rawBoxW = Math.min(CSS_W, (maxBoxX - minBoxX) + padX * 2);
      rawBoxH = Math.min(CSS_H, (maxBoxY - minBoxY) + padY * 2);
      authenticBoxW = Math.round(rawBoxW);
      authenticBoxH = Math.round(rawBoxH);
    }

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

    const smoothedBoxX = sf.minX;
    const smoothedBoxY = sf.minY;
    const smoothedBoxW = Math.max(20, sf.maxX - sf.minX);
    const smoothedBoxH = Math.max(20, sf.maxY - sf.minY);

    const boxX = rawBoxW > 0 ? rawBoxX : smoothedBoxX;
    const boxY = rawBoxH > 0 ? rawBoxY : smoothedBoxY;
    const boxW = rawBoxW > 0 ? rawBoxW : smoothedBoxW;
    const boxH = rawBoxH > 0 ? rawBoxH : smoothedBoxH;

    const isBlink = liveEAR < 0.22;
    const isSpeaking = liveMAR >= 0.22;
    const s = Math.max(0.75, Math.min(1.4, boxW / 200));

    // Clamp mouth center within facial envelope to prevent stray vector detachment
    const mouthCenter: Point2D = {
      x: Math.max(boxX - 20, Math.min(boxX + boxW + 20, rawMouthX)),
      y: Math.max(boxY - 20, Math.min(boxY + boxH + 20, rawMouthY)),
    };

    // ── 11. Render Dynamic Bounding Box with High-Tech Reticles ────────────
    if (showBoundingBox && !isTargetLost && (isFaceGenuinelyDetected || denseRes.regionConfidences.overall > 0.2) && denseRes.visibilityOpacity > 0.02) {
      ctx.save();
      ctx.globalAlpha = denseRes.visibilityOpacity;

      // Draw smoothed comparison box (dashed cyan line)
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(smoothedBoxX, smoothedBoxY, smoothedBoxW, smoothedBoxH);
      ctx.setLineDash([]);

      // Draw canonical worker faceBox corners (solid cyan reticle)
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

      // Tracking HUD Badge with authentic live dimensions and active face selector
      const activeFaceTag = selectedFaceId || denseSmootherRef.current?.getFaceId() || '1';
      detectedFacesRef.current = [{ id: String(activeFaceTag), x: boxX, y: boxY, w: boxW, h: boxH }];
      const roiText = `[FACE #${String(activeFaceTag).slice(0, 6)}] ${Math.round(authenticBoxW)}x${Math.round(authenticBoxH)} [ACTIVE]`;
      ctx.font = 'bold 9px monospace';
      const badgeW = Math.max(154, ctx.measureText(roiText).width + 12);
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
        if (mouthPts[2] && mouthPts[6]) {
          ctx.moveTo(mouthPts[2].x, mouthPts[2].y);
          ctx.lineTo(mouthPts[6].x, mouthPts[6].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#34D399';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        const speechAnchorY = mouthPts[6] ? Math.min(boxY + boxH + 20, mouthPts[6].y + 14) : mouthCenter.y + 14;
        ctx.fillText(`SPEECH [MAR: ${liveMAR.toFixed(2)}]`, mouthCenter.x, speechAnchorY);
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
        ctx.fillStyle = 'rgba(255, 140, 0, 0.95)';
        for (const rp of lastRawNormPtsRef.current) {
          const cp = mapNormalizedToCanvas(rp, mapping);
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, 3, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      // B. Render Smoothed Landmark Points (Cyan dots)
      ctx.fillStyle = 'rgba(0, 240, 255, 0.95)';
      for (const sp of canvasPts) {
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 3, 0, 2 * Math.PI);
        ctx.fill();
      }

      // C. Render 60 FPS Micro-Tracked Feature Points (Emerald rings for pupils/lips) & Template Bounds
      if (lastMicroTrackedRef.current && lastMicroTrackedRef.current.size > 0) {
        ctx.save();
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 1.8;
        for (const [, feat] of lastMicroTrackedRef.current.entries()) {
          const cp = mapNormalizedToCanvas({ x: feat.x, y: feat.y }, mapping);
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, 6, 0, 2 * Math.PI);
          ctx.stroke();
        }
        ctx.restore();
      }

      // C2. Render Active Micro-Tracker Template Bounds & Search Windows
      const tmplDiags = microTrackerRef.current.getTemplatesDiagnostics();
      if (tmplDiags.length > 0) {
        ctx.save();
        for (const tmpl of tmplDiags) {
          const canX = destX + (tmpl.centerX / PROC_W) * destW;
          const canY = destY + (tmpl.centerY / PROC_H) * destH;
          const canPatchW = (tmpl.patchRadius * 2 / PROC_W) * destW;
          const canPatchH = (tmpl.patchRadius * 2 / PROC_H) * destH;
          const canSearchW = (tmpl.searchRadius * 2 / PROC_W) * destW;
          const canSearchH = (tmpl.searchRadius * 2 / PROC_H) * destH;

          // Search window: amber dashed rectangle
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.40)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(canX - canSearchW / 2, canY - canSearchH / 2, canSearchW, canSearchH);

          // Template patch: emerald solid rectangle
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.80)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([]);
          ctx.strokeRect(canX - canPatchW / 2, canY - canPatchH / 2, canPatchW, canPatchH);
        }
        ctx.restore();
      }

      // D. Render High-Tech Debug Metrics Card (Bottom-Right)
      const isThrottled = workerStats?.isThrottled ?? false;
      const dbgW = 320;
      const dbgH = isThrottled ? 122 : 108;
      const dbgX = CSS_W - dbgW - 12;
      const dbgY = CSS_H - dbgH - 12;

      if (isPoorLighting) {
        ctx.save();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.92)';
        ctx.strokeStyle = '#DC2626';
        ctx.lineWidth = 1;
        ctx.fillRect(dbgX, dbgY - 24, dbgW, 20);
        ctx.strokeRect(dbgX, dbgY - 24, dbgW, 20);
        ctx.font = 'bold 8.5px monospace';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚠️ POOR LIGHTING DETECTED (<5% MATCH RATE) — ADAPTING NCC', dbgX + dbgW / 2, dbgY - 14);
        ctx.restore();
      }

      ctx.fillStyle = 'rgba(3, 7, 18, 0.94)';
      ctx.strokeStyle = isThrottled ? '#F59E0B' : '#06B6D4';
      ctx.lineWidth = 1.2;
      ctx.fillRect(dbgX, dbgY, dbgW, dbgH);
      ctx.strokeRect(dbgX, dbgY, dbgW, dbgH);

      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = isThrottled ? '#F59E0B' : '#06B6D4';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('⚡ TRACKING HUD (Amber: Raw | Cyan: Smoothed | Green: Micro)', dbgX + 8, dbgY + 8);

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
      const microCount = lastMicroTrackedRef.current?.size ?? 0;
      const tmplCount = microTrackerRef.current.templateCount();
      const tried = microMatchesTriedRef.current;
      const accepted = microMatchesAcceptedRef.current;
      const evictions = microTrackerRef.current.getEvictionCount();
      const { p50, p95 } = getMicroTrackPercentiles();
      const pausedTag = isMicroPausedRef.current ? ' [PAUSED]' : '';
      const safeTag = featureFlags.enableSafeMode ? ' [SAFE MODE]' : '';
      const warmupTag = isWarmup ? ` [WARMUP: ${warmupRate.toFixed(0)}% acc]` : '';
      ctx.fillText(`ENGINE: ${engineStr} | MICRO: ${accepted}/${tried} acc | EVICT: ${evictions}${warmupTag}`, dbgX + 8, dbgY + 64);
      ctx.fillText(`PRESET: ${denseRes.activePreset} | α: ${denseRes.meanAlpha.toFixed(2)} | OCCLUSION: ${denseRes.occludedDurationSec.toFixed(1)}s`, dbgX + 8, dbgY + 78);
      ctx.fillText(`DEVICE: ${deviceProfileRef.current.deviceClass.toUpperCase()} (NCC base: ${deviceProfileRef.current.thresholds.minApplyNcc.toFixed(2)}) | MAP: ${mapping.videoWidth}x${mapping.videoHeight} → ${mapping.canvasWidth}x${mapping.canvasHeight}`, dbgX + 8, dbgY + 92);
      ctx.fillText(`PRIVACY: LOCAL-ONLY METRICS | TELEMETRY: ${featureFlags.enableTelemetryOptIn ? 'OPTED-IN' : 'OFF (DEFAULT)'}`, dbgX + 8, dbgY + 106);

      if (typeof window !== 'undefined') {
        (window as any).__IVP_HUD_TELEMETRY__ = {
          microMatchesTried: tried,
          microMatchesAccepted: accepted,
          microEvictions: evictions,
          microTrackMsP50: p50,
          microTrackMsP95: p95,
          currentStride: deviceProfileRef.current.cpuTier === 'LOW' ? 2 : 1,
          templatesActive: tmplCount,
          isMicroPaused: isMicroPausedRef.current,
          featureFlags,
          deviceProfile: deviceProfileRef.current,
          boxW,
          boxH,
          authenticBoxW,
          authenticBoxH,
          fps: fpsRef.current,
        };
      }

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

    if (typeof window !== 'undefined') {
      const { p50, p95 } = getMicroTrackPercentiles();
      (window as any).__IVP_HUD_TELEMETRY__ = {
        pageLoadTs: timelineRef.current.pageLoadTs,
        workerSpawnTs: timelineRef.current.workerSpawnTs,
        modelInitStartTs: timelineRef.current.modelInitStartTs,
        modelInitDoneTs: timelineRef.current.modelInitDoneTs,
        firstFrameSentTs: timelineRef.current.firstFrameSentTs,
        firstModelPacketTs: timelineRef.current.firstModelPacketTs,
        firstTemplatesCreatedTs: timelineRef.current.firstTemplatesCreatedTs,
        firstMicroAcceptedTs: timelineRef.current.firstMicroAcceptedTs,
        firstSmoothedRenderTs: timelineRef.current.firstSmoothedRenderTs,
        timeline: { ...timelineRef.current },
        trackingState: trackingStateRef.current,
        isWarmup,
        microMatchesTried: microMatchesTriedRef.current,
        microMatchesAccepted: microMatchesAcceptedRef.current,
        microEvictions: microTrackerRef.current.getEvictionCount(),
        microTrackMsP50: p50,
        microTrackMsP95: p95,
        currentStride: deviceProfileRef.current.cpuTier === 'LOW' ? 2 : 1,
        templatesActive: microTrackerRef.current.templateCount(),
        isMicroPaused: isMicroPausedRef.current,
        featureFlags,
        deviceProfile: deviceProfileRef.current,
        boxW,
        boxH,
        authenticBoxW,
        authenticBoxH,
        fps: fpsRef.current,
      };
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
          {trackingState !== 'MODEL_READY' && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
              ⚡ WARMING UP ({trackingState})
            </span>
          )}
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

          {/* Warmup Mode Toggle */}
          <button
            id="warmup-mode-btn"
            type="button"
            onClick={() => {
              const next = !featureFlags.enableWarmup;
              setIVPFeatureFlag('enableWarmup', next);
            }}
            className={`px-2 py-0.5 rounded border text-[10px] font-mono transition-colors ${
              featureFlags.enableWarmup
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            {featureFlags.enableWarmup ? '⚡ WARMUP: ON' : '⚡ WARMUP: OFF'}
          </button>

          {/* Calibrate Face Button */}
          <button
            id="calibrate-face-btn"
            type="button"
            onClick={() => {
              setCalibrationStep(1);
              setIsCalibrating(true);
            }}
            className="px-2 py-0.5 rounded border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 text-[10px] font-mono transition-colors"
          >
            🎯 CALIBRATE
          </button>

          {/* Freeze & Export Button */}
          <button
            id="freeze-export-btn"
            type="button"
            onClick={() => handleFreezeAndExport(false)}
            className="px-2 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-[10px] font-mono transition-colors"
          >
            💾 EXPORT TELEMETRY
          </button>

          {/* Safe Mode Toggle */}
          <button
            id="safe-mode-btn"
            type="button"
            onClick={() => {
              const next = !featureFlags.enableSafeMode;
              setIVPFeatureFlag('enableSafeMode', next);
            }}
            className={`px-2 py-0.5 rounded border text-[10px] font-mono transition-colors ${
              featureFlags.enableSafeMode
                ? 'bg-red-500/20 border-red-500/40 text-red-300'
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            {featureFlags.enableSafeMode ? '🛡 SAFE MODE: ON' : '🛡 SAFE MODE: OFF'}
          </button>

          {/* Pause Micro Updates Button */}
          <button
            id="pause-micro-btn"
            type="button"
            onClick={() => {
              const next = !isMicroPaused;
              isMicroPausedRef.current = next;
              setIsMicroPaused(next);
            }}
            className={`px-2 py-0.5 rounded border text-[10px] font-mono transition-colors ${
              isMicroPaused
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            {isMicroPaused ? '▶ RESUME MICRO' : '⏸ PAUSE MICRO'}
          </button>
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

      {/* Calibration Modal */}
      {isCalibrating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#0B0F17] border border-cyan-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                Personal Face Calibration
              </h3>
              <button
                type="button"
                onClick={() => setIsCalibrating(false)}
                className="text-gray-400 hover:text-white text-xs font-mono cursor-pointer"
              >
                ✕ CLOSE
              </button>
            </div>

            <div className="space-y-3 text-xs text-gray-300">
              <div className="flex items-center justify-center py-4">
                <div className="w-24 h-24 rounded-full border-2 border-dashed border-cyan-400/60 flex items-center justify-center animate-pulse">
                  <span className="text-2xl">👤</span>
                </div>
              </div>

              {calibrationStep === 1 && (
                <div className="text-center space-y-2">
                  <p className="font-semibold text-cyan-300">Step 1: Neutral Gaze Alignment</p>
                  <p className="text-gray-400 text-[11px]">
                    Look straight ahead into the webcam with a relaxed, neutral expression.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCalibrationStep(2)}
                    className="w-full mt-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-mono text-xs font-bold transition cursor-pointer"
                  >
                    CONTINUE TO STEP 2 ▶
                  </button>
                </div>
              )}

              {calibrationStep === 2 && (
                <div className="text-center space-y-2">
                  <p className="font-semibold text-cyan-300">Step 2: Natural Smile & Speech</p>
                  <p className="text-gray-400 text-[11px]">
                    Smile gently or speak a short sentence to register your natural lip corner dynamics.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (lastRawNormPtsRef.current && lastRawNormPtsRef.current.length >= 70) {
                        const lp = lastRawNormPtsRef.current[68];
                        const rp = lastRawNormPtsRef.current[69];
                        const midX = (lp.x + rp.x) / 2;
                        const midY = (lp.y + rp.y) / 2;
                        const bias = {
                          x: (midX - 0.5) * 0.05,
                          y: (midY - 0.45) * 0.05,
                        };
                        setCalibrationBias(bias);
                        try {
                          window.localStorage.setItem('ivp_user_calibration', JSON.stringify({ bias, calibratedAt: Date.now() }));
                        } catch {}
                      }
                      setCalibrationStep(3);
                    }}
                    className="w-full mt-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-mono text-xs font-bold transition cursor-pointer"
                  >
                    FINALIZE CALIBRATION ▶
                  </button>
                </div>
              )}

              {calibrationStep === 3 && (
                <div className="text-center space-y-3">
                  <div className="text-emerald-400 font-bold text-sm">✓ Calibration Complete!</div>
                  <p className="text-gray-400 text-[11px]">
                    Personalized anchor bias saved: ({calibrationBias.x.toFixed(4)}, {calibrationBias.y.toFixed(4)}).
                    Additive offsets will cling tightly to your unique facial geometry.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCalibrationBias({ x: 0, y: 0 });
                        try { window.localStorage.removeItem('ivp_user_calibration'); } catch {}
                        setIsCalibrating(false);
                      }}
                      className="flex-1 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg font-mono text-xs transition cursor-pointer"
                    >
                      RESET TO DEFAULTS
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCalibrating(false)}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-mono text-xs font-bold transition cursor-pointer"
                    >
                      DONE
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
