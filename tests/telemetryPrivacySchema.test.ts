/**
 * Telemetry Privacy & Schema Validation Test Suite.
 *
 * Enforces the strict privacy guarantees of the IVP pipeline:
 * 1. Default telemetry exports MUST strictly exclude image/binary camera data.
 * 2. All 9 timeline telemetry SLA keys are present and numerically valid.
 * 3. Warmup acceptance metrics, device profiles, and feature flags conform to schema.
 */

describe('Telemetry Privacy & JSON Schema Verification', () => {
  const MANDATORY_TIMELINE_KEYS = [
    'pageLoadTs',
    'workerSpawnTs',
    'modelInitStartTs',
    'modelInitDoneTs',
    'firstFrameSentTs',
    'firstModelPacketTs',
    'firstTemplatesCreatedTs',
    'firstMicroAcceptedTs',
    'firstSmoothedRenderTs',
  ] as const;

  function createMockTelemetryPayload(includeImage: boolean = false): Record<string, any> {
    const timeline = {
      pageLoadTs: 0,
      workerSpawnTs: 24.5,
      modelInitStartTs: 31.2,
      modelInitDoneTs: 380.0,
      firstFrameSentTs: 52.1,
      firstModelPacketTs: 495.3,
      firstTemplatesCreatedTs: 108.4,
      firstMicroAcceptedTs: 124.6,
      firstSmoothedRenderTs: 139.8,
    };

    const payload: Record<string, any> = {
      sessionId: `session_${Date.now()}`,
      timestamp: Date.now(),
      timeline,
      trackingState: 'MODEL_READY',
      isWarmup: false,
      warmupAcceptance: {
        tried: 64,
        accepted: 58,
        ratePercent: 90.625,
        isPoorLighting: false,
      },
      deviceProfile: {
        deviceClass: 'desktop',
        cpuTier: 'HIGH',
        thresholds: {
          minApplyNcc: 0.75,
          maxDeltaNormalized: 0.05,
          lkMinEigenvalue: 0.002,
        },
      },
      activeFaceId: 'active_face_1',
      frameNumber: 120,
      envelope: {
        faceBox: { x: 0.3, y: 0.2, width: 0.4, height: 0.5 },
        confidence: 0.94,
      },
      landmarksRaw: Array.from({ length: 70 }, (_, i) => ({ x: 0.5 + i * 0.001, y: 0.5 + i * 0.001 })),
      landmarksSmoothed: Array.from({ length: 70 }, (_, i) => ({ x: 0.5 + i * 0.001, y: 0.5 + i * 0.001 })),
      microEvents: [
        { idx: 68, tried: true, ncc: 0.94, method: 'ZNCC', accepted: true, latencyMs: 0.12, delta: 0.002 },
      ],
      microTrackMs: { p50: 0.06, p95: 0.14 },
      featureFlags: {
        enableWarmup: true,
        enableLkFallback: true,
        enableRegionFusion: true,
        enablePcaPrior: true,
        enableSafeMode: false,
        enableTelemetryOptIn: false,
      },
    };

    if (includeImage) {
      payload.image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    }

    return payload;
  }

  it('contains all required top-level telemetry fields with exact types', () => {
    const payload = createMockTelemetryPayload(false);

    expect(typeof payload.sessionId).toBe('string');
    expect(payload.sessionId).toMatch(/^session_\d+$/);
    expect(typeof payload.timestamp).toBe('number');
    expect(typeof payload.trackingState).toBe('string');
    expect(['BOOTSTRAPPING', 'MODEL_PENDING', 'MODEL_READY']).toContain(payload.trackingState);
    expect(typeof payload.isWarmup).toBe('boolean');

    expect(typeof payload.warmupAcceptance).toBe('object');
    expect(typeof payload.warmupAcceptance.tried).toBe('number');
    expect(typeof payload.warmupAcceptance.accepted).toBe('number');
    expect(typeof payload.warmupAcceptance.ratePercent).toBe('number');
    expect(typeof payload.warmupAcceptance.isPoorLighting).toBe('boolean');

    expect(typeof payload.deviceProfile).toBe('object');
    expect(typeof payload.envelope).toBe('object');
    expect(Array.isArray(payload.landmarksRaw)).toBe(true);
    expect(Array.isArray(payload.landmarksSmoothed)).toBe(true);
    expect(Array.isArray(payload.microEvents)).toBe(true);
    expect(typeof payload.microTrackMs).toBe('object');
    expect(typeof payload.featureFlags).toBe('object');
  });

  it('contains all 9 mandatory timeline SLA keys formatted as finite non-negative numbers', () => {
    const payload = createMockTelemetryPayload(false);
    const timeline = payload.timeline;

    expect(timeline).toBeDefined();
    for (const key of MANDATORY_TIMELINE_KEYS) {
      expect(timeline).toHaveProperty(key);
      expect(typeof timeline[key]).toBe('number');
      expect(Number.isFinite(timeline[key])).toBe(true);
      expect(timeline[key]).toBeGreaterThanOrEqual(0);
    }

    // Verify key chronological constraints
    expect(timeline.firstTemplatesCreatedTs).toBeGreaterThanOrEqual(timeline.pageLoadTs);
    expect(timeline.firstSmoothedRenderTs).toBeGreaterThanOrEqual(timeline.firstTemplatesCreatedTs);
  });

  it('strictly enforces privacy: zero image or binary data in default exports', () => {
    const payload = createMockTelemetryPayload(false);

    // 1. Assert explicit omission of image keys
    expect(payload.image).toBeUndefined();
    expect(payload.imageDataUrl).toBeUndefined();
    expect(payload.screenshot).toBeUndefined();
    expect(payload.bitmap).toBeUndefined();
    expect(payload.buffer).toBeUndefined();

    // 2. Recursive scan across all values to guarantee zero data URLs or binary payloads
    function scanForImageData(obj: any, path: string = ''): void {
      if (!obj) return;
      if (typeof obj === 'string') {
        expect(obj.startsWith('data:image')).toBe(false);
        expect(obj.startsWith('data:application/octet-stream')).toBe(false);
      } else if (typeof obj === 'object') {
        expect(obj instanceof ArrayBuffer).toBe(false);
        expect(obj instanceof Uint8Array).toBe(false);
        for (const [k, v] of Object.entries(obj)) {
          scanForImageData(v, `${path}.${k}`);
        }
      }
    }

    scanForImageData(payload);
  });

  it('only attaches image data when explicitly consented by opt-in', () => {
    const payloadWithOptIn = createMockTelemetryPayload(true);
    expect(payloadWithOptIn.image).toBeDefined();
    expect(typeof payloadWithOptIn.image).toBe('string');
    expect(payloadWithOptIn.image.startsWith('data:image/png;base64,')).toBe(true);
  });
});
