'use client';

import { useState, useEffect, useRef } from 'react';

export interface UseInterviewCountdownOptions {
  activeQuestionId: string;
  durationSec: number;
  isActive: boolean;
  getRemainingSec: (questionId: string, defaultDurationSec: number) => number;
  startQuestionClock: (questionId: string, defaultDurationSec: number) => number;
  saveRemainingSec: (questionId: string, remainingSec: number) => void;
  onTimeout: () => void;
}

/**
 * Calculates remaining integer seconds from an absolute deadline epoch.
 * Math.ceil guarantees that fractional seconds display cleanly as the ceiling second,
 * and <= 0 ms displays as 0s.
 */
export function calculateRemainingSec(deadlineMs: number, nowEpochMs: number = Date.now()): number {
  return Math.max(0, Math.ceil((deadlineMs - nowEpochMs) / 1000));
}

export interface CountdownSessionConfig {
  questionId: string;
  initialRemainingSec: number;
  onTick: (remainingSec: number) => void;
  onTimeout: () => void;
  now?: () => number;
}

/**
 * Standalone, testable countdown session controller.
 *
 * Implements:
 * 1. Absolute Deadline: Computes remaining time from deadline epoch (now + remaining * 1000)
 *    to eliminate cumulative drift when intervals are throttled by background tabs.
 * 2. 1-Second Cadence: Updates on a standard 1000ms interval instead of high-frequency 250ms polling.
 * 3. Change Deduplication: Only fires onTick when remaining integer seconds actually changes.
 * 4. Visibility Sync: Immediately recalibrates on visibilitychange to eliminate lag when un-throttled.
 * 5. Exactly-Once Expiration: Guarantees onTimeout fires strictly once when countdown expires.
 */
export class CountdownSession {
  private deadlineMs: number;
  private lastSec: number;
  private fired = false;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private questionId: string;
  private onTick: (remainingSec: number) => void;
  private onTimeout: () => void;
  private getNow: () => number;

  constructor(config: CountdownSessionConfig) {
    this.questionId = config.questionId;
    this.lastSec = config.initialRemainingSec;
    this.onTick = config.onTick;
    this.onTimeout = config.onTimeout;
    this.getNow = config.now ?? (() => Date.now());
    this.deadlineMs = this.getNow() + config.initialRemainingSec * 1000;
  }

  public getQuestionId(): string {
    return this.questionId;
  }

  public getDeadlineMs(): number {
    return this.deadlineMs;
  }

  public start(): void {
    if (this.timerId !== null) return; // Prevent duplicate timers

    // Standard 1-second interval (1000ms)
    this.timerId = setInterval(() => {
      this.tick();
    }, 1000);
  }

  public tick(): number {
    const remaining = calculateRemainingSec(this.deadlineMs, this.getNow());

    if (remaining !== this.lastSec) {
      this.lastSec = remaining;
      this.onTick(remaining);
    }

    if (remaining <= 0 && !this.fired) {
      this.fired = true;
      this.stop();
      this.onTimeout();
    }

    return remaining;
  }

  public onVisibilityChange(isVisible: boolean): number {
    if (isVisible) {
      return this.tick();
    }
    return this.getRemainingSec();
  }

  public getRemainingSec(): number {
    return calculateRemainingSec(this.deadlineMs, this.getNow());
  }

  public stop(): number {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    return this.getRemainingSec();
  }

  public isRunning(): boolean {
    return this.timerId !== null;
  }
}

/**
 * High-performance interview question countdown hook.
 */
export function useInterviewCountdown({
  activeQuestionId,
  durationSec,
  isActive,
  getRemainingSec,
  startQuestionClock,
  saveRemainingSec,
  onTimeout,
}: UseInterviewCountdownOptions): number {
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    const existing = getRemainingSec(activeQuestionId, durationSec);
    return existing > 0 ? existing : durationSec;
  });

  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const saveRemainingSecRef = useRef(saveRemainingSec);
  saveRemainingSecRef.current = saveRemainingSec;

  // Question navigation sync: if question ID changes, immediately update timeLeft state
  useEffect(() => {
    let remaining = getRemainingSec(activeQuestionId, durationSec);
    if (remaining <= 0) {
      remaining = startQuestionClock(activeQuestionId, durationSec);
    }
    setTimeLeft(remaining);
  }, [activeQuestionId, durationSec, getRemainingSec, startQuestionClock]);

  // Active countdown lifecycle
  useEffect(() => {
    if (!isActive) {
      return;
    }

    let currentRemaining = getRemainingSec(activeQuestionId, durationSec);
    if (currentRemaining <= 0) {
      currentRemaining = startQuestionClock(activeQuestionId, durationSec);
    }
    setTimeLeft(currentRemaining);

    const session = new CountdownSession({
      questionId: activeQuestionId,
      initialRemainingSec: currentRemaining,
      onTick: (remaining) => {
        setTimeLeft(remaining);
        saveRemainingSecRef.current(activeQuestionId, remaining);
      },
      onTimeout: () => {
        onTimeoutRef.current();
      },
    });

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        session.onVisibilityChange(true);
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    session.start();

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
      const finalRemaining = session.stop();
      saveRemainingSecRef.current(activeQuestionId, finalRemaining);
    };
  }, [isActive, activeQuestionId, durationSec, getRemainingSec, startQuestionClock]);

  return timeLeft;
}
