/**
 * Dedicated Off-Main-Thread ONNX Web Worker (onnxWorker.ts)
 * Runs ONNX Runtime WebAssembly model inference off the UI thread.
 * Guarantees zero main-thread jank, 1-in-flight backpressure, and safe ImageBitmap memory cleanup.
 */

import type {
  ONNXWorkerCommandMessage,
  ONNXWorkerResponseMessage,
  ONNXModelType,
} from '@/types/onnxWorkerMessages';
import {
  calculateLaplacianVariance,
  decodeGazeOutput,
  decodePoseOutput,
  decodeAffectLogits,
  type SmoothedTelemetry,
} from '@/lib/services/onnxInferenceService';

// Worker global scope reference
const ctx: Worker = (typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : {})) as any;

let ortModulePromise: Promise<any> | null = null;
const sessionCache: Partial<Record<ONNXModelType, any>> = {};
let _isInitialized = false;
let isBusy = false;
let latestProcessedFrameId = 0;
let cancelledFrameId = 0;

let offscreenCanvas: OffscreenCanvas | null = null;
let offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;

let smoothedState: SmoothedTelemetry = {
  yaw: 0,
  pitch: 0,
  roll: 0,
  gazeYawDegrees: 0,
  gazePitchDegrees: 0,
  normalizedGazeX: 0,
  normalizedGazeY: 0,
  gazeX: 0,
  gazeY: 0,
  composure: 85,
  dominantEmotion: 'NEUTRAL',
  totalInferenceTimeMs: 0,
  isBlurry: false,
  blurVariance: 500,
};

async function getOrt(): Promise<any> {
  if (!ortModulePromise) {
    ortModulePromise = import('onnxruntime-web')
      .then((ort) => {
        try {
          // Configure same-origin wasmPaths to prevent CSP violations and support offline/self-hosted execution
          ort.env.wasm.wasmPaths = '/wasm/';

          // Multi-threading requires crossOriginIsolated (SharedArrayBuffer)
          const isIsolated =
            typeof crossOriginIsolated !== 'undefined'
              ? crossOriginIsolated
              : typeof self !== 'undefined' && 'crossOriginIsolated' in self
                ? (self as any).crossOriginIsolated
                : false;
          const hardwareCores =
            typeof navigator !== 'undefined' && navigator.hardwareConcurrency
              ? navigator.hardwareConcurrency
              : 1;
          ort.env.wasm.numThreads = isIsolated ? Math.min(4, Math.max(1, hardwareCores - 1)) : 1;
          ort.env.wasm.simd = true;
        } catch (err) {
          console.error('[ONNXWorker] WebAssembly setup error:', err);
        }
        return ort;
      })
      .catch((err) => {
        console.error('[ONNXWorker] Failed to load onnxruntime-web package:', err);
        throw err;
      });
  }
  return ortModulePromise;
}

function postResponse(msg: ONNXWorkerResponseMessage) {
  ctx.postMessage(msg);
}

// Convert ImageData into [1, 3, 224, 224] Float32Array tensor normalized to [-1, 1]
function imageDataToTensor(imgData: ImageData, ort: any): any {
  const { data, width, height } = imgData;
  const numPixels = width * height;
  const float32Data = new Float32Array(3 * numPixels);

  const rOffset = 0;
  const gOffset = numPixels;
  const bOffset = 2 * numPixels;

  for (let i = 0; i < numPixels; i++) {
    const srcIdx = i * 4;
    // Normalized to [-1.0, 1.0] (MobileFaceNet / L2CS-Net standard)
    float32Data[rOffset + i] = (data[srcIdx] / 127.5) - 1.0;
    float32Data[gOffset + i] = (data[srcIdx + 1] / 127.5) - 1.0;
    float32Data[bOffset + i] = (data[srcIdx + 2] / 127.5) - 1.0;
  }

  return new ort.Tensor('float32', float32Data, [1, 3, height, width]);
}

