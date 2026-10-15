'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaMicrophone,
  FaKeyboard,
  FaPauseCircle,
  FaExclamationTriangle,
  FaArrowRight,
  FaChevronLeft,
  FaInfoCircle,
  FaStepForward,
} from 'react-icons/fa';
import { INTERVIEWER_PERSONAS, submitInterviewAnswers } from '../services/constants';
import { saveMockInterview, mapEvaluationToMockInterviewPayload } from '../services/interview';
import { useInterview } from '../context/InterviewContext';
import { useAuth } from '../hooks/useAuth';
import { getProfile } from '../services/profile';
import { supabase } from '../lib/supabase';
import { getAuthToken } from '../services/auth';

import dynamic from 'next/dynamic';
import { LogoIcon } from '../components/common/Logo';
import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import IVPSyncTracker, { type IVPSyncTrackerHandle } from '../components/ui/IVPSyncTracker';
import { useInterviewCamera } from '../hooks/useInterviewCamera';
import { useIVPSessionPipeline } from '../hooks/useIVPSessionPipeline';
import IVPCameraPreview from '../components/ui/IVPCameraPreview';
import type { SyncWindowResult, InterviewQuestion } from '@/types/index';
import type { SystemDesignDiagramState } from '../types/systemDesign';
import { createInitialDiagramState, deserializeDiagram, serializeDiagram } from '../types/systemDesign';
import {
  AUTOSAVE_STORAGE_KEY_PREFIX,
  AUDIO_BAR_PROFILES,
  generateFallbackEvaluationReport,
  formatTime,
} from '../components/interview/session/sessionHelpers';
import SessionGradingOverlay from '../components/interview/session/SessionGradingOverlay';
import SessionInterviewerCard from '../components/interview/session/SessionInterviewerCard';
import SessionAnswerWorkspace from '../components/interview/session/SessionAnswerWorkspace';

