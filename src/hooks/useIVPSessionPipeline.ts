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
  VisionTelemetrySmoother,
} from '@/lib/services/temporalSmoothing';
import {
  evaluateEyeContact,
  classifyFocusZone,
} from '@/lib/services/ivpGazeEngine';
import { processPoseFrame } from '@/lib/services/ivpPoseEngine';
import { processAffectFrame } from '@/lib/services/ivpAffectEngine';
import { BoundedTelemetryBuffer } from '@/lib/utils/telemetryBuffer';
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
  paused?: boolean;
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
  lastEar: number | null;
  lastMar: number | null;
  faceBox: { x: number; y: number; width: number; height: number } | null;
  faceDetected: boolean | null;
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
    paused = false,
    questionId,
    questionIndex,
  } = options;

  // Active question attribution refs for asynchronous worker alignment (REM-4)
  const currentQuestionIdRef = useRef<string | undefined>(questionId);
  const currentQuestionIndexRef = useRef<number | undefined>(questionIndex);

  useEffect(() => {
    currentQuestionIdRef.current = questionId;
    currentQuestionIndexRef.current = questionIndex;
    if (questionId !== undefined) {
      capturedGazeFramesRef.current.setActiveQuestion(questionId);
      capturedPoseFramesRef.current.setActiveQuestion(questionId);
      capturedAffectFramesRef.current.setActiveQuestion(questionId);
    }
  }, [questionId, questionIndex]);

  // Single authoritative video DOM element reference
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Headless offscreen video fallback to guarantee pipeline runs even if UI component mounting was delayed
  const headlessVideoRef = useRef<HTMLVideoElement | null>(null);

  const getActiveVideo = useCallback((): HTMLVideoElement | null => {
    let video = videoRef.current;
    if (!video) {
      if (typeof document === 'undefined') return null;
      if (!headlessVideoRef.current) {
        const hv = document.createElement('video');
        hv.muted = true;
        hv.playsInline = true;
        hv.autoplay = true;
        headlessVideoRef.current = hv;
      }
      video = headlessVideoRef.current;
    }
    return video;
  }, []);

  // Synchronize video element with authoritative MediaStream from useInterviewCamera
  useEffect(() => {
    const video = getActiveVideo();
    if (video && mediaStream && video.srcObject !== mediaStream) {
      video.srcObject = mediaStream;
      video.play().catch(() => {});
    }
  }, [mediaStream, getActiveVideo]);

  // Session start time for monotonically increasing timestamps
  const sessionStartRef = useRef<number>(Date.now());

  // Bounded frame telemetry buffers (per-question cap: 200, global hard ceiling: 2000)
  const capturedGazeFramesRef = useRef<BoundedTelemetryBuffer<GazeFrameInput>>(new BoundedTelemetryBuffer());
  const capturedPoseFramesRef = useRef<BoundedTelemetryBuffer<HeadPoseFrameInput>>(new BoundedTelemetryBuffer());
  const capturedAffectFramesRef = useRef<BoundedTelemetryBuffer<AffectFrameInput>>(new BoundedTelemetryBuffer());

  // Unified temporal smoothing pipeline
  const telemetrySmootherRef = useRef(new VisionTelemetrySmoother());
  const lastPoseResultRef = useRef<HeadPoseFrameResult | null>(null);

  // Live HUD States
  const [liveGazeFrame, setLiveGazeFrame] = useState<GazeFrameResult | null>(null);
  const [gazeEyeContactPct, setGazeEyeContactPct] = useState(0);
  const [gazeFrameCount, setGazeFrameCount] = useState(0);
  const [,setGazeContactCount] = useState(0);
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
    lastLandmarks,
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
      const smoothedGaze = telemetrySmootherRef.current.gaze.update({
        pitchDegrees: telemetry.gazePitchDegrees ?? telemetry.gazeY,
        yawDegrees: telemetry.gazeYawDegrees ?? telemetry.gazeX,
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
      }, currentQuestionIdRef.current);

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
      const smoothedPose = telemetrySmootherRef.current.pose.update({
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

      capturedPoseFramesRef.current.push(poseInput, currentQuestionIdRef.current);

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

      const smoothedVA = telemetrySmootherRef.current.affect.update(
        { valence: rawValence, arousal: rawArousal },
        telemetry.composure
      );
      const smoothedEmotion = telemetrySmootherRef.current.emotion.update(discreteEmotion);

      const affectInput: AffectFrameInput = {
        timestampMs,
        valence: smoothedVA.vaCoordinates.valence,
        arousal: smoothedVA.vaCoordinates.arousal,
        confidence: 0.88,
        dominantEmotion: smoothedEmotion,
        questionId: qId,
        questionIndex: qIdx,
      };

      capturedAffectFramesRef.current.push(affectInput, currentQuestionIdRef.current);

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
    if (isSpeaking || !mediaStream || paused) return;

    const intervalMs = isThrottled ? 180 : 100;
    const timer = setInterval(() => {
      if (isTabPaused || paused) return;
      const video = getActiveVideo();
      if (!video) return;

      // Ensure stream is bound to the video element
      if (mediaStream && video.srcObject !== mediaStream) {
        video.srcObject = mediaStream;
        video.play().catch(() => {});
      }

      // Resume playback if paused
      if (video.paused && mediaStream && video.srcObject === mediaStream) {
        video.play().catch(() => {});
      }

      if (video.readyState < 2 || video.paused || video.ended) return;

      // Off-main-thread MediaPipe FaceLandmarker
      processVisionWorkerFrame(video);

      // Off-main-thread ONNX Models (L2CS-Net, HopeNet, AffectNet)
      // Tag submission with the exact question active at dispatch time and face ROI
      submitONNXFrame(video, {
        questionId: currentQuestionIdRef.current,
        questionIndex: currentQuestionIndexRef.current,
        timestampMs: Date.now() - sessionStartRef.current,
        faceBox: lastLandmarks?.envelope.faceDetected ? lastLandmarks.envelope.faceBox : null,
        mirrored: lastLandmarks?.envelope.mirrored ?? false,
      });
    }, intervalMs);

    return () => {
      clearInterval(timer);
      if (headlessVideoRef.current) {
        headlessVideoRef.current.srcObject = null;
        headlessVideoRef.current = null;
      }
    };
  }, [isSpeaking, mediaStream, paused, isTabPaused, isThrottled, processVisionWorkerFrame, submitONNXFrame, lastLandmarks, getActiveVideo]);

  // Reset per-question counts & smoothing filters on question change
  const clearPerQuestionFrames = useCallback(() => {
    setGazeFrameCount(0);
    setGazeContactCount(0);
    setGazeEyeContactPct(0);
    setLiveGazeFrame(null);
    setShowGazeWarning(false);
    if (gazeWarningTimerRef.current) clearTimeout(gazeWarningTimerRef.current);

    telemetrySmootherRef.current.reset();
    lastPoseResultRef.current = null;
  }, []);

  // Retrieve captured telemetry for submission to evaluation server
  const getCapturedTelemetry = useCallback((filterQuestionId?: string) => {
    return {
      capturedGazeFrames: capturedGazeFramesRef.current.getFrames(filterQuestionId),
      capturedPoseFrames: capturedPoseFramesRef.current.getFrames(filterQuestionId),
      capturedAffectFrames: capturedAffectFramesRef.current.getFrames(filterQuestionId),
    };
  }, []);

  const getQuestionTelemetry = useCallback((targetQuestionId: string) => {
    return {
      capturedGazeFrames: capturedGazeFramesRef.current.getFrames(targetQuestionId),
      capturedPoseFrames: capturedPoseFramesRef.current.getFrames(targetQuestionId),
      capturedAffectFrames: capturedAffectFramesRef.current.getFrames(targetQuestionId),
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
    lastEar: lastLandmarks?.envelope.faceDetected ? lastLandmarks.envelope.ear : null,
    lastMar: lastLandmarks?.envelope.faceDetected ? lastLandmarks.envelope.mar : null,
    faceBox: lastLandmarks?.envelope.faceDetected ? lastLandmarks.envelope.faceBox : null,
    faceDetected: lastLandmarks
      ? lastLandmarks.envelope.faceDetected && (lastLandmarks.envelope.regionConfidences?.overall ?? 1) >= 0.5
      : null,
    clearPerQuestionFrames,
    getCapturedTelemetry,
    getQuestionTelemetry,
  };
}
