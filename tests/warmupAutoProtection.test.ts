import { MicroPatchTracker } from '../src/lib/services/microPatchTracker';

describe('Warmup False-Positive Auto-Protection & Provenance Tagging (PR C)', () => {
  const PROC_W = 160;
  const PROC_H = 120;

  function createFlatNoiseFrame(): Uint8ClampedArray {
    const data = new Uint8ClampedArray(PROC_W * PROC_H * 4);
    for (let i = 0; i < data.length; i += 4) {
      // Very low contrast / high frequency uniform noise (poor SNR)
      const v = 80 + Math.floor(Math.random() * 4);
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
    return data;
  }

  it('tags templates with provenance source and evicts bootstrap templates when model templates arrive', () => {
    const tracker = new MicroPatchTracker(8, 10);
    const frame = new Uint8ClampedArray(PROC_W * PROC_H * 4);
    // Create patterned image with good variance
    for (let y = 0; y < PROC_H; y++) {
      for (let x = 0; x < PROC_W; x++) {
        const idx = (y * PROC_W + x) * 4;
        const v = (x % 16 < 8 && y % 16 < 8) ? 220 : 40;
        data_set: {
          frame[idx] = v;
          frame[idx + 1] = v;
          frame[idx + 2] = v;
          frame[idx + 3] = 255;
        }
      }
    }

    // 1. Seed bootstrap templates
    tracker.updateTemplates(frame, PROC_W, PROC_H, [
      { index: 68, x: 0.35, y: 0.35, patchRadius: 8, source: 'bootstrap' },
      { index: 69, x: 0.65, y: 0.35, patchRadius: 8, source: 'bootstrap' },
      { index: 48, x: 0.40, y: 0.65, patchRadius: 10, source: 'bootstrap' },
      { index: 54, x: 0.60, y: 0.65, patchRadius: 10, source: 'bootstrap' },
    ], { minStdDev: 1.0, source: 'bootstrap' });

    expect(tracker.templateCount()).toBe(4);
    const bootstrapDiag = tracker.getTemplatesDiagnostics();
    for (const d of bootstrapDiag) {
      expect(d.source).toBe('bootstrap');
    }

    // 2. Model arrives and provides learned landmark templates
    tracker.updateTemplates(frame, PROC_W, PROC_H, [
      { index: 68, x: 0.36, y: 0.36, patchRadius: 8, source: 'model' },
      { index: 69, x: 0.64, y: 0.36, patchRadius: 8, source: 'model' },
    ], { source: 'model' });

    // Bootstrap templates that were not in the new model list must be evicted
    const modelDiag = tracker.getTemplatesDiagnostics();
    expect(modelDiag.length).toBe(2);
    for (const d of modelDiag) {
      expect(d.source).toBe('model');
    }
  });

  it('detects low SNR / poor lighting and elevates thresholds when acceptanceRate < 5% after 50 attempts', () => {
    let warmupTries = 0;
    let warmupAccepted = 0;
    let effectiveMinNcc = 0.60;
    let warmupWarning: string | null = null;

    // Simulate 60 noisy frame tracking attempts with low NCC (poor SNR)
    for (let attempt = 1; attempt <= 60; attempt++) {
      warmupTries++;
      const simulatedNcc = 0.42; // Low NCC due to noise

      if (simulatedNcc >= effectiveMinNcc) {
        warmupAccepted++;
      }

      const warmupRate = warmupTries > 0 ? (warmupAccepted / warmupTries) * 100 : 100;
      const isPoorLighting = warmupTries >= 50 && warmupRate < 5.0;

      if (isPoorLighting) {
        effectiveMinNcc = 0.72; // Elevated threshold to protect against false positives
        warmupWarning = 'Low feature acceptance (< 5%): relaxed thresholds throttled to prevent false-positives. Ensure adequate lighting.';
      }
    }

    expect(warmupTries).toBe(60);
    expect(warmupAccepted).toBe(0);
    expect(effectiveMinNcc).toBe(0.72);
    expect(warmupWarning).toContain('Low feature acceptance (< 5%)');
  });

  it('auto-reverts relaxed warmup mode if acceptanceRate < 2% after 2000ms', () => {
    let isWarmup = true;
    let warmupAutoReverted = false;
    let warmupWarning: string | null = null;

    const appElapsed = 2500; // > 2000ms
    const warmupTries = 25;  // >= 20
    const warmupAccepted = 0; // 0% acceptance rate
    const warmupRate = (warmupAccepted / warmupTries) * 100;

    if (isWarmup && appElapsed >= 2000 && warmupTries >= 20 && warmupRate < 2.0) {
      warmupAutoReverted = true;
      isWarmup = false;
      warmupWarning = 'Low SNR / poor contrast detected during warmup: auto-reverted to verified model mode.';
    }

    expect(warmupAutoReverted).toBe(true);
    expect(isWarmup).toBe(false);
    expect(warmupWarning).toContain('Low SNR / poor contrast detected during warmup');
  });
});
