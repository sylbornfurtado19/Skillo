'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import {
  IVPKernelRunner,
  type RunnerFrameResult,
} from '@/lib/services/ivpKernelRunner';
import {
  createQuestionAccumulator,
  addSampleToAccumulator,
  summarizeQuestionEvidence,
  compileEvidenceReceipt,
  type QuestionSampleAccumulator,
} from '@/lib/services/ivpEvidenceAggregator';
import {
  createInitialBlinkState,
  processBlinkDetection,
  computeBlinkRate,
  computeSpeechActivity,
  type BlinkDetectorState,
} from '@/lib/services/ivpSignalCalculators';
import type { FaceRoi } from '@/lib/services/ivpDiagnosticKernels';
import type {
  IVPEvidenceReceipt,
  IVPEvidenceThumbnail,
  IVPKernelCounts,
  IVPQuestionEvidence,
} from '@/types/ivpEvidence';

export interface UseIVPEvidenceRunnerOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  questionId?: string;
  questionIndex?: number;
  isPaused?: boolean;
  isTabPaused?: boolean;
  isThrottled?: boolean;
  isInterviewerSpeaking?: boolean;
  faceRoi?: FaceRoi | null;
  faceDetected?: boolean | null;
  ear?: number | null;
  mar?: number | null;
  enabled?: boolean;
}

export interface IVPEvidenceRunnerHandle {
  status: 'idle' | 'running' | 'paused';
  framesAnalyzed: number;
  samplingHz: number;
  avgKernelMs: number;
  kernelCounts: IVPKernelCounts;
  latestBuffers: RunnerFrameResult['diagnosticBuffers'] | null;
  latestThumbnails: IVPEvidenceThumbnail[];
  getReceipt: () => Promise<IVPEvidenceReceipt>;
  reset: () => void;
}

