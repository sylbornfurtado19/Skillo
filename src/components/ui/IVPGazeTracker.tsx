'use client';

/**
 * IVPGazeTracker
 * IVP Feature 2 SP2 — L2CS-Net Client-Side Integration
 *
 * Attaches a Canvas overlay over a live webcam video feed.
 * Performs lightweight frame sampling (~10 FPS) to:
 * 1. Estimate face/eye centroid position in the frame
 * 2. Derive heuristic pitch/yaw angle offsets from camera center
 * 3. Draw a 3D gaze directional ray from the estimated eye position
 * 4. Emit sampled GazeFrameInput records for server-side processing
 *
 * Design: Uses Canvas2D (not WebGL) to avoid GPU thread contention
 * with the 60 FPS UI render loop. Frame sampling uses rAF with a
 * frame-skip counter (every 6th rAF ≈ 10 FPS at 60 Hz displays).
 */

import React, {
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useState,
} from 'react';
import { classifyFocusZone, evaluateEyeContact } from '@/lib/services/ivpGazeEngine';
import type { GazeFrameInput, GazeFrameResult } from '@/types/index';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Target sampling rate for gaze analysis frames */
const SAMPLE_FPS = 10;
/** rAF call-skip interval for ~10 FPS at 60 Hz: every 6th frame */
const RAF_SKIP = Math.round(60 / SAMPLE_FPS);

/** Eye region is estimated at 35-65% height of detected face bounds */
const EYE_Y_RATIO = 0.38;

/** Max absolute deviation (px) from frame center for full off-screen classification */
const MAX_DEVIATION_PX = 120;

/** Gaze ray length in canvas pixels */
const RAY_LENGTH = 80;

// ── Color palette by focus zone ───────────────────────────────────────────────
const ZONE_RAY_COLORS: Record<GazeFrameResult['screenFocusZone'], { ray: string; glow: string }> = {
  CENTER_SCREEN:  { ray: '#10b981', glow: 'rgba(16,185,129,0.35)' },
  LOOKING_UP:     { ray: '#f59e0b', glow: 'rgba(245,158,11,0.3)'  },
  LOOKING_DOWN:   { ray: '#f59e0b', glow: 'rgba(245,158,11,0.3)'  },
  LOOKING_LEFT:   { ray: '#f59e0b', glow: 'rgba(245,158,11,0.3)'  },
  LOOKING_RIGHT:  { ray: '#f59e0b', glow: 'rgba(245,158,11,0.3)'  },
  OFF_SCREEN:     { ray: '#ef4444', glow: 'rgba(239,68,68,0.35)'   },
};

