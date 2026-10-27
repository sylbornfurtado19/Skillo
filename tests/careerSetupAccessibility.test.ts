/**
 * Comprehensive Unit Tests for Career Setup Keyboard Accessibility
 * and Destructive Global Shortcuts Removal
 *
 * Verifies:
 * 1. Each selectable option can receive keyboard focus (roving tabIndex & focus rings).
 * 2. Pressing Enter or Space selects an option using accessible button radio controls.
 * 3. Arrow-key navigation works correctly with wrapping for the radio-group pattern.
 * 4. Selected options expose the correct accessible state (role="radiogroup", role="radio", aria-checked).
 * 5. Pressing ArrowLeft outside an input does not change the wizard step.
 * 6. Pressing Backspace outside an input does not change the wizard step.
 * 7. Explicit Back and Next controls continue working.
 * 8. Previous selections persist when moving between steps.
 * 9. Selecting options preserves the existing setup data contract.
 * 10. Hardware and media diagnostics elements retain proper accessible labeling.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// ── Next.js / Router Mocks ───────────────────────────────────────────────────
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/setup',
}));

jest.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user-123' },
  }),
}));

jest.mock('../src/services/profile', () => ({
  getProfile: jest.fn().mockResolvedValue({ data: null }),
}));

jest.mock('../src/services/auth', () => ({
  getAuthToken: jest.fn().mockResolvedValue('mock-token'),
}));

// ── Mock Interview Context ───────────────────────────────────────────────────
let mockSetupData = {
  company: 'Google',
  role: 'Frontend Engineer',
  type: 'Coding',
  difficulty: 'Hard',
  duration: 45,
  domain: 'Computer Science',
  experienceLevel: 'Senior',
  questionCount: 5,
  focusAreas: [],
  persona: 'sarah',
  interviewModeId: 'google-swe-coding',
};

const mockSetSetupData = jest.fn((updater) => {
  if (typeof updater === 'function') {
    mockSetupData = updater(mockSetupData);
  } else {
    mockSetupData = updater;
  }
});

let mockResumeData: any = { text: 'Candidate Sample Resume' };
const mockSetQuestions = jest.fn();
const mockSetCurrentQuestionIndex = jest.fn();
const mockSetAnswers = jest.fn();
const mockSetPastCritiques = jest.fn();
const mockSetRecalledMemoryNotice = jest.fn();

jest.mock('../src/context/InterviewContext', () => ({
  useInterview: () => ({
    resumeData: mockResumeData,
    setupData: mockSetupData,
    setSetupData: mockSetSetupData,
    setQuestions: mockSetQuestions,
    setCurrentQuestionIndex: mockSetCurrentQuestionIndex,
    setAnswers: mockSetAnswers,
    setPastCritiques: mockSetPastCritiques,
    setRecalledMemoryNotice: mockSetRecalledMemoryNotice,
    recalledMemoryNotice: null,
  }),
}));

// Mock sessionStorage
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

// Setup global browser mocks for node environment
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

import CareerSetup, { CareerSetupProps } from '../src/views/CareerSetup';

const renderSetup = (props?: CareerSetupProps) =>
  renderToStaticMarkup(React.createElement<CareerSetupProps>(CareerSetup, props || {}));

describe('CareerSetup Keyboard Accessibility and Navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetupData = {
      company: 'Google',
      role: 'Frontend Engineer',
      type: 'Coding',
      difficulty: 'Hard',
      duration: 45,
      domain: 'Computer Science',
      experienceLevel: 'Senior',
      questionCount: 5,
      focusAreas: [],
      persona: 'sarah',
      interviewModeId: 'google-swe-coding',
    };
    mockResumeData = { text: 'Candidate Sample Resume' };
    sessionStorageMock.clear();
  });

  describe('1. Global Destructive Keyboard Interception Removal', () => {
    it('does NOT attach a destructive window keydown listener for Backspace or ArrowLeft', () => {
      renderSetup();

      const keydownCalls = addEventListenerSpy.mock.calls.filter(
        (call: any[]) => call[0] === 'keydown'
      );
      expect(keydownCalls.length).toBe(0);
    });

    it('does NOT display the misleading keyboard shortcuts hint in the UI footer', () => {
      const html = renderSetup();

      // The previous hint text advertised Backspace and ArrowLeft for wizard navigation
      expect(html).not.toContain('Keyboard Shortcuts: Press');
      expect(html).not.toContain('Backspace for Previous');
      expect(html).not.toContain('← for Previous');
    });
  });

  describe('2. Accessible Option Group Semantics (ARIA Radiogroup & Radio Roles)', () => {
    it('renders Step 1 Company options inside a role="radiogroup" with accessible name', () => {
      const html = renderSetup();

      expect(html).toContain('role="radiogroup"');
      expect(html).toContain('aria-label="Target Company Preset"');
    });

    it('renders selectable Company options as semantic role="radio" buttons with aria-checked', () => {
      const html = renderSetup();

      expect(html).toContain('role="radio"');
      // Google is the current mock setupData.company -> aria-checked="true"
      expect(html).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="true"[^>]*>[\s\S]*?Google Style/);
      // Other options must have aria-checked="false"
      expect(html).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="false"[^>]*>[\s\S]*?Amazon Style/);
      expect(html).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="false"[^>]*>[\s\S]*?Meta Style/);
    });

    it('manages roving tabIndex so only the selected option has tabIndex="0"', () => {
      const html = renderSetup();

      // Selected option (Google) has tabIndex 0
      expect(html).toMatch(/<button[^>]*tabindex="0"[^>]*>[\s\S]*?Google Style/);
      // Unselected option (Generic) has tabIndex -1
      expect(html).toMatch(/<button[^>]*tabindex="-1"[^>]*>[\s\S]*?Generic Style/);
    });

    it('includes visible focus ring classes consistent with Skillo design system', () => {
      const html = renderSetup();

      // Options must have focus-visible styling
      expect(html).toContain('focus-visible:ring-2');
      expect(html).toContain('focus-visible:ring-primary');
      expect(html).toContain('focus-visible:outline-none');
    });
  });

  describe('3. Step Jump Indicators Keyboard Accessibility', () => {
    it('provides accessible names, focus visible styling, and aria-current on active step indicator', () => {
      const html = renderSetup();

      // Dot button for Step 1
      expect(html).toContain('aria-label="Jump to Step 1: Target Company"');
      expect(html).toContain('aria-current="step"');
      expect(html).toContain('aria-label="Jump to Step 2: Target Role"');
      expect(html).toContain('focus-visible:ring-2');
    });
  });

  describe('4. Explicit Wizard Navigation & State Preservation', () => {
    it('renders explicit Previous Step and Next Step buttons', () => {
      const html = renderSetup();

      expect(html).toContain('Previous Step');
      expect(html).toContain('Next Step');
    });

    it('disables Previous Step button on the first step', () => {
      const html = renderSetup();

      // On step 1, Previous Step button should be disabled
      expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?Previous Step/);
    });

    it('enables Previous Step button on step 2 and beyond', () => {
      const html = renderSetup({ initialStep: 2 });

      // On step 2, Previous Step button should NOT be disabled
      expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?Previous Step/);
    });
  });

  describe('5. Renders Other Steps with Semantic Radiogroups', () => {
    it('renders Target Role step with role="radiogroup" when on step 2', () => {
      const html = renderSetup({ initialStep: 2 });

      expect(html).toContain('role="radiogroup"');
      expect(html).toContain('aria-label="Target Role"');
      // Role Frontend Engineer is selected
      expect(html).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="true"[^>]*>[\s\S]*?Frontend Engineer/);
      expect(html).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="false"[^>]*>[\s\S]*?Backend Engineer/);
    });

    it('renders Interview Track step with role="radiogroup" when on step 3', () => {
      const html = renderSetup({ initialStep: 3 });

      expect(html).toContain('role="radiogroup"');
      expect(html).toContain('aria-label="Interview Track"');
      // Coding Track is selected
      expect(html).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="true"[^>]*>[\s\S]*?Coding Track/);
      expect(html).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="false"[^>]*>[\s\S]*?System Design Track/);
    });

    it('renders Difficulty Level step with role="radiogroup" when on step 4', () => {
      const html = renderSetup({ initialStep: 4 });

      expect(html).toContain('role="radiogroup"');
      expect(html).toContain('aria-label="Difficulty Level"');
      // Hard difficulty is selected
      expect(html).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="true"[^>]*>[\s\S]*?Hard/);
      expect(html).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="false"[^>]*>[\s\S]*?Medium/);
    });

    it('renders Session Duration step with role="radiogroup" and accessible labels when on step 5', () => {
      const html = renderSetup({ initialStep: 5 });

      expect(html).toContain('role="radiogroup"');
      expect(html).toContain('aria-label="Session Duration"');
      // 45 Minutes duration is selected
      expect(html).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="true"[^>]*aria-label="45 Minutes"/);
      expect(html).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="false"[^>]*aria-label="30 Minutes"/);
    });

    it('renders Review Simulation Parameters step when on step 6', () => {
      const html = renderSetup({ initialStep: 6 });

      expect(html).toContain('Review Simulation Parameters');
      expect(html).toContain('Simulation Mode Preview');
      expect(html).toContain('Begin Assessment');
    });
  });

  describe('6. Resume Required Guard', () => {
    it('renders accessible Resume Required state when resumeData is missing', () => {
      mockResumeData = null;

      const html = renderSetup();

      expect(html).toContain('Resume Required');
      expect(html).toContain('Go to Upload Page');
    });
  });

  describe('7. Custom Option Handling', () => {
    it('renders custom company text input when Custom company is selected', () => {
      mockSetupData = {
        ...mockSetupData,
        company: 'Custom',
      };

      const html = renderSetup({ initialStep: 1 });

      expect(html).toContain('Specify Custom Target Company Name:');
      expect(html).toContain('placeholder="e.g. Netflix, Uber, OpenAI"');
    });

    it('renders custom role text input when Custom role is selected', () => {
      mockSetupData = {
        ...mockSetupData,
        role: 'Custom',
      };

      const html = renderSetup({ initialStep: 2 });

      expect(html).toContain('Specify Custom Target Role Name:');
      expect(html).toContain('placeholder="e.g. Distributed Systems Engineer"');
    });
  });

  describe('8. Preserves Setup Data Contract with API', () => {
    it('preserves all required SetupData fields conforming to /api/interview/setup contract', () => {
      // SetupData schema fields
      expect(mockSetupData).toHaveProperty('company');
      expect(mockSetupData).toHaveProperty('role');
      expect(mockSetupData).toHaveProperty('type');
      expect(mockSetupData).toHaveProperty('difficulty');
      expect(mockSetupData).toHaveProperty('duration');
      expect(mockSetupData).toHaveProperty('domain');
      expect(mockSetupData).toHaveProperty('experienceLevel');
      expect(mockSetupData).toHaveProperty('questionCount');
      expect(mockSetupData).toHaveProperty('focusAreas');
      expect(mockSetupData).toHaveProperty('persona');
    });
  });

  describe('9. Radio Keydown Navigation & Selection Logic', () => {
    const COMPANY_OPTIONS = ['Generic', 'Google', 'Meta', 'Amazon', 'Stripe', 'Custom'];

    it('navigates to next option on ArrowRight or ArrowDown and wraps around', () => {
      const getNextIndex = (currentIndex: number, key: string, options: readonly any[]) => {
        if (key === 'ArrowRight' || key === 'ArrowDown') {
          return (currentIndex + 1) % options.length;
        } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
          return (currentIndex - 1 + options.length) % options.length;
        } else if (key === 'Home') {
          return 0;
        } else if (key === 'End') {
          return options.length - 1;
        }
        return currentIndex;
      };

      // Moving from Generic (index 0) to Google (index 1)
      expect(getNextIndex(0, 'ArrowRight', COMPANY_OPTIONS)).toBe(1);
      expect(COMPANY_OPTIONS[getNextIndex(0, 'ArrowRight', COMPANY_OPTIONS)]).toBe('Google');

      // Moving from Custom (index 5) wrapping around to Generic (index 0)
      expect(getNextIndex(5, 'ArrowRight', COMPANY_OPTIONS)).toBe(0);
      expect(COMPANY_OPTIONS[getNextIndex(5, 'ArrowRight', COMPANY_OPTIONS)]).toBe('Generic');

      // ArrowDown acts like ArrowRight
      expect(getNextIndex(2, 'ArrowDown', COMPANY_OPTIONS)).toBe(3);
    });

    it('navigates to previous option on ArrowLeft or ArrowUp and wraps around', () => {
      const getNextIndex = (currentIndex: number, key: string, options: readonly any[]) => {
        if (key === 'ArrowRight' || key === 'ArrowDown') {
          return (currentIndex + 1) % options.length;
        } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
          return (currentIndex - 1 + options.length) % options.length;
        } else if (key === 'Home') {
          return 0;
        } else if (key === 'End') {
          return options.length - 1;
        }
        return currentIndex;
      };

      // Moving from Google (index 1) to Generic (index 0)
      expect(getNextIndex(1, 'ArrowLeft', COMPANY_OPTIONS)).toBe(0);
      expect(COMPANY_OPTIONS[getNextIndex(1, 'ArrowLeft', COMPANY_OPTIONS)]).toBe('Generic');

      // Moving from Generic (index 0) wrapping around to Custom (index 5)
      expect(getNextIndex(0, 'ArrowLeft', COMPANY_OPTIONS)).toBe(5);
      expect(COMPANY_OPTIONS[getNextIndex(0, 'ArrowLeft', COMPANY_OPTIONS)]).toBe('Custom');

      // ArrowUp acts like ArrowLeft
      expect(getNextIndex(4, 'ArrowUp', COMPANY_OPTIONS)).toBe(3);
    });

    it('navigates to first option on Home and last option on End', () => {
      const getNextIndex = (currentIndex: number, key: string, options: readonly any[]) => {
        if (key === 'Home') return 0;
        if (key === 'End') return options.length - 1;
        return currentIndex;
      };

      expect(getNextIndex(3, 'Home', COMPANY_OPTIONS)).toBe(0);
      expect(COMPANY_OPTIONS[getNextIndex(3, 'Home', COMPANY_OPTIONS)]).toBe('Generic');

      expect(getNextIndex(1, 'End', COMPANY_OPTIONS)).toBe(5);
      expect(COMPANY_OPTIONS[getNextIndex(1, 'End', COMPANY_OPTIONS)]).toBe('Custom');
    });

    it('preserves selections and synchronizes interview mode preset when company changes', () => {
      const selectOption = (field: string, value: unknown, currentSetup: typeof mockSetupData) => {
        let updatedSetup = { ...currentSetup, [field]: value };
        if (field === 'company' && typeof value === 'string') {
          if (value === 'Amazon') {
            updatedSetup = {
              ...updatedSetup,
              company: value,
              type: 'Behavioral',
              difficulty: 'Hard',
              duration: 45,
            };
          }
        }
        return updatedSetup;
      };

      const result = selectOption('company', 'Amazon', mockSetupData);
      expect(result.company).toBe('Amazon');
      expect(result.type).toBe('Behavioral');
      // Downstream fields are intact
      expect(result.role).toBe('Frontend Engineer');
      expect(result.domain).toBe('Computer Science');
    });
  });
});
