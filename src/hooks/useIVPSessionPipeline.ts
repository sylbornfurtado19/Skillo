'use client';

/**
 * useIVPSessionPipeline
 *
 * Unified Worker + ONNX vision pipeline for live interview sessions (REM-3).
 * Replaces the legacy heuristic trackers (IVPGazeTracker, IVPPoseTracker, IVPAffectTracker)
 * with the verified off-main-thread worker architecture:
 *
 * MediaStream → HTMLVideoElement
 *      ↓
 * useVisionWorker (MediaPipe FaceLandmarker → Canonical 70 Landmarks)
 *      ↓
 * useONNXWorker (L2CS-Net Gaze, HopeNet 3D Head Pose, AffectNet Emotion)
 *      ↓
 * Established Temporal Smoothing (GazeAngleEMA, HeadPoseEMA, AffectiveEMA, Consensus)
 *      ↓
 * Live HUD updates (EyeContactHUD, PostureHUD, AffectiveHUD)
 *      ↓
 * Telemetry frame buffers (GazeFrameInput[], HeadPoseFrameInput[], AffectFrameInput[])
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useVisionWorker } from '@/hooks/useVisionWorker';
import { useONNXWorker } from '@/hooks/useONNXWorker';
import {
  GazeAngleEMA,
  HeadPoseEMA,
  AffectiveEMA,
  CategoricalConsensusSmoother,
} from '@/lib/services/temporalSmoothing';
import {
  evaluateEyeContact,
  classifyFocusZone,
} from '@/lib/services/ivpGazeEngine';
import { processPoseFrame } from '@/lib/services/ivpPoseEngine';
import { processAffectFrame } from '@/lib/services/ivpAffectEngine';
import type {
  GazeFrameResult,
  HeadPoseFrameResult,
  AffectFrameResult,
  GazeFrameInput,
  HeadPoseFrameInput,
  AffectFrameInput,
  DiscreteEmotion,
} from '@/types/index';
import type { SmoothedTelemetry } from '@/lib/services/onnxInferenceService';

export interface UseIVPSessionPipelineOptions {
  mediaStream?: MediaStream | null;
  isSpeaking?: boolean;
  questionId?: string;
  questionIndex?: number;
}

export interface UseIVPSessionPipelineReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  liveGazeFrame: GazeFrameResult | null;
  livePoseFrame: HeadPoseFrameResult | null;
  liveAffectFrame: AffectFrameResult | null;
  gazeEyeContactPct: number;
  gazeFrameCount: number;
  showGazeWarning: boolean;
  latestGestureToast: {
    type: 'NODDING' | 'HEAD_SHAKING' | 'POSTURE_SLUMP';
    timestampMs: number;
  } | null;
  isVisionReady: boolean;
  isONNXReady: boolean;
  isThrottled: boolean;
  isFallbackMode: boolean;
  clearPerQuestionFrames: () => void;
  getCapturedTelemetry: (filterQuestionId?: string) => {
    capturedGazeFrames: GazeFrameInput[];
    capturedPoseFrames: HeadPoseFrameInput[];
    capturedAffectFrames: AffectFrameInput[];
  };
  getQuestionTelemetry: (targetQuestionId: string) => {
    capturedGazeFrames: GazeFrameInput[];
    capturedPoseFrames: HeadPoseFrameInput[];
    capturedAffectFrames: AffectFrameInput[];
  };
}

function normalizeEmotionToDiscrete(emotionStr?: string): DiscreteEmotion {
  if (!emotionStr) return 'NEUTRAL';
  const upper = emotionStr.toUpperCase();
  if (upper === 'HAPPY') return 'HAPPY';
  if (upper === 'STRESSED' || upper === 'ANGER' || upper === 'FEAR' || upper === 'SAD') return 'STRESSED';
  if (upper === 'SURPRISED' || upper === 'SURPRISE') return 'SURPRISED';
  if (upper === 'CONFIDENT') return 'CONFIDENT';
  if (upper === 'HESITANT') return 'HESITANT';
  if (upper === 'THINKING') return 'THINKING';
  return 'NEUTRAL';
}

export function useIVPSessionPipeline(options: UseIVPSessionPipelineOptions = {}): UseIVPSessionPipelineReturn {
  const {
    mediaStream = null,
    isSpeaking = false,
    questionId,
    questionIndex,
  } = options;

  // Active question attribution refs for asynchronous worker alignment (REM-4)
  const currentQuestionIdRef = useRef<string | undefined>(questionId);
  const currentQuestionIndexRef = useRef<number | undefined>(questionIndex);

  useEffect(() => {
    currentQuestionIdRef.current = questionId;
    currentQuestionIndexRef.current = questionIndex;
  }, [questionId, questionIndex]);

  // Single authoritative video DOM element reference
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Synchronize video element with authoritative MediaStream from useInterviewCamera
  useEffect(() => {
    const video = videoRef.current;
    if (video && mediaStream && video.srcObject !== mediaStream) {
      video.srcObject = mediaStream;
      video.play().catch(() => {});
    }
  }, [mediaStream]);

  // Session start time for monotonically increasing timestamps
  const sessionStartRef = useRef<number>(Date.now());

  // Frame telemetry buffers
  const capturedGazeFramesRef = useRef<GazeFrameInput[]>([]);
  const capturedPoseFramesRef = useRef<HeadPoseFrameInput[]>([]);
  const capturedAffectFramesRef = useRef<AffectFrameInput[]>([]);

  // Temporal smoothing instances
  const gazeEmaRef = useRef(new GazeAngleEMA(0.45));
  const poseEmaRef = useRef(new HeadPoseEMA(0.35));
  const affectEmaRef = useRef(new AffectiveEMA(0.25, 0.20));
  const emotionConsensusRef = useRef(new CategoricalConsensusSmoother<DiscreteEmotion>(5, 0.30));
  const lastPoseResultRef = useRef<HeadPoseFrameResult | null>(null);

  // Live HUD States
  const [liveGazeFrame, setLiveGazeFrame] = useState<GazeFrameResult | null>(null);
  const [gazeEyeContactPct, setGazeEyeContactPct] = useState(0);
  const [gazeFrameCount, setGazeFrameCount] = useState(0);
  const [gazeContactCount, setGazeContactCount] = useState(0);
  const [showGazeWarning, setShowGazeWarning] = useState(false);
  const gazeWarningTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [livePoseFrame, setLivePoseFrame] = useState<HeadPoseFrameResult | null>(null);
  const [latestGestureToast, setLatestGestureToast] = useState<{
    type: 'NODDING' | 'HEAD_SHAKING' | 'POSTURE_SLUMP';
    timestampMs: number;
  } | null>(null);

  const [liveAffectFrame, setLiveAffectFrame] = useState<AffectFrameResult | null>(null);

  // Dedicated Off-Main-Thread Vision Worker (MediaPipe FaceLandmarker)
  const {
    processFrame: processVisionWorkerFrame,
    isReady: isVisionReady,
    isTabPaused,
    isThrottled,
    isFallbackMode,
  } = useVisionWorker({
    autoStart: true,
    backend: 'WEBGL',
  });

  // Dedicated Off-Main-Thread ONNX Worker (L2CS-Net, HopeNet, AffectNet)
  const handleONNXTelemetry = useCallback(
    (
      telemetry: SmoothedTelemetry,
      _frameId?: number,
      metadata?: { questionId?: string; questionIndex?: number }
    ) => {
      const timestampMs = Date.now() - sessionStartRef.current;
      const qId = metadata?.questionId ?? currentQuestionIdRef.current;
      const qIdx = metadata?.questionIndex ?? currentQuestionIndexRef.current;

      // ── 1. Gaze Processing (L2CS-Net + GazeAngleEMA) ──────────────────────────
      const smoothedGaze = gazeEmaRef.current.update({
        pitchDegrees: telemetry.gazeY,
        yawDegrees: telemetry.gazeX,
      });

      const isEyeContact = evaluateEyeContact(smoothedGaze.pitchDegrees, smoothedGaze.yawDegrees);
      const screenFocusZone = classifyFocusZone(smoothedGaze.pitchDegrees, smoothedGaze.yawDegrees);

      const gazeResult: GazeFrameResult = {
        frameTimestampMs: timestampMs,
        gazeAngles: {
          pitchDegrees: smoothedGaze.pitchDegrees,
          yawDegrees: smoothedGaze.yawDegrees,
        },
        isEyeContact,
        screenFocusZone,
        confidenceScore: telemetry.isBlurry ? 0.65 : 0.92,
      };

      capturedGazeFramesRef.current.push({
        timestampMs,
        pitchDegrees: smoothedGaze.pitchDegrees,
        yawDegrees: smoothedGaze.yawDegrees,
        confidence: gazeResult.confidenceScore,
        questionId: qId,
        questionIndex: qIdx,
      });

      setLiveGazeFrame(gazeResult);

      setGazeFrameCount((prev) => {
        const nextCount = prev + 1;
        setGazeContactCount((prevContact) => {
          const nextContact = prevContact + (isEyeContact ? 1 : 0);
          setGazeEyeContactPct(Math.round((nextContact / nextCount) * 100));
          return nextContact;
        });
        return nextCount;
      });

      // Distraction warning banner logic (sustain off-screen > 1.5s)
      if (!isEyeContact && screenFocusZone !== 'LOOKING_UP') {
        if (gazeWarningTimerRef.current) clearTimeout(gazeWarningTimerRef.current);
        setShowGazeWarning(true);
      } else if (isEyeContact) {
        if (gazeWarningTimerRef.current) clearTimeout(gazeWarningTimerRef.current);
        gazeWarningTimerRef.current = setTimeout(() => setShowGazeWarning(false), 3000);
      }

      // ── 2. Head Pose Processing (HopeNet + HeadPoseEMA) ────────────────────────
      const smoothedPose = poseEmaRef.current.update({
        yawDegrees: telemetry.yaw,
        pitchDegrees: telemetry.pitch,
        rollDegrees: telemetry.roll,
      });

      const poseInput: HeadPoseFrameInput = {
        timestampMs,
        yawDegrees: smoothedPose.yawDegrees,
        pitchDegrees: smoothedPose.pitchDegrees,
        rollDegrees: smoothedPose.rollDegrees,
        confidence: telemetry.isBlurry ? 0.65 : 0.90,
        isSubjectPresent: true,
        questionId: qId,
        questionIndex: qIdx,
      };

      capturedPoseFramesRef.current.push(poseInput);

      const poseResult = processPoseFrame(poseInput, lastPoseResultRef.current || undefined);
      lastPoseResultRef.current = poseResult;
      setLivePoseFrame(poseResult);

      if (poseResult.detectedGesture === 'NODDING' || poseResult.detectedGesture === 'HEAD_SHAKING') {
        setLatestGestureToast({
          type: poseResult.detectedGesture,
          timestampMs,
        });
      }

      // ── 3. Affect & Composure Processing (AffectNet + AffectiveEMA) ───────────
      const discreteEmotion = normalizeEmotionToDiscrete(telemetry.dominantEmotion);
      const rawValence = discreteEmotion === 'HAPPY' ? 0.65 : discreteEmotion === 'STRESSED' ? -0.4 : 0.15;
      const rawArousal = discreteEmotion === 'SURPRISED' ? 0.60 : discreteEmotion === 'STRESSED' ? 0.50 : 0.15;

      const smoothedVA = affectEmaRef.current.update(
        { valence: rawValence, arousal: rawArousal },
        telemetry.composure
      );
      const smoothedEmotion = emotionConsensusRef.current.update(discreteEmotion);

      const affectInput: AffectFrameInput = {
        timestampMs,
        valence: smoothedVA.vaCoordinates.valence,
        arousal: smoothedVA.vaCoordinates.arousal,
        confidence: 0.88,
        dominantEmotion: smoothedEmotion,
        questionId: qId,
        questionIndex: qIdx,
      };

      capturedAffectFramesRef.current.push(affectInput);

      const rawAffectResult = processAffectFrame(affectInput);
      const affectResult: AffectFrameResult = {
        ...rawAffectResult,
        vaCoordinates: smoothedVA.vaCoordinates,
        composureScore: smoothedVA.composureScore,
        dominantEmotion: smoothedEmotion,
      };

      setLiveAffectFrame(affectResult);
    },
    []
  );

  const {
    submitFrame: submitONNXFrame,
    isReady: isONNXReady,
  } = useONNXWorker({
    autoStart: true,
    onTelemetry: handleONNXTelemetry,
  });

  // ── Continuous Frame Dispatcher Loop ───────────────────────────────────────
  // Dispatches frames to both workers at ~10 FPS (~100ms) or ~5.5 FPS (~180ms) when throttled
  useEffect(() => {
    if (isSpeaking || !mediaStream) return;

    const intervalMs = isThrottled ? 180 : 100;
    const timer = setInterval(() => {
      if (isTabPaused) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.paused || video.ended) return;

      // Off-main-thread MediaPipe FaceLandmarker
      processVisionWorkerFrame(video);

      // Off-main-thread ONNX Models (L2CS-Net, HopeNet, AffectNet)
      // Tag submission with the exact question active at dispatch time
      submitONNXFrame(video, {
        questionId: currentQuestionIdRef.current,
        questionIndex: currentQuestionIndexRef.current,
        timestampMs: Date.now() - sessionStartRef.current,
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isSpeaking, mediaStream, isTabPaused, isThrottled, processVisionWorkerFrame, submitONNXFrame]);

  // Reset per-question counts & smoothing filters on question change
  const clearPerQuestionFrames = useCallback(() => {
    setGazeFrameCount(0);
    setGazeContactCount(0);
    setGazeEyeContactPct(0);
    setLiveGazeFrame(null);
    setShowGazeWarning(false);
    if (gazeWarningTimerRef.current) clearTimeout(gazeWarningTimerRef.current);

    gazeEmaRef.current.reset();
    poseEmaRef.current.reset();
    affectEmaRef.current.reset();
    emotionConsensusRef.current.reset();
    lastPoseResultRef.current = null;
  }, []);

  // Retrieve captured telemetry for submission to evaluation server
  const getCapturedTelemetry = useCallback((filterQuestionId?: string) => {
    if (filterQuestionId !== undefined) {
      return {
        capturedGazeFrames: capturedGazeFramesRef.current.filter((f) => f.questionId === filterQuestionId),
        capturedPoseFrames: capturedPoseFramesRef.current.filter((f) => f.questionId === filterQuestionId),
        capturedAffectFrames: capturedAffectFramesRef.current.filter((f) => f.questionId === filterQuestionId),
      };
    }
    return {
      capturedGazeFrames: [...capturedGazeFramesRef.current],
      capturedPoseFrames: [...capturedPoseFramesRef.current],
      capturedAffectFrames: [...capturedAffectFramesRef.current],
    };
  }, []);

  const getQuestionTelemetry = useCallback((targetQuestionId: string) => {
    return {
      capturedGazeFrames: capturedGazeFramesRef.current.filter((f) => f.questionId === targetQuestionId),
      capturedPoseFrames: capturedPoseFramesRef.current.filter((f) => f.questionId === targetQuestionId),
      capturedAffectFrames: capturedAffectFramesRef.current.filter((f) => f.questionId === targetQuestionId),
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gazeWarningTimerRef.current) clearTimeout(gazeWarningTimerRef.current);
    };
  }, []);

  return {
    videoRef,
    liveGazeFrame,
    livePoseFrame,
    liveAffectFrame,
    gazeEyeContactPct,
    gazeFrameCount,
    showGazeWarning,
    latestGestureToast,
    isVisionReady,
    isONNXReady,
    isThrottled,
    isFallbackMode,
    clearPerQuestionFrames,
    getCapturedTelemetry,
    getQuestionTelemetry,
  };
}
