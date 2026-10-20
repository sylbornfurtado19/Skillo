'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

import { useRouter } from 'next/navigation';

import {
  FaKeyboard,
  FaExclamationTriangle,
  FaChevronLeft,
  FaStepForward,
} from 'react-icons/fa';
import { INTERVIEWER_PERSONAS, submitInterviewAnswers, describeEvaluationFailure } from '../services/constants';
import { saveMockInterview, mapEvaluationToMockInterviewPayload } from '../services/interview';
import { useInterview } from '../context/InterviewContext';
import { useAuth } from '../hooks/useAuth';
import { getProfile } from '../services/profile';

import { getAuthToken } from '../services/auth';
import { useMediaReadiness } from '../hooks/useMediaReadiness';
import { splitIntoSentences, estimateNarrationMs, pickEnglishVoice } from '../lib/media/narration';
import SessionDeviceGate from '../components/interview/session/SessionDeviceGate';
import SessionPreflight from '../components/interview/session/SessionPreflight';
import SessionIntegrityOverlay from '../components/interview/session/SessionIntegrityOverlay';
import SessionStatusBar from '../components/interview/session/SessionStatusBar';
import IVPLivePanel from '../components/interview/session/IVPLivePanel';
import { useInterviewIntegrity } from '../hooks/useInterviewIntegrity';
import { useIVPEvidenceRunner } from '../hooks/useIVPEvidenceRunner';

import dynamic from 'next/dynamic';

import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';

import Badge from '../components/ui/Badge';
import IVPSyncTracker, { type IVPSyncTrackerHandle } from '../components/ui/IVPSyncTracker';
import { useInterviewCamera } from '../hooks/useInterviewCamera';
import { useIVPSessionPipeline } from '../hooks/useIVPSessionPipeline';
import IVPCameraPreview from '../components/ui/IVPCameraPreview';
import type { SystemDesignDiagramState } from '../types/systemDesign';
import { createInitialDiagramState, deserializeDiagram, serializeDiagram } from '../types/systemDesign';
import {
  AUTOSAVE_STORAGE_KEY_PREFIX,
  generateFallbackEvaluationReport,
  handleRetryEvaluationSuccess,
  handleRetryEvaluationFailure,
  buildFollowUpQuestion,
  resolveQuestionId,
} from '../components/interview/session/sessionHelpers';
import SessionGradingOverlay from '../components/interview/session/SessionGradingOverlay';
import SessionInterviewerCard from '../components/interview/session/SessionInterviewerCard';
import SessionAnswerWorkspace from '../components/interview/session/SessionAnswerWorkspace';
import CodeWorkspace from '../components/interview/CodeWorkspace';
import { INTERVIEW_MODE_PRESETS } from '../types/interviewModes';
import type { SyncWindowResult, InterviewQuestion, CodeAnswer } from '@/types/index';
import { analyzeSpeech, type RecognitionSegment, type SpeechAnalytics } from '@/lib/services/speechAnalytics';

const SessionBiometricHUDs = dynamic(
  () => import('../components/interview/session/SessionBiometricHUDs'),
  { ssr: false }
);

function getClientTreeDepth(node: any, currentDepth = 0): number {
  if (!node || !node.children || !Array.isArray(node.children) || node.children.length === 0) {
    return currentDepth;
  }
  return Math.max(...node.children.map((c: any) => getClientTreeDepth(c, currentDepth + 1)));
}

function getSafePreviousTreeState(treeState: any): any | undefined {
  if (!treeState || !treeState.rootNode) return undefined;

  const depth = getClientTreeDepth(treeState.rootNode);
  if (depth > 6) {
    return undefined;
  }

  try {
    const serialized = JSON.stringify(treeState);
    if (new TextEncoder().encode(serialized).length > 100 * 1024) {
      return undefined;
    }
  } catch {
    return undefined;
  }

  return treeState;
}

