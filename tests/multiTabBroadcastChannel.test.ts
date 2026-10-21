/**
 * tests/multiTabBroadcastChannel.test.ts
 *
 * ISSUE-10: Unauthenticated multi-tab BroadcastChannel message hardening.
 *
 * Verifies:
 * 1. isMultiTabBroadcastMessage type guard correctly identifies valid structured payloads
 *    and rejects raw strings, malformed objects, missing properties, and invalid types.
 * 2. BroadcastChannel multi-tab lock logic:
 *    - Valid join from a second tab -> triggers multi_tab violation in the first tab.
 *    - Raw 'NEW_TAB_JOIN' string -> ignored.
 *    - Own tabId -> ignored (tab must not flag itself).
 *    - Malformed payload -> ignored.
 *    - Different sessionKey -> ignored.
 *    - Cleanup: BroadcastChannel is closed on unmount.
 *    - React StrictMode double-mount simulation does not trigger a self-violation.
 */

import {
  isMultiTabBroadcastMessage,
  generateTabId,
  type MultiTabBroadcastMessage,
} from '../src/hooks/useInterviewIntegrity';

describe('ISSUE-10: isMultiTabBroadcastMessage type guard', () => {
  it('returns true for a valid structured MultiTabBroadcastMessage', () => {
    const valid: MultiTabBroadcastMessage = {
      type: 'NEW_TAB_JOIN',
      tabId: 'tab_uuid_12345',
      sessionKey: 'session_abc_789',
    };
    expect(isMultiTabBroadcastMessage(valid)).toBe(true);
  });

  it('rejects raw string "NEW_TAB_JOIN"', () => {
    expect(isMultiTabBroadcastMessage('NEW_TAB_JOIN')).toBe(false);
  });

  it('rejects null, undefined, and non-object primitives', () => {
    expect(isMultiTabBroadcastMessage(null)).toBe(false);
    expect(isMultiTabBroadcastMessage(undefined)).toBe(false);
    expect(isMultiTabBroadcastMessage(12345)).toBe(false);
    expect(isMultiTabBroadcastMessage(true)).toBe(false);
    expect(isMultiTabBroadcastMessage(['NEW_TAB_JOIN'])).toBe(false);
  });

  it('rejects empty and malformed objects', () => {
    expect(isMultiTabBroadcastMessage({})).toBe(false);
    expect(isMultiTabBroadcastMessage({ type: 'NEW_TAB_JOIN' })).toBe(false);
    expect(isMultiTabBroadcastMessage({ tabId: 'tab_1', sessionKey: 'sess_1' })).toBe(false);
    expect(isMultiTabBroadcastMessage({ type: 'OTHER_TYPE', tabId: 'tab_1', sessionKey: 'sess_1' })).toBe(false);
    expect(isMultiTabBroadcastMessage({ type: 'NEW_TAB_JOIN', tabId: '', sessionKey: 'sess_1' })).toBe(false);
    expect(isMultiTabBroadcastMessage({ type: 'NEW_TAB_JOIN', tabId: '   ', sessionKey: 'sess_1' })).toBe(false);
    expect(isMultiTabBroadcastMessage({ type: 'NEW_TAB_JOIN', tabId: 'tab_1', sessionKey: '' })).toBe(false);
    expect(isMultiTabBroadcastMessage({ type: 'NEW_TAB_JOIN', tabId: 123, sessionKey: 'sess_1' })).toBe(false);
  });
});

describe('ISSUE-10: generateTabId helper', () => {
  it('produces unique non-empty string IDs for each tab', () => {
    const id1 = generateTabId();
    const id2 = generateTabId();
    expect(typeof id1).toBe('string');
    expect(typeof id2).toBe('string');
    expect(id1.length).toBeGreaterThan(0);
    expect(id2.length).toBeGreaterThan(0);
    expect(id1).not.toBe(id2);
  });
});

