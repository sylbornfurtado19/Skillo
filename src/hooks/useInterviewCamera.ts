'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { IVPCameraManager, ivpCameraManager } from '@/lib/services/ivpCameraManager';

export interface UseInterviewCameraOptions {
  autoStart?: boolean;
  enableAudio?: boolean;
  idealWidth?: number;
  idealHeight?: number;
  manager?: IVPCameraManager;
}

export interface UseInterviewCameraReturn {
  stream: MediaStream | null;
  isCameraActive: boolean;
  cameraError: string | null;
  startCamera: () => Promise<MediaStream>;
  stopCamera: () => void;
}

/**
 * useInterviewCamera
 * React hook that binds to the authoritative IVPCameraManager.
 * Centralizes camera acquisition in InterviewSession to eliminate multiple getUserMedia() calls.
 */
export function useInterviewCamera(options: UseInterviewCameraOptions = {}): UseInterviewCameraReturn {
  const {
    autoStart = false,
    enableAudio = true,
    idealWidth = 320,
    idealHeight = 240,
    manager = ivpCameraManager,
  } = options;

  const [stream, setStream] = useState<MediaStream | null>(() => manager.getStream());
  const [isCameraActive, setIsCameraActive] = useState<boolean>(() => manager.isActive());
  const [cameraError, setCameraError] = useState<string | null>(null);

  const managerRef = useRef(manager);
  managerRef.current = manager;

  const startCamera = useCallback(async (): Promise<MediaStream> => {
    try {
      setCameraError(null);
      const activeStream = await managerRef.current.acquireCamera({
        idealWidth,
        idealHeight,
        enableAudio,
      });
      setStream(activeStream);
      setIsCameraActive(true);
      return activeStream;
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Camera access denied. Grant permission in browser settings.'
          : err instanceof Error && err.name === 'NotFoundError'
          ? 'No camera found. Please connect a webcam.'
          : err instanceof Error && err.name === 'NotReadableError'
          ? 'Camera is in use by another application or process.'
          : err instanceof Error && err.name === 'OverconstrainedError'
          ? 'Requested camera constraints cannot be satisfied.'
          : 'Camera unavailable. Vision tracking disabled.';
      setCameraError(msg);
      setIsCameraActive(false);
      throw err;
    }
  }, [idealWidth, idealHeight, enableAudio]);

  const stopCamera = useCallback(() => {
    managerRef.current.stopCamera();
    setStream(null);
    setIsCameraActive(false);
  }, []);

  useEffect(() => {
    if (autoStart) {
      startCamera().catch(() => {});
    }
  }, [autoStart, startCamera]);

  return {
    stream,
    isCameraActive,
    cameraError,
    startCamera,
    stopCamera,
  };
}
