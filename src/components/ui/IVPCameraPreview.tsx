'use client';

/**
 * IVPCameraPreview
 *
 * Modern live interview camera display HUD.
 * Replaces the legacy heuristic IVPGazeTracker and IVPPoseTracker visual components.
 * Renders the authoritative video feed with overlays powered directly by
 * MediaPipe FaceLandmarker and ONNX (L2CS-Net & HopeNet).
 */

import React, { useEffect, useRef, useCallback } from 'react';
import type { GazeFrameResult, HeadPoseFrameResult } from '@/types/index';

const RAY_LENGTH = 75;
const ZONE_COLORS: Record<GazeFrameResult['screenFocusZone'], { ray: string; glow: string }> = {
  CENTER_SCREEN: { ray: '#10b981', glow: 'rgba(16,185,129,0.35)' },
  LOOKING_UP:    { ray: '#f59e0b', glow: 'rgba(245,158,11,0.3)' },
  LOOKING_DOWN:  { ray: '#f59e0b', glow: 'rgba(245,158,11,0.3)' },
  LOOKING_LEFT:  { ray: '#f59e0b', glow: 'rgba(245,158,11,0.3)' },
  LOOKING_RIGHT: { ray: '#f59e0b', glow: 'rgba(245,158,11,0.3)' },
  OFF_SCREEN:    { ray: '#ef4444', glow: 'rgba(239,68,68,0.35)' },
};

function project3D(
  x: number,
  y: number,
  z: number,
  yawRad: number,
  pitchRad: number,
  rollRad: number
): [number, number] {
  const x1 = x * Math.cos(yawRad) + z * Math.sin(yawRad);
  const y1 = y;
  const z1 = -x * Math.sin(yawRad) + z * Math.cos(yawRad);

  const x2 = x1;
  const y2 = y1 * Math.cos(pitchRad) - z1 * Math.sin(pitchRad);
  const z2 = y1 * Math.sin(pitchRad) + z1 * Math.cos(pitchRad);

  const x3 = x2 * Math.cos(rollRad) - y2 * Math.sin(rollRad);
  const y3 = x2 * Math.sin(rollRad) + y2 * Math.cos(rollRad);

  return [x3, y3];
}

const CUBE_VERTICES: Array<[number, number, number]> = [
  [-30, -38, -30], [30, -38, -30], [30, 38, -30], [-30, 38, -30],
  [-30, -38, 30],  [30, -38, 30],  [30, 38, 30],  [-30, 38, 30],
];

const CUBE_EDGES: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

export interface IVPCameraPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  mediaStream?: MediaStream | null;
  gazeResult?: GazeFrameResult | null;
  poseResult?: HeadPoseFrameResult | null;
  isVisionReady?: boolean;
  isONNXReady?: boolean;
  visible?: boolean;
  className?: string;
}

