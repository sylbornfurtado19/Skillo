'use client';

export type ONNXModelType = 'affect' | 'gaze' | 'pose';

export interface GazeInferenceResult {
  pitchDegrees: number;
  yawDegrees: number;
  isEyeContact: boolean;
  screenFocusZone: string;
  inferenceTimeMs: number;
}

export interface PoseInferenceResult {
  yawDegrees: number;
  pitchDegrees: number;
  rollDegrees: number;
  postureComposureScore: number;
  detectedGesture: string;
  inferenceTimeMs: number;
}

export interface AffectInferenceResult {
  valence: number;
  arousal: number;
  composureScore: number;
  dominantEmotion: string;
  emotionProbabilities: Record<string, number>;
  inferenceTimeMs: number;
}

// Session cache to prevent re-instantiating heavy WASM models
const sessionCache: Partial<Record<ONNXModelType, any>> = {};
let ortModulePromise: Promise<any> | null = null;

/**
 * Dynamically loads onnxruntime-web only on client side (preventing SSR crashes)
 */
async function getOrt(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('ONNX Runtime Web is only available in browser environments');
  }

  if (!ortModulePromise) {
    ortModulePromise = import('onnxruntime-web').then((ort) => {
      try {
        ort.env.wasm.numThreads = 1;
        ort.env.wasm.simd = true;
      } catch (err) {
        console.warn('ONNX WebAssembly setup warning:', err);
      }
      return ort;
    });
  }

  return ortModulePromise;
}

/**
 * Loads and returns a cached ONNX InferenceSession for the requested model.
 */
