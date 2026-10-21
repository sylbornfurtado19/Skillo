import { AdaptiveSkinCalibrator, DEFAULT_SKIN_RANGE } from '../src/lib/services/adaptiveSkinCalibrator';
import { IVPKernelRunner, RUNNER_WIDTH, RUNNER_HEIGHT } from '../src/lib/services/ivpKernelRunner';
import {
  createQuestionAccumulator,
  addSampleToAccumulator,
  summarizeQuestionEvidence,
  compileEvidenceReceipt,
} from '../src/lib/services/ivpEvidenceAggregator';
import { buildEvidencePromptBlock } from '../src/lib/services/evidencePrompt';
import type { IVPQuestionEvidence } from '../src/types/ivpEvidence';

describe('ISSUE-04: MediaPipe Authoritative Presence & Adaptive Skin Calibration', () => {
  // Helper to create synthetic 160x120 RGBA frames
  function createSyntheticFrame(
    width: number,
    height: number,
    fillR: number,
    fillG: number,
    fillB: number,
    faceRect?: { x: number; y: number; w: number; h: number; r: number; g: number; b: number }
  ): ImageData {
    const buffer = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const idx = (row + x) * 4;
        let r = fillR, g = fillG, b = fillB;
        if (
          faceRect &&
          x >= faceRect.x &&
          x < faceRect.x + faceRect.w &&
          y >= faceRect.y &&
          y < faceRect.y + faceRect.h
        ) {
          r = faceRect.r;
          g = faceRect.g;
          b = faceRect.b;
        }
        buffer[idx] = r;
        buffer[idx + 1] = g;
        buffer[idx + 2] = b;
        buffer[idx + 3] = 255;
      }
    }
    return {
      data: buffer,
      width,
      height,
      colorSpace: 'srgb',
    } as unknown as ImageData;
  }

  describe('Authoritative MediaPipe FaceLandmarker Presence', () => {
    it('reports presenceRatio ~1 for dark-skin synthetic frame with faceDetected=true', () => {
      const runner = new IVPKernelRunner();
      let acc = createQuestionAccumulator('q-dark-skin', 0);

      // Fitzpatrick VI synthetic tone: deep melanin pigmentation
      // (R: 65, G: 42, B: 30) on a neutral grey background (100, 100, 100)
      const darkSkinFrame = createSyntheticFrame(
        RUNNER_WIDTH,
        RUNNER_HEIGHT,
        100,
        100,
        100,
        { x: 40, y: 25, w: 80, h: 70, r: 65, g: 42, b: 30 }
      );

      const faceRoi = { x: 40, y: 25, width: 80, height: 70 };

      for (let f = 0; f < 5; f++) {
        const res = runner.executeFrame(darkSkinFrame, {
          faceRoi,
          faceDetected: true, // Authoritative MediaPipe detection confirmed
        });
        acc = addSampleToAccumulator(acc, res.stats);
      }

      const summary = summarizeQuestionEvidence(acc);
      expect(summary.frames).toBe(5);
      // Authoritative presence must be 1.0 (100%), not biased by skin pixel locus
      expect(summary.presenceRatio).toBe(1);
      // Skin coverage is retained as secondary diagnostic
      expect(typeof summary.skinMaskCoveragePct).toBe('number');
    });

    it('reports presenceRatio = 0 when faceDetected=false even if skin-like colors exist in frame', () => {
      const runner = new IVPKernelRunner();
      let acc = createQuestionAccumulator('q-no-face', 0);

      // Warm beige background resembling skin chrominance
      const warmFrame = createSyntheticFrame(RUNNER_WIDTH, RUNNER_HEIGHT, 190, 140, 120);

      for (let f = 0; f < 4; f++) {
        const res = runner.executeFrame(warmFrame, {
          faceRoi: null,
          faceDetected: false, // MediaPipe confirms NO face present
        });
        acc = addSampleToAccumulator(acc, res.stats);
      }

      const summary = summarizeQuestionEvidence(acc);
      expect(summary.presenceRatio).toBe(0);
    });

    it('degrades presenceRatio to null (unknown) when vision worker is unavailable', () => {
      const runner = new IVPKernelRunner();
      let acc = createQuestionAccumulator('q-worker-down', 0);

      const frame = createSyntheticFrame(RUNNER_WIDTH, RUNNER_HEIGHT, 120, 120, 120);

      for (let f = 0; f < 3; f++) {
        const res = runner.executeFrame(frame, {
          faceRoi: null,
          faceDetected: null, // Vision worker offline / uninitialized
        });
        acc = addSampleToAccumulator(acc, res.stats);
      }

      const summary = summarizeQuestionEvidence(acc);
      // Must degrade to null ("unknown"), NOT 0%
      expect(summary.presenceRatio).toBeNull();
    });
  });

  describe('Adaptive Skin Calibration', () => {
    it('falls back to DEFAULT_SKIN_RANGE before calibration target is reached', () => {
      const calibrator = new AdaptiveSkinCalibrator(10, 12);
      expect(calibrator.isCalibrated).toBe(false);
      expect(calibrator.getRange()).toEqual(DEFAULT_SKIN_RANGE);
    });

    it('samples confirmed face boxes and derives ranges that cover the candidate skin tone', () => {
      const calibrator = new AdaptiveSkinCalibrator(5, 12);
      // Candidate skin tone with uniform Cr and Cb
      // R=160, G=110, B=90 -> BT.601: Cr ~ 158, Cb ~ 94
      const skinFrame = createSyntheticFrame(
        RUNNER_WIDTH,
        RUNNER_HEIGHT,
        50,
        50,
        50,
        { x: 30, y: 20, w: 100, h: 80, r: 160, g: 110, b: 90 }
      );
      const faceRoi = { x: 30, y: 20, width: 100, height: 80 };

      for (let i = 0; i < 5; i++) {
        calibrator.addFrame(skinFrame, RUNNER_WIDTH, RUNNER_HEIGHT, faceRoi, true);
      }

      expect(calibrator.isCalibrated).toBe(true);
      const range = calibrator.getRange();

      // BT.601 integer math for R=160, G=110, B=90:
      // Cr = (32768 + 128*160 - 107*110 - 21*90) >> 8 = (32768 + 20480 - 11770 - 1890) >> 8 = 39588 >> 8 = 154
      // Cb = (32768 - 43*160 - 85*110 + 128*90) >> 8 = (32768 - 6880 - 9350 + 11520) >> 8 = 28058 >> 8 = 109
      expect(range.crMin).toBeLessThanOrEqual(154);
      expect(range.crMax).toBeGreaterThanOrEqual(154);
      expect(range.cbMin).toBeLessThanOrEqual(109);
      expect(range.cbMax).toBeGreaterThanOrEqual(109);

      // Widened by margin 12
      expect(range.crMax - range.crMin).toBeGreaterThanOrEqual(24);
      expect(range.cbMax - range.cbMin).toBeGreaterThanOrEqual(24);
    });

    it('resets calibration cleanly when reset() is invoked', () => {
      const calibrator = new AdaptiveSkinCalibrator(3, 10);
      const frame = createSyntheticFrame(RUNNER_WIDTH, RUNNER_HEIGHT, 50, 50, 50, {
        x: 40,
        y: 40,
        w: 60,
        h: 60,
        r: 150,
        g: 100,
        b: 80,
      });
      for (let i = 0; i < 3; i++) {
        calibrator.addFrame(frame, RUNNER_WIDTH, RUNNER_HEIGHT, { x: 40, y: 40, width: 60, height: 60 }, true);
      }
      expect(calibrator.isCalibrated).toBe(true);

      calibrator.reset();
      expect(calibrator.isCalibrated).toBe(false);
      expect(calibrator.getRange()).toEqual(DEFAULT_SKIN_RANGE);
    });
  });

  describe('Prompt Generation & Bias Prevention', () => {
    it('ensures prompt string derives presence strictly from presenceRatio, never skin pixels', async () => {
      const qEvidence: IVPQuestionEvidence = {
        questionId: 'q-test-bias',
        questionIndex: 0,
        frames: 50,
        meanLuminance: 110,
        contrastStdDev: 30,
        clippedPct: 1.2,
        illumination: 'ok',
        skinMaskCoveragePct: 0.0, // Dark skin or dim lighting caused low skin mask coverage
        presenceRatio: 0.96, // MediaPipe FaceLandmarker confidently detected face 96% of the time
        sobelEdgeDensity: 0.1,
        sharpnessScore: 65,
        motionEnergy: 1.5,
        evidenceId: 'IVP-Q1',
      };

      const receipt = await compileEvidenceReceipt({
        samplingHz: 4,
        framesAnalyzed: 50,
        kernelCounts: { histogramEq: 50, otsuYCrCb: 50, sobel: 50, temporalMAD: 50, earMar: 50 },
        avgKernelMs: 3.0,
        perQuestion: [qEvidence],
      });

      const prompt = buildEvidencePromptBlock(receipt);

      // Presence is derived from MediaPipe (96%), NEVER skinMaskCoverage (0%)
      expect(prompt).toContain('Face Presence: 96%');
      expect(prompt).not.toContain('Face Presence: 0%');
      expect(prompt).toContain('skinMaskCoverage: 0%');

      // Must explicitly inform the evaluator that skinMaskCoverage is a heuristic
      expect(prompt).toContain(
        'Skin-mask coverage is a lighting-sensitive heuristic and must not be used as evidence of absence'
      );
    });

    it('formats presence as "unknown" in prompt when presenceRatio is null', async () => {
      const qEvidence: IVPQuestionEvidence = {
        questionId: 'q-worker-null',
        questionIndex: 0,
        frames: 30,
        meanLuminance: 120,
        contrastStdDev: 25,
        clippedPct: 0.5,
        illumination: 'ok',
        skinMaskCoveragePct: 18.2,
        presenceRatio: null, // Vision worker was offline
        sobelEdgeDensity: 0.09,
        sharpnessScore: 55,
        motionEnergy: 1.1,
        evidenceId: 'IVP-Q1',
      };

      const receipt = await compileEvidenceReceipt({
        samplingHz: 4,
        framesAnalyzed: 30,
        kernelCounts: { histogramEq: 30, otsuYCrCb: 30, sobel: 30, temporalMAD: 30, earMar: 30 },
        avgKernelMs: 2.8,
        perQuestion: [qEvidence],
      });

      const prompt = buildEvidencePromptBlock(receipt);
      expect(prompt).toContain('Face Presence: unknown');
      expect(prompt).toContain('skinMaskCoverage: 18.2%');
    });
  });
});