export default function IVPCameraPreview({
  videoRef,
  mediaStream = null,
  gazeResult = null,
  poseResult = null,
  isVisionReady = false,
  isONNXReady = false,
  visible = true,
  className = '',
}: IVPCameraPreviewProps) {
  const gazeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const poseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Synchronize gaze ray overlay
  const renderGazeOverlay = useCallback(() => {
    const canvas = gazeCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.readyState < 2) return;

    const w = video.videoWidth || 320;
    const h = video.videoHeight || 240;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    if (gazeResult) {
      const { gazeAngles, screenFocusZone } = gazeResult;
      const eyeCx = w / 2;
      const eyeCy = h * 0.42;

      const colors = ZONE_COLORS[screenFocusZone] || ZONE_COLORS.CENTER_SCREEN;
      const yawRad = (gazeAngles.yawDegrees * Math.PI) / 180;
      const pitchRad = (gazeAngles.pitchDegrees * Math.PI) / 180;

      const rayDx = Math.sin(yawRad) * Math.cos(pitchRad) * RAY_LENGTH;
      const rayDy = -Math.sin(pitchRad) * RAY_LENGTH;

      const endX = eyeCx + rayDx;
      const endY = eyeCy + rayDy;

      ctx.save();
      ctx.shadowColor = colors.glow;
      ctx.shadowBlur = 12;

      // Draw Ray
      ctx.beginPath();
      ctx.moveTo(eyeCx, eyeCy);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = colors.ray;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Draw Arrow Head
      const angle = Math.atan2(rayDy, rayDx);
      const arrowSize = 8;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - arrowSize * Math.cos(angle - Math.PI / 6), endY - arrowSize * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(endX - arrowSize * Math.cos(angle + Math.PI / 6), endY - arrowSize * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fillStyle = colors.ray;
      ctx.fill();

      // Eye origin dot
      ctx.beginPath();
      ctx.arc(eyeCx, eyeCy, 4, 0, Math.PI * 2);
      ctx.fillStyle = colors.ray;
      ctx.fill();

      // Focus Zone Label
      ctx.fillStyle = colors.ray;
      ctx.font = 'bold 10px monospace';
      ctx.fillText(screenFocusZone.replace(/_/g, ' '), 8, h - 8);
      ctx.restore();
    }
  }, [gazeResult, videoRef]);

  // Synchronize 3D head pose overlay
  const renderPoseOverlay = useCallback(() => {
    const canvas = poseCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.readyState < 2) return;

    const w = video.videoWidth || 320;
    const h = video.videoHeight || 240;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    // Draw mirrored video frame onto pose canvas so camera view matches selfie video feed
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();

    if (poseResult) {
      const { angles } = poseResult;
      const headCx = w / 2;
      const headCy = h * 0.45;

      const yawRad = (angles.yawDegrees * Math.PI) / 180;
      const pitchRad = (angles.pitchDegrees * Math.PI) / 180;
      const rollRad = (angles.rollDegrees * Math.PI) / 180;

      ctx.save();

      // Draw 3D Wireframe Cube
      const projected = CUBE_VERTICES.map(([x, y, z]) => {
        const [px, py] = project3D(x, y, z, yawRad, pitchRad, rollRad);
        return [headCx + px, headCy + py] as [number, number];
      });

      ctx.strokeStyle = 'rgba(99, 102, 241, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const [i, j] of CUBE_EDGES) {
        ctx.moveTo(projected[i][0], projected[i][1]);
        ctx.lineTo(projected[j][0], projected[j][1]);
      }
      ctx.stroke();

      // Draw 3D Orientation Axes
      const axisLen = 45;
      const [pxX, pyX] = project3D(axisLen, 0, 0, yawRad, pitchRad, rollRad);
      ctx.beginPath();
      ctx.moveTo(headCx, headCy);
      ctx.lineTo(headCx + pxX, headCy + pyX);
      ctx.strokeStyle = '#ef4444'; // Red: Pitch/X
      ctx.lineWidth = 2.5;
      ctx.stroke();

      const [pxY, pyY] = project3D(0, axisLen, 0, yawRad, pitchRad, rollRad);
      ctx.beginPath();
      ctx.moveTo(headCx, headCy);
      ctx.lineTo(headCx + pxY, headCy + pyY);
      ctx.strokeStyle = '#10b981'; // Green: Yaw/Y
      ctx.lineWidth = 2.5;
      ctx.stroke();

      const [pxZ, pyZ] = project3D(0, 0, axisLen, yawRad, pitchRad, rollRad);
      ctx.beginPath();
      ctx.moveTo(headCx, headCy);
      ctx.lineTo(headCx + pxZ, headCy + pyZ);
      ctx.strokeStyle = '#3b82f6'; // Blue: Roll/Z
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Pose Label
      ctx.fillStyle = '#818cf8';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`Y:${angles.yawDegrees.toFixed(0)}° P:${angles.pitchDegrees.toFixed(0)}° R:${angles.rollDegrees.toFixed(0)}°`, 8, h - 8);

      ctx.restore();
    }
  }, [poseResult, videoRef]);

  // Combined animation render loop
  useEffect(() => {
    const loop = () => {
      renderGazeOverlay();
      renderPoseOverlay();
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [renderGazeOverlay, renderPoseOverlay]);

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${className} ${!visible ? 'hidden' : ''}`}
      aria-label="Live Camera Feed & Neural IVP Diagnostics"
    >
      {/* ── Viewport 1: L2CS-Net Gaze Ray ───────────────────────────────────── */}
      <div className="relative rounded-xl overflow-hidden bg-[#060b14] border border-white/8 max-h-[160px]">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-[#0a0f1d]/80">
          <span className="text-[9px] text-gray-400 font-mono uppercase tracking-widest">
            L2CS-Net &bull; Gaze Ray
          </span>
          <div className="flex items-center gap-1.5">
            <div
              className={`h-1.5 w-1.5 rounded-full ${
                isONNXReady ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600'
              }`}
            />
            <span className="text-[8px] text-gray-400 font-mono">
              {isONNXReady ? '10 FPS' : 'IDLE'}
            </span>
          </div>
        </div>

        <div className="relative w-full" style={{ aspectRatio: '4/3' }}>
          {/* Authoritative Single HTMLVideoElement */}
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          {/* Gaze Ray Overlay Canvas */}
          <canvas
            ref={gazeCanvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />

          {!mediaStream && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#030712]/85 text-center px-4 gap-1">
              <span className="text-gray-500 text-lg">📷</span>
              <p className="text-[10px] text-gray-400 font-mono">Camera inactive</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Viewport 2: HopeNet 3D Head Pose ─────────────────────────────────── */}
      <div className="relative rounded-xl overflow-hidden bg-[#060b14] border border-white/8 max-h-[160px]">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-[#0a0f1d]/80">
          <span className="text-[9px] text-gray-400 font-mono uppercase tracking-widest">
            HopeNet &bull; 3D Head Pose
          </span>
          <div className="flex items-center gap-1.5">
            <div
              className={`h-1.5 w-1.5 rounded-full ${
                isONNXReady ? 'bg-indigo-500 animate-pulse' : 'bg-gray-600'
              }`}
            />
            <span className="text-[8px] text-gray-400 font-mono">
              {isONNXReady ? '10 FPS' : 'IDLE'}
            </span>
          </div>
        </div>

        <div className="relative w-full" style={{ aspectRatio: '4/3' }}>
          {/* Canvas with 3D Wireframe & Axes */}
          <canvas
            ref={poseCanvasRef}
            className="w-full h-full object-cover"
          />

          {!mediaStream && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#030712]/85 text-center px-4 gap-1">
              <span className="text-gray-500 text-lg">👤</span>
              <p className="text-[10px] text-gray-400 font-mono">Camera inactive</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
