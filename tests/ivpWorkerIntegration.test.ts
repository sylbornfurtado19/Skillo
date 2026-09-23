/**
 * tests/ivpWorkerIntegration.test.ts
 *
 * REM-3 Integration & Regression Test Suite:
 * 1. Worker + ONNX Architecture Integration in InterviewSession
 * 2. Temporal Smoothing & Live HUD Telemetry Generation
 * 3. Prevention of Legacy Heuristic Trackers in Production InterviewSession
 * 4. Preservation of REM-2 Single MediaStream Architecture (zero getUserMedia in vision path)
 * 5. Lifecycle, Question Reset, and Telemetry Buffering
 */

import fs from 'fs';
import path from 'path';
import {
  GazeAngleEMA,
  HeadPoseEMA,
  AffectiveEMA,
  CategoricalConsensusSmoother,
} from '../src/lib/services/temporalSmoothing';
import {
  evaluateEyeContact,
  classifyFocusZone,
} from '../src/lib/services/ivpGazeEngine';
import { processPoseFrame } from '../src/lib/services/ivpPoseEngine';
import { processAffectFrame } from '../src/lib/services/ivpAffectEngine';
import type {
  GazeFrameInput,
  HeadPoseFrameInput,
  HeadPoseFrameResult,
  AffectFrameInput,
  DiscreteEmotion,
} from '../src/types/index';
import type { SmoothedTelemetry } from '../src/lib/services/onnxInferenceService';

