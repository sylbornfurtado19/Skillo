import type { CanvasTimelineTelemetry, TrackingLifecycleState } from './types';
import type { IVPFeatureFlags } from '@/lib/services/ivpFeatureFlags';
import type { DeviceProfile } from '@/lib/services/visionPipeline';

export function getMicroTrackPercentiles(samples: number[] = []): { p50: number; p95: number } {
  if (!samples || samples.length === 0) return { p50: 0, p95: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  return { p50, p95 };
}

export interface ExportTelemetryParams {
  includeImage?: boolean;
  canvas: HTMLCanvasElement | null;
  microTrackMsSamples: number[];
  currentActiveFace: string | number | null;
  warmupTried: number;
  warmupAccepted: number;
  timeline: CanvasTimelineTelemetry;
  trackingState: TrackingLifecycleState;
  featureFlags: IVPFeatureFlags;
  appMountTs: number;
  deviceProfile: DeviceProfile;
  frameCount: number;
  workerLandmarks: any;
  lastRawNormPts: Array<{ x: number; y: number }> | null;
  smoothedLandmarks: Array<{ x: number; y: number }>;
  microEventHistory: Array<{
    idx: number;
    ncc: number;
    method: 'ZNCC' | 'LK' | 'SOBEL';
    accepted: boolean;
    delta: number;
  }>;
  lastMicroTrackMs: number;
}

export function exportTelemetryPayload(params: ExportTelemetryParams): void {
  let allowImage = params.includeImage ?? false;
  if (allowImage && typeof window !== 'undefined') {
    const confirmed = window.confirm(
      'Privacy Notice: You requested to include a visual camera screenshot in the exported telemetry JSON. Do you provide explicit consent to export visual data?'
    );
    if (!confirmed) {
      allowImage = false;
    }
  }

  const { p50, p95 } = getMicroTrackPercentiles(params.microTrackMsSamples);
  let imageDataUrl: string | undefined;
  if (allowImage && params.canvas) {
    try {
      imageDataUrl = params.canvas.toDataURL('image/png');
    } catch {}
  }

  const warmupT = params.warmupTried;
  const warmupA = params.warmupAccepted;
  const payload = {
    sessionId: `session_${Date.now()}`,
    timestamp: Date.now(),
    timeline: { ...params.timeline },
    trackingState: params.trackingState,
    isWarmup: params.featureFlags.enableWarmup &&
      (performance.now() - params.appMountTs < 4000) &&
      (params.trackingState !== 'MODEL_READY'),
    warmupAcceptance: {
      tried: warmupT,
      accepted: warmupA,
      ratePercent: warmupT > 0 ? (warmupA / warmupT) * 100 : 100,
      isPoorLighting: params.featureFlags.enableWarmup && warmupT > 50 && (warmupA / warmupT) < 0.05,
    },
    deviceProfile: params.deviceProfile,
    activeFaceId: params.currentActiveFace,
    frameNumber: params.frameCount,
    envelope: {
      faceBox: params.workerLandmarks?.envelope?.faceBox ?? null,
      confidence: params.workerLandmarks?.envelope?.regionConfidences?.overall ?? 0,
    },
    landmarksRaw: (params.lastRawNormPts ?? []).slice(0, 70),
    landmarksSmoothed: params.smoothedLandmarks.slice(0, 70),
    microEvents: params.microEventHistory.map((evt) => ({
      idx: evt.idx,
      tried: true,
      ncc: evt.ncc,
      method: evt.method,
      accepted: evt.accepted,
      latencyMs: params.lastMicroTrackMs,
      delta: evt.delta,
    })),
    microTrackMs: { p50, p95 },
    featureFlags: params.featureFlags,
    ...(allowImage && imageDataUrl ? { image: imageDataUrl } : {}),
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
}
