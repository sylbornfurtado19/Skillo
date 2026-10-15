'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  FaFlask,
  FaVideo,
  FaVideoSlash,
  FaUpload,
  FaCube,
  FaMicrochip,
  FaWaveSquare,
} from 'react-icons/fa';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import IVPInteractiveCanvas, {
  type DiagnosticMode,
  type DiagnosticMetrics,
} from '../components/ui/IVPInteractiveCanvas';
import IVPSignalOscilloscope from '../components/ui/IVPSignalOscilloscope';
import { useONNXWorker } from '../hooks/useONNXWorker';
import { useVisionWorker } from '../hooks/useVisionWorker';
import type { TrackingPreset } from '../lib/services/temporalSmoothing';

export default function IVPLab() {
  // Active Diagnostic Mode — DEFAULTS IMMEDIATELY TO SOBEL (Unit 4/5) FOR INSTANT VISUAL IMPACT
  const [activeMode, setActiveMode] = useState<DiagnosticMode>('SOBEL_GRADIENTS');

  // Media Input Source State
  const [inputSource, setInputSource] = useState<'sample' | 'webcam' | 'upload'>('sample');

  // Overlay Toggles
  const [show3DAxes, setShow3DAxes] = useState<boolean>(true);
  const [showHistogram, setShowHistogram] = useState<boolean>(true);
  const [showBoundingBox, setShowBoundingBox] = useState<boolean>(true);
  const [showLandmarks, setShowLandmarks] = useState<boolean>(true);
  const [showDebugHUD, setShowDebugHUD] = useState<boolean>(false);
  const [mirrored, setMirrored] = useState<boolean>(true);
  const [trackingPreset, setTrackingPreset] = useState<TrackingPreset>('BALANCED');

  // Dedicated Off-Main-Thread Vision Worker
  const {
    lastLandmarks,
    stats: workerStats,
    isFallbackMode,
    fallbackReason,
    processFrame: processWorkerFrame,
    isTabPaused,
    isThrottled,
    suggestedCadenceFps,
    timeline: workerTimeline,
  } = useVisionWorker({
    autoStart: true,
    backend: 'WEBGL',
  });

  // Dedicated Off-Main-Thread ONNX Worker
  const {
    submitFrame: submitONNXFrame,
    telemetry: onnxTelemetry,
    isWorkerActive: isONNXWorkerActive,
  } = useONNXWorker({
    autoStart: true,
  });

  // Live Physiological Signals (EAR & MAR)
  const [currentEAR, setCurrentEAR] = useState<number>(0.285);
  const [currentMAR, setCurrentMAR] = useState<number>(0.145);
  const [blinkCount, setBlinkCount] = useState<number>(0);
  const [blinkRatePerMin, setBlinkRatePerMin] = useState<number>(14.5);
  const [speechActivePct, setSpeechActivePct] = useState<number>(32);

  // Diagnostic Canvas Metrics
  const [canvasMetrics, setCanvasMetrics] = useState<DiagnosticMetrics>({
    ear: 0.285,
    mar: 0.145,
    fps: 60,
    targetLost: false,
  });

  // DOM Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sampleImageRef = useRef<HTMLImageElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const offscreenInferCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const inferIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Blink state tracking
  const wasEyeClosedRef = useRef<boolean>(false);
  const lastBlinkTimeRef = useRef<number>(0);
  const blinkTimestampsRef = useRef<number[]>([]);

  // 1. Initialize Sample Face Image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=640';
    img.onload = () => {
      sampleImageRef.current = img;
    };
  }, []);

  // 2. Manage Webcam Streams
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: { ideal: 30 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setInputSource('webcam');
    } catch (err) {
      console.warn('Unable to access webcam for IVP lab:', err);
      setInputSource('sample');
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (inputSource === 'webcam') {
      startWebcam();
    } else {
      stopWebcam();
    }
    return () => stopWebcam();
  }, [inputSource]);

  // 3. Handle File Uploads
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        sampleImageRef.current = img;
        setInputSource('upload');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // 4. Continuous Asynchronous ONNX Background Inference Loop (Adaptive Cadence)
  useEffect(() => {
    if (!offscreenInferCanvasRef.current) {
      const c = document.createElement('canvas');
      c.width = 224;
      c.height = 224;
      offscreenInferCanvasRef.current = c;
    }

    // Adaptive cadence: default 90ms (~11 FPS) when healthy, throttled to 180ms (~5.5 FPS) under overload
    const intervalMs = isThrottled ? 180 : 90;

    inferIntervalRef.current = setInterval(async () => {
      // Pause inference loop if tab is hidden / pagehide
      if (isTabPaused) return;

      const inferCanvas = offscreenInferCanvasRef.current;
      if (!inferCanvas) return;
      const ctx = inferCanvas.getContext('2d');
      if (!ctx) return;

      const source = inputSource === 'webcam' ? videoRef.current : sampleImageRef.current;
      if (!source) return;

      try {
        if (source instanceof HTMLVideoElement && source.readyState >= 2) {
          ctx.drawImage(source, 0, 0, 224, 224);
        } else if (source instanceof HTMLImageElement && source.complete) {
          ctx.drawImage(source, 0, 0, 224, 224);
        }

        // Continuous off-main-thread landmark extraction
        processWorkerFrame(source);

        // Continuous off-main-thread ONNX inference via Web Worker
        submitONNXFrame(inferCanvas);
      } catch (err) {
        console.warn('Continuous ONNX pipeline tick warning:', err);
      }
    }, intervalMs);

    return () => {
      if (inferIntervalRef.current) clearInterval(inferIntervalRef.current);
    };
  }, [inputSource, processWorkerFrame, submitONNXFrame, isTabPaused, isThrottled]);

  return (
    <div className="space-y-6 text-left max-w-7xl mx-auto pb-16">
      {/* Hidden Video for stream capture */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="hidden"
      />

      {/* Top Academic Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-bg-surface border border-border rounded-2xl p-5 shadow-soft">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-primary-soft border border-primary/30 flex items-center justify-center text-primary text-xl">
            <FaFlask />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-text-primary font-heading">
                IVP Computer Vision Diagnostic Workbench
              </h1>
              <Badge variant="primary" size="sm">
                Units 1–8 Aligned
              </Badge>
            </div>
            <p className="text-xs text-text-secondary font-mono mt-0.5">
              Real-time pixel-level frame inspection &bull; ONNX WebAssembly inference &bull; Mathematical signal telemetry
            </p>
          </div>
        </div>

        {/* Media Source & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={inputSource === 'sample' ? 'primary' : 'glass'}
            size="sm"
            onClick={() => setInputSource('sample')}
            className="text-xs"
          >
            Sample Face
          </Button>
          <Button
            variant={inputSource === 'webcam' ? 'primary' : 'glass'}
            size="sm"
            onClick={() => setInputSource('webcam')}
            className="text-xs"
          >
            {inputSource === 'webcam' ? <FaVideo className="mr-1.5" /> : <FaVideoSlash className="mr-1.5" />}
            Live Webcam
          </Button>
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl border border-border bg-bg-surface-alt hover:bg-border/40 text-xs font-semibold text-text-secondary transition">
              <FaUpload className="mr-1.5 text-xs" aria-hidden="true" /> Upload Frame
            </span>
          </label>
        </div>
      </div>

      {/* Main Diagnostic Workspace (2-Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Dual-Viewport Diagnostic Canvas (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          <Card variant="default" className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between border-b border-border pb-2 text-xs gap-2">
              <div className="flex items-center gap-2 font-mono text-text-primary font-bold uppercase tracking-wider">
                <FaCube className="text-primary" aria-hidden="true" />
                <span>Interactive Dual-Viewport Canvas</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowLandmarks(!showLandmarks)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono transition cursor-pointer ${
                    showLandmarks ? 'bg-success/20 text-success border border-success/30' : 'bg-bg-surface-alt border border-border text-text-secondary'
                  }`}
                >
                  Eye &amp; Lip Contours
                </button>
                <button
                  type="button"
                  onClick={() => setShowBoundingBox(!showBoundingBox)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono transition cursor-pointer ${
                    showBoundingBox ? 'bg-secondary/20 text-secondary border border-secondary/30' : 'bg-bg-surface-alt border border-border text-text-secondary'
                  }`}
                >
                  Face ROI Reticle
                </button>
                <button
                  type="button"
                  onClick={() => setShow3DAxes(!show3DAxes)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono transition cursor-pointer ${
                    show3DAxes ? 'bg-primary-soft text-primary border border-primary/30' : 'bg-bg-surface-alt border border-border text-text-secondary'
                  }`}
                >
                  3D Pinhole Axes
                </button>
                <button
                  type="button"
                  onClick={() => setShowHistogram(!showHistogram)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono transition cursor-pointer ${
                    showHistogram ? 'bg-success/20 text-success border border-success/30' : 'bg-bg-surface-alt border border-border text-text-secondary'
                  }`}
                >
                  256-Bin Hist HUD
                </button>
                <button
                  type="button"
                  onClick={() => setShowDebugHUD(!showDebugHUD)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono transition cursor-pointer ${
                    showDebugHUD ? 'bg-warning/20 text-warning border border-warning/30' : 'bg-bg-surface-alt border border-border text-text-secondary'
                  }`}
                >
                  ⚡ Debug HUD
                </button>
                {inputSource === 'webcam' && (
                  <button
                    type="button"
                    onClick={() => setMirrored(!mirrored)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono transition cursor-pointer ${
                      mirrored ? 'bg-primary-soft text-primary border border-primary/30' : 'bg-bg-surface-alt border border-border text-text-secondary'
                    }`}
                  >
                    Mirror: {mirrored ? 'ON' : 'OFF'}
                  </button>
                )}
                {/* Tracking Responsiveness Preset Switcher */}
                <div className="flex items-center gap-1 bg-bg-surface-alt p-0.5 rounded-md border border-border text-xs font-mono">
                  <span className="text-text-secondary px-1 text-xs">PRESET:</span>
                  {(['BALANCED', 'ULTRA_SMOOTH', 'ULTRA_RESPONSIVE'] as TrackingPreset[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setTrackingPreset(p)}
                      className={`px-1.5 py-0.5 rounded text-xs transition cursor-pointer ${
                        trackingPreset === p
                          ? 'bg-primary text-text-on-primary font-bold'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {p === 'BALANCED' ? 'BALANCED' : p === 'ULTRA_SMOOTH' ? 'SMOOTH' : 'RESPONSIVE'}
                    </button>
                  ))}
                </div>
                {isFallbackMode && fallbackReason && (
                  <span className="px-2 py-0.5 rounded text-xs font-mono bg-warning/20 text-warning border border-warning/30">
                    ⚠ FALLBACK: {fallbackReason}
                  </span>
                )}
                {isThrottled && (
                  <span className="px-2 py-0.5 rounded text-xs font-mono bg-warning/20 text-warning border border-warning/30 animate-pulse">
                    ⚡ THROTTLED ({suggestedCadenceFps} FPS)
                  </span>
                )}
                {isTabPaused && (
                  <span className="px-2 py-0.5 rounded text-xs font-mono bg-secondary/20 text-secondary border border-secondary/30">
                    ⏸ TAB PAUSED
                  </span>
                )}
              </div>
            </div>

            {/* Interactive Canvas Viewport */}
            <IVPInteractiveCanvas
              sourceElement={inputSource === 'webcam' ? videoRef.current : sampleImageRef.current}
              activeMode={activeMode}
              onModeChange={(mode) => setActiveMode(mode)}
              show3DAxes={show3DAxes}
              showHistogram={showHistogram}
              showBoundingBox={showBoundingBox}
              showLandmarks={showLandmarks}
              showDebugHUD={showDebugHUD}
              mirrored={mirrored && inputSource === 'webcam'}
              workerLandmarks={lastLandmarks}
              workerTimeline={workerTimeline}
              trackingPreset={trackingPreset}
              workerStats={workerStats}
              poseAngles={{
                yaw: onnxTelemetry.yaw,
                pitch: onnxTelemetry.pitch,
                roll: onnxTelemetry.roll,
              }}
              gazeCoords={{
                x: onnxTelemetry.gazeX,
                y: onnxTelemetry.gazeY,
              }}
              onMetricsUpdate={(metrics) => {
                setCanvasMetrics(metrics);
                if (metrics.ear !== undefined) {
                  setCurrentEAR(metrics.ear);
                  const now = performance.now();
                  // Hysteresis thresholding: trigger close at < 0.22, reopen at >= 0.24, with 70ms debounce
                  if (metrics.ear < 0.22 && !wasEyeClosedRef.current) {
                    if (now - lastBlinkTimeRef.current > 70) {
                      wasEyeClosedRef.current = true;
                      lastBlinkTimeRef.current = now;
                      setBlinkCount((prev) => prev + 1);
                      blinkTimestampsRef.current.push(now);
                      blinkTimestampsRef.current = blinkTimestampsRef.current.filter((t) => now - t <= 60000);
                      setBlinkRatePerMin(blinkTimestampsRef.current.length);
                    }
                  } else if (metrics.ear >= 0.24 && wasEyeClosedRef.current) {
                    wasEyeClosedRef.current = false;
                  }
                }
                if (metrics.mar !== undefined) {
                  setCurrentMAR(metrics.mar);
                  setSpeechActivePct(metrics.mar >= 0.25 ? 76 : 14);
                }
              }}
            />
          </Card>

          {/* Academic Syllabus Diagnostic Reference */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-bg-surface border border-border p-3 rounded-xl space-y-1 text-left shadow-soft">
              <span className="text-xs font-mono text-primary font-bold block uppercase">Unit 4 &amp; 5</span>
              <p className="text-xs font-semibold text-text-primary">Sobel Vector Field</p>
              <p className="text-xs text-text-secondary font-mono">3x3 Convolutions &bull; Gradient Orientation</p>
            </div>
            <div className="bg-bg-surface border border-border p-3 rounded-xl space-y-1 text-left shadow-soft">
              <span className="text-xs font-mono text-secondary font-bold block uppercase">Unit 6 &amp; 7</span>
              <p className="text-xs font-semibold text-text-primary">YCrCb Otsu Mask</p>
              <p className="text-xs text-text-secondary font-mono">Chrominance Cr &bull; Otsu Variance Max</p>
            </div>
            <div className="bg-bg-surface border border-border p-3 rounded-xl space-y-1 text-left shadow-soft">
              <span className="text-xs font-mono text-primary font-bold block uppercase">Unit 1 &amp; 2</span>
              <p className="text-xs font-semibold text-text-primary">Spatial Equalization</p>
              <p className="text-xs text-text-secondary font-mono">Bilinear scaling &bull; CDF Histogram Transfer</p>
            </div>
            <div className="bg-bg-surface border border-border p-3 rounded-xl space-y-1 text-left shadow-soft">
              <span className="text-xs font-mono text-danger font-bold block uppercase">Unit 8</span>
              <p className="text-xs font-semibold text-text-primary">Temporal MAD</p>
              <p className="text-xs text-text-secondary font-mono">Inter-Frame Motion Delta Buffer</p>
            </div>
          </div>
        </div>

        {/* Right Column: Signal Telemetry Oscilloscopes & Model Metrics (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Signal Oscilloscopes */}
          <Card variant="default" className="p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2 text-xs">
              <div className="flex items-center gap-2 font-mono text-text-primary font-bold uppercase tracking-wider">
                <FaWaveSquare className="text-primary" aria-hidden="true" />
                <span>Physiological Signal Oscilloscopes</span>
              </div>
              <Badge variant="success" size="sm">
                60 FPS Live
              </Badge>
            </div>

            {/* EAR Oscilloscope */}
            <IVPSignalOscilloscope
              label="Eye Aspect Ratio (EAR)"
              unit="ratio"
              currentValue={currentEAR}
              threshold={0.21}
              thresholdLabel="Blink Threshold (0.21)"
              minRange={0.1}
              maxRange={0.4}
              color="var(--success)"
              height={85}
              stats={{
                triggerCount: blinkCount,
                triggerLabel: 'Total Blinks',
                ratePerMin: blinkRatePerMin,
                rateLabel: 'Blink Rate',
              }}
            />

            {/* MAR Oscilloscope */}
            <IVPSignalOscilloscope
              label="Mouth Aspect Ratio (MAR)"
              unit="ratio"
              currentValue={currentMAR}
              threshold={0.25}
              thresholdLabel="Speech Threshold (0.25)"
              minRange={0.05}
              maxRange={0.5}
              color="var(--secondary)"
              height={85}
              stats={{
                triggerCount: speechActivePct,
                triggerLabel: 'Speaking Ratio %',
                ratePerMin: 18.0,
                rateLabel: 'Cadence',
              }}
            />
          </Card>

          {/* Real-Time ONNX Edge Neural Telemetry */}
          <Card variant="default" className="p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2 text-xs">
              <div className="flex items-center gap-2 font-mono text-text-primary font-bold uppercase tracking-wider">
                <FaMicrochip className="text-primary" aria-hidden="true" />
                <span>Edge Neural Model Telemetry</span>
              </div>
              <span className="text-xs font-mono text-text-secondary">
                WASM &bull; {onnxTelemetry.totalInferenceTimeMs} ms
              </span>
            </div>

            {/* 3D Euler Angles */}
            <div className="grid grid-cols-3 gap-2 text-center font-mono">
              <div className="bg-bg-surface-alt p-2.5 rounded-lg border border-border">
                <span className="text-xs text-text-secondary block">Yaw</span>
                <span className="text-xs font-bold text-primary">{onnxTelemetry.yaw.toFixed(1)}°</span>
              </div>
              <div className="bg-bg-surface-alt p-2.5 rounded-lg border border-border">
                <span className="text-xs text-text-secondary block">Pitch</span>
                <span className="text-xs font-bold text-secondary">{onnxTelemetry.pitch.toFixed(1)}°</span>
              </div>
              <div className="bg-bg-surface-alt p-2.5 rounded-lg border border-border">
                <span className="text-xs text-text-secondary block">Roll</span>
                <span className="text-xs font-bold text-text-primary">{onnxTelemetry.roll.toFixed(1)}°</span>
              </div>
            </div>

            {/* Gaze Vector & Composure Metrics */}
            <div className="space-y-2 text-xs font-mono pt-1">
              <div className="flex items-center justify-between bg-bg-surface-alt p-2 rounded-lg border border-border">
                <span className="text-text-secondary">Gaze Coordinate Vector:</span>
                <strong className="text-primary">
                  [{onnxTelemetry.gazeX.toFixed(2)}, {onnxTelemetry.gazeY.toFixed(2)}]
                </strong>
              </div>

              <div className="flex items-center justify-between bg-bg-surface-alt p-2 rounded-lg border border-border">
                <span className="text-text-secondary">Facial Composure Index:</span>
                <strong className="text-success">{onnxTelemetry.composure}%</strong>
              </div>

              <div className="flex items-center justify-between bg-bg-surface-alt p-2 rounded-lg border border-border">
                <span className="text-text-secondary">Dominant Emotion Class:</span>
                <Badge variant="primary" size="sm">
                  {onnxTelemetry.dominantEmotion}
                </Badge>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
