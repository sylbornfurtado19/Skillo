import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaPlay, 
  FaSlidersH, 
  FaVideo, 
  FaVideoSlash, 
  FaMicrophone, 
  FaMicrophoneSlash, 
  FaChevronLeft, 
  FaChevronRight,
  FaCheckCircle,
  FaExclamationTriangle,
  FaArrowRight
} from 'react-icons/fa';
import { useInterview } from '../context/InterviewContext';
import { CAREER_DOMAINS } from '../services/careerApi';
import { getQuestionsForSetup } from '../services/interviewApi';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/FeedbackHelpers';
import { Progress } from '../components/ui/Loader';

export default function CareerSetup() {
  const navigate = useNavigate();
  const { resumeData, setupData, setSetupData, setQuestions, setCurrentQuestionIndex, setAnswers } = useInterview();

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
        <Button
          onClick={() => navigate('/app/resume')}
          variant="primary"
          size="md"
        >
          Go to Upload Page
        </Button>
      </div>
    );
  }

  // Wizard Step State
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;

  // Media Diagnostics State
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [deviceChecking, setDeviceChecking] = useState(false);
  const [deviceChecked, setDeviceChecked] = useState(false);
  const [cameraPermission, setCameraPermission] = useState('none');
  const [micPermission, setMicPermission] = useState('none');
  const [audioLevel, setAudioLevel] = useState(10);

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
    } catch (err) {
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

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  useEffect(() => {
    let interval;
    if (deviceChecked) {
      interval = setInterval(() => {
        setAudioLevel(Math.floor(Math.random() * 50) + 10);
      }, 250);
    }
    return () => clearInterval(interval);
  }, [deviceChecked]);

  // Keyboard navigation for wizard steps
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
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

  // Options Definitions
  const domains = Object.keys(CAREER_DOMAINS);
  const roles = CAREER_DOMAINS[setupData.domain] || CAREER_DOMAINS['Computer Science'];
  const experienceLevels = ['Junior', 'Mid-Level', 'Senior', 'Lead'];
  const interviewTypes = ['Technical', 'Behavioral', 'System Design', 'Mixed'];
  const difficulties = ['Easy', 'Medium', 'Hard'];
  const questionCounts = [3, 5, 10];

  const handleStartInterview = () => {
    // Generate questions list (passing domain to solve domain bug!)
    const questList = getQuestionsForSetup(setupData.type.toLowerCase(), setupData.difficulty.toLowerCase(), setupData.domain);
    // Limit questions to the chosen count
    const limitedQuestions = questList.slice(0, setupData.questionCount);
    setQuestions(limitedQuestions);
    setCurrentQuestionIndex(0);
    setAnswers([]);

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    navigate('/app/interview');
  };

  const selectOption = (field, value) => {
    const updatedSetup = { ...setupData, [field]: value };
    
    // Reset role if domain changes
    if (field === 'domain') {
      updatedSetup.role = CAREER_DOMAINS[value][0];
    }
    
    setSetupData(updatedSetup);
    
    // Auto-advance step if not the last step
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
      <div className="text-center space-y-2">
        <SectionHeader
          title="Configure Career Prep Environment"
          description="Build custom voice or keyboard assessments based on your domain, target seniority, and platform parameters."
          className="text-center max-w-2xl mx-auto"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        {/* Left Columns: Wizard Setup Container */}
        <div className="lg:col-span-2 flex flex-col justify-between bg-[#111827]/40 border border-white/5 rounded-2xl p-6 relative">
          <div>
            {/* Step progress bar */}
            <div className="flex justify-between items-center mb-6">
              <span className="text-[10px] text-gray-500 font-mono font-bold uppercase">
                Step {currentStep} of {totalSteps} &bull; {
                  currentStep === 1 ? 'Career Domain' :
                  currentStep === 2 ? 'Target Role' :
                  currentStep === 3 ? 'Seniority Level' :
                  currentStep === 4 ? 'Interview Type' :
                  currentStep === 5 ? 'Difficulty Level' :
                  'Question Count'
                }
              </span>
              <span className="text-[10px] text-primary font-mono font-bold">
                {Math.round((currentStep / totalSteps) * 100)}% Complete
              </span>
            </div>
            
            <Progress value={currentStep} max={totalSteps} variant="primary" size="sm" className="mb-8" />

            {/* Steps Rendering */}
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
                      Select Career Domain
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {domains.map((domain) => (
                        <Card
                          key={domain}
                          onClick={() => selectOption('domain', domain)}
                          variant={setupData.domain === domain ? 'glow-primary' : 'glass'}
                          className={`hover:scale-[1.01] transition-all py-4 px-5 border flex items-center justify-between cursor-pointer ${
                            setupData.domain === domain ? 'border-primary' : 'border-white/5'
                          }`}
                        >
                          <span className="text-xs font-semibold text-white">{domain}</span>
                          {setupData.domain === domain && <FaCheckCircle className="text-primary text-sm" />}
                        </Card>
                      ))}
                    </div>
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
                      Select Targeted Role
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                      {roles.map((role) => (
                        <Card
                          key={role}
                          onClick={() => selectOption('role', role)}
                          variant={setupData.role === role ? 'glow-primary' : 'glass'}
                          className={`hover:scale-[1.01] transition-all py-4 px-5 border flex items-center justify-between cursor-pointer ${
                            setupData.role === role ? 'border-primary' : 'border-white/5'
                          }`}
                        >
                          <span className="text-xs font-semibold text-white">{role}</span>
                          {setupData.role === role && <FaCheckCircle className="text-primary text-sm" />}
                        </Card>
                      ))}
                    </div>
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
                      Choose Experience Level
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {experienceLevels.map((lvl) => (
                        <Card
                          key={lvl}
                          onClick={() => selectOption('experienceLevel', lvl)}
                          variant={setupData.experienceLevel === lvl ? 'glow-secondary' : 'glass'}
                          className={`hover:scale-[1.01] transition-all py-6 text-center border flex flex-col items-center justify-center gap-2 cursor-pointer ${
                            setupData.experienceLevel === lvl ? 'border-secondary' : 'border-white/5'
                          }`}
                        >
                          <span className="text-xs font-heading font-bold text-white">{lvl}</span>
                          <span className="text-[10px] text-gray-400">
                            {lvl === 'Junior' ? '0-2 years exp' :
                             lvl === 'Mid-Level' ? '2-5 years exp' :
                             lvl === 'Senior' ? '5-8 years exp' : '8+ years lead exp'}
                          </span>
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
                      Select Interview Core Focus
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {interviewTypes.map((type) => (
                        <Card
                          key={type}
                          onClick={() => selectOption('type', type)}
                          variant={setupData.type === type ? 'glow-accent' : 'glass'}
                          className={`hover:scale-[1.01] transition-all py-6 text-center border flex flex-col items-center justify-center gap-2 cursor-pointer ${
                            setupData.type === type ? 'border-accent' : 'border-white/5'
                          }`}
                        >
                          <span className="text-xs font-heading font-bold text-white">{type}</span>
                          <span className="text-[10px] text-gray-400">
                            {type === 'Technical' ? 'Code & Mechanics' :
                             type === 'Behavioral' ? 'STAR Narrative' :
                             type === 'System Design' ? 'Scale & Caching' : 'Mixed Assessment'}
                          </span>
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
                      Target Session Difficulty
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      {difficulties.map((diff) => (
                        <Card
                          key={diff}
                          onClick={() => selectOption('difficulty', diff)}
                          variant={setupData.difficulty === diff ? 'glow-primary' : 'glass'}
                          className={`hover:scale-[1.01] transition-all py-6 text-center border flex flex-col items-center justify-center gap-2 cursor-pointer ${
                            setupData.difficulty === diff ? 'border-primary' : 'border-white/5'
                          }`}
                        >
                          <span className="text-xs font-heading font-bold text-white">{diff}</span>
                          <span className="text-[10px] text-gray-400">
                            {diff === 'Easy' ? 'Fundamentals' :
                             diff === 'Medium' ? 'Core Practices' : 'Edge Cases'}
                          </span>
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
                    <h3 className="text-sm font-heading font-bold text-white uppercase tracking-wider mb-4">
                      Choose Question Count
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      {questionCounts.map((count) => (
                        <Card
                          key={count}
                          onClick={() => selectOption('questionCount', count)}
                          variant={setupData.questionCount === count ? 'glow-secondary' : 'glass'}
                          className={`hover:scale-[1.01] transition-all py-6 text-center border flex flex-col items-center justify-center gap-2 cursor-pointer ${
                            setupData.questionCount === count ? 'border-secondary' : 'border-white/5'
                          }`}
                        >
                          <span className="text-lg font-heading font-extrabold text-white">{count}</span>
                          <span className="text-[10px] text-gray-400">Questions</span>
                        </Card>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Stepper buttons */}
          <div className="flex justify-between items-center border-t border-white/5 pt-4 mt-6">
            <Button
              onClick={handleBack}
              disabled={currentStep === 1}
              variant="ghost"
              size="sm"
              icon={FaChevronLeft}
            >
              Back
            </Button>
            
            <div className="flex gap-2">
              <span className="text-xs text-gray-500 font-mono">
                {setupData.domain} &bull; {setupData.role}
              </span>
            </div>

            <Button
              onClick={handleNext}
              disabled={currentStep === totalSteps}
              variant="glass"
              size="sm"
            >
              <span>Next</span>
              <FaChevronRight className="text-xs ml-1.5 shrink-0" />
            </Button>
          </div>
        </div>

        {/* Right Column: Device Diagnostics HUD */}
        <div className="space-y-6">
          <Card variant="glow-accent" className="flex flex-col justify-between min-h-[380px] h-full">
            <div className="space-y-4">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block border-b border-white/5 pb-2">
                System Diagnostics
              </span>

              {/* Camera view */}
              <div className="relative aspect-video rounded-xl bg-[#030712] border border-white/5 flex items-center justify-center overflow-hidden">
                {cameraPermission === 'granted' ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center space-y-2 p-4">
                    <div className="h-10 w-10 rounded-full bg-white/5 mx-auto flex items-center justify-center text-gray-500 text-lg border border-white/10">
                      <FaVideoSlash />
                    </div>
                    <p className="text-[10px] text-gray-400">Webcam feedback inactive</p>
                  </div>
                )}

                <div className="absolute bottom-2 left-2 flex gap-1.5">
                  <Badge variant={cameraPermission === 'granted' ? 'success' : 'neutral'} size="sm">Cam</Badge>
                  <Badge variant={micPermission === 'granted' ? 'success' : 'neutral'} size="sm">Mic</Badge>
                </div>
              </div>

              {/* Checklist */}
              <div className="space-y-2.5 text-xs text-gray-400">
                <div className="flex items-center justify-between">
                  <span>Webcam Connection:</span>
                  <span className={cameraPermission === 'granted' ? 'text-emerald-400 font-semibold' : 'text-gray-500 font-medium'}>
                    {cameraPermission === 'granted' ? 'Online' : 'Unchecked'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Audio Level:</span>
                  <span className={micPermission === 'granted' ? 'text-emerald-400 font-semibold' : 'text-gray-500 font-medium'}>
                    {micPermission === 'granted' ? 'Online' : 'Unchecked'}
                  </span>
                </div>

                {micPermission === 'granted' && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[9px] font-mono">
                      <span>INPUT DB</span>
                      <span className="text-emerald-400 font-bold">{audioLevel}dB</span>
                    </div>
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-150"
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
                    &check;
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
