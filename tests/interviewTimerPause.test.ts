import {
  createInitialLedgerState,
  registerQuestionTimer,
  updateQuestionConsumedTime,
  setQuestionRemainingTime,
  applyEvent,
  closePause,
  serializeLedger,
  restoreLedger,
} from '../src/lib/integrity/integrityLedger';

describe('Interview Timer Pause & Anti-Exploit Accounting (D3, D4)', () => {
  const sessionId = 'session-timer-audit';
  const startEpoch = 1000000;
  const questionDurationMs = 60000; // 60s allocated per question

  it('preserves exact remaining time through pause and resume without resetting', () => {
    let state = createInitialLedgerState(sessionId, startEpoch);
    state = registerQuestionTimer(state, 'q1', 0, questionDurationMs);

    // 1. Candidate speaks for 25,000ms
    state = updateQuestionConsumedTime(state, 'q1', 25000);
    expect(state.questionTimers['q1'].consumedMs).toBe(25000);
    expect(state.questionTimers['q1'].remainingMs).toBe(35000);

    // 2. Camera unplugs -> Pause triggers
    const pauseTime = startEpoch + 25000;
    state = applyEvent(
      state,
      { type: 'pause', pauseReason: 'camera_off', questionId: 'q1', questionIndex: 0 },
      pauseTime
    ).state;
    expect(state.activePause).not.toBeNull();

    // 3. 15,000ms pass while paused
    const resumeTime = pauseTime + 15000;
    state = closePause(state, resumeTime).state;
    expect(state.activePause).toBeNull();

    // Remaining time MUST still be 35,000ms (not reset to 60,000ms!)
    expect(state.questionTimers['q1'].remainingMs).toBe(35000);

    // 4. Candidate finishes the remaining 35,000ms
    state = updateQuestionConsumedTime(state, 'q1', 35000);
    expect(state.questionTimers['q1'].remainingMs).toBe(0);
    expect(state.questionTimers['q1'].consumedMs).toBe(60000);
  });

  it('prevents camera unplug/replug exploit from granting indefinite time', () => {
    let state = createInitialLedgerState(sessionId, startEpoch);
    state = registerQuestionTimer(state, 'q1', 0, questionDurationMs);

    let currentTime = startEpoch;

    // Simulate attacker repeatedly unplugging camera 5 times
    for (let cycle = 0; cycle < 5; cycle++) {
      // Work for 10 seconds
      state = updateQuestionConsumedTime(state, 'q1', 10000);
      currentTime += 10000;

      // Disconnect camera
      state = applyEvent(
        state,
        { type: 'pause', pauseReason: 'camera_off', questionId: 'q1', questionIndex: 0 },
        currentTime
      ).state;
      currentTime += 5000; // 5s disconnected

      // Reconnect
      state = closePause(state, currentTime).state;
    }

    // After 5 cycles of 10s work, exactly 50s must be consumed, with only 10s remaining!
    expect(state.questionTimers['q1'].consumedMs).toBe(50000);
    expect(state.questionTimers['q1'].remainingMs).toBe(10000);
  });

  it('prevents Prev/Next question navigation from resetting question time (D3)', () => {
    let state = createInitialLedgerState(sessionId, startEpoch);
    state = registerQuestionTimer(state, 'q1', 0, questionDurationMs);
    state = registerQuestionTimer(state, 'q2', 1, questionDurationMs);

    // Spends 40s on Q1
    state = updateQuestionConsumedTime(state, 'q1', 40000);
    expect(state.questionTimers['q1'].remainingMs).toBe(20000);

    // Moves to Q2, spends 15s
    state = updateQuestionConsumedTime(state, 'q2', 15000);
    expect(state.questionTimers['q2'].remainingMs).toBe(45000);

    // Returns to Q1 -> time on Q1 MUST NOT reset to 60,000ms
    state = registerQuestionTimer(state, 'q1', 0, questionDurationMs);
    expect(state.questionTimers['q1'].remainingMs).toBe(20000);
    expect(state.questionTimers['q1'].consumedMs).toBe(40000);

    // Spends another 10s on Q1
    state = updateQuestionConsumedTime(state, 'q1', 10000);
    expect(state.questionTimers['q1'].remainingMs).toBe(10000);
    expect(state.questionTimers['q1'].consumedMs).toBe(50000);
  });

  it('restores remaining time intact on browser reload and logs reload event (D4)', () => {
    let state = createInitialLedgerState(sessionId, startEpoch);
    state = registerQuestionTimer(state, 'q1', 0, questionDurationMs);
    state = updateQuestionConsumedTime(state, 'q1', 22000);

    // Persist to session storage simulation
    const serialized = serializeLedger(state);

    // Browser reloads
    const restored = restoreLedger(serialized);
    expect(restored).not.toBeNull();
    if (!restored) return;

    expect(restored.questionTimers['q1'].remainingMs).toBe(38000);
    expect(restored.questionTimers['q1'].consumedMs).toBe(22000);

    // Log the reload event into the restored ledger
    const reloadTime = startEpoch + 25000;
    const { state: updatedState, event } = applyEvent(
      restored,
      { type: 'session_reload', details: 'Browser page refreshed mid-interview' },
      reloadTime
    );

    expect(event?.type).toBe('session_reload');
    expect(updatedState.events.some((e) => e.type === 'session_reload')).toBe(true);
    expect(updatedState.questionTimers['q1'].remainingMs).toBe(38000);
  });
});
