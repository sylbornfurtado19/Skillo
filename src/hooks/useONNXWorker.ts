'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  ONNXWorkerCommandMessage,
  ONNXWorkerResponseMessage,
  ONNXModelType,
} from '@/types/onnxWorkerMessages';
import {
  type SmoothedTelemetry,
  runContinuousUnifiedONNX,
} from '@/lib/services/onnxInferenceService';
import { computeFaceRoiCrop } from '@/lib/services/visionPipeline';
import { getIVPFeatureFlags } from '@/lib/services/ivpFeatureFlags';

export interface FrameMetadata {
  questionId?: string;
  questionIndex?: number;
  timestampMs?: number;
  faceBox?: { x: number; y: number; width: number; height: number } | null;
  mirrored?: boolean;
}

export interface UseONNXWorkerOptions {
  autoStart?: boolean;
  onTelemetry?: (telemetry: SmoothedTelemetry, frameId?: number, metadata?: FrameMetadata) => void;
  disabled?: boolean;
}

export interface UseONNXWorkerReturn {
  submitFrame: (
    source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement,
    metadata?: FrameMetadata
  ) => Promise<boolean>;
  telemetry: SmoothedTelemetry;
  isReady: boolean;
  isWorkerActive: boolean;
  workerError: string | null;
  activeMode: 'worker-onnx' | 'direct-geometric';
  loadedModels: Record<ONNXModelType, boolean>;
  droppedFramesCount: number;
}

const DEFAULT_TELEMETRY: SmoothedTelemetry = {
  yaw: 0,
  pitch: 0,
  roll: 0,
  gazeYawDegrees: 0,
  gazePitchDegrees: 0,
  normalizedGazeX: 0,
  normalizedGazeY: 0,
  gazeX: 0,
  gazeY: 0,
  composure: 85,
  dominantEmotion: 'NEUTRAL',
  totalInferenceTimeMs: 0,
  isBlurry: false,
  blurVariance: 500,
};

