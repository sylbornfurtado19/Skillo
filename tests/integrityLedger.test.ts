import {
  createInitialLedgerState,
  applyEvent,
  closePause,
  computeTotals,
  buildIntegrityReport,
  serializeLedger,
  restoreLedger,
} from '../src/lib/integrity/integrityLedger';

describe('Integrity Ledger & Event Reducer', () => {
  const sessionId = 'test-session-123';
  const startEpoch = 1000000;

  it('creates clean initial ledger state', () => {
    const state = createInitialLedgerState(sessionId, startEpoch);
    expect(state.sessionId).toBe(sessionId);
    expect(state.sessionStartEpochMs).toBe(startEpoch);
    expect(state.activePause).toBeNull();
    expect(state.events).toHaveLength(0);
  });

  it('records an event and computes relative atMs', () => {
    const state = createInitialLedgerState(sessionId, startEpoch);
    const { state: s1, event } = applyEvent(
      state,
      { type: 'copy_attempt', questionId: 'q1', questionIndex: 0, blocked: true },
      startEpoch + 5000
    );

    expect(event).not.toBeNull();
    expect(event?.atMs).toBe(5000);
    expect(event?.type).toBe('copy_attempt');
    expect(event?.blocked).toBe(true);
    expect(s1.events).toHaveLength(1);
  });

  it('deduplicates identical violation events within dedupe window (1000ms)', () => {
    const state = createInitialLedgerState(sessionId, startEpoch);
    const { state: s1, event: e1 } = applyEvent(
      state,
      { type: 'tab_hidden' },
      startEpoch + 1000
    );
    expect(e1).not.toBeNull();

    // Second event 200ms later -> must be deduplicated
    const { state: s2, event: e2 } = applyEvent(
      s1,
      { type: 'tab_hidden' },
      startEpoch + 1200
    );
    expect(e2).toBeNull();
    expect(s2.events).toHaveLength(1);

    // Third event 1500ms later -> allowed
    const { state: s3, event: e3 } = applyEvent(
      s2,
      { type: 'tab_hidden' },
      startEpoch + 2700
    );
    expect(e3).not.toBeNull();
    expect(s3.events).toHaveLength(2);
  });

  it('cross-deduplicates window_blur when preceded by tab_hidden', () => {
    const state = createInitialLedgerState(sessionId, startEpoch);
    const { state: s1 } = applyEvent(state, { type: 'tab_hidden' }, startEpoch + 1000);

    // Simultaneous window_blur at +100ms
    const { state: s2, event: blurEvt } = applyEvent(s1, { type: 'window_blur' }, startEpoch + 1100);
    expect(blurEvt).toBeNull();
    expect(s2.events).toHaveLength(1);
  });

  it('tracks active pause and calculates closed pause duration accurately', () => {
    const state = createInitialLedgerState(sessionId, startEpoch);
    const { state: s1, event: pauseEvt } = applyEvent(
      state,
      { type: 'pause', pauseReason: 'camera_off', questionId: 'q2', questionIndex: 1 },
      startEpoch + 10000
    );

    expect(s1.activePause).not.toBeNull();
    expect(s1.activePause?.reason).toBe('camera_off');
    expect(s1.activePause?.startEpochMs).toBe(startEpoch + 10000);

    // Close pause after 4500ms
    const { state: s2, closedPauseEvent, durationMs } = closePause(s1, startEpoch + 14500);
    expect(s2.activePause).toBeNull();
    expect(durationMs).toBe(4500);
    expect(closedPauseEvent?.id).toBe(pauseEvt?.id);
    expect(closedPauseEvent?.durationMs).toBe(4500);

    const pauseRecord = s2.events.find((e) => e.type === 'pause');
    expect(pauseRecord?.durationMs).toBe(4500);
  });

  it('safely handles closePause when not currently paused', () => {
    const state = createInitialLedgerState(sessionId, startEpoch);
    const { state: s1, closedPauseEvent, durationMs } = closePause(state, startEpoch + 1000);
    expect(closedPauseEvent).toBeNull();
    expect(durationMs).toBe(0);
    expect(s1).toEqual(state);
  });

  it('computes accurate integrity totals across multiple event types', () => {
    let state = createInitialLedgerState(sessionId, startEpoch);
    state = applyEvent(state, { type: 'copy_attempt' }, startEpoch + 1000).state;
    state = applyEvent(state, { type: 'paste_attempt' }, startEpoch + 3000).state;
    state = applyEvent(state, { type: 'tab_hidden' }, startEpoch + 5000).state;
    state = applyEvent(state, { type: 'fullscreen_exit' }, startEpoch + 7000).state;
    state = applyEvent(state, { type: 'pause', pauseReason: 'tab_hidden' }, startEpoch + 8000).state;
    state = closePause(state, startEpoch + 12000).state; // 4000ms pause

    const totals = computeTotals(state);
    expect(totals.copyPasteAttempts).toBe(2);
    expect(totals.tabSwitches).toBe(1);
    expect(totals.fullscreenExits).toBe(1);
    expect(totals.pauses).toBe(1);
    expect(totals.pausedMs).toBe(4000);
  });

  it('builds canonical integrity report with policy version and honest disclaimer', () => {
    const state = createInitialLedgerState(sessionId, startEpoch);
    const report = buildIntegrityReport(state);
    expect(report.verdict).toBe('clean');
    expect(report.policyVersion).toBe('1.0.0');
    expect(report.limitationsNote).toContain('cannot be prevented');
    expect(report.totals.pauses).toBe(0);
  });

  it('serializes and restores ledger state losslessly', () => {
    let state = createInitialLedgerState(sessionId, startEpoch);
    state = applyEvent(state, { type: 'screenshot_key' }, startEpoch + 2000).state;

    const serialized = serializeLedger(state);
    const restored = restoreLedger(serialized);

    expect(restored).not.toBeNull();
    expect(restored?.sessionId).toBe(sessionId);
    expect(restored?.events).toHaveLength(1);
    expect(restored?.events[0].type).toBe('screenshot_key');
  });

  it('rejects corrupted or invalid serialization strings', () => {
    expect(restoreLedger(null)).toBeNull();
    expect(restoreLedger('')).toBeNull();
    expect(restoreLedger('not-a-json')).toBeNull();
    expect(restoreLedger('{"invalid":"object"}')).toBeNull();
  });
});
