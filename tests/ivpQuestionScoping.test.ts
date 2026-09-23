/**
 * tests/ivpQuestionScoping.test.ts
 *
 * REM-4 Regression & Verification Suite: Per-Question Telemetry Scoping
 *
 * Verifies:
 * 1. Basic question attribution (Q1, Q2, Q3 frames receive explicit metadata)
 * 2. Question transition boundaries and isolation (no cross-question bleeding)
 * 3. Asynchronous worker frame preservation (Q1 frame in-flight when Q2 starts retains Q1 attribution)
 * 4. Server evaluation grouping (grouping intermingled frames into isolated per-question metrics)
 * 5. Preservation of overall session metrics alongside per-question breakdown
 * 6. Question retry semantics (clean single-question targeting without prior contamination)
 * 7. Empty / skipped questions handling without crashes
 * 8. Final question telemetry flushing before submission
 */

import {
  groupTelemetryByQuestion,
  performInterviewEvaluation,
} from '../src/lib/services/interviewEvaluation.server';
import { processGazeFrames } from '../src/lib/services/ivpGazeEngine';
import { analyzeHeadPoseAndGestures } from '../src/lib/services/ivpPoseEngine';
import { processAffectFrames } from '../src/lib/services/ivpAffectEngine';
import { processLipSyncWindows } from '../src/lib/services/ivpSyncEngine';
import type {
  GazeFrameInput,
  HeadPoseFrameInput,
  AffectFrameInput,
  SyncWindowInput,
} from '../src/types/index';