describe('ISSUE-10: Multi-tab BroadcastChannel receiver logic & regression tests', () => {
  // Mock BroadcastChannel simulator to emulate multi-tab browser messaging
  class MockBroadcastChannel {
    name: string;
    onmessage: ((event: MessageEvent) => void) | null = null;
    closed: boolean = false;
    static channels: Map<string, Set<MockBroadcastChannel>> = new Map();

    constructor(name: string) {
      this.name = name;
      if (!MockBroadcastChannel.channels.has(name)) {
        MockBroadcastChannel.channels.set(name, new Set());
      }
      MockBroadcastChannel.channels.get(name)!.add(this);
    }

    postMessage(data: unknown) {
      if (this.closed) return;
      const peers = MockBroadcastChannel.channels.get(this.name);
      if (!peers) return;
      for (const peer of peers) {
        if (peer !== this && !peer.closed && peer.onmessage) {
          peer.onmessage({ data } as MessageEvent);
        }
      }
    }

    close() {
      this.closed = true;
      const peers = MockBroadcastChannel.channels.get(this.name);
      if (peers) {
        peers.delete(this);
      }
    }

    static resetAll() {
      MockBroadcastChannel.channels.clear();
    }
  }

  // Harness that replicates the BroadcastChannel lifecycle in useInterviewIntegrity
  function createTabInstance(sessionKey: string, providedTabId?: string) {
    const tabId = providedTabId || generateTabId();
    const violations: Array<{ type: string; reason?: string }> = [];

    const channel = new MockBroadcastChannel(`skillo_exam_lock_${sessionKey}`);
    channel.onmessage = (event: MessageEvent) => {
      if (!isMultiTabBroadcastMessage(event.data)) {
        return;
      }
      if (event.data.tabId === tabId) {
        return; // Ignore own tab broadcasts
      }
      if (event.data.sessionKey !== sessionKey) {
        return; // Ignore messages from mismatched sessions
      }
      violations.push({ type: 'multi_tab', reason: 'multi_tab' });
    };

    // Announce this tab's join
    channel.postMessage({
      type: 'NEW_TAB_JOIN',
      tabId,
      sessionKey,
    } satisfies MultiTabBroadcastMessage);

    return {
      tabId,
      channel,
      violations,
      unmount: () => channel.close(),
    };
  }

  beforeEach(() => {
    MockBroadcastChannel.resetAll();
  });

  it('opening a genuine second tab triggers the multi_tab violation in the first tab', () => {
    const sessionKey = 'exam_session_101';
    const tab1 = createTabInstance(sessionKey);
    expect(tab1.violations).toHaveLength(0);

    // Open second tab in same interview session
    const tab2 = createTabInstance(sessionKey);

    // Tab 1 must detect Tab 2's join and record violation
    expect(tab1.violations).toHaveLength(1);
    expect(tab1.violations[0]).toEqual({ type: 'multi_tab', reason: 'multi_tab' });

    // Tab 2 should not flag itself from its own join announcement
    expect(tab2.violations).toHaveLength(0);

    tab1.unmount();
    tab2.unmount();
  });

  it('a tab must not flag itself if its own message is received', () => {
    const sessionKey = 'exam_session_102';
    const tab = createTabInstance(sessionKey);

    // Emulate a loopback or polyfill delivery of the tab's own message
    tab.channel.onmessage!({
      data: {
        type: 'NEW_TAB_JOIN',
        tabId: tab.tabId,
        sessionKey,
      },
    } as MessageEvent);

    expect(tab.violations).toHaveLength(0);
    tab.unmount();
  });

  it('ignores raw "NEW_TAB_JOIN" string messages without structured authentication', () => {
    const sessionKey = 'exam_session_103';
    const tab = createTabInstance(sessionKey);

    // Naive raw string injection
    tab.channel.onmessage!({
      data: 'NEW_TAB_JOIN',
    } as MessageEvent);

    expect(tab.violations).toHaveLength(0);
    tab.unmount();
  });

  it('ignores malformed object payloads', () => {
    const sessionKey = 'exam_session_104';
    const tab = createTabInstance(sessionKey);

    tab.channel.onmessage!({ data: {} } as MessageEvent);
    tab.channel.onmessage!({ data: { type: 'NEW_TAB_JOIN' } } as MessageEvent);
    tab.channel.onmessage!({ data: { type: 'NEW_TAB_JOIN', tabId: 'other' } } as MessageEvent);
    tab.channel.onmessage!({ data: { type: 'OTHER', tabId: 'other', sessionKey } } as MessageEvent);
    tab.channel.onmessage!({ data: null } as MessageEvent);
    tab.channel.onmessage!({ data: undefined } as MessageEvent);

    expect(tab.violations).toHaveLength(0);
    tab.unmount();
  });

  it('ignores messages from a different sessionKey', () => {
    const tab = createTabInstance('session_A');

    tab.channel.onmessage!({
      data: {
        type: 'NEW_TAB_JOIN',
        tabId: 'tab_different',
        sessionKey: 'session_B',
      },
    } as MessageEvent);

    expect(tab.violations).toHaveLength(0);
    tab.unmount();
  });

  it('closes channel on unmount/cleanup', () => {
    const sessionKey = 'exam_session_105';
    const tab = createTabInstance(sessionKey);
    expect(tab.channel.closed).toBe(false);

    tab.unmount();
    expect(tab.channel.closed).toBe(true);
    expect(MockBroadcastChannel.channels.get(`skillo_exam_lock_${sessionKey}`)?.size).toBe(0);
  });

  it('React strict-mode double-mount does not produce a self-violation', () => {
    const sessionKey = 'exam_session_106';
    const sharedTabId = generateTabId();

    // First mount in strict mode
    const mount1 = createTabInstance(sessionKey, sharedTabId);
    expect(mount1.violations).toHaveLength(0);

    // Strict mode cleanup
    mount1.unmount();
    expect(mount1.channel.closed).toBe(true);

    // Second mount in strict mode (shares same tabIdRef across double-mount)
    const mount2 = createTabInstance(sessionKey, sharedTabId);
    expect(mount2.violations).toHaveLength(0);

    // If mount1 received mount2's message, tabId matches so mount1/mount2 ignore it
    mount2.channel.onmessage!({
      data: {
        type: 'NEW_TAB_JOIN',
        tabId: sharedTabId,
        sessionKey,
      },
    } as MessageEvent);
    expect(mount2.violations).toHaveLength(0);

    mount2.unmount();
  });
});
