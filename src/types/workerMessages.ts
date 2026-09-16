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
  | 'MODEL_INIT_STARTED'
  | 'MODEL_INIT_DONE'
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

export interface VisionWorkerCapabilities {
  hasOffscreenCanvas: boolean;
  hasTransferable: boolean;
  hasImageBitmap: boolean;
  hasWebGL: boolean;
  activeBackend: VisionModelBackend;
}

const RANGE = 0x40000000;
const HALF = RANGE >> 1;

/**
 * 30-bit safe modular monotonic sequence comparison.
 * Handles integer wrapping and out-of-order rejections reliably.
 */
export function isNewerRequestId(newId: number, lastId: number): boolean {
  if (lastId === 0) return true;
  if (newId === lastId) return false;
  return (((newId - lastId) % RANGE) + RANGE) % RANGE < HALF;
}

export interface VisionWorkerFramePayload {
  requestId: number;
  frameId: number;
  timestampMs: number;
  // Transferable ImageBitmap or ImageData canvas reference
  imageBitmap?: ImageBitmap;
  // Pixel dimensions fallback
  width: number;
  height: number;
  mirrored?: boolean;
  activeFaceId?: string | number | null;
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
    capabilities: VisionWorkerCapabilities;
    readyTimestampMs: number;
  };
}

// ── Shared Mathematical Contracts ───────────────────────────────────────────

export interface DenseLandmarkPoint {
  index: number;
  x: number;
  y: number;
  z: number;
  confidence: number;
}

export interface DenseLandmarksEnvelope {
  version: 1;
  requestId: number;
  frameId: number;
  timestampMs: number;
  videoWidth: number;
  videoHeight: number;
  mirrored: boolean;
  inferenceTimeMs: number;
  numPoints: number;
  faceDetected: boolean;
  faceBox: { x: number; y: number; width: number; height: number };
  activeFaceId?: string | number | null;
  detectedFaces?: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  ear: number;
  mar: number;
  regionConfidences: {
    eyes: number;
    nose: number;
    mouth: number;
    overall: number;
  };
  trackingMode: 'LEARNED_FACELANDMARKER' | 'MEDIAPIPE_FACEMESH' | 'HYBRID_OPTICAL_TRACKER' | 'CANVAS_HEURISTIC';
}

export interface ProcessedVisionResults {
  frameId: number;
  timestampMs: number;
  processingLatencyMs: number;
  gazeResult?: GazeFrameResult;
  poseResult?: HeadPoseFrameResult;
  affectResult?: AffectFrameResult;
  faceDetected: boolean;
  motionEnergy?: number;
  isSubjectPresent?: boolean;
  isExcessiveMotion?: boolean;
  denseLandmarks?: DenseLandmarksEnvelope & {
    landmarks?: DenseLandmarkPoint[];
  };
}

export interface DenseLandmarksResponseMessage {
  type: 'LANDMARKS_PACKET';
  payload: {
    envelope: DenseLandmarksEnvelope;
    // Transferable Float32Array buffer: [x0, y0, z0, c0, x1, y1, z1, c1, ...]
    landmarksBuffer: ArrayBuffer;
  };
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

export interface ModelInitStartedResponseMessage {
  type: 'MODEL_INIT_STARTED';
  payload: {
    timestampMs: number;
    backend: VisionModelBackend;
  };
}

export interface ModelInitDoneResponseMessage {
  type: 'MODEL_INIT_DONE';
  payload: {
    success: boolean;
    timestampMs: number;
    durationMs: number;
    source?: 'CACHED' | 'LOCAL' | 'CDN' | 'HEURISTIC_FALLBACK';
    error?: string;
    errorCode?: 'IDB_CORRUPT' | 'LOCAL_NOT_FOUND' | 'CDN_FETCH_FAILED' | 'RETRY_LIMIT_EXCEEDED' | 'UNKNOWN';
    attemptCount?: number;
  };
}

export type VisionWorkerResponseMessage =
  | ModelInitStartedResponseMessage
  | ModelInitDoneResponseMessage
  | ModelReadyResponseMessage
  | FrameResultResponseMessage
  | DenseLandmarksResponseMessage
  | PerformanceWarningResponseMessage
  | WorkerErrorResponseMessage
  | DisposedConfirmResponseMessage;
