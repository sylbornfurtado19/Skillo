'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaFlask,
  FaVideo,
  FaVideoSlash,
  FaUpload,
  FaPlay,
  FaPause,
  FaSlidersH,
  FaCube,
  FaEye,
  FaLayerGroup,
  FaBolt,
  FaBook,
  FaCheckCircle,
  FaDownload,
  FaSyncAlt,
  FaBrain,
  FaMagic,
  FaMicrochip,
} from 'react-icons/fa';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import {
  runGazeONNX,
  runPoseONNX,
  runAffectONNX,
  type ONNXModelType,
  type GazeInferenceResult,
  type PoseInferenceResult,
  type AffectInferenceResult,
} from '../lib/services/onnxInferenceService';
import {
  renderSegmentedBackground,
  type VirtualBackdropType,
} from '../lib/services/backgroundSegmentation';

type FilterCategory = 'enhancement' | 'edges' | 'morphology' | 'color' | 'telemetry' | 'onnx' | 'virtualbg';

export default function IVPLab() {
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('enhancement');
  const [selectedFilter, setSelectedFilter] = useState<string>('gaussian');

  // Media Input State
  const [inputSource, setInputSource] = useState<'sample' | 'webcam' | 'upload'>('sample');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [fps, setFps] = useState<number>(0);
  const [processTimeMs, setProcessTimeMs] = useState<number>(0);

  // Filter Parameters State
  const [gaussianKernel, setGaussianKernel] = useState<number>(5);
  const [gaussianSigma, setGaussianSigma] = useState<number>(1.5);
  const [sharpenStrength, setSharpenStrength] = useState<number>(1.0);
  const [contrastMin, setContrastMin] = useState<number>(20);
  const [contrastMax, setContrastMax] = useState<number>(235);

  const [cannyLowThresh, setCannyLowThresh] = useState<number>(50);
  const [cannyHighThresh, setCannyHighThresh] = useState<number>(120);
  const [sobelDirection, setSobelDirection] = useState<'both' | 'horizontal' | 'vertical'>('both');

  const [morphKernelSize, setMorphKernelSize] = useState<number>(3);
  const [colorModel, setColorModel] = useState<'rgb' | 'gray' | 'hsv' | 'red' | 'green' | 'blue'>('rgb');
  const [otsuThreshold, setOtsuThreshold] = useState<number>(128);

  // 3D Telemetry Controls
  const [telemetryYaw, setTelemetryYaw] = useState<number>(8.5);
  const [telemetryPitch, setTelemetryPitch] = useState<number>(-4.2);
  const [telemetryRoll, setTelemetryRoll] = useState<number>(2.1);
  const [telemetryGazeX, setTelemetryGazeX] = useState<number>(0.12);
  const [telemetryGazeY, setTelemetryGazeY] = useState<number>(-0.08);

  // Option 1: In-Browser ONNX Neural Inference State
  const [selectedONNXModel, setSelectedONNXModel] = useState<ONNXModelType>('affect');
  const [onnxInferring, setOnnxInferring] = useState<boolean>(false);
  const [gazeResult, setGazeResult] = useState<GazeInferenceResult | null>(null);
  const [poseResult, setPoseResult] = useState<PoseInferenceResult | null>(null);
  const [affectResult, setAffectResult] = useState<AffectInferenceResult | null>(null);
  const [onnxLatency, setOnnxLatency] = useState<number>(0);
  const [onnxError, setOnnxError] = useState<string | null>(null);

  // Option 4: Virtual Background & Bokeh Blur State
  const [virtualBackdrop, setVirtualBackdrop] = useState<VirtualBackdropType>('blur');
  const [bgBlurRadius, setBgBlurRadius] = useState<number>(12);
  const [skinStrictness, setSkinStrictness] = useState<number>(1.0);

  // DOM & Media Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const histogramCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const sampleImageRef = useRef<HTMLImageElement | null>(null);

  // Initialize sample canvas image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=480';
    img.onload = () => {
      sampleImageRef.current = img;
      renderFrame();
    };
  }, []);

  // Handle Input Source Switch
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 360 },
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
    return () => {
      stopWebcam();
    };
  }, [inputSource]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        sampleImageRef.current = img;
        setInputSource('upload');
        renderFrame();
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // -------------------------------------------------------------
  // ONNX NEURAL INFERENCE FORWARD PASS EXECUTION
  // -------------------------------------------------------------
  const executeONNXInference = async () => {
    const sCanvas = sourceCanvasRef.current;
    if (!sCanvas) return;

    setOnnxInferring(true);
    setOnnxError(null);
    try {
      if (selectedONNXModel === 'affect') {
        const res = await runAffectONNX(sCanvas);
        setAffectResult(res);
        setOnnxLatency(res.inferenceTimeMs);
      } else if (selectedONNXModel === 'gaze') {
        const res = await runGazeONNX(sCanvas);
        setGazeResult(res);
        setOnnxLatency(res.inferenceTimeMs);
        setTelemetryPitch(res.pitchDegrees);
        setTelemetryYaw(res.yawDegrees);
      } else if (selectedONNXModel === 'pose') {
        const res = await runPoseONNX(sCanvas);
        setPoseResult(res);
        setOnnxLatency(res.inferenceTimeMs);
        setTelemetryYaw(res.yawDegrees);
        setTelemetryPitch(res.pitchDegrees);
        setTelemetryRoll(res.rollDegrees);
      }
    } catch (err: any) {
      console.error('ONNX WebAssembly forward pass error:', err);
      setOnnxError(err.message || 'Error executing ONNX forward pass in browser');
    } finally {
      setOnnxInferring(false);
    }
  };

  // -------------------------------------------------------------
  // COMPUTER VISION PROCESSING KERNEL & FILTER ALGORITHMS
  // -------------------------------------------------------------
  const applyCVFilter = useCallback(
    (srcData: ImageData, dstData: ImageData, width: number, height: number) => {
      const src = srcData.data;
      const dst = dstData.data;

      // Copy alpha channel across
      for (let i = 3; i < src.length; i += 4) {
        dst[i] = 255;
      }

      // 1. Grayscale Buffer Helper
      const gray = new Uint8Array(width * height);
      for (let i = 0; i < width * height; i++) {
        const r = src[i * 4];
        const g = src[i * 4 + 1];
        const b = src[i * 4 + 2];
        gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      }

      if (selectedFilter === 'none') {
        for (let i = 0; i < src.length; i++) dst[i] = src[i];
      } else if (selectedFilter === 'grayscale') {
        for (let i = 0; i < width * height; i++) {
          const val = gray[i];
          dst[i * 4] = val;
          dst[i * 4 + 1] = val;
          dst[i * 4 + 2] = val;
        }
      } else if (selectedFilter === 'histeq') {
        // Histogram Equalization
        const hist = new Uint32Array(256);
        for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
        const cdf = new Float32Array(256);
        let cum = 0;
        for (let i = 0; i < 256; i++) {
          cum += hist[i];
          cdf[i] = cum / gray.length;
        }
        for (let i = 0; i < width * height; i++) {
          const eq = Math.round(cdf[gray[i]] * 255);
          dst[i * 4] = eq;
          dst[i * 4 + 1] = eq;
          dst[i * 4 + 2] = eq;
        }
      } else if (selectedFilter === 'contrast') {
        // Contrast Stretching
        const range = Math.max(1, contrastMax - contrastMin);
        for (let i = 0; i < width * height; i++) {
          const val = Math.min(255, Math.max(0, ((gray[i] - contrastMin) / range) * 255));
          dst[i * 4] = val;
          dst[i * 4 + 1] = val;
          dst[i * 4 + 2] = val;
        }
      } else if (selectedFilter === 'gaussian') {
        // Gaussian Spatial Smoothing Filter
        const radius = Math.floor(gaussianKernel / 2);
        for (let y = radius; y < height - radius; y++) {
          for (let x = radius; x < width - radius; x++) {
            let rAcc = 0,
              gAcc = 0,
              bAcc = 0,
              wAcc = 0;
            for (let ky = -radius; ky <= radius; ky++) {
              for (let kx = -radius; kx <= radius; kx++) {
                const distSq = kx * kx + ky * ky;
                const weight = Math.exp(-distSq / (2 * gaussianSigma * gaussianSigma));
                const pIdx = ((y + ky) * width + (x + kx)) * 4;
                rAcc += src[pIdx] * weight;
                gAcc += src[pIdx + 1] * weight;
                bAcc += src[pIdx + 2] * weight;
                wAcc += weight;
              }
            }
            const outIdx = (y * width + x) * 4;
            dst[outIdx] = rAcc / wAcc;
            dst[outIdx + 1] = gAcc / wAcc;
            dst[outIdx + 2] = bAcc / wAcc;
          }
        }
      } else if (selectedFilter === 'sharpen') {
        // High-Pass Sharpening Kernel
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;
            for (let c = 0; c < 3; c++) {
              const center = src[idx + c];
              const up = src[((y - 1) * width + x) * 4 + c];
              const down = src[((y + 1) * width + x) * 4 + c];
              const left = src[(y * width + (x - 1)) * 4 + c];
              const right = src[(y * width + (x + 1)) * 4 + c];
              const laplacian = 5 * center - up - down - left - right;
              dst[idx + c] = Math.min(255, Math.max(0, center + (laplacian - center) * sharpenStrength));
            }
          }
        }
      } else if (selectedFilter === 'sobel') {
        // Sobel Gradient Vector Calculation
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const tl = gray[(y - 1) * width + (x - 1)];
            const tc = gray[(y - 1) * width + x];
            const tr = gray[(y - 1) * width + (x + 1)];
            const ml = gray[y * width + (x - 1)];
            const mr = gray[y * width + (x + 1)];
            const bl = gray[(y + 1) * width + (x - 1)];
            const bc = gray[(y + 1) * width + x];
            const br = gray[(y + 1) * width + (x + 1)];

            const gx = tr + 2 * mr + br - (tl + 2 * ml + bl);
            const gy = bl + 2 * bc + br - (tl + 2 * tc + tr);

            let magnitude = 0;
            if (sobelDirection === 'both') magnitude = Math.sqrt(gx * gx + gy * gy);
            else if (sobelDirection === 'horizontal') magnitude = Math.abs(gx);
            else magnitude = Math.abs(gy);

            const outIdx = (y * width + x) * 4;
            const magVal = Math.min(255, magnitude);
            dst[outIdx] = magVal;
            dst[outIdx + 1] = magVal;
            dst[outIdx + 2] = magVal;
          }
        }
      } else if (selectedFilter === 'canny') {
        // 4-Stage Canny Edge Detection
        const magBuf = new Float32Array(width * height);
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const tl = gray[(y - 1) * width + (x - 1)];
            const tc = gray[(y - 1) * width + x];
            const tr = gray[(y - 1) * width + (x + 1)];
            const ml = gray[y * width + (x - 1)];
            const mr = gray[y * width + (x + 1)];
            const bl = gray[(y + 1) * width + (x - 1)];
            const bc = gray[(y + 1) * width + x];
            const br = gray[(y + 1) * width + (x + 1)];

            const gx = tr + 2 * mr + br - (tl + 2 * ml + bl);
            const gy = bl + 2 * bc + br - (tl + 2 * tc + tr);
            magBuf[y * width + x] = Math.sqrt(gx * gx + gy * gy);
          }
        }

        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const m = magBuf[y * width + x];
            let edge = 0;
            if (m >= cannyHighThresh) edge = 255;
            else if (m >= cannyLowThresh) {
              let hasStrongNeighbor = false;
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  if (magBuf[(y + dy) * width + (x + dx)] >= cannyHighThresh) {
                    hasStrongNeighbor = true;
                    break;
                  }
                }
              }
              edge = hasStrongNeighbor ? 255 : 0;
            }
            const outIdx = (y * width + x) * 4;
            dst[outIdx] = edge;
            dst[outIdx + 1] = edge;
            dst[outIdx + 2] = edge;
          }
        }
      } else if (selectedFilter === 'otsu') {
        // Automatic Otsu Optimal Binarization
        const hist = new Uint32Array(256);
        for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
        const total = width * height;
        let sum = 0;
        for (let t = 0; t < 256; t++) sum += t * hist[t];

        let sumB = 0,
          wB = 0,
          wF = 0,
          varMax = 0,
          optThresh = 128;

        for (let t = 0; t < 256; t++) {
          wB += hist[t];
          if (wB === 0) continue;
          wF = total - wB;
          if (wF === 0) break;

          sumB += t * hist[t];
          const mB = sumB / wB;
          const mF = (sum - sumB) / wF;
          const varBetween = wB * wF * (mB - mF) * (mB - mF);

          if (varBetween > varMax) {
            varMax = varBetween;
            optThresh = t;
          }
        }
        setOtsuThreshold(optThresh);

        for (let i = 0; i < width * height; i++) {
          const bVal = gray[i] >= optThresh ? 255 : 0;
          dst[i * 4] = bVal;
          dst[i * 4 + 1] = bVal;
          dst[i * 4 + 2] = bVal;
        }
      } else if (selectedFilter === 'dilation' || selectedFilter === 'erosion' || selectedFilter === 'opening' || selectedFilter === 'closing') {
        // Morphological Operations on Binarized Mask
        const bin = new Uint8Array(width * height);
        for (let i = 0; i < width * height; i++) bin[i] = gray[i] > 120 ? 1 : 0;

        const dilate = (input: Uint8Array<any>): Uint8Array<any> => {
          const res = new Uint8Array(width * height);
          const r = Math.floor(morphKernelSize / 2);
          for (let y = r; y < height - r; y++) {
            for (let x = r; x < width - r; x++) {
              let maxV = 0;
              for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                  if (input[(y + dy) * width + (x + dx)] === 1) {
                    maxV = 1;
                    break;
                  }
                }
              }
              res[y * width + x] = maxV;
            }
          }
          return res;
        };

        const erode = (input: Uint8Array<any>): Uint8Array<any> => {
          const res = new Uint8Array(width * height);
          const r = Math.floor(morphKernelSize / 2);
          for (let y = r; y < height - r; y++) {
            for (let x = r; x < width - r; x++) {
              let minV = 1;
              for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                  if (input[(y + dy) * width + (x + dx)] === 0) {
                    minV = 0;
                    break;
                  }
                }
              }
              res[y * width + x] = minV;
            }
          }
          return res;
        };

        let processed: Uint8Array<any> = bin;
        if (selectedFilter === 'dilation') processed = dilate(bin);
        else if (selectedFilter === 'erosion') processed = erode(bin);
        else if (selectedFilter === 'opening') processed = dilate(erode(bin));
        else if (selectedFilter === 'closing') processed = erode(dilate(bin));

        for (let i = 0; i < width * height; i++) {
          const mVal = processed[i] * 255;
          dst[i * 4] = mVal;
          dst[i * 4 + 1] = mVal;
          dst[i * 4 + 2] = mVal;
        }
      } else if (selectedFilter === 'color_channel') {
        for (let i = 0; i < width * height; i++) {
          const r = src[i * 4];
          const g = src[i * 4 + 1];
          const b = src[i * 4 + 2];
          if (colorModel === 'red') {
            dst[i * 4] = r;
            dst[i * 4 + 1] = 0;
            dst[i * 4 + 2] = 0;
          } else if (colorModel === 'green') {
            dst[i * 4] = 0;
            dst[i * 4 + 1] = g;
            dst[i * 4 + 2] = 0;
          } else if (colorModel === 'blue') {
            dst[i * 4] = 0;
            dst[i * 4 + 1] = 0;
            dst[i * 4 + 2] = b;
          } else if (colorModel === 'hsv') {
            const maxC = Math.max(r, g, b);
            const minC = Math.min(r, g, b);
            const delta = maxC - minC;
            let hue = 0;
            if (delta > 0) {
              if (maxC === r) hue = ((g - b) / delta) % 6;
              else if (maxC === g) hue = (b - r) / delta + 2;
              else hue = (r - g) / delta + 4;
              hue = Math.round(hue * 60);
              if (hue < 0) hue += 360;
            }
            dst[i * 4] = Math.round((hue / 360) * 255);
            dst[i * 4 + 1] = Math.round((delta / 255) * 255);
            dst[i * 4 + 2] = maxC;
          }
        }
      }
    },
    [
      selectedFilter,
      gaussianKernel,
      gaussianSigma,
      sharpenStrength,
      contrastMin,
      contrastMax,
      cannyLowThresh,
      cannyHighThresh,
      sobelDirection,
      morphKernelSize,
      colorModel,
    ]
  );

  // Render Real-time Histogram
  const renderHistogram = (data: Uint8ClampedArray) => {
    const canvas = histogramCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const hist = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) {
      const g = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      hist[g]++;
    }

    let maxCount = 1;
    for (let i = 0; i < 256; i++) {
      if (hist[i] > maxCount) maxCount = hist[i];
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const barW = canvas.width / 256;
    for (let i = 0; i < 256; i++) {
      const barH = (hist[i] / maxCount) * (canvas.height - 4);
      ctx.fillStyle = `hsl(${190 + (i / 256) * 70}, 85%, ${50 + (i / 256) * 25}%)`;
      ctx.fillRect(i * barW, canvas.height - barH, barW, barH);
    }
  };

  // Draw 3D Head Pose Euler Axes & Gaze Ray Overlay
  const draw3DTelemetryOverlay = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const cx = width / 2;
    const cy = height / 2;
    const axisLen = 65;

    const yawRad = (telemetryYaw * Math.PI) / 180;
    const pitchRad = (telemetryPitch * Math.PI) / 180;
    const rollRad = (telemetryRoll * Math.PI) / 180;

    const xEnd = {
      x: cx + axisLen * Math.cos(yawRad) * Math.cos(rollRad),
      y: cy + axisLen * Math.sin(pitchRad),
    };
    const yEnd = {
      x: cx - axisLen * Math.sin(yawRad),
      y: cy - axisLen * Math.cos(pitchRad) * Math.cos(rollRad),
    };
    const zEnd = {
      x: cx + axisLen * Math.sin(rollRad) * Math.cos(yawRad),
      y: cy + axisLen * Math.cos(rollRad) * Math.sin(pitchRad),
    };

    ctx.save();
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - 70, cy - 85, 140, 170);

    const drawAxis = (end: { x: number; y: number }, color: string, label: string) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(end.x, end.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText(label, end.x + 4, end.y + 4);
    };

    drawAxis(xEnd, '#ef4444', 'X (Pitch)');
    drawAxis(yEnd, '#22c55e', 'Y (Yaw)');
    drawAxis(zEnd, '#06b6d4', 'Z (Roll)');

    const gazeEndX = cx + telemetryGazeX * width * 1.2;
    const gazeEndY = cy + telemetryGazeY * height * 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy - 20, 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx, cy - 20);
    ctx.lineTo(gazeEndX, gazeEndY);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  };

  // Master Render Frame Function
  const renderFrame = useCallback(() => {
    const sCanvas = sourceCanvasRef.current;
    const oCanvas = outputCanvasRef.current;
    if (!sCanvas || !oCanvas) return;

    const sCtx = sCanvas.getContext('2d', { willReadFrequently: true });
    const oCtx = oCanvas.getContext('2d');
    if (!sCtx || !oCtx) return;

    const w = sCanvas.width;
    const h = sCanvas.height;

    // 1. Draw current source onto source canvas
    if (inputSource === 'webcam' && videoRef.current && videoRef.current.readyState >= 2) {
      sCtx.drawImage(videoRef.current, 0, 0, w, h);
    } else if (sampleImageRef.current) {
      sCtx.drawImage(sampleImageRef.current, 0, 0, w, h);
    }

    const t0 = performance.now();

    if (activeCategory === 'virtualbg') {
      // Execute Virtual Background / Bokeh Segmentation
      renderSegmentedBackground(sCtx, oCtx, w, h, {
        backdropType: virtualBackdrop,
        blurRadius: bgBlurRadius,
        skinThresholdStrictness: skinStrictness,
      });
    } else {
      // Standard CV Filter Execution
      const srcImageData = sCtx.getImageData(0, 0, w, h);
      const dstImageData = oCtx.createImageData(w, h);

      applyCVFilter(srcImageData, dstImageData, w, h);
      oCtx.putImageData(dstImageData, 0, 0);

      if (activeCategory === 'telemetry') {
        draw3DTelemetryOverlay(oCtx, w, h);
      }
    }

    const t1 = performance.now();
    setProcessTimeMs(Math.round((t1 - t0) * 10) / 10);

    // Update Real-time Histogram
    const outData = oCtx.getImageData(0, 0, w, h);
    renderHistogram(outData.data);

    // Compute real-time FPS
    const now = performance.now();
    const delta = now - lastTimeRef.current;
    lastTimeRef.current = now;
    if (delta > 0) {
      setFps(Math.round(1000 / delta));
    }
  }, [
    inputSource,
    activeCategory,
    applyCVFilter,
    virtualBackdrop,
    bgBlurRadius,
    skinStrictness,
    telemetryYaw,
    telemetryPitch,
    telemetryRoll,
    telemetryGazeX,
    telemetryGazeY,
  ]);

  // Animation Loop for live video / continuous rendering
  useEffect(() => {
    const loop = () => {
      if (isPlaying) {
        renderFrame();
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, renderFrame]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-900 border border-indigo-500/20 p-6 rounded-2xl shadow-2xl backdrop-blur-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/20 border border-indigo-500/40 rounded-xl text-indigo-400">
              <FaFlask className="text-2xl" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
                IVP Diagnostic Lab & Neural Workbench
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                In-Browser ONNX Neural Inference & Real-Time Computer Vision Filters (Course Policy 702EX0E004)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="success" className="px-3 py-1 text-xs">
            <FaBolt className="mr-1 inline" /> Pipeline: {fps} FPS ({processTimeMs} ms)
          </Badge>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1.5"
          >
            {isPlaying ? <FaPause className="text-amber-400" /> : <FaPlay className="text-emerald-400" />}
            {isPlaying ? 'Pause Stream' : 'Resume'}
          </Button>
        </div>
      </div>

      {/* Main Grid: Control Panel + Live Dual Viewports */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Filter Categories & Parameter Controls (4 Cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Input Source Selector */}
          <Card className="p-4 bg-slate-900/80 border-slate-800">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <FaVideo className="text-indigo-400" /> Input Source Selection
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setInputSource('sample')}
                className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                  inputSource === 'sample'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm'
                    : 'bg-slate-800/60 border-slate-750 text-slate-400 hover:text-white'
                }`}
              >
                Sample Face
              </button>
              <button
                onClick={() => setInputSource('webcam')}
                className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                  inputSource === 'webcam'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-sm'
                    : 'bg-slate-800/60 border-slate-750 text-slate-400 hover:text-white'
                }`}
              >
                Live Webcam
              </button>
              <label
                className={`py-2 px-3 rounded-lg text-xs font-medium border text-center cursor-pointer transition-all ${
                  inputSource === 'upload'
                    ? 'bg-purple-600/20 border-purple-500 text-purple-300 shadow-sm'
                    : 'bg-slate-800/60 border-slate-750 text-slate-400 hover:text-white'
                }`}
              >
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                Upload File
              </label>
            </div>
            <video ref={videoRef} className="hidden" playsInline muted autoPlay />
          </Card>

          {/* Module Category Tabs */}
          <Card className="p-4 bg-slate-900/80 border-slate-800">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <FaBook className="text-indigo-400" /> Syllabus & Neural Modules
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'onnx', label: '🧠 ONNX Neural Engine', icon: FaBrain },
                { id: 'virtualbg', label: '🎭 Virtual Background', icon: FaMagic },
                { id: 'enhancement', label: 'Unit 2: Spatial Filters', icon: FaSlidersH },
                { id: 'edges', label: 'Unit 5: Edge Detection', icon: FaLayerGroup },
                { id: 'morphology', label: 'Unit 4: Morphology', icon: FaCube },
                { id: 'color', label: 'Unit 7: Color & Otsu', icon: FaEye },
                { id: 'telemetry', label: 'Part B: 3D Telemetry', icon: FaBolt },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id as FilterCategory);
                    if (cat.id === 'enhancement') setSelectedFilter('gaussian');
                    else if (cat.id === 'edges') setSelectedFilter('canny');
                    else if (cat.id === 'morphology') setSelectedFilter('dilation');
                    else if (cat.id === 'color') setSelectedFilter('otsu');
                    else if (cat.id === 'telemetry') setSelectedFilter('none');
                    else if (cat.id === 'onnx') setSelectedFilter('none');
                    else if (cat.id === 'virtualbg') setSelectedFilter('none');
                  }}
                  className={`p-2.5 rounded-lg text-xs font-medium text-left border flex items-center gap-2 transition-all ${
                    activeCategory === cat.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                      : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <cat.icon className="text-sm shrink-0" />
                  <span className="truncate">{cat.label}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Dynamic Filter Parameter Controls */}
          <Card className="p-5 bg-slate-900/80 border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-semibold text-slate-200">
                {activeCategory === 'onnx'
                  ? 'ONNX Model Inference'
                  : activeCategory === 'virtualbg'
                  ? 'Background Segmentation'
                  : 'Filter Controls & Tuners'}
              </h3>
              <Badge variant="primary" className="text-[10px]">
                {activeCategory.toUpperCase()}
              </Badge>
            </div>

            {/* TAB 1: ONNX NEURAL INFERENCE */}
            {activeCategory === 'onnx' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {(['affect', 'gaze', 'pose'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setSelectedONNXModel(m)}
                      className={`p-2 rounded text-xs border uppercase ${
                        selectedONNXModel === m
                          ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                          : 'bg-slate-800/50 border-slate-750 text-slate-400'
                      }`}
                    >
                      {m} Model
                    </button>
                  ))}
                </div>

                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Target Model:</span>
                    <span className="font-mono text-indigo-400">/models/{selectedONNXModel}_engine.onnx</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Inference Device:</span>
                    <span className="text-emerald-400 font-semibold">WebAssembly / WebGL</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Input Tensor:</span>
                    <span className="font-mono text-slate-300">[1, 3, 224, 224] Float32</span>
                  </div>
                </div>

                <Button
                  onClick={executeONNXInference}
                  disabled={onnxInferring}
                  variant="primary"
                  className="w-full justify-center text-xs py-2.5"
                >
                  {onnxInferring ? <FaSyncAlt className="animate-spin mr-2" /> : <FaMicrochip className="mr-2" />}
                  {onnxInferring ? 'Running ONNX Inference...' : 'Run Neural Forward Pass'}
                </Button>

                {onnxError && (
                  <div className="p-2.5 bg-rose-950/40 border border-rose-500/30 rounded-lg text-rose-300 text-xs">
                    {onnxError}
                  </div>
                )}

                {/* ONNX Inference Results Card */}
                {selectedONNXModel === 'affect' && affectResult && (
                  <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700 text-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Dominant Emotion:</span>
                      <Badge variant="accent">{affectResult.dominantEmotion}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Composure Score:</span>
                      <span className="text-emerald-400 font-bold">{affectResult.composureScore}/100</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Valence / Arousal:</span>
                      <span className="font-mono text-slate-200">V={affectResult.valence}, A={affectResult.arousal}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-700">
                      Inference Latency: <strong className="text-indigo-400">{onnxLatency} ms</strong>
                    </div>
                  </div>
                )}

                {selectedONNXModel === 'gaze' && gazeResult && (
                  <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700 text-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Focus Zone:</span>
                      <Badge variant={gazeResult.isEyeContact ? 'success' : 'warning'}>
                        {gazeResult.screenFocusZone}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Gaze Angles:</span>
                      <span className="font-mono text-slate-200">
                        Pitch: {gazeResult.pitchDegrees}°, Yaw: {gazeResult.yawDegrees}°
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-700">
                      Inference Latency: <strong className="text-indigo-400">{onnxLatency} ms</strong>
                    </div>
                  </div>
                )}

                {selectedONNXModel === 'pose' && poseResult && (
                  <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700 text-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Detected Gesture:</span>
                      <Badge variant="primary">{poseResult.detectedGesture}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Posture Score:</span>
                      <span className="text-emerald-400 font-bold">{poseResult.postureComposureScore}/100</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Euler Angles:</span>
                      <span className="font-mono text-slate-200">
                        Y: {poseResult.yawDegrees}°, P: {poseResult.pitchDegrees}°, R: {poseResult.rollDegrees}°
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-700">
                      Inference Latency: <strong className="text-indigo-400">{onnxLatency} ms</strong>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: VIRTUAL BACKGROUND & BOKEH BLUR */}
            {activeCategory === 'virtualbg' && (
              <div className="space-y-4">
                <div className="text-xs text-slate-400">Select Backdrop Replacement:</div>
                <div className="grid grid-cols-3 gap-2">
                  {(['blur', 'office', 'studio', 'gradient', 'mask', 'none'] as const).map((bg) => (
                    <button
                      key={bg}
                      onClick={() => setVirtualBackdrop(bg)}
                      className={`p-2 rounded text-xs border capitalize ${
                        virtualBackdrop === bg
                          ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                          : 'bg-slate-800/50 border-slate-750 text-slate-400'
                      }`}
                    >
                      {bg}
                    </button>
                  ))}
                </div>

                {virtualBackdrop === 'blur' && (
                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Bokeh Blur Strength: {bgBlurRadius} px</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="30"
                      value={bgBlurRadius}
                      onChange={(e) => setBgBlurRadius(Number(e.target.value))}
                      className="w-full accent-purple-500"
                    />
                  </div>
                )}

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Segmentation Strictness: {skinStrictness}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.7"
                    max="1.3"
                    step="0.05"
                    value={skinStrictness}
                    onChange={(e) => setSkinStrictness(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* TAB 3: SPATIAL ENHANCEMENT */}
            {activeCategory === 'enhancement' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'gaussian', label: 'Gaussian' },
                    { id: 'sharpen', label: 'Sharpen' },
                    { id: 'histeq', label: 'Hist Eq' },
                    { id: 'contrast', label: 'Contrast' },
                    { id: 'grayscale', label: 'Grayscale' },
                    { id: 'none', label: 'Original' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setSelectedFilter(f.id)}
                      className={`p-2 rounded text-xs border ${
                        selectedFilter === f.id
                          ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                          : 'bg-slate-800/50 border-slate-750 text-slate-400'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {selectedFilter === 'gaussian' && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Kernel Dimension: {gaussianKernel}x{gaussianKernel}</span>
                      </div>
                      <input
                        type="range"
                        min="3"
                        max="9"
                        step="2"
                        value={gaussianKernel}
                        onChange={(e) => setGaussianKernel(Number(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Gaussian Sigma (σ): {gaussianSigma}</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="4.0"
                        step="0.1"
                        value={gaussianSigma}
                        onChange={(e) => setGaussianSigma(Number(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                    </div>
                  </div>
                )}

                {selectedFilter === 'sharpen' && (
                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Sharpening Multiplier: {sharpenStrength}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="3.0"
                      step="0.1"
                      value={sharpenStrength}
                      onChange={(e) => setSharpenStrength(Number(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                  </div>
                )}

                {selectedFilter === 'contrast' && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Low (r1): {contrastMin}</span>
                      <span>High (r2): {contrastMax}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={contrastMin}
                      onChange={(e) => setContrastMin(Number(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                    <input
                      type="range"
                      min="150"
                      max="255"
                      value={contrastMax}
                      onChange={(e) => setContrastMax(Number(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: EDGE DETECTION */}
            {activeCategory === 'edges' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelectedFilter('canny')}
                    className={`p-2 rounded text-xs border ${
                      selectedFilter === 'canny'
                        ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                        : 'bg-slate-800/50 border-slate-750 text-slate-400'
                    }`}
                  >
                    Canny Edge Detector
                  </button>
                  <button
                    onClick={() => setSelectedFilter('sobel')}
                    className={`p-2 rounded text-xs border ${
                      selectedFilter === 'sobel'
                        ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                        : 'bg-slate-800/50 border-slate-750 text-slate-400'
                    }`}
                  >
                    Sobel Gradient
                  </button>
                </div>

                {selectedFilter === 'canny' && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Low Hysteresis Threshold: {cannyLowThresh}</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        value={cannyLowThresh}
                        onChange={(e) => setCannyLowThresh(Number(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>High Hysteresis Threshold: {cannyHighThresh}</span>
                      </div>
                      <input
                        type="range"
                        min="80"
                        max="220"
                        value={cannyHighThresh}
                        onChange={(e) => setCannyHighThresh(Number(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                    </div>
                  </div>
                )}

                {selectedFilter === 'sobel' && (
                  <div>
                    <div className="text-xs text-slate-400 mb-2">Gradient Orientation:</div>
                    <div className="grid grid-cols-3 gap-2">
                      {(['both', 'horizontal', 'vertical'] as const).map((dir) => (
                        <button
                          key={dir}
                          onClick={() => setSobelDirection(dir)}
                          className={`p-1.5 rounded text-xs border capitalize ${
                            sobelDirection === dir
                              ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                              : 'bg-slate-800/50 border-slate-750 text-slate-400'
                          }`}
                        >
                          {dir}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: MORPHOLOGY */}
            {activeCategory === 'morphology' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {['dilation', 'erosion', 'opening', 'closing'].map((m) => (
                    <button
                      key={m}
                      onClick={() => setSelectedFilter(m)}
                      className={`p-2 rounded text-xs border capitalize ${
                        selectedFilter === m
                          ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                          : 'bg-slate-800/50 border-slate-750 text-slate-400'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Structuring Element: {morphKernelSize}x{morphKernelSize}</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="7"
                    step="2"
                    value={morphKernelSize}
                    onChange={(e) => setMorphKernelSize(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* TAB 6: COLOR & OTSU */}
            {activeCategory === 'color' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelectedFilter('otsu')}
                    className={`p-2 rounded text-xs border ${
                      selectedFilter === 'otsu'
                        ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                        : 'bg-slate-800/50 border-slate-750 text-slate-400'
                    }`}
                  >
                    Otsu Thresholding
                  </button>
                  <button
                    onClick={() => setSelectedFilter('color_channel')}
                    className={`p-2 rounded text-xs border ${
                      selectedFilter === 'color_channel'
                        ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                        : 'bg-slate-800/50 border-slate-750 text-slate-400'
                    }`}
                  >
                    Color Channel Slicing
                  </button>
                </div>

                {selectedFilter === 'otsu' && (
                  <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-750 text-xs space-y-1">
                    <div className="text-slate-300 font-semibold">Otsu Maximized Variance:</div>
                    <div className="text-emerald-400 text-sm font-bold">Optimal Threshold: {otsuThreshold}</div>
                  </div>
                )}

                {selectedFilter === 'color_channel' && (
                  <div className="grid grid-cols-2 gap-2">
                    {(['red', 'green', 'blue', 'hsv'] as const).map((cm) => (
                      <button
                        key={cm}
                        onClick={() => setColorModel(cm)}
                        className={`p-2 rounded text-xs border uppercase ${
                          colorModel === cm
                            ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                            : 'bg-slate-800/50 border-slate-750 text-slate-400'
                        }`}
                      >
                        {cm} Channel
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 7: 3D TELEMETRY */}
            {activeCategory === 'telemetry' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  Euler rotation vectors and L2CS-Net gaze projection ray overlay:
                </p>
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Yaw (θy): {telemetryYaw}°</span>
                  </div>
                  <input
                    type="range"
                    min="-45"
                    max="45"
                    value={telemetryYaw}
                    onChange={(e) => setTelemetryYaw(Number(e.target.value))}
                    className="w-full accent-green-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Pitch (θp): {telemetryPitch}°</span>
                  </div>
                  <input
                    type="range"
                    min="-30"
                    max="30"
                    value={telemetryPitch}
                    onChange={(e) => setTelemetryPitch(Number(e.target.value))}
                    className="w-full accent-red-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Roll (θr): {telemetryRoll}°</span>
                  </div>
                  <input
                    type="range"
                    min="-25"
                    max="25"
                    value={telemetryRoll}
                    onChange={(e) => setTelemetryRoll(Number(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right Side: Dual Canvas Viewports & Histogram HUD (8 Cols) */}
        <div className="lg:col-span-8 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Input Viewport */}
            <Card className="p-3 bg-slate-900 border-slate-800 space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-slate-400">RAW INPUT VIEWPORT</span>
                <Badge variant="secondary" className="text-[10px]">
                  480x360
                </Badge>
              </div>
              <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden border border-slate-800">
                <canvas ref={sourceCanvasRef} width={480} height={360} className="w-full h-full object-contain" />
              </div>
            </Card>

            {/* Filtered Output Viewport */}
            <Card className="p-3 bg-slate-900 border-slate-800 space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-indigo-400">
                  {activeCategory === 'virtualbg'
                    ? `VIRTUAL BACKDROP (${virtualBackdrop.toUpperCase()})`
                    : 'IVP TRANSFORMED OUTPUT'}
                </span>
                <Badge variant="primary" className="text-[10px]">
                  {activeCategory === 'virtualbg' ? virtualBackdrop.toUpperCase() : selectedFilter.toUpperCase()}
                </Badge>
              </div>
              <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden border border-indigo-500/30 shadow-lg shadow-indigo-950/20">
                <canvas ref={outputCanvasRef} width={480} height={360} className="w-full h-full object-contain" />
              </div>
            </Card>
          </div>

          {/* Grayscale Histogram HUD */}
          <Card className="p-4 bg-slate-900/90 border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <FaLayerGroup className="text-cyan-400" />
                <span>Pixel Intensity Distribution (256-Bin Grayscale Histogram)</span>
              </div>
              <span className="text-[11px] text-slate-500">Live Frame CDF</span>
            </div>
            <div className="h-20 bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
              <canvas ref={histogramCanvasRef} width={512} height={80} className="w-full h-full" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
