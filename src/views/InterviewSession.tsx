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
import { useInterview } from '../context/InterviewContext';
import { useAuth } from '../hooks/useAuth';
import { getProfile } from '../services/profile';
import { supabase } from '../lib/supabase';

import { LogoIcon } from '../components/common/Logo';
import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import AdaptiveHUDHeader from '../components/ui/AdaptiveHUDHeader';
import { SystemDesignCanvas } from '../components/interview/SystemDesignCanvas';
import { SystemDesignDiagramState, createInitialDiagramState, deserializeDiagram, serializeDiagram } from '../types/systemDesign';
import IVPGazeTracker, { type IVPGazeTrackerHandle } from '../components/ui/IVPGazeTracker';
import EyeContactHUD from '../components/ui/EyeContactHUD';
import IVPPoseTracker, { type IVPPoseTrackerHandle } from '../components/ui/IVPPoseTracker';
import PostureHUD from '../components/ui/PostureHUD';
import IVPAffectTracker, { type IVPAffectTrackerHandle } from '../components/ui/IVPAffectTracker';
import AffectiveHUD from '../components/ui/AffectiveHUD';
import IVPSyncTracker, { type IVPSyncTrackerHandle } from '../components/ui/IVPSyncTracker';
import LipSyncHUD from '../components/ui/LipSyncHUD';
import type { GazeFrameResult, HeadPoseFrameResult, AffectFrameResult, SyncWindowResult } from '@/types/index';





