/**
 * React Vision Worker Custom Hook (useVisionWorker.ts)
 *
 * Manages off-main-thread Web Worker lifecycle, non-blocking zero-copy frame dispatch,
 * backpressure frame-dropping, and seamless fallback state handling.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  WorkerLifecycleState,
  VisionWorkerResponseMessage,
  ProcessedVisionResults,
  VisionModelBackend,
} from '@/types/workerMessages';
import { VisionPipeline } from '@/lib/services/visionPipeline';

interface UseVisionWorkerOptions {
  autoStart?: boolean;
  targetFPS?: number;
  backend?: VisionModelBackend;
  onResults?: (results: ProcessedVisionResults) => void;
  onError?: (error: string) => void;
}

import type { ExecutionMode } from '@/types/gazeEngine';

interface UseVisionWorkerReturn {
  workerState: WorkerLifecycleState;
  isReady: boolean;
  isFallbackMode: boolean;
  executionMode: ExecutionMode;
  activeBackend: VisionModelBackend;
  lastResults: ProcessedVisionResults | null;
  processingLatencyMs: number;
  processFrame: (source: HTMLVideoElement | HTMLCanvasElement) => Promise<boolean>;
  restartWorker: () => void;
}

export function useVisionWorker(options: UseVisionWorkerOptions = {}): UseVisionWorkerReturn {
  const {
    autoStart = true,
    backend = 'WEBGL',
    onResults,
    onError,
  } = options;

  const [workerState, setWorkerState] = useState<WorkerLifecycleState>('UNINITIALIZED');
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const [activeBackend, setActiveBackend] = useState<VisionModelBackend>(backend);
  const [lastResults, setLastResults] = useState<ProcessedVisionResults | null>(null);
  const [processingLatencyMs, setProcessingLatencyMs] = useState(0);

  const executionMode: ExecutionMode = workerState === 'READY' && !isFallbackMode ? 'VERIFIED_MODEL' : 'ESTIMATED_FALLBACK';

  const workerRef = useRef<Worker | null>(null);
  const isBusyRef = useRef(false);

  // ── Worker Initialization ──────────────────────────────────────────────────
  const initWorker = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      setWorkerState('LOADING');
      setIsFallbackMode(false);

      // Create inline or URL-based Web Worker
      const worker = new Worker(
        new URL('../lib/workers/visionWorker.ts', import.meta.url),
        { type: 'module' }
      );

      workerRef.current = worker;

      worker.onmessage = (event: MessageEvent<VisionWorkerResponseMessage>) => {
        const msg = event.data;

        switch (msg.type) {
          case 'MODEL_READY':
            setWorkerState('READY');
            setActiveBackend(msg.payload.activeBackend);
            break;

          case 'FRAME_RESULT':
            isBusyRef.current = false;
            setLastResults(msg.payload);
            setProcessingLatencyMs(msg.payload.processingLatencyMs);
            onResults?.(msg.payload);
            break;

          case 'PERFORMANCE_WARNING':
            // High latency warning
            break;

          case 'WORKER_ERROR':
            isBusyRef.current = false;
            if (msg.payload.fallbackRequired) {
              setIsFallbackMode(true);
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
        isBusyRef.current = false;
        setWorkerState('FAILED');
        setIsFallbackMode(true);
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
      onError?.(err?.message || 'Failed to instantiate Web Worker');
    }
  }, [backend, onError, onResults]);

  // ── Worker Lifecycle Hooks ────────────────────────────────────────────────
  useEffect(() => {
    if (autoStart) {
      initWorker();
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'DISPOSE' });
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [autoStart, initWorker]);

  // ── Non-Blocking Frame Dispatcher ──────────────────────────────────────────
  const processFrame = useCallback(
    async (source: HTMLVideoElement | HTMLCanvasElement): Promise<boolean> => {
      if (!workerRef.current || workerState !== 'READY' || isBusyRef.current) {
        // Drop frame under backpressure or unready state
        return false;
      }

      try {
        const bitmap = await VisionPipeline.captureFrameBitmap(source);
        if (!bitmap) return false;

        isBusyRef.current = true;
        const w = source instanceof HTMLVideoElement ? source.videoWidth || 320 : source.width;
        const h = source instanceof HTMLVideoElement ? source.videoHeight || 240 : source.height;

        const payload = VisionPipeline.createFramePayload(bitmap, w, h);

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
    [workerState]
  );

  const restartWorker = useCallback(() => {
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
    executionMode,
    activeBackend,
    lastResults,
    processingLatencyMs,
    processFrame,
    restartWorker,
  };
}
