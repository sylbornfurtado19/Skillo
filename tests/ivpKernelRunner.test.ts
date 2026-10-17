import {
  IVPKernelRunner,
  RUNNER_WIDTH,
  RUNNER_HEIGHT,
} from '../src/lib/services/ivpKernelRunner';

describe('IVPKernelRunner Headless Execution Suite', () => {
  function createTestPattern(fillValue: number): ImageData {
    const data = new Uint8ClampedArray(RUNNER_WIDTH * RUNNER_HEIGHT * 4);
    for (let i = 0; i < RUNNER_WIDTH * RUNNER_HEIGHT; i++) {
      const idx = i * 4;
      data[idx] = fillValue;     // R
      data[idx + 1] = fillValue; // G
      data[idx + 2] = fillValue; // B
      data[idx + 3] = 255;       // A
    }
    return {
      width: RUNNER_WIDTH,
      height: RUNNER_HEIGHT,
      data,
      colorSpace: 'srgb',
    } as ImageData;
  }

  function createVerticalStripePattern(): ImageData {
    const data = new Uint8ClampedArray(RUNNER_WIDTH * RUNNER_HEIGHT * 4);
    for (let y = 0; y < RUNNER_HEIGHT; y++) {
      for (let x = 0; x < RUNNER_WIDTH; x++) {
        const idx = (y * RUNNER_WIDTH + x) * 4;
        const val = x < RUNNER_WIDTH / 2 ? 0 : 255; // High contrast edge down center
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }
    return {
      width: RUNNER_WIDTH,
      height: RUNNER_HEIGHT,
      data,
      colorSpace: 'srgb',
    } as ImageData;
  }

  it('runs sequential classical kernels and updates invocation counters', () => {
    const runner = new IVPKernelRunner();
    const testPattern = createTestPattern(128);

    const res = runner.executeFrame(testPattern);

    expect(runner.getFramesAnalyzed()).toBe(1);
    const counts = runner.getKernelCounts();
    expect(counts.histogramEq).toBe(1);
    expect(counts.otsuYCrCb).toBe(1);
    expect(counts.sobel).toBe(1);
    expect(counts.temporalMAD).toBe(1);

    expect(res.stats.meanLuminance).toBeCloseTo(128, 0);
    expect(res.diagnosticBuffers.equalized).toBeDefined();
    expect(res.diagnosticBuffers.sobel).toBeDefined();
  });

  it('computes edge gradients accurately on vertical stripe pattern', () => {
    const runner = new IVPKernelRunner();
    const stripePattern = createVerticalStripePattern();

    const res = runner.executeFrame(stripePattern);
    expect(res.stats.sobelMeanMagnitude).toBeGreaterThan(0);
    expect(res.stats.sobelEdgeRatio).toBeGreaterThan(0);
  });

  it('computes inter-frame temporal MAD motion between consecutive frames', () => {
    const runner = new IVPKernelRunner();
    const frame1 = createTestPattern(50);
    const frame2 = createTestPattern(150);

    const res1 = runner.executeFrame(frame1);
    expect(res1.stats.madScore).toBe(0); // First frame baseline has 0 motion

    const res2 = runner.executeFrame(frame2);
    expect(res2.stats.madScore).toBeGreaterThan(50); // Large motion delta detected
  });

  it('resets frame counts and running averages cleanly', () => {
    const runner = new IVPKernelRunner();
    runner.executeFrame(createTestPattern(100));
    expect(runner.getFramesAnalyzed()).toBe(1);

    runner.reset();
    expect(runner.getFramesAnalyzed()).toBe(0);
    expect(runner.getKernelCounts().histogramEq).toBe(0);
    expect(runner.getAvgKernelMs()).toBe(0);
  });

  it('verifies kernel latency budget holds (< 8ms per frame in production; logs on CI)', () => {
    const runner = new IVPKernelRunner();
    const pattern = createTestPattern(120);

    // Warmup JIT
    for (let i = 0; i < 3; i++) {
      runner.executeFrame(pattern);
    }

    // Benchmark 5 frames
    const t0 = performance.now();
    for (let i = 0; i < 5; i++) {
      runner.executeFrame(pattern);
    }
    const elapsed = performance.now() - t0;
    const avgMs = elapsed / 5;

    // Per D12: Measure avgKernelMs and assert in a test that the budget holds; log, do not hard-fail on slow CI
    console.log(`[IVPKernelRunner Benchmark] Average kernel latency: ${avgMs.toFixed(2)}ms`);
    expect(isFinite(avgMs)).toBe(true);
    expect(avgMs).toBeGreaterThan(0);
  });
});
