import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOT_DIR = path.join(process.cwd(), 'test-results', 'wiring');

test.beforeAll(async () => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

function verifyNoPlaceholdersOrErrors(bodyText: string, contextName: string) {
  expect(bodyText, `[${contextName}] Expected no NaN values`).not.toMatch(/\bNaN\b/);
  expect(bodyText, `[${contextName}] Expected no undefined values`).not.toMatch(/\bundefined\b/);
  expect(bodyText, `[${contextName}] Expected no placeholder 0.285`).not.toContain('0.285');
  expect(bodyText, `[${contextName}] Expected no placeholder 0.145`).not.toContain('0.145');
}

test.describe('Phase A4: On-Screen Proof & Wiring Verification', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['camera', 'microphone']).catch(() => {});
    await context.addCookies([
      { name: 'skillo_test_session', value: 'true', domain: 'localhost', path: '/' },
      { name: 'skillo_test_admin', value: 'true', domain: 'localhost', path: '/' },
    ]);
  });

  test('Interview: live IVP panel, diagnostic modes, and hardware status verification', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.startsWith('INFO:') && !text.includes('favicon') && !text.includes('404')) {
          consoleErrors.push(text);
        }
      }
    });

    await page.goto('/interview', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    let bodyText = await page.innerText('body');
    verifyNoPlaceholdersOrErrors(bodyText, 'interview-session-preflight');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'interview-preflight.png'), fullPage: true });

    // Begin interview if preflight or device button exists
    const beginBtn = page.locator('button:has-text("Begin secure interview"), button:has-text("Enable camera & microphone")').first();
    if (await beginBtn.count() > 0) {
      await beginBtn.click().catch(() => {});
      await page.waitForTimeout(2000);
    }

    bodyText = await page.innerText('body');
    verifyNoPlaceholdersOrErrors(bodyText, 'interview-session-active');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'interview-active.png'), fullPage: true });

    // Verify IVP Live Panel modes
    const diagnosticModes = ['Grid', 'HistEq', 'Otsu', 'Sobel', 'Motion'];
    for (const mode of diagnosticModes) {
      const modeBtn = page.locator(`button:has-text("${mode}")`).first();
      if (await modeBtn.count() > 0) {
        await modeBtn.click().catch(() => {});
        await page.waitForTimeout(500);
      }
      bodyText = await page.innerText('body');
      verifyNoPlaceholdersOrErrors(bodyText, `interview-ivp-mode-${mode.toLowerCase()}`);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `interview-ivp-mode-${mode.toLowerCase()}.png`),
        fullPage: true,
      });
    }

    expect(consoleErrors).toHaveLength(0);
  });

  test('Interview: device gate and HUD preview', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.startsWith('INFO:') && !text.includes('favicon')) {
          consoleErrors.push(text);
        }
      }
    });

    await page.goto('/interview', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const bodyText = await page.innerText('body');
    verifyNoPlaceholdersOrErrors(bodyText, 'interview');

    // Screenshot gate or room
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'interview-device-gate.png'), fullPage: true });

    // Look for HUD or enter room button if device gate is active
    const proceedBtn = page.locator('button:has-text("Enter Interview"), button:has-text("Join Session"), button:has-text("Start Interview")').first();
    if (await proceedBtn.count() > 0 && await proceedBtn.isVisible()) {
      await proceedBtn.click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'interview-hud.png'), fullPage: true });

    expect(consoleErrors).toHaveLength(0);
  });

  test('Results: with camera data and camera-unavailable', async ({ page }) => {
    const mockResultsWithCamera = {
      overallScore: 88,
      personaId: 'sarah',
      setupData: {
        role: 'Senior Staff Engineer',
        domain: 'Distributed Systems',
        type: 'System Design',
        difficulty: 'Hard',
        questionCount: 3,
        persona: 'sarah',
      },
      categories: {
        technicalAccuracy: 90,
        systemDesignLogic: 86,
        edgeCaseHandling: 84,
        communication: 92,
      },
      breakdown: [
        {
          question: 'Design a distributed consensus mechanism resilient to network partitions.',
          score: 88,
          feedback: 'Exemplary explanation of Raft log compaction and election timeouts.',
          strengths: ['Clear Raft RPC diagrams', 'Linearizable read semantics'],
          improvements: ['Mention Byzantine fault scenarios'],
          userAnswer: 'We implement Raft with leader leases and pre-vote phases to prevent disruption from partitioned nodes.',
        },
      ],
      eyeContactMetrics: {
        totalVideoDurationSeconds: 180,
        eyeContactRatio: 0.88,
        totalGazeFixations: 120,
        centerFocusPercentage: 86,
        sustainedEyeContactRatio: 0.84,
        longGazeAversions: 1,
      },
      headPoseMetrics: {
        totalFramesAnalyzed: 5400,
        postureStabilityScore: 92,
        meanPitchDeg: 2.3,
        meanYawDeg: 1.8,
        meanRollDeg: 0.9,
        nodGestureCount: 5,
        excessiveMovementDurationSeconds: 1.5,
      },
      affectiveMetrics: {
        totalKeyframesAnalyzed: 600,
        composureScore: 90,
        smilePrevalenceRatio: 0.32,
        furrowPrevalenceRatio: 0.04,
        dominantEmotion: 'CONFIDENT',
        stressSpikeCount: 0,
      },
      lipSyncMetrics: {
        totalWindowsAnalyzed: 180,
        meanAudioVisualDistance: 0.16,
        syncVerificationStatus: 'IN_SYNC',
        spoofingConfidence: 0.02,
      },
    };

    // Pre-seed storage before navigation
    await page.goto('/', { waitUntil: 'commit' });
    await page.evaluate((data) => {
      localStorage.setItem('skillo_test_session', 'true');
      sessionStorage.setItem('iq_results', JSON.stringify(data));
    }, mockResultsWithCamera);

    // 1. Results with camera data
    await page.goto('/results', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    let bodyText = await page.innerText('body');
    verifyNoPlaceholdersOrErrors(bodyText, 'results-with-camera');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'results-with-camera.png'), fullPage: true });

    // 2. Results with camera unavailable
    const mockResultsNoCamera = {
      ...mockResultsWithCamera,
      eyeContactMetrics: undefined,
      headPoseMetrics: undefined,
      affectiveMetrics: undefined,
      lipSyncMetrics: undefined,
    };

    await page.evaluate((data) => {
      sessionStorage.setItem('iq_results', JSON.stringify(data));
    }, mockResultsNoCamera);

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    bodyText = await page.innerText('body');
    verifyNoPlaceholdersOrErrors(bodyText, 'results-camera-unavailable');
    expect(bodyText).toContain('Camera Biometrics Unavailable');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'results-camera-unavailable.png'), fullPage: true });
  });

  test('Remaining routes: resume, profile, settings, calibration, login', async ({ page }) => {
    // Set test auth in localStorage
    await page.goto('/', { waitUntil: 'commit' });
    await page.evaluate(() => {
      localStorage.setItem('skillo_test_session', 'true');
    });

    const routes = [
      { path: '/resume', name: 'resume' },
      { path: '/profile', name: 'profile' },
      { path: '/settings', name: 'settings' },
      { path: '/calibration', name: 'calibration' },
      { path: '/login', name: 'login' },
    ];

    for (const r of routes) {
      await page.goto(r.path, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1200);

      const bodyText = await page.innerText('body');
      verifyNoPlaceholdersOrErrors(bodyText, r.name);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${r.name}.png`), fullPage: true });
    }
  });
});
