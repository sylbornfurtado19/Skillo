/**
 * Skillo AI - Pure Functional Integrity Ledger & Timer State Machine
 * ====================================================================
 * Pure reducer managing proctoring events, pause accounting,
 * per-question remaining time budgets, and tamper-resistant state serialization.
 */

import type {
  IntegrityEvent,
  IntegrityEventType,
  IntegrityLedgerState,
  PauseReason,
  QuestionTimerRecord,
  SessionIntegrityReport,
  SessionIntegrityTotals,
} from '@/types/integrity';
import {
  INTEGRITY_POLICY_VERSION,
  INTEGRITY_THRESHOLDS,
  INTEGRITY_LIMITATIONS_NOTE,
  evaluateIntegrityVerdict,
} from './integrityPolicy';

let _idCounter = 0;
function generateEventId(prefix: string): string {
  _idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${_idCounter.toString(36)}`;
}

/**
 * Initializes a clean integrity ledger state.
 */
export function createInitialLedgerState(
  sessionId: string,
  sessionStartEpochMs: number = Date.now()
): IntegrityLedgerState {
  return {
    sessionId,
    sessionStartEpochMs,
    activePause: null,
    events: [],
    questionTimers: {},
    currentQuestionId: undefined,
    lastViolationTimestampMs: {},
  };
}

/**
 * Registers or initializes a timer record for a specific interview question.
 * If the question already exists, it preserves existing consumedMs and remainingMs.
 */
export function registerQuestionTimer(
  state: IntegrityLedgerState,
  questionId: string,
  questionIndex: number,
  allocatedMs: number
): IntegrityLedgerState {
  const existing = state.questionTimers[questionId];
  if (existing) {
    return state;
  }

  return {
    ...state,
    currentQuestionId: questionId,
    questionTimers: {
      ...state.questionTimers,
      [questionId]: {
        questionId,
        questionIndex,
        allocatedMs,
        consumedMs: 0,
        remainingMs: allocatedMs,
        isCompleted: false,
      },
    },
  };
}

/**
 * Updates the consumed and remaining time for a question by a delta (ms).
 * Clamps remaining time at zero.
 */
export function updateQuestionConsumedTime(
  state: IntegrityLedgerState,
  questionId: string,
  deltaMs: number
): IntegrityLedgerState {
  const record = state.questionTimers[questionId];
  if (!record || record.isCompleted) return state;

  const validDelta = Math.max(0, deltaMs);
  const newConsumed = record.consumedMs + validDelta;
  const newRemaining = Math.max(0, record.allocatedMs - newConsumed);

  return {
    ...state,
    questionTimers: {
      ...state.questionTimers,
      [questionId]: {
        ...record,
        consumedMs: newConsumed,
        remainingMs: newRemaining,
      },
    },
  };
}

/**
 * Sets explicit remaining time for a question (e.g. from live ticker sync).
 */
export function setQuestionRemainingTime(
  state: IntegrityLedgerState,
  questionId: string,
  remainingMs: number
): IntegrityLedgerState {
  const record = state.questionTimers[questionId];
  if (!record) return state;

  const clampedRemaining = Math.max(0, Math.min(record.allocatedMs, remainingMs));
  if (record.remainingMs === clampedRemaining) return state;
  const newConsumed = record.allocatedMs - clampedRemaining;

  return {
    ...state,
    questionTimers: {
      ...state.questionTimers,
      [questionId]: {
        ...record,
        consumedMs: newConsumed,
        remainingMs: clampedRemaining,
      },
    },
  };
}

/**
 * Marks a question timer as completed.
 */
export function markQuestionCompleted(
  state: IntegrityLedgerState,
  questionId: string
): IntegrityLedgerState {
  const record = state.questionTimers[questionId];
  if (!record) return state;

  return {
    ...state,
    questionTimers: {
      ...state.questionTimers,
      [questionId]: {
        ...record,
        isCompleted: true,
      },
    },
  };
}

/**
 * Pure reducer: applies an integrity violation or proctoring event to the ledger.
 * Applies deduplication within INTEGRITY_THRESHOLDS.VIOLATION_DEDUPE_MS.
 */
export function applyEvent(
  state: IntegrityLedgerState,
  input: {
    type: IntegrityEventType;
    pauseReason?: PauseReason;
    questionId?: string;
    questionIndex?: number;
    blocked?: boolean;
    details?: string;
    atMs?: number;
    id?: string;
  },
  nowEpochMs: number = Date.now()
): { state: IntegrityLedgerState; event: IntegrityEvent | null } {
  const atMs = input.atMs ?? Math.max(0, nowEpochMs - state.sessionStartEpochMs);

  // 1. Deduplication check (e.g. window_blur + tab_hidden firing simultaneously)
  const lastTs = state.lastViolationTimestampMs[input.type];
  if (lastTs !== undefined && atMs - lastTs < INTEGRITY_THRESHOLDS.VIOLATION_DEDUPE_MS) {
    return { state, event: null };
  }

  // Cross-deduplication: window_blur and tab_hidden within dedupe window
  if (input.type === 'window_blur') {
    const lastHidden = state.lastViolationTimestampMs['tab_hidden'];
    if (lastHidden !== undefined && atMs - lastHidden < INTEGRITY_THRESHOLDS.VIOLATION_DEDUPE_MS) {
      return { state, event: null };
    }
  }

  const event: IntegrityEvent = {
    id: input.id ?? generateEventId(input.type),
    type: input.type,
    atMs,
    questionId: input.questionId ?? state.currentQuestionId,
    questionIndex: input.questionIndex,
    pauseReason: input.pauseReason,
    blocked: input.blocked,
    details: input.details,
  };

  let nextActivePause = state.activePause;

  // 2. Handle pause initiation
  if (input.type === 'pause' && input.pauseReason) {
    if (!state.activePause) {
      nextActivePause = {
        pauseId: event.id,
        reason: input.pauseReason,
        startEpochMs: nowEpochMs,
        questionId: event.questionId,
        questionIndex: event.questionIndex,
      };
    }
  }

  const nextState: IntegrityLedgerState = {
    ...state,
    activePause: nextActivePause,
    events: [...state.events, event],
    lastViolationTimestampMs: {
      ...state.lastViolationTimestampMs,
      [input.type]: atMs,
    },
  };

  return { state: nextState, event };
}

/**
 * Closes an active pause and records its final duration.
 */
export function closePause(
  state: IntegrityLedgerState,
  nowEpochMs: number = Date.now()
): { state: IntegrityLedgerState; closedPauseEvent: IntegrityEvent | null; durationMs: number } {
  if (!state.activePause) {
    return { state, closedPauseEvent: null, durationMs: 0 };
  }

  const durationMs = Math.max(0, nowEpochMs - state.activePause.startEpochMs);
  const pauseId = state.activePause.pauseId;

  let closedEvent: IntegrityEvent | null = null;
  const updatedEvents = state.events.map((evt) => {
    if (evt.id === pauseId) {
      closedEvent = { ...evt, durationMs };
      return closedEvent;
    }
    return evt;
  });

  const nextState: IntegrityLedgerState = {
    ...state,
    activePause: null,
    events: updatedEvents,
  };

  return { state: nextState, closedPauseEvent: closedEvent, durationMs };
}

/**
 * Computes aggregate summary totals across all recorded integrity events.
 */
export function computeTotals(state: IntegrityLedgerState): SessionIntegrityTotals {
  let pauses = 0;
  let pausedMs = 0;
  let tabSwitches = 0;
  let fullscreenExits = 0;
  let copyPasteAttempts = 0;
  let screenshotKeyAttempts = 0;
  let navigationAttempts = 0;
  let reloads = 0;

  for (const ev of state.events) {
    switch (ev.type) {
      case 'pause':
        pauses += 1;
        if (ev.durationMs) pausedMs += ev.durationMs;
        break;
      case 'tab_hidden':
      case 'window_blur':
      case 'multi_tab':
        tabSwitches += 1;
        break;
      case 'fullscreen_exit':
        fullscreenExits += 1;
        break;
      case 'copy_attempt':
      case 'cut_attempt':
      case 'paste_attempt':
      case 'context_menu':
      case 'drag_attempt':
        copyPasteAttempts += 1;
        break;
      case 'screenshot_key':
      case 'print_attempt':
        screenshotKeyAttempts += 1;
        break;
      case 'navigation_attempt':
        navigationAttempts += 1;
        break;
      case 'session_reload':
        reloads += 1;
        break;
      default:
        break;
    }
  }

  // Account for currently active pause in totals if open
  if (state.activePause) {
    pauses += 1;
    pausedMs += Math.max(0, Date.now() - state.activePause.startEpochMs);
  }

  return {
    pauses,
    pausedMs,
    tabSwitches,
    fullscreenExits,
    copyPasteAttempts,
    screenshotKeyAttempts,
    navigationAttempts,
    reloads,
  };
}

/**
 * Builds the canonical SessionIntegrityReport ready for display and persistence.
 */
export function buildIntegrityReport(state: IntegrityLedgerState): SessionIntegrityReport {
  const totals = computeTotals(state);
  const verdict = evaluateIntegrityVerdict(totals);

  return {
    events: [...state.events],
    totals,
    verdict,
    policyVersion: INTEGRITY_POLICY_VERSION,
    limitationsNote: INTEGRITY_LIMITATIONS_NOTE,
  };
}

/**
 * Serializes the integrity ledger state to JSON string for sessionStorage persistence.
 */
export function serializeLedger(state: IntegrityLedgerState): string {
  return JSON.stringify(state);
}

/**
 * Restores the integrity ledger state from JSON string.
 * Validates integrity and schema shape. Returns null if corrupted.
 */
export function restoreLedger(serialized: string | null | undefined): IntegrityLedgerState | null {
  if (!serialized) return null;
  try {
    const parsed = JSON.parse(serialized);
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.sessionId !== 'string') return null;
    if (typeof parsed.sessionStartEpochMs !== 'number') return null;
    if (!Array.isArray(parsed.events)) return null;
    if (typeof parsed.questionTimers !== 'object') return null;

    return {
      sessionId: parsed.sessionId,
      sessionStartEpochMs: parsed.sessionStartEpochMs,
      activePause: parsed.activePause ?? null,
      events: parsed.events,
      questionTimers: parsed.questionTimers,
      currentQuestionId: parsed.currentQuestionId,
      lastViolationTimestampMs: parsed.lastViolationTimestampMs ?? {},
    };
  } catch {
    return null;
  }
}
