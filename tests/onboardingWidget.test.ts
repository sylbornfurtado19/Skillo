/**
 * Unit Tests for Interactive Onboarding Progress Tracker Widget
 * Covers: Progress calculation (0%, 33%, 66%, 100%), active step resolution, and step state logic.
 */

import { calculateOnboardingProgress } from '../src/components/dashboard/OnboardingProgressWidget';

describe('Onboarding Progress Tracker Widget', () => {
  it('should calculate 0% progress and active step 1 when candidate has done nothing', () => {
    const result = calculateOnboardingProgress(false, false, false);
    expect(result.completedCount).toBe(0);
    expect(result.percentage).toBe(0);
    expect(result.activeStep).toBe(1);
  });

  it('should calculate 33% progress and active step 2 when resume is uploaded', () => {
    const result = calculateOnboardingProgress(true, false, false);
    expect(result.completedCount).toBe(1);
    expect(result.percentage).toBe(33);
    expect(result.activeStep).toBe(2);
  });

  it('should calculate 66% progress and active step 3 when resume and setup are configured', () => {
    const result = calculateOnboardingProgress(true, true, false);
    expect(result.completedCount).toBe(2);
    expect(result.percentage).toBe(67);
    expect(result.activeStep).toBe(3);
  });

  it('should calculate 100% progress and active step 4 when all 3 steps are completed', () => {
    const result = calculateOnboardingProgress(true, true, true);
    expect(result.completedCount).toBe(3);
    expect(result.percentage).toBe(100);
    expect(result.activeStep).toBe(4);
  });
});
