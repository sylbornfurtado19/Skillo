import {
  computeBlinkRate,
  computeSpeechActivity,
  processBlinkDetection,
  createInitialBlinkState,
  computeSpeechCadence,
} from '../src/lib/services/ivpSignalCalculators';

describe('IVP Signal Calculators (Iteration 2 Pure Math)', () => {
  describe('computeBlinkRate', () => {
    it('returns null if session has not started or invalid timestamps', () => {
      expect(computeBlinkRate([], 1000, 0)).toBeNull();
      expect(computeBlinkRate([], 500, 1000)).toBeNull();
    });

    it('returns 0 if session is active but no blinks have occurred', () => {
      expect(computeBlinkRate([], 20000, 10000)).toBe(0);
    });

    it('returns raw count if session elapsed is under 5 seconds to avoid extreme amplification', () => {
      const blinks = [1200];
      // elapsed = 2000ms (2s)
      const rate = computeBlinkRate(blinks, 3000, 1000);
      expect(rate).toBe(1);
    });

    it('accurately computes rate per minute for steady blink frequency', () => {
      // 10 blinks over 30 seconds -> 20 blinks per minute
      const start = 100000;
      const blinks = [
        103000, 106000, 109000, 112000, 115000,
        118000, 121000, 124000, 127000, 130000,
      ];
      const now = 130000;
      const rate = computeBlinkRate(blinks, now, start);
      // 10 blinks in 30,000ms (0.5 min) = 20 blinks/min
      expect(rate).toBe(20);
    });

    it('filters out blinks older than the 60-second sliding window', () => {
      const start = 1000;
      const now = 121000; // 2 minutes in
      // 3 blinks in the last 60 seconds (71s, 91s, 111s) and 5 blinks in the first minute
      const blinks = [11000, 21000, 31000, 41000, 51000, 71000, 91000, 111000];
      const rate = computeBlinkRate(blinks, now, start, 60000);
      // only 3 blinks within [61000..121000] (1 minute window) -> 3 blinks/min
      expect(rate).toBe(3);
    });
  });

  describe('computeSpeechActivity', () => {
    it('returns null when window is empty or contains only null/undefined', () => {
      expect(computeSpeechActivity([])).toBeNull();
      expect(computeSpeechActivity([null, undefined])).toBeNull();
    });

    it('returns 0% when all MAR values are below threshold', () => {
      const window = [0.12, 0.14, 0.15, 0.18, 0.20];
      expect(computeSpeechActivity(window, 0.25)).toBe(0);
    });

    it('returns 100% when all MAR values are at or above threshold', () => {
      const window = [0.26, 0.32, 0.40, 0.25];
      expect(computeSpeechActivity(window, 0.25)).toBe(100);
    });

    it('accurately computes percentage for mixed window ignoring nulls', () => {
      // 3 above (0.3, 0.4, 0.25) out of 6 valid samples = 50%
      const window = [0.10, 0.30, null, 0.15, 0.40, undefined, 0.25, 0.18];
      expect(computeSpeechActivity(window, 0.25)).toBe(50);
    });
  });

  describe('processBlinkDetection (Hysteresis & Debounce)', () => {
    it('handles null or undefined EAR gracefully without state corruption', () => {
      const initial = createInitialBlinkState();
      const res = processBlinkDetection(null, 100, initial);
      expect(res.didBlink).toBe(false);
      expect(res.state.blinkCount).toBe(0);
    });

    it('triggers a blink when EAR falls below 0.21', () => {
      const state = createInitialBlinkState();
      const res = processBlinkDetection(0.18, 1000, state);
      expect(res.didBlink).toBe(true);
      expect(res.state.wasEyeClosed).toBe(true);
      expect(res.state.blinkCount).toBe(1);
      expect(res.state.lastBlinkTime).toBe(1000);
    });

    it('does not re-trigger while eye remains closed', () => {
      let state = createInitialBlinkState();
      let res = processBlinkDetection(0.18, 1000, state);
      state = res.state;

      // Still closed 20ms later
      res = processBlinkDetection(0.15, 1020, state);
      expect(res.didBlink).toBe(false);
      expect(res.state.blinkCount).toBe(1);
    });

    it('re-opens only after crossing 0.24 threshold and allows subsequent blink after debounce', () => {
      let state = createInitialBlinkState();
      // First blink
      state = processBlinkDetection(0.18, 1000, state).state;

      // Intermediate value 0.22 (between 0.21 and 0.24) should keep state closed
      state = processBlinkDetection(0.22, 1050, state).state;
      expect(state.wasEyeClosed).toBe(true);

      // Recovers to 0.25 -> eye opens
      state = processBlinkDetection(0.25, 1080, state).state;
      expect(state.wasEyeClosed).toBe(false);

      // Next blink at 1200 (well after 70ms debounce)
      const secondBlink = processBlinkDetection(0.17, 1200, state);
      expect(secondBlink.didBlink).toBe(true);
      expect(secondBlink.state.blinkCount).toBe(2);
    });

    it('suppresses chatter if EAR drops again before minDebounceMs', () => {
      let state = createInitialBlinkState();
      state = processBlinkDetection(0.18, 1000, state).state;
      state = processBlinkDetection(0.26, 1020, state).state; // opened
      // Drop again at 1040 (only 40ms from last blink, < 70ms debounce)
      const chatter = processBlinkDetection(0.18, 1040, state);
      expect(chatter.didBlink).toBe(false);
      expect(chatter.state.blinkCount).toBe(1);
    });
  });

  describe('computeSpeechCadence', () => {
    it('returns 0 for insufficient history or under 3 seconds', () => {
      expect(computeSpeechCadence([])).toBe(0);
      expect(computeSpeechCadence([{ timestamp: 1000, mar: 0.1 }])).toBe(0);
    });

    it('computes syllables/articulations per minute from transitions', () => {
      // 3 speech bursts (rising edges) in 6 seconds (6000ms = 0.1 min) -> 30 bursts/min
      const history = [
        { timestamp: 0, mar: 0.1 },
        { timestamp: 1000, mar: 0.3 }, // +1
        { timestamp: 2000, mar: 0.1 },
        { timestamp: 3000, mar: 0.35 }, // +2
        { timestamp: 4000, mar: 0.12 },
        { timestamp: 5000, mar: 0.28 }, // +3
        { timestamp: 6000, mar: 0.1 },
      ];
      const cadence = computeSpeechCadence(history, 0.25, 10000);
      expect(cadence).toBe(30);
    });
  });
});