export function useONNXWorker(options: UseONNXWorkerOptions = {}): UseONNXWorkerReturn {
  const { autoStart = true, onTelemetry, disabled = false } = options;

  const [telemetry, setTelemetry] = useState<SmoothedTelemetry>(DEFAULT_TELEMETRY);
  const [isReady, setIsReady] = useState(false);
  const [isWorkerActive, setIsWorkerActive] = useState(false);
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<'worker-onnx' | 'direct-geometric'>('worker-onnx');
  const [loadedModels, setLoadedModels] = useState<Record<ONNXModelType, boolean>>({
    affect: false,
    gaze: false,
    pose: false,
  });
  const [droppedFramesCount, setDroppedFramesCount] = useState(0);

  const workerRef = useRef<Worker | null>(null);
  const inFlightRef = useRef(false);
  const frameIdCounterRef = useRef(0);
  const frameMetadataMapRef = useRef<Map<number, FrameMetadata>>(new Map());
  const onTelemetryRef = useRef(onTelemetry);
  onTelemetryRef.current = onTelemetry;

  // Initialize Worker
  useEffect(() => {
    if (disabled || typeof window === 'undefined' || typeof Worker === 'undefined') {
      setActiveMode('direct-geometric');
      setIsReady(true);
      return;
    }

    if (!autoStart) return;

    let worker: Worker;
    try {
      worker = new Worker(new URL('../lib/workers/onnxWorker.ts', import.meta.url), {
        type: 'module',
      });
      workerRef.current = worker;
      setIsWorkerActive(true);
    } catch (err: any) {
      console.warn('[useONNXWorker] Worker instantiation failed, falling back to direct execution:', err);
      setActiveMode('direct-geometric');
      setIsReady(true);
      return;
    }

    worker.onmessage = (e: MessageEvent<ONNXWorkerResponseMessage>) => {
      const msg = e.data;
      if (!msg) return;

      switch (msg.type) {
        case 'INIT_SUCCESS': {
          setIsReady(true);
          setLoadedModels(msg.payload.loadedModels);
          setWorkerError(null);
          break;
        }

        case 'INIT_FAILURE': {
          console.warn('[useONNXWorker] Model init failure, falling back to direct mode:', msg.payload.error);
          setWorkerError(msg.payload.error);
          setActiveMode('direct-geometric');
          setIsReady(true);
          break;
        }

        case 'INFER_RESULT': {
          inFlightRef.current = false;
          setTelemetry(msg.payload.telemetry);
          const meta = frameMetadataMapRef.current.get(msg.payload.frameId);
          frameMetadataMapRef.current.delete(msg.payload.frameId);
          if (onTelemetryRef.current) {
            onTelemetryRef.current(msg.payload.telemetry, msg.payload.frameId, meta);
          }
          break;
        }

        case 'INFER_DROPPED': {
          inFlightRef.current = false;
          frameMetadataMapRef.current.delete(msg.payload.frameId);
          setDroppedFramesCount((prev) => prev + 1);
          break;
        }

        case 'WORKER_ERROR': {
          inFlightRef.current = false;
          if (msg.payload.frameId) {
            frameMetadataMapRef.current.delete(msg.payload.frameId);
          }
          console.warn('[useONNXWorker] Worker reported error:', msg.payload.error);
          break;
        }

        case 'DISPOSED_CONFIRM': {
          setIsReady(false);
          setIsWorkerActive(false);
          break;
        }
      }
    };

    worker.onerror = (err) => {
      console.warn('[useONNXWorker] Uncaught worker error:', err);
      setWorkerError('Web Worker runtime error');
      setActiveMode('direct-geometric');
      inFlightRef.current = false;
    };

    // Send init message
    const initCmd: ONNXWorkerCommandMessage = { type: 'INIT_MODELS' };
    worker.postMessage(initCmd);

    return () => {
      try {
        const disposeCmd: ONNXWorkerCommandMessage = { type: 'DISPOSE' };
        worker.postMessage(disposeCmd);
        worker.terminate();
      } catch {}
      workerRef.current = null;
      inFlightRef.current = false;
    };
  }, [autoStart, disabled]);

  // Frame submission with strict backpressure and ImageBitmap transfer
  const submitFrame = useCallback(
    async (
      source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement,
      metadata?: FrameMetadata
    ): Promise<boolean> => {
      if (disabled) return false;

      // 1. Direct geometric fallback if worker not active
      if (activeMode === 'direct-geometric' || !workerRef.current) {
        if (inFlightRef.current) return false;
        inFlightRef.current = true;
        try {
          if (source instanceof HTMLCanvasElement) {
            const isROI = Boolean(metadata?.faceBox && metadata.faceBox.width > 0 && metadata.faceBox.height > 0);
            const res = await runContinuousUnifiedONNX(source, 0.35, isROI);
            setTelemetry(res);
            if (onTelemetryRef.current) onTelemetryRef.current(res, undefined, metadata);
            return true;
          }
        } catch (err) {
          console.warn('[useONNXWorker] Direct inference error:', err);
        } finally {
          inFlightRef.current = false;
        }
        return false;
      }

      // 2. Strict Backpressure: if a frame is already in-flight in the worker, drop immediately
      if (inFlightRef.current) {
        setDroppedFramesCount((prev) => prev + 1);
        return false;
      }

      // 3. Create transferable ImageBitmap with Face-ROI crop
      frameIdCounterRef.current += 1;
      const frameId = frameIdCounterRef.current;
      if (metadata) {
        frameMetadataMapRef.current.set(frameId, metadata);
      }
      inFlightRef.current = true;

      try {
        let bitmap: ImageBitmap;
        let isROI = false;
        if (typeof createImageBitmap !== 'undefined') {
          const srcW = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
          const srcH = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
          const flags = getIVPFeatureFlags();
          const shouldCropRoi = flags.enableRoiCrop !== false;
          const crop = shouldCropRoi
            ? computeFaceRoiCrop(metadata?.faceBox, srcW, srcH, {
                mirrored: metadata?.mirrored,
              })
            : { sx: 0, sy: 0, sw: srcW, sh: srcH, isROI: false };
          isROI = crop.isROI;

          if (isROI && crop.sw > 0 && crop.sh > 0) {
            bitmap = await createImageBitmap(source, crop.sx, crop.sy, crop.sw, crop.sh, {
              resizeWidth: 224,
              resizeHeight: 224,
              resizeQuality: 'low',
            });
          } else {
            bitmap = await createImageBitmap(source, {
              resizeWidth: 224,
              resizeHeight: 224,
              resizeQuality: 'low',
            });
          }
        } else {
          frameMetadataMapRef.current.delete(frameId);
          inFlightRef.current = false;
          return false;
        }

        const inferCmd: ONNXWorkerCommandMessage = {
          type: 'INFER_FRAME',
          payload: {
            frameId,
            imageBitmap: bitmap,
            timestampMs: performance.now(),
            isROI,
          },
        };

        workerRef.current.postMessage(inferCmd, [bitmap]);
        return true;
      } catch {
        frameMetadataMapRef.current.delete(frameId);
        inFlightRef.current = false;
        return false;
      }
    },
    [activeMode, disabled]
  );

  return {
    submitFrame,
    telemetry,
    isReady,
    isWorkerActive,
    workerError,
    activeMode,
    loadedModels,
    droppedFramesCount,
  };
}
