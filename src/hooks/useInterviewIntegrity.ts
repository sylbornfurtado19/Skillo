'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  IntegrityEventType,
  IntegrityLedgerState,
  PauseReason,
  SessionIntegrityReport,
} from '@/types/integrity';
import {
  createInitialLedgerState,
  applyEvent,
  closePause,
  buildIntegrityReport,
  registerQuestionTimer,
  setQuestionRemainingTime,
  serializeLedger,
  restoreLedger,
} from '@/lib/integrity/integrityLedger';

const INTEGRITY_STORAGE_KEY_PREFIX = 'skillo_integrity_ledger_';

export interface UseInterviewIntegrityOptions {
  sessionKey: string;
  activeQuestionId?: string;
  activeQuestionIndex?: number;
  devicesReady: boolean;
  isExamActive: boolean;
  onPauseTriggered?: (reason: PauseReason) => void;
  onResumeTriggered?: () => void;
}

export interface UseInterviewIntegrityReturn {
  isPaused: boolean;
  pauseReason: PauseReason | null;
  report: SessionIntegrityReport;
  remainingTimeSec: number;
  recordDevicePause: (reason: 'camera_off' | 'microphone_off' | 'permission_revoked') => void;
  recordManualViolation: (type: IntegrityEventType, pauseReason?: PauseReason) => void;
  resumeInterview: () => boolean;
  getReport: () => SessionIntegrityReport;
  getQuestionRemainingSec: (questionId: string, defaultDurationSec: number) => number;
  saveCurrentQuestionRemainingSec: (questionId: string, remainingSec: number) => void;
  startQuestionClock: (questionId: string, defaultDurationSec: number) => number;
}