export function useIVPEvidenceRunner({
  videoRef,
  questionId = 'q0',
  questionIndex = 0,
  isPaused = false,
  isTabPaused = false,
  isThrottled = false,
  isInterviewerSpeaking = false,
  faceRoi = null,
  faceDetected = null,
  ear = null,
  mar = null,
  enabled = true,
}: UseIVPEvidenceRunnerOptions): IVPEvidenceRunnerHandle {
  const runnerRef = useRef<IVPKernelRunner | null>(null);
  if (!runnerRef.current) {
    runnerRef.current = new IVPKernelRunner();
  }

  const sessionStartTsRef = useRef<number>(0);
  const marSlidingWindowRef = useRef<Array<{ timestamp: number; mar: number }>>([]);
  const blinkStateRef = useRef<BlinkDetectorState>(createInitialBlinkState());
  const completedQuestionsRef = useRef<IVPQuestionEvidence[]>([]);
  const currentAccumulatorRef = useRef<QuestionSampleAccumulator>(
    createQuestionAccumulator(questionId, questionIndex)
  );
  const currentQuestionIdRef = useRef(questionId);
  const currentQuestionIndexRef = useRef(questionIndex);

  const thumbnailsRef = useRef<IVPEvidenceThumbnail[]>([]);

  // State exposed to React UI components (e.g. SessionStatusBar and IVPLivePanel)
  const [framesAnalyzed, setFramesAnalyzed] = useState(0);
  const [avgKernelMs, setAvgKernelMs] = useState(0);
  const [kernelCounts, setKernelCounts] = useState<IVPKernelCounts>({
    histogramEq: 0,
    otsuYCrCb: 0,
    sobel: 0,
    temporalMAD: 0,
    earMar: 0,
  });
  const [latestBuffers, setLatestBuffers] = useState<RunnerFrameResult['diagnosticBuffers'] | null>(null);
  const [latestThumbnails, setLatestThumbnails] = useState<IVPEvidenceThumbnail[]>([]);

  const samplingHz = isThrottled ? 2 : 4;
  const intervalMs = Math.round(1000 / samplingHz);

  // 1. Handle question transitions: finalize evidence for the previous question
  useEffect(() => {
    if (questionId !== currentQuestionIdRef.current) {
      if (currentAccumulatorRef.current.samples.length > 0) {
        const finalized = summarizeQuestionEvidence(currentAccumulatorRef.current);
        completedQuestionsRef.current.push(finalized);
      }
      currentQuestionIdRef.current = questionId;
      currentQuestionIndexRef.current = questionIndex;
      currentAccumulatorRef.current = createQuestionAccumulator(questionId, questionIndex);
    }
  }, [questionId, questionIndex]);

  // 2. Headless Classical CV Processing Loop (≤ 4 Hz on 160x120 canvas)
  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      // Per D12: Skip entirely if tab hidden, interview paused, or interviewer speaking
      if (isPaused || isTabPaused || isInterviewerSpeaking) return;

      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      const runner = runnerRef.current;
      if (!runner) return;

      try {
        const now = performance.now();
        if (sessionStartTsRef.current === 0) {
          sessionStartTsRef.current = now;
        }

        // Compute EAR & MAR blink rate and speech activity if signals are available
        let blinkRate: number | undefined;
        let isMouthActive: boolean | undefined;

        if (ear !== undefined && ear !== null) {
          const blinkRes = processBlinkDetection(ear, now, blinkStateRef.current);
          blinkStateRef.current = blinkRes.state;
          const rate = computeBlinkRate(blinkRes.state.blinkTimestamps, now, sessionStartTsRef.current);
          if (rate !== null) {
            blinkRate = rate;
          }
        }

        if (mar !== undefined && mar !== null) {
          marSlidingWindowRef.current.push({ timestamp: now, mar });
          marSlidingWindowRef.current = marSlidingWindowRef.current.filter((item) => now - item.timestamp <= 10000);
          const marVals = marSlidingWindowRef.current.map((item) => item.mar);
          const speechPct = computeSpeechActivity(marVals, 0.25);
          isMouthActive = speechPct !== null && speechPct > 15;
        }

        if ((ear !== undefined && ear !== null) || (mar !== undefined && mar !== null)) {
          runner.recordEarMarPass();
        }

        // Determine if we should capture a diagnostic thumbnail (e.g. once per question when frames count reaches 10)
        let captureThumbKind: 'equalized' | 'otsu' | 'sobel' | 'motion' | undefined;
        const currentFrames = currentAccumulatorRef.current.samples.length;
        if (currentFrames === 10 && thumbnailsRef.current.length < 6) {
          const kinds: Array<'equalized' | 'otsu' | 'sobel' | 'motion'> = ['otsu', 'sobel', 'motion', 'equalized'];
          captureThumbKind = kinds[thumbnailsRef.current.length % kinds.length];
        }

        const evidenceId = `IVP-Q${currentQuestionIndexRef.current + 1}`;

        // Execute 5 classical kernels sequentially
        const result = runner.executeFrame(video, {
          faceRoi,
          faceDetected,
          captureThumbKind,
          evidenceId,
          blinkRatePerMin: blinkRate,
          isMouthActive,
        });

        // Store sample in accumulator
        currentAccumulatorRef.current = addSampleToAccumulator(
          currentAccumulatorRef.current,
          result.stats
        );

        if (result.thumbnail) {
          thumbnailsRef.current = [...thumbnailsRef.current, result.thumbnail].slice(0, 6);
          setLatestThumbnails(thumbnailsRef.current);
        }

        // Update live status for UI (frame counters, buffers)
        setFramesAnalyzed(runner.getFramesAnalyzed());
        setAvgKernelMs(runner.getAvgKernelMs());
        setKernelCounts(runner.getKernelCounts());
        setLatestBuffers(result.diagnosticBuffers);
      } catch (err) {
        console.warn('[useIVPEvidenceRunner] Frame processing notice:', err);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [
    enabled,
    isPaused,
    isTabPaused,
    isThrottled,
    isInterviewerSpeaking,
    intervalMs,
    faceRoi,
    faceDetected,
    ear,
    mar,
    videoRef,
  ]);

  // 3. Compile finalized receipt on interview conclusion
  const getReceipt = useCallback(async (): Promise<IVPEvidenceReceipt> => {
    const runner = runnerRef.current;
    const allQuestions = [...completedQuestionsRef.current];

    // Include current question accumulator if it has samples
    if (currentAccumulatorRef.current.samples.length > 0) {
      allQuestions.push(summarizeQuestionEvidence(currentAccumulatorRef.current));
    }

    return compileEvidenceReceipt({
      samplingHz,
      framesAnalyzed: runner ? runner.getFramesAnalyzed() : 0,
      kernelCounts: runner ? runner.getKernelCounts() : {
        histogramEq: 0,
        otsuYCrCb: 0,
        sobel: 0,
        temporalMAD: 0,
        earMar: 0,
      },
      avgKernelMs: runner ? runner.getAvgKernelMs() : 0,
      perQuestion: allQuestions,
      thumbnails: thumbnailsRef.current,
      consumedByEvaluator: false,
      transmitted: true,
    });
  }, [samplingHz]);

  const reset = useCallback(() => {
    runnerRef.current?.reset();
    sessionStartTsRef.current = 0;
    marSlidingWindowRef.current = [];
    blinkStateRef.current = createInitialBlinkState();
    completedQuestionsRef.current = [];
    thumbnailsRef.current = [];
    currentAccumulatorRef.current = createQuestionAccumulator(questionId, questionIndex);
    setFramesAnalyzed(0);
    setAvgKernelMs(0);
    setLatestBuffers(null);
    setLatestThumbnails([]);
  }, [questionId, questionIndex]);

  const status = !enabled ? 'idle' : isPaused ? 'paused' : 'running';

  return {
    status,
    framesAnalyzed,
    samplingHz,
    avgKernelMs,
    kernelCounts,
    latestBuffers,
    latestThumbnails,
    getReceipt,
    reset,
  };
}