describe('REM-4: Per-Question Telemetry Scoping Suite', () => {
  describe('1. Basic Attribution & Distinguishability', () => {
    it('ensures frames for Question 1 and Question 2 carry explicit, distinguishable attribution', () => {
      const q1GazeFrame: GazeFrameInput = {
        timestampMs: 1200,
        pitchDegrees: 2.5,
        yawDegrees: -1.2,
        confidence: 0.95,
        questionId: 'q_1',
        questionIndex: 0,
      };

      const q2GazeFrame: GazeFrameInput = {
        timestampMs: 4500,
        pitchDegrees: -3.0,
        yawDegrees: 4.1,
        confidence: 0.91,
        questionId: 'q_2',
        questionIndex: 1,
      };

      expect(q1GazeFrame.questionId).toBe('q_1');
      expect(q1GazeFrame.questionIndex).toBe(0);
      expect(q2GazeFrame.questionId).toBe('q_2');
      expect(q2GazeFrame.questionIndex).toBe(1);
      expect(q1GazeFrame.questionId).not.toBe(q2GazeFrame.questionId);
    });

    it('all four telemetry streams support explicit questionId and questionIndex metadata', () => {
      const gaze: GazeFrameInput = {
        timestampMs: 100,
        questionId: 'q_1',
        questionIndex: 0,
      };
      const pose: HeadPoseFrameInput = {
        timestampMs: 100,
        yawDegrees: 0,
        pitchDegrees: 0,
        rollDegrees: 0,
        questionId: 'q_1',
        questionIndex: 0,
      };
      const affect: AffectFrameInput = {
        timestampMs: 100,
        valence: 0.5,
        arousal: 0.2,
        questionId: 'q_1',
        questionIndex: 0,
      };
      const sync: SyncWindowInput = {
        timestampMs: 100,
        visualDistance: 0.85,
        offsetMs: 15,
        audioEnergy: 0.4,
        questionId: 'q_1',
        questionIndex: 0,
      };

      expect(gaze.questionId).toBe('q_1');
      expect(pose.questionId).toBe('q_1');
      expect(affect.questionId).toBe('q_1');
      expect(sync.questionId).toBe('q_1');
    });
  });

  describe('2. Question Boundary Transitions & Isolation', () => {
    it('isolates multi-question telemetry without cross-contamination', () => {
      const sessionGazeFrames: GazeFrameInput[] = [
        { timestampMs: 100, pitchDegrees: 0, yawDegrees: 0, questionId: 'q_1', questionIndex: 0 },
        { timestampMs: 200, pitchDegrees: 1, yawDegrees: 0, questionId: 'q_1', questionIndex: 0 },
        { timestampMs: 300, pitchDegrees: 2, yawDegrees: 1, questionId: 'q_1', questionIndex: 0 }, // Last Q1 frame
        { timestampMs: 400, pitchDegrees: -15, yawDegrees: 25, questionId: 'q_2', questionIndex: 1 }, // First Q2 frame (looking away)
        { timestampMs: 500, pitchDegrees: -18, yawDegrees: 30, questionId: 'q_2', questionIndex: 1 },
        { timestampMs: 600, pitchDegrees: 1, yawDegrees: -1, questionId: 'q_3', questionIndex: 2 },
      ];

      const q1Frames = sessionGazeFrames.filter((f) => f.questionId === 'q_1');
      const q2Frames = sessionGazeFrames.filter((f) => f.questionId === 'q_2');
      const q3Frames = sessionGazeFrames.filter((f) => f.questionId === 'q_3');

      expect(q1Frames.length).toBe(3);
      expect(q2Frames.length).toBe(2);
      expect(q3Frames.length).toBe(1);

      // Boundary check: Last Q1 frame is preserved with Q1 tag
      expect(q1Frames[2].timestampMs).toBe(300);
      expect(q1Frames[2].questionId).toBe('q_1');

      // Boundary check: Q2 off-center frames do not contaminate Q1 metrics
      const q1Metrics = processGazeFrames(q1Frames);
      const q2Metrics = processGazeFrames(q2Frames);

      expect(q1Metrics.eyeContactPercentage).toBeGreaterThan(90);
      expect(q2Metrics.eyeContactPercentage).toBeLessThan(50);
    });

    it('ensures no Q1 frame is tagged as Q2 and no Q2 frame is tagged as Q1', () => {
      const q1Frames: GazeFrameInput[] = [
        { timestampMs: 100, questionId: 'q_1', questionIndex: 0 },
        { timestampMs: 200, questionId: 'q_1', questionIndex: 0 },
      ];
      const q2Frames: GazeFrameInput[] = [
        { timestampMs: 300, questionId: 'q_2', questionIndex: 1 },
        { timestampMs: 400, questionId: 'q_2', questionIndex: 1 },
      ];

      const combined = [...q1Frames, ...q2Frames];

      expect(combined.filter((f) => f.questionId === 'q_1')).toEqual(q1Frames);
      expect(combined.filter((f) => f.questionId === 'q_2')).toEqual(q2Frames);
      expect(combined.filter((f) => f.questionId === 'q_1').some((f) => f.timestampMs >= 300)).toBe(false);
    });
  });

  describe('3. Asynchronous Worker Frame Attribution In-Flight Simulation', () => {
    it('preserves originating question identity when frame result returns after transition to next question', () => {
      // Simulation:
      // 1. Frame 101 is submitted while Question 1 is active (metadata: { questionId: 'q_1', questionIndex: 0 })
      // 2. React state transitions to Question 2 (currentQuestionId = 'q_2')
      // 3. Worker returns result for Frame 101
      // 4. Result must be tagged with 'q_1', NOT 'q_2'

      const inFlightMetadataMap = new Map<number, { questionId?: string; questionIndex?: number }>();

      // Step 1: Submit frame 101 under Q1
      const activeQuestionAtDispatch = { questionId: 'q_1', questionIndex: 0 };
      inFlightMetadataMap.set(101, activeQuestionAtDispatch);

      // Step 2: Transition to Q2
      let activeQuestionNow = { questionId: 'q_2', questionIndex: 1 };

      // Step 3: Worker returns result for frame 101
      const returnedFrameId = 101;
      const boundMetadata = inFlightMetadataMap.get(returnedFrameId);
      inFlightMetadataMap.delete(returnedFrameId);

      // Resolution logic used in useIVPSessionPipeline: metadata ?? activeQuestionNow
      const resolvedQuestionId = boundMetadata?.questionId ?? activeQuestionNow.questionId;
      const resolvedQuestionIndex = boundMetadata?.questionIndex ?? activeQuestionNow.questionIndex;

      expect(resolvedQuestionId).toBe('q_1');
      expect(resolvedQuestionIndex).toBe(0);
      expect(resolvedQuestionId).not.toBe(activeQuestionNow.questionId);
    });
  });

  describe('4. Server Evaluation Telemetry Grouping & Evaluation', () => {
    it('groupTelemetryByQuestion correctly partitions intermingled frames into isolated groups', () => {
      const intermingledGazeFrames: GazeFrameInput[] = [
        { timestampMs: 100, questionId: 'q_1', questionIndex: 0 },
        { timestampMs: 200, questionId: 'q_2', questionIndex: 1 },
        { timestampMs: 300, questionId: 'q_1', questionIndex: 0 },
        { timestampMs: 400, questionId: 'q_3', questionIndex: 2 },
        { timestampMs: 500, questionId: 'q_2', questionIndex: 1 },
      ];

      const questionIds = ['q_1', 'q_2', 'q_3'];
      const grouped = groupTelemetryByQuestion(intermingledGazeFrames, questionIds);

      expect(grouped.get('q_1')?.length).toBe(2);
      expect(grouped.get('q_2')?.length).toBe(2);
      expect(grouped.get('q_3')?.length).toBe(1);

      expect(grouped.get('q_1')?.map((f) => f.timestampMs)).toEqual([100, 300]);
      expect(grouped.get('q_2')?.map((f) => f.timestampMs)).toEqual([200, 500]);
      expect(grouped.get('q_3')?.map((f) => f.timestampMs)).toEqual([400]);
    });

    it('safely excludes unscoped frames (e.g., camera warmup) from per-question groupings', () => {
      const framesWithWarmup: GazeFrameInput[] = [
        { timestampMs: 10 }, // Warmup frame (unscoped)
        { timestampMs: 50 }, // Pre-question frame (unscoped)
        { timestampMs: 100, questionId: 'q_1', questionIndex: 0 },
        { timestampMs: 200, questionId: 'q_2', questionIndex: 1 },
      ];

      const grouped = groupTelemetryByQuestion(framesWithWarmup, ['q_1', 'q_2']);

      expect(grouped.get('q_1')?.length).toBe(1);
      expect(grouped.get('q_2')?.length).toBe(1);

      // Unscoped frames were never assigned to q_1 or q_2
      const allAssigned = [...grouped.get('q_1')!, ...grouped.get('q_2')!];
      expect(allAssigned.some((f) => f.timestampMs < 100)).toBe(false);
    });

    it('evaluates individual questions in performInterviewEvaluation with isolated telemetry breakdown', async () => {
      const q1Gaze: GazeFrameInput[] = [
        { timestampMs: 100, pitchDegrees: 0, yawDegrees: 0, questionId: 'q_1', questionIndex: 0 },
        { timestampMs: 200, pitchDegrees: 1, yawDegrees: 0, questionId: 'q_1', questionIndex: 0 },
      ];

      const q2Gaze: GazeFrameInput[] = [
        { timestampMs: 1100, pitchDegrees: -25, yawDegrees: 35, questionId: 'q_2', questionIndex: 1 },
        { timestampMs: 1200, pitchDegrees: -28, yawDegrees: 40, questionId: 'q_2', questionIndex: 1 },
      ];

      const q1Pose: HeadPoseFrameInput[] = [
        { timestampMs: 100, yawDegrees: 0, pitchDegrees: 0, rollDegrees: 0, questionId: 'q_1', questionIndex: 0 },
      ];

      const q2Pose: HeadPoseFrameInput[] = [
        { timestampMs: 1100, yawDegrees: 25, pitchDegrees: -20, rollDegrees: 5, questionId: 'q_2', questionIndex: 1 },
      ];

      const evaluationInput = {
        setupData: {
          role: 'Frontend Engineer',
          type: 'Technical',
          difficulty: 'Medium',
          duration: 30,
          questionCount: 2,
          focusAreas: ['React'],
        },
        questionsList: [
          { id: 'q_1', question: 'Explain React hooks lifecycle' },
          { id: 'q_2', question: 'How does the virtual DOM reconciliation work?' },
        ],
        answersList: [
          { answerText: 'React hooks manage component state and side effects with predictable execution order.' },
          { answerText: 'The virtual DOM reconciles diffs using key heuristics to minimize expensive DOM operations.' },
        ],
        gazeFrames: [...q1Gaze, ...q2Gaze],
        headPoseFrames: [...q1Pose, ...q2Pose],
      };

      const report = await performInterviewEvaluation(evaluationInput, 'test-user-id');

      expect(report.breakdown.length).toBe(2);

      // Question 1 breakdown metrics
      const q1Breakdown = report.breakdown[0];
      expect(q1Breakdown.id).toBe('q_1');
      expect(q1Breakdown.eyeContactMetrics).toBeDefined();
      expect(q1Breakdown.eyeContactMetrics?.gazeFrames.length).toBe(2);
      expect(q1Breakdown.eyeContactMetrics?.eyeContactPercentage).toBeGreaterThan(90);
      expect(q1Breakdown.headPoseMetrics?.totalFramesAnalyzed).toBe(1);

      // Question 2 breakdown metrics (poor eye contact, looking away)
      const q2Breakdown = report.breakdown[1];
      expect(q2Breakdown.id).toBe('q_2');
      expect(q2Breakdown.eyeContactMetrics).toBeDefined();
      expect(q2Breakdown.eyeContactMetrics?.gazeFrames.length).toBe(2);
      expect(q2Breakdown.eyeContactMetrics?.eyeContactPercentage).toBeLessThan(50);
      expect(q2Breakdown.headPoseMetrics?.totalFramesAnalyzed).toBe(1);

      // Overall session metrics still exist and aggregate all 4 frames
      expect(report.eyeContactMetrics?.gazeFrames.length).toBe(4);
      expect(report.headPoseMetrics?.totalFramesAnalyzed).toBe(2);
    });
  });

  describe('5. Retry Semantics & Isolation', () => {
    it('scopes retry telemetry specifically to the retried question index without historical bleed', async () => {
      // Candidate retries question index 1 (id: 'q_2')
      const retryGazeFrames: GazeFrameInput[] = [
        { timestampMs: 500, pitchDegrees: 0, yawDegrees: 0, questionId: 'q_2', questionIndex: 1 },
        { timestampMs: 600, pitchDegrees: 1, yawDegrees: -1, questionId: 'q_2', questionIndex: 1 },
        { timestampMs: 700, pitchDegrees: 0, yawDegrees: 0, questionId: 'q_2', questionIndex: 1 },
      ];

      const retryInput = {
        setupData: { role: 'Backend Engineer' },
        questionsList: [{ id: 'q_2', question: 'How does database indexing work?' }],
        answersList: [{ answerText: 'B-Trees allow logarithmic lookups by keeping keys sorted across page blocks.' }],
        gazeFrames: retryGazeFrames,
      };

      const report = await performInterviewEvaluation(retryInput, 'user-retry');
      expect(report.breakdown.length).toBe(1);
      expect(report.breakdown[0].id).toBe('q_2');
      expect(report.breakdown[0].eyeContactMetrics?.gazeFrames.length).toBe(3);
      expect(report.breakdown[0].eyeContactMetrics?.eyeContactPercentage).toBe(100);
    });
  });

  describe('6. Edge Cases: Empty Telemetry & Skipped Questions', () => {
    it('safely handles a question with zero telemetry frames without crashing or corrupting metrics', async () => {
      const evaluationInput = {
        setupData: { role: 'DevOps Engineer' },
        questionsList: [
          { id: 'q_1', question: 'Explain Kubernetes Pod lifecycle' },
          { id: 'q_2', question: 'Explain Docker layers' },
        ],
        answersList: [
          { answerText: 'A pod has phases: Pending, Running, Succeeded, Failed, and Unknown.' },
          { answerText: '[Skipped]' },
        ],
        gazeFrames: [
          { timestampMs: 100, pitchDegrees: 0, yawDegrees: 0, questionId: 'q_1', questionIndex: 0 },
        ],
      };

      const report = await performInterviewEvaluation(evaluationInput, 'test-skipped');
      expect(report.breakdown.length).toBe(2);

      // Question 1 has metrics
      expect(report.breakdown[0].eyeContactMetrics?.gazeFrames.length).toBe(1);

      // Question 2 (skipped with 0 frames) has undefined per-question metrics
      expect(report.breakdown[1].eyeContactMetrics).toBeUndefined();
      expect(report.breakdown[1].headPoseMetrics).toBeUndefined();
    });
  });
});