export default function InterviewSession() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const {
    resumeData,
    questions,
    setQuestions,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    answers,
    setAnswers,
    setupData,
    setResults,
    isRetry,
    setIsRetry,
    retryQuestionIndex,
    updateQuestionScore,
    pastCritiques,
    recalledMemoryNotice,
  } = useInterview();



  // Settings / Profile Voice Preferences
  const [voiceRate, setVoiceRate] = useState(1.0);
  const [voicePitch, setVoicePitch] = useState(1.0);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);

  // Fetch saved user voice settings on mount
  useEffect(() => {
    if (!user?.id) return;
    getProfile(user.id).then(({ data }) => {
      if (data?.profileSettings) {
        const ps = data.profileSettings;
        if (typeof ps.voiceRate === 'number') setVoiceRate(ps.voiceRate);
        if (typeof ps.voicePitch === 'number') setVoicePitch(ps.voicePitch);
        if (typeof ps.subtitlesEnabled === 'boolean') setSubtitlesEnabled(ps.subtitlesEnabled);
      }
    });
  }, [user?.id]);

  // Redirect to setup if no questions loaded
  useEffect(() => {
    if (!questions || questions.length === 0) {
      router.push('/setup');
    }
  }, [questions, router]);

  const persona = INTERVIEWER_PERSONAS[setupData.persona as keyof typeof INTERVIEWER_PERSONAS] || INTERVIEWER_PERSONAS.sarah;
  const currentQuestionRaw = questions[currentQuestionIndex];
  const currentQuestionText =
    typeof currentQuestionRaw === 'string'
      ? currentQuestionRaw
      : currentQuestionRaw?.question || '';
  const currentQuestion = {
    question: currentQuestionText,
    duration:
      typeof currentQuestionRaw === 'object' && typeof currentQuestionRaw?.duration === 'number'
        ? currentQuestionRaw.duration
        : 120,
    id:
      typeof currentQuestionRaw === 'object' && currentQuestionRaw?.id
        ? currentQuestionRaw.id
        : `q_${currentQuestionIndex + 1}`,
    hint:
      typeof currentQuestionRaw === 'object' && currentQuestionRaw?.hint
        ? currentQuestionRaw.hint
        : '',
    targetedWeakness: typeof currentQuestionRaw === 'object' ? currentQuestionRaw?.targetedWeakness : undefined,
    idealConcepts: typeof currentQuestionRaw === 'object' ? currentQuestionRaw?.idealConcepts : undefined,
  };

  // Local States
  const [responseMode, setResponseMode] = useState<'type' | 'speak'>('type');
  const [typedAnswer, setTypedAnswer] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [recording, setRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(currentQuestion.duration);
  const [interviewerSpeaking, setInterviewerSpeaking] = useState(() => {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  });
  const [grading, setGrading] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [spokenSentenceIndex, setSpokenSentenceIndex] = useState(0);
  const [micAudioLevel, setMicAudioLevel] = useState(0);

  // Real-time AI Follow-Up States
  const [checkingFollowUp, setCheckingFollowUp] = useState(false);
  const [followUpTrackedIndices] = useState<Set<number>>(() => new Set());
  const [followUpBadgeSet] = useState<Set<number>>(() => new Set());

  // Persistent LATS Tree State across Follow-Ups (Issue 1 & 2)
  const sessionKeyRef = useRef<string>(`session_${Date.now()}`);
  const latestTreeStateRef = useRef<any>(null);
  const skipFollowUpRef = useRef<(() => void) | null>(null);

  // Reset persistent tree when a new interview session begins
  useEffect(() => {
    if (currentQuestionIndex === 0 && answers.length === 0) {
      sessionKeyRef.current = `session_${Date.now()}`;
      latestTreeStateRef.current = null;
    }
  }, [currentQuestionIndex, answers.length]);

  // System Design Diagram state
  const isSystemDesignQuestion =
    setupData.type === 'System Design' ||
    currentQuestionText.toLowerCase().includes('system design') ||
    currentQuestionText.toLowerCase().includes('architecture');
  const isCodingMode =
    (setupData.interviewModeId ? INTERVIEW_MODE_PRESETS[setupData.interviewModeId]?.interviewType === 'Coding' : false) ||
    setupData.type === 'Coding';
  const [codeAnswer, setCodeAnswer] = useState<CodeAnswer>({
    language: 'javascript',
    source: '',
    stdout: '',
    stderr: '',
  });
  const [diagramState, setDiagramState] = useState<SystemDesignDiagramState>(() =>
    createInitialDiagramState()
  );



  // ── Authoritative Centralized Camera Management (REM-2) ──────────────
  // Camera AND microphone are mandatory: no silent video-only fallback, and the interview is
  // blocked (SessionDeviceGate) until both are live, and paused again if either drops out.
  const {
    stream: cameraStream,
    cameraErrorName,
    startCamera,
    stopCamera,
  } = useInterviewCamera({ autoStart: true, enableAudio: true, requireAudio: true });
  const { readiness: mediaReadiness, devicesReady } = useMediaReadiness(cameraStream);
  const [requestingDevices, setRequestingDevices] = useState(false);
  const hasBeenReadyRef = useRef(false);
  if (devicesReady) hasBeenReadyRef.current = true;

  const handleEnableDevices = useCallback(async () => {
    setRequestingDevices(true);
    try {
      await startCamera();
    } catch {
      // The hook exposes the failure through cameraErrorName; the gate explains what to do.
    } finally {
      setRequestingDevices(false);
    }
  }, [startCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Active question attribution context (REM-4).
  // Ids come from the question objects themselves (follow-ups get their own unique id), so
  // telemetry, speech analytics and the evaluation payload all agree after a follow-up is
  // inserted. Index-based ids are only a fallback for legacy string questions.
  const activeQuestionId = isRetry && retryQuestionIndex !== null
    ? resolveQuestionId(questions[retryQuestionIndex], retryQuestionIndex)
    : currentQuestion.id;
  const activeQuestionIndex = isRetry && retryQuestionIndex !== null
    ? retryQuestionIndex
    : currentQuestionIndex;
  const [preflightDone, setPreflightDone] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    return (
      (answers && answers.length > 0) ||
      currentQuestionIndex > 0 ||
      sessionStorage.getItem(`skillo_preflight_done_${sessionKeyRef.current}`) === 'true'
    );
  });

  // ── Proctored Interview Integrity Engine (O1, O2, O3, O7) ─────────────────
  const integrity = useInterviewIntegrity({
    sessionKey: sessionKeyRef.current,
    activeQuestionId,
    activeQuestionIndex,
    devicesReady,
    isExamActive: preflightDone && !grading,
    onPauseTriggered: () => {
      cancelSpeechNarration();
      if (recording && recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    },
    onResumeTriggered: () => {
      replayQuestion();
    },
  });

  // Mid-interview hardware disconnect detection (O3 / REM-2)
  useEffect(() => {
    if (preflightDone && hasBeenReadyRef.current && !devicesReady) {
      if (!mediaReadiness.cameraLive) {
        integrity.recordDevicePause('camera_off');
      } else if (!mediaReadiness.microphoneLive) {
        integrity.recordDevicePause('microphone_off');
      }
    }
  }, [preflightDone, devicesReady, mediaReadiness.cameraLive, mediaReadiness.microphoneLive, integrity]);

  // ── Unified Worker + ONNX Vision Pipeline (REM-3 / REM-4) ─────────────
  const {
    videoRef,
    liveGazeFrame,
    livePoseFrame,
    liveAffectFrame,
    gazeEyeContactPct,
    gazeFrameCount,
    showGazeWarning,
    latestGestureToast,
    isVisionReady,
    isONNXReady,
    isThrottled,
    lastEar,
    lastMar,
    faceBox,
    clearPerQuestionFrames,
    getCapturedTelemetry,
  } = useIVPSessionPipeline({
    mediaStream: cameraStream,
    isSpeaking: interviewerSpeaking,
    questionId: activeQuestionId,
    questionIndex: activeQuestionIndex,
    paused: integrity.isPaused,
  });

  // ── Dedicated Headless Classical IVP Engine Runner (O4 / O5) ───────────
  const ivpRunner = useIVPEvidenceRunner({
    videoRef,
    questionId: activeQuestionId,
    questionIndex: activeQuestionIndex,
    isPaused: integrity.isPaused,
    isTabPaused: false,
    isThrottled,
    isInterviewerSpeaking: interviewerSpeaking,
    faceRoi: faceBox
      ? {
          x: faceBox.x,
          y: faceBox.y,
          width: faceBox.width,
          height: faceBox.height,
        }
      : null,
    ear: lastEar,
    mar: lastMar,
    enabled: preflightDone && !grading,
  });

  // Reset per-question vision metrics on question change
  useEffect(() => {
    clearPerQuestionFrames();
  }, [currentQuestionIndex, clearPerQuestionFrames]);

  // ── SyncNet Audio-Visual Lip-Sync Tracker state ─────────────────────
  const syncTrackerRef = useRef<IVPSyncTrackerHandle | null>(null);
  const [liveSyncWindow, setLiveSyncWindow] = useState<SyncWindowResult | null>(null);

  const handleSyncWindow = useCallback((result: SyncWindowResult) => {
    setLiveSyncWindow(result);
  }, []);

  // SyncTracker lifecycle tied to authoritative cameraStream and narration state
  useEffect(() => {
    if (!interviewerSpeaking && cameraStream) {
      syncTrackerRef.current?.start(cameraStream).catch(() => {});
    } else if (interviewerSpeaking) {
      syncTrackerRef.current?.stop();
    }
  }, [interviewerSpeaking, cameraStream]);






  // Web Speech Synthesis Utterance Ref (keeps the active utterance referenced so it is not GC'd)
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  // Bumped to invalidate in-flight narration callbacks (skip, replay, question change)
  const narrationRunRef = useRef(0);
  const [narrationNonce, setNarrationNonce] = useState(0);
  const [narrationBlocked, setNarrationBlocked] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(true);

  // Cancel any ongoing speech narration
  const cancelSpeechNarration = useCallback(() => {
    narrationRunRef.current += 1;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setInterviewerSpeaking(false);
  }, []);

  // Read the current question aloud again (also the fallback when the browser blocks autoplay)
  const replayQuestion = useCallback(() => {
    setNarrationBlocked(false);
    setNarrationNonce((n) => n + 1);
  }, []);

  // Sentences used both for the spoken chunks and the animated subtitle highlighting
  const questionSentences = splitIntoSentences(currentQuestionText);

  // Speech Synthesis Narration Effect: the computer reads each question aloud.
  // Waits until camera + microphone are on, speaks sentence by sentence (long utterances stall in
  // Chrome), and has a watchdog so a silent speech engine can never freeze the interview.
  useEffect(() => {
    if (!devicesReady || !preflightDone || integrity.isPaused) {
      narrationRunRef.current += 1;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return;
    }

    const runId = ++narrationRunRef.current;
    const isStale = () => narrationRunRef.current !== runId;
    setSpokenSentenceIndex(0);
    setNarrationBlocked(false);

    const synth =
      typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
      // No voice playback in this browser: show the question and proceed after a short read time
      setTtsSupported(false);
      setInterviewerSpeaking(true);
      const fallbackTimer = setTimeout(() => {
        if (!isStale()) setInterviewerSpeaking(false);
      }, 3500);
      return () => clearTimeout(fallbackTimer);
    }

    setTtsSupported(true);
    setInterviewerSpeaking(true);
    synth.cancel();

    const sentences = splitIntoSentences(currentQuestionText);
    const voice = pickEnglishVoice(synth.getVoices());
    let started = false;
    let finished = false;
    let watchdog: ReturnType<typeof setTimeout> | null = null;

    const finish = (blocked: boolean) => {
      if (finished || isStale()) return;
      finished = true;
      if (watchdog) clearTimeout(watchdog);
      if (blocked) setNarrationBlocked(true);
      setInterviewerSpeaking(false);
    };

    const speakAt = (index: number) => {
      if (isStale() || finished) return;
      if (index >= sentences.length) {
        finish(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(sentences[index]);
      utterance.rate = voiceRate;
      utterance.pitch = voicePitch;
      utterance.lang = voice?.lang || 'en-US';
      if (voice) utterance.voice = voice;

      utterance.onstart = () => {
        if (isStale()) return;
        started = true;
        setSpokenSentenceIndex(index);
      };
      utterance.onend = () => speakAt(index + 1);
      utterance.onerror = (event) => {
        if (isStale()) return;
        const reason = (event as SpeechSynthesisErrorEvent).error;
        if (reason === 'interrupted' || reason === 'canceled') return;
        console.warn('Speech synthesis error:', reason);
        // 'not-allowed' means the browser blocked autoplay: offer a click-to-hear button
        finish(reason === 'not-allowed');
      };

      activeUtteranceRef.current = utterance;
      synth.speak(utterance);
    };

    speakAt(0);

    watchdog = setTimeout(
      () => finish(!started),
      estimateNarrationMs(currentQuestionText, voiceRate) + 4000
    );

    return () => {
      narrationRunRef.current += 1;
      if (watchdog) clearTimeout(watchdog);
      synth.cancel();
    };
  }, [
    currentQuestionIndex,
    currentQuestionText,
    voiceRate,
    voicePitch,
    devicesReady,
    preflightDone,
    integrity.isPaused,
    narrationNonce,
  ]);

  // Restore autosaved draft for the current question index
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedDraft = sessionStorage.getItem(`${AUTOSAVE_STORAGE_KEY_PREFIX}${currentQuestionIndex}`);
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          if (parsed.mode) setResponseMode(parsed.mode);
          if (parsed.typedAnswer) setTypedAnswer(parsed.typedAnswer);
          if (parsed.transcriptText) setTranscriptText(parsed.transcriptText);
          if (parsed.diagram) setDiagramState(deserializeDiagram(parsed.diagram));
        } else {
          setDiagramState(createInitialDiagramState());
        }

      } catch (err) {
        console.warn('Failed to restore draft answer:', err);
      }
    }
  }, [currentQuestionIndex, currentQuestion.id]);

  // Debounced Autosave
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const timer = setTimeout(() => {
      if (typedAnswer || transcriptText || (diagramState && diagramState.nodes.length > 0)) {
        try {
          sessionStorage.setItem(
            `${AUTOSAVE_STORAGE_KEY_PREFIX}${currentQuestionIndex}`,
            JSON.stringify({
              mode: responseMode,
              typedAnswer,
              transcriptText,
              diagram: isSystemDesignQuestion ? serializeDiagram(diagramState) : undefined,
            })
          );
        } catch (err) {
          console.warn('Failed to autosave draft answer:', err);
        }
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [typedAnswer, transcriptText, responseMode, currentQuestionIndex, diagramState, isSystemDesignQuestion]);

  // Web Speech API recognition ref
  const recognitionRef = useRef<any>(null);
  const speechSegmentsRef = useRef<RecognitionSegment[]>([]);
  const processedSpeechResultIndicesRef = useRef<Set<number>>(new Set());
  const answerStartedAtRef = useRef<number | null>(null);
  const lastSpeechResultMsRef = useRef(0);
  const speechAnalyticsRef = useRef<Record<string, SpeechAnalytics>>({});
  const [, setSpeechAnalyticsByQuestion] = useState<Record<string, SpeechAnalytics>>({});

  const finalizeSpeechAnalytics = useCallback((questionId: string) => {
    if (speechSegmentsRef.current.length === 0) {
      return speechAnalyticsRef.current;
    }

    const analytics = analyzeSpeech(speechSegmentsRef.current);
    speechAnalyticsRef.current = {
      ...speechAnalyticsRef.current,
      [questionId]: analytics,
    };
    setSpeechAnalyticsByQuestion(speechAnalyticsRef.current);
    return speechAnalyticsRef.current;
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        setIsSpeechSupported(true);
        const rec = new SpeechRecognitionClass();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';

        rec.onresult = (event: any) => {
          let currentText = '';
          for (let i = 0; i < event.results.length; ++i) {
            currentText += event.results[i][0].transcript;
            if (event.results[i].isFinal && !processedSpeechResultIndicesRef.current.has(i)) {
              processedSpeechResultIndicesRef.current.add(i);
              const text = event.results[i][0].transcript.trim();
              const nowMs = answerStartedAtRef.current === null
                ? 0
                : Math.max(0, Date.now() - answerStartedAtRef.current);
              if (text) {
                const startMs = speechSegmentsRef.current.length > 0
                  ? lastSpeechResultMsRef.current
                  : 0;
                const endMs = Math.max(startMs, nowMs);
                speechSegmentsRef.current.push({ text, startMs, endMs });
                lastSpeechResultMsRef.current = endMs;
              }
            }
          }
          setTranscriptText(currentText);
        };

        rec.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          if (event.error === 'not-allowed') {
            showToast('Microphone access denied. Please verify input permissions in browser settings.', 'error');
          }
        };

        rec.onend = () => {
          setRecording(false);
        };

        recognitionRef.current = rec;
      } else {
        setResponseMode('type');
        showToast('Speech recognition is unavailable in this browser. Text Editor mode remains available.', 'info');
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Silently ignore
        }
      }
    };
  }, [showToast, setResponseMode]);

  // ── Unified Submission & Evaluation Finalizer (T6 Refactor) ─────────────
  // Collapses the 3 duplicated submit paths (handleNextQuestion final branch,
  // handleConfirmSkip final branch, and retry branch) into a single authoritative handler.
  // Attaches client-measured IVP Evidence receipt and Session Integrity report.
  const finalizeAndSubmit = useCallback(
    async (options: {
      isRetrySubmit?: boolean;
      overrideQuestions?: (string | InterviewQuestion)[];
      overrideAnswers?: any[];
      speechAnalytics?: Record<string, SpeechAnalytics>;
    } = {}) => {
      setGrading(true);
      cancelSpeechNarration();
      if (recording && recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error(e);
        }
      }

      const { capturedGazeFrames, capturedPoseFrames, capturedAffectFrames } = getCapturedTelemetry();
      const capturedSyncWindows = syncTrackerRef.current?.getFrames() ?? [];
      syncTrackerRef.current?.stop();
      stopCamera();

      // Retrieve evidence receipt and integrity report
      let ivpEvidence = undefined;
      try {
        ivpEvidence = await ivpRunner.getReceipt();
      } catch (err) {
        console.warn('[InterviewSession] Failed to compile IVP evidence receipt:', err);
      }
      const sessionIntegrity = integrity.getReport();

      if (options.isRetrySubmit && retryQuestionIndex !== null) {
        const retryQuestionId = currentQuestion.id || activeQuestionId;
        const retryTelemetry = getCapturedTelemetry(activeQuestionId);
        const retrySyncWindows = capturedSyncWindows.filter(
          (w) => w.questionId === activeQuestionId || w.questionId === retryQuestionId
        );
        const retryIvpEvidence = ivpEvidence
          ? {
              ...ivpEvidence,
              perQuestion: ivpEvidence.perQuestion.filter(
                (q) => q.questionId === activeQuestionId || q.questionId === retryQuestionId
              ),
            }
          : undefined;

        const finalAnswer = responseMode === 'type' ? typedAnswer : transcriptText;
        submitInterviewAnswers(
          setupData,
          [{
            id: retryQuestionId,
            question: currentQuestion.question,
            hint: currentQuestion.hint,
            duration: currentQuestion.duration,
            idealConcepts: currentQuestion.idealConcepts,
            targetedWeakness: currentQuestion.targetedWeakness,
          }],
          [{ answerText: finalAnswer || 'No response provided.' }],
          undefined,
          retryTelemetry.capturedGazeFrames,
          retryTelemetry.capturedPoseFrames,
          retryTelemetry.capturedAffectFrames,
          retrySyncWindows,
          isCodingMode ? codeAnswer : undefined,
          options.speechAnalytics,
          retryIvpEvidence,
          sessionIntegrity
        )
          .then((finalReport) => {
            const enriched = {
              ...finalReport,
              ivpEvidence: retryIvpEvidence ?? finalReport.ivpEvidence,
              sessionIntegrity: sessionIntegrity ?? finalReport.sessionIntegrity,
            };
            const { newScore, feedback } = handleRetryEvaluationSuccess(enriched);
            updateQuestionScore(retryQuestionIndex, finalAnswer || 'No response provided.', newScore, feedback);
            setIsRetry(false);
            setGrading(false);
            router.push('/results');
          })
          .catch((err) => {
            console.warn('[InterviewSession] Retry evaluation error, keeping previous score:', err);
            const failure = handleRetryEvaluationFailure(err);
            showToast(failure.toastMessage, failure.toastType);
            setGrading(failure.grading);
          });
        return;
      }

      const questionsToSubmit = (options.overrideQuestions || questions).map((q, idx) => {
        if (typeof q === 'object' && q !== null) {
          return {
            id: q.id || `q_${idx + 1}`,
            question: q.question,
            hint: q.hint,
            duration: q.duration,
            idealConcepts: q.idealConcepts,
            targetedWeakness: q.targetedWeakness,
          };
        }
        return { id: `q_${idx + 1}`, question: q };
      });

      const answersToSubmit = options.overrideAnswers || answers;

      submitInterviewAnswers(
        setupData,
        questionsToSubmit,
        answersToSubmit,
        undefined,
        capturedGazeFrames,
        capturedPoseFrames,
        capturedAffectFrames,
        capturedSyncWindows,
        isCodingMode ? codeAnswer : undefined,
        options.speechAnalytics,
        ivpEvidence,
        sessionIntegrity
      )
        .then((finalReport) => {
          // Attach client-computed evidence and integrity report (D5)
          const enrichedReport = {
            ...finalReport,
            ivpEvidence: ivpEvidence ?? finalReport.ivpEvidence,
            sessionIntegrity: sessionIntegrity ?? finalReport.sessionIntegrity,
          };
          setResults(enrichedReport);

          const authUserId = user?.id || enrichedReport.userId;
          if (authUserId) {
            const effectiveSetup = {
              ...setupData,
              ...(diagramState?.nodes?.length ? { systemDesignDiagram: diagramState } : {}),
            };
            const payload = mapEvaluationToMockInterviewPayload(enrichedReport, effectiveSetup);
            saveMockInterview(authUserId, payload).catch((err) => {
              console.warn('[InterviewSession] Failed to persist mock interview to Firebase:', err);
            });

          }
          setGrading(false);
          router.push('/results');
        })
        .catch((err) => {
          console.warn('[InterviewSession] Server evaluation failed, using resilient offline fallback:', err);
          const failure = describeEvaluationFailure(err);
          showToast(failure.toast, 'info');
          const fallback = generateFallbackEvaluationReport(
            setupData,
            questionsToSubmit,
            answersToSubmit,
            undefined,
            failure.reason
          );
          const enrichedFallback = {
            ...fallback,
            ivpEvidence: ivpEvidence
              ? { ...ivpEvidence, consumedByEvaluator: false, transmitted: false }
              : undefined,
            sessionIntegrity: sessionIntegrity ?? undefined,
          };
          setResults(enrichedFallback);
          setGrading(false);
          router.push('/results');
        });
    },
    [
      cancelSpeechNarration,
      recording,
      getCapturedTelemetry,
      stopCamera,
      ivpRunner,
      integrity,
      retryQuestionIndex,
      responseMode,
      typedAnswer,
      transcriptText,
      setupData,
      currentQuestion,
      activeQuestionId,
      isCodingMode,
      codeAnswer,
      setIsRetry,
      updateQuestionScore,
      router,
      showToast,
      questions,
      answers,
      user?.id,
      diagramState,
      setResults,
    ]
  );

  const handleNextQuestion = useCallback(() => {
    cancelSpeechNarration();

    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(`${AUTOSAVE_STORAGE_KEY_PREFIX}${currentQuestionIndex}`);
      } catch (err) {
        console.warn('Failed to clear draft answer:', err);
      }
    }

    setConfirmSkip(false);
    if (recording && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error(e);
      }
    }

    const finalAnswer = responseMode === 'type' ? typedAnswer : transcriptText;
    const currentSpeechAnalytics = finalizeSpeechAnalytics(currentQuestion.id);
    speechSegmentsRef.current = [];
    answerStartedAtRef.current = null;
    lastSpeechResultMsRef.current = 0;
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = {
      answerText: finalAnswer || 'No response provided.',
    };
    setAnswers(newAnswers);

    setTypedAnswer('');
    setTranscriptText('');
    setRecording(false);
    setInterviewerSpeaking(true);
    setShowHint(false);

    // Helper to perform normal question progression
    const proceedToNext = (
      updatedQuestions: (string | InterviewQuestion)[],
      updatedAnswers: any[],
      analyticsByQuestion: Record<string, SpeechAnalytics>
    ) => {
      setCheckingFollowUp(false);
      if (currentQuestionIndex + 1 < updatedQuestions.length) {
        const nextIndex = currentQuestionIndex + 1;
        const nextAnswerObj = updatedAnswers[nextIndex];
        const nextAnswer = typeof nextAnswerObj === 'string' ? nextAnswerObj : nextAnswerObj?.answerText ?? '';
        if (responseMode === 'type') {
          setTypedAnswer(nextAnswer);
        } else {
          setTranscriptText(nextAnswer);
        }
        setCurrentQuestionIndex(nextIndex);
      } else {
        finalizeAndSubmit({
          overrideQuestions: updatedQuestions,
          overrideAnswers: updatedAnswers,
          speechAnalytics: analyticsByQuestion,
        });
      }
    };

    if (isRetry && retryQuestionIndex !== null) {
      finalizeAndSubmit({
        isRetrySubmit: true,
        speechAnalytics: currentSpeechAnalytics,
      });
      return;
    }

    // Check if this question index has ALREADY been followed up (Cap at 1 follow-up per question)
    if (!followUpTrackedIndices.has(currentQuestionIndex) && finalAnswer.trim().length > 0) {
      followUpTrackedIndices.add(currentQuestionIndex);
      setCheckingFollowUp(true);

      let isCancelled = false;
      skipFollowUpRef.current = () => {
        if (isCancelled) return;
        isCancelled = true;
        setCheckingFollowUp(false);
        skipFollowUpRef.current = null;
        proceedToNext(questions, newAnswers, currentSpeechAnalytics);
      };

      // 12-second timeout promise protection to allow K MCTS rounds while ensuring bounded pacing
      const timeoutPromise = new Promise<{ needsFollowUp: false }>((resolve) =>
        setTimeout(() => resolve({ needsFollowUp: false }), 12000)
      );

      const fetchPromise = (async () => {
        try {
          const token = await getAuthToken();
          const safePreviousTree = getSafePreviousTreeState(latestTreeStateRef.current);
          const res = await fetch('/api/interview/followup', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              // Clip to the route's limits so a long transcript can't turn into a 400
              question: currentQuestionText.slice(0, 1000),
              answerText: finalAnswer.slice(0, 10000),
              role: setupData.role,
              difficulty: setupData.experienceLevel,
              type: setupData.type,
              sessionId: sessionKeyRef.current,
              ...(safePreviousTree ? { previousTreeState: safePreviousTree } : {}),
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.treeState) {
              latestTreeStateRef.current = data.treeState;
            }
            return data;
          }
        } catch (e) {
          console.warn('Follow-up check error:', e);
        }
        return { needsFollowUp: false };
      })();

      Promise.race([fetchPromise, timeoutPromise]).then((data) => {
        if (isCancelled) return;
        skipFollowUpRef.current = null;
        const followUpText = data?.followUpQuestion || data?.selectedBranch?.questionText;
        if (data && data.needsFollowUp && followUpText) {
          const newQuestionsList = [...questions];
          const insertIdx = currentQuestionIndex + 1;
          // Follow-ups are real question objects with their own unique id (not index-derived),
          // so ids stay stable when later questions shift by one position.
          newQuestionsList.splice(
            insertIdx,
            0,
            buildFollowUpQuestion({ id: currentQuestion.id, duration: currentQuestion.duration }, followUpText)
          );
          followUpBadgeSet.add(insertIdx);
          followUpTrackedIndices.add(insertIdx); // Prevent nested follow-up on the follow-up question itself

          setQuestions(newQuestionsList);
          setCheckingFollowUp(false);
          setTypedAnswer('');
          setTranscriptText('');
          setRecording(false);
          setInterviewerSpeaking(true);
          setShowHint(false);
          setCurrentQuestionIndex(insertIdx);
        } else {
          proceedToNext(questions, newAnswers, currentSpeechAnalytics);
        }
      });
    } else {
      proceedToNext(questions, newAnswers, currentSpeechAnalytics);
    }


  }, [
    recording,
    responseMode,
    typedAnswer,
    transcriptText,
    answers,
    currentQuestionIndex,
    questions,
    setAnswers,
    setCurrentQuestionIndex,
    setupData,
    setResults,
    router,
    cancelSpeechNarration,
    codeAnswer,
    isCodingMode,
    currentQuestion.id,
    currentQuestion.question,
    currentQuestion.hint,
    currentQuestion.duration,
    currentQuestion.idealConcepts,
    currentQuestion.targetedWeakness,
    currentQuestionText,
    activeQuestionId,
    isRetry,
    retryQuestionIndex,
    diagramState,
    user?.id,
    showToast,
    getCapturedTelemetry,
    stopCamera,
    updateQuestionScore,
    setQuestions,
    setIsRetry,
    followUpBadgeSet,
    followUpTrackedIndices,
    finalizeSpeechAnalytics,
  ]);

  // Question countdown timer.
  // handleNextQuestion changes identity on every keystroke / interim transcript update, so it is
  // read through a ref: the timer must not restart (and the limit must not be pushed back) while
  // the candidate is typing or speaking. It is deadline-based, and the expiry side effect runs
  // outside any state updater so it fires exactly once (also under React Strict Mode).
  const handleNextQuestionRef = useRef(handleNextQuestion);
  useEffect(() => {
    handleNextQuestionRef.current = handleNextQuestion;
  }, [handleNextQuestion]);

  useEffect(() => {
    // Never run the clock unless preflight is complete, question has been read, devices are live, and not paused
    if (
      !preflightDone ||
      interviewerSpeaking ||
      checkingFollowUp ||
      grading ||
      !devicesReady ||
      integrity.isPaused
    ) {
      return;
    }

    const durationSec = currentQuestion.duration;
    let currentRemaining = integrity.getQuestionRemainingSec(activeQuestionId, durationSec);
    if (currentRemaining <= 0) {
      currentRemaining = integrity.startQuestionClock(activeQuestionId, durationSec);
    }
    setTimeLeft(currentRemaining);

    let fired = false;
    const deadline = Date.now() + currentRemaining * 1000;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      integrity.saveCurrentQuestionRemainingSec(activeQuestionId, remaining);
      if (remaining <= 0 && !fired) {
        fired = true;
        clearInterval(timer);
        handleNextQuestionRef.current();
      }
    }, 250);

    return () => clearInterval(timer);
  }, [
    preflightDone,
    currentQuestionIndex,
    activeQuestionId,
    interviewerSpeaking,
    checkingFollowUp,
    grading,
    devicesReady,
    integrity.isPaused,
    currentQuestion.duration,
  ]);

  // Unsaved Content Navigation Guard (Tab close / refresh)
  const activeAnswerContent = responseMode === 'type' ? typedAnswer : transcriptText;
  const hasUnsavedContent = activeAnswerContent.trim().length > 0 && !grading;

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedContent) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedContent]);

  const handleConfirmSkip = useCallback(() => {
    cancelSpeechNarration();

    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(`${AUTOSAVE_STORAGE_KEY_PREFIX}${currentQuestionIndex}`);
      } catch (err) {
        console.warn('Failed to clear draft answer:', err);
      }
    }

    setConfirmSkip(false);

    if (recording && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error(e);
      }
    }

    const currentSpeechAnalytics = finalizeSpeechAnalytics(currentQuestion.id);
    speechSegmentsRef.current = [];
    answerStartedAtRef.current = null;
    lastSpeechResultMsRef.current = 0;
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = { answerText: '[Skipped]' };
    setAnswers(newAnswers);

    setTypedAnswer('');
    setTranscriptText('');
    setRecording(false);
    setInterviewerSpeaking(true);
    setShowHint(false);

    if (currentQuestionIndex + 1 < questions.length) {
      const nextIndex = currentQuestionIndex + 1;
      const nextAnswerObj = newAnswers[nextIndex];
      const nextAnswer = typeof nextAnswerObj === 'string' ? nextAnswerObj : nextAnswerObj?.answerText ?? '';
      if (responseMode === 'type') {
        setTypedAnswer(nextAnswer);
      } else {
        setTranscriptText(nextAnswer);
      }
      setCurrentQuestionIndex(nextIndex);
    } else {
      finalizeAndSubmit({
        overrideQuestions: questions,
        overrideAnswers: newAnswers,
        speechAnalytics: currentSpeechAnalytics,
      });
    }
  }, [
    cancelSpeechNarration,
    currentQuestionIndex,
    recording,
    finalizeSpeechAnalytics,
    currentQuestion.id,
    answers,
    questions,
    responseMode,
    finalizeAndSubmit,
    setAnswers,
    setCurrentQuestionIndex,
  ]);

  const handlePrevQuestion = () => {
    cancelSpeechNarration();
    setConfirmSkip(false);

    if (recording && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error(e);
      }
    }

    const finalAnswer = responseMode === 'type' ? typedAnswer : transcriptText;
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = { answerText: finalAnswer || 'No response provided.' };
    setAnswers(newAnswers);

    setShowHint(false);

    if (currentQuestionIndex > 0) {
      const prevIndex = currentQuestionIndex - 1;
      const prevAnswerObj = newAnswers[prevIndex];
      const prevAnswer = typeof prevAnswerObj === 'string' ? prevAnswerObj : prevAnswerObj?.answerText ?? '';
      if (responseMode === 'type') {
        setTypedAnswer(prevAnswer);
      } else {
        setTranscriptText(prevAnswer);
      }
      setRecording(false);
      setInterviewerSpeaking(true);
      setCurrentQuestionIndex(prevIndex);
    }
  };

  const handleToggleRecord = () => {
    if (!isSpeechSupported) {
      showToast('Web Speech API is not supported in this browser. Please try Google Chrome or Microsoft Edge.', 'info');
      return;
    }

    if (recording) {
      setRecording(false);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error(e);
        }
      }
    } else {
      setTranscriptText('');
      speechSegmentsRef.current = [];
      processedSpeechResultIndicesRef.current.clear();
      answerStartedAtRef.current = Date.now();
      lastSpeechResultMsRef.current = 0;
      setRecording(true);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error(e);
        }
      }
    }
  };

  const activeAnswer = responseMode === 'type' ? typedAnswer : transcriptText;
  const wordCount = activeAnswer ? activeAnswer.trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = activeAnswer ? activeAnswer.length : 0;

  const focusAreasList =
    setupData.type === 'Technical'
      ? [setupData.role, 'Performance', 'Logical Scope', 'Complexity']
      : ['STAR Method', 'Leadership', 'Execution', 'Trade-offs'];

  if (!resumeData) {
    return (
      <div className="glass-card rounded-2xl p-8 border border-danger/30 bg-danger/5 text-center max-w-md mx-auto mt-12 space-y-6">
        <div className="h-12 w-12 rounded-full bg-danger/10 border border-danger/20 flex items-center justify-center text-danger text-xl mx-auto">
          <FaExclamationTriangle />
        </div>
        <h3 className="text-lg font-heading font-bold text-text-primary">Resume Required</h3>
        <p className="text-xs text-text-secondary leading-relaxed">
          You must upload your resume and specify job details before you can start active mock interviews.
        </p>
        <Button onClick={() => router.push('/resume')} variant="primary" size="md">
          Go to Upload Page
        </Button>
      </div>
    );
  }

  if (checkingFollowUp) {
    return (
      <div className="bg-bg-surface rounded-2xl p-8 border border-warning/30 shadow-soft flex flex-col items-center justify-center min-h-[320px] text-center max-w-lg mx-auto mt-16 space-y-4">
        <div className="flex space-x-2">
          <div className="h-3 w-3 bg-warning rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="h-3 w-3 bg-warning rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="h-3 w-3 bg-warning rounded-full animate-bounce" />
        </div>
        <h3 className="text-base font-heading font-bold text-text-primary">Reviewing your answer...</h3>
        <p className="text-xs text-text-secondary font-mono">Real-time AI checking for depth and technical specificity...</p>
        <Button
          onClick={() => {
            if (skipFollowUpRef.current) {
              skipFollowUpRef.current();
            } else {
              setCheckingFollowUp(false);
            }
          }}
          variant="secondary"
          size="sm"
          className="mt-4"
        >
          Skip Follow-up & Proceed
        </Button>
      </div>
    );
  }

  if (grading) {
    return <SessionGradingOverlay />;
  }

  // Bare minimum to run an interview: camera AND microphone on (G1, G2)
  if (!devicesReady && !hasBeenReadyRef.current) {
    return (
      <SessionDeviceGate
        readiness={mediaReadiness}
        errorName={cameraErrorName}
        requesting={requestingDevices}
        interrupted={false}
        onEnable={handleEnableDevices}
        onBack={() => router.push('/setup')}
      />
    );
  }

  // Preflight Gate: Enforces Camera AND Microphone permission before interview begins (O1, D8, D9, D14)
  if (!preflightDone) {
    return (
      <SessionPreflight
        readiness={mediaReadiness}
        errorName={cameraErrorName}
        requesting={requestingDevices}
        cameraStream={cameraStream}
        onEnableDevices={handleEnableDevices}
        onBeginInterview={() => {
          setPreflightDone(true);
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem(`skillo_preflight_done_${sessionKeyRef.current}`, 'true');
            } catch {}
          }
        }}
        onBack={() => router.push('/setup')}
      />
    );
  }

  const isFallbackSession =
    (typeof currentQuestionRaw === 'object' && (currentQuestionRaw as any)?.source === 'fallback') ||
    (setupData as any)?.source === 'fallback';

  return (
    <div className="max-w-6xl mx-auto pb-12 text-left space-y-4 relative" data-testid="interview-session-container">
      {/* Integrity Pause Overlay (D13: mounted on top so camera video element never unmounts) */}
      {integrity.isPaused && (
        <SessionIntegrityOverlay
          reason={integrity.pauseReason}
          devicesReady={devicesReady}
          onEnableDevices={handleEnableDevices}
          onResume={() => {
            integrity.resumeInterview();
          }}
        />
      )}

      {/* Persistent Session Status Bar (O4) */}
      <SessionStatusBar
        cameraActive={mediaReadiness.cameraLive}
        micActive={mediaReadiness.microphoneLive}
        audioLevel={micAudioLevel}
        ivpStatus={integrity.isPaused ? 'paused' : ivpRunner.status === 'running' ? 'active' : 'paused'}
        framesAnalyzed={ivpRunner.framesAnalyzed}
        samplingHz={ivpRunner.samplingHz}
        integrityFlagsCount={
          integrity.report.totals.tabSwitches +
          integrity.report.totals.fullscreenExits +
          integrity.report.totals.copyPasteAttempts +
          integrity.report.totals.screenshotKeyAttempts +
          integrity.report.totals.reloads
        }
        currentQuestionIndex={currentQuestionIndex}
        totalQuestions={questions.length}
        timeLeftSec={timeLeft}
      />

      {isFallbackSession && (
        <div className="flex items-center justify-center">
          <Badge variant="warning" size="md" className="flex items-center gap-1.5 px-3 py-1 text-xs">
            <FaExclamationTriangle className="text-warning text-xs" aria-hidden="true" />
            <span>Offline estimate, not a live AI evaluation</span>
          </Badge>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Column: Interviewer + Question prompt on top, Candidate Answer Workspace below */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          <SessionInterviewerCard
            className="w-full"
            persona={persona}
            interviewerSpeaking={interviewerSpeaking}
            followUpBadgeSet={followUpBadgeSet}
            currentQuestionIndex={currentQuestionIndex}
            pastCritiques={pastCritiques}
            recalledMemoryNotice={recalledMemoryNotice}
            cancelSpeechNarration={cancelSpeechNarration}
            voiceRate={voiceRate}
            subtitlesEnabled={subtitlesEnabled}
            questionSentences={questionSentences}
            spokenSentenceIndex={spokenSentenceIndex}
            currentQuestion={currentQuestion}
            showHint={showHint}
            setShowHint={setShowHint}
            focusAreasList={focusAreasList}
            setupData={setupData}
            isFallback={isFallbackSession}
            onReplayQuestion={replayQuestion}
            narrationBlocked={narrationBlocked}
            ttsSupported={ttsSupported}
          />

          <SessionAnswerWorkspace
            className="w-full"
            isRetry={isRetry}
            currentQuestionIndex={currentQuestionIndex}
            totalQuestions={questions.length}
            responseMode={responseMode}
            setResponseMode={setResponseMode}
            typedAnswer={typedAnswer}
            setTypedAnswer={setTypedAnswer}
            transcriptText={transcriptText}
            setTranscriptText={setTranscriptText}
            recording={recording}
            setRecording={setRecording}
            interviewerSpeaking={interviewerSpeaking}
            timeLeft={timeLeft}
            currentQuestionDuration={currentQuestion.duration}
            isSpeechSupported={isSpeechSupported}
            handleToggleRecord={handleToggleRecord}
            wordCount={wordCount}
            charCount={charCount}
            confirmSkip={confirmSkip}
            setConfirmSkip={setConfirmSkip}
            handlePrevQuestion={handlePrevQuestion}
            handleConfirmSkip={handleConfirmSkip}
            handleNextQuestion={handleNextQuestion}
            activeAnswer={activeAnswer}
            isSystemDesignQuestion={isSystemDesignQuestion}
            diagramState={diagramState}
            setDiagramState={setDiagramState}
          />

          {isCodingMode && (
            <div className="w-full">
              <CodeWorkspace value={codeAnswer} onChange={setCodeAnswer} />
            </div>
          )}
        </div>

        {/* Right Rail: Surveillance & Classical IVP Engine Panel */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4" data-testid="interview-surveillance-rail">
          {/* Biometric HUDs (Lazy-loaded with ssr: false) */}
          <SessionBiometricHUDs
            liveGazeFrame={liveGazeFrame}
            gazeEyeContactPct={gazeEyeContactPct}
            showGazeWarning={showGazeWarning}
            livePoseFrame={livePoseFrame}
            latestGestureToast={latestGestureToast}
            liveAffectFrame={liveAffectFrame}
            liveSyncWindow={liveSyncWindow}
          />

          {/* Modern Unified Vision Worker + ONNX Camera HUD (REM-3) */}
          <IVPCameraPreview
            videoRef={videoRef}
            mediaStream={cameraStream}
            gazeResult={liveGazeFrame}
            poseResult={livePoseFrame}
            isVisionReady={isVisionReady}
            isONNXReady={isONNXReady}
            visible={!interviewerSpeaking}
          />

          {/* Audio Sync Tracker for AV latency & speech energy */}
          <IVPSyncTracker
            ref={syncTrackerRef}
            mediaStream={cameraStream}
            videoSource={videoRef.current}
            questionId={activeQuestionId}
            questionIndex={activeQuestionIndex}
            onWindow={handleSyncWindow}
            onAudioLevel={setMicAudioLevel}
            visible={!interviewerSpeaking}
          />

          {/* Classical IVP Live Diagnostic Panel (O4 / REM-3) */}
          <IVPLivePanel
            runner={ivpRunner}
            sparklineSignal={typeof lastEar === 'number' ? lastEar : 0.3}
          />
        </div>
      </div>
    </div>
  );
}
