'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FaFileAlt, FaSlidersH, FaUserTie, FaCheckCircle, FaRocket, FaArrowRight } from 'react-icons/fa';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';

export interface OnboardingProgressWidgetProps {
  hasResume: boolean;
  hasSetup: boolean;
  hasCompletedSession: boolean;
  className?: string;
}

export function calculateOnboardingProgress(
  hasResume: boolean,
  hasSetup: boolean,
  hasCompletedSession: boolean
): {
  completedCount: number;
  percentage: number;
  activeStep: 1 | 2 | 3 | 4; // 4 means all completed
} {
  let completedCount = 0;
  if (hasResume) completedCount++;
  if (hasSetup) completedCount++;
  if (hasCompletedSession) completedCount++;

  const percentage = Math.round((completedCount / 3) * 100);

  let activeStep: 1 | 2 | 3 | 4 = 1;
  if (!hasResume) {
    activeStep = 1;
  } else if (!hasSetup) {
    activeStep = 2;
  } else if (!hasCompletedSession) {
    activeStep = 3;
  } else {
    activeStep = 4;
  }

  return { completedCount, percentage, activeStep };
}

export const OnboardingProgressWidget: React.FC<OnboardingProgressWidgetProps> = ({
  hasResume,
  hasSetup,
  hasCompletedSession,
  className = '',
}) => {
  const router = useRouter();
  const { completedCount, percentage, activeStep } = calculateOnboardingProgress(
    hasResume,
    hasSetup,
    hasCompletedSession
  );

  const steps = [
    {
      step: 1,
      title: 'Upload Resume',
      subtitle: 'Scan your experience to extract skills & JD compatibility.',
      icon: FaFileAlt,
      path: '/resume',
      isCompleted: hasResume,
      isActive: activeStep === 1,
    },
    {
      step: 2,
      title: 'Configure Setup',
      subtitle: 'Choose target company, role, difficulty, & persona.',
      icon: FaSlidersH,
      path: '/setup',
      isCompleted: hasSetup,
      isActive: activeStep === 2,
    },
    {
      step: 3,
      title: 'Practice Session',
      subtitle: 'Answer live interview questions with instant scoring.',
      icon: FaUserTie,
      path: '/setup',
      isCompleted: hasCompletedSession,
      isActive: activeStep === 3,
    },
  ];

  return (
    <Card
      variant="glass"
      className={`p-6 sm:p-8 border border-white/10 relative overflow-hidden space-y-6 ${className}`}
    >
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-60 h-60 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header & Gamified Progress Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm">
              <span className="h-2 w-2 rounded-full bg-accent mr-1.5 inline-block animate-pulse" />
              Skillo Onboarding Tracker
            </Badge>
            <span className="text-xs font-mono font-bold text-gray-400">
              {completedCount} of 3 Completed
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-heading font-extrabold text-white">
            {activeStep === 4
              ? '🎉 Onboarding Complete! Keep Practicing'
              : 'Complete Setup to Unlock Benchmark Performance'}
          </h3>
        </div>

        {/* Progress Bar Gauge */}
        <div className="w-full md:w-64 space-y-1.5 shrink-0">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-gray-400 font-semibold">Progress</span>
            <span className="text-primary font-bold">{percentage}%</span>
          </div>
          <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-primary via-secondary to-accent shadow-[0_0_12px_rgba(99,102,241,0.5)]"
            />
          </div>
        </div>
      </div>

      {/* 3 Step Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left">
        {steps.map((item) => {
          const Icon = item.icon;

          return (
            <motion.div
              key={item.step}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push(item.path)}
              className={`p-5 rounded-2xl border transition-all duration-300 cursor-pointer relative flex flex-col justify-between space-y-4 ${
                item.isActive
                  ? 'animated-glow-border bg-primary/10 border-primary/40 shadow-xl shadow-primary/15'
                  : item.isCompleted
                  ? 'bg-emerald-500/5 border-emerald-500/25 hover:border-emerald-500/40'
                  : 'bg-white/3 border-white/5 hover:border-white/15'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm border ${
                      item.isCompleted
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : item.isActive
                        ? 'bg-primary/20 text-primary border-primary/40'
                        : 'bg-white/5 text-gray-400 border-white/10'
                    }`}
                  >
                    <Icon className="text-base" />
                  </div>

                  {item.isCompleted ? (
                    <span className="text-emerald-400 font-mono text-[11px] font-bold flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                      <FaCheckCircle className="text-xs" />
                      Completed
                    </span>
                  ) : item.isActive ? (
                    <span className="text-primary font-mono text-[11px] font-bold flex items-center gap-1 bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/30 animate-pulse">
                      Active Step ⚡
                    </span>
                  ) : (
                    <span className="text-gray-500 font-mono text-[10px] uppercase tracking-wider">
                      Step {item.step}
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="font-heading font-bold text-white text-sm flex items-center gap-1.5">
                    <span>{item.title}</span>
                  </h4>
                  <p className="text-xs text-gray-400 leading-relaxed mt-1">{item.subtitle}</p>
                </div>
              </div>

              <div className="pt-2 flex items-center text-xs font-semibold text-primary group-hover:translate-x-1 transition-transform">
                <span>{item.isCompleted ? 'Review Step' : 'Start Step'}</span>
                <FaArrowRight className="ml-1 text-[10px]" />
              </div>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
};
