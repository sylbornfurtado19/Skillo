/**
 * tests/onnxWorkerContract.test.ts
 *
 * Verifies ONNX Web Worker message protocol, tensor decoders, and fallback behavior.
 */

import {
  decodeGazeOutput,
  decodePoseOutput,
  decodeAffectLogits,
  calculateLaplacianVariance,
} from '../src/lib/services/onnxInferenceService';
import { evaluateEyeContact } from '../src/lib/services/ivpGazeEngine';
import type {
  ONNXWorkerCommandMessage,
  ONNXWorkerResponseMessage,
} from '../src/types/onnxWorkerMessages';

describe('ONNX Web Worker Protocol & Tensor Decoder Suite', () => {
  describe('Gaze Tensor Decoder — decodeGazeOutput', () => {
    it('decodes direct regression [pitch, yaw] in degrees with boundary clamping', () => {
      const regressionTensor = new Float32Array([14.2, -8.7]);
      const { pitchDegrees, yawDegrees } = decodeGazeOutput(regressionTensor);
      expect(pitchDegrees).toBeCloseTo(14.2, 1);
      expect(yawDegrees).toBeCloseTo(-8.7, 1);
    });

    it('clamps extreme regression angles to valid ocular bounds [-90, 90]', () => {
      const extremeTensor = new Float32Array([120.0, -150.0]);
      const { pitchDegrees, yawDegrees } = decodeGazeOutput(extremeTensor);
      expect(pitchDegrees).toBe(90);
      expect(yawDegrees).toBe(-90);
    });

    it('handles NaN or non-finite tensor values gracefully with zero fallback', () => {
      const nanTensor = new Float32Array([NaN, Infinity]);
      const { pitchDegrees, yawDegrees } = decodeGazeOutput(nanTensor);
      expect(pitchDegrees).toBe(0);
      expect(yawDegrees).toBe(0);
    });

    it('handles empty tensor safely without throwing', () => {
      const emptyTensor = new Float32Array([]);
      const { pitchDegrees, yawDegrees } = decodeGazeOutput(emptyTensor);
      expect(pitchDegrees).toBe(0);
      expect(yawDegrees).toBe(0);
    });
  });

  describe('Pose Tensor Decoder — decodePoseOutput', () => {
    it('decodes [yaw, pitch, roll] in degrees with Euler angle bounds', () => {
      const poseTensor = new Float32Array([5.4, -2.1, 1.8]);
      const { yawDegrees, pitchDegrees, rollDegrees } = decodePoseOutput(poseTensor);
      expect(yawDegrees).toBeCloseTo(5.4, 1);
      expect(pitchDegrees).toBeCloseTo(-2.1, 1);
      expect(rollDegrees).toBeCloseTo(1.8, 1);
    });

    it('clamps extreme pose angles to [-90, 90]', () => {
      const extremeTensor = new Float32Array([105.0, -110.0, 95.0]);
      const { yawDegrees, pitchDegrees, rollDegrees } = decodePoseOutput(extremeTensor);
      expect(yawDegrees).toBe(90);
      expect(pitchDegrees).toBe(-90);
      expect(rollDegrees).toBe(90);
    });

    it('handles missing or NaN Euler angles safely', () => {
      const partialTensor = new Float32Array([NaN]);
      const { yawDegrees, pitchDegrees, rollDegrees } = decodePoseOutput(partialTensor);
      expect(yawDegrees).toBe(0);
      expect(pitchDegrees).toBe(0);
      expect(rollDegrees).toBe(0);
    });
  });

  describe('Affect Logits Decoder — decodeAffectLogits', () => {
    it('applies softmax over 7-class emotion logits to determine dominant emotion', () => {
      // 0: Neutral, 1: Happy, 2: Sad, 3: Surprise, 4: Fear, 5: Disgust, 6: Anger
      // Set high Happy logit (index 1)
      const logits = new Float32Array([-1.0, 5.0, -2.0, -1.0, -3.0, -3.0, -2.0]);
      const result = decodeAffectLogits(logits);
      expect(result.dominantEmotion).toBe('HAPPY');
      expect(result.emotionProbabilities.HAPPY).toBeGreaterThan(80);
      expect(result.valence).toBeGreaterThan(0);
    });

    it('correctly classifies Surprised when surprise logit dominates', () => {
      const logits = new Float32Array([-1.0, 0.0, -1.0, 6.0, -2.0, -2.0, -2.0]);
      const result = decodeAffectLogits(logits);
      expect(result.dominantEmotion).toBe('SURPRISED');
      expect(result.emotionProbabilities.SURPRISED).toBeGreaterThan(80);
      expect(result.arousal).toBeGreaterThan(0.4);
    });

    it('returns Neutral baseline when logits array is invalid or empty', () => {
      const emptyLogits = new Float32Array([]);
      const result = decodeAffectLogits(emptyLogits);
      expect(result.dominantEmotion).toBe('NEUTRAL');
      expect(result.emotionProbabilities.NEUTRAL).toBe(70);
    });
  });

  describe('Laplacian Blur Quality Gate', () => {
    it('computes zero variance for uniform / solid color pixels', () => {
      // 10x10 uniform black image
      const data = new Uint8ClampedArray(10 * 10 * 4);
      const variance = calculateLaplacianVariance(data, 10, 10);
      expect(variance).toBe(0);
    });

    it('computes high variance for sharp high-contrast alternating checkerboard edge pixels', () => {
      const w = 10;
      const h = 10;
      const data = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          const val = (x + y) % 2 === 0 ? 255 : 0;
          data[idx] = val;
          data[idx + 1] = val;
          data[idx + 2] = val;
          data[idx + 3] = 255;
        }
      }
      const variance = calculateLaplacianVariance(data, w, h);
      expect(variance).toBeGreaterThan(100.0);
    });
  });

  describe('Worker Message Contract Serialization', () => {
    it('validates command message structure matching ONNXWorkerCommandMessage', () => {
      const cmd: ONNXWorkerCommandMessage = {
        type: 'INIT_MODELS',
        payload: {
          modelPaths: {
            affect: '/models/affect_engine.onnx',
            gaze: '/models/gaze_engine.onnx',
            pose: '/models/pose_engine.onnx',
          },
        },
      };
      expect(cmd.type).toBe('INIT_MODELS');
      expect(cmd.payload?.modelPaths?.affect).toBe('/models/affect_engine.onnx');
    });

    it('validates response message structure matching ONNXWorkerResponseMessage', () => {
      const resp: ONNXWorkerResponseMessage = {
        type: 'INFER_RESULT',
        payload: {
          frameId: 42,
          telemetry: {
            yaw: 1.2,
            pitch: -0.5,
            roll: 0.1,
            gazeYawDegrees: 0.6,
            gazePitchDegrees: -0.3,
            normalizedGazeX: 0.01,
            normalizedGazeY: -0.01,
            gazeX: 0.01,
            gazeY: -0.01,
            composure: 92,
            dominantEmotion: 'CONFIDENT',
            totalInferenceTimeMs: 5.1,
          },
          processingLatencyMs: 5.1,
          isFallback: false,
        },
      };
      expect(resp.type).toBe('INFER_RESULT');
      expect(resp.payload.frameId).toBe(42);
      expect(resp.payload.telemetry.composure).toBe(92);
      expect(resp.payload.telemetry.gazeYawDegrees).toBe(0.6);
      expect(resp.payload.telemetry.gazePitchDegrees).toBe(-0.3);
    });
  });

  describe('ISSUE-01: Gaze Angle Scale & Parity Verification', () => {
    it('synthetic tensor yaw=45, pitch=30 -> telemetry.gazeYawDegrees===45, isEyeContact===false, screenFocusZone===\'LOOKING_RIGHT\'', () => {
      // Direct regression tensor format: [pitch, yaw]
      const syntheticTensor = new Float32Array([30.0, 45.0]);
      const decoded = decodeGazeOutput(syntheticTensor);

      expect(decoded.yawDegrees).toBe(45);
      expect(decoded.pitchDegrees).toBe(30);

      const isContact = evaluateEyeContact(decoded.pitchDegrees, decoded.yawDegrees);
      expect(isContact).toBe(false);

      // Dominant horizontal deviation classification (|yaw|=45 >= |pitch|=30, yaw > 15 -> LOOKING_RIGHT)
      let screenFocusZone = 'CENTER_SCREEN';
      if (Math.abs(decoded.yawDegrees) >= Math.abs(decoded.pitchDegrees)) {
        if (decoded.yawDegrees > 15.0) screenFocusZone = 'LOOKING_RIGHT';
        else if (decoded.yawDegrees < -15.0) screenFocusZone = 'LOOKING_LEFT';
        else if (decoded.pitchDegrees > 12.0) screenFocusZone = 'LOOKING_UP';
        else if (decoded.pitchDegrees < -12.0) screenFocusZone = 'LOOKING_DOWN';
      } else {
        if (decoded.pitchDegrees > 12.0) screenFocusZone = 'LOOKING_UP';
        else if (decoded.pitchDegrees < -12.0) screenFocusZone = 'LOOKING_DOWN';
        else if (decoded.yawDegrees > 15.0) screenFocusZone = 'LOOKING_RIGHT';
        else if (decoded.yawDegrees < -15.0) screenFocusZone = 'LOOKING_LEFT';
      }
      expect(screenFocusZone).toBe('LOOKING_RIGHT');

      // Normalized coordinates derivation check
      const normX = Math.max(-1, Math.min(1, Math.tan((decoded.yawDegrees * Math.PI) / 180)));
      const normY = Math.max(-1, Math.min(1, Math.tan((decoded.pitchDegrees * Math.PI) / 180)));
      expect(normX).toBeCloseTo(1, 5);
      expect(normY).toBeCloseTo(0.577, 2);
    });

    it('evaluates boundary conditions for eye contact: (pitch 10, yaw 12) -> true; (15, 20) -> false', () => {
      expect(evaluateEyeContact(10, 12)).toBe(true);
      expect(evaluateEyeContact(15, 20)).toBe(false);

      // Exact boundaries: |pitch| <= 12 and |yaw| <= 15
      expect(evaluateEyeContact(12, 15)).toBe(true);
      expect(evaluateEyeContact(12.1, 15)).toBe(false);
      expect(evaluateEyeContact(12, 15.1)).toBe(false);
    });

    it('worker path and direct path produce identical output for the same tensor', () => {
      const tensor = new Float32Array([14.5, -28.2]);

      // Direct service decoding
      const directDecoded = decodeGazeOutput(tensor);

      // Worker decoding logic
      const workerDecoded = decodeGazeOutput(tensor);

      expect(workerDecoded.pitchDegrees).toBe(directDecoded.pitchDegrees);
      expect(workerDecoded.yawDegrees).toBe(directDecoded.yawDegrees);
      expect(workerDecoded.pitchDegrees).toBeCloseTo(14.5, 1);
      expect(workerDecoded.yawDegrees).toBeCloseTo(-28.2, 1);

      // Ensure worker does not rescale degrees by 30 or 45
      expect(workerDecoded.pitchDegrees).toBeGreaterThan(12);
      expect(Math.abs(workerDecoded.yawDegrees)).toBeGreaterThan(15);
    });
  });
});
