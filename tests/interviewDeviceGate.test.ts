/**
 * The interview must not run unless camera AND microphone are on.
 * Renders the real InterviewSession with different mocked streams.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/interview',
}));
jest.mock('../src/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));

const track = (kind: 'video' | 'audio', overrides: Record<string, unknown> = {}) => ({
  kind,
  readyState: 'live',
  enabled: true,
  muted: false,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  ...overrides,
});
const makeStream = (video: unknown[], audio: unknown[]) => ({
  getVideoTracks: () => video,
  getAudioTracks: () => audio,
  getTracks: () => [...video, ...audio],
});

let mockStream: any = null;
let mockCameraErrorName: string | null = null;

jest.mock('../src/hooks/useInterviewCamera', () => ({
  useInterviewCamera: () => ({
    stream: mockStream,
    isCameraActive: Boolean(mockStream),
    cameraError: null,
    cameraErrorName: mockCameraErrorName,
    startCamera: jest.fn(),
    stopCamera: jest.fn(),
  }),
}));

jest.mock('../src/hooks/useIVPSessionPipeline', () => ({
  useIVPSessionPipeline: () => ({
    videoRef: { current: null },
    liveGazeFrame: null,
    livePoseFrame: null,
    liveAffectFrame: null,
    gazeEyeContactPct: 85,
    showGazeWarning: false,
    latestGestureToast: null,
    isVisionReady: true,
    isONNXReady: true,
    clearPerQuestionFrames: jest.fn(),
    getCapturedTelemetry: () => ({ capturedGazeFrames: [], capturedPoseFrames: [], capturedAffectFrames: [] }),
  }),
}));

jest.mock('../src/components/interview/SystemDesignCanvas', () => ({ SystemDesignCanvas: () => null }));
jest.mock('../src/components/ui/IVPCameraPreview', () => () => null);
jest.mock('../src/components/ui/IVPSyncTracker', () => () => null);
jest.mock('../src/components/ui/AdaptiveHUDHeader', () => () => null);
jest.mock('../src/components/ui/EyeContactHUD', () => () => null);
jest.mock('../src/components/ui/PostureHUD', () => () => null);
jest.mock('../src/components/ui/AffectiveHUD', () => () => null);
jest.mock('../src/components/ui/LipSyncHUD', () => () => null);

const mockInterviewState = {
  resumeData: { text: 'Candidate resume sample' },
  questions: [{ id: 'q_1', question: 'Explain how a distributed rate limiter works.', duration: 120 }] as any[],
  setQuestions: jest.fn(),
  currentQuestionIndex: 0,
  setCurrentQuestionIndex: jest.fn(),
  answers: [] as any[],
  setAnswers: jest.fn(),
  setupData: { role: 'Backend Engineer', persona: 'sarah', type: 'Technical', experienceLevel: 'Senior' },
  setSetupData: jest.fn(),
  results: null,
  setResults: jest.fn(),
  isRetry: false,
  retryQuestionIndex: null,
};

jest.mock('../src/context/InterviewContext', () => ({ useInterview: () => mockInterviewState }));
jest.mock('../src/components/ui/Toast', () => ({ useToast: () => ({ showToast: jest.fn() }) }));


import InterviewSession from '../src/views/InterviewSession';

const render = () => renderToStaticMarkup(React.createElement(InterviewSession));

describe('interview requires camera and microphone', () => {
  beforeEach(() => {
    mockCameraErrorName = null;
  });

  it('is blocked when no stream exists yet', () => {
    mockStream = null;
    const html = render();
    expect(html).toContain('Turn on your camera and microphone to begin');
    expect(html).toContain('Enable camera &amp; microphone');
    expect(html).not.toContain('Explain how a distributed rate limiter works.');
  });

  it('is blocked when only the camera is on', () => {
    mockStream = makeStream([track('video')], []);
    const html = render();
    expect(html).toContain('Turn on your camera and microphone to begin');
    expect(html).not.toContain('Explain how a distributed rate limiter works.');
  });

  it('is blocked when only the microphone is on', () => {
    mockStream = makeStream([], [track('audio')]);
    const html = render();
    expect(html).toContain('Turn on your camera and microphone to begin');
  });

  it('is blocked when the microphone track has ended or is muted', () => {
    mockStream = makeStream([track('video')], [track('audio', { readyState: 'ended' })]);
    expect(render()).toContain('Turn on your camera and microphone to begin');

    mockStream = makeStream([track('video')], [track('audio', { muted: true })]);
    expect(render()).toContain('Turn on your camera and microphone to begin');
  });

  it('explains how to fix a blocked permission', () => {
    mockStream = null;
    mockCameraErrorName = 'NotAllowedError';
    const html = render();
    expect(html).toContain('Access to your camera or microphone is blocked');
  });

  it('runs the interview and shows the question when both devices are on', () => {
    mockStream = makeStream([track('video')], [track('audio')]);
    const html = render();
    expect(html).not.toContain('Turn on your camera and microphone to begin');
    expect(html).toContain('Explain how a distributed rate limiter works.');
    expect(html).toContain('Replay question');
  });
});
