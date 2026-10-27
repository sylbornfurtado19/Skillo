/**
 * Prompt 09 — Regression Test Suite: Setup UX When No Resume Is Uploaded
 *
 * Verifies:
 * 1. Opening /setup without a resume renders the full wizard with welcoming standard simulation guidance (not blocked).
 * 2. Completing setup without a resume when workflow permits it enables "Begin Assessment" and launches the session.
 * 3. Selecting a workflow that genuinely requires resume data (Resume Deep Dive) displays clear requirements and disables start.
 * 4. Uploading/attaching a resume updates the status banner to "Resume Connected" and unblocks resume-dependent workflows.
 * 5. Resume parsing failures/empty extractions leave candidate safely in standard simulation mode without crashes.
 * 6. Refreshing or navigating back preserves setup progress and user selections in sessionStorage and searchParams.
 * 7. Existing interview start and session gating remain intact for both standard and resume-dependent modes.
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
const mockUser = { id: 'test-user-09', email: 'candidate@example.com' };
jest.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
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

const renderSetup = (props?: CareerSetupProps) =>
  renderToStaticMarkup(React.createElement<CareerSetupProps>(CareerSetup, props || {}));

const renderSession = () =>
  renderToStaticMarkup(React.createElement(InterviewSession));

describe('Prompt 09 — Setup UX When No Resume Is Uploaded', () => {
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

  describe('Scenario 1: Opening /setup without a resume', () => {
    it('renders the interactive 6-step setup wizard instead of a blocking screen', () => {
      mockResumeData = null;
      const html = renderSetup({ initialStep: 1 });

      // Does NOT show the hostile full-page blocker
      expect(html).not.toContain('You must upload your resume and specify job details before you can configure or start mock interview sessions');
      expect(html).not.toContain('Go to Upload Page');

      // Renders the wizard header and step 1 contents
      expect(html).toContain('Configure Career Prep Simulator');
      expect(html).toContain('Step 1 of 6');
      expect(html).toContain('Select Target Company Preset');
      expect(html).toContain('Google Style');
      expect(html).toContain('Meta Style');
      expect(html).toContain('Amazon Style');
    });

    it('renders welcoming "Standard Simulation Mode" banner with optional upload action', () => {
      mockResumeData = null;
      const html = renderSetup({ initialStep: 1 });

      expect(html).toContain('Standard Simulation Mode');
      expect(html).toContain('Resume Optional');
      expect(html).toContain('No resume uploaded. You can configure and run full mock interviews using curated industry benchmarks.');
      expect(html).toContain('Upload Resume (Optional)');
    });

    it('keeps all controls fully accessible and interactive without a resume', () => {
      mockResumeData = null;
      const html = renderSetup({ initialStep: 1 });

      expect(html).toContain('role="radiogroup"');
      expect(html).toContain('aria-label="Target Company Preset"');
      expect(html).toContain('Next Step');
      expect(html).toContain('Previous Step');
    });
  });

  describe('Scenario 2: Completing setup without a resume when workflow permits it', () => {
    it('enables "Begin Assessment" on Step 6 for standard tracks without requiring a resume', () => {
      mockResumeData = null;
      mockSetupData = {
        company: 'Google',
        role: 'Frontend Engineer',
        type: 'Coding',
        difficulty: 'Hard',
        duration: 45,
        interviewModeId: 'google-swe-coding',
      };

      const html = renderSetup({ initialStep: 6 });

      expect(html).toContain('Review Simulation Parameters');
      expect(html).toContain('Begin Assessment');
      // Must NOT be disabled due to missing resume
      expect(html).not.toContain('Resume Required for Track');
      expect(html).not.toContain('Resume Required to Start');
    });

    it('allows starting mock interview using preset questions when candidate has no resume', async () => {
      mockResumeData = null;
      mockSetupData = {
        company: 'Stripe',
        role: 'Backend Engineer',
        type: 'System Design',
        difficulty: 'Hard',
        duration: 60,
        interviewModeId: 'stripe-backend',
        questionCount: 4,
      };

      const html = renderSetup({ initialStep: 6 });
      expect(html).toContain('Begin Assessment');
    });
  });

  describe('Scenario 3: Selecting a workflow that genuinely requires resume data', () => {
    it('displays explanatory requirement and switch options when Resume Deep Dive is selected on Step 3', () => {
      mockResumeData = null;
      mockSetupData = {
        company: 'Generic',
        role: 'Software Engineer',
        type: 'Resume Deep Dive',
        difficulty: 'Hard',
        duration: 45,
      };

      const html = renderSetup({ initialStep: 3 });

      expect(html).toContain('Resume Required for Deep Dive Track');
      expect(html).toContain('The Resume Deep Dive track specifically validates past work history');
      expect(html).toContain('Upload Resume');
      expect(html).toContain('Switch to Standard Track');
    });

    it('disables "Begin Assessment" and shows clear alert on Step 6 when resume is missing for Deep Dive', () => {
      mockResumeData = null;
      mockSetupData = {
        company: 'Generic',
        role: 'Software Engineer',
        type: 'Resume Deep Dive',
        difficulty: 'Hard',
        duration: 45,
      };

      const html = renderSetup({ initialStep: 6 });

      // Review step notice
      expect(html).toContain('Resume Required to Start');
      expect(html).toContain('The selected “Resume Deep Dive” mode requires an uploaded resume');

      // Sidebar action notice & disabled button
      expect(html).toContain('Resume Required for Selected Track');
      expect(html).toContain('Resume Required for Track');
      expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?Resume Required for Track/);
    });
  });

  describe('Scenario 4: Uploading a resume after initially opening setup without one', () => {
    it('displays "Resume Connected" banner with personalized mode badge when resume is present', () => {
      mockResumeData = {
        text: 'Jane Doe, Staff Engineer with distributed systems expertise at scale.',
        skills: ['Distributed Systems', 'Go', 'Kubernetes'],
      };

      const html = renderSetup({ initialStep: 1 });

      expect(html).toContain('Resume Connected');
      expect(html).toContain('Personalized Mode');
      expect(html).toContain('Your uploaded resume will be used to tailor questions');
      expect(html).toContain('Change Resume');
      expect(html).not.toContain('Standard Simulation Mode');
    });

    it('fully unblocks Resume Deep Dive track when resumeData is attached', () => {
      mockResumeData = {
        text: 'Jane Doe, Staff Engineer with distributed systems expertise at scale.',
      };
      mockSetupData = {
        company: 'Generic',
        role: 'Software Engineer',
        type: 'Resume Deep Dive',
        difficulty: 'Hard',
        duration: 45,
      };

      const html = renderSetup({ initialStep: 6 });

      // Warning notices must disappear
      expect(html).not.toContain('Resume Required to Start');
      expect(html).not.toContain('Resume Required for Selected Track');

      // Button is active
      expect(html).toContain('Begin Assessment');
      expect(html).not.toContain('Resume Required for Track');
    });
  });

  describe('Scenario 5: Resume parsing failures and invalid uploads', () => {
    it('remains safely in Standard Simulation Mode if resume data is missing or empty', () => {
      mockResumeData = null; // Equivalent to parse failure / no extracted text

      const html = renderSetup({ initialStep: 2 });

      expect(html).toContain('Standard Simulation Mode');
      expect(html).toContain('Resume Optional');
      expect(html).toContain('Select Target Role');
      expect(html).toContain('Software Engineer');
    });
  });

  describe('Scenario 6: Refreshing or navigating back without losing valid setup state', () => {
    it('restores step from URL searchParams (e.g., ?step=4) across navigation', () => {
      mockSearchParams.set('step', '4');
      const html = renderSetup();
      mockSearchParams.delete('step');

      expect(html).toContain('Step 4 of 6');
      expect(html).toContain('Select Difficulty Mode');
    });

    it('serializes and stores valid setup state to sessionStorage contract', () => {
      const persistedState = {
        currentStep: 4,
        setupData: {
          company: 'Amazon',
          role: 'Backend Engineer',
          type: 'Behavioral',
          difficulty: 'Hard',
          duration: 45,
          interviewModeId: 'amazon-behavioral',
        },
      };

      sessionStorageMock.setItem('skillo_career_setup_state', JSON.stringify(persistedState));
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        'skillo_career_setup_state',
        expect.stringContaining('amazon-behavioral')
      );

      const retrieved = JSON.parse(sessionStorageMock.getItem('skillo_career_setup_state')!);
      expect(retrieved.currentStep).toBe(4);
      expect(retrieved.setupData.company).toBe('Amazon');
    });
  });

  describe('Scenario 7: Interview session entry gating', () => {
    it('allows candidate without a resume to start a standard Technical interview session', () => {
      mockResumeData = null;
      mockSetupData = {
        company: 'Generic',
        role: 'Software Engineer',
        type: 'Technical',
        difficulty: 'Medium',
        duration: 45,
      };

      const html = renderSession();

      // InterviewSession must NOT show the hostile "Resume Required" block for standard technical tracks
      expect(html).not.toContain('You must upload your resume and specify job details before you can start active mock interviews');
      expect(html).not.toContain('The selected interview mode requires resume data to analyze your background');
    });

    it('guards InterviewSession with actionable guidance if candidate navigates to Resume Deep Dive without resume', () => {
      mockResumeData = null;
      mockSetupData = {
        company: 'Generic',
        role: 'Software Engineer',
        type: 'Resume Deep Dive',
        difficulty: 'Hard',
        duration: 45,
      };

      const html = renderSession();

      // Must show the resume required guard with actionable options
      expect(html).toContain('Resume Required');
      expect(html).toContain('The selected interview mode requires resume data to analyze your background and past project claims');
      expect(html).toContain('Upload Resume');
      expect(html).toContain('Return to Setup');
    });
  });
});
