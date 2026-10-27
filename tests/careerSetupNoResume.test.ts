/**
 * Prompt 09A — Comprehensive Verification and Behavioral Regression Suite:
 * Setup UX and Resume Requirements Across Setup and Interview Entry
 *
 * Scenarios Tested:
 * 1. Deep Dive -> standard track without a resume (clears stale resume requirement).
 * 2. Standard track -> Deep Dive without a resume (activates requirement and blocks start).
 * 3. Deep Dive with a valid resume (unblocks workflow and generates tailored questions).
 * 4. Refreshing or restoring setup state while Deep Dive is selected (preserves requirement).
 * 5. Direct interview entry with missing or inconsistent mode metadata (server & client gating).
 * 6. Standard question generation without resume data (preset and API generation succeed).
 * 7. Invalid or empty resume extraction results (safely handled; empty text cannot bypass prerequisite).
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// ── Next.js Router Mock ───────────────────────────────────────────────────────
const mockPush = jest.fn();
const mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}));

// ── Framer Motion Mock ────────────────────────────────────────────────────────
jest.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, prop) => ({ children, whileInView, whileHover, whileTap, initial, animate, exit, transition, viewport, ...domProps }: any) =>
        React.createElement(typeof prop === 'string' ? prop : 'div', domProps, children),
    }
  ),
  AnimatePresence: ({ children }: any) => children,
}));

// ── Toast Mock ────────────────────────────────────────────────────────────────
jest.mock('../src/components/ui/Toast', () => ({
  useToast: () => ({
    showToast: jest.fn(),
  }),
}));

// ── Auth & Context Mocks ──────────────────────────────────────────────────────
const mockUser = { id: 'test-user-09a', email: 'candidate@example.com' };
jest.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

jest.mock('../src/lib/server/authenticateRequest', () => ({
  authenticateRequest: async (req: Request) => {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer valid_test_token')) {
      return { ok: false, status: 401, message: 'Authentication required' };
    }
    return { ok: true, user: { id: 'usr_test_setup_09a', email: 'tester@example.com' } };
  },
  authFailureResponse: (auth: any) => {
    const { NextResponse } = require('next/server');
    return NextResponse.json({ status: 'error', message: auth.message }, { status: auth.status });
  },
}));

jest.mock('@/lib/firebase/admin', () => ({
  isFirebaseAdminConfigured: true,
  getAdminAuth: async () => ({
    verifyIdToken: jest.fn(async () => ({ uid: 'usr_test_setup_09a', email: 'tester@example.com' })),
  }),
  getAdminFirestore: () => ({
    collection: () => ({
      doc: () => ({
        get: jest.fn(async () => ({ exists: false, data: () => null })),
        set: jest.fn(),
      }),
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ size: 0, docs: [] }),
    }),
  }),
}));

let mockResumeData: any = null;
let mockQuestions: any[] = ['What is the difference between TCP and UDP?'];
let mockCurrentQuestionIndex = 0;
let mockAnswers: any[] = [];
let mockSetupData: any = {
  company: 'Generic',
  role: 'Software Engineer',
  type: 'Technical',
  difficulty: 'Medium',
  duration: 45,
  domain: 'Computer Science',
  experienceLevel: 'Mid-Level',
  questionCount: 5,
  focusAreas: [],
  persona: 'sarah',
  interviewModeId: 'generic-technical',
};

const mockSetSetupData = jest.fn((val: any) => {
  if (typeof val === 'function') {
    mockSetupData = val(mockSetupData);
  } else {
    mockSetupData = val;
  }
});
const mockSetQuestions = jest.fn();
const mockSetCurrentQuestionIndex = jest.fn();
const mockSetAnswers = jest.fn();
const mockSetPastCritiques = jest.fn();
const mockSetRecalledMemoryNotice = jest.fn();

jest.mock('../src/context/InterviewContext', () => ({
  useInterview: () => ({
    resumeData: mockResumeData,
    setupData: mockSetupData,
    questions: mockQuestions,
    currentQuestionIndex: mockCurrentQuestionIndex,
    answers: mockAnswers,
    setSetupData: mockSetSetupData,
    setQuestions: mockSetQuestions,
    setCurrentQuestionIndex: mockSetCurrentQuestionIndex,
    setAnswers: mockSetAnswers,
    setPastCritiques: mockSetPastCritiques,
    setRecalledMemoryNotice: mockSetRecalledMemoryNotice,
    recalledMemoryNotice: null,
  }),
}));

// ── SessionStorage Mock ───────────────────────────────────────────────────────
const mockSessionStorage: Record<string, string> = {};
const sessionStorageMock = {
  getItem: jest.fn((key: string) => mockSessionStorage[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    mockSessionStorage[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete mockSessionStorage[key];
  }),
  clear: jest.fn(() => {
    Object.keys(mockSessionStorage).forEach((k) => delete mockSessionStorage[k]);
  }),
};

const addEventListenerSpy = jest.fn();
const removeEventListenerSpy = jest.fn();

beforeAll(() => {
  (global as any).window = {
    sessionStorage: sessionStorageMock,
    addEventListener: addEventListenerSpy,
    removeEventListener: removeEventListenerSpy,
  };
  (global as any).sessionStorage = sessionStorageMock;
});

// Mock subcomponents used in InterviewSession
jest.mock('../src/hooks/useMediaReadiness', () => ({
  useMediaReadiness: () => ({
    devicesReady: true,
    readiness: {
      ready: true,
      cameraLive: true,
      microphoneLive: true,
      cameraReason: null,
      microphoneReason: null,
    },
  }),
}));
jest.mock('../src/hooks/useInterviewCamera', () => {
  const liveTrack = { readyState: 'live', enabled: true, muted: false, addEventListener: jest.fn(), removeEventListener: jest.fn() };
  return {
    useInterviewCamera: () => ({
      stream: { getVideoTracks: () => [liveTrack], getAudioTracks: () => [liveTrack], getTracks: () => [liveTrack, liveTrack] },
      isCameraActive: true,
      cameraError: null,
      cameraErrorName: null,
      startCamera: jest.fn(),
      stopCamera: jest.fn(),
    }),
  };
});
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
    resetTelemetry: jest.fn(),
  }),
}));
jest.mock('../src/hooks/useIVPEvidenceRunner', () => ({
  useIVPEvidenceRunner: () => ({
    recordEvent: jest.fn(),
    getReceipts: () => [],
    sessionSummary: {},
    exportVerificationToken: () => 'mock-token',
  }),
}));
jest.mock('../src/hooks/useInterviewIntegrity', () => ({
  useInterviewIntegrity: () => ({
    isSessionLocked: false,
    lockReason: null,
    resumeInterview: jest.fn(),
    getIntegrityReport: () => ({}),
  }),
}));
jest.mock('../src/hooks/useInterviewCountdown', () => ({
  useInterviewCountdown: () => ({
    secondsRemaining: 1800,
    formattedTime: '30:00',
    isExpired: false,
  }),
}));

import CareerSetup, { CareerSetupProps } from '../src/views/CareerSetup';
import InterviewSession from '../src/views/InterviewSession';
import {
  isResumeRequiredMode,
  resolveInterviewMode,
  INTERVIEW_MODE_PRESETS,
} from '../src/types/interviewModes';
import { getQuestionsForSetup } from '../src/services/constants';
import { POST as setupApiHandler } from '../app/api/interview/setup/route';

const renderSetup = (props?: CareerSetupProps) =>
  renderToStaticMarkup(React.createElement<CareerSetupProps>(CareerSetup, props || {}));

const renderSession = () =>
  renderToStaticMarkup(React.createElement(InterviewSession));

describe('Prompt 09A — Verify Resume Requirements Across Setup and Interview Entry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorageMock.clear();
    mockResumeData = null;
    mockQuestions = ['What is the difference between TCP and UDP?'];
    mockCurrentQuestionIndex = 0;
    mockAnswers = [];
    mockSetupData = {
      company: 'Generic',
      role: 'Software Engineer',
      type: 'Technical',
      difficulty: 'Medium',
      duration: 45,
      domain: 'Computer Science',
      experienceLevel: 'Mid-Level',
      questionCount: 5,
      focusAreas: [],
      persona: 'sarah',
      interviewModeId: 'generic-technical',
    };
  });

  describe('1. Mode Resolution and Requirement Consistency', () => {
    it('Scenario 1: Switching from Deep Dive to a standard track clears stale resume requirement', () => {
      // Simulate state where user was previously on Resume Deep Dive
      const deepDiveState = {
        company: 'Google',
        role: 'Software Engineer',
        type: 'Resume Deep Dive',
        interviewModeId: 'generic-resume-deep-dive',
        requiresResume: true,
      };

      expect(isResumeRequiredMode(deepDiveState)).toBe(true);

      // Now resolve mode when switching track to Technical
      const switchedMode = resolveInterviewMode({
        company: deepDiveState.company,
        role: deepDiveState.role,
        interviewType: 'Technical',
        interviewModeId: deepDiveState.interviewModeId,
      });

      // The conflicting generic-resume-deep-dive preset ID must NOT override Technical!
      expect(switchedMode.interviewType).toBe('Technical');
      expect(switchedMode.requiresResume).toBeUndefined();

      // Canonical requirement check on the switched setup must be false
      const switchedSetup = {
        ...deepDiveState,
        type: 'Technical',
        interviewModeId: switchedMode.id,
        requiresResume: Boolean(switchedMode.requiresResume),
      };

      expect(isResumeRequiredMode(switchedSetup)).toBe(false);

      // Render Step 6 with switched setup and verify Begin Assessment is enabled without warning
      mockResumeData = null;
      mockSetupData = switchedSetup;
      const html = renderSetup({ initialStep: 6 });

      expect(html).not.toContain('Resume Required for Track');
      expect(html).not.toContain('Resume Required to Start');
      expect(html).toContain('Begin Assessment');
    });

    it('Scenario 2: Switching from standard track to Deep Dive activates requirement and blocks start without resume', () => {
      const standardState = {
        company: 'Google',
        role: 'Frontend Engineer',
        type: 'Coding',
        interviewModeId: 'google-swe-coding',
      };

      expect(isResumeRequiredMode(standardState)).toBe(false);

      // Switch to Resume Deep Dive
      const deepDiveMode = resolveInterviewMode({
        company: standardState.company,
        role: standardState.role,
        interviewType: 'Resume Deep Dive',
        interviewModeId: standardState.interviewModeId,
      });

      expect(deepDiveMode.requiresResume).toBe(true);
      expect(deepDiveMode.id).toBe('generic-resume-deep-dive');

      const deepDiveSetup = {
        ...standardState,
        type: 'Resume Deep Dive',
        interviewModeId: deepDiveMode.id,
        requiresResume: true,
      };

      expect(isResumeRequiredMode(deepDiveSetup)).toBe(true);

      // Render Step 3 and Step 6 without resume
      mockResumeData = null;
      mockSetupData = deepDiveSetup;

      const htmlStep3 = renderSetup({ initialStep: 3 });
      expect(htmlStep3).toContain('Resume Required for Deep Dive Track');
      expect(htmlStep3).toContain('Upload Resume');
      expect(htmlStep3).toContain('Switch to Standard Track');

      const htmlStep6 = renderSetup({ initialStep: 6 });
      expect(htmlStep6).toContain('Resume Required to Start');
      expect(htmlStep6).toContain('Resume Required for Track');
      expect(htmlStep6).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?Resume Required for Track/);
    });

    it('Scenario 3: Deep Dive with a valid resume unblocks the workflow', () => {
      mockResumeData = {
        text: 'Staff Software Engineer. Architected distributed payment orchestration system processing 50k tps.',
      };
      mockSetupData = {
        company: 'Generic',
        role: 'Software Engineer',
        type: 'Resume Deep Dive',
        interviewModeId: 'generic-resume-deep-dive',
        requiresResume: true,
      };

      expect(isResumeRequiredMode(mockSetupData)).toBe(true);

      const html = renderSetup({ initialStep: 6 });
      expect(html).not.toContain('Resume Required to Start');
      expect(html).not.toContain('Resume Required for Selected Track');
      expect(html).toContain('Begin Assessment');
    });

    it('Scenario 4: Refreshing or restoring setup state while Deep Dive is selected preserves requirement', () => {
      const persistedDeepDive = {
        currentStep: 3,
        setupData: {
          company: 'Generic',
          role: 'Software Engineer',
          type: 'Resume Deep Dive',
          interviewModeId: 'generic-resume-deep-dive',
          requiresResume: true,
          difficulty: 'Hard',
          duration: 45,
        },
      };

      mockSessionStorage['skillo_career_setup_state'] = JSON.stringify(persistedDeepDive);

      // Simulate rehydration in context
      mockSetupData = persistedDeepDive.setupData;
      mockResumeData = null;

      expect(isResumeRequiredMode(mockSetupData)).toBe(true);

      const html = renderSetup({ initialStep: persistedDeepDive.currentStep });
      expect(html).toContain('Resume Required for Deep Dive Track');
      expect(html).toContain('Step 3 of 6');
    });

    it('Scenario 5: Missing or malformed mode metadata cannot accidentally block standard candidates or bypass requirements', () => {
      // Malformed metadata for standard track
      const malformedStandard = {
        company: 'UnknownCompany',
        role: 'CustomRole',
        type: 'Technical',
        interviewModeId: 'nonexistent-mode-id',
        requiresResume: false,
      };

      // Must safely resolve to standard generic technical mode without requiring resume
      const resolved = resolveInterviewMode(malformedStandard);
      expect(resolved.id).toBe('generic-technical');
      expect(resolved.requiresResume).toBeUndefined();
      expect(isResumeRequiredMode(malformedStandard)).toBe(false);

      // Crafted state attempting to bypass: type is 'Resume Deep Dive' but requiresResume was spoofed to false
      const spoofedDeepDive = {
        company: 'Google',
        type: 'Resume Deep Dive',
        requiresResume: false,
      };

      // isResumeRequiredMode must detect Resume Deep Dive and reject the spoof
      expect(isResumeRequiredMode(spoofedDeepDive)).toBe(true);
    });
  });

  describe('2. Server-Side Setup API Enforcement', () => {
    it('rejects POST /api/interview/setup for Resume Deep Dive without resumeText with HTTP 422', async () => {
      const req = new Request('http://localhost:3000/api/interview/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid_test_token',
        },
        body: JSON.stringify({
          setupData: {
            company: 'Generic',
            role: 'Software Engineer',
            type: 'Resume Deep Dive',
            interviewModeId: 'generic-resume-deep-dive',
            questionCount: 3,
          },
          // Missing resumeText
        }),
      });

      const res = await setupApiHandler(req);
      expect(res.status).toBe(422);

      const body = await res.json();
      expect(body.status).toBe('error');
      expect(body.message).toContain('The selected interview mode requires resume content');
    });

    it('Scenario 7: Rejects empty or whitespace-only resume extraction results on server with HTTP 422', async () => {
      const req = new Request('http://localhost:3000/api/interview/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid_test_token',
        },
        body: JSON.stringify({
          setupData: {
            company: 'Generic',
            role: 'Software Engineer',
            type: 'Resume Deep Dive',
            interviewModeId: 'generic-resume-deep-dive',
            questionCount: 3,
          },
          resumeText: '    \n\t   ', // Unusable whitespace
        }),
      });

      const res = await setupApiHandler(req);
      expect(res.status).toBe(422);

      const body = await res.json();
      expect(body.message).toContain('The selected interview mode requires resume content');
    });

    it('accepts POST /api/interview/setup for Resume Deep Dive when valid resumeText is supplied', async () => {
      const req = new Request('http://localhost:3000/api/interview/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid_test_token',
        },
        body: JSON.stringify({
          setupData: {
            company: 'Generic',
            role: 'Software Engineer',
            type: 'Resume Deep Dive',
            interviewModeId: 'generic-resume-deep-dive',
            questionCount: 3,
          },
          resumeText: 'Jane Doe. Senior Engineer with experience leading Kubernetes migrations.',
        }),
      });

      const res = await setupApiHandler(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.status).toBe('success');
      expect(Array.isArray(body.data.questions)).toBe(true);
      expect(body.data.questions.length).toBe(3);
    });

    it('Scenario 6: Standard question generation succeeds without resume data', async () => {
      // 1. Direct API test without resumeText
      const req = new Request('http://localhost:3000/api/interview/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid_test_token',
        },
        body: JSON.stringify({
          setupData: {
            company: 'Google',
            role: 'Software Engineer',
            type: 'Coding',
            questionCount: 4,
          },
          // No resumeText
        }),
      });

      const res = await setupApiHandler(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.status).toBe('success');
      expect(body.data.questions.length).toBe(4);
      expect(body.data.questions[0].question).toBeDefined();

      // 2. Unit question pool generator verification
      const questions = getQuestionsForSetup({
        company: 'Stripe',
        role: 'Backend Engineer',
        type: 'System Design',
        questionCount: 3,
      });

      expect(questions.length).toBe(3);
      expect(questions[0].question).toContain('[Stripe');
    });
  });

  describe('3. Interview Session Entry and Direct Navigation Gating', () => {
    it('allows candidate without a resume to run active interview on standard tracks', () => {
      mockResumeData = null;
      mockSetupData = {
        company: 'Google',
        role: 'Software Engineer',
        type: 'Coding',
        difficulty: 'Hard',
        duration: 45,
      };

      const html = renderSession();

      expect(html).not.toContain('You must upload your resume and specify job details before you can start active mock interviews');
      expect(html).not.toContain('The selected interview mode requires resume data');
    });

    it('guards InterviewSession with actionable guidance when entering Resume Deep Dive directly without resume', () => {
      mockResumeData = null;
      mockSetupData = {
        company: 'Generic',
        role: 'Software Engineer',
        type: 'Resume Deep Dive',
        interviewModeId: 'generic-resume-deep-dive',
        difficulty: 'Hard',
        duration: 45,
      };

      const html = renderSession();

      expect(html).toContain('Resume Required');
      expect(html).toContain('The selected interview mode requires resume data to analyze your background and past project claims');
      expect(html).toContain('Upload Resume');
      expect(html).toContain('Return to Setup');
    });

    it('allows InterviewSession to run when Resume Deep Dive has valid resumeData', () => {
      mockResumeData = {
        text: 'Staff Engineer. Experience designing real-time low-latency financial settlement engines.',
      };
      mockSetupData = {
        company: 'Generic',
        role: 'Software Engineer',
        type: 'Resume Deep Dive',
        interviewModeId: 'generic-resume-deep-dive',
        difficulty: 'Hard',
        duration: 45,
      };

      const html = renderSession();

      expect(html).not.toContain('Resume Required');
    });
  });
});
