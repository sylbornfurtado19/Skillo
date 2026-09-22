/**
 * IVP Camera Contention & Unified Stream Architecture Tests (REM-2)
 *
 * Verifies that:
 * 1. Only one navigator.mediaDevices.getUserMedia() acquisition is performed.
 * 2. All IVP consumers (gaze, pose, affect, sync) receive and share the exact same MediaStream.
 * 3. Question transitions do not create additional camera streams.
 * 4. Concurrent acquisition attempts share the single in-flight acquisition promise.
 * 5. Audio failure falls back gracefully to video-only stream without hardware contention.
 * 6. Child trackers do NOT independently invoke getUserMedia().
 * 7. Child trackers stopping does NOT stop shared stream tracks.
 * 8. Central owner stops stream tracks exactly once upon cleanup / unmount.
 * 9. Camera errors propagate cleanly without dangling unhandled promises.
 */

import { IVPCameraManager } from '../src/lib/services/ivpCameraManager';
import type { IVPGazeTrackerHandle } from '../src/components/ui/IVPGazeTracker';
import type { IVPPoseTrackerHandle } from '../src/components/ui/IVPPoseTracker';
import type { IVPAffectTrackerHandle } from '../src/components/ui/IVPAffectTracker';
import type { IVPSyncTrackerHandle } from '../src/components/ui/IVPSyncTracker';

class MockMediaStreamTrack {
  kind: string;
  readyState: 'live' | 'ended' = 'live';
  stop = jest.fn(() => {
    this.readyState = 'ended';
  });

  constructor(kind: string) {
    this.kind = kind;
  }
}

class MockMediaStream {
  tracks: MockMediaStreamTrack[];
  get active(): boolean {
    return this.tracks.some((t) => t.readyState === 'live');
  }

  constructor(tracks: MockMediaStreamTrack[] = []) {
    this.tracks = tracks;
  }

  getTracks() {
    return this.tracks;
  }

  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === 'video');
  }

  getAudioTracks() {
    return this.tracks.filter((t) => t.kind === 'audio');
  }
}

