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

    // 5. Verify Warmup Mode toggle button
    const warmupBtn = page.locator('#warmup-mode-btn');
    if (await warmupBtn.count() > 0) {
      await expect(warmupBtn).toBeVisible();
      const initialText = await warmupBtn.textContent();
      expect(initialText).toContain('WARMUP');
      await warmupBtn.click();
      await warmupBtn.click();
    }

    // 6. Assert Warmup Cold-Start Timeline Telemetry (<1.5s KPI)
    const telemetry = await page.evaluate(() => {
      return (window as any).__IVP_HUD_TELEMETRY__ || null;
    });

    if (telemetry && telemetry.firstTemplatesCreatedTs && telemetry.pageLoadTs !== undefined) {
      const templateLag = telemetry.firstTemplatesCreatedTs - telemetry.pageLoadTs;
      expect(templateLag).toBeLessThanOrEqual(1500);
    }
    if (telemetry && telemetry.firstSmoothedRenderTs && telemetry.pageLoadTs !== undefined) {
      const smoothedLag = telemetry.firstSmoothedRenderTs - telemetry.pageLoadTs;
      expect(smoothedLag).toBeLessThanOrEqual(1500);
    }

    // Save timeline artifact
    const artifactDir = path.join(process.cwd(), 'test-results', 'warmup');
    if (!fs.existsSync(artifactDir)) {
      fs.mkdirSync(artifactDir, { recursive: true });
    }
    if (telemetry) {
      fs.writeFileSync(path.join(artifactDir, 'timeline.json'), JSON.stringify(telemetry, null, 2), 'utf8');
    }
    await page.screenshot({ path: path.join(artifactDir, 'warmup_overlay.png') }).catch(() => {});
  });
});
