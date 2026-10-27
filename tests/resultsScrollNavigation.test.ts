/**
 * Comprehensive Unit Tests for Results Section Scroll Navigation (PROMPT 07)
 *
 * Verifies:
 * 1. Semantic nav container with aria-label and accessible button names.
 * 2. Accessible current-section state (aria-current="location").
 * 3. Dynamic inclusion/exclusion of conditional tabs based on biometric/tree metrics.
 * 4. Active section changes when visible section changes via IntersectionObserver.
 * 5. Reading-line scoring resolving the active section without flickering.
 * 6. Programmatic click navigation with smooth scrolling and reduced-motion support.
 * 7. History and URL hash synchronization (hashchange, popstate, direct loading).
 * 8. User interrupt releasing programmatic scroll lock.
 * 9. Boundary scroll detection (top of document -> overview, bottom -> responses).
 * 10. Observer, listener, and timer cleanup on unmount.
 * 11. Preservation of empty-state and authentic report restoration behavior.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ResultsScrollSpyController,
  calculateSectionReadingScore,
  resolveActiveNavItem,
  ResultsNavItem,
} from '../src/hooks/useResultsScrollSpy';

// ── Next.js / Router Mocks ───────────────────────────────────────────────────
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/results',
}));

jest.mock('next/dynamic', () => () => {
  const DynamicComponent = () => null;
  DynamicComponent.displayName = 'DynamicComponent';
  return DynamicComponent;
});

jest.mock('next/image', () => (props: any) => React.createElement('img', props));

jest.mock('../src/lib/chartSetup', () => ({}));

let mockInterviewState: any = {
  results: null,
  setResults: jest.fn(),
  setSetupData: jest.fn(),
  setQuestions: jest.fn(),
  setCurrentQuestionIndex: jest.fn(),
  setAnswers: jest.fn(),
  resetSession: jest.fn(),
  sessionHistory: [],
  setIsRetry: jest.fn(),
  setRetryQuestionIndex: jest.fn(),
};

jest.mock('../src/context/InterviewContext', () => ({
  useInterview: () => mockInterviewState,
}));

jest.mock('../src/components/ui/Toast', () => ({
  useToast: () => ({
    showToast: jest.fn(),
  }),
}));

import Results from '../src/views/Results';

describe('Prompt 07 — Results Navigation & Scroll Synchronization', () => {
  const sampleNavItems: ResultsNavItem[] = [
    { id: 'sec-overview', tab: 'overview', label: 'Overview' },
    { id: 'sec-confidence', tab: 'confidence', label: 'Confidence Analysis' },
    { id: 'sec-contrastive', tab: 'contrastive', label: 'Contrastive Analysis' },
    { id: 'sec-lats', tab: 'lats', label: 'Adaptive Tree (LATS)' },
    { id: 'sec-gaze', tab: 'gaze', label: 'Gaze Analytics' },
    { id: 'sec-pose', tab: 'pose', label: 'Posture & Gestures' },
    { id: 'sec-affect', tab: 'affect', label: 'Facial Composure' },
    { id: 'sec-sync', tab: 'sync', label: 'Audio & Latency' },
    { id: 'sec-responses', tab: 'responses', label: 'Detailed Responses' },
  ];

  const standardResults = {
    overallScore: 88,
    personaId: 'sarah',
    interviewerComments: 'Strong technical articulation across distributed systems.',
    categories: {
      technicalAccuracy: 88,
      systemDesignLogic: 85,
      edgeCaseHandling: 82,
      communication: 90,
    },
    setupData: {
      role: 'Staff Infrastructure Engineer',
      company: 'Datadog',
      experienceLevel: 'Senior',
    },
    breakdown: [
      {
        id: 'q_1',
        question: 'Explain raft consensus and leader election dynamics.',
        score: 90,
        feedback: 'Excellent breakdown of term indices and heartbeat timeouts.',
      },
    ],
  };

  const resultsWithBiometrics = {
    ...standardResults,
    latsTreeState: {
      rootNode: {
        id: 'root',
        parentId: null,
        actionType: 'ROOT',
        depth: 0,
        value: 1.0,
        visitCount: 1,
        uctValue: 0.95,
        qValue: 0.9,
        questionText: 'System design architecture initial state',
        rationale: 'Initial starting node',
        reflectionFeedback: 'Initial system formulation',
        isSelectedTrajectory: true,
        children: [],
      },
      selectedTrajectoryNodeIds: ['root'],
      totalSimulations: 5,
      trajectoryHistory: [],
    },
    eyeContactMetrics: {
      totalVideoDurationSeconds: 180,
      eyeContactPercentage: 82,
      averagePitch: 0.1,
      averageYaw: -0.2,
      focusStabilityScore: 85,
      distractionEvents: [],
      gazeFrames: [],
    },
    headPoseMetrics: {
      totalFramesAnalyzed: 5400,
      postureComposureScore: 88,
      averageYaw: 0,
      averagePitch: 0,
      averageRoll: 0,
      nodCount: 2,
      headShakeCount: 1,
      restlessnessIndex: 5,
      gesturalEvents: [],
      frameTrace: [],
    },
    affectiveMetrics: {
      totalKeyframesAnalyzed: 180,
      overallComposureScore: 90,
      averageValence: 0.3,
      averageArousal: 0.4,
      dominantEmotionDistribution: {
        Neutral: 70,
        Happy: 20,
        Surprise: 10,
        Sad: 0,
        Fear: 0,
        Disgust: 0,
        Anger: 0,
        Contempt: 0,
      },
      stressSpikeEvents: [],
      affectTimeline: [],
    },
    lipSyncMetrics: {
      totalWindowsAnalyzed: 120,
      overallSyncScore: 92,
      averageOffsetMs: 12,
      averageCrossModalDistance: 0.15,
      verificationStatus: 'VERIFIED',
      spoofingAlerts: [],
      syncTrace: [],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Semantic Navigation & Accessible Current-Section State', () => {
    it('renders a semantic <nav> container with aria-label and accessible button names', () => {
      mockInterviewState = {
        ...mockInterviewState,
        results: standardResults,
      };

      const html = renderToStaticMarkup(React.createElement(Results));

      // Must be a semantic <nav> with descriptive accessible label
      expect(html).toContain('<nav aria-label="Assessment report sections"');
      expect(html).toContain('Overview');
      expect(html).toContain('Confidence Analysis');
      expect(html).toContain('Contrastive Analysis');
      expect(html).toContain('Detailed Responses');
    });

    it('sets aria-current="location" on the initial active tab ("Overview") and not on others', () => {
      mockInterviewState = {
        ...mockInterviewState,
        results: standardResults,
      };

      const html = renderToStaticMarkup(React.createElement(Results));

      // Overview button must have aria-current="location"
      expect(html).toMatch(/aria-current="location"[^>]*>Overview<\/button>/);
      // Other buttons must not have aria-current
      expect(html).not.toMatch(/aria-current="location"[^>]*>Confidence Analysis<\/button>/);
      expect(html).not.toMatch(/aria-current="location"[^>]*>Detailed Responses<\/button>/);
    });

    it('dynamically excludes biometric and adaptive tree tabs when metrics are unavailable', () => {
      mockInterviewState = {
        ...mockInterviewState,
        results: standardResults, // no gaze, pose, affect, sync, or lats
      };

      const html = renderToStaticMarkup(React.createElement(Results));

      expect(html).not.toContain('Adaptive Tree (LATS)');
      expect(html).not.toContain('Gaze Analytics');
      expect(html).not.toContain('Posture &amp; Gestures');
      expect(html).not.toContain('Facial Composure');
      expect(html).not.toContain('Audio &amp; Latency');
    });

    it('dynamically includes biometric and adaptive tree tabs when metrics are available', () => {
      mockInterviewState = {
        ...mockInterviewState,
        results: resultsWithBiometrics,
      };

      const html = renderToStaticMarkup(React.createElement(Results));

      expect(html).toContain('Adaptive Tree (LATS)');
      expect(html).toContain('Gaze Analytics');
      expect(html).toContain('Posture &amp; Gestures');
      expect(html).toContain('Facial Composure');
      expect(html).toContain('Audio &amp; Latency');
    });
  });

  describe('2. Reading-Line Scoring & Priority Resolution', () => {
    const READING_LINE = 140;

    it('assigns highest priority score to sections directly straddling the reading line', () => {
      // Section A straddles 140 (top: 50, bottom: 600)
      const scoreA = calculateSectionReadingScore({ top: 50, bottom: 600 }, 0.5, READING_LINE);
      // Section B is below reading line (top: 250, bottom: 800)
      const scoreB = calculateSectionReadingScore({ top: 250, bottom: 800 }, 0.7, READING_LINE);
      // Section C is above reading line (top: -300, bottom: 100)
      const scoreC = calculateSectionReadingScore({ top: -300, bottom: 100 }, 0.3, READING_LINE);

      expect(scoreA).toBeGreaterThan(scoreB);
      expect(scoreA).toBeGreaterThan(scoreC);
      expect(scoreA).toBe(10000 - 50); // 9950
    });

    it('ranks sections by proximity to reading line when neither straddles', () => {
      // Section D top is 160 (20px below reading line)
      const scoreD = calculateSectionReadingScore({ top: 160, bottom: 500 }, 0.4, READING_LINE);
      // Section E top is 300 (160px below reading line)
      const scoreE = calculateSectionReadingScore({ top: 300, bottom: 800 }, 0.4, READING_LINE);

      expect(scoreD).toBeGreaterThan(scoreE);
    });

    it('falls back to intersectionRatio when layout rects are zero (jsdom mock environment)', () => {
      const scoreMockHigh = calculateSectionReadingScore({ top: 0, bottom: 0 }, 0.85, READING_LINE);
      const scoreMockLow = calculateSectionReadingScore({ top: 0, bottom: 0 }, 0.2, READING_LINE);

      expect(scoreMockHigh).toBe(0.85);
      expect(scoreMockLow).toBe(0.2);
      expect(scoreMockHigh).toBeGreaterThan(scoreMockLow);
    });

    it('resolves the correct active item from visible intersecting candidates', () => {
      const visibleItems: ResultsNavItem[] = [
        { id: 'sec-overview', tab: 'overview', label: 'Overview' },
        { id: 'sec-confidence', tab: 'confidence', label: 'Confidence Analysis' },
      ];

      const entriesMap = new Map<string, any>([
        ['sec-overview', { boundingClientRect: { top: -400, bottom: 120 }, intersectionRatio: 0.1 }],
        ['sec-confidence', { boundingClientRect: { top: 125, bottom: 650 }, intersectionRatio: 0.8 }],
      ]);

      // sec-confidence straddles 140 (125 <= 140 <= 650), while sec-overview bottom is 120
      const active = resolveActiveNavItem(visibleItems, entriesMap, READING_LINE);
      expect(active?.tab).toBe('confidence');
    });
  });

  describe('3. ScrollSpy Controller Lifecycle & IntersectionObserver Events', () => {
    it('updates active section when IntersectionObserver reports entry changes', () => {
      const tabChanges: string[] = [];
      const controller = new ResultsScrollSpyController({
        navItems: sampleNavItems,
        defaultTab: 'overview',
        onActiveTabChange: (tab) => tabChanges.push(tab),
      });

      expect(controller.getActiveTab()).toBe('overview');

      // User scrolls down to Confidence Analysis
      controller.handleIntersectionEntries([
        {
          target: { id: 'sec-overview' },
          isIntersecting: false,
          boundingClientRect: { top: -800, bottom: -100 },
        },
        {
          target: { id: 'sec-confidence' },
          isIntersecting: true,
          boundingClientRect: { top: 120, bottom: 700 },
          intersectionRatio: 0.9,
        },
      ]);

      expect(controller.getActiveTab()).toBe('confidence');
      expect(tabChanges).toEqual(['confidence']);

      // User scrolls further down to Contrastive Analysis
      controller.handleIntersectionEntries([
        {
          target: { id: 'sec-confidence' },
          isIntersecting: false,
          boundingClientRect: { top: -600, bottom: -50 },
        },
        {
          target: { id: 'sec-contrastive' },
          isIntersecting: true,
          boundingClientRect: { top: 110, bottom: 850 },
          intersectionRatio: 0.85,
        },
      ]);

      expect(controller.getActiveTab()).toBe('contrastive');
      expect(tabChanges).toEqual(['confidence', 'contrastive']);

      controller.destroy();
    });

    it('does not emit redundant state changes when the active section remains the same', () => {
      const tabChanges: string[] = [];
      const controller = new ResultsScrollSpyController({
        navItems: sampleNavItems,
        defaultTab: 'confidence',
        onActiveTabChange: (tab) => tabChanges.push(tab),
      });

      // Same section intersecting with slight ratio difference
      controller.handleIntersectionEntries([
        {
          target: { id: 'sec-confidence' },
          isIntersecting: true,
          boundingClientRect: { top: 115, bottom: 690 },
          intersectionRatio: 0.88,
        },
      ]);

      expect(tabChanges).toHaveLength(0);
      controller.destroy();
    });
  });

  describe('4. Programmatic Navigation & Smooth Scroll Suppression', () => {
    let mockScrollIntoView: jest.Mock;
    let mockPushState: jest.Mock;

    beforeEach(() => {
      jest.useFakeTimers();
      mockScrollIntoView = jest.fn();
      mockPushState = jest.fn();

      (global as any).window = {
        location: { hash: '' },
        history: { pushState: mockPushState },
        matchMedia: jest.fn().mockReturnValue({ matches: false }),
      };

      (global as any).document = {
        getElementById: jest.fn().mockReturnValue({
          scrollIntoView: mockScrollIntoView,
        }),
      };
    });

    afterEach(() => {
      jest.useRealTimers();
      delete (global as any).window;
      delete (global as any).document;
    });

    it('scrolls to section with smooth behavior and suppresses observer flicker during transit', () => {
      const tabChanges: string[] = [];
      const controller = new ResultsScrollSpyController({
        navItems: sampleNavItems,
        defaultTab: 'overview',
        onActiveTabChange: (tab) => tabChanges.push(tab),
      });

      controller.scrollToSection('sec-responses', 'responses');

      expect(controller.getActiveTab()).toBe('responses');
      expect(controller.getIsProgrammaticScrolling()).toBe(true);
      expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
      expect(mockPushState).toHaveBeenCalledWith(null, '', '#sec-responses');

      // While programmatic scroll is in progress, intermediate sections passing by are ignored
      controller.handleIntersectionEntries([
        {
          target: { id: 'sec-confidence' },
          isIntersecting: true,
          boundingClientRect: { top: 130, bottom: 700 },
        },
      ]);

      // Remains responses! Intermediate section did NOT overwrite it
      expect(controller.getActiveTab()).toBe('responses');

      // Advance timers past 800ms programmatic window
      jest.advanceTimersByTime(850);
      expect(controller.getIsProgrammaticScrolling()).toBe(false);

      controller.destroy();
    });

    it('respects prefers-reduced-motion: reduce by using behavior="auto"', () => {
      (global as any).window.matchMedia = jest.fn().mockImplementation((query) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
      }));

      const controller = new ResultsScrollSpyController({
        navItems: sampleNavItems,
        defaultTab: 'overview',
      });

      controller.scrollToSection('sec-contrastive', 'contrastive');
      expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });

      controller.destroy();
    });

    it('releases programmatic lock immediately when user manually scrolls or touches', () => {
      const controller = new ResultsScrollSpyController({
        navItems: sampleNavItems,
        defaultTab: 'overview',
      });

      controller.scrollToSection('sec-responses', 'responses');
      expect(controller.getIsProgrammaticScrolling()).toBe(true);

      // User scrolls mouse wheel or touches screen
      controller.handleUserInterrupt();
      expect(controller.getIsProgrammaticScrolling()).toBe(false);

      controller.destroy();
    });
  });

  describe('5. URL Hash & History Navigation', () => {
    let mockScrollIntoView: jest.Mock;

    beforeEach(() => {
      mockScrollIntoView = jest.fn();
      (global as any).window = {
        location: { hash: '#sec-contrastive' },
        matchMedia: jest.fn().mockReturnValue({ matches: false }),
      };
      (global as any).document = {
        getElementById: jest.fn().mockReturnValue({
          scrollIntoView: mockScrollIntoView,
        }),
      };
    });

    afterEach(() => {
      delete (global as any).window;
      delete (global as any).document;
    });

    it('synchronizes active section when direct loading with section hash', () => {
      const controller = new ResultsScrollSpyController({
        navItems: sampleNavItems,
        defaultTab: 'overview',
      });

      const matched = controller.syncHash('#sec-contrastive');
      expect(matched).toBe(true);
      expect(controller.getActiveTab()).toBe('contrastive');
      expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });

      controller.destroy();
    });

    it('supports hash navigation using tab name directly (#responses)', () => {
      const controller = new ResultsScrollSpyController({
        navItems: sampleNavItems,
        defaultTab: 'overview',
      });

      const matched = controller.syncHash('#responses');
      expect(matched).toBe(true);
      expect(controller.getActiveTab()).toBe('responses');

      controller.destroy();
    });

    it('gracefully handles missing or non-matching hashes without error', () => {
      const controller = new ResultsScrollSpyController({
        navItems: sampleNavItems,
        defaultTab: 'overview',
      });

      const matched = controller.syncHash('#non-existent-section');
      expect(matched).toBe(false);
      expect(controller.getActiveTab()).toBe('overview');

      controller.destroy();
    });
  });

  describe('6. Boundary Scroll Detection (Top & Bottom)', () => {
    it('activates overview when user scrolls to the very top (scrollY <= 80)', () => {
      const controller = new ResultsScrollSpyController({
        navItems: sampleNavItems,
        defaultTab: 'contrastive',
      });

      controller.handleBoundaryScroll(50, 900, 3000);
      expect(controller.getActiveTab()).toBe('overview');

      controller.destroy();
    });

    it('activates detailed responses when user reaches the bottom of the document', () => {
      const controller = new ResultsScrollSpyController({
        navItems: sampleNavItems,
        defaultTab: 'overview',
      });

      // scrollY (2150) + windowHeight (900) = 3050 >= docHeight (3060) - 30
      controller.handleBoundaryScroll(2150, 900, 3060);
      expect(controller.getActiveTab()).toBe('responses');

      controller.destroy();
    });
  });

  describe('7. Observer and Listener Cleanup on Destruction', () => {
    it('disconnects observer and rejects updates after destroy() is called', () => {
      const tabChanges: string[] = [];
      const controller = new ResultsScrollSpyController({
        navItems: sampleNavItems,
        defaultTab: 'overview',
        onActiveTabChange: (tab) => tabChanges.push(tab),
      });

      controller.destroy();

      // Subsequent intersection entries must be ignored
      controller.handleIntersectionEntries([
        {
          target: { id: 'sec-confidence' },
          isIntersecting: true,
          boundingClientRect: { top: 120, bottom: 600 },
        },
      ]);

      expect(controller.getActiveTab()).toBe('overview');
      expect(tabChanges).toHaveLength(0);
    });

    it('clears all event listeners on cleanup function execution', () => {
      const addEventListenerSpy = jest.fn();
      const removeEventListenerSpy = jest.fn();

      (global as any).window = {
        location: { hash: '' },
        addEventListener: addEventListenerSpy,
        removeEventListener: removeEventListenerSpy,
      };

      const controller = new ResultsScrollSpyController({
        navItems: sampleNavItems,
      });

      const cleanup = controller.initBrowserListeners();

      expect(addEventListenerSpy).toHaveBeenCalledWith('wheel', expect.any(Function), { passive: true });
      expect(addEventListenerSpy).toHaveBeenCalledWith('touchmove', expect.any(Function), { passive: true });
      expect(addEventListenerSpy).toHaveBeenCalledWith('hashchange', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });

      cleanup();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('wheel', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('touchmove', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('hashchange', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function));

      controller.destroy();
      delete (global as any).window;
    });
  });

  describe('8. Preservation of Empty State and Report Restoration', () => {
    it('renders empty state without navigation bar when results is null and session history is empty', () => {
      mockInterviewState = {
        ...mockInterviewState,
        results: null,
        sessionHistory: [],
      };

      const html = renderToStaticMarkup(React.createElement(Results));

      expect(html).toContain('No assessment results yet');
      expect(html).toContain('Start Mock Interview');
      expect(html).toContain('Return to Dashboard');
      // Nav bar must not be rendered when no results exist
      expect(html).not.toContain('<nav aria-label="Assessment report sections"');
    });

    it('restores authentic historical report when in-memory results is null but session history exists', () => {
      mockInterviewState = {
        ...mockInterviewState,
        results: null,
        sessionHistory: [
          {
            id: 'session_hist_real_001',
            role: 'Staff Infrastructure Engineer',
            type: 'Technical',
            difficulty: 'Senior',
            date: '2026-10-25',
            score: 93,
            persona: 'sarah',
            company: 'Datadog',
            duration: 45,
            report: {
              ...standardResults,
              overallScore: 93,
            },
          },
        ],
      };

      const html = renderToStaticMarkup(React.createElement(Results));

      expect(html).toContain('93');
      expect(html).toContain('Staff Infrastructure Engineer');
      expect(html).toContain('Datadog');
      expect(html).toContain('<nav aria-label="Assessment report sections"');
      expect(html).toContain('Overview');
      expect(html).toContain('Detailed Responses');
    });
  });
});