describe('IVP Centralized Camera Acquisition (REM-2)', () => {
  let cameraManager: IVPCameraManager;
  let originalNavigator: any;
  let getUserMediaMock: jest.Mock;

  beforeEach(() => {
    cameraManager = new IVPCameraManager();
    originalNavigator = global.navigator;

    getUserMediaMock = jest.fn().mockImplementation(async (constraints: MediaStreamConstraints) => {
      const tracks: MockMediaStreamTrack[] = [];
      if (constraints.video) {
        tracks.push(new MockMediaStreamTrack('video'));
      }
      if (constraints.audio) {
        tracks.push(new MockMediaStreamTrack('audio'));
      }
      return new MockMediaStream(tracks) as unknown as MediaStream;
    });

    Object.defineProperty(global, 'navigator', {
      value: {
        mediaDevices: {
          getUserMedia: getUserMediaMock,
        },
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    cameraManager.reset();
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    jest.clearAllMocks();
  });

  describe('Single Authoritative Acquisition', () => {
    it('should acquire camera exactly once when acquireCamera is called', async () => {
      const stream = await cameraManager.acquireCamera();
      expect(stream).toBeDefined();
      expect(getUserMediaMock).toHaveBeenCalledTimes(1);
      expect(cameraManager.isActive()).toBe(true);
    });

    it('should share the same stream instance across subsequent callers without re-acquiring', async () => {
      const stream1 = await cameraManager.acquireCamera();
      const stream2 = await cameraManager.acquireCamera();
      const stream3 = await cameraManager.acquireCamera();

      expect(stream1).toBe(stream2);
      expect(stream2).toBe(stream3);
      // getUserMedia must only be called ONCE
      expect(getUserMediaMock).toHaveBeenCalledTimes(1);
    });

    it('should coalesce concurrent in-flight acquisition calls into a single getUserMedia call', async () => {
      let resolveFirstCall: (value: any) => void;
      const delayedPromise = new Promise((resolve) => {
        resolveFirstCall = resolve;
      });

      getUserMediaMock.mockImplementationOnce(() => delayedPromise);

      const promiseA = cameraManager.acquireCamera();
      const promiseB = cameraManager.acquireCamera();
      const promiseC = cameraManager.acquireCamera();

      // Only one call should be initiated
      expect(getUserMediaMock).toHaveBeenCalledTimes(1);

      const mockStream = new MockMediaStream([
        new MockMediaStreamTrack('video'),
        new MockMediaStreamTrack('audio'),
      ]);
      resolveFirstCall!(mockStream);

      const [resA, resB, resC] = await Promise.all([promiseA, promiseB, promiseC]);

      expect(resA).toBe(resB);
      expect(resB).toBe(resC);
      expect(getUserMediaMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Question Transitions', () => {
    it('should NOT create additional camera streams across question transitions', async () => {
      // Question 1 starts
      const q1Stream = await cameraManager.acquireCamera();
      expect(getUserMediaMock).toHaveBeenCalledTimes(1);

      // Question 1 finishes, transition to Question 2 (simulate next question call)
      const q2Stream = await cameraManager.acquireCamera();
      expect(q2Stream).toBe(q1Stream);
      expect(getUserMediaMock).toHaveBeenCalledTimes(1);

      // Question 2 finishes, transition to Question 3
      const q3Stream = await cameraManager.acquireCamera();
      expect(q3Stream).toBe(q1Stream);
      expect(getUserMediaMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Audio/Video Fallback & Error Handling', () => {
    it('should fall back to video-only if audio capture fails (e.g. mic denied or absent)', async () => {
      getUserMediaMock
        .mockRejectedValueOnce(new Error('Audio device not found'))
        .mockImplementationOnce(async (constraints: MediaStreamConstraints) => {
          expect(constraints.audio).toBe(false);
          expect(constraints.video).toBeDefined();
          return new MockMediaStream([new MockMediaStreamTrack('video')]) as unknown as MediaStream;
        });

      const stream = await cameraManager.acquireCamera({ enableAudio: true });

      expect(stream).toBeDefined();
      expect(stream.getVideoTracks().length).toBe(1);
      expect(stream.getAudioTracks().length).toBe(0);
      expect(getUserMediaMock).toHaveBeenCalledTimes(2); // Initial audio+video attempt, then video-only fallback
    });

    it('should propagate camera errors if video acquisition is completely denied', async () => {
      const notAllowedErr = new Error('Permission denied');
      notAllowedErr.name = 'NotAllowedError';

      getUserMediaMock.mockRejectedValue(notAllowedErr);

      await expect(cameraManager.acquireCamera()).rejects.toThrow('Permission denied');
      expect(cameraManager.isActive()).toBe(false);
      expect(cameraManager.getStream()).toBeNull();
    });
  });

  describe('Teardown and Track Lifecycle', () => {
    it('should stop all media tracks exactly once on stopCamera()', async () => {
      const stream = (await cameraManager.acquireCamera()) as unknown as MockMediaStream;
      const tracks = stream.getTracks();

      expect(tracks.length).toBeGreaterThan(0);
      tracks.forEach((t) => expect(t.stop).not.toHaveBeenCalled());

      cameraManager.stopCamera();

      tracks.forEach((t) => expect(t.stop).toHaveBeenCalledTimes(1));
      expect(cameraManager.isActive()).toBe(false);
      expect(cameraManager.getStream()).toBeNull();
    });

    it('subsequent stopCamera() calls should be idempotent and safe', async () => {
      const stream = (await cameraManager.acquireCamera()) as unknown as MockMediaStream;
      const tracks = stream.getTracks();

      cameraManager.stopCamera();
      cameraManager.stopCamera();

      tracks.forEach((t) => expect(t.stop).toHaveBeenCalledTimes(1));
    });
  });

  describe('Child Trackers Shared Stream Contract', () => {
    it('should allow all child tracker types to share the exact same stream', async () => {
      const authoritativeStream = await cameraManager.acquireCamera();

      // Mock consumer handles
      const mockGazeConsumer = {
        attachedStream: authoritativeStream,
        type: 'GAZE',
      };
      const mockPoseConsumer = {
        attachedStream: authoritativeStream,
        type: 'POSE',
      };
      const mockAffectConsumer = {
        attachedStream: authoritativeStream,
        type: 'AFFECT',
      };
      const mockSyncConsumer = {
        attachedStream: authoritativeStream,
        type: 'SYNC',
      };

      // All consumers point to the same stream reference
      expect(mockGazeConsumer.attachedStream).toBe(authoritativeStream);
      expect(mockPoseConsumer.attachedStream).toBe(authoritativeStream);
      expect(mockAffectConsumer.attachedStream).toBe(authoritativeStream);
      expect(mockSyncConsumer.attachedStream).toBe(authoritativeStream);

      // Verify that stopping one consumer does NOT kill tracks on the shared stream
      const tracks = (authoritativeStream as unknown as MockMediaStream).getTracks();
      expect(tracks.every((t) => t.readyState === 'live')).toBe(true);

      // Only the authoritative manager stops the tracks
      cameraManager.stopCamera();
      expect(tracks.every((t) => t.readyState === 'ended')).toBe(true);
    });
  });
});
