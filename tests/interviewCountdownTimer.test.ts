/**
 * Unit Tests for Interview Countdown Timer Optimization (PROMPT 05)
 *
 * Verifies:
 * 1. Countdown display progression at 1-second cadence (1000ms), eliminating 250ms polling.
 * 2. Absolute deadline calculation avoiding cumulative clock drift.
 * 3. Change deduplication preventing redundant state updates.
 * 4. Correct expiration and exactly-once timeout handling.
 * 5. Timer cleanup on unmount or session reset.
 * 6. Pause and resume behavior preserving question remaining time without penalty or exploit.
 * 7. Tab visibility change synchronization recovering immediately from background throttling.
 * 8. Prevention of duplicate timers or overlapping intervals across rerenders.
 * 9. Multi-question isolation: question navigation preserves each question's independent duration.
 * 10. Ledger state referential stability when remaining time has not changed.
 */

import {
  CountdownSession,
  calculateRemainingSec,
} from '../src/hooks/useInterviewCountdown';
import {
  createInitialLedgerState,
  registerQuestionTimer,
  setQuestionRemainingTime,
  applyEvent,
  closePause,
} from '../src/lib/integrity/integrityLedger';

describe('Prompt 05 — Interview Countdown Timer Engine & Optimization', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('1. calculateRemainingSec & Absolute Deadline Calculations', () => {
    it('calculates remaining seconds using ceiling rounding from absolute deadline epoch', () => {
      const now = 1000000;
      // 10.5 seconds remaining -> Math.ceil is 11s
      expect(calculateRemainingSec(now + 10500, now)).toBe(11);
      // 10.0 seconds remaining -> 10s
      expect(calculateRemainingSec(now + 10000, now)).toBe(10);
      // 0.1 seconds remaining -> 1s
      expect(calculateRemainingSec(now + 100, now)).toBe(1);
      // 0 seconds remaining -> 0s
      expect(calculateRemainingSec(now, now)).toBe(0);
      // Past deadline (-5 seconds) -> clamped to 0s
      expect(calculateRemainingSec(now - 5000, now)).toBe(0);
    });
  });

  describe('2. Countdown Progression & 1-Second Cadence (Eliminating 250ms polling)', () => {
    it('progresses once per second (1000ms) rather than polling on a 250ms cadence', () => {
      let mockNow = 500000;
      const ticks: number[] = [];
      const onTimeout = jest.fn();

      const session = new CountdownSession({
        questionId: 'q-perf-1',
        initialRemainingSec: 60,
        now: () => mockNow,
        onTick: (rem) => ticks.push(rem),
        onTimeout,
      });

      session.start();

      // Advance by 250ms (the former interval cadence)
      mockNow += 250;
      jest.advanceTimersByTime(250);
      // At 250ms, the 1000ms timer has not fired
      expect(ticks.length).toBe(0);

      // Advance another 250ms (total 500ms)
      mockNow += 250;
      jest.advanceTimersByTime(250);
      expect(ticks.length).toBe(0);

      // Advance another 500ms (total 1000ms)
      mockNow += 500;
      jest.advanceTimersByTime(500);
      // Exactly 1 second has elapsed -> tick fires once
      expect(ticks).toEqual([59]);

      // Advance another 1000ms (total 2000ms)
      mockNow += 1000;
      jest.advanceTimersByTime(1000);
      expect(ticks).toEqual([59, 58]);

      session.stop();
    });

    it('deduplicates ticks when called multiple times within the same second', () => {
      let mockNow = 500000;
      const ticks: number[] = [];
      const session = new CountdownSession({
        questionId: 'q-dedupe',
        initialRemainingSec: 30,
        now: () => mockNow,
        onTick: (rem) => ticks.push(rem),
        onTimeout: jest.fn(),
      });

      session.start();

      // Tick directly 5 times without time passing
      session.tick();
      session.tick();
      session.tick();
      expect(ticks.length).toBe(0); // initial remaining was 30, no integer change

      mockNow += 1000;
      session.tick();
      session.tick();
      session.tick();
      expect(ticks).toEqual([29]); // only one notification for reaching 29s

      session.stop();
    });
  });

  describe('3. Exactly-Once Timeout Handling', () => {
    it('invokes onTimeout strictly once when countdown reaches 0 and stops timer', () => {
      let mockNow = 1000000;
      const onTimeout = jest.fn();
      const ticks: number[] = [];

      const session = new CountdownSession({
        questionId: 'q-timeout',
        initialRemainingSec: 3,
        now: () => mockNow,
        onTick: (rem) => ticks.push(rem),
        onTimeout,
      });

      session.start();
      expect(session.isRunning()).toBe(true);

      // 1s -> 2s remaining
      mockNow += 1000;
      jest.advanceTimersByTime(1000);
      expect(ticks).toEqual([2]);
      expect(onTimeout).not.toHaveBeenCalled();

      // 2s -> 1s remaining
      mockNow += 1000;
      jest.advanceTimersByTime(1000);
      expect(ticks).toEqual([2, 1]);
      expect(onTimeout).not.toHaveBeenCalled();

      // 3s -> 0s remaining (expired!)
      mockNow += 1000;
      jest.advanceTimersByTime(1000);
      expect(ticks).toEqual([2, 1, 0]);
      expect(onTimeout).toHaveBeenCalledTimes(1);
      expect(session.isRunning()).toBe(false);

      // Advancing further time must NOT trigger onTimeout again
      mockNow += 5000;
      jest.advanceTimersByTime(5000);
      expect(onTimeout).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. Timer Cleanup on Unmount or Stop', () => {
    it('stops interval and returns the final accurate remaining seconds upon cleanup', () => {
      let mockNow = 1000000;
      const ticks: number[] = [];
      const session = new CountdownSession({
        questionId: 'q-cleanup',
        initialRemainingSec: 90,
        now: () => mockNow,
        onTick: (rem) => ticks.push(rem),
        onTimeout: jest.fn(),
      });

      session.start();
      for (let i = 0; i < 5; i++) {
        mockNow += 1000;
        jest.advanceTimersByTime(1000);
      }
      expect(ticks).toEqual([89, 88, 87, 86, 85]);

      // Stop/unmount midway
      const finalSec = session.stop();
      expect(finalSec).toBe(85);
      expect(session.isRunning()).toBe(false);

      // Time advances after stop
      mockNow += 10000;
      jest.advanceTimersByTime(10000);
      // No more ticks should have fired
      expect(ticks.length).toBe(5);
    });
  });

  describe('5. Pause & Resume Behavior (Integrity Preserved)', () => {
    it('accurately suspends the timer and resumes with saved remaining time without penalty', () => {
      let mockNow = 1000000;
      const ticks: number[] = [];
      const onTimeout = jest.fn();

      // 1. Start Q1 with 120s duration
      const session1 = new CountdownSession({
        questionId: 'q-pause',
        initialRemainingSec: 120,
        now: () => mockNow,
        onTick: (rem) => ticks.push(rem),
        onTimeout,
      });

      session1.start();

      // Candidate works for 30s
      mockNow += 30000;
      jest.advanceTimersByTime(30000);
      expect(session1.getRemainingSec()).toBe(90);

      // Camera disconnects -> Pause triggers -> session1 stops
      const savedRemaining = session1.stop();
      expect(savedRemaining).toBe(90);

      // 45 seconds pass while candidate is paused/plugging camera back in
      mockNow += 45000;
      jest.advanceTimersByTime(45000);

      // Resume: candidate reconnects camera and resumes interview
      const session2 = new CountdownSession({
        questionId: 'q-pause',
        initialRemainingSec: savedRemaining, // 90s
        now: () => mockNow,
        onTick: (rem) => ticks.push(rem),
        onTimeout,
      });

      session2.start();

      // Remaining must still be 90s! (The 45s paused must NOT be deducted)
      expect(session2.getRemainingSec()).toBe(90);

      // Candidate works for another 10s
      mockNow += 10000;
      jest.advanceTimersByTime(10000);
      expect(session2.getRemainingSec()).toBe(80);

      session2.stop();
    });
  });

  describe('6. Delayed Updates & Tab Visibility Synchronization', () => {
    it('recovers immediately without drift when browser background throttling delays ticks', () => {
      let mockNow = 1000000;
      const ticks: number[] = [];
      const onTimeout = jest.fn();

      const session = new CountdownSession({
        questionId: 'q-throttle',
        initialRemainingSec: 60,
        now: () => mockNow,
        onTick: (rem) => ticks.push(rem),
        onTimeout,
      });

      session.start();

      // User switches tabs: browser background throttles timer for 15 seconds
      mockNow += 15000;
      // Do NOT advance timer steps individually — simulate throttled delay

      // Tab becomes visible again
      const currentRemaining = session.onVisibilityChange(true);

      // Must immediately calculate accurate remaining time from absolute deadline (60 - 15 = 45s)
      expect(currentRemaining).toBe(45);
      expect(ticks).toContain(45);
      expect(onTimeout).not.toHaveBeenCalled();

      session.stop();
    });

    it('immediately triggers timeout if deadline expired while browser tab was hidden', () => {
      let mockNow = 1000000;
      const onTimeout = jest.fn();

      const session = new CountdownSession({
        questionId: 'q-expire-hidden',
        initialRemainingSec: 20,
        now: () => mockNow,
        onTick: jest.fn(),
        onTimeout,
      });

      session.start();

      // Tab hidden for 30s (past the 20s deadline)
      mockNow += 30000;

      // Visibility change fires upon tab focus
      session.onVisibilityChange(true);

      expect(onTimeout).toHaveBeenCalledTimes(1);
      expect(session.isRunning()).toBe(false);
    });
  });

  describe('7. No Duplicate Overlapping Timers', () => {
    it('ignores duplicate start() calls on an already running session', () => {
      let mockNow = 1000000;
      const ticks: number[] = [];

      const session = new CountdownSession({
        questionId: 'q-dup',
        initialRemainingSec: 30,
        now: () => mockNow,
        onTick: (rem) => ticks.push(rem),
        onTimeout: jest.fn(),
      });

      session.start();
      session.start(); // Redundant start (e.g. rapid component rerenders)
      session.start();

      mockNow += 1000;
      jest.advanceTimersByTime(1000);

      // Only one tick should occur, not 3 duplicate ticks
      expect(ticks).toEqual([29]);

      session.stop();
    });
  });

  describe('8. Multi-Question Duration Independence', () => {
    it('preserves question durations independently without cross-question bleed', () => {
      let mockNow = 1000000;

      // Q1: 120s duration
      const q1Session = new CountdownSession({
        questionId: 'q1',
        initialRemainingSec: 120,
        now: () => mockNow,
        onTick: jest.fn(),
        onTimeout: jest.fn(),
      });
      q1Session.start();

      // Candidate spends 40s on Q1
      mockNow += 40000;
      jest.advanceTimersByTime(40000);
      const q1Saved = q1Session.stop();
      expect(q1Saved).toBe(80);

      // Candidate navigates to Q2: 60s duration
      const q2Session = new CountdownSession({
        questionId: 'q2',
        initialRemainingSec: 60,
        now: () => mockNow,
        onTick: jest.fn(),
        onTimeout: jest.fn(),
      });
      q2Session.start();

      // Candidate spends 20s on Q2
      mockNow += 20000;
      jest.advanceTimersByTime(20000);
      const q2Saved = q2Session.stop();
      expect(q2Saved).toBe(40);

      // Candidate returns to Q1: resumes from 80s
      const q1Resumed = new CountdownSession({
        questionId: 'q1',
        initialRemainingSec: q1Saved,
        now: () => mockNow,
        onTick: jest.fn(),
        onTimeout: jest.fn(),
      });
      expect(q1Resumed.getRemainingSec()).toBe(80);

      // Candidate returns to Q2: resumes from 40s
      const q2Resumed = new CountdownSession({
        questionId: 'q2',
        initialRemainingSec: q2Saved,
        now: () => mockNow,
        onTick: jest.fn(),
        onTimeout: jest.fn(),
      });
      expect(q2Resumed.getRemainingSec()).toBe(40);
    });
  });

  describe('9. Integrity Ledger Stability & Referential Equality', () => {
    it('setQuestionRemainingTime returns identical state reference when remainingMs is unchanged', () => {
      let state = createInitialLedgerState('session-opt', 1000000);
      state = registerQuestionTimer(state, 'q-ledger', 0, 60000);

      // Setting remaining time to 45000ms
      const updatedState = setQuestionRemainingTime(state, 'q-ledger', 45000);
      expect(updatedState).not.toBe(state);
      expect(updatedState.questionTimers['q-ledger'].remainingMs).toBe(45000);

      // Setting to 45000ms AGAIN (e.g. repeated ticker call)
      const identicalState = setQuestionRemainingTime(updatedState, 'q-ledger', 45000);
      // MUST be referentially identical (no new object allocated!)
      expect(identicalState).toBe(updatedState);
    });

    it('setQuestionRemainingTime correctly clamps values within bounds', () => {
      let state = createInitialLedgerState('session-clamp', 1000000);
      state = registerQuestionTimer(state, 'q-clamp', 0, 60000);

      // Below zero clamps to 0
      const belowZero = setQuestionRemainingTime(state, 'q-clamp', -10000);
      expect(belowZero.questionTimers['q-clamp'].remainingMs).toBe(0);
      expect(belowZero.questionTimers['q-clamp'].consumedMs).toBe(60000);

      // Above allocated clamps to allocatedMs
      const aboveAllocated = setQuestionRemainingTime(state, 'q-clamp', 999999);
      expect(aboveAllocated.questionTimers['q-clamp'].remainingMs).toBe(60000);
      expect(aboveAllocated.questionTimers['q-clamp'].consumedMs).toBe(0);
    });
  });
});
