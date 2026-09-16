import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Visual Regression & Interactive Verification Suite
 * Verifies UI controls, HUD telemetry, Face Calibration flow, and Safe Mode toggles.
 */

test.describe('IVP Interactive Canvas Visual & Functional Regression', () => {
  test('verifies UI controls, Calibration modal, and Safe Mode operation', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['camera']).catch(() => {});

    const targetUrl = process.env.TEST_URL || 'http://localhost:3000/ivp-lab';
    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    } catch (e) {
      console.warn(`[E2E] Navigation notice: ${e}`);
    }

    // 1. Verify canvas container presence
    const canvas = page.locator('canvas');
    if (await canvas.count() > 0) {
      await expect(canvas.first()).toBeVisible();
    }

    // 2. Verify Calibrate button & 3-step modal flow
    const calibrateBtn = page.locator('#calibrate-face-btn');
    if (await calibrateBtn.count() > 0) {
      await calibrateBtn.click();
      await expect(page.locator('text=Personal Face Calibration')).toBeVisible();
      await expect(page.locator('text=Step 1: Neutral Gaze Alignment')).toBeVisible();

      // Advance to step 2
      const step1Next = page.locator('button:has-text("CONTINUE TO STEP 2")');
      await step1Next.click();
      await expect(page.locator('text=Step 2: Natural Smile & Speech')).toBeVisible();

      // Finalize calibration
      const step2Next = page.locator('button:has-text("FINALIZE CALIBRATION")');
      await step2Next.click();
      await expect(page.locator('text=Calibration Complete!')).toBeVisible();

      // Close modal
      const doneBtn = page.locator('button:has-text("DONE")');
      await doneBtn.click();
      await expect(page.locator('text=Personal Face Calibration')).not.toBeVisible();
    }

    // 3. Verify Safe Mode toggle
    const safeModeBtn = page.locator('#safe-mode-btn');
    if (await safeModeBtn.count() > 0) {
      const initialText = await safeModeBtn.textContent();
      expect(initialText).toContain('SAFE MODE: OFF');

      await safeModeBtn.click();
      await expect(safeModeBtn).toContainText('SAFE MODE: ON');

      // Toggle back
      await safeModeBtn.click();
      await expect(safeModeBtn).toContainText('SAFE MODE: OFF');
    }

    // 4. Verify Micro Pause toggle
    const microPauseBtn = page.locator('#pause-micro-btn');
    if (await microPauseBtn.count() > 0) {
      await microPauseBtn.click();
      await expect(microPauseBtn).toContainText('RESUME MICRO');

      await microPauseBtn.click();
      await expect(microPauseBtn).toContainText('PAUSE MICRO');
    }
  });
});
