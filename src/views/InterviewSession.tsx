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
} from 'react-icons/fa';
import { INTERVIEWER_PERSONAS, submitInterviewAnswers } from '../services/constants';
import { useInterview } from '../context/InterviewContext';
import { LogoIcon } from '../components/common/Logo';
import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

export default function InterviewSession() {
  const router = useRouter();
  const { showToast } = useToast();
  const {
    resumeData,
    questions,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    answers,
    setAnswers,
    setupData,
    setResults,
  } = useInterview();

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

  // Web Speech API recognition ref (Task 8: guarded for SSR)
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

  // Task 9: Declare handleNextQuestion useCallback BEFORE the timer useEffect
  const handleNextQuestion = useCallback(() => {
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
      submitInterviewAnswers(setupData, questions.map((q, idx) => ({ id: `q_${idx + 1}`, question: q })), newAnswers)
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
  ]);

  // Task 9: Timer useEffect declared AFTER handleNextQuestion
  useEffect(() => {
    if (interviewerSpeaking) {
      const speechTimer = setTimeout(() => {
        setInterviewerSpeaking(false);
      }, 3500);
      return () => clearTimeout(speechTimer);
    }

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

  const handleConfirmSkip = useCallback(() => {
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
      submitInterviewAnswers(setupData, questions.map((q, idx) => ({ id: `q_${idx + 1}`, question: q })), newAnswers)
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
  ]);

  const handlePrevQuestion = () => {
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
                  <Badge variant={interviewerSpeaking ? 'primary' : 'neutral'} size="sm" className="mt-2.5">
                    {interviewerSpeaking ? 'Speaking...' : 'Listening'}
                  </Badge>
                </div>
              </div>

              <div className="bg-[#030712]/60 rounded-xl p-5 border border-white/5 mt-6 min-h-[120px] flex flex-col justify-center">
                <AnimatePresence mode="wait">
                  {interviewerSpeaking ? (
                    <motion.div
                      key="speaking"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-3"
                    >
                      <div className="flex space-x-1">
                        <div className="h-1.5 w-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <div className="h-1.5 w-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <div className="h-1.5 w-1.5 bg-gray-500 rounded-full animate-bounce" />
                      </div>
                      <span className="text-xs text-gray-500 font-mono">Presenting questions payload...</span>
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

        <div className="lg:col-span-7 flex flex-col justify-between bg-[#111827]/40 border border-white/5 rounded-2xl p-6 relative">
          <div>
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <div className="space-y-0.5">
                <span className="text-xs text-white font-bold uppercase tracking-wider block">Candidate Studio Workspace</span>
                <span className="text-[10px] text-gray-500 font-mono">
                  Question {currentQuestionIndex + 1} of {questions.length}
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
                <span className={`text-xs font-mono font-bold ${timeLeft < 30 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                  {formatTime(timeLeft)}
                </span>
              </div>
              <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden shrink-0">
                <div
                  className={`h-full transition-all duration-1000 ${timeLeft < 30 ? 'bg-red-400' : 'bg-primary'}`}
                  style={{ width: `${(timeLeft / currentQuestion.duration) * 100}%` }}
                />
              </div>
            </div>

            <Button
              onClick={handleNextQuestion}
              disabled={interviewerSpeaking || !activeAnswer?.trim()}
              variant="primary"
              size="sm"
            >
              <span>{currentQuestionIndex + 1 === questions.length ? 'Finish' : 'Next'}</span>
              <FaArrowRight size={10} className="ml-1 shrink-0" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
