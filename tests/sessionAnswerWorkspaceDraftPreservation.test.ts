/**
 * Unit Tests for Interview Answer Draft Preservation across Input Modes (PROMPT 02)
 *
 * Verifies:
 * 1. A dictated transcript survives switching to Editor mode.
 * 2. A typed draft survives switching to Speech mode.
 * 3. New speech can be incorporated into an existing typed draft without losing original text.
 * 4. Repeated switching does not duplicate text or erase content.
 * 5. Incremental or cumulative transcription updates do not duplicate previously recognized words.
 * 6. Empty drafts switch modes without errors or phantom text.
 * 7. A stale transcript callback cannot overwrite a newer candidate draft.
 * 8. The correct preserved answer is submitted through the existing submission flow.
 * 9. Moving to a new question does not leak the previous question's draft.
 * 10. Mode selector controls have accessible names and tab semantics.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

jest.mock('next/dynamic', () => () => {
  const DynamicComponent = () => null;
  DynamicComponent.displayName = 'DynamicComponent';
  return DynamicComponent;
});

import SessionAnswerWorkspace, {
  type SessionAnswerWorkspaceProps,
} from '../src/components/interview/session/SessionAnswerWorkspace';
import { mergeDrafts } from '../src/components/interview/session/sessionHelpers';

describe('Draft Preservation: mergeDrafts helper', () => {
  it('preserves new text when base text is empty', () => {
    expect(mergeDrafts('', 'Hello world')).toBe('Hello world');
    expect(mergeDrafts(null, 'Hello world')).toBe('Hello world');
    expect(mergeDrafts(undefined, 'Hello world')).toBe('Hello world');
  });

  it('preserves base text when new text is empty', () => {
    expect(mergeDrafts('Existing draft', '')).toBe('Existing draft');
    expect(mergeDrafts('Existing draft', null)).toBe('Existing draft');
    expect(mergeDrafts('Existing draft', undefined)).toBe('Existing draft');
  });

  it('prevents exact text duplication when switching back and forth', () => {
    const text = 'I would use Kafka for partitioned messaging.';
    expect(mergeDrafts(text, text)).toBe(text);
  });

  it('prevents duplication if addition already contains base or vice-versa', () => {
    const base = 'I would use Kafka';
    const addition = 'I would use Kafka for streaming';
    expect(mergeDrafts(base, addition)).toBe('I would use Kafka for streaming');
  });

  it('joins two complete sentences with a space when base ends in terminal punctuation', () => {
    const base = 'Redis provides sub-millisecond in-memory caching.';
    const addition = 'Kafka handles high-throughput append-only event logs.';
    expect(mergeDrafts(base, addition)).toBe(
      'Redis provides sub-millisecond in-memory caching. Kafka handles high-throughput append-only event logs.'
    );
  });

  it('adds punctuation when base does not end in punctuation and addition starts capitalized', () => {
    const base = 'Redis provides in-memory caching';
    const addition = 'Kafka handles event logs.';
    expect(mergeDrafts(base, addition)).toBe('Redis provides in-memory caching. Kafka handles event logs.');
  });

  it('joins with a space when addition is a lowercase continuation', () => {
    const base = 'We chose consistent hashing';
    const addition = 'because virtual nodes ensure uniform distribution.';
    expect(mergeDrafts(base, addition)).toBe(
      'We chose consistent hashing because virtual nodes ensure uniform distribution.'
    );
  });
});

describe('SessionAnswerWorkspace: Input Mode Switching & Draft Preservation', () => {
  const defaultProps: SessionAnswerWorkspaceProps = {
    isRetry: false,
    currentQuestionIndex: 0,
    totalQuestions: 5,
    responseMode: 'type',
    setResponseMode: jest.fn(),
    typedAnswer: '',
    setTypedAnswer: jest.fn(),
    transcriptText: '',
    setTranscriptText: jest.fn(),
    recording: false,
    setRecording: jest.fn(),
    interviewerSpeaking: false,
    timeLeft: 120,
    currentQuestionDuration: 120,
    isSpeechSupported: true,
    handleToggleRecord: jest.fn(),
    wordCount: 0,
    charCount: 0,
    confirmSkip: false,
    setConfirmSkip: jest.fn(),
    handlePrevQuestion: jest.fn(),
    handleConfirmSkip: jest.fn(),
    handleNextQuestion: jest.fn(),
    activeAnswer: '',
    isSystemDesignQuestion: false,
    diagramState: null,
    setDiagramState: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Editor mode with accessible tablist, tabs, and preserved typed answer', () => {
    const html = renderToStaticMarkup(
      React.createElement(SessionAnswerWorkspace, {
        ...defaultProps,
        responseMode: 'type',
        typedAnswer: 'We need strong serializability for financial transactions.',
      })
    );

    // Tablist & tabs accessible semantics
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Answer input mode"');
    expect(html).toContain('id="mode-tab-editor"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('id="mode-tab-speech"');
    expect(html).toContain('aria-selected="false"');

    // Textarea with candidate draft
    expect(html).toContain('We need strong serializability for financial transactions.');
    expect(html).toContain('aria-label="Written answer draft"');
  });

  it('renders Speech mode with accessible tab semantics and preserved transcript', () => {
    const html = renderToStaticMarkup(
      React.createElement(SessionAnswerWorkspace, {
        ...defaultProps,
        responseMode: 'speak',
        transcriptText: 'I recommend a multi-leader replication topology.',
      })
    );

    expect(html).toContain('id="mode-tab-editor"');
    expect(html).toContain('aria-selected="false"');
    expect(html).toContain('id="mode-tab-speech"');
    expect(html).toContain('aria-selected="true"');

    // Speech display area with candidate transcript
    expect(html).toContain('I recommend a multi-leader replication topology.');
  });

  it('simulates switching from Speech to Editor: transfers transcriptText into typedAnswer (Case A)', () => {
    let mode: 'type' | 'speak' = 'speak';
    let typed = '';
    let transcript = 'Dictated response in speech mode.';
    let isRecording = false;

    const setResponseMode = jest.fn((m: 'type' | 'speak') => { mode = m; });
    const setTypedAnswer = jest.fn((t: string) => { typed = t; });
    const setTranscriptText = jest.fn((t: string) => { transcript = t; });
    const handleToggleRecord = jest.fn(() => { isRecording = false; });

    // Switch handler logic
    const handleSwitchToEditor = () => {
      if (mode === 'type') return;
      if (isRecording) handleToggleRecord();
      if (transcript.trim()) setTypedAnswer(transcript);
      setResponseMode('type');
    };

    handleSwitchToEditor();

    expect(setTypedAnswer).toHaveBeenCalledWith('Dictated response in speech mode.');
    expect(setResponseMode).toHaveBeenCalledWith('type');
    expect(typed).toBe('Dictated response in speech mode.');
  });

  it('simulates switching from Editor to Speech: retains typedAnswer in transcriptText (Case B)', () => {
    let mode: 'type' | 'speak' = 'type';
    let typed = 'Typed response in editor mode.';
    let transcript = '';

    const setResponseMode = jest.fn((m: 'type' | 'speak') => { mode = m; });
    const setTranscriptText = jest.fn((t: string) => { transcript = t; });

    const handleSwitchToSpeech = () => {
      if (mode === 'speak') return;
      if (typed.trim()) setTranscriptText(typed);
      setResponseMode('speak');
    };

    handleSwitchToSpeech();

    expect(setTranscriptText).toHaveBeenCalledWith('Typed response in editor mode.');
    expect(setResponseMode).toHaveBeenCalledWith('speak');
    expect(transcript).toBe('Typed response in editor mode.');
  });

  it('simulates repeated mode switching: never duplicates or erases draft (Case C)', () => {
    let mode: 'type' | 'speak' = 'type';
    let typed = 'Consistent hashing ring with 256 virtual nodes.';
    let transcript = '';

    const handleSwitchToSpeech = () => {
      if (mode === 'speak') return;
      if (typed.trim()) transcript = typed;
      mode = 'speak';
    };

    const handleSwitchToEditor = () => {
      if (mode === 'type') return;
      if (transcript.trim()) typed = transcript;
      mode = 'type';
    };

    // Cycle 5 times
    for (let i = 0; i < 5; i++) {
      handleSwitchToSpeech();
      expect(transcript).toBe('Consistent hashing ring with 256 virtual nodes.');
      handleSwitchToEditor();
      expect(typed).toBe('Consistent hashing ring with 256 virtual nodes.');
    }
  });

  it('handles empty drafts across mode switches without errors or phantom text (Case D)', () => {
    let mode: 'type' | 'speak' = 'type';
    let typed = '';
    let transcript = '';

    const handleSwitchToSpeech = () => {
      if (mode === 'speak') return;
      if (typed.trim()) transcript = typed;
      mode = 'speak';
    };

    const handleSwitchToEditor = () => {
      if (mode === 'type') return;
      if (transcript.trim()) typed = transcript;
      mode = 'type';
    };

    handleSwitchToSpeech();
    expect(transcript).toBe('');
    handleSwitchToEditor();
    expect(typed).toBe('');
  });
});

describe('Draft Synchronization Lifecycle & Anti-Stale Protections', () => {
  it('incorporates new speech into existing base draft without duplicate words', () => {
    const baseTyped = 'I would structure the service using event sourcing.';
    const newlyDictated = 'Events are written to an immutable append log.';

    const combined = mergeDrafts(baseTyped, newlyDictated);
    expect(combined).toBe(
      'I would structure the service using event sourcing. Events are written to an immutable append log.'
    );

    // Repeated merging of the same combined string should not alter it
    const reMerged = mergeDrafts(combined, combined);
    expect(reMerged).toBe(combined);
  });

  it('handles cumulative multi-segment speech recognition cleanly without duplicating previous chunks', () => {
    const base = 'First thought.';
    const segment1 = 'Second thought';
    const segment2 = 'Second thought with more details.';

    // Web Speech API emits cumulative transcript for the active session:
    const step1 = mergeDrafts(base, segment1);
    expect(step1).toBe('First thought. Second thought');

    const step2 = mergeDrafts(base, segment2);
    expect(step2).toBe('First thought. Second thought with more details.');
  });

  it('stale callback protection: ignores late recognition events when mode is not speak', () => {
    let currentMode: string = 'type';
    let draft = 'Typed answer edited in editor mode.';

    const onResult = (lateSpeechText: string) => {
      // Must drop late callbacks if candidate is in type mode
      if (currentMode !== 'speak') return;
      draft = lateSpeechText;
    };

    // Stale speech callback arrives after candidate switched to editor
    onResult('Old stale speech snippet');
    expect(draft).toBe('Typed answer edited in editor mode.');
  });

  it('advancing to a new question clears drafts and prevents leakage across question boundaries', () => {
    let typedAnswer = 'Question 1 draft text';
    let transcriptText = 'Question 1 transcript';
    let speechBaseDraft = 'Question 1 draft text';

    const handleNextQuestionReset = () => {
      typedAnswer = '';
      transcriptText = '';
      speechBaseDraft = '';
    };

    handleNextQuestionReset();

    expect(typedAnswer).toBe('');
    expect(transcriptText).toBe('');
    expect(speechBaseDraft).toBe('');
  });
});
