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

export interface VisionWorkerStats {
  droppedFrames: number;
  processedFrames: number;
  dropRatePercent: number;
  inFlightMs: number;
  watchdogUnlocks: number;
  latestRequestId: number;
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
  lastResults: ProcessedVisionResults | null;
  lastLandmarks: { envelope: DenseLandmarksEnvelope; buffer: Float32Array } | null;
  processingLatencyMs: number;
  processFrame: (source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement) => Promise<boolean>;
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

  const [stats, setStats] = useState<VisionWorkerStats>({
    droppedFrames: 0,
    processedFrames: 0,
    dropRatePercent: 0,
    inFlightMs: 0,
    watchdogUnlocks: 0,
    latestRequestId: 0,
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
  const avgLatencyRef = useRef(20);

  // Helper: update stats state
  const syncStats = useCallback((inFlightMs: number = 0) => {
    const total = droppedFramesRef.current + processedFramesRef.current;
    const dropRate = total > 0 ? (droppedFramesRef.current / total) * 100 : 0;
    setStats({
      droppedFrames: droppedFramesRef.current,
      processedFrames: processedFramesRef.current,
      dropRatePercent: Math.round(dropRate * 10) / 10,
      inFlightMs: Math.round(inFlightMs * 10) / 10,
      watchdogUnlocks: watchdogUnlocksRef.current,
      latestRequestId: requestIdRef.current,
    });
  }, []);

  // ── Worker Initialization ──────────────────────────────────────────────────
  const initWorker = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Feature capability detection
    const browserCaps = VisionPipeline.checkBrowserCapabilities();
    if (!browserCaps.supported) {
      setWorkerState('FAILED');
      setIsFallbackMode(true);
      setFallbackReason(browserCaps.reason || 'Browser does not support Worker or ImageBitmap');
      onError?.(browserCaps.reason || 'Unsupported browser environment');
      return;
    }

    try {
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
          case 'MODEL_READY':
            setWorkerState('READY');
            setActiveBackend(msg.payload.activeBackend);
            setCapabilities(msg.payload.capabilities);
            break;

          case 'LANDMARKS_PACKET': {
            const envelope = msg.payload.envelope;

            // Reject out-of-order or stale responses using safe 30-bit comparison
            if (!isNewerRequestId(envelope.requestId, latestCompletedRequestIdRef.current)) {
              return;
            }
            latestCompletedRequestIdRef.current = envelope.requestId;

            isBusyRef.current = false;
            processedFramesRef.current++;

            const inFlight = performance.now() - lastSendTimeRef.current;
            avgLatencyRef.current = avgLatencyRef.current * 0.8 + inFlight * 0.2;

            const floatArr = new Float32Array(msg.payload.landmarksBuffer);
            const packet = { envelope, buffer: floatArr };
            setLastLandmarks(packet);
            setProcessingLatencyMs(envelope.inferenceTimeMs);
            onLandmarks?.(envelope, floatArr);

            syncStats(inFlight);
            break;
          }

          case 'FRAME_RESULT': {
            isBusyRef.current = false;
            setLastResults(msg.payload);
            setProcessingLatencyMs(msg.payload.processingLatencyMs);
            onResults?.(msg.payload);
            break;
          }

          case 'PERFORMANCE_WARNING':
            break;

          case 'WORKER_ERROR':
            isBusyRef.current = false;
            if (msg.payload.fallbackRequired) {
              setIsFallbackMode(true);
              setFallbackReason(msg.payload.error);
              setWorkerState('FAILED');
            }
            onError?.(msg.payload.error);
            break;

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
        setWorkerState('FAILED');
        setIsFallbackMode(true);
        setFallbackReason(err.message || 'Worker syntax or runtime error');
        onError?.(err.message || 'Worker syntax or runtime error');
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
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'DISPOSE' });
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [autoStart, initWorker]);

  // ── Non-Blocking Frame Dispatcher with Backpressure & Watchdog ─────────────
  const processFrame = useCallback(
    async (source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement): Promise<boolean> => {
      if (!workerRef.current || workerState !== 'READY') {
        return false;
      }

      // Strict single in-flight frame: Drop frame under backpressure
      if (isBusyRef.current) {
        droppedFramesRef.current++;
        syncStats(performance.now() - lastSendTimeRef.current);
        return false;
      }

      try {
        const bitmap = await VisionPipeline.captureFrameBitmap(source);
        if (!bitmap) return false;

        // Double check busy flag in case async capture was delayed
        if (isBusyRef.current) {
          bitmap.close();
          droppedFramesRef.current++;
          syncStats();
          return false;
        }

        isBusyRef.current = true;
        const sendNow = performance.now();
        lastSendTimeRef.current = sendNow;

        // Monotonic 30-bit request ID counter
        const nextId = (requestIdRef.current + 1) & 0x3fffffff;
        requestIdRef.current = nextId;

        const w = source instanceof HTMLVideoElement ? (source.videoWidth || 320) : (source.width || 320);
        const h = source instanceof HTMLVideoElement ? (source.videoHeight || 240) : (source.height || 240);

        const payload = VisionPipeline.createFramePayload(bitmap, w, h, nextId);

        // Arm adaptive watchdog timer (3x average inference latency, bounded [500ms, 1000ms])
        if (watchdogTimerRef.current) {
          clearTimeout(watchdogTimerRef.current);
        }
        const adaptiveTimeout = Math.max(500, Math.min(1000, Math.round(avgLatencyRef.current * 3)));
        watchdogTimerRef.current = setTimeout(() => {
          if (isBusyRef.current) {
            isBusyRef.current = false;
            watchdogUnlocksRef.current++;
            syncStats(adaptiveTimeout);
          }
        }, adaptiveTimeout);

        // Zero-copy transfer of ImageBitmap to Web Worker thread
        workerRef.current.postMessage(
          { type: 'PROCESS_FRAME', payload },
          [bitmap]
        );

        return true;
      } catch {
        isBusyRef.current = false;
        return false;
      }
    },
    [workerState, syncStats]
  );

  const restartWorker = useCallback(() => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
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
    lastResults,
    lastLandmarks,
    processingLatencyMs,
    processFrame,
    restartWorker,
  };
}
