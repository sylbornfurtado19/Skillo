/**
 * Skillo AI - IVP Physiological Signal Calculators
 * ====================================================================
 * Pure functional mathematical utilities for real-time speech activity,
 * blink rate frequency, and ocular hysteresis telemetry.
 *
 * Zero external dependencies. Fully deterministic and testable.
 */

export interface BlinkDetectorState {
  wasEyeClosed: boolean;
  lastBlinkTime: number;
  blinkCount: number;
  blinkTimestamps: number[];
}

export interface BlinkDetectorConfig {
  closeThreshold: number; // default: 0.21
  openThreshold: number;  // default: 0.24
  minDebounceMs: number;  // default: 70ms
  maxWindowMs: number;    // default: 60000ms (1 min)
}

export const DEFAULT_BLINK_CONFIG: BlinkDetectorConfig = {
  closeThreshold: 0.21,
  openThreshold: 0.24,
  minDebounceMs: 70,
  maxWindowMs: 60000,
};

/**
 * Creates an empty initial state for ocular blink detection.
 */
export function createInitialBlinkState(): BlinkDetectorState {
  return {
    wasEyeClosed: false,
    lastBlinkTime: 0,
    blinkCount: 0,
    blinkTimestamps: [],
  };
}

/**
 * Hysteresis thresholding for human blink detection.
 * Prevents rapid chatter around boundary transitions:
 * - Closes only when EAR drops below closeThreshold (e.g. 0.21)
 * - Stays closed until EAR recovers above openThreshold (e.g. 0.24)
 * - Enforces minimum physiological refractory period (debounce).
 */
export function processBlinkDetection(
  ear: number | null | undefined,
  now: number,
  state: BlinkDetectorState,
  config: Partial<BlinkDetectorConfig> = {}
): { state: BlinkDetectorState; didBlink: boolean } {
  if (ear === null || ear === undefined || !isFinite(ear)) {
    return { state, didBlink: false };
  }

  const { closeThreshold, openThreshold, minDebounceMs, maxWindowMs } = {
    ...DEFAULT_BLINK_CONFIG,
    ...config,
  };

  let wasEyeClosed = state.wasEyeClosed;
  let lastBlinkTime = state.lastBlinkTime;
  let blinkCount = state.blinkCount;
  let blinkTimestamps = [...state.blinkTimestamps];
  let didBlink = false;

  if (ear < closeThreshold && !wasEyeClosed) {
    if (now - lastBlinkTime > minDebounceMs) {
      wasEyeClosed = true;
      lastBlinkTime = now;
      blinkCount += 1;
      blinkTimestamps.push(now);
      didBlink = true;
    }
  } else if (ear >= openThreshold && wasEyeClosed) {
    wasEyeClosed = false;
  }

  // Prune timestamps older than max window
  blinkTimestamps = blinkTimestamps.filter((t) => now - t <= maxWindowMs);

  return {
    state: {
      wasEyeClosed,
      lastBlinkTime,
      blinkCount,
      blinkTimestamps,
    },
    didBlink,
  };
}

/**
 * Computes frequency of blinks per minute normalized over session elapsed time.
 * If elapsed session time < 5s, returns raw count without noisy amplification.
 * Returns null if session hasn't started or no valid timing exists.
 */
export function computeBlinkRate(
  blinkTimestamps: number[],
  now: number,
  sessionStartTs: number,
  windowMs = 60000
): number | null {
  if (
    sessionStartTs === null ||
    sessionStartTs === undefined ||
    sessionStartTs <= 0 ||
    now <= sessionStartTs
  ) {
    return null;
  }

  const sessionElapsedMs = now - sessionStartTs;
  if (sessionElapsedMs < 1000) {
    return 0;
  }

  // Filter timestamps to the specified window relative to `now`
  const activeBlinks = blinkTimestamps.filter((t) => now - t <= windowMs);
  if (activeBlinks.length === 0) {
    return 0;
  }

  // In the first 10 seconds, extrapolate moderately or clamp window
  const effectiveWindowMs = Math.min(sessionElapsedMs, windowMs);
  if (effectiveWindowMs < 5000) {
    // Under 5s: return raw count to avoid wild extrapolation (e.g. 1 blink in 1s != 60/min)
    return activeBlinks.length;
  }

  const minutes = effectiveWindowMs / 60000;
  const rate = activeBlinks.length / minutes;
  return Math.round(rate * 10) / 10;
}

/**
 * Calculates speech activity percentage over a sliding window of Mouth Aspect Ratio (MAR) values.
 * Returns null when the window is empty or contains no valid measurements.
 */
export function computeSpeechActivity(
  marWindow: Array<number | null | undefined>,
  threshold = 0.25
): number | null {
  if (!marWindow || marWindow.length === 0) {
    return null;
  }

  const validSamples = marWindow.filter(
    (v): v is number => v !== null && v !== undefined && isFinite(v)
  );

  if (validSamples.length === 0) {
    return null;
  }

  const activeCount = validSamples.reduce((acc, v) => (v >= threshold ? acc + 1 : acc), 0);
  const percentage = (activeCount / validSamples.length) * 100;
  return Math.round(percentage);
}

/**
 * Calculates vocal / mouth movement cadence (syllabic or articulation cycles per minute)
 * based on rising-edge threshold crossings over a time-stamped MAR series.
 */
export function computeSpeechCadence(
  marHistory: Array<{ timestamp: number; mar: number }>,
  threshold = 0.25,
  windowMs = 15000
): number {
  if (!marHistory || marHistory.length < 2) {
    return 0;
  }

  const now = marHistory[marHistory.length - 1].timestamp;
  const recent = marHistory.filter((item) => now - item.timestamp <= windowMs);
  if (recent.length < 2) return 0;

  let transitions = 0;
  let wasAbove = recent[0].mar >= threshold;

  for (let i = 1; i < recent.length; i++) {
    const isAbove = recent[i].mar >= threshold;
    if (isAbove && !wasAbove) {
      transitions++;
    }
    wasAbove = isAbove;
  }

  const elapsedMs = now - recent[0].timestamp;
  if (elapsedMs < 3000) return 0;

  const cadencePerMin = (transitions / (elapsedMs / 60000));
  return Math.round(cadencePerMin * 10) / 10;
}