// ── Public Handle (via ref) ───────────────────────────────────────────────────
export interface IVPGazeTrackerHandle {
  /** Start webcam capture and gaze sampling */
  start(): Promise<void>;
  /** Stop sampling and release MediaStream */
  stop(): void;
  /** Snapshot of all collected gaze frames */
  getFrames(): GazeFrameInput[];
  /** Clear collected frame buffer */
  clearFrames(): void;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface IVPGazeTrackerProps {
  /** Fires every sampled frame with the current GazeFrameResult for live HUD updates */
  onFrame?: (frame: GazeFrameResult) => void;
  /** Whether the tracker UI should be visible (can be hidden while still sampling) */
  visible?: boolean;
  /** CSS class applied to the outer container */
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Heuristic gaze angle estimation from face centroid displacement
// Converts pixel offset from camera center → estimated degrees
// ─────────────────────────────────────────────────────────────────────────────

function estimateGazeAnglesFromDisplacement(
  dx: number, // horizontal offset from center (px), right = positive
  dy: number, // vertical offset from center (px), down = positive
  frameW: number,
  frameH: number
): { pitchDeg: number; yawDeg: number } {
  // Normalize displacement to [-1, +1]
  const normX = Math.max(-1, Math.min(1, dx / (frameW / 2)));
  const normY = Math.max(-1, Math.min(1, dy / (frameH / 2)));

  // Map to angular range: ±40° max for yaw, ±30° max for pitch
  const yawDeg = normX * 40;
  const pitchDeg = -normY * 30; // invert: looking down → negative pitch

  return { pitchDeg, yawDeg };
}

/**
 * Sample brightness distribution from a canvas region to estimate face centroid.
 * Returns {cx, cy} in canvas pixel coordinates, or null if sampling fails.
 */
function estimateFaceCentroid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): { cx: number; cy: number } | null {
  try {
    const imageData = ctx.getImageData(0, 0, w, Math.min(h, h * 0.6));
    const data = imageData.data;
    const len = data.length;

    // 1. Calculate frame-level average luminance for adaptive contrast scaling
    let totalLuma = 0;
    let pixelCount = 0;
    for (let i = 0; i < len; i += 16) {
      totalLuma += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      pixelCount++;
    }
    const avgLuma = pixelCount > 0 ? totalLuma / pixelCount : 128;
    // Adaptive threshold scales down in low light, scales up in bright light
    const adaptiveThreshold = Math.max(12, Math.min(45, avgLuma * 0.25));

    let weightX = 0, weightY = 0, totalWeight = 0;
    const pw = imageData.width;
    const ph = imageData.height;

    for (let y = 0; y < ph; y += 4) {
      for (let x = 0; x < pw; x += 4) {
        const idx = (y * pw + x) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        const skinScore = Math.max(0, r - Math.max(g, b) * 0.6);
        if (skinScore > adaptiveThreshold) {
          weightX += x * skinScore;
          weightY += y * skinScore;
          totalWeight += skinScore;
        }
      }
    }

    // Zero-frame / occlusion protection: return null safely if face is missing or occluded
    if (totalWeight < 400) return null;

    return {
      cx: weightX / totalWeight,
      cy: weightY / totalWeight,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const IVPGazeTracker = forwardRef<IVPGazeTrackerHandle, IVPGazeTrackerProps>(
  function IVPGazeTracker({ onFrame, visible = true, className = '' }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const samplerCanvasRef = useRef<HTMLCanvasElement | null>(null);

    const streamRef = useRef<MediaStream | null>(null);
    const rafIdRef = useRef<number>(0);
    const rafCountRef = useRef<number>(0);
    const framesRef = useRef<GazeFrameInput[]>([]);
    const sessionStartRef = useRef<number>(Date.now());
    const isRunningRef = useRef(false);

    const [cameraError, setCameraError] = useState<string | null>(null);
    const [isStarted, setIsStarted] = useState(false);

    // ── Draw gaze ray on display canvas ──────────────────────────────────────
    const drawGazeRay = useCallback(
      (
        ctx: CanvasRenderingContext2D,
        w: number,
        h: number,
        eyeCx: number,
        eyeCy: number,
        yawDeg: number,
        pitchDeg: number,
        zone: GazeFrameResult['screenFocusZone']
      ) => {
        const colors = ZONE_RAY_COLORS[zone];
        const yawRad = (yawDeg * Math.PI) / 180;
        const pitchRad = (pitchDeg * Math.PI) / 180;

        // 3D→2D projection: x component from yaw, y component from pitch
        const rayDx = Math.sin(yawRad) * Math.cos(pitchRad) * RAY_LENGTH;
        const rayDy = -Math.sin(pitchRad) * RAY_LENGTH; // canvas y flips

        const endX = eyeCx + rayDx;
        const endY = eyeCy + rayDy;

        ctx.save();

        // Glow halo
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = 12;

        // Ray line
        ctx.beginPath();
        ctx.moveTo(eyeCx, eyeCy);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = colors.ray;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Arrow head at tip
        const angle = Math.atan2(rayDy, rayDx);
        const arrowSize = 8;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - arrowSize * Math.cos(angle - Math.PI / 6),
          endY - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          endX - arrowSize * Math.cos(angle + Math.PI / 6),
          endY - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = colors.ray;
        ctx.shadowBlur = 16;
        ctx.fill();

        // Eye origin dot
        ctx.beginPath();
        ctx.arc(eyeCx, eyeCy, 4, 0, Math.PI * 2);
        ctx.fillStyle = colors.ray;
        ctx.shadowBlur = 8;
        ctx.fill();

        ctx.restore();
      },
      []
    );

    // ── Main rAF sampling loop ────────────────────────────────────────────────
    const runSamplingLoop = useCallback(() => {
      if (!isRunningRef.current) return;

      rafCountRef.current++;

      // Only process every N-th frame (≈ 10 FPS at 60 Hz)
      if (rafCountRef.current % RAF_SKIP === 0) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const samplerCanvas = samplerCanvasRef.current;

        if (
          video &&
          canvas &&
          samplerCanvas &&
          video.readyState >= 2 &&
          !video.paused &&
          !video.ended
        ) {
          const w = video.videoWidth || canvas.width;
          const h = video.videoHeight || canvas.height;

          // Draw current video frame onto sampler canvas for pixel analysis
          const samplerCtx = samplerCanvas.getContext('2d');
          if (samplerCtx) {
            samplerCanvas.width = w;
            samplerCanvas.height = h;
            samplerCtx.drawImage(video, 0, 0, w, h);

            // Estimate face centroid
            const centroid = estimateFaceCentroid(samplerCtx, w, h);

            // Derive gaze angles from centroid displacement
            let pitchDeg = 0;
            let yawDeg = 0;
            let eyeCx = w / 2;
            let eyeCy = h * EYE_Y_RATIO;

            if (centroid) {
              const dx = centroid.cx - w / 2;
              const dy = centroid.cy - h / 2;
              const angles = estimateGazeAnglesFromDisplacement(dx, dy, w, h);
              pitchDeg = angles.pitchDeg;
              yawDeg = angles.yawDeg;
              eyeCx = centroid.cx;
              eyeCy = Math.max(0, centroid.cy - h * 0.08); // offset up to eye region
            }

            const zone = classifyFocusZone(pitchDeg, yawDeg);
            const isEyeContact = evaluateEyeContact(pitchDeg, yawDeg);
            const timestampMs = Date.now() - sessionStartRef.current;

            // Collect GazeFrameInput for server submission
            const frameInput: GazeFrameInput = {
              timestampMs,
              pitchDegrees: Math.round(pitchDeg * 100) / 100,
              yawDegrees: Math.round(yawDeg * 100) / 100,
              confidence: centroid ? 0.75 : 0.3,
            };
            framesRef.current.push(frameInput);

            // Notify parent with processed GazeFrameResult
            onFrame?.({
              frameTimestampMs: timestampMs,
              gazeAngles: {
                pitchDegrees: frameInput.pitchDegrees!,
                yawDegrees: frameInput.yawDegrees!,
              },
              isEyeContact,
              screenFocusZone: zone,
              confidenceScore: frameInput.confidence!,
            });

            // Draw overlay on display canvas
            const displayCtx = canvas.getContext('2d');
            if (displayCtx) {
              canvas.width = w;
              canvas.height = h;
              displayCtx.clearRect(0, 0, w, h);
              drawGazeRay(displayCtx, w, h, eyeCx, eyeCy, yawDeg, pitchDeg, zone);

              // Zone label
              displayCtx.save();
              displayCtx.fillStyle = ZONE_RAY_COLORS[zone].ray;
              displayCtx.font = 'bold 10px monospace';
              displayCtx.fillText(zone.replace(/_/g, ' '), 8, h - 8);
              displayCtx.restore();
            }
          }
        }
      }

      rafIdRef.current = requestAnimationFrame(runSamplingLoop);
    }, [drawGazeRay, onFrame]);

    // ── Public handle ─────────────────────────────────────────────────────────
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
            // Create offscreen sampler canvas
            samplerCanvasRef.current = document.createElement('canvas');
            sessionStartRef.current = Date.now();
            framesRef.current = [];
            isRunningRef.current = true;
            setIsStarted(true);
            setCameraError(null);
            runSamplingLoop();
          } catch (err: unknown) {
            const msg =
              err instanceof Error && err.name === 'NotAllowedError'
                ? 'Camera access denied. Grant permission in browser settings.'
                : 'Camera unavailable. Gaze tracking disabled.';
            setCameraError(msg);
          }
        },
        stop() {
          isRunningRef.current = false;
          cancelAnimationFrame(rafIdRef.current);
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
        },
      }),
      [runSamplingLoop]
    );

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        isRunningRef.current = false;
        cancelAnimationFrame(rafIdRef.current);
        streamRef.current?.getTracks().forEach(t => t.stop());
      };
    }, []);

    if (!visible) return null;

    return (
      <div className={`relative rounded-xl overflow-hidden bg-[#060b14] border border-white/8 ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5">
          <span className="text-[9px] text-gray-500 font-mono uppercase tracking-widest">
            Webcam Focus & Gaze Estimator
          </span>
          <div className="flex items-center gap-1.5">
            <div
              className={`h-1.5 w-1.5 rounded-full ${isStarted ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600'}`}
            />
            <span className="text-[8px] text-gray-600 font-mono">
              {isStarted ? '10 FPS' : 'IDLE'}
            </span>
          </div>
        </div>

        {/* Video + Canvas overlay */}
        <div className="relative" style={{ aspectRatio: '4/3' }}>
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            muted
            playsInline
            style={{ transform: 'scaleX(-1)' }} // mirror for natural feel
          />
          {/* Gaze ray overlay canvas — mirrors video */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ transform: 'scaleX(-1)' }}
          />

          {/* Camera error / inactive overlay */}
          {!isStarted && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#030712]/80 text-center px-4 gap-2">
              {cameraError ? (
                <>
                  <div className="text-red-400 text-lg">🚫</div>
                  <p className="text-[10px] text-red-400 font-mono">{cameraError}</p>
                </>
              ) : (
                <>
                  <div className="text-gray-600 text-2xl">📷</div>
                  <p className="text-[10px] text-gray-600 font-mono">
                    Camera inactive
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

export default IVPGazeTracker;
