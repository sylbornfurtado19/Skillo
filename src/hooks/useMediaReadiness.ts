'use client';

import { useEffect, useRef, useState } from 'react';
import { getMediaReadiness, type MediaReadiness } from '@/lib/media/mediaReadiness';

export interface UseMediaReadinessResult {
  readiness: MediaReadiness;
  /**
   * True while camera and microphone are on. A brief dropout (device re-negotiation, mute
   * flicker) is tolerated for `graceMs` before this turns false.
   */
  devicesReady: boolean;
}

/**
 * Tracks whether the stream currently has a live camera AND microphone track, reacting to
 * tracks ending, being muted, or being unplugged mid-interview.
 */
export function useMediaReadiness(
  stream: MediaStream | null | undefined,
  graceMs: number = 1500
): UseMediaReadinessResult {
  const [readiness, setReadiness] = useState<MediaReadiness>(() => getMediaReadiness(stream));
  const [devicesReady, setDevicesReady] = useState<boolean>(() => getMediaReadiness(stream).ready);
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearGrace = () => {
      if (graceTimerRef.current) {
        clearTimeout(graceTimerRef.current);
        graceTimerRef.current = null;
      }
    };

    const evaluate = () => {
      const next = getMediaReadiness(stream);
      setReadiness((prev) =>
        prev.ready === next.ready &&
        prev.cameraLive === next.cameraLive &&
        prev.microphoneLive === next.microphoneLive &&
        prev.hasStream === next.hasStream
          ? prev
          : next
      );

      if (next.ready) {
        clearGrace();
        setDevicesReady(true);
      } else if (!graceTimerRef.current) {
        graceTimerRef.current = setTimeout(() => {
          graceTimerRef.current = null;
          setDevicesReady(false);
        }, graceMs);
      }
    };

    evaluate();

    const tracks = stream?.getTracks?.() ?? [];
    tracks.forEach((track) => {
      track.addEventListener('ended', evaluate);
      track.addEventListener('mute', evaluate);
      track.addEventListener('unmute', evaluate);
    });
    // Some browsers do not fire events for OS-level device removal: poll as a safety net.
    const poll = setInterval(evaluate, 1000);

    return () => {
      clearInterval(poll);
      clearGrace();
      tracks.forEach((track) => {
        track.removeEventListener('ended', evaluate);
        track.removeEventListener('mute', evaluate);
        track.removeEventListener('unmute', evaluate);
      });
    };
  }, [stream, graceMs]);

  return { readiness, devicesReady };
}