export async function getONNXSession(modelType: ONNXModelType): Promise<any> {
  if (sessionCache[modelType]) {
    return sessionCache[modelType]!;
  }

  const ort = await getOrt();
  const modelPaths: Record<ONNXModelType, string> = {
    affect: '/models/affect_engine.onnx',
    gaze: '/models/gaze_engine.onnx',
    pose: '/models/pose_engine.onnx',
  };

  try {
    const session = await ort.InferenceSession.create(modelPaths[modelType], {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    sessionCache[modelType] = session;
    return session;
  } catch (error) {
    console.warn(`Failed to load ONNX model [${modelType}] from ${modelPaths[modelType]}:`, error);
    throw error;
  }
}

/**
 * Preprocesses ImageData/Canvas to an ImageNet-normalized NCHW Float32Tensor [1, 3, 224, 224]
 */
export async function preprocessFrameToTensor(
  source: HTMLCanvasElement | ImageData,
  targetWidth = 224,
  targetHeight = 224
): Promise<any> {
  const ort = await getOrt();
  let imgData: ImageData;

  if (source instanceof HTMLCanvasElement) {
    const offscreen = document.createElement('canvas');
    offscreen.width = targetWidth;
    offscreen.height = targetHeight;
    const ctx = offscreen.getContext('2d');
    if (!ctx) throw new Error('Could not get offscreen canvas 2D context');
    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
    imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  } else {
    imgData = source;
  }

  const { data, width, height } = imgData;
  const floatData = new Float32Array(3 * width * height);

  // ImageNet normalization constants:
  // RGB Means: [0.485, 0.456, 0.406], Stds: [0.229, 0.224, 0.225]
  const meanR = 0.485, meanG = 0.456, meanB = 0.406;
  const stdR = 0.229, stdG = 0.224, stdB = 0.225;

  const channelSize = width * height;
  for (let i = 0; i < channelSize; i++) {
    const r = data[i * 4] / 255.0;
    const g = data[i * 4 + 1] / 255.0;
    const b = data[i * 4 + 2] / 255.0;

    // NCHW Layout: Red channel first, Green second, Blue third
    floatData[i] = (r - meanR) / stdR;
    floatData[channelSize + i] = (g - meanG) / stdG;
    floatData[2 * channelSize + i] = (b - meanB) / stdB;
  }

  return new ort.Tensor('float32', floatData, [1, 3, height, width]);
}

/**
 * Soft-argmax expectation over 90 continuous degree bins (-45° to +45°)
 */
function softArgmax(logits: Float32Array | number[]): number {
  let maxLogit = -Infinity;
  for (let i = 0; i < logits.length; i++) {
    if (logits[i] > maxLogit) maxLogit = logits[i];
  }

  let sumExp = 0;
  const exps = new Float32Array(logits.length);
  for (let i = 0; i < logits.length; i++) {
    exps[i] = Math.exp(logits[i] - maxLogit);
    sumExp += exps[i];
  }

  let expectation = 0;
  const numBins = logits.length;
  for (let i = 0; i < numBins; i++) {
    const prob = exps[i] / sumExp;
    const binAngle = -45.0 + (i / (numBins - 1)) * 90.0;
    expectation += prob * binAngle;
  }

  return expectation;
}

/**
 * Executes continuous Gaze Estimation via L2CS-Net ONNX model.
 */
export async function runGazeONNX(canvas: HTMLCanvasElement): Promise<GazeInferenceResult> {
  const t0 = performance.now();
  const session = await getONNXSession('gaze');
  const inputTensor = await preprocessFrameToTensor(canvas);

  const feeds: Record<string, any> = {};
  const inputName = session.inputNames[0] || 'input';
  feeds[inputName] = inputTensor;

  const results = await session.run(feeds);
  const outputNames = session.outputNames;

  const pitchTensor = results[outputNames[0]];
  const yawTensor = results[outputNames[1] || outputNames[0]];

  const pitchData = pitchTensor.data as Float32Array;
  const yawData = (yawTensor ? yawTensor.data : pitchData) as Float32Array;

  const pitchDegrees = softArgmax(pitchData.slice(0, Math.min(90, pitchData.length)));
  const yawDegrees = softArgmax(yawData.slice(0, Math.min(90, yawData.length)));

  const isEyeContact = Math.abs(pitchDegrees) <= 12.0 && Math.abs(yawDegrees) <= 15.0;

  let screenFocusZone = 'CENTER_SCREEN';
  if (pitchDegrees > 12.0) screenFocusZone = 'LOOKING_UP';
  else if (pitchDegrees < -12.0) screenFocusZone = 'LOOKING_DOWN';
  else if (yawDegrees < -15.0) screenFocusZone = 'LOOKING_LEFT';
  else if (yawDegrees > 15.0) screenFocusZone = 'LOOKING_RIGHT';

  const inferenceTimeMs = Math.round((performance.now() - t0) * 10) / 10;

  return {
    pitchDegrees: Math.round(pitchDegrees * 10) / 10,
    yawDegrees: Math.round(yawDegrees * 10) / 10,
    isEyeContact,
    screenFocusZone,
    inferenceTimeMs,
  };
}

/**
 * Executes 3D Head Pose & Euler Angle Inference via HopeNet ONNX model.
 */
export async function runPoseONNX(canvas: HTMLCanvasElement): Promise<PoseInferenceResult> {
  const t0 = performance.now();
  const session = await getONNXSession('pose');
  const inputTensor = await preprocessFrameToTensor(canvas);

  const feeds: Record<string, any> = {};
  const inputName = session.inputNames[0] || 'input';
  feeds[inputName] = inputTensor;

  const results = await session.run(feeds);
  const outputNames = session.outputNames;

  const outData = results[outputNames[0]].data as Float32Array;
  const yawDegrees = outData[0] !== undefined ? outData[0] : 0;
  const pitchDegrees = outData[1] !== undefined ? outData[1] : 0;
  const rollDegrees = outData[2] !== undefined ? outData[2] : 0;

  const angVel = Math.sqrt(yawDegrees * yawDegrees + pitchDegrees * pitchDegrees + rollDegrees * rollDegrees);
  const postureComposureScore = Math.max(0, Math.min(100, Math.round(100 - angVel * 0.8)));

  let detectedGesture = 'STABLE';
  if (Math.abs(pitchDegrees) > 12.0) detectedGesture = 'NODDING';
  else if (Math.abs(yawDegrees) > 15.0) detectedGesture = 'HEAD_SHAKE';

  const inferenceTimeMs = Math.round((performance.now() - t0) * 10) / 10;

  return {
    yawDegrees: Math.round(yawDegrees * 10) / 10,
    pitchDegrees: Math.round(pitchDegrees * 10) / 10,
    rollDegrees: Math.round(rollDegrees * 10) / 10,
    postureComposureScore,
    detectedGesture,
    inferenceTimeMs,
  };
}

/**
 * Executes Facial Affect & Valence-Arousal Inference via MobileFaceNet ONNX model.
 */
export async function runAffectONNX(canvas: HTMLCanvasElement): Promise<AffectInferenceResult> {
  const t0 = performance.now();
  const session = await getONNXSession('affect');
  const inputTensor = await preprocessFrameToTensor(canvas);

  const feeds: Record<string, any> = {};
  const inputName = session.inputNames[0] || 'input';
  feeds[inputName] = inputTensor;

  const results = await session.run(feeds);
  const outputNames = session.outputNames;

  const outData = results[outputNames[0]].data as Float32Array;

  const emotions = ['Neutral', 'Happy', 'Surprised', 'Stressed', 'Confident', 'Thoughtful'];
  const emotionProbabilities: Record<string, number> = {};

  let maxProb = -1;
  let dominantEmotion = 'Neutral';

  let sumExp = 0;
  for (let i = 0; i < Math.min(emotions.length, outData.length); i++) {
    sumExp += Math.exp(outData[i]);
  }

  for (let i = 0; i < emotions.length; i++) {
    const rawVal = i < outData.length ? outData[i] : 0;
    const prob = Math.round((Math.exp(rawVal) / sumExp) * 100);
    emotionProbabilities[emotions[i]] = prob;
    if (prob > maxProb) {
      maxProb = prob;
      dominantEmotion = emotions[i];
    }
  }

  const valence = dominantEmotion === 'Confident' || dominantEmotion === 'Happy' ? 0.45 : dominantEmotion === 'Stressed' ? -0.42 : 0.05;
  const arousal = dominantEmotion === 'Stressed' ? 0.68 : dominantEmotion === 'Surprised' ? 0.55 : 0.18;

  const dist = Math.sqrt((valence - 0.4) ** 2 + (arousal - 0.2) ** 2);
  const composureScore = Math.max(0, Math.min(100, Math.round(100 * (1.0 - dist / 2.82))));

  const inferenceTimeMs = Math.round((performance.now() - t0) * 10) / 10;

  return {
    valence,
    arousal,
    composureScore,
    dominantEmotion,
    emotionProbabilities,
    inferenceTimeMs,
  };
}
