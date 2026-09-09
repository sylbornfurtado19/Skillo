'use client';

/**
 * IVPAffectTracker
 * IVP Feature 4 — AffectNet Facial Expression & Valence-Arousal Tracker
 *
 * Samples keyframes at ~2 FPS (every 30th rAF frame), estimates continuous
 * Valence-Arousal coordinates (V, A) in [-1.0, +1.0], and emits AffectFrameInput.
 */

import React, {
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useState,
} from 'react';
import { extractFacialExpressions } from '@/lib/services/ivpExpressionKernel';
import { processAffectFrame } from '@/lib/services/ivpAffectEngine';
import { AffectiveEMA, CategoricalConsensusSmoother } from '@/lib/services/temporalSmoothing';
import type { AffectFrameInput, AffectFrameResult } from '@/types/index';

const SAMPLE_FPS = 4;
const RAF_SKIP = Math.round(60 / SAMPLE_FPS);

export interface IVPAffectTrackerHandle {
  start(): Promise<void>;
  stop(): void;
  getFrames(): AffectFrameInput[];
  clearFrames(): void;
}

interface IVPAffectTrackerProps {
  onFrame?: (frame: AffectFrameResult) => void;
  visible?: boolean;
  className?: string;
}

const IVPAffectTracker = forwardRef<IVPAffectTrackerHandle, IVPAffectTrackerProps>(
  function IVPAffectTracker({ onFrame, visible = true, className = '' }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const samplerCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const rafIdRef = useRef<number>(0);
    const rafCountRef = useRef<number>(0);
    const framesRef = useRef<AffectFrameInput[]>([]);
    const sessionStartRef = useRef<number>(Date.now());
    const isRunningRef = useRef(false);
    const affectEmaRef = useRef(new AffectiveEMA(0.25, 0.20));
    const emotionConsensusRef = useRef(new CategoricalConsensusSmoother(5, 0.30));

    const [isStarted, setIsStarted] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

    const runSamplingLoop = useCallback(() => {
      if (!isRunningRef.current) return;
      rafCountRef.current++;

      if (rafCountRef.current % RAF_SKIP === 0) {
        const video = videoRef.current;
        const samplerCanvas = samplerCanvasRef.current;

        if (video && samplerCanvas && video.readyState >= 2 && !video.paused && !video.ended) {
          const w = video.videoWidth || 320;
          const h = video.videoHeight || 240;

          const samplerCtx = samplerCanvas.getContext('2d');
          if (samplerCtx) {
            samplerCanvas.width = w;
            samplerCanvas.height = h;
            samplerCtx.drawImage(video, 0, 0, w, h);

            const imgData = samplerCtx.getImageData(0, 0, w, h);
            const expression = extractFacialExpressions(imgData.data, w, h);
            const timestampMs = Date.now() - sessionStartRef.current;

            const input: AffectFrameInput = {
              timestampMs,
              valence: expression.valenceArousal.valence,
              arousal: expression.valenceArousal.arousal,
              confidence: expression.confidence,
              smileScore: expression.smileScore,
              dominantEmotion: expression.dominantEmotion,
            };

            framesRef.current.push(input);

            const rawFrameResult = processAffectFrame(input);
            const smoothedVA = affectEmaRef.current.update(
              rawFrameResult.vaCoordinates,
              rawFrameResult.composureScore
            );
            const smoothedEmotion = emotionConsensusRef.current.update(
              rawFrameResult.dominantEmotion
            );

            const frameResult: AffectFrameResult = {
              ...rawFrameResult,
              vaCoordinates: smoothedVA.vaCoordinates,
              composureScore: smoothedVA.composureScore,
              dominantEmotion: smoothedEmotion,
            };
            onFrame?.(frameResult);
          }
        }
      }

      rafIdRef.current = requestAnimationFrame(runSamplingLoop);
    }, [onFrame]);

    useImperativeHandle(
      ref,
      () => ({
        async start() {
          if (isRunningRef.current) return;
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: { width: 320, height: 240, facingMode: 'user' },
              audio: false,
            });
            streamRef.current = stream;
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              await videoRef.current.play();
            }
            samplerCanvasRef.current = document.createElement('canvas');
            sessionStartRef.current = Date.now();
            framesRef.current = [];
            isRunningRef.current = true;
            setIsStarted(true);
            runSamplingLoop();
          } catch (err: unknown) {
            const msg =
              err instanceof Error && err.name === 'NotAllowedError'
                ? 'Camera access denied. Grant permission in browser settings.'
                : 'Camera unavailable. Visual composure tracking disabled.';
            setCameraError(msg);
            setIsStarted(false);
          }
        },
        stop() {
          isRunningRef.current = false;
          cancelAnimationFrame(rafIdRef.current);
          affectEmaRef.current.reset();
          emotionConsensusRef.current.reset();
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
          }
          if (videoRef.current) {
            videoRef.current.srcObject = null;
          }
          setIsStarted(false);
        },
        getFrames() {
          return [...framesRef.current];
        },
        clearFrames() {
          framesRef.current = [];
          affectEmaRef.current.reset();
          emotionConsensusRef.current.reset();
        },
      }),
      [runSamplingLoop]
    );

    useEffect(() => {
      return () => {
        isRunningRef.current = false;
        cancelAnimationFrame(rafIdRef.current);
        streamRef.current?.getTracks().forEach(t => t.stop());
      };
    }, []);

    if (!visible) return null;

    return (
      <div
        className={`hidden ${className}`}
        data-camera-error={cameraError ?? undefined}
        aria-hidden="true"
      >
        <video ref={videoRef} muted playsInline />
      </div>
    );
  }
);

export default IVPAffectTracker;