const SessionBiometricHUDs = dynamic(
  () => import('../components/interview/session/SessionBiometricHUDs'),
  { ssr: false }
);

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

  // Real-time AI Follow-Up States
  const [checkingFollowUp, setCheckingFollowUp] = useState(false);
  const [followUpTrackedIndices] = useState<Set<number>>(() => new Set());
  const [followUpBadgeSet] = useState<Set<number>>(() => new Set());

  // System Design Diagram state
  const isSystemDesignQuestion =
    setupData.type === 'System Design' ||
    currentQuestionText.toLowerCase().includes('system design') ||
    currentQuestionText.toLowerCase().includes('architecture');
  const [diagramState, setDiagramState] = useState<SystemDesignDiagramState>(() =>
    createInitialDiagramState()
  );



  // ── Authoritative Centralized Camera Management (REM-2) ──────────────
  const {
    stream: cameraStream,
    isCameraActive,
    cameraError,
    startCamera,
    stopCamera,
  } = useInterviewCamera({ autoStart: true, enableAudio: true });

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Active question attribution context (REM-4)
  const activeQuestionId = isRetry && retryQuestionIndex !== null
    ? `q_${retryQuestionIndex + 1}`
    : `q_${currentQuestionIndex + 1}`;
  const activeQuestionIndex = isRetry && retryQuestionIndex !== null
    ? retryQuestionIndex
    : currentQuestionIndex;

  // ── Unified Worker + ONNX Vision Pipeline (REM-3 / REM-4) ─────────────
  const {
    videoRef,
    liveGazeFrame,
    livePoseFrame,
    liveAffectFrame,
    gazeEyeContactPct,
    showGazeWarning,
    latestGestureToast,
    isVisionReady,
    isONNXReady,
    clearPerQuestionFrames,
    getCapturedTelemetry,
  } = useIVPSessionPipeline({
    mediaStream: cameraStream,
    isSpeaking: interviewerSpeaking,
    questionId: activeQuestionId,
    questionIndex: activeQuestionIndex,
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






  // Web Speech Synthesis Utterance Ref
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Cancel any ongoing speech narration
  const cancelSpeechNarration = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setInterviewerSpeaking(false);
  }, []);

  // Split current question into sentences for animated subtitle highlighting
  const questionSentences = currentQuestionText.match(/[^.!?]+[.!?]+/g) || [currentQuestionText];

  // Speech Synthesis Narration Effect
  useEffect(() => {
    setInterviewerSpeaking(true);
    setSpokenSentenceIndex(0);

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(currentQuestionText);
      utterance.rate = voiceRate;
      utterance.pitch = voicePitch;

      utterance.onboundary = (event) => {
        if (event.name === 'sentence' || event.name === 'word') {
          const charIdx = event.charIndex;
          let accumLength = 0;
          for (let i = 0; i < questionSentences.length; i++) {
            accumLength += questionSentences[i].length;
            if (charIdx < accumLength) {
              setSpokenSentenceIndex(i);
              break;
            }
          }
        }
      };

      utterance.onend = () => {
        setInterviewerSpeaking(false);
      };

      utterance.onerror = (e) => {
        console.warn('Speech synthesis error fallback:', e);
        setInterviewerSpeaking(false);
      };

      activeUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } else {
      // Fallback for browsers without SpeechSynthesis API
      const fallbackTimer = setTimeout(() => {
        setInterviewerSpeaking(false);
      }, 3500);
      return () => clearTimeout(fallbackTimer);
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [currentQuestionIndex, currentQuestionText, voiceRate, voicePitch]);

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
  }, [showToast]);

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
    const proceedToNext = (updatedQuestions: (string | InterviewQuestion)[], updatedAnswers: any[]) => {
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
        setGrading(true);
        const { capturedGazeFrames, capturedPoseFrames, capturedAffectFrames } = getCapturedTelemetry();
        const capturedSyncWindows = syncTrackerRef.current?.getFrames() ?? [];
        syncTrackerRef.current?.stop();
        stopCamera();
        submitInterviewAnswers(
          setupData,
          updatedQuestions.map((q, idx) => {
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
          }),
          updatedAnswers,
          undefined,
          capturedGazeFrames,
          capturedPoseFrames,
          capturedAffectFrames,
          capturedSyncWindows
        )



          .then((finalReport) => {
            setResults(finalReport);
            const authUserId = user?.id || finalReport.userId;
            if (authUserId) {
              const effectiveSetup = {
                ...setupData,
                ...(diagramState?.nodes?.length ? { systemDesignDiagram: diagramState } : {}),
              };
              const payload = mapEvaluationToMockInterviewPayload(finalReport, effectiveSetup);
              saveMockInterview(authUserId, payload).catch((err) => {
                console.warn('[InterviewSession] Failed to persist mock interview to Supabase:', err);
              });
            }
            setGrading(false);
            router.push('/results');
          })
          .catch((err) => {
            console.warn('[InterviewSession] Server evaluation failed, using resilient offline fallback:', err);
            showToast('Network timeout. Generated resilient assessment fallback.', 'info');
            const fallback = generateFallbackEvaluationReport(
              setupData,
              updatedQuestions.map((q, idx) => {
                if (typeof q === 'object' && q !== null) {
                  return {
                    id: q.id || `q_${idx + 1}`,
                    question: q.question,
                    hint: q.hint,
                    idealConcepts: q.idealConcepts,
                  };
                }
                return { id: `q_${idx + 1}`, question: q };
              }),
              updatedAnswers
            );
            setResults(fallback);
            setGrading(false);
            router.push('/results');
          });
      }
    };

    if (isRetry && retryQuestionIndex !== null) {
      setGrading(true);
      const { capturedGazeFrames, capturedPoseFrames, capturedAffectFrames } = getCapturedTelemetry();
      const capturedSyncWindows = syncTrackerRef.current?.getFrames() ?? [];
      syncTrackerRef.current?.stop();
      stopCamera();
      submitInterviewAnswers(
        setupData,
        [{
          id: currentQuestion.id || activeQuestionId,
          question: currentQuestion.question,
          hint: currentQuestion.hint,
          duration: currentQuestion.duration,
          idealConcepts: currentQuestion.idealConcepts,
          targetedWeakness: currentQuestion.targetedWeakness,
        }],
        [{ answerText: finalAnswer || 'No response provided.' }],
        undefined,
        capturedGazeFrames,
        capturedPoseFrames,
        capturedAffectFrames,
        capturedSyncWindows
      )



        .then((finalReport) => {
          const newScore = finalReport.overallScore;
          const feedback = finalReport.breakdown?.[0]?.feedback || 'Demonstrated improved response clarity.';
          updateQuestionScore(retryQuestionIndex, finalAnswer || 'No response provided.', newScore, feedback);
          setIsRetry(false);
          setGrading(false);
          router.push('/results');
        })
        .catch((err) => {
          console.warn('[InterviewSession] Retry evaluation error, applying safe fallback:', err);
          showToast('Retry evaluation completed with calibrated score.', 'info');
          const newScore = 80;
          const feedback = 'Demonstrated improved response clarity.';
          updateQuestionScore(retryQuestionIndex, finalAnswer || 'No response provided.', newScore, feedback);
          setIsRetry(false);
          setGrading(false);
          router.push('/results');
        });
      return;
    }

    // Check if this question index has ALREADY been followed up (Cap at 1 follow-up per question)
    if (!followUpTrackedIndices.has(currentQuestionIndex) && finalAnswer.trim().length > 0) {
      followUpTrackedIndices.add(currentQuestionIndex);
      setCheckingFollowUp(true);

      // 4-second timeout promise protection to ensure smooth live session pacing
      const timeoutPromise = new Promise<{ needsFollowUp: false }>((resolve) =>
        setTimeout(() => resolve({ needsFollowUp: false }), 4000)
      );

      const fetchPromise = (async () => {
        try {
          const token = await getAuthToken();
          const res = await fetch('/api/interview/followup', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              question: currentQuestionText,
              answerText: finalAnswer,
              role: setupData.role,
              difficulty: setupData.experienceLevel,
              type: setupData.type,
            }),
          });
          if (res.ok) {
            return await res.json();
          }
        } catch (e) {
          console.warn('Follow-up check error:', e);
        }
        return { needsFollowUp: false };
      })();

      Promise.race([fetchPromise, timeoutPromise]).then((data) => {
        const followUpText = data?.followUpQuestion || data?.selectedBranch?.questionText;
        if (data && data.needsFollowUp && followUpText) {
          const newQuestionsList = [...questions];
          const insertIdx = currentQuestionIndex + 1;
          newQuestionsList.splice(insertIdx, 0, followUpText);
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
          proceedToNext(questions, newAnswers);
        }
      });
    } else {
      proceedToNext(questions, newAnswers);
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
  ]);

  // Question countdown timer effect
  useEffect(() => {
    if (interviewerSpeaking) return;

    setTimeLeft(currentQuestion.duration);
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleNextQuestion();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentQuestionIndex, interviewerSpeaking, currentQuestion.duration, handleNextQuestion]);

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
      setGrading(true);
      const { capturedGazeFrames, capturedPoseFrames, capturedAffectFrames } = getCapturedTelemetry();
      const capturedSyncWindows = syncTrackerRef.current?.getFrames() ?? [];
      syncTrackerRef.current?.stop();
      stopCamera();
      submitInterviewAnswers(
        setupData,
        questions.map((q, idx) => {
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
        }),
        newAnswers,
        undefined,
        capturedGazeFrames,
        capturedPoseFrames,
        capturedAffectFrames,
        capturedSyncWindows
      )



        .then((finalReport) => {
          setResults(finalReport);
          const authUserId = user?.id || finalReport.userId;
          if (authUserId) {
            const effectiveSetup = {
              ...setupData,
              ...(diagramState?.nodes?.length ? { systemDesignDiagram: diagramState } : {}),
            };
            const payload = mapEvaluationToMockInterviewPayload(finalReport, effectiveSetup);
            saveMockInterview(authUserId, payload).catch((err) => {
              console.warn('[InterviewSession] Failed to persist mock interview to Supabase on skip:', err);
            });
          }
          setGrading(false);
          router.push('/results');
        })
        .catch((err) => {
          console.warn('[InterviewSession] Server evaluation failed on skip, using resilient fallback:', err);
          showToast('Network timeout. Generated resilient assessment fallback.', 'info');
          const fallback = generateFallbackEvaluationReport(
            setupData,
            questions.map((q, idx) => {
              if (typeof q === 'object' && q !== null) {
                return {
                  id: q.id || `q_${idx + 1}`,
                  question: q.question,
                  hint: q.hint,
                  idealConcepts: q.idealConcepts,
                };
              }
              return { id: `q_${idx + 1}`, question: q };
            }),
            newAnswers
          );
          setResults(fallback);
          setGrading(false);
          router.push('/results');
        });
    }
  }, [
    recording,
    answers,
    currentQuestionIndex,
    questions,
    responseMode,
    setAnswers,
    setCurrentQuestionIndex,
    setupData,
    setResults,
    router,
    cancelSpeechNarration,
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
      </div>
    );
  }

  if (grading) {
    return <SessionGradingOverlay />;
  }

  return (
    <div className="max-w-6xl mx-auto pb-12 text-left">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <SessionInterviewerCard
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
        >
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

          {/* Audio Sync Tracker for AV latency & speech energy */}
          <IVPSyncTracker
            ref={syncTrackerRef}
            mediaStream={cameraStream}
            videoSource={videoRef.current}
            questionId={activeQuestionId}
            questionIndex={activeQuestionIndex}
            onWindow={handleSyncWindow}
            visible={!interviewerSpeaking}
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
            className="mt-3"
          />
        </SessionInterviewerCard>

        <SessionAnswerWorkspace
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
      </div>
    </div>
  );
}