const AUTOSAVE_STORAGE_KEY_PREFIX = 'skillo_draft_ans_';

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
  const currentQuestionText = questions[currentQuestionIndex] || '';
  const currentQuestion = {
    question: currentQuestionText,
    duration: 120,
    id: `q_${currentQuestionIndex + 1}`,
    hint: '',
  };

  // Local States
  const [responseMode, setResponseMode] = useState<'type' | 'speak'>('type');
  const [typedAnswer, setTypedAnswer] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [recording, setRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(currentQuestion.duration);
  const [interviewerSpeaking, setInterviewerSpeaking] = useState(true);
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



  // ── L2CS-Net Gaze Tracker state ─────────────────────────────────────
  const gazeTrackerRef = useRef<IVPGazeTrackerHandle | null>(null);
  const [liveGazeFrame, setLiveGazeFrame] = useState<GazeFrameResult | null>(null);
  const [gazeEyeContactPct, setGazeEyeContactPct] = useState(0);
  const [gazeFrameCount, setGazeFrameCount] = useState(0);
  const [gazeContactCount, setGazeContactCount] = useState(0);
  const [showGazeWarning, setShowGazeWarning] = useState(false);
  const gazeWarningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle each sampled gaze frame — updates live HUD running metrics
  const handleGazeFrame = useCallback((frame: GazeFrameResult) => {
    setLiveGazeFrame(frame);
    setGazeFrameCount(prev => {
      const nextCount = prev + 1;
      setGazeContactCount(prevContact => {
        const nextContact = prevContact + (frame.isEyeContact ? 1 : 0);
        setGazeEyeContactPct(Math.round((nextContact / nextCount) * 100));
        return nextContact;
      });
      return nextCount;
    });

    // Distraction warning: show when off-screen, dismiss after 3s of eye contact
    if (!frame.isEyeContact && frame.screenFocusZone !== 'LOOKING_UP') {
      if (gazeWarningTimerRef.current) clearTimeout(gazeWarningTimerRef.current);
      setShowGazeWarning(true);
    } else if (frame.isEyeContact) {
      if (gazeWarningTimerRef.current) clearTimeout(gazeWarningTimerRef.current);
      gazeWarningTimerRef.current = setTimeout(() => setShowGazeWarning(false), 3000);
    }
  }, []);

  // Start gaze tracker when interviewer finishes speaking and question is shown
  useEffect(() => {
    if (!interviewerSpeaking && gazeTrackerRef.current) {
      gazeTrackerRef.current.start().catch(() => { /* camera denied — silent */ });
    }
    return () => {
      if (gazeWarningTimerRef.current) clearTimeout(gazeWarningTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewerSpeaking]);

  // Reset per-question gaze counts on question change
  useEffect(() => {
    setGazeFrameCount(0);
    setGazeContactCount(0);
    setGazeEyeContactPct(0);
    setLiveGazeFrame(null);
    setShowGazeWarning(false);
  }, [currentQuestionIndex]);

  // ── HopeNet Head Pose Tracker state ──────────────────────────────────
  const poseTrackerRef = useRef<IVPPoseTrackerHandle | null>(null);
  const [livePoseFrame, setLivePoseFrame] = useState<HeadPoseFrameResult | null>(null);
  const [latestGestureToast, setLatestGestureToast] = useState<{
    type: 'NODDING' | 'HEAD_SHAKING' | 'POSTURE_SLUMP';
    timestampMs: number;
  } | null>(null);

  const handlePoseFrame = useCallback((frame: HeadPoseFrameResult) => {
    setLivePoseFrame(frame);
    if (frame.detectedGesture === 'NODDING' || frame.detectedGesture === 'HEAD_SHAKING') {
      setLatestGestureToast({
        type: frame.detectedGesture,
        timestampMs: frame.frameTimestampMs,
      });
    }
  }, []);

  // Start pose tracker when question active
  useEffect(() => {
    if (!interviewerSpeaking && poseTrackerRef.current) {
      poseTrackerRef.current.start().catch(() => { /* camera denied — silent */ });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewerSpeaking]);

  // ── AffectNet Facial Expression & Composure Tracker state ──────────
  const affectTrackerRef = useRef<IVPAffectTrackerHandle | null>(null);
  const [liveAffectFrame, setLiveAffectFrame] = useState<AffectFrameResult | null>(null);

  const handleAffectFrame = useCallback((frame: AffectFrameResult) => {
    setLiveAffectFrame(frame);
  }, []);

  // Start affect tracker when question active
  useEffect(() => {
    if (!interviewerSpeaking && affectTrackerRef.current) {
      affectTrackerRef.current.start().catch(() => { /* silent */ });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewerSpeaking]);

  // ── SyncNet Audio-Visual Lip-Sync Tracker state ─────────────────────
  const syncTrackerRef = useRef<IVPSyncTrackerHandle | null>(null);
  const [liveSyncWindow, setLiveSyncWindow] = useState<SyncWindowResult | null>(null);

  const handleSyncWindow = useCallback((result: SyncWindowResult) => {
    setLiveSyncWindow(result);
  }, []);

  // Start sync tracker when question active
  useEffect(() => {
    if (!interviewerSpeaking && syncTrackerRef.current) {
      syncTrackerRef.current.start().catch(() => { /* silent */ });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewerSpeaking]);






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
    const proceedToNext = (updatedQuestions: string[], updatedAnswers: any[]) => {
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
        const capturedGazeFrames = gazeTrackerRef.current?.getFrames() ?? [];
        const capturedPoseFrames = poseTrackerRef.current?.getFrames() ?? [];
        const capturedAffectFrames = affectTrackerRef.current?.getFrames() ?? [];
        const capturedSyncWindows = syncTrackerRef.current?.getFrames() ?? [];
        gazeTrackerRef.current?.stop();
        poseTrackerRef.current?.stop();
        affectTrackerRef.current?.stop();
        syncTrackerRef.current?.stop();
        submitInterviewAnswers(
          setupData,
          updatedQuestions.map((q, idx) => ({ id: `q_${idx + 1}`, question: q })),
          updatedAnswers,
          undefined,
          capturedGazeFrames,
          capturedPoseFrames,
          capturedAffectFrames,
          capturedSyncWindows
        )



          .then((finalReport) => {
            setResults(finalReport);
            setGrading(false);
            router.push('/results');
          })
          .catch((err) => {
            console.error(err);
            setGrading(false);
          });
      }
    };

    if (isRetry && retryQuestionIndex !== null) {
      setGrading(true);
      const capturedGazeFrames = gazeTrackerRef.current?.getFrames() ?? [];
      const capturedPoseFrames = poseTrackerRef.current?.getFrames() ?? [];
      const capturedAffectFrames = affectTrackerRef.current?.getFrames() ?? [];
      const capturedSyncWindows = syncTrackerRef.current?.getFrames() ?? [];
      gazeTrackerRef.current?.stop();
      poseTrackerRef.current?.stop();
      affectTrackerRef.current?.stop();
      syncTrackerRef.current?.stop();
      submitInterviewAnswers(
        setupData,
        [{ id: 'q_1', question: currentQuestionText }],
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
          console.error(err);
          setGrading(false);
          setIsRetry(false);
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
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;
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
        if (data && data.needsFollowUp && data.followUpQuestion) {
          const newQuestionsList = [...questions];
          const insertIdx = currentQuestionIndex + 1;
          newQuestionsList.splice(insertIdx, 0, data.followUpQuestion);
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
      const capturedGazeFrames = gazeTrackerRef.current?.getFrames() ?? [];
      const capturedPoseFrames = poseTrackerRef.current?.getFrames() ?? [];
      const capturedAffectFrames = affectTrackerRef.current?.getFrames() ?? [];
      const capturedSyncWindows = syncTrackerRef.current?.getFrames() ?? [];
      gazeTrackerRef.current?.stop();
      poseTrackerRef.current?.stop();
      affectTrackerRef.current?.stop();
      syncTrackerRef.current?.stop();
      submitInterviewAnswers(
        setupData,
        questions.map((q, idx) => ({ id: `q_${idx + 1}`, question: q })),
        newAnswers,
        undefined,
        capturedGazeFrames,
        capturedPoseFrames,
        capturedAffectFrames,
        capturedSyncWindows
      )



        .then((finalReport) => {
          setResults(finalReport);
          setGrading(false);
          router.push('/results');
        })
        .catch((err) => {
          console.error(err);
          setGrading(false);
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

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
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
      <div className="glass-card rounded-2xl p-8 border border-red-500/20 bg-red-500/5 text-center max-w-md mx-auto mt-12 space-y-6">
        <div className="h-12 w-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-xl mx-auto">
          <FaExclamationTriangle />
        </div>
        <h3 className="text-lg font-heading font-bold text-white">Resume Required</h3>
        <p className="text-xs text-gray-400 leading-relaxed">
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
      <div className="glass-card rounded-2xl p-8 border border-amber-500/20 glow-accent flex flex-col items-center justify-center min-h-[320px] text-center max-w-lg mx-auto mt-16 space-y-4">
        <div className="flex space-x-2">
          <div className="h-3 w-3 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="h-3 w-3 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="h-3 w-3 bg-amber-400 rounded-full animate-bounce" />
        </div>
        <h3 className="text-base font-heading font-bold text-white">Reviewing your answer...</h3>
        <p className="text-xs text-gray-400 font-mono">Real-time AI checking for depth and technical specificity...</p>
      </div>
    );
  }

  if (grading) {

    return (
      <div className="glass-card rounded-2xl p-10 border border-white/5 glow-secondary flex flex-col items-center justify-center min-h-[420px] text-center max-w-xl mx-auto mt-16">
        <div className="relative mb-8">
          <motion.div
            animate={{
              scale: [0.95, 1.05, 0.95],
              filter: [
                'drop-shadow(0 0 10px rgba(139, 92, 246, 0.15))',
                'drop-shadow(0 0 25px rgba(139, 92, 246, 0.35))',
                'drop-shadow(0 0 10px rgba(139, 92, 246, 0.15))',
              ],
            }}
            transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          >
            <LogoIcon size={72} />
          </motion.div>
        </div>
        <h3 className="text-xl font-heading font-bold text-white mb-2">Grading Live Assessment</h3>
        <p className="text-xs text-gray-500 font-mono mb-6">Evaluating communication parameters and accuracy standards...</p>
        <div className="w-full h-1.5 bg-white/5 rounded-full max-w-xs overflow-hidden border border-white/5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 2.8 }}
            className="h-full bg-secondary"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-12 text-left">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-5 space-y-6 flex flex-col justify-between">
          <Card variant="glass" className="space-y-4 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="relative shrink-0">
                    <AnimatePresence mode="popLayout">
                      {interviewerSpeaking ? (
                        <motion.span
                          key="speaking-ring"
                          initial={{ scale: 0.8, opacity: 0.5 }}
                          animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0, 0.5] }}
                          exit={{ opacity: 0 }}
                          transition={{ repeat: Infinity, duration: 1.8 }}
                          className={`absolute inset-0 rounded-2xl border-2 ${persona.borderColor} pointer-events-none`}
                        />
                      ) : (
                        <motion.span
                          key="listening-ring"
                          initial={{ scale: 0.8, opacity: 0.6 }}
                          animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
                          exit={{ opacity: 0 }}
                          transition={{ repeat: Infinity, duration: 2.0 }}
                          className="absolute inset-0 rounded-2xl border-2 border-emerald-500 pointer-events-none"
                        />
                      )}
                    </AnimatePresence>
                    <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-white/10 shadow-lg z-10 shrink-0">
                      <Image
                        src={persona.avatar}
                        alt={persona.name}
                        width={64}
                        height={64}
                        className="object-cover h-full w-full"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-heading font-bold text-white leading-none">{persona.name}</h3>
                    <p className="text-[10px] text-gray-500 font-mono uppercase">
                      {persona.role} &bull; {persona.company}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                      <Badge variant={interviewerSpeaking ? 'primary' : 'neutral'} size="sm">
                        {interviewerSpeaking ? 'Speaking Voice...' : 'Listening'}
                      </Badge>
                      {followUpBadgeSet.has(currentQuestionIndex) && (
                        <Badge variant="accent" size="sm" className="bg-amber-500/15 border-amber-500/30 text-amber-300 font-mono font-bold">
                          ⚡ AI Real-Time Follow-up
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>


                {/* Skip Narration / Mute Button */}
                {interviewerSpeaking && (
                  <button
                    type="button"
                    onClick={cancelSpeechNarration}
                    title="Skip voice narration"
                    className="flex items-center gap-1 text-[10px] font-mono text-gray-400 hover:text-white bg-white/5 border border-white/10 hover:bg-white/10 px-2 py-1 rounded-lg transition cursor-pointer shrink-0"
                  >
                    <FaStepForward size={10} />
                    <span>Skip Voice</span>
                  </button>
                )}
              </div>

              {/* LATS Adaptive Questioning HUD Indicator */}
              <AdaptiveHUDHeader className="mt-4" />

              {/* L2CS-Net Live Gaze HUD */}
              <div className="mt-3">
                <EyeContactHUD
                  currentFrame={liveGazeFrame}
                  eyeContactPercentage={gazeEyeContactPct}
                  showDistraction={showGazeWarning}
                />
              </div>

              {/* HopeNet Live Posture HUD */}
              <div className="mt-2">
                <PostureHUD
                  currentFrame={livePoseFrame}
                  latestGestureToast={latestGestureToast}
                />
              </div>

              {/* AffectNet Live Affective HUD */}
              <div className="mt-2">
                <AffectiveHUD currentFrame={liveAffectFrame} />
              </div>

              {/* SyncNet Live Anti-Spoofing HUD */}
              <div className="mt-2">
                <LipSyncHUD currentWindow={liveSyncWindow} />
              </div>

              {/* Hidden keyframe affect tracker for ref handle */}
              <IVPAffectTracker
                ref={affectTrackerRef}
                onFrame={handleAffectFrame}
                visible={!interviewerSpeaking}
              />
              <IVPSyncTracker
                ref={syncTrackerRef}
                onWindow={handleSyncWindow}
                visible={!interviewerSpeaking}
              />



              {/* Camera overlays grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <IVPGazeTracker
                  ref={gazeTrackerRef}
                  onFrame={handleGazeFrame}
                  visible={!interviewerSpeaking}
                  className="max-h-[160px]"
                />
                <IVPPoseTracker
                  ref={poseTrackerRef}
                  onFrame={handlePoseFrame}
                  visible={!interviewerSpeaking}
                  className="max-h-[160px]"
                />
              </div>


              <div className="bg-[#030712]/60 rounded-xl p-5 border border-white/5 mt-4 min-h-[120px] flex flex-col justify-center">
                <AnimatePresence mode="wait">
                  {interviewerSpeaking ? (
                    <motion.div
                      key="speaking"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3 w-full"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex space-x-1">
                          <div className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                          <div className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                          <div className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce" />
                        </div>
                        <span className="text-[10px] text-primary font-mono font-bold uppercase">
                          AI Voice Narration Active ({voiceRate}x Speed)
                        </span>
                      </div>

                      {/* Subtitles Animation (If enabled in settings) */}
                      {subtitlesEnabled ? (
                        <div className="text-xs sm:text-sm font-heading font-medium leading-relaxed">
                          {questionSentences.map((sentence, idx) => (
                            <span
                              key={idx}
                              className={`transition-all duration-300 ${
                                idx === spokenSentenceIndex
                                  ? 'text-white font-bold bg-primary/20 px-1 rounded border-b border-primary'
                                  : 'text-gray-400 opacity-70'
                              }`}
                            >
                              {sentence}{' '}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs sm:text-sm font-heading font-medium text-white leading-relaxed">
                          {currentQuestion.question}
                        </p>
                      )}
                    </motion.div>
                  ) : (
                    <div className="space-y-3 w-full">
                      <motion.p
                        key="question"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xs sm:text-sm font-heading font-medium text-white leading-relaxed"
                      >
                        {currentQuestion.question}
                      </motion.p>

                      {currentQuestion.hint && (
                        <div className="pt-2 border-t border-white/5">
                          <button
                            type="button"
                            onClick={() => setShowHint(!showHint)}
                            className="text-[10px] text-primary hover:text-accent font-semibold uppercase tracking-wider transition cursor-pointer"
                          >
                            {showHint ? 'Hide Hint' : 'Show Hint'}
                          </button>
                          <AnimatePresence>
                            {showHint && (
                              <motion.p
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{
                                  height: { duration: 0.3, ease: 'easeInOut' },
                                  opacity: { duration: 0.2, ease: 'linear' },
                                }}
                                className="text-[11px] text-gray-400 mt-2 leading-relaxed bg-[#030712]/50 p-2.5 rounded-lg border border-white/5 font-mono overflow-hidden"
                              >
                                {currentQuestion.hint}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="pt-6 border-t border-white/5 space-y-2">
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">
                Question Focus Elements
              </span>
              <div className="flex flex-wrap gap-1.5">
                {focusAreasList.map((focus) => (
                  <Badge key={focus} variant="accent" size="sm">
                    {focus}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>

          <Card variant="solid" className="p-4 border-l-2 border-l-secondary bg-secondary/5 space-y-1.5">
            <span className="text-[10px] text-secondary font-bold uppercase tracking-wider block flex items-center gap-1.5">
              <FaInfoCircle />
              <span>Assessor Pacing Notes</span>
            </span>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              {setupData.type === 'Technical'
                ? 'Elaborate on coding trade-offs, space/time Big O complexities, and error-handling conditions. Do not state high-level design only.'
                : 'Structure answers using the STAR framework. Clearly define the quantitative results and what metrics changed.'}
            </p>
          </Card>
        </div>

        <div className="lg:col-span-7 flex flex-col justify-between bg-[#111827]/40 border border-white/5 rounded-2xl p-6 relative space-y-6">
          <div>
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white font-bold uppercase tracking-wider block">Candidate Studio Workspace</span>
                  {isRetry && (
                    <Badge variant="accent" size="sm" className="bg-amber-500/10 border-amber-500/20 text-amber-400 font-mono font-bold">
                      Focused Question Retry
                    </Badge>
                  )}
                </div>
                <span className="text-[10px] text-gray-500 font-mono">
                  {isRetry ? 'Single Question Target Practice' : `Question ${currentQuestionIndex + 1} of ${questions.length}`}
                </span>
              </div>


              <div className="bg-[#030712] p-1 rounded-xl border border-white/5 flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setResponseMode('type');
                    setTranscriptText('');
                    setRecording(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition duration-200 cursor-pointer ${
                    responseMode === 'type' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:text-white'
                  }`}
                >
                  <FaKeyboard size={10} />
                  <span>Editor</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setResponseMode('speak');
                    setTypedAnswer('');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition duration-200 cursor-pointer ${
                    responseMode === 'speak' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:text-white'
                  }`}
                >
                  <FaMicrophone size={10} />
                  <span>Speech</span>
                </button>
              </div>
            </div>

            {/* 30-Second Early Warning Banner */}
            {timeLeft <= 30 && timeLeft > 10 && !interviewerSpeaking && (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs px-4 py-2 rounded-xl font-medium mb-3 flex items-center gap-2">
                <span>⏱️</span>
                <span>Pacing Warning: 30 seconds remaining. Wrap up your main points before automatic submission.</span>
              </div>
            )}

            {/* 10-Second Critical Red Warning Banner */}
            {timeLeft <= 10 && !interviewerSpeaking && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-2.5 rounded-xl font-medium animate-pulse mb-3 text-left">
                ⚠️ 10 seconds remaining — your answer will be submitted automatically.
              </div>
            )}

            <div className="min-h-[220px] relative">
              {responseMode === 'type' ? (
                <div className="space-y-2">
                  <textarea
                    value={typedAnswer}
                    onChange={(e) => setTypedAnswer(e.target.value)}
                    disabled={interviewerSpeaking}
                    placeholder="Provide your response here..."
                    className="w-full h-56 rounded-xl bg-[#030712]/50 border border-white/10 p-4 text-xs sm:text-sm text-gray-200 focus:outline-none focus:border-primary/50 transition duration-200 resize-none font-mono disabled:opacity-40"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-6 py-8">
                  {!isSpeechSupported ? (
                    <div className="text-center p-6 bg-red-500/10 border border-red-500/20 rounded-xl space-y-3 max-w-sm mx-auto">
                      <div className="h-10 w-10 bg-red-500/20 border border-red-500/30 rounded-full flex items-center justify-center text-red-400 mx-auto">
                        <FaExclamationTriangle />
                      </div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Web Speech API Unsupported
                      </h4>
                      <p className="text-[11px] text-gray-400 leading-relaxed">
                        Speech recognition is not supported in this browser. Please try Google Chrome or Microsoft Edge, or switch back to the text Editor mode.
                      </p>
                    </div>
                  ) : recording ? (
                    <div className="w-full flex flex-col items-center space-y-4">
                      <div className="h-10 flex items-end justify-center gap-1 px-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((bar) => (
                          <motion.div
                            key={bar}
                            animate={{ height: [12, Math.floor(Math.random() * 26) + 12, 12] }}
                            transition={{ repeat: Infinity, duration: 0.6 + bar * 0.05, ease: 'easeInOut' }}
                            className="w-1 bg-gradient-to-t from-primary to-accent rounded-full"
                            style={{ height: '12px' }}
                          />
                        ))}
                      </div>

                      <Button onClick={handleToggleRecord} variant="danger" size="sm" icon={FaPauseCircle}>
                        Pause Voice Recording
                      </Button>

                      <div className="w-full bg-[#030712]/50 border border-white/5 rounded-xl p-4 text-xs font-mono text-gray-400 leading-relaxed min-h-[60px] text-left">
                        {transcriptText || 'Awaiting voice inputs... speak to compile transcript logs.'}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-4">
                      <button
                        type="button"
                        onClick={handleToggleRecord}
                        disabled={interviewerSpeaking}
                        className="h-16 w-16 rounded-full bg-primary/10 border border-primary/20 hover:border-primary flex items-center justify-center text-primary text-2xl hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition duration-200 cursor-pointer shadow-lg shadow-primary/10"
                      >
                        <FaMicrophone />
                      </button>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-white uppercase tracking-wide">Capture Speech</p>
                        <p className="text-[10px] text-gray-500">Audio captures are transcribed locally in real-time.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center text-[10px] text-gray-500 font-mono mt-3 pb-3 border-b border-white/5">
              <span>
                Words:{' '}
                <span
                  className={
                    wordCount > 100
                      ? 'text-emerald-400 font-bold'
                      : wordCount >= 50
                      ? 'text-yellow-400 font-bold'
                      : 'text-gray-500'
                  }
                >
                  {wordCount}
                </span>{' '}
                &bull; Characters: {charCount}
              </span>
              <span>Formatting: plain text structure</span>
            </div>
          </div>

          {/* System Design Architectural Canvas (Conditional per System Design question) */}
          {isSystemDesignQuestion && (
            <div className="pt-4 border-t border-white/5">
              <SystemDesignCanvas
                initialState={diagramState}
                onChange={setDiagramState}
              />
            </div>
          )}


          <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/5">
            <div className="flex gap-2 items-center">
              {!confirmSkip ? (
                <>
                  <Button
                    onClick={() => {
                      setConfirmSkip(false);
                      handlePrevQuestion();
                    }}
                    disabled={currentQuestionIndex === 0}
                    variant="ghost"
                    size="sm"
                    icon={FaChevronLeft}
                  >
                    Prev
                  </Button>
                  <Button
                    onClick={() => setConfirmSkip(true)}
                    variant="ghost"
                    size="sm"
                    className="text-gray-500 hover:text-white"
                  >
                    Skip
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-2 bg-[#030712]/60 px-3 py-1.5 rounded-lg border border-white/5 text-[11px] text-gray-400">
                  <span>Skip this question? Your answer won't be scored.</span>
                  <button
                    type="button"
                    onClick={handleConfirmSkip}
                    className="text-red-400 hover:text-red-300 font-bold px-1.5 py-0.5 rounded cursor-pointer transition"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmSkip(false)}
                    className="text-gray-400 hover:text-white font-bold px-1.5 py-0.5 rounded cursor-pointer transition"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">Timer</span>
                <span
                  className={`text-xs font-mono font-bold ${
                    timeLeft <= 10
                      ? 'text-red-400 animate-pulse'
                      : timeLeft <= 30
                      ? 'text-amber-400'
                      : 'text-white'
                  }`}
                >
                  {formatTime(timeLeft)}
                </span>
              </div>
              <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden shrink-0">
                <div
                  className={`h-full transition-all duration-1000 ${
                    timeLeft <= 10 ? 'bg-red-400' : timeLeft <= 30 ? 'bg-amber-400' : 'bg-primary'
                  }`}
                  style={{ width: `${(timeLeft / currentQuestion.duration) * 100}%` }}
                />
              </div>
            </div>

            <Button
              onClick={handleNextQuestion}
              disabled={interviewerSpeaking || !activeAnswer?.trim()}
              variant="primary"
              size="sm"
              icon={FaArrowRight}
            >
              {currentQuestionIndex + 1 === questions.length ? 'Finish' : 'Next'}
            </Button>

          </div>
        </div>
      </div>
    </div>
  );
}