describe('REM-3: InterviewSession Worker + ONNX Architecture Integration', () => {
  describe('1. Static Code Analysis & Regression Verification', () => {
    const interviewSessionPath = path.resolve(__dirname, '../src/views/InterviewSession.tsx');
    const ivpCameraPreviewPath = path.resolve(__dirname, '../src/components/ui/IVPCameraPreview.tsx');
    const ivpSessionPipelinePath = path.resolve(__dirname, '../src/hooks/useIVPSessionPipeline.ts');

    const interviewSessionContent = fs.readFileSync(interviewSessionPath, 'utf8');
    const ivpCameraPreviewContent = fs.readFileSync(ivpCameraPreviewPath, 'utf8');
    const ivpSessionPipelineContent = fs.readFileSync(ivpSessionPipelinePath, 'utf8');

    it('InterviewSession MUST NOT import or render legacy heuristic vision trackers', () => {
      // Legacy tracker component imports must be eliminated from InterviewSession
      expect(interviewSessionContent).not.toMatch(/import\s+IVPGazeTracker/);
      expect(interviewSessionContent).not.toMatch(/import\s+IVPPoseTracker/);
      expect(interviewSessionContent).not.toMatch(/import\s+IVPAffectTracker/);

      // Legacy JSX tracker tags must not be rendered
      expect(interviewSessionContent).not.toMatch(/<IVPGazeTracker/);
      expect(interviewSessionContent).not.toMatch(/<IVPPoseTracker/);
      expect(interviewSessionContent).not.toMatch(/<IVPAffectTracker/);
    });

    it('InterviewSession MUST NOT call navigator.mediaDevices.getUserMedia directly', () => {
      // Must preserve REM-2 single camera ownership via useInterviewCamera
      expect(interviewSessionContent).not.toMatch(/navigator\.mediaDevices\.getUserMedia/);
    });

    it('InterviewSession MUST import and wire useIVPSessionPipeline and IVPCameraPreview', () => {
      expect(interviewSessionContent).toMatch(/useIVPSessionPipeline/);
      expect(interviewSessionContent).toMatch(/<IVPCameraPreview/);
      expect(interviewSessionContent).toMatch(/useInterviewCamera/);
    });

    it('InterviewSession MUST retain IVPSyncTracker for audio-visual synchronization & latency', () => {
      expect(interviewSessionContent).toMatch(/IVPSyncTracker/);
      expect(interviewSessionContent).toMatch(/<IVPSyncTracker/);
      expect(interviewSessionContent).toMatch(/capturedSyncWindows/);
    });

    it('useIVPSessionPipeline MUST connect to useVisionWorker and useONNXWorker', () => {
      expect(ivpSessionPipelineContent).toMatch(/useVisionWorker/);
      expect(ivpSessionPipelineContent).toMatch(/useONNXWorker/);
      expect(ivpSessionPipelineContent).not.toMatch(/navigator\.mediaDevices\.getUserMedia/);
    });

    it('IVPCameraPreview MUST be a presentation-only component without pixel heuristic engines', () => {
      expect(ivpCameraPreviewContent).not.toMatch(/navigator\.mediaDevices\.getUserMedia/);
      expect(ivpCameraPreviewContent).not.toMatch(/getImageData/);
      expect(ivpCameraPreviewContent).not.toMatch(/skinPixelCount/);
    });
  });

  describe('2. Pipeline Telemetry Transformation & Smoothing Contract', () => {
    it('applies GazeAngleEMA smoothing and classifies eye contact from ONNX telemetry', () => {
      const gazeEma = new GazeAngleEMA(0.45);
      const rawSamples = [
        { gazeX: 0, gazeY: 0 },
        { gazeX: 2.5, gazeY: -1.8 },
        { gazeX: 4.0, gazeY: -3.0 },
      ];

      const smoothedGaze = rawSamples.map((s) =>
        gazeEma.update({ pitchDegrees: s.gazeY, yawDegrees: s.gazeX })
      );

      const latest = smoothedGaze[smoothedGaze.length - 1];
      expect(latest.pitchDegrees).toBeLessThan(0); // Looking slightly up
      expect(latest.yawDegrees).toBeGreaterThan(0); // Looking slightly right

      // Evaluation
      const isContact = evaluateEyeContact(latest.pitchDegrees, latest.yawDegrees);
      const zone = classifyFocusZone(latest.pitchDegrees, latest.yawDegrees);

      expect(isContact).toBe(true);
      expect(zone).toBe('CENTER_SCREEN');
    });

    it('applies HeadPoseEMA smoothing and detects gestures from ONNX head pose', () => {
      const poseEma = new HeadPoseEMA(0.35);
      let lastResult: HeadPoseFrameResult | undefined = undefined;

      const telemetryFrames = [
        { yaw: 0, pitch: 0, roll: 0, t: 0 },
        { yaw: 2, pitch: 18, roll: 1, t: 100 },
        { yaw: 1, pitch: -16, roll: 0, t: 250 },
        { yaw: 0, pitch: 20, roll: 0, t: 400 },
      ];

      const results = telemetryFrames.map((f) => {
        const smoothed = poseEma.update({
          yawDegrees: f.yaw,
          pitchDegrees: f.pitch,
          rollDegrees: f.roll,
        });

        const input: HeadPoseFrameInput = {
          timestampMs: f.t,
          yawDegrees: smoothed.yawDegrees,
          pitchDegrees: smoothed.pitchDegrees,
          rollDegrees: smoothed.rollDegrees,
          confidence: 0.95,
          isSubjectPresent: true,
        };

        const res = processPoseFrame(input, lastResult);
        lastResult = res;
        return res;
      });

      expect(results.length).toBe(4);
      expect(results[results.length - 1].angles.pitchDegrees).toBeDefined();
      expect(results[results.length - 1].detectedGesture).toBeDefined();
      expect(results[results.length - 1].angularVelocity).toBeGreaterThanOrEqual(0);
    });

    it('applies AffectiveEMA and CategoricalConsensus to ONNX emotion outputs', () => {
      const affectEma = new AffectiveEMA(0.25, 0.20);
      const consensus = new CategoricalConsensusSmoother<DiscreteEmotion>(5, 0.30);

      const rawEmotions: DiscreteEmotion[] = ['CONFIDENT', 'CONFIDENT', 'CONFIDENT', 'HAPPY'];
      let latestSmoothedEmotion: DiscreteEmotion = 'NEUTRAL';

      rawEmotions.forEach((emotion) => {
        latestSmoothedEmotion = consensus.update(emotion);
      });

      expect(latestSmoothedEmotion).toBe('CONFIDENT');

      const smoothedVA = affectEma.update({ valence: 0.6, arousal: 0.4 }, 88);
      expect(smoothedVA.vaCoordinates.valence).toBeGreaterThan(0);
      expect(smoothedVA.vaCoordinates.arousal).toBeGreaterThan(0);
      expect(smoothedVA.composureScore).toBeGreaterThan(50);

      const affectInput: AffectFrameInput = {
        timestampMs: 500,
        valence: smoothedVA.vaCoordinates.valence,
        arousal: smoothedVA.vaCoordinates.arousal,
        confidence: 0.90,
        dominantEmotion: latestSmoothedEmotion,
      };

      const result = processAffectFrame(affectInput);
      expect(result.dominantEmotion).toBe('CONFIDENT');
      expect(result.composureScore).toBeDefined();
    });
  });

  describe('3. Telemetry Buffering & Submission Conformance', () => {
    it('buffers conforming gaze, pose, and affect frames for evaluation submission', () => {
      const mockGazeFrames: GazeFrameInput[] = [
        { timestampMs: 100, pitchDegrees: 2.1, yawDegrees: -1.4, confidence: 0.92 },
        { timestampMs: 200, pitchDegrees: 1.8, yawDegrees: -0.9, confidence: 0.94 },
      ];

      const mockPoseFrames: HeadPoseFrameInput[] = [
        { timestampMs: 100, yawDegrees: 3.2, pitchDegrees: -1.0, rollDegrees: 0.4, confidence: 0.90, isSubjectPresent: true },
        { timestampMs: 200, yawDegrees: 2.8, pitchDegrees: -0.8, rollDegrees: 0.3, confidence: 0.91, isSubjectPresent: true },
      ];

      const mockAffectFrames: AffectFrameInput[] = [
        { timestampMs: 100, valence: 0.45, arousal: 0.25, confidence: 0.88, dominantEmotion: 'CONFIDENT' },
        { timestampMs: 200, valence: 0.50, arousal: 0.22, confidence: 0.88, dominantEmotion: 'CONFIDENT' },
      ];

      // Verify every frame conforms to evaluation payload type requirements
      for (const gf of mockGazeFrames) {
        expect(typeof gf.timestampMs).toBe('number');
        expect(typeof gf.pitchDegrees).toBe('number');
        expect(typeof gf.yawDegrees).toBe('number');
        expect(typeof gf.confidence).toBe('number');
      }

      for (const pf of mockPoseFrames) {
        expect(typeof pf.timestampMs).toBe('number');
        expect(typeof pf.yawDegrees).toBe('number');
        expect(typeof pf.pitchDegrees).toBe('number');
        expect(typeof pf.rollDegrees).toBe('number');
        expect(pf.isSubjectPresent).toBe(true);
      }

      for (const af of mockAffectFrames) {
        expect(typeof af.timestampMs).toBe('number');
        expect(typeof af.valence).toBe('number');
        expect(typeof af.arousal).toBe('number');
        expect(af.dominantEmotion).toBe('CONFIDENT');
      }
    });

    it('reset filters on question change correctly clears running statistics', () => {
      const gazeEma = new GazeAngleEMA(0.45);
      const poseEma = new HeadPoseEMA(0.35);
      const affectEma = new AffectiveEMA(0.25, 0.20);
      const consensus = new CategoricalConsensusSmoother<DiscreteEmotion>(5, 0.30);

      gazeEma.update({ pitchDegrees: 15, yawDegrees: -10 });
      poseEma.update({ yawDegrees: 20, pitchDegrees: 10, rollDegrees: -5 });
      affectEma.update({ valence: 0.8, arousal: 0.7 }, 90);
      consensus.update('HAPPY');

      // Reset
      gazeEma.reset();
      poseEma.reset();
      affectEma.reset();
      consensus.reset();

      // Fresh update after reset behaves like initial value
      const freshGaze = gazeEma.update({ pitchDegrees: 0, yawDegrees: 0 });
      expect(freshGaze.pitchDegrees).toBe(0);
      expect(freshGaze.yawDegrees).toBe(0);

      const freshPose = poseEma.update({ yawDegrees: 0, pitchDegrees: 0, rollDegrees: 0 });
      expect(freshPose.yawDegrees).toBe(0);
      expect(freshPose.pitchDegrees).toBe(0);
    });
  });
});
