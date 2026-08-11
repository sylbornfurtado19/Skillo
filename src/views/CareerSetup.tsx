'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaPlay,
  FaVideoSlash,
  FaChevronLeft,
  FaChevronRight,
  FaCheckCircle,
  FaExclamationTriangle,
  FaKeyboard,
} from 'react-icons/fa';
import { CAREER_DOMAINS, getQuestionsForSetup } from '../services/constants';
import { useAuth } from '../hooks/useAuth';
import { useInterview } from '../context/InterviewContext';
import { getProfile } from '../services/profile';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/FeedbackHelpers';
import { Progress } from '../components/ui/Loader';
import { InterviewModePreviewCard } from '../components/interview/InterviewModePreviewCard';
import { resolveInterviewMode } from '../types/interviewModes';

const SETUP_STORAGE_KEY = 'skillo_career_setup_state';

const COMPANY_OPTIONS = ['Generic', 'Google', 'Meta', 'Amazon', 'Stripe', 'Custom'];
const TARGET_ROLES = [
  'Software Engineer',
  'Frontend Engineer',
  'Backend Engineer',
  'Full Stack Engineer',
  'Data Engineer',
  'ML Engineer',
  'DevOps Engineer',
  'Product Manager',
  'Custom',
];
const INTERVIEW_TYPES = ['Coding', 'System Design', 'Behavioral', 'Technical', 'Mixed'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Expert'];
const DURATIONS = [15, 30, 45, 60];

export default function CareerSetup() {
  const router = useRouter();
  const { user } = useAuth();
  const { resumeData, setupData, setSetupData, setQuestions, setCurrentQuestionIndex, setAnswers } = useInterview();

  // Wizard Step State & Persistence
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;

  // Restore step and setupData from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem(SETUP_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.currentStep) setCurrentStep(parsed.currentStep);
          if (parsed.setupData) setSetupData(parsed.setupData);
        }
      } catch (err) {
        console.warn('Failed to load setup state from sessionStorage:', err);
      }
    }
  }, []);

  // Persist currentStep and setupData changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(
          SETUP_STORAGE_KEY,
          JSON.stringify({ currentStep, setupData })
        );
      } catch (err) {
        console.warn('Failed to save setup state to sessionStorage:', err);
      }
    }
  }, [currentStep, setupData]);

  // Load user profile defaults if not already restored from session
  useEffect(() => {
    if (!user?.id) return;
    getProfile(user.id).then(({ data }) => {
      if (data?.profileSettings) {
        const ps = data.profileSettings;
        setSetupData({
          ...setupData,
          ...(ps.defaultDifficulty ? { difficulty: ps.defaultDifficulty, experienceLevel: ps.defaultDifficulty } : {}),
          ...(ps.defaultInterviewer ? { persona: ps.defaultInterviewer } : {}),
          ...(ps.preferredMode ? { responseMode: ps.preferredMode } : {}),
        });
      }
    });
  }, [user?.id]);

  // Media Diagnostics State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [deviceChecking, setDeviceChecking] = useState(false);
  const [deviceChecked, setDeviceChecked] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'none' | 'granted' | 'denied'>('none');
  const [micPermission, setMicPermission] = useState<'none' | 'granted' | 'denied'>('none');
  const [audioLevel, setAudioLevel] = useState(0);

  // Web Audio API refs for REAL mic volume detection
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const startDeviceCheck = async () => {
    setDeviceChecking(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240 },
        audio: true,
      });
      setStream(mediaStream);
      setCameraPermission('granted');
      setMicPermission('granted');
      setDeviceChecked(true);
    } catch (err: unknown) {
      console.warn('Media access error:', err);
      setCameraPermission('denied');
      setMicPermission('denied');
      setDeviceChecked(true);
    }
    setDeviceChecking(false);
  };

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Real Web Audio API microphone amplitude detection
  useEffect(() => {
    if (stream && micPermission === 'granted') {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;

          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          audioContextRef.current = audioCtx;
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const updateVolume = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            // Scale average (0-255) into a 0-100 range
            const scaledLevel = Math.min(100, Math.round((average / 128) * 100));
            setAudioLevel(scaledLevel);

            animFrameRef.current = requestAnimationFrame(updateVolume);
          };

          updateVolume();
        }
      } catch (err) {
        console.warn('Web Audio API initialization failed:', err);
      }
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      analyserRef.current = null;
    };
  }, [stream, micPermission]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  const handleStartInterview = () => {
    // Clear persisted wizard progress upon starting session
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(SETUP_STORAGE_KEY);
      } catch (err) {
        console.warn('Failed to clear setup state:', err);
      }
    }

    const questList = getQuestionsForSetup(setupData);
    const limitedQuestions = questList.slice(0, setupData.questionCount);
    setQuestions(limitedQuestions.map((q) => q.question));
    setCurrentQuestionIndex(0);
    setAnswers([]);

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    router.push('/interview');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (currentStep < totalSteps) {
          setCurrentStep((prev) => prev + 1);
        } else {
          handleStartInterview();
        }
      } else if (e.key === 'Backspace' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentStep > 1) {
          setCurrentStep((prev) => prev - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentStep, totalSteps, setupData, stream]);

  if (!resumeData) {
    return (
      <div className="glass-card rounded-2xl p-8 border border-red-500/20 bg-red-500/5 text-center max-w-md mx-auto mt-12 space-y-6">
        <div className="h-12 w-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-xl mx-auto">
          <FaExclamationTriangle />
        </div>
        <h3 className="text-lg font-heading font-bold text-white">Resume Required</h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          You must upload your resume and specify job details before you can configure or start mock interview sessions.
        </p>
        <Button onClick={() => router.push('/resume')} variant="primary" size="md">
          Go to Upload Page
        </Button>
      </div>
    );
  }

  const domains = Object.keys(CAREER_DOMAINS);
  const roles = CAREER_DOMAINS[setupData.domain as keyof typeof CAREER_DOMAINS] || [];
  const experienceLevels = ['Junior', 'Mid-Level', 'Senior', 'Tech Lead'];
  const interviewTypes = ['Technical', 'Behavioral', 'System Design', 'Mixed Track'];
  const difficulties = ['Adaptive AI', 'Easy', 'Medium', 'Hard', 'Expert'];
  const questionCounts = [3, 5, 7, 10];

  const selectOption = (field: string, value: unknown) => {
    let updatedSetup = { ...setupData, [field]: value };

    // Automatically synchronize resolved interview mode preset if company changes
    if (field === 'company' && typeof value === 'string') {
      const mode = resolveInterviewMode({ company: value, role: (setupData.role as string) });
      updatedSetup = {
        ...updatedSetup,
        company: value,
        interviewModeId: mode.id,
        type: mode.interviewType,
        difficulty: mode.difficulty,
        duration: mode.duration,
      };
    }

    setSetupData(updatedSetup);

    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 text-left">
      <div className="text-center space-y-4">
        <SectionHeader
          title="Configure Career Prep Simulator"
          description="Select target company style, role, track, difficulty, and duration parameters for your AI mock assessment."
          className="text-center max-w-2xl mx-auto"
        />

        {/* Slim Step Progress Indicator Segment Dots */}
        <div className="flex flex-col items-center gap-2 max-w-md mx-auto pt-2">
          <div className="flex items-center justify-between w-full text-[10px] text-gray-400 font-mono font-bold">
            <span className="text-primary uppercase tracking-wider">Step {currentStep} of {totalSteps}</span>
            <span className="text-gray-500">
              {currentStep === 1
                ? 'Target Company'
                : currentStep === 2
                ? 'Target Role'
                : currentStep === 3
                ? 'Interview Track'
                : currentStep === 4
                ? 'Difficulty Level'
                : currentStep === 5
                ? 'Duration'
                : 'Review & Confirm'}
            </span>
          </div>

          <div className="grid grid-cols-6 gap-1.5 w-full">
            {[1, 2, 3, 4, 5, 6].map((stepNum) => (
              <button
                key={stepNum}
                type="button"
                onClick={() => setCurrentStep(stepNum)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  stepNum === currentStep
                    ? 'bg-gradient-to-r from-primary to-accent shadow-md shadow-primary/30 scale-105'
                    : stepNum < currentStep
                    ? 'bg-primary/50'
                    : 'bg-white/10'
                }`}
                title={`Jump to Step ${stepNum}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        <div className="lg:col-span-2 flex flex-col justify-between bg-[#111827]/40 border border-white/5 rounded-2xl p-6 relative">
          <div>
            <div className="flex justify-between items-center mb-6">
              <span className="text-[10px] text-gray-500 font-mono font-bold uppercase">
                Step {currentStep} of {totalSteps} &bull;{' '}
                {currentStep === 1
                  ? 'Target Company'
                  : currentStep === 2
                  ? 'Target Role'
                  : currentStep === 3
                  ? 'Interview Track'
                  : currentStep === 4
                  ? 'Difficulty Level'
                  : currentStep === 5
                  ? 'Duration'
                  : 'Mode Review & Confirmation'}
              </span>
              <span className="text-[10px] text-primary font-mono font-bold">
                {Math.round((currentStep / totalSteps) * 100)}% Complete
              </span>
            </div>

            <Progress value={currentStep} max={totalSteps} variant="primary" size="sm" className="mb-8" />


            <div className="min-h-[280px]">
              <AnimatePresence mode="wait">
                {currentStep === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-4"
                  >
                    <h3 className="text-sm font-heading font-bold text-white uppercase tracking-wider mb-4">
                      Select Target Company Preset
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {COMPANY_OPTIONS.map((comp) => (
                        <Card
                          key={comp}
                          onClick={() => selectOption('company', comp)}
                          variant={setupData.company === comp ? 'glow-primary' : 'glass'}
                          className={`hover:scale-[1.01] transition-all py-4 px-5 border flex items-center justify-between cursor-pointer ${
                            setupData.company === comp ? 'border-primary' : 'border-white/5'
                          }`}
                        >
                          <span className="text-xs font-semibold text-white">{comp} Style</span>
                          {setupData.company === comp && <FaCheckCircle className="text-primary text-sm" />}
                        </Card>
                      ))}
                    </div>

                    {setupData.company === 'Custom' && (
                      <div className="pt-3 border-t border-white/5 space-y-2">
                        <label className="text-xs text-gray-400 font-mono block">Specify Custom Target Company Name:</label>
                        <input
                          type="text"
                          value={(setupData.customCompany as string) || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSetupData({
                              ...setupData,
                              customCompany: val,
                            });
                          }}
                          placeholder="e.g. Netflix, Uber, OpenAI"
                          className="w-full rounded-xl bg-[#030712]/60 border border-white/10 px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 transition font-mono"
                        />
                      </div>
                    )}
                  </motion.div>
                )}

                {currentStep === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-4"
                  >
                    <h3 className="text-sm font-heading font-bold text-white uppercase tracking-wider mb-4">
                      Select Target Role
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                      {TARGET_ROLES.map((r) => (
                        <Card
                          key={r}
                          onClick={() => selectOption('role', r)}
                          variant={setupData.role === r ? 'glow-primary' : 'glass'}
                          className={`hover:scale-[1.01] transition-all py-3.5 px-4 border flex items-center justify-between cursor-pointer ${
                            setupData.role === r ? 'border-primary' : 'border-white/5'
                          }`}
                        >
                          <span className="text-xs font-semibold text-white">{r}</span>
                          {setupData.role === r && <FaCheckCircle className="text-primary text-sm" />}
                        </Card>
                      ))}
                    </div>

                    {setupData.role === 'Custom' && (
                      <div className="pt-3 border-t border-white/5 space-y-2">
                        <label className="text-xs text-gray-400 font-mono block">Specify Custom Target Role Name:</label>
                        <input
                          type="text"
                          value={(setupData.customRole as string) || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSetupData({
                              ...setupData,
                              customRole: val,
                            });
                          }}
                          placeholder="e.g. Distributed Systems Engineer"
                          className="w-full rounded-xl bg-[#030712]/60 border border-white/10 px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 transition font-mono"
                        />
                      </div>
                    )}
                  </motion.div>
                )}


                {currentStep === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-4"
                  >
                    <h3 className="text-sm font-heading font-bold text-white uppercase tracking-wider mb-4">
                      Select Interview Type / Track
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {INTERVIEW_TYPES.map((t) => (
                        <Card
                          key={t}
                          onClick={() => selectOption('type', t)}
                          variant={setupData.type === t ? 'glow-primary' : 'glass'}
                          className={`hover:scale-[1.01] transition-all py-4 px-5 border flex items-center justify-between cursor-pointer ${
                            setupData.type === t ? 'border-primary' : 'border-white/5'
                          }`}
                        >
                          <span className="text-xs font-semibold text-white">{t} Track</span>
                          {setupData.type === t && <FaCheckCircle className="text-primary text-sm" />}
                        </Card>
                      ))}
                    </div>
                  </motion.div>
                )}

                {currentStep === 4 && (
                  <motion.div
                    key="step4"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-4"
                  >
                    <h3 className="text-sm font-heading font-bold text-white uppercase tracking-wider mb-4">
                      Select Difficulty Mode
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {DIFFICULTIES.map((diff) => (
                        <Card
                          key={diff}
                          onClick={() => selectOption('difficulty', diff)}
                          variant={setupData.difficulty === diff ? 'glow-primary' : 'glass'}
                          className={`hover:scale-[1.01] transition-all py-4 px-5 border flex items-center justify-between cursor-pointer ${
                            setupData.difficulty === diff ? 'border-primary' : 'border-white/5'
                          }`}
                        >
                          <span className="text-xs font-semibold text-white">{diff}</span>
                          {setupData.difficulty === diff && <FaCheckCircle className="text-primary text-sm" />}
                        </Card>
                      ))}
                    </div>
                  </motion.div>
                )}

                {currentStep === 5 && (
                  <motion.div
                    key="step5"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-4"
                  >
                    <h3 className="text-sm font-heading font-bold text-white uppercase tracking-wider mb-4">
                      Select Interview Duration
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {DURATIONS.map((dur) => (
                        <Card
                          key={dur}
                          onClick={() => selectOption('duration', dur)}
                          variant={setupData.duration === dur ? 'glow-primary' : 'glass'}
                          className={`hover:scale-[1.01] transition-all py-6 px-4 border flex flex-col items-center justify-center gap-2 cursor-pointer text-center ${
                            setupData.duration === dur ? 'border-primary' : 'border-white/5'
                          }`}
                        >
                          <span className="text-2xl font-heading font-extrabold text-white">{dur}</span>
                          <span className="text-[10px] text-gray-400 font-mono uppercase">Minutes</span>
                        </Card>
                      ))}
                    </div>
                  </motion.div>
                )}

                {currentStep === 6 && (
                  <motion.div
                    key="step6"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-4"
                  >
                    <h3 className="text-sm font-heading font-bold text-white uppercase tracking-wider mb-2">
                      Review Simulation Parameters
                    </h3>
                    <InterviewModePreviewCard setupData={setupData} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="pt-6 border-t border-white/5 space-y-3">
            <div className="flex justify-between items-center">
              <Button
                onClick={handleBack}
                disabled={currentStep === 1}
                variant="ghost"
                size="sm"
                icon={FaChevronLeft}
              >
                Previous Step
              </Button>
              <Button
                onClick={handleNext}
                disabled={currentStep === totalSteps}
                variant="glass"
                size="sm"
              >
                <span>Next Step</span>
                <FaChevronRight size={10} className="ml-1" />
              </Button>
            </div>

            {/* Keyboard Shortcuts Hint */}
            <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-gray-500 pt-1">
              <FaKeyboard className="text-gray-600 text-xs" />
              <span>Keyboard Shortcuts: Press <kbd className="px-1 py-0.5 bg-white/10 rounded text-gray-300">Enter</kbd> for Next, <kbd className="px-1 py-0.5 bg-white/10 rounded text-gray-300">←</kbd> or <kbd className="px-1 py-0.5 bg-white/10 rounded text-gray-300">Backspace</kbd> for Previous</span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card variant="glass" className="p-6 space-y-6">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider pb-3 border-b border-white/5">
              Hardware Diagnostics
            </h3>

            <div className="space-y-4">
              <div className="relative aspect-video rounded-xl bg-[#030712] border border-white/5 overflow-hidden flex items-center justify-center">
                {stream && cameraPermission === 'granted' ? (
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-600">
                    <FaVideoSlash className="text-2xl" />
                    <span className="text-[10px] font-mono">Camera Offline</span>
                  </div>
                )}
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span>Camera Interface:</span>
                  <span
                    className={
                      cameraPermission === 'granted' ? 'text-emerald-400 font-semibold' : 'text-gray-500 font-medium'
                    }
                  >
                    {cameraPermission === 'granted' ? 'Online' : 'Unchecked'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Audio Level:</span>
                  <span
                    className={
                      micPermission === 'granted' ? 'text-emerald-400 font-semibold' : 'text-gray-500 font-medium'
                    }
                  >
                    {micPermission === 'granted' ? 'Online' : 'Unchecked'}
                  </span>
                </div>

                {micPermission === 'granted' && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[9px] font-mono">
                      <span>MIC AMPLITUDE (REAL-TIME)</span>
                      <span className="text-emerald-400 font-bold">{audioLevel}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-100 ease-out"
                        style={{ width: `${audioLevel}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 pt-6">
              {!deviceChecked ? (
                <Button
                  onClick={startDeviceCheck}
                  disabled={deviceChecking}
                  variant="glass"
                  size="sm"
                  className="w-full"
                >
                  {deviceChecking ? 'Querying Devices...' : 'Run Diagnostics'}
                </Button>
              ) : (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                  <div className="h-4 w-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center shrink-0">
                    ✓
                  </div>
                  <p className="text-[10px] text-emerald-400/90 leading-tight">
                    Diagnostics complete. Media interfaces ready.
                  </p>
                </div>
              )}

              <Button
                onClick={handleStartInterview}
                variant="primary"
                size="lg"
                className="w-full bg-gradient-to-r from-primary via-secondary to-accent text-white shadow-xl hover:shadow-primary/20"
                icon={FaPlay}
              >
                Begin Assessment
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