export function useInterviewIntegrity({
  sessionKey,
  activeQuestionId = 'q0',
  activeQuestionIndex = 0,
  devicesReady,
  isExamActive,
  onPauseTriggered,
  onResumeTriggered,
}: UseInterviewIntegrityOptions): UseInterviewIntegrityReturn {
  const sessionStartTsRef = useRef<number>(Date.now());
  const storageKey = `${INTEGRITY_STORAGE_KEY_PREFIX}${sessionKey}`;

  // 1. Initialize or restore ledger state from sessionStorage (D4)
  const [ledger, setLedger] = useState<IntegrityLedgerState>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem(storageKey);
        if (stored) {
          const restored = restoreLedger(stored);
          if (restored) {
            // Log session reload on restore
            const { state: reloadedState } = applyEvent(
              {
                ...restored,
                activePause: null,
              },
              {
                type: 'session_reload',
                pauseReason: 'session_reload',
                questionId: activeQuestionId,
                questionIndex: activeQuestionIndex,
                blocked: false,
              },
              Date.now()
            );
            return reloadedState;
          }
        }
      } catch {
        // Fallback to fresh ledger
      }
    }
    return createInitialLedgerState(sessionKey, sessionStartTsRef.current);
  });

  const ledgerRef = useRef<IntegrityLedgerState>(ledger);
  ledgerRef.current = ledger;

  // Sync ledger to sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(storageKey, serializeLedger(ledger));
    } catch {
      // Storage quota safety
    }
  }, [ledger, storageKey]);

  const activeQuestionIdRef = useRef(activeQuestionId);
  activeQuestionIdRef.current = activeQuestionId;
  const activeQuestionIndexRef = useRef(activeQuestionIndex);
  activeQuestionIndexRef.current = activeQuestionIndex;

  // Dispatch a violation to the ledger
  const recordViolation = useCallback(
    (
      type: IntegrityEventType,
      pauseReason?: PauseReason,
      blocked = true
    ) => {
      const nowEpochMs = Date.now();
      setLedger((prev: IntegrityLedgerState) => {
        // If pause is specified, record the specific violation event first, then the pause event
        let intermediate = prev;
        if (pauseReason) {
          const { state: afterEvent } = applyEvent(
            intermediate,
            {
              type,
              questionId: activeQuestionIdRef.current,
              questionIndex: activeQuestionIndexRef.current,
              blocked,
            },
            nowEpochMs
          );
          intermediate = afterEvent;

          const { state: afterPause } = applyEvent(
            intermediate,
            {
              type: 'pause',
              pauseReason,
              questionId: activeQuestionIdRef.current,
              questionIndex: activeQuestionIndexRef.current,
              blocked,
            },
            nowEpochMs
          );
          if (!prev.activePause) {
            onPauseTriggered?.(pauseReason);
          }
          return afterPause;
        }

        const { state: next } = applyEvent(
          intermediate,
          {
            type,
            questionId: activeQuestionIdRef.current,
            questionIndex: activeQuestionIndexRef.current,
            blocked,
          },
          nowEpochMs
        );
        return next;
      });
    },
    [onPauseTriggered]
  );

  // Manual pause triggered by device disconnection
  const recordDevicePause = useCallback(
    (reason: 'camera_off' | 'microphone_off' | 'permission_revoked') => {
      const nowEpochMs = Date.now();
      setLedger((prev: IntegrityLedgerState) => {
        if (prev.activePause?.reason === reason) return prev;
        const { state: next } = applyEvent(
          prev,
          {
            type: 'pause',
            pauseReason: reason,
            questionId: activeQuestionIdRef.current,
            questionIndex: activeQuestionIndexRef.current,
            blocked: true,
          },
          nowEpochMs
        );
        onPauseTriggered?.(reason);
        return next;
      });
    },
    [onPauseTriggered]
  );

  // Resume interview action
  const resumeInterview = useCallback((): boolean => {
    const currentPause = ledgerRef.current.activePause?.reason;
    if (
      (currentPause === 'camera_off' ||
        currentPause === 'microphone_off' ||
        currentPause === 'permission_revoked') &&
      !devicesReady
    ) {
      return false;
    }

    if (typeof document !== 'undefined' && document.hidden) {
      return false;
    }

    const nowEpochMs = Date.now();
    setLedger((prev: IntegrityLedgerState) => {
      if (!prev.activePause) return prev;
      const { state: next } = closePause(prev, nowEpochMs);
      onResumeTriggered?.();
      return next;
    });
    return true;
  }, [devicesReady, onResumeTriggered]);

  // 2. Attach DOM Event Deterrence & Detection Listeners
  useEffect(() => {
    if (!isExamActive || typeof window === 'undefined') return;

    // A. Visibility & Tab Change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordViolation('tab_hidden', 'tab_hidden', false);
      }
    };

    // B. Window Blur (deduped with visibilitychange)
    const handleWindowBlur = () => {
      recordViolation('window_blur', 'window_blur', false);
    };

    // C. Fullscreen Exit
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        recordViolation('fullscreen_exit', 'fullscreen_exit', false);
      }
    };

    // D. Print Attempt (beforeprint)
    const handleBeforePrint = (e: Event) => {
      e.preventDefault();
      recordViolation('print_attempt', undefined, true);
    };

    // E. Copy, Cut, Paste Interceptions
    const handleCopy = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[data-secure="content"]')) {
        e.preventDefault();
        recordViolation('copy_attempt', undefined, true);
      }
    };

    const handleCut = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[data-secure="content"]')) {
        e.preventDefault();
        recordViolation('cut_attempt', undefined, true);
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Per O2: Paste into answer box is deterred/blocked and logged
      if (target?.closest?.('[data-secure="input"]')) {
        e.preventDefault();
        recordViolation('paste_attempt', undefined, true);
      } else if (target?.closest?.('[data-secure="content"]')) {
        e.preventDefault();
        recordViolation('paste_attempt', undefined, true);
      }
    };

    // F. Context Menu (Right Click)
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[data-secure="content"]')) {
        e.preventDefault();
        recordViolation('context_menu', undefined, true);
      }
    };

    // G. Drag & Select Interceptions on Question Content
    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[data-secure="content"]')) {
        e.preventDefault();
        recordViolation('drag_attempt', undefined, true);
      }
    };

    const handleSelectStart = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[data-secure="content"]')) {
        e.preventDefault();
      }
    };

    // H. Keyboard Hotkeys (PrintScreen, Ctrl+P, Ctrl+S, Ctrl+C on secure content, Mac shortcuts)
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Screenshot Keys
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        recordViolation('screenshot_key', undefined, false);
      }

      // 2. Print (Ctrl+P / Cmd+P)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        recordViolation('print_attempt', undefined, true);
      }

      // 3. Save Webpage (Ctrl+S / Cmd+S)
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        recordViolation('copy_attempt', undefined, true);
      }

      // 4. macOS screenshot hotkeys: Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5
      if (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key)) {
        recordViolation('screenshot_key', undefined, false);
      }
    };

    // I. BroadcastChannel Single-Interview Lock
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(`skillo_exam_lock_${sessionKey}`);
      channel.onmessage = (event) => {
        if (event.data === 'NEW_TAB_JOIN') {
          recordViolation('multi_tab', 'multi_tab', false);
        }
      };
      channel.postMessage('NEW_TAB_JOIN');
    } catch {
      // Fallback for older browsers
    }

    // J. Camera permission status listener
    let permStatus: PermissionStatus | null = null;
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'camera' as PermissionName })
        .then((status) => {
          permStatus = status;
          status.onchange = () => {
            if (status.state === 'denied') {
              recordDevicePause('permission_revoked');
            }
          };
        })
        .catch(() => {
          // Permissions query not supported for camera in some browsers
        });
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('beforeprint', handleBeforePrint);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('selectstart', handleSelectStart);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('beforeprint', handleBeforePrint);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('selectstart', handleSelectStart);
      window.removeEventListener('keydown', handleKeyDown);
      channel?.close();
      if (permStatus) permStatus.onchange = null;
    };
  }, [isExamActive, recordViolation, recordDevicePause, sessionKey]);

  // 3. Question Timer Ledger Functions (D3 & D4)
  const getQuestionRemainingSec = useCallback(
    (questionId: string, defaultDurationSec: number): number => {
      const record = ledgerRef.current.questionTimers[questionId];
      if (!record) {
        return defaultDurationSec;
      }
      return Math.max(0, Math.ceil(record.remainingMs / 1000));
    },
    []
  );

  const startQuestionClock = useCallback(
    (questionId: string, defaultDurationSec: number): number => {
      setLedger((prev: IntegrityLedgerState) => {
        return registerQuestionTimer(
          prev,
          questionId,
          activeQuestionIndexRef.current,
          defaultDurationSec * 1000
        );
      });
      return getQuestionRemainingSec(questionId, defaultDurationSec);
    },
    [getQuestionRemainingSec]
  );

  const saveCurrentQuestionRemainingSec = useCallback(
    (questionId: string, remainingSec: number) => {
      setLedger((prev: IntegrityLedgerState) => {
        return setQuestionRemainingTime(prev, questionId, remainingSec * 1000);
      });
    },
    []
  );

  const getReport = useCallback(() => {
    return buildIntegrityReport(ledgerRef.current);
  }, []);

  return {
    isPaused: ledger.activePause !== null,
    pauseReason: ledger.activePause ? ledger.activePause.reason : null,
    report: buildIntegrityReport(ledger),
    remainingTimeSec: getQuestionRemainingSec(activeQuestionId, 120),
    recordDevicePause,
    recordManualViolation: (type, pauseReason) => recordViolation(type, pauseReason, true),
    resumeInterview,
    getReport,
    getQuestionRemainingSec,
    saveCurrentQuestionRemainingSec,
    startQuestionClock,
  };
}
