'use client';

import React from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { FaStepForward, FaInfoCircle, FaExclamationTriangle, FaVolumeUp } from 'react-icons/fa';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

export interface SessionInterviewerCardProps {
  persona: {
    name: string;
    avatar: string;
    role: string;
    company: string;
    borderColor: string;
  };
  interviewerSpeaking: boolean;
  followUpBadgeSet: Set<number>;
  currentQuestionIndex: number;
  pastCritiques: Array<{ summary?: string }> | null;
  recalledMemoryNotice: string | null;
  cancelSpeechNarration: () => void;
  voiceRate: number;
  subtitlesEnabled: boolean;
  questionSentences: string[];
  spokenSentenceIndex: number;
  currentQuestion: {
    question: string;
    hint?: string;
    duration: number;
  };
  showHint: boolean;
  setShowHint: (show: boolean) => void;
  focusAreasList: string[];
  setupData: {
    type?: string;
    role?: string;
  };
  isFallback?: boolean;
  /** Reads the current question aloud again (also used when autoplay is blocked). */
  onReplayQuestion?: () => void;
  /** The browser or speech engine did not play the question automatically. */
  narrationBlocked?: boolean;
  /** False when this browser has no speech synthesis. */
  ttsSupported?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const SessionInterviewerCard = React.memo(function SessionInterviewerCard({
  persona,
  interviewerSpeaking,
  followUpBadgeSet,
  currentQuestionIndex,
  pastCritiques,
  recalledMemoryNotice,
  cancelSpeechNarration,
  voiceRate,
  subtitlesEnabled,
  questionSentences,
  spokenSentenceIndex,
  currentQuestion,
  showHint,
  setShowHint,
  focusAreasList,
  setupData,
  isFallback,
  onReplayQuestion,
  narrationBlocked = false,
  ttsSupported = true,
  className = '',
  children,
}: SessionInterviewerCardProps) {
  return (
    <div className={`space-y-6 flex flex-col justify-between ${className}`} data-secure="content">
      <Card variant="default" className="space-y-4 flex-1 flex flex-col justify-between">
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
                      className="absolute inset-0 rounded-2xl border-2 border-success pointer-events-none"
                    />
                  )}
                </AnimatePresence>
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-border shadow-soft z-10 shrink-0">
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
                <h3 className="font-heading font-bold text-text-primary leading-none">{persona.name}</h3>
                <p className="text-xs text-text-secondary font-mono uppercase">
                  {persona.role} &bull; {persona.company}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                  {isFallback && (
                    <Badge variant="warning" size="sm" className="bg-amber-500/15 border-amber-500/30 text-amber-500 font-mono font-bold flex items-center gap-1">
                      <FaExclamationTriangle size={10} aria-hidden="true" />
                      <span>Offline estimate, not a live AI evaluation</span>
                    </Badge>
                  )}
                  <Badge variant={interviewerSpeaking ? 'primary' : 'neutral'} size="sm">
                    {interviewerSpeaking ? 'Speaking Voice...' : 'Listening'}
                  </Badge>
                  {followUpBadgeSet.has(currentQuestionIndex) && (
                    <Badge variant="warning" size="sm" className="bg-warning/15 border-warning/30 text-warning font-mono font-bold">
                      ⚡ AI Real-Time Follow-up
                    </Badge>
                  )}
                  {pastCritiques && pastCritiques.length > 0 && (
                    <Badge variant="primary" size="sm" className="bg-primary-soft border-primary/30 text-primary font-mono font-bold flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
                      <span>🧠 Memory Active ({pastCritiques.length})</span>
                    </Badge>
                  )}
                </div>
                {recalledMemoryNotice && (
                  <p className="text-xs text-primary font-mono bg-primary-soft/50 border border-primary/20 rounded px-1.5 py-0.5 mt-1 truncate max-w-[240px]" title={recalledMemoryNotice}>
                    🧠 Recalled: {pastCritiques?.[0]?.summary || recalledMemoryNotice}
                  </p>
                )}
              </div>
            </div>

            {/* Skip Narration / Mute Button */}
            {interviewerSpeaking && (
              <button
                type="button"
                onClick={cancelSpeechNarration}
                title="Skip voice narration"
                aria-label="Skip voice narration"
                className="flex items-center gap-1 text-xs font-mono text-text-secondary hover:text-text-primary bg-bg-surface-alt border border-border hover:bg-border/40 px-2 py-1 rounded-lg transition cursor-pointer shrink-0"
              >
                <FaStepForward size={10} aria-hidden="true" />
                <span>Skip Voice</span>
              </button>
            )}
          </div>

          {/* Children slot for biometric HUDs, Camera preview, and Sync tracker */}
          {children}

          <div className="bg-bg-surface-alt rounded-xl p-5 border border-border mt-4 min-h-[120px] flex flex-col justify-center">
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
                    <span className="text-xs text-primary font-mono font-bold uppercase">
                      AI Voice Narration Active ({voiceRate}x Speed)
                    </span>
                  </div>

                  {/* Subtitles Animation */}
                  {subtitlesEnabled ? (
                    <div className="text-xs sm:text-sm font-heading font-medium leading-relaxed">
                      {questionSentences.map((sentence, idx) => (
                        <span
                          key={idx}
                          className={`transition-all duration-300 ${
                            idx === spokenSentenceIndex
                              ? 'text-primary font-bold bg-primary-soft px-1 rounded border-b border-primary'
                              : 'text-text-secondary opacity-70'
                          }`}
                        >
                          {sentence}{' '}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs sm:text-sm font-heading font-medium text-text-primary leading-relaxed">
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
                    className="text-xs sm:text-sm font-heading font-medium text-text-primary leading-relaxed"
                  >
                    {currentQuestion.question}
                  </motion.p>

                  {currentQuestion.hint && (
                    <div className="pt-2 border-t border-border">
                      <button
                        type="button"
                        onClick={() => setShowHint(!showHint)}
                        aria-expanded={showHint}
                        className="text-xs text-primary hover:text-primary-hover font-semibold uppercase tracking-wider transition cursor-pointer"
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
                            className="text-xs text-text-secondary mt-2 leading-relaxed bg-bg-surface p-2.5 rounded-lg border border-border font-mono overflow-hidden"
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

            {!ttsSupported && (
              <p className="mt-3 text-xs text-warning flex items-center gap-1.5" role="status">
                <FaExclamationTriangle aria-hidden="true" />
                <span>Voice playback isn&apos;t supported in this browser. Please read the question on screen.</span>
              </p>
            )}

            {ttsSupported && onReplayQuestion && !interviewerSpeaking && (
              <div className="mt-3 flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={onReplayQuestion}
                  aria-label="Hear the question again"
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-hover bg-bg-surface border border-border hover:border-primary px-3 py-1.5 rounded-lg transition cursor-pointer"
                >
                  <FaVolumeUp aria-hidden="true" />
                  <span>{narrationBlocked ? 'Click to hear the question' : 'Replay question'}</span>
                </button>
                {narrationBlocked && (
                  <span className="text-xs text-text-secondary" role="status">
                    Your browser didn&apos;t play the voice automatically.
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="pt-6 border-t border-border space-y-2">
          <span className="text-xs text-text-secondary font-bold uppercase tracking-wider block">
            Question Focus Elements
          </span>
          <div className="flex flex-wrap gap-1.5">
            {focusAreasList.map((focus) => (
              <Badge key={focus} variant="primary" size="sm">
                {focus}
              </Badge>
            ))}
          </div>
        </div>
      </Card>

      <Card variant="default" className="p-4 border-l-2 border-l-secondary bg-bg-surface-alt space-y-1.5">
        <span className="text-xs text-secondary font-bold uppercase tracking-wider block flex items-center gap-1.5">
          <FaInfoCircle aria-hidden="true" />
          <span>Assessor Pacing Notes</span>
        </span>
        <p className="text-xs text-text-secondary leading-relaxed">
          {setupData.type === 'Technical'
            ? 'Elaborate on coding trade-offs, space/time Big O complexities, and error-handling conditions. Do not state high-level design only.'
            : 'Structure answers using the STAR framework. Clearly define the quantitative results and what metrics changed.'}
        </p>
      </Card>
    </div>
  );
});

export default SessionInterviewerCard;
