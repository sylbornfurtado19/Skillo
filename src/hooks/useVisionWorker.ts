import { useState, useEffect, useRef, useCallback } from 'react';
import {
  type WorkerLifecycleState,
  type VisionWorkerResponseMessage,
  type ProcessedVisionResults,
  type DenseLandmarksEnvelope,
  type VisionModelBackend,
  type VisionWorkerCapabilities,
  isNewerRequestId,
} from '@/types/workerMessages';
import { VisionPipeline } from '@/lib/services/visionPipeline';

interface UseVisionWorkerOptions {
  autoStart?: boolean;
  targetFPS?: number;
  backend?: VisionModelBackend;
  onResults?: (results: ProcessedVisionResults) => void;
  onLandmarks?: (envelope: DenseLandmarksEnvelope, buffer: Float32Array) => void;
  onError?: (error: string) => void;
}

import type { ExecutionMode } from '@/types/gazeEngine';
import { detectDeviceProfile, type DeviceProfile } from '@/lib/services/visionPipeline';

export interface VisionWorkerStats {
  droppedFrames: number;
  processedFrames: number;
  dropRatePercent: number;
  inFlightMs: number;
  watchdogUnlocks: number;
  latestRequestId: number;
  isThrottled: boolean;
  suggestedCadenceFps: number;
  rollingDropRateEMA: number;
  rollingLatencyEMA: number;
}

export interface WorkerTimelineTelemetry {
  workerSpawnTs: number;
  modelInitStartTs: number;
  modelInitDoneTs: number;
  firstFrameSentTs: number;
  firstModelPacketTs: number;
  modelInitDurationMs: number;
  modelSource: 'CACHED' | 'LOCAL' | 'CDN' | 'HEURISTIC_FALLBACK' | 'PENDING';
}

interface UseVisionWorkerReturn {
  workerState: WorkerLifecycleState;
  isReady: boolean;
  isFallbackMode: boolean;
  fallbackReason: string | null;
  executionMode: ExecutionMode;
  activeBackend: VisionModelBackend;
  capabilities: VisionWorkerCapabilities | null;
  stats: VisionWorkerStats;
  deviceProfile: DeviceProfile;
  isTabPaused: boolean;
  isThrottled: boolean;
  suggestedCadenceFps: number;
  lastResults: ProcessedVisionResults | null;
  lastLandmarks: { envelope: DenseLandmarksEnvelope; buffer: Float32Array } | null;
  processingLatencyMs: number;
  timeline: WorkerTimelineTelemetry;
  getTimeline: () => WorkerTimelineTelemetry;
  processFrame: (source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement, mirrored?: boolean) => Promise<boolean>;
  restartWorker: () => void;
}

