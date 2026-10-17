'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import {
  FaKeyboard,
  FaMicrophone,
  FaPauseCircle,
  FaExclamationTriangle,
  FaChevronLeft,
  FaArrowRight,
} from 'react-icons/fa';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { AUDIO_BAR_PROFILES, formatTime } from './sessionHelpers';
import type { SystemDesignDiagramState } from '@/types/systemDesign';

// Lazy-load SystemDesignCanvas with ssr: false
const SystemDesignCanvas = dynamic(
  () => import('@/components/interview/SystemDesignCanvas').then((m) => m.SystemDesignCanvas),
  { ssr: false }
);

export interface SessionAnswerWorkspaceProps {
  isRetry: boolean;
  currentQuestionIndex: number;
  totalQuestions: number;
  responseMode: 'type' | 'speak';
  setResponseMode: (mode: 'type' | 'speak') => void;
  typedAnswer: string;
  setTypedAnswer: (text: string) => void;
  transcriptText: string;
  setTranscriptText: (text: string) => void;
  recording: boolean;
  setRecording: (rec: boolean) => void;
  interviewerSpeaking: boolean;
  timeLeft: number;
  currentQuestionDuration: number;
  isSpeechSupported: boolean;
  handleToggleRecord: () => void;
  wordCount: number;
  charCount: number;
  confirmSkip: boolean;
  setConfirmSkip: (confirm: boolean) => void;
  handlePrevQuestion: () => void;
  handleConfirmSkip: () => void;
  handleNextQuestion: () => void;
  activeAnswer: string;
  isSystemDesignQuestion: boolean;
  diagramState: SystemDesignDiagramState | null;
  setDiagramState: (state: SystemDesignDiagramState) => void;
}