if (typeof self !== 'undefined') {
  self.addEventListener('message', async (e: MessageEvent<ONNXWorkerCommandMessage>) => {
    const message = e.data;
    if (!message || !message.type) return;

    switch (message.type) {
      case 'INIT_MODELS': {
        const payload = message.payload || {};
        const modelPaths: Record<ONNXModelType, string> = {
          affect: payload.modelPaths?.affect || '/models/affect_engine.onnx',
          gaze: payload.modelPaths?.gaze || '/models/gaze_engine.onnx',
          pose: payload.modelPaths?.pose || '/models/pose_engine.onnx',
        };

        const loadedModels: Record<ONNXModelType, boolean> = {
          affect: false,
          gaze: false,
          pose: false,
        };

        try {
          const ort = await getOrt();

          // Configure wasm options from payload if provided
          const isIsolated =
            typeof crossOriginIsolated !== 'undefined'
              ? crossOriginIsolated
              : typeof self !== 'undefined' && 'crossOriginIsolated' in self
                ? (self as any).crossOriginIsolated
                : false;
          if (payload.wasmThreads !== undefined) {
            ort.env.wasm.numThreads = isIsolated ? payload.wasmThreads : 1;
          }
          if (payload.enableSimd !== undefined) {
            ort.env.wasm.simd = payload.enableSimd;
          }

          const modelKeys: ONNXModelType[] = ['affect', 'gaze', 'pose'];

          await Promise.all(
            modelKeys.map(async (key) => {
              try {
                const session = await ort.InferenceSession.create(modelPaths[key], {
                  executionProviders: ['wasm'],
                  graphOptimizationLevel: 'all',
                });
                sessionCache[key] = session;
                loadedModels[key] = true;
              } catch (err) {
                console.error(`[ONNXWorker] Failed to load ${key} model from ${modelPaths[key]}:`, err);
                loadedModels[key] = false;
              }
            })
          );

          _isInitialized = true;
          postResponse({
            type: 'INIT_SUCCESS',
            payload: {
              loadedModels,
              backend: 'wasm',
            },
          });
        } catch (err: any) {
          console.error('[ONNXWorker] Fatal initialization failure:', err);
          postResponse({
            type: 'INIT_FAILURE',
            payload: { error: err?.message || 'Failed to initialize ONNX Runtime Web in worker' },
          });
        }
        break;
      }

      case 'CANCEL_FRAME': {
        if (message.payload?.frameId) {
          cancelledFrameId = message.payload.frameId;
        }
        break;
      }

      case 'INFER_FRAME': {
        const { frameId, imageBitmap, customAlphas, isROI } = message.payload;

        // 1. Backpressure & Staleness Check
        if (frameId <= latestProcessedFrameId || frameId === cancelledFrameId) {
          try { imageBitmap?.close(); } catch {}
          postResponse({ type: 'INFER_DROPPED', payload: { frameId, reason: 'stale' } });
          return;
        }

        if (isBusy) {
          try { imageBitmap?.close(); } catch {}
          postResponse({ type: 'INFER_DROPPED', payload: { frameId, reason: 'busy' } });
          return;
        }

        isBusy = true;
        const t0 = performance.now();
        smoothedState.roi = Boolean(isROI);

        try {
          if (!imageBitmap) {
            isBusy = false;
            return;
          }

          // 2. OffscreenCanvas Frame Rendering
          const w = 224;
          const h = 224;
          if (!offscreenCanvas) {
            offscreenCanvas = new OffscreenCanvas(w, h);
            offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
          }

          if (!offscreenCtx) {
            throw new Error('Could not acquire OffscreenCanvas 2D context');
          }

          offscreenCtx.drawImage(imageBitmap, 0, 0, w, h);
          const imgData = offscreenCtx.getImageData(0, 0, w, h);

          // Close ImageBitmap immediately to release GPU/system RAM
          try { imageBitmap.close(); } catch {}

          // 3. Laplacian Blur Quality Gating
          const blurVariance = calculateLaplacianVariance(imgData.data, w, h);
          const isBlurry = blurVariance < 100.0;

          if (isBlurry) {
            latestProcessedFrameId = frameId;
            smoothedState.isBlurry = true;
            smoothedState.blurVariance = Math.round(blurVariance);
            postResponse({
              type: 'INFER_RESULT',
              payload: {
                frameId,
                telemetry: { ...smoothedState, roi: Boolean(isROI), totalInferenceTimeMs: Math.round(performance.now() - t0) },
                processingLatencyMs: Math.round(performance.now() - t0),
                isFallback: true,
              },
            });
            return;
          }

          // 4. Model Forward Passes or Fallback
          const ort = await getOrt();
          const tensor = imageDataToTensor(imgData, ort);

          let rawYaw = smoothedState.yaw;
          let rawPitch = smoothedState.pitch;
          let rawRoll = smoothedState.roll;
          let rawGazeYaw = smoothedState.gazeYawDegrees;
          let rawGazePitch = smoothedState.gazePitchDegrees;
          let rawComposure = smoothedState.composure;
          let rawEmotion = smoothedState.dominantEmotion;

          // Pose Session
          if (sessionCache.pose) {
            try {
              const inputName = sessionCache.pose.inputNames[0] || 'input';
              const res = await sessionCache.pose.run({ [inputName]: tensor });
              const outNames = sessionCache.pose.outputNames;
              const outData = res[outNames[0]].data as Float32Array;
              const decoded = decodePoseOutput(outData);
              rawYaw = decoded.yawDegrees;
              rawPitch = decoded.pitchDegrees;
              rawRoll = decoded.rollDegrees;
              const angVel = Math.sqrt(rawYaw * rawYaw + rawPitch * rawPitch + rawRoll * rawRoll);
              rawComposure = Math.max(0, Math.min(100, Math.round(100 - angVel * 0.8)));
            } catch (err) {
              console.warn('[ONNXWorker] Pose inference error:', err);
            }
          }

          // Gaze Session
          if (sessionCache.gaze) {
            try {
              const inputName = sessionCache.gaze.inputNames[0] || 'input';
              const res = await sessionCache.gaze.run({ [inputName]: tensor });
              const outNames = sessionCache.gaze.outputNames;
              const outData = res[outNames[0]].data as Float32Array;
              const decoded = decodeGazeOutput(outData);
              rawGazeYaw = decoded.yawDegrees;
              rawGazePitch = decoded.pitchDegrees;
            } catch (err) {
              console.warn('[ONNXWorker] Gaze inference error:', err);
            }
          }

          // Affect Session
          if (sessionCache.affect) {
            try {
              const inputName = sessionCache.affect.inputNames[0] || 'input_image';
              const res = await sessionCache.affect.run({ [inputName]: tensor });
              const outNames = sessionCache.affect.outputNames;
              const outData = res[outNames[0]].data as Float32Array;
              const decoded = decodeAffectLogits(outData);
              rawEmotion = decoded.dominantEmotion;
            } catch (err) {
              console.warn('[ONNXWorker] Affect inference error:', err);
            }
          }

          // 5. Exponential Moving Average (EMA) Smoothing
          const isNum = typeof customAlphas === 'number';
          const alphaPose = isNum ? customAlphas : (customAlphas?.pose ?? 0.35);
          const alphaGaze = isNum ? customAlphas : (customAlphas?.gaze ?? 0.35);
          const alphaComposure = isNum ? customAlphas : (customAlphas?.composure ?? 0.35);

          const nextYaw = Math.round((smoothedState.yaw + alphaPose * (rawYaw - smoothedState.yaw)) * 10) / 10;
          const nextPitch = Math.round((smoothedState.pitch + alphaPose * (rawPitch - smoothedState.pitch)) * 10) / 10;
          const nextRoll = Math.round((smoothedState.roll + alphaPose * (rawRoll - smoothedState.roll)) * 10) / 10;

          const nextGazeYaw = Math.round((smoothedState.gazeYawDegrees + alphaGaze * (rawGazeYaw - smoothedState.gazeYawDegrees)) * 10) / 10;
          const nextGazePitch = Math.round((smoothedState.gazePitchDegrees + alphaGaze * (rawGazePitch - smoothedState.gazePitchDegrees)) * 10) / 10;

          const normX = Math.max(-1, Math.min(1, Math.tan((nextGazeYaw * Math.PI) / 180)));
          const normY = Math.max(-1, Math.min(1, Math.tan((nextGazePitch * Math.PI) / 180)));
          const normalizedGazeX = Math.round(normX * 100) / 100;
          const normalizedGazeY = Math.round(normY * 100) / 100;

          smoothedState = {
            yaw: nextYaw,
            pitch: nextPitch,
            roll: nextRoll,
            gazeYawDegrees: nextGazeYaw,
            gazePitchDegrees: nextGazePitch,
            normalizedGazeX,
            normalizedGazeY,
            gazeX: normalizedGazeX,
            gazeY: normalizedGazeY,
            composure: Math.round(smoothedState.composure + alphaComposure * (rawComposure - smoothedState.composure)),
            dominantEmotion: rawEmotion,
            totalInferenceTimeMs: Math.round(performance.now() - t0),
            isBlurry: false,
            blurVariance: Math.round(blurVariance),
          };

          latestProcessedFrameId = frameId;

          // If frame was cancelled mid-flight, do not dispatch result
          if (frameId !== cancelledFrameId) {
            postResponse({
              type: 'INFER_RESULT',
              payload: {
                frameId,
                telemetry: { ...smoothedState },
                processingLatencyMs: Math.round(performance.now() - t0),
                isFallback: !sessionCache.affect && !sessionCache.gaze && !sessionCache.pose,
              },
            });
          }
        } catch (inferErr: any) {
          postResponse({
            type: 'WORKER_ERROR',
            payload: {
              error: inferErr?.message || 'ONNX Worker inference exception',
              code: 'INFERENCE_ERROR',
              frameId,
            },
          });
        } finally {
          isBusy = false;
        }
        break;
      }

      case 'DISPOSE': {
        _isInitialized = false;
        isBusy = false;
        Object.keys(sessionCache).forEach((key) => {
          const mKey = key as ONNXModelType;
          try {
            sessionCache[mKey]?.release?.();
          } catch {}
          delete sessionCache[mKey];
        });
        offscreenCanvas = null;
        offscreenCtx = null;
        postResponse({ type: 'DISPOSED_CONFIRM' });
        break;
      }
    }
  });
}

export {};