export function useVisionWorker(options: UseVisionWorkerOptions = {}): UseVisionWorkerReturn {
  const {
    autoStart = true,
    backend = 'WEBGL',
    onResults,
    onLandmarks,
    onError,
  } = options;

  const [workerState, setWorkerState] = useState<WorkerLifecycleState>('UNINITIALIZED');
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [activeBackend, setActiveBackend] = useState<VisionModelBackend>(backend);
  const [capabilities, setCapabilities] = useState<VisionWorkerCapabilities | null>(null);
  const [lastResults, setLastResults] = useState<ProcessedVisionResults | null>(null);
  const [lastLandmarks, setLastLandmarks] = useState<{ envelope: DenseLandmarksEnvelope; buffer: Float32Array } | null>(null);
  const [processingLatencyMs, setProcessingLatencyMs] = useState(0);

  // Tab visibility state
  const [isTabPaused, setIsTabPaused] = useState(false);
  const isPausedRef = useRef(false);

  // Adaptive Cadence State
  const [isThrottled, setIsThrottled] = useState(false);
  const [suggestedCadenceFps, setSuggestedCadenceFps] = useState(30);
  const dropRateEMARef = useRef(0);
  const latencyEMARef = useRef(20);
  const lastCadenceChangeTsRef = useRef(0);
  const overloadStartTimeRef = useRef<number | null>(null);
  const healthyStartTimeRef = useRef<number | null>(null);

  const [stats, setStats] = useState<VisionWorkerStats>({
    droppedFrames: 0,
    processedFrames: 0,
    dropRatePercent: 0,
    inFlightMs: 0,
    watchdogUnlocks: 0,
    latestRequestId: 0,
    isThrottled: false,
    suggestedCadenceFps: 30,
    rollingDropRateEMA: 0,
    rollingLatencyEMA: 20,
  });

  const executionMode: ExecutionMode = workerState === 'READY' && !isFallbackMode ? 'VERIFIED_MODEL' : 'ESTIMATED_FALLBACK';

  const workerRef = useRef<Worker | null>(null);
  const isBusyRef = useRef(false);
  const requestIdRef = useRef(0);
  const latestCompletedRequestIdRef = useRef(0);
  const lastSendTimeRef = useRef(0);
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const droppedFramesRef = useRef(0);
  const processedFramesRef = useRef(0);
  const watchdogUnlocksRef = useRef(0);
  const restartAttemptsRef = useRef(0);
  const restartTimestampsRef = useRef<number[]>([]);
  const isSpawningRef = useRef(false);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deviceProfileRef = useRef<DeviceProfile>(detectDeviceProfile());

  // Timeline Telemetry Milestones (for cold start KPI diagnostics)
  const spawnTsRef = useRef<number>(typeof performance !== 'undefined' ? performance.now() : Date.now());
  const modelInitStartTsRef = useRef<number>(0);
  const modelInitDoneTsRef = useRef<number>(0);
  const firstFrameSentTsRef = useRef<number>(0);
  const firstModelPacketTsRef = useRef<number>(0);
  const modelInitDurationMsRef = useRef<number>(0);
  const modelSourceRef = useRef<'CACHED' | 'LOCAL' | 'CDN' | 'HEURISTIC_FALLBACK' | 'PENDING'>('PENDING');

  const getTimeline = useCallback((): WorkerTimelineTelemetry => ({
    workerSpawnTs: spawnTsRef.current,
    modelInitStartTs: modelInitStartTsRef.current,
    modelInitDoneTs: modelInitDoneTsRef.current,
    firstFrameSentTs: firstFrameSentTsRef.current,
    firstModelPacketTs: firstModelPacketTsRef.current,
    modelInitDurationMs: modelInitDurationMsRef.current,
    modelSource: modelSourceRef.current,
  }), []);

  // ── Document Visibility & Lifecycle Handler ───────────────────────────────
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      const isHidden = document.hidden;
      isPausedRef.current = isHidden;
      setIsTabPaused(isHidden);

      if (isHidden) {
        if (watchdogTimerRef.current) {
          clearTimeout(watchdogTimerRef.current);
          watchdogTimerRef.current = null;
        }
        isBusyRef.current = false;
      } else {
        lastSendTimeRef.current = performance.now();
        isBusyRef.current = false;
      }
    };

    const handlePageHide = () => {
      isPausedRef.current = true;
      setIsTabPaused(true);
      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
      isBusyRef.current = false;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  // Helper: update stats state & adaptive cadence hysteresis
  const syncStats = useCallback((inFlightMs: number = 0) => {
    const now = performance.now();
    const total = droppedFramesRef.current + processedFramesRef.current;
    const dropRate = total > 0 ? (droppedFramesRef.current / total) * 100 : 0;

    // Rolling EMA smoothing
    dropRateEMARef.current = dropRateEMARef.current * 0.85 + dropRate * 0.15;
    if (inFlightMs > 0) {
      latencyEMARef.current = latencyEMARef.current * 0.85 + inFlightMs * 0.15;
    }

    // Adaptive Cadence Hysteresis
    const isOverloaded = dropRateEMARef.current > 10.0 || latencyEMARef.current > 80.0;
    const isHealthy = dropRateEMARef.current < 3.0 && latencyEMARef.current < 35.0;

    let currentFps = suggestedCadenceFps;
    let currentThrottled = isThrottled;

    // Safe startup cadence guard: for first 5000ms from spawn or before first model packet,
    // guard against premature throttling and preserve startupTargetFps (High:30, Mid:20, Low:15)
    const cpuTier = deviceProfileRef.current.cpuTier;
    const startupTargetFps = cpuTier === 'HIGH' ? 30 : (cpuTier === 'MID' ? 20 : 15);
    const isStartupWarmup = (now - spawnTsRef.current < 5000) || (!firstModelPacketTsRef.current && (now - spawnTsRef.current < 8000));

    if (isOverloaded) {
      healthyStartTimeRef.current = null;
      if (!overloadStartTimeRef.current) overloadStartTimeRef.current = now;

      // Degrade hold: 1.5s sustained overload requirement (bypassed during startup warmup)
      if (!isStartupWarmup && now - overloadStartTimeRef.current >= 1500 && now - lastCadenceChangeTsRef.current >= 2000) {
        if (currentFps > 15) {
          currentFps = 15;
          currentThrottled = true;
          setSuggestedCadenceFps(15);
          setIsThrottled(true);
          lastCadenceChangeTsRef.current = now;
        } else if (currentFps === 15 && (dropRateEMARef.current > 25.0 || latencyEMARef.current > 140.0)) {
          currentFps = 10;
          currentThrottled = true;
          setSuggestedCadenceFps(10);
          setIsThrottled(true);
          lastCadenceChangeTsRef.current = now;
        }
      }
    } else if (isHealthy) {
      overloadStartTimeRef.current = null;
      if (!healthyStartTimeRef.current) healthyStartTimeRef.current = now;

      // Restore hold: 3.0s sustained healthy load requirement
      if (now - healthyStartTimeRef.current >= 3000 && now - lastCadenceChangeTsRef.current >= 3000) {
        if (currentFps < 30) {
          const nextFps = currentFps === 10 ? 15 : 30;
          currentFps = nextFps;
          currentThrottled = nextFps < 30;
          setSuggestedCadenceFps(nextFps);
          setIsThrottled(nextFps < 30);
          lastCadenceChangeTsRef.current = now;
        }
      }
    } else {
      overloadStartTimeRef.current = null;
      healthyStartTimeRef.current = null;
    }

    setStats({
      droppedFrames: droppedFramesRef.current,
      processedFrames: processedFramesRef.current,
      dropRatePercent: Math.round(dropRate * 10) / 10,
      inFlightMs: Math.round(inFlightMs * 10) / 10,
      watchdogUnlocks: watchdogUnlocksRef.current,
      latestRequestId: requestIdRef.current,
      isThrottled: currentThrottled,
      suggestedCadenceFps: currentFps,
      rollingDropRateEMA: Math.round(dropRateEMARef.current * 10) / 10,
      rollingLatencyEMA: Math.round(latencyEMARef.current * 10) / 10,
    });
  }, [suggestedCadenceFps, isThrottled]);

  // ── Worker Initialization ──────────────────────────────────────────────────
  const initWorker = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (isSpawningRef.current) return;

    // Feature capability detection
    const browserCaps = VisionPipeline.checkBrowserCapabilities();
    if (!browserCaps.supported) {
      setWorkerState('FAILED');
      setIsFallbackMode(true);
      setFallbackReason(browserCaps.reason || 'Browser does not support Worker or ImageBitmap');
      onError?.(browserCaps.reason || 'Unsupported browser environment');
      return;
    }

    isSpawningRef.current = true;
    try {
      if (workerRef.current) {
        try {
          workerRef.current.postMessage({ type: 'DISPOSE' });
          workerRef.current.terminate();
        } catch {}
        workerRef.current = null;
      }

      setWorkerState('LOADING');
      setIsFallbackMode(false);
      setFallbackReason(null);

      // Create inline or URL-based Web Worker
      const worker = new Worker(
        new URL('../lib/workers/visionWorker.ts', import.meta.url),
        { type: 'module' }
      );

      workerRef.current = worker;

      worker.onmessage = (event: MessageEvent<VisionWorkerResponseMessage>) => {
        const msg = event.data;

        // Clear watchdog on any worker reply
        if (watchdogTimerRef.current) {
          clearTimeout(watchdogTimerRef.current);
          watchdogTimerRef.current = null;
        }

        switch (msg.type) {
          case 'MODEL_INIT_STARTED':
            modelInitStartTsRef.current = msg.payload.timestampMs;
            break;

          case 'MODEL_INIT_DONE':
            modelInitDoneTsRef.current = msg.payload.timestampMs;
            modelInitDurationMsRef.current = msg.payload.durationMs;
            modelSourceRef.current = msg.payload.source || (msg.payload.success ? 'LOCAL' : 'HEURISTIC_FALLBACK');
            if (!msg.payload.success) {
              setIsFallbackMode(true);
              setFallbackReason(msg.payload.error || 'Model loading failed, operating on heuristic fallback');
            }
            break;

          case 'MODEL_READY':
            restartAttemptsRef.current = 0;
            setWorkerState('READY');
            setActiveBackend(msg.payload.activeBackend);
            setCapabilities(msg.payload.capabilities);
            break;

          case 'LANDMARKS_PACKET': {
            const envelope = msg.payload.envelope;

            if (!firstModelPacketTsRef.current) {
              firstModelPacketTsRef.current = performance.now();
            }

            // Reject out-of-order or stale responses using safe 30-bit comparison
            if (!isNewerRequestId(envelope.requestId, latestCompletedRequestIdRef.current)) {
              return;
            }
            latestCompletedRequestIdRef.current = envelope.requestId;

            isBusyRef.current = false;
            processedFramesRef.current++;

            const inFlight = performance.now() - lastSendTimeRef.current;

            const floatArr = new Float32Array(msg.payload.landmarksBuffer);
            const packet = { envelope, buffer: floatArr };
            setLastLandmarks(packet);
            setProcessingLatencyMs(envelope.inferenceTimeMs);
            onLandmarks?.(envelope, floatArr);

            syncStats(inFlight);
            break;
          }

          case 'FRAME_RESULT': {
            const payload = msg.payload;

            isBusyRef.current = false;
            processedFramesRef.current++;

            const inFlight = performance.now() - lastSendTimeRef.current;

            setLastResults(payload);
            setProcessingLatencyMs(payload.processingLatencyMs);
            onResults?.(payload);

            syncStats(inFlight);
            break;
          }

          case 'PERFORMANCE_WARNING':
            // High latency warning handled via syncStats adaptive cadence
            break;

          case 'WORKER_ERROR': {
            isBusyRef.current = false;
            if (msg.payload.isFatal) {
              setWorkerState('FAILED');
              setIsFallbackMode(true);
              setFallbackReason(msg.payload.error);
              onError?.(msg.payload.error);
            } else if (msg.payload.fallbackRequired) {
              setIsFallbackMode(true);
              setFallbackReason(msg.payload.error);
            }
            break;
          }

          case 'DISPOSED_CONFIRM':
            setWorkerState('DISPOSED');
            break;
        }
      };

      worker.onerror = (err) => {
        if (watchdogTimerRef.current) {
          clearTimeout(watchdogTimerRef.current);
          watchdogTimerRef.current = null;
        }
        isBusyRef.current = false;

        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        restartTimestampsRef.current = restartTimestampsRef.current.filter(t => now - t < 60000);
        if (restartTimestampsRef.current.length < 3) {
          restartTimestampsRef.current.push(now);
          const attempt = restartTimestampsRef.current.length;
          restartAttemptsRef.current = attempt;
          const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          setWorkerState('LOADING');
          if (workerRef.current) {
            try { workerRef.current.terminate(); } catch {}
            workerRef.current = null;
          }
          if (restartTimeoutRef.current) {
            clearTimeout(restartTimeoutRef.current);
          }
          restartTimeoutRef.current = setTimeout(() => {
            initWorker();
          }, backoffDelay);
          return;
        }

        setWorkerState('FAILED');
        setIsFallbackMode(true);
        setFallbackReason(err.message || 'Worker syntax or runtime error (retry limit exceeded: 3/min)');
        onError?.(err.message || 'Worker syntax or runtime error (retry limit exceeded: 3/min)');
      };

      // Send INIT_MODELS command
      worker.postMessage({
        type: 'INIT_MODELS',
        payload: { backend },
      });
    } catch (err: any) {
      setWorkerState('FAILED');
      setIsFallbackMode(true);
      setFallbackReason(err?.message || 'Failed to instantiate Web Worker');
      onError?.(err?.message || 'Failed to instantiate Web Worker');
    } finally {
      isSpawningRef.current = false;
    }
  }, [backend, onError, onResults, onLandmarks, syncStats]);

  // ── Worker Lifecycle Hooks ────────────────────────────────────────────────
  useEffect(() => {
    if (autoStart) {
      initWorker();
    }

    return () => {
      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'DISPOSE' });
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [autoStart, initWorker]);

  // ── Non-Blocking Frame Dispatcher with Backpressure & Watchdog ─────────────
  const processFrame = useCallback(
    async (source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement, mirrored?: boolean): Promise<boolean> => {
      if (!workerRef.current || workerState !== 'READY' || isPausedRef.current) {
        return false;
      }

      // Strict single in-flight frame: Drop frame under backpressure
      if (isBusyRef.current) {
        droppedFramesRef.current++;
        syncStats(performance.now() - lastSendTimeRef.current);
        return false;
      }

      let bitmap: ImageBitmap | null = null;
      let bitmapTransferred = false;
      try {
        bitmap = await VisionPipeline.captureFrameBitmap(source);
        if (!bitmap) return false;

        // Double check busy or paused flag in case async capture was delayed
        if (isBusyRef.current || isPausedRef.current) {
          try {
            bitmap.close();
          } catch {}
          if (isBusyRef.current) {
            droppedFramesRef.current++;
            syncStats();
          }
          return false;
        }

        isBusyRef.current = true;
        const sendNow = performance.now();
        lastSendTimeRef.current = sendNow;
        if (!firstFrameSentTsRef.current) {
          firstFrameSentTsRef.current = sendNow;
        }

        // Monotonic 30-bit request ID counter
        const nextId = (requestIdRef.current + 1) & 0x3fffffff;
        requestIdRef.current = nextId;

        const w = source instanceof HTMLVideoElement ? (source.videoWidth || 320) : (source.width || 320);
        const h = source instanceof HTMLVideoElement ? (source.videoHeight || 240) : (source.height || 240);

        const payload = VisionPipeline.createFramePayload(bitmap, w, h, nextId, mirrored);

        // Arm adaptive watchdog timer (bounded [500ms, 1200ms])
        if (watchdogTimerRef.current) {
          clearTimeout(watchdogTimerRef.current);
        }
        const adaptiveTimeout = Math.max(500, Math.min(1200, Math.round(latencyEMARef.current * 3)));
        watchdogTimerRef.current = setTimeout(() => {
          if (isBusyRef.current) {
            isBusyRef.current = false;
            watchdogUnlocksRef.current++;
            syncStats(adaptiveTimeout);
          }
        }, adaptiveTimeout);

        // ───────────────────────────────────────────────────────────────────────────
        // OWNERSHIP & BUFFER NEUTER CONTRACT:
        // Main thread creates the ImageBitmap and immediately yields exclusive
        // ownership to the worker via Transferable [bitmap]. Once transferred,
        // the bitmap is neutered on the main thread. If dispatch fails,
        // catch block defensively closes the bitmap.
        // ───────────────────────────────────────────────────────────────────────────
        if (!bitmap || bitmap.width === 0 || bitmap.height === 0) {
          throw new Error('[useVisionWorker] Invalid or closed ImageBitmap provided for transfer.');
        }

        // Zero-copy transfer of ImageBitmap to Web Worker thread
        workerRef.current.postMessage(
          { type: 'PROCESS_FRAME', payload },
          [bitmap]
        );
        bitmapTransferred = true;

        return true;
      } catch {
        if (!bitmapTransferred && bitmap) {
          try {
            bitmap.close();
          } catch {}
        }
        isBusyRef.current = false;
        return false;
      }
    },
    [workerState, syncStats]
  );

  const restartWorker = useCallback(() => {
    restartAttemptsRef.current = 0;
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    initWorker();
  }, [initWorker]);

  return {
    workerState,
    isReady: workerState === 'READY',
    isFallbackMode,
    fallbackReason,
    executionMode,
    activeBackend,
    capabilities,
    stats,
    deviceProfile: deviceProfileRef.current,
    isTabPaused,
    isThrottled,
    suggestedCadenceFps,
    lastResults,
    lastLandmarks,
    processingLatencyMs,
    timeline: getTimeline(),
    getTimeline,
    processFrame,
    restartWorker,
  };
}
