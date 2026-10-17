/**
 * Skillo AI - Session Integrity & Proctoring Types
 * ====================================================================
 * Data contracts for mid-interview event tracking, pause accounting,
 * deduplication, and honest limitation disclosure.
 */

export type IntegrityEventType =
  | 'pause'
  | 'copy_attempt'
  | 'cut_attempt'
  | 'paste_attempt'
  | 'context_menu'
  | 'screenshot_key'
  | 'print_attempt'
  | 'drag_attempt'
  | 'tab_hidden'
  | 'window_blur'
  | 'fullscreen_exit'
  | 'fullscreen_unavailable'
  | 'navigation_attempt'
  | 'multi_tab'
  | 'session_reload'
  | 'permission_revoked';

export type PauseReason =
  | 'camera_off'
  | 'microphone_off'
  | 'permission_revoked'
  | 'tab_hidden'
  | 'window_blur'
  | 'fullscreen_exit'
  | 'navigation_attempt'
  | 'multi_tab'
  | 'session_reload';

export interface IntegrityEvent {
  id: string;
  type: IntegrityEventType;
  atMs: number; // ms since session start
  questionId?: string;
  questionIndex?: number;
  pauseReason?: PauseReason;
  durationMs?: number; // set when a pause closes
  blocked?: boolean; // true if the action was prevented, false if only detected
  details?: string;
}

export type IntegrityVerdict = 'clean' | 'minor_flags' | 'flagged';

export interface SessionIntegrityTotals {
  pauses: number;
  pausedMs: number;
  tabSwitches: number;
  fullscreenExits: number;
  copyPasteAttempts: number;
  screenshotKeyAttempts: number;
  navigationAttempts: number;
  reloads: number;
}

export interface SessionIntegrityReport {
  events: IntegrityEvent[];
  totals: SessionIntegrityTotals;
  verdict: IntegrityVerdict;
  policyVersion: string;
  limitationsNote: string; // fixed honest sentence
}

export interface QuestionTimerRecord {
  questionId: string;
  questionIndex: number;
  allocatedMs: number;
  consumedMs: number;
  remainingMs: number;
  isCompleted: boolean;
}

export interface IntegrityLedgerState {
  sessionId: string;
  sessionStartEpochMs: number;
  activePause: {
    pauseId: string;
    reason: PauseReason;
    startEpochMs: number;
    questionId?: string;
    questionIndex?: number;
  } | null;
  events: IntegrityEvent[];
  questionTimers: Record<string, QuestionTimerRecord>;
  currentQuestionId?: string;
  lastViolationTimestampMs: Record<string, number>;
}