export default function SessionAnswerWorkspace({
  isRetry,
  currentQuestionIndex,
  totalQuestions,
  responseMode,
  setResponseMode,
  typedAnswer,
  setTypedAnswer,
  transcriptText,
  setTranscriptText,
  recording,
  setRecording,
  interviewerSpeaking,
  timeLeft,
  currentQuestionDuration,
  isSpeechSupported,
  handleToggleRecord,
  wordCount,
  charCount,
  confirmSkip,
  setConfirmSkip,
  handlePrevQuestion,
  handleConfirmSkip,
  handleNextQuestion,
  activeAnswer,
  isSystemDesignQuestion,
  diagramState,
  setDiagramState,
}: SessionAnswerWorkspaceProps) {
  return (
    <div className="lg:col-span-7 flex flex-col justify-between bg-bg-surface border border-border rounded-2xl p-6 relative space-y-6 shadow-soft" data-secure="input">
      <div>
        <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-primary font-bold uppercase tracking-wider block">Candidate Studio Workspace</span>
              {isRetry && (
                <Badge variant="warning" size="sm" className="bg-warning/15 border-warning/30 text-warning font-mono font-bold">
                  Focused Question Retry
                </Badge>
              )}
            </div>
            <span className="text-xs text-text-secondary font-mono">
              {isRetry ? 'Single Question Target Practice' : `Question ${currentQuestionIndex + 1} of ${totalQuestions}`}
            </span>
          </div>

          <div className="bg-bg-surface-alt p-1 rounded-xl border border-border flex gap-1">
            <button
              type="button"
              onClick={() => {
                setResponseMode('type');
                setTranscriptText('');
                setRecording(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition duration-200 cursor-pointer ${
                responseMode === 'type' ? 'bg-primary text-text-on-primary shadow-soft' : 'text-text-secondary hover:text-text-primary'
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
                responseMode === 'speak' ? 'bg-primary text-text-on-primary shadow-soft' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <FaMicrophone size={10} />
              <span>Speech</span>
            </button>
          </div>
        </div>

        {/* 30-Second Early Warning Banner */}
        {timeLeft <= 30 && timeLeft > 10 && !interviewerSpeaking && (
          <div className="bg-warning/15 border border-warning/30 text-warning text-xs px-4 py-2 rounded-xl font-medium mb-3 flex items-center gap-2">
            <span>⏱️</span>
            <span>Pacing Warning: 30 seconds remaining. Wrap up your main points before automatic submission.</span>
          </div>
        )}

        {/* 10-Second Critical Red Warning Banner */}
        {timeLeft <= 10 && !interviewerSpeaking && (
          <div className="bg-danger/15 border border-danger/30 text-danger text-xs px-4 py-2.5 rounded-xl font-medium animate-pulse mb-3 text-left">
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
                className="w-full h-56 rounded-xl bg-bg-surface border border-border p-4 text-xs sm:text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/25 transition duration-200 resize-none font-mono disabled:opacity-40"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-6 py-8">
              {!isSpeechSupported ? (
                <div className="text-center p-6 bg-danger/10 border border-danger/20 rounded-xl space-y-3 max-w-sm mx-auto">
                  <div className="h-10 w-10 bg-danger/20 border border-danger/30 rounded-full flex items-center justify-center text-danger mx-auto">
                    <FaExclamationTriangle />
                  </div>
                  <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                    Web Speech API Unsupported
                  </h4>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Speech recognition is not supported in this browser. Please try Google Chrome or Microsoft Edge, or switch back to the text Editor mode.
                  </p>
                </div>
              ) : recording ? (
                <div className="w-full flex flex-col items-center space-y-4">
                  <div className="h-10 flex items-end justify-center gap-1.5 px-4">
                    {AUDIO_BAR_PROFILES.map((bar, idx) => (
                      <motion.div
                        key={idx}
                        animate={{ height: [bar.min, bar.max, bar.min] }}
                        transition={{ repeat: Infinity, duration: bar.duration, delay: bar.delay, ease: 'easeInOut' }}
                        className="w-1.5 bg-primary rounded-full"
                        style={{ height: `${bar.min}px` }}
                      />
                    ))}
                  </div>

                  <Button onClick={handleToggleRecord} variant="danger" size="sm" icon={FaPauseCircle}>
                    Pause Voice Recording
                  </Button>

                  <div className="w-full bg-bg-surface-alt border border-border rounded-xl p-4 text-xs font-mono text-text-secondary leading-relaxed min-h-[60px] text-left">
                    {transcriptText || 'Awaiting voice inputs... speak to compile transcript logs.'}
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <button
                    type="button"
                    onClick={handleToggleRecord}
                    disabled={interviewerSpeaking}
                    aria-label="Capture speech via microphone"
                    className="h-16 w-16 rounded-full bg-primary-soft border border-primary/30 hover:border-primary flex items-center justify-center text-primary text-2xl hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition duration-200 cursor-pointer shadow-soft"
                  >
                    <FaMicrophone aria-hidden="true" />
                  </button>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-text-primary uppercase tracking-wide">Capture Speech</p>
                    <p className="text-xs text-text-secondary">Audio captures are transcribed locally in real-time.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center text-xs text-text-secondary font-mono mt-3 pb-3 border-b border-border">
          <span>
            Words:{' '}
            <span
              className={
                wordCount > 100
                  ? 'text-success font-bold'
                  : wordCount >= 50
                  ? 'text-warning font-bold'
                  : 'text-text-secondary'
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
        <div className="pt-4 border-t border-border">
          <SystemDesignCanvas
            initialState={diagramState || undefined}
            onChange={setDiagramState}
          />
        </div>
      )}

      <div className="flex justify-between items-center mt-6 pt-4 border-t border-border">
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
                className="text-text-secondary hover:text-text-primary"
              >
                Skip
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2 bg-bg-surface-alt px-3 py-1.5 rounded-lg border border-border text-xs text-text-secondary">
              <span>Skip this question? Your answer won't be scored.</span>
              <button
                type="button"
                onClick={handleConfirmSkip}
                className="text-danger hover:text-danger/80 font-bold px-1.5 py-0.5 rounded cursor-pointer transition"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmSkip(false)}
                className="text-text-secondary hover:text-text-primary font-bold px-1.5 py-0.5 rounded cursor-pointer transition"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-xs text-text-secondary font-bold uppercase tracking-wider block">Timer</span>
            <span
              className={`text-xs font-mono font-bold ${
                timeLeft <= 10
                  ? 'text-danger animate-pulse'
                  : timeLeft <= 30
                  ? 'text-warning'
                  : 'text-text-primary'
              }`}
            >
              {formatTime(timeLeft)}
            </span>
          </div>
          <div className="w-16 h-1 bg-bg-surface-alt rounded-full overflow-hidden shrink-0 border border-border">
            <div
              className={`h-full transition-all duration-1000 ${
                timeLeft <= 10 ? 'bg-danger' : timeLeft <= 30 ? 'bg-warning' : 'bg-primary'
              }`}
              style={{ width: `${(timeLeft / currentQuestionDuration) * 100}%` }}
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
          {currentQuestionIndex + 1 === totalQuestions ? 'Finish' : 'Next'}
        </Button>
      </div>
    </div>
  );
}
