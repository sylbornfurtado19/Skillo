import type {
  LuminanceHistogramResult,
  OtsuSegmentationResult,
  SobelGradientResult,
  TemporalMADResult,
} from '@/lib/services/ivpDiagnosticKernels';
import type { DenseLandmarksEnvelope } from '@/types/workerMessages';
import type { VisionWorkerStats, WorkerTimelineTelemetry } from '@/hooks/useVisionWorker';
import type { TrackingPreset } from '@/lib/services/temporalSmoothing';

export const PROC_W = 320;
export const PROC_H = 240;

export type DiagnosticMode =
  | 'SOBEL_GRADIENTS'
  | 'YCRCB_SKIN_OTSU'
  | 'LUMINANCE_HISTEQ'
  | 'TEMPORAL_MAD'
  | 'PERSON_SEGMENTATION';

export interface DiagnosticMetrics {
  histStats?: LuminanceHistogramResult;
  otsuStats?: OtsuSegmentationResult;
  sobelStats?: SobelGradientResult;
  madStats?: TemporalMADResult;
  ear?: number | null;
  mar?: number | null;
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

export const MODE_TITLES: Record<DiagnosticMode, string> = {
  SOBEL_GRADIENTS:     'UNIT 4/5: SOBEL 3x3 GRADIENT VECTOR FIELD',
  YCRCB_SKIN_OTSU:     'UNIT 6/7: YCrCb CHROMINANCE & MORPHOLOGICAL OTSU MASK',
  LUMINANCE_HISTEQ:    'UNIT 2: CLAHE RADIOMETRIC HISTOGRAM EQUALIZATION',
  TEMPORAL_MAD:        'UNIT 8: INTER-FRAME TEMPORAL MAD MOTION HEATMAP',
  PERSON_SEGMENTATION: 'UNIT 2/8: ANTHROPOMETRIC PERSON FOREGROUND SEGMENTATION',
};

