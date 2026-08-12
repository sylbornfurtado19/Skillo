/**
 * Worker Messages Contract
 * Strict TypeScript interfaces for off-main-thread Web Worker communication.
 *
 * Implements zero-copy Transferable Objects (ImageBitmap / ArrayBuffer)
 * to avoid structured cloning latency between main thread and vision worker.
 */

import type {
  GazeFrameResult,
  HeadPoseFrameResult,
  AffectFrameResult,
} from '@/types/index';

// ── Worker Execution & Lifecycle State ───────────────────────────────────────
export type WorkerLifecycleState =
  | 'UNINITIALIZED'
  | 'LOADING'
  | 'READY'
  | 'BUSY'
  | 'FAILED'
  | 'DISPOSED';

// ── Model Backend Target Types ───────────────────────────────────────────────
export type VisionModelBackend = 'WEBGL' | 'WASM' | 'WEBGPU' | 'CPU';

// ── Command Types (Main Thread -> Worker) ──────────────────────────────────
export type VisionWorkerCommandType =
  | 'INIT_MODELS'
  | 'PROCESS_FRAME'
  | 'SET_CONFIG'
  | 'DISPOSE';

// ── Response Types (Worker -> Main Thread) ──────────────────────────────────
export type VisionWorkerResponseType =
  | 'MODEL_READY'
  | 'FRAME_RESULT'
  | 'PERFORMANCE_WARNING'
  | 'WORKER_ERROR'
  | 'DISPOSED_CONFIRM';

// ── Payload Contracts ────────────────────────────────────────────────────────

export interface VisionWorkerInitPayload {
  backend?: VisionModelBackend;
  wasmPath?: string;
  modelAssetPath?: string;
  enableGaze?: boolean;
  enablePose?: boolean;
  enableAffect?: boolean;
}

export interface VisionWorkerFramePayload {
  frameId: number;
  timestampMs: number;
  // Transferable ImageBitmap or ImageData canvas reference
  imageBitmap?: ImageBitmap;
  // Pixel dimensions fallback
  width: number;
  height: number;
}

export interface VisionWorkerConfigPayload {
  targetFPS?: number;
  confidenceThreshold?: number;
  fallbackToHeuristics?: boolean;
}

// ── Main Thread -> Worker Message Wrappers ───────────────────────────────────

export interface InitModelsCommandMessage {
  type: 'INIT_MODELS';
  payload: VisionWorkerInitPayload;
}

export interface ProcessFrameCommandMessage {
  type: 'PROCESS_FRAME';
  payload: VisionWorkerFramePayload;
}

export interface SetConfigCommandMessage {
  type: 'SET_CONFIG';
  payload: VisionWorkerConfigPayload;
}

export interface DisposeCommandMessage {
  type: 'DISPOSE';
}

export type VisionWorkerCommandMessage =
  | InitModelsCommandMessage
  | ProcessFrameCommandMessage
  | SetConfigCommandMessage
  | DisposeCommandMessage;

// ── Worker -> Main Thread Response Wrappers ───────────────────────────────────

export interface ModelReadyResponseMessage {
  type: 'MODEL_READY';
  payload: {
    activeBackend: VisionModelBackend;
    initLatencyMs: number;
    modelsLoaded: string[];
  };
}

export interface ProcessedVisionResults {
  frameId: number;
  timestampMs: number;
  processingLatencyMs: number;
  gazeResult?: GazeFrameResult;
  poseResult?: HeadPoseFrameResult;
  affectResult?: AffectFrameResult;
  faceDetected: boolean;
}

export interface FrameResultResponseMessage {
  type: 'FRAME_RESULT';
  payload: ProcessedVisionResults;
}

export interface PerformanceWarningResponseMessage {
  type: 'PERFORMANCE_WARNING';
  payload: {
    frameId: number;
    processingLatencyMs: number;
    thresholdMs: number;
    recommendation: 'REDUCE_FPS' | 'FALLBACK_TO_CANVAS_HEURISTICS';
  };
}

export interface WorkerErrorResponseMessage {
  type: 'WORKER_ERROR';
  payload: {
    error: string;
    code: 'INIT_FAILED' | 'INFERENCE_ERROR' | 'MEMORY_LEAK_PREVENTED' | 'UNKNOWN';
    isFatal: boolean;
    fallbackRequired: boolean;
  };
}

export interface DisposedConfirmResponseMessage {
  type: 'DISPOSED_CONFIRM';
}

export type VisionWorkerResponseMessage =
  | ModelReadyResponseMessage
  | FrameResultResponseMessage
  | PerformanceWarningResponseMessage
  | WorkerErrorResponseMessage
  | DisposedConfirmResponseMessage;
