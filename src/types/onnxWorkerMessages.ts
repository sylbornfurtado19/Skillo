import type { SmoothedTelemetry, ONNXModelType } from '@/lib/services/onnxInferenceService';

export type { ONNXModelType };

export interface ONNXInitPayload {
  modelPaths?: Partial<Record<ONNXModelType, string>>;
  wasmThreads?: number;
  enableSimd?: boolean;
}

export interface ONNXInferPayload {
  frameId: number;
  imageBitmap: ImageBitmap;
  timestampMs: number;
  customAlphas?: number | { pose?: number; gaze?: number; composure?: number };
}

export interface ONNXCancelPayload {
  frameId: number;
}

export type ONNXWorkerCommandMessage =
  | { type: 'INIT_MODELS'; payload?: ONNXInitPayload }
  | { type: 'INFER_FRAME'; payload: ONNXInferPayload }
  | { type: 'CANCEL_FRAME'; payload: ONNXCancelPayload }
  | { type: 'DISPOSE' };

export interface ONNXInitSuccessPayload {
  loadedModels: Record<ONNXModelType, boolean>;
  backend: string;
}

export interface ONNXInferResultPayload {
  frameId: number;
  telemetry: SmoothedTelemetry;
  processingLatencyMs: number;
  isFallback?: boolean;
}

export interface ONNXInferDroppedPayload {
  frameId: number;
  reason: 'stale' | 'busy' | 'cancelled' | 'blurry';
}

export interface ONNXWorkerErrorPayload {
  error: string;
  code: string;
  frameId?: number;
}

export type ONNXWorkerResponseMessage =
  | { type: 'INIT_SUCCESS'; payload: ONNXInitSuccessPayload }
  | { type: 'INIT_FAILURE'; payload: { error: string } }
  | { type: 'INFER_RESULT'; payload: ONNXInferResultPayload }
  | { type: 'INFER_DROPPED'; payload: ONNXInferDroppedPayload }
  | { type: 'WORKER_ERROR'; payload: ONNXWorkerErrorPayload }
  | { type: 'DISPOSED_CONFIRM' };
