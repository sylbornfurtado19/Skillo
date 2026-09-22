/**
 * IVPCameraManager
 * Authoritative, centralized webcam and microphone acquisition service for Skillo IVP.
 *
 * Problem addressed (REM-2):
 * Multiple independent tracker components previously each called navigator.mediaDevices.getUserMedia(),
 * causing hardware contention (NotReadableError), duplicated decoding pipelines, and inconsistent
 * lifecycle management.
 *
 * Solution:
 * Single authoritative camera acquisition path. Produces one MediaStream that is shared across
 * gaze, head pose, affect, and sync consumers. Manages track lifecycle and clean teardown.
 */

export interface CameraManagerOptions {
  idealWidth?: number;
  idealHeight?: number;
  facingMode?: string;
  enableAudio?: boolean;
}

export class IVPCameraManager {
  private currentStream: MediaStream | null = null;
  private isAcquiring: boolean = false;
  private acquisitionPromise: Promise<MediaStream> | null = null;

  /**
   * Acquire a single authoritative MediaStream for the interview session.
   * If a live, active stream is already acquired, returns it immediately without calling getUserMedia again.
   * If an acquisition is already in progress, awaits the existing promise to prevent concurrent acquisition races.
   */
  async acquireCamera(options: CameraManagerOptions = {}): Promise<MediaStream> {
    // 1. Return active stream if already running
    if (this.currentStream && this.currentStream.active) {
      const liveTracks = this.currentStream.getTracks().filter((t) => t.readyState === 'live');
      if (liveTracks.length > 0) {
        return this.currentStream;
      }
    }

    // 2. Prevent duplicate concurrent getUserMedia calls
    if (this.isAcquiring && this.acquisitionPromise) {
      return this.acquisitionPromise;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('navigator.mediaDevices.getUserMedia is not supported in this environment');
    }

    this.isAcquiring = true;
    this.acquisitionPromise = (async () => {
      try {
        const {
          idealWidth = 320,
          idealHeight = 240,
          facingMode = 'user',
          enableAudio = true,
        } = options;

        const videoConstraints: MediaTrackConstraints = {
          width: { ideal: idealWidth },
          height: { ideal: idealHeight },
          facingMode,
        };

        let stream: MediaStream;

        if (enableAudio) {
          try {
            // Attempt joint video + audio capture for lip-sync & speech metrics
            stream = await navigator.mediaDevices.getUserMedia({
              video: videoConstraints,
              audio: true,
            });
          } catch (audioErr) {
            // Fallback: If microphone is denied or unavailable, acquire video-only so visual tracking proceeds
            console.warn('[IVPCameraManager] Joint audio/video acquisition failed, falling back to video-only:', audioErr);
            stream = await navigator.mediaDevices.getUserMedia({
              video: videoConstraints,
              audio: false,
            });
          }
        } else {
          stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: false,
          });
        }

        this.currentStream = stream;
        return stream;
      } finally {
        this.isAcquiring = false;
        this.acquisitionPromise = null;
      }
    })();

    return this.acquisitionPromise;
  }

  /**
   * Stop the active stream tracks exactly once and release hardware resources.
   */
  stopCamera(): void {
    if (this.currentStream) {
      const tracks = this.currentStream.getTracks();
      for (const track of tracks) {
        try {
          track.stop();
        } catch (err) {
          console.warn('[IVPCameraManager] Error stopping media track:', err);
        }
      }
      this.currentStream = null;
    }
  }

  /**
   * Returns current active MediaStream or null.
   */
  getStream(): MediaStream | null {
    return this.currentStream;
  }

  /**
   * Check if camera stream is active and has at least one live track.
   */
  isActive(): boolean {
    if (!this.currentStream) return false;
    return this.currentStream.active && this.currentStream.getTracks().some((t) => t.readyState === 'live');
  }

  /**
   * Reset manager state (useful for test isolation).
   */
  reset(): void {
    this.stopCamera();
    this.isAcquiring = false;
    this.acquisitionPromise = null;
  }
}

export const ivpCameraManager = new IVPCameraManager();
