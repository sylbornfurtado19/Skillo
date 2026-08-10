/**
 * Unit Tests for Company & Role-Specific Interview Simulator Modes
 * Covers: Preset configuration lookup, fallback logic, resolution rules, question pools.
 */

import {
  INTERVIEW_MODE_PRESETS,
  resolveInterviewMode,
} from '../src/types/interviewModes';
import { getQuestionsForSetup } from '../src/services/constants';

describe('Company & Role-Specific Interview Simulator Modes', () => {
  describe('INTERVIEW_MODE_PRESETS Registry', () => {
    it('should contain all required company presets', () => {
      expect(INTERVIEW_MODE_PRESETS['google-swe-coding']).toBeDefined();
      expect(INTERVIEW_MODE_PRESETS['meta-swe-coding']).toBeDefined();
      expect(INTERVIEW_MODE_PRESETS['amazon-behavioral']).toBeDefined();
      expect(INTERVIEW_MODE_PRESETS['stripe-backend']).toBeDefined();
      expect(INTERVIEW_MODE_PRESETS['generic-technical']).toBeDefined();
    });

    it('Google preset should have proper algorithmic rubric weights', () => {
      const googleMode = INTERVIEW_MODE_PRESETS['google-swe-coding'];
      expect(googleMode.company).toBe('Google');
      expect(googleMode.interviewType).toBe('Coding');
      expect(googleMode.evaluationRubric.technicalWeight).toBe(0.45);
      expect(googleMode.skillsEvaluated).toContain('Big-O Analysis');
    });

    it('Amazon preset should emphasize behavioral & STAR framework', () => {
      const amazonMode = INTERVIEW_MODE_PRESETS['amazon-behavioral'];
      expect(amazonMode.company).toBe('Amazon');
      expect(amazonMode.interviewType).toBe('Behavioral');
      expect(amazonMode.evaluationRubric.communicationWeight).toBe(0.50);
      expect(amazonMode.skillsEvaluated).toContain('Customer Obsession');
    });

    it('Stripe preset should emphasize system design & idempotency', () => {
      const stripeMode = INTERVIEW_MODE_PRESETS['stripe-backend'];
      expect(stripeMode.company).toBe('Stripe');
      expect(stripeMode.interviewType).toBe('System Design');
      expect(stripeMode.evaluationRubric.architectureWeight).toBe(0.40);
      expect(stripeMode.skillsEvaluated).toContain('Idempotency');
    });
  });

  describe('resolveInterviewMode Helper & Fallbacks', () => {
    it('should resolve preset directly by valid interviewModeId', () => {
      const mode = resolveInterviewMode({ interviewModeId: 'google-swe-coding' });
      expect(mode.id).toBe('google-swe-coding');
      expect(mode.company).toBe('Google');
    });

    it('should resolve matching preset based on company string', () => {
      const mode = resolveInterviewMode({ company: 'Meta' });
      expect(mode.company).toBe('Meta');
      expect(mode.id).toBe('meta-swe-coding');
    });

    it('should fallback cleanly to Generic technical mode when no setup parameters are provided', () => {
      const mode = resolveInterviewMode({});
      expect(mode.company).toBe('Generic');
      expect(mode.interviewType).toBe('Technical');
      expect(mode.difficulty).toBe('Medium');
      expect(mode.duration).toBe(45);
    });

    it('should preserve custom role, difficulty, and duration overrides', () => {
      const mode = resolveInterviewMode({
        company: 'Google',
        role: 'Frontend Engineer',
        difficulty: 'Expert',
        duration: 60,
      });
      expect(mode.company).toBe('Google');
      expect(mode.role).toBe('Frontend Engineer');
      expect(mode.difficulty).toBe('Expert');
      expect(mode.duration).toBe(60);
    });
  });

  describe('Mode-Aware Question Pool Resolution', () => {
    it('should return company-specific questions when company is selected', () => {
      const questions = getQuestionsForSetup({ company: 'Google', questionCount: 3 });
      expect(questions.length).toBe(3);
      expect(questions[0].question).toContain('[Google Coding]');
    });

    it('should fallback to domain questions when company is Generic', () => {
      const questions = getQuestionsForSetup({ company: 'Generic', domain: 'Computer Science', questionCount: 5 });
      expect(questions.length).toBe(5);
      expect(questions[0].question).toBeDefined();
    });
  });
});
