/**
 * Pure helpers for deciding whether the candidate's camera AND microphone are on.
 * The interview is blocked until both are live (see SessionDeviceGate).
 */

export type MissingDevice = 'camera' | 'microphone';

export interface MediaReadiness {
  hasStream: boolean;
  cameraLive: boolean;
  microphoneLive: boolean;
  /** True only when both a live camera track and a live microphone track exist. */
  ready: boolean;
  missing: MissingDevice[];
}

interface TrackLike {
  readyState?: string;
  enabled?: boolean;
  muted?: boolean;
}

interface StreamLike {
  getVideoTracks?: () => TrackLike[];
  getAudioTracks?: () => TrackLike[];
}

/** A track counts as "on" when it is live, enabled and not muted by the OS/browser. */
function isTrackOn(track: TrackLike): boolean {
  return track.readyState === 'live' && track.enabled !== false && track.muted !== true;
}

export function getMediaReadiness(stream: StreamLike | null | undefined): MediaReadiness {
  if (!stream) {
    return {
      hasStream: false,
      cameraLive: false,
      microphoneLive: false,
      ready: false,
      missing: ['camera', 'microphone'],
    };
  }

  const cameraLive = (stream.getVideoTracks?.() ?? []).some(isTrackOn);
  const microphoneLive = (stream.getAudioTracks?.() ?? []).some(isTrackOn);

  const missing: MissingDevice[] = [];
  if (!cameraLive) missing.push('camera');
  if (!microphoneLive) missing.push('microphone');

  return {
    hasStream: true,
    cameraLive,
    microphoneLive,
    ready: cameraLive && microphoneLive,
    missing,
  };
}

export interface DeviceErrorDescription {
  title: string;
  detail: string;
}

/** Maps getUserMedia failures to actionable instructions. */
export function describeMediaError(errorName: string | null | undefined): DeviceErrorDescription | null {
  if (!errorName) return null;

  switch (errorName) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return {
        title: 'Access to your camera or microphone is blocked',
        detail:
          "Click the camera/lock icon in your browser's address bar, set Camera and Microphone to Allow for this site, then press the button below.",
      };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return {
        title: 'No camera or microphone was found',
        detail: 'Connect a webcam and a microphone (or enable them in your system settings), then try again.',
      };
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return {
        title: 'Your camera or microphone is being used by another app',
        detail: 'Close other apps or tabs that are using them (video calls, recorders), then try again.',
      };
    default:
      return {
        title: "We couldn't start your camera and microphone",
        detail: 'Check that both devices are connected and allowed for this site, then try again.',
      };
  }
}
