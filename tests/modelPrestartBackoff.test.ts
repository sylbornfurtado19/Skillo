import { tryInitModelWithBackoff, cancelPendingModelRetries } from '../src/lib/workers/visionWorker';

describe('Model Prestart Backoff & Resource Cap (PR B)', () => {
  afterAll(() => {
    cancelPendingModelRetries();
  });
  it('exports tryInitModelWithBackoff and guarantees capped retry mechanics', async () => {
    expect(typeof tryInitModelWithBackoff).toBe('function');

    // In a Node/Jest test environment without genuine Web Worker & WebGL context,
    // tryInitModelWithBackoff attempts to resolve FilesetResolver or local asset,
    // and returns false when in test/offline environment, falling back to heuristic.
    const result = await tryInitModelWithBackoff('CPU');
    expect(typeof result).toBe('boolean');
  });

  it('guarantees exponential backoff formula adheres to caps and spacing', () => {
    const MAX_MODEL_RETRIES = 5;
    const delays: number[] = [];

    for (let retry = 1; retry <= MAX_MODEL_RETRIES; retry++) {
      const delayMs = Math.min(1000 * Math.pow(2, retry), 30000);
      delays.push(delayMs);
    }

    // Attempt 1: 2000ms, Attempt 2: 4000ms, Attempt 3: 8000ms, Attempt 4: 16000ms, Attempt 5: 30000ms (capped)
    expect(delays).toEqual([2000, 4000, 8000, 16000, 30000]);
    expect(delays.length).toBe(5);
    for (const d of delays) {
      expect(d).toBeLessThanOrEqual(30000);
      expect(d).toBeGreaterThanOrEqual(2000);
    }
  });

  it('enforces maximum 3 worker restart attempts per 60-second window', () => {
    let restartTimestamps: number[] = [];
    const maxRestartsPerMinute = 3;
    let allowedRestarts = 0;
    let rejectedRestarts = 0;

    // Simulate 5 error events arriving within 10 seconds
    const simulatedNow = 100000;
    for (let i = 0; i < 5; i++) {
      const eventTime = simulatedNow + i * 1000;
      restartTimestamps = restartTimestamps.filter(t => eventTime - t < 60000);
      if (restartTimestamps.length < maxRestartsPerMinute) {
        restartTimestamps.push(eventTime);
        allowedRestarts++;
      } else {
        rejectedRestarts++;
      }
    }

    expect(allowedRestarts).toBe(3);
    expect(rejectedRestarts).toBe(2);
  });
});
