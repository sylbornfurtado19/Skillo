'use client';

import React, { useState, useEffect, useRef, useId } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

import { SectionHeader } from '../components/ui/FeedbackHelpers';
import { Progress } from '../components/ui/Loader';
import { Skeleton } from '../components/ui/Skeleton';
import { InterviewModePreviewCard } from '../components/interview/InterviewModePreviewCard';
import { resolveInterviewMode } from '../types/interviewModes';

import { getAuthToken } from '../services/auth';
import { generateStudyPlan } from '../lib/services/studyPlan';

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
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const {
    resumeData,
    setupData,
    setSetupData,
    setQuestions,
    setCurrentQuestionIndex,
    setAnswers,
    setPastCritiques,
    setRecalledMemoryNotice,
    recalledMemoryNotice,
  } = useInterview();

  const customCompanyId = useId();
  const customRoleId = useId();

  const [startingSession, setStartingSession] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const fromStudyPlan = searchParams.get('from') === 'plan';

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
      if (fromStudyPlan && data?.skillMemoryStore) {
        const nextTask = generateStudyPlan(data.skillMemoryStore)[0]?.tasks[0];
        const skill = nextTask
          ? data.skillMemoryStore.nodes[nextTask.skillId]
          : undefined;

        if (nextTask && skill) {
          const matchingDomain = Object.entries(CAREER_DOMAINS).find(([, roles]) =>
            roles.some((role) => role.toLocaleLowerCase() === skill.skillName.toLocaleLowerCase())
          )?.[0] ?? 'Computer Science';
          const matchingRole = CAREER_DOMAINS[matchingDomain]?.find(
            (role) => role.toLocaleLowerCase() === skill.skillName.toLocaleLowerCase()
          );
          const difficultyByProficiency = {
            NOVICE: 'Easy',
            DEVELOPING: 'Medium',
            PROFICIENT: 'Hard',
            MASTERED: 'Expert',
          } as const;
          const role = matchingRole ?? 'Custom';

          setSetupData({
            ...setupData,
            domain: matchingDomain,
            role,
            ...(role === 'Custom' ? { customRole: skill.skillName } : {}),
            difficulty: difficultyByProficiency[skill.proficiencyLevel],
            experienceLevel: skill.proficiencyLevel === 'NOVICE' ? 'Junior' : 'Senior',
            focusAreas: [skill.skillName],
          });
          setCurrentStep(2);
          return;
        }
      }
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
  }, [user?.id, fromStudyPlan]);

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

  const handleStartInterview = async () => {
    setStartingSession(true);
    // Clear persisted wizard progress upon starting session
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(SETUP_STORAGE_KEY);
      } catch (err) {
        console.warn('Failed to clear setup state:', err);
      }
    }

    try {
      const token = await getAuthToken();

      const res = await fetch('/api/interview/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ setupData }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data.questions) && json.data.questions.length > 0) {
          setQuestions(json.data.questions);
          if (Array.isArray(json.data.pastCritiques)) {
            setPastCritiques(json.data.pastCritiques);
          }
          if (json.data.recalledMemoryNotice) {
            setRecalledMemoryNotice(json.data.recalledMemoryNotice);
          }
          setCurrentQuestionIndex(0);
          setAnswers([]);
          if (stream) stream.getTracks().forEach((track) => track.stop());
          router.push('/interview');
          return;
        }
      }
    } catch (err) {
      console.warn('[CareerSetup] Setup API fallback to local preset pool:', err);
      setSetupError('Using local simulation fallback due to network response.');
    }

    // Fallback Question Pool Selection if API call is skipped or fails
    const questList = getQuestionsForSetup(setupData);
    const limitedQuestions = questList.slice(0, setupData.questionCount);
    setQuestions(limitedQuestions);
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
      <div className="bg-[var(--bg-surface)] rounded-2xl p-8 border border-[var(--danger)]/20 bg-[var(--danger)]/5 text-center max-w-md mx-auto mt-12 space-y-6 shadow-[var(--shadow)]">
        <div className="h-12 w-12 rounded-full bg-[var(--danger)]/10 border border-[var(--danger)]/20 flex items-center justify-center text-[var(--danger)] text-xl mx-auto">
          <FaExclamationTriangle />
        </div>
        <h3 className="text-lg font-heading font-bold text-[var(--text-primary)]">Resume Required</h3>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          You must upload your resume and specify job details before you can configure or start mock interview sessions.
        </p>
        <Button onClick={() => router.push('/resume')} variant="primary" size="md">
          Go to Upload Page
        </Button>
      </div>
    );
  }

  
  
  
  
  
  

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

  if (startingSession) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-12 pt-6 text-left">
        <div className="text-center space-y-2">
          <Skeleton variant="text" className="h-7 w-64 mx-auto" />
          <Skeleton variant="text" className="h-4 w-96 mx-auto" />
        </div>
        <div className="bg-bg-surface rounded-2xl p-8 border border-border shadow-soft space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-border">
            <Skeleton variant="text" className="h-5 w-48" />
            <Skeleton variant="text" className="h-5 w-24" />
          </div>
          <div className="space-y-4">
            <Skeleton variant="rect" className="h-28 rounded-xl" />
            <Skeleton variant="rect" className="h-28 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 text-left">
      {setupError && (
        <div className="bg-danger/10 border border-danger/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-3">
            <FaExclamationTriangle className="text-danger text-lg shrink-0" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold text-text-primary">Setup Configuration Notice</p>
              <p className="text-xs text-text-secondary">{setupError}</p>
            </div>
          </div>
          <Button onClick={() => setSetupError(null)} variant="danger" size="sm">
            Dismiss
          </Button>
        </div>
      )}

      <div className="text-center space-y-4">
        <SectionHeader
          title="Configure Career Prep Simulator"
          description="Select target company style, role, track, difficulty, and duration parameters for your AI mock assessment."
          className="text-center max-w-2xl mx-auto"
        />

        {/* Slim Step Progress Indicator Segment Dots */}
        <div className="flex flex-col items-center gap-2 max-w-md mx-auto pt-2">
          <div className="flex items-center justify-between w-full text-xs text-text-secondary font-mono font-bold">
            <span className="text-primary uppercase tracking-wider">Step {currentStep} of {totalSteps}</span>
            <span className="text-text-secondary">
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
            {[1, 2, 3, 4, 5, 6].map((stepNum) => {
              const stepTitles = ['Target Company', 'Target Role', 'Interview Track', 'Difficulty Level', 'Duration', 'Review & Confirm'];
              return (
                <button
                  key={stepNum}
                  type="button"
                  onClick={() => setCurrentStep(stepNum)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    stepNum === currentStep
                      ? 'bg-primary shadow-sm scale-105'
                      : stepNum < currentStep
                      ? 'bg-primary-soft'
                      : 'bg-border'
                  }`}
                  aria-label={`Jump to Step ${stepNum}: ${stepTitles[stepNum - 1]}`}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        <div className="lg:col-span-2 flex flex-col justify-between bg-bg-surface border border-border rounded-2xl p-6 relative shadow-soft">
          <div>
            <div className="flex justify-between items-center mb-6">
              <span className="text-xs text-text-secondary font-mono font-bold uppercase">
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
              <span className="text-xs text-primary font-mono font-bold">
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
                    <h3 className="text-sm font-heading font-bold text-text-primary uppercase tracking-wider mb-4">
                      Select Target Company Preset
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {COMPANY_OPTIONS.map((comp) => (
                        <Card
                          key={comp}
                          onClick={() => selectOption('company', comp)}
                          variant="default"
                          className={`hover:scale-[1.01] transition-all py-4 px-5 border flex items-center justify-between cursor-pointer ${
                            setupData.company === comp ? 'border-primary bg-primary-soft text-primary' : 'border-border text-text-primary'
                          }`}
                        >
                          <span className="text-xs font-semibold">{comp} Style</span>
                          {setupData.company === comp && <FaCheckCircle className="text-primary text-sm" aria-hidden="true" />}
                        </Card>
                      ))}
                    </div>

                    {setupData.company === 'Custom' && (
                      <div className="pt-3 border-t border-border space-y-2">
                        <label htmlFor={customCompanyId} className="text-xs text-text-secondary font-mono block">
                          Specify Custom Target Company Name:
                        </label>
                        <input
                          id={customCompanyId}
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
                          className="w-full rounded-xl bg-bg-surface-alt border border-border px-4 py-2.5 text-xs text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary transition font-mono"
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
                    <h3 className="text-sm font-heading font-bold text-text-primary uppercase tracking-wider mb-4">
                      Select Target Role
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                      {TARGET_ROLES.length > 0 ? (
                        TARGET_ROLES.map((r) => (
                          <Card
                            key={r}
                            onClick={() => selectOption('role', r)}
                            variant="default"
                            className={`hover:scale-[1.01] transition-all py-3.5 px-4 border flex items-center justify-between cursor-pointer ${
                              setupData.role === r ? 'border-primary bg-primary-soft text-primary' : 'border-border text-text-primary'
                            }`}
                          >
                            <span className="text-xs font-semibold">{r}</span>
                            {setupData.role === r && <FaCheckCircle className="text-primary text-sm" aria-hidden="true" />}
                          </Card>
                        ))
                      ) : (
                        <div className="col-span-2 p-6 bg-bg-surface-alt rounded-xl border border-border text-center space-y-3">
                          <p className="text-xs text-text-secondary">No roles found for this configuration.</p>
                          <Button
                            onClick={() => selectOption('role', 'Software Engineer')}
                            variant="primary"
                            size="sm"
                          >
                            Select Software Engineer
                          </Button>
                        </div>
                      )}
                    </div>

                    {setupData.role === 'Custom' && (
                      <div className="pt-3 border-t border-border space-y-2">
                        <label htmlFor={customRoleId} className="text-xs text-text-secondary font-mono block">
                          Specify Custom Target Role Name:
                        </label>
                        <input
                          id={customRoleId}
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
                          className="w-full rounded-xl bg-bg-surface-alt border border-border px-4 py-2.5 text-xs text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary transition font-mono"
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
                    <h3 className="text-sm font-heading font-bold text-text-primary uppercase tracking-wider mb-4">
                      Select Interview Type / Track
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {INTERVIEW_TYPES.map((t) => (
                        <Card
                          key={t}
                          onClick={() => selectOption('type', t)}
                          variant="default"
                          className={`hover:scale-[1.01] transition-all py-4 px-5 border flex items-center justify-between cursor-pointer ${
                            setupData.type === t ? 'border-primary bg-primary-soft text-primary' : 'border-border text-text-primary'
                          }`}
                        >
                          <span className="text-xs font-semibold">{t} Track</span>
                          {setupData.type === t && <FaCheckCircle className="text-primary text-sm" aria-hidden="true" />}
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
                    <h3 className="text-sm font-heading font-bold text-text-primary uppercase tracking-wider mb-4">
                      Select Difficulty Mode
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {DIFFICULTIES.map((diff) => (
                        <Card
                          key={diff}
                          onClick={() => selectOption('difficulty', diff)}
                          variant="default"
                          className={`hover:scale-[1.01] transition-all py-4 px-5 border flex items-center justify-between cursor-pointer ${
                            setupData.difficulty === diff ? 'border-primary bg-primary-soft text-primary' : 'border-border text-text-primary'
                          }`}
                        >
                          <span className="text-xs font-semibold">{diff}</span>
                          {setupData.difficulty === diff && <FaCheckCircle className="text-primary text-sm" aria-hidden="true" />}
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
                    <h3 className="text-sm font-heading font-bold text-text-primary uppercase tracking-wider mb-4">
                      Select Interview Duration
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {DURATIONS.map((dur) => (
                        <Card
                          key={dur}
                          onClick={() => selectOption('duration', dur)}
                          variant="default"
                          className={`hover:scale-[1.01] transition-all py-6 px-4 border flex flex-col items-center justify-center gap-2 cursor-pointer text-center ${
                            setupData.duration === dur ? 'border-primary bg-primary-soft text-primary' : 'border-border text-text-primary'
                          }`}
                        >
                          <span className="text-2xl font-heading font-extrabold">{dur}</span>
                          <span className="text-xs text-text-secondary font-mono uppercase">Minutes</span>
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
                    <h3 className="text-sm font-heading font-bold text-text-primary uppercase tracking-wider mb-2">
                      Review Simulation Parameters
                    </h3>
                    <InterviewModePreviewCard setupData={setupData} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="pt-6 border-t border-border space-y-3">
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
                variant="primary"
                size="sm"
                icon={FaChevronRight}
              >
                Next Step
              </Button>
            </div>

            {/* Keyboard Shortcuts Hint */}
            <div className="flex items-center justify-center gap-1.5 text-xs font-mono text-text-secondary pt-1">
              <FaKeyboard className="text-text-secondary text-xs" aria-hidden="true" />
              <span>Keyboard Shortcuts: Press <kbd className="px-1 py-0.5 bg-bg-surface-alt border border-border rounded text-text-primary">Enter</kbd> for Next, <kbd className="px-1 py-0.5 bg-bg-surface-alt border border-border rounded text-text-primary">←</kbd> or <kbd className="px-1 py-0.5 bg-bg-surface-alt border border-border rounded text-text-primary">Backspace</kbd> for Previous</span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card variant="default" className="p-6 space-y-6">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider pb-3 border-b border-border">
              Hardware Diagnostics
            </h3>

            <div className="space-y-4">
              <div className="relative aspect-video rounded-xl bg-bg-surface-alt border border-border overflow-hidden flex items-center justify-center">
                {stream && cameraPermission === 'granted' ? (
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-text-secondary">
                    <FaVideoSlash className="text-2xl" aria-hidden="true" />
                    <span className="text-xs font-mono">Camera Offline</span>
                  </div>
                )}
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Camera Interface:</span>
                  <span
                    className={
                      cameraPermission === 'granted' ? 'text-success font-semibold' : 'text-text-secondary font-medium'
                    }
                  >
                    {cameraPermission === 'granted' ? 'Online' : 'Unchecked'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Audio Level:</span>
                  <span
                    className={
                      micPermission === 'granted' ? 'text-success font-semibold' : 'text-text-secondary font-medium'
                    }
                  >
                    {micPermission === 'granted' ? 'Online' : 'Unchecked'}
                  </span>
                </div>

                {micPermission === 'granted' && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-text-secondary">MIC AMPLITUDE (REAL-TIME)</span>
                      <span className="text-success font-bold">{audioLevel}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-success transition-all duration-100 ease-out"
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
                  variant="primary"
                  size="sm"
                  className="w-full"
                >
                  {deviceChecking ? 'Querying Devices...' : 'Run Diagnostics'}
                </Button>
              ) : (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-success/10 border border-success/20">
                  <div className="h-4 w-4 rounded-full bg-success/20 text-success text-xs flex items-center justify-center shrink-0">
                    <span aria-hidden="true">✓</span>
                  </div>
                  <p className="text-xs text-success leading-tight">
                    Diagnostics complete. Media interfaces ready.
                  </p>
                </div>
              )}

              {recalledMemoryNotice && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-primary-soft border border-primary/20 text-primary text-xs font-mono">
                  <span>🧠</span>
                  <span>{recalledMemoryNotice}</span>
                </div>
              )}

              <Button
                onClick={handleStartInterview}
                disabled={startingSession}
                variant="primary"
                size="lg"
                className="w-full"
                icon={FaPlay}
              >
                {startingSession ? 'Conditioning Interview Memory...' : 'Begin Assessment'}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
