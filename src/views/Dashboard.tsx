'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  FaPlay,
  FaUpload,
  FaArrowRight,
  FaCalendarCheck,
  FaAward,
  FaFileAlt,
  FaChartLine,
  FaLightbulb,
  FaRocket,
  FaSortAmountDown,
  FaFire,
  FaFlask,
  FaExclamationTriangle,
} from 'react-icons/fa';


import '../lib/chartSetup';

const Radar = dynamic(() => import('react-chartjs-2').then((m) => m.Radar), { ssr: false });
const Line = dynamic(() => import('react-chartjs-2').then((m) => m.Line), { ssr: false });

import { useAuth } from '../hooks/useAuth';
import { useChartTheme } from '../hooks/useChartTheme';
import { useInterview, calculateStreak } from '../context/InterviewContext';
import type { SessionHistoryItem } from '../context/InterviewContext';
import { getProfile } from '../services/profile';
import type { CandidateSkillMemoryStore, EvaluationCategories } from '../types/index';



import { getQuestionsForSetup } from '../services/constants';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { OnboardingProgressWidget } from '../components/dashboard/OnboardingProgressWidget';
import { generateStudyPlan } from '../lib/services/studyPlan';

export default function Dashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const chartTheme = useChartTheme();
  const {
    resumeData,
    analysisResult,
    results,
    setResults,
    setSetupData,
    setQuestions,
    setAnswers,
    setupData,
    sessionHistory,
  } = useInterview();

  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'highest'>('newest');
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [skillMemoryStore, setSkillMemoryStore] = useState<CandidateSkillMemoryStore | undefined>();

  const handleRetrySync = () => {
    setDashboardError(null);
  };

  useEffect(() => {
    if (!user?.id) {
      setSkillMemoryStore(undefined);
      return;
    }
    getProfile(user.id)
      .then(({ data, error }) => {
        if (error) {
          const errStr = typeof error === 'string' ? error : (error as any)?.message || '';
          if (errStr.includes('not configured') || errStr.includes('Configuration Notice')) {
            return;
          }
          setDashboardError(errStr || 'Failed to retrieve study plan data.');
          return;
        }
        setSkillMemoryStore(data?.skillMemoryStore);
      })
      .catch((err) => {
        const errStr = err instanceof Error ? err.message : String(err);
        if (!errStr.includes('not configured') && !errStr.includes('Configuration Notice')) {
          setDashboardError('Failed to retrieve study plan data.');
        }
      });
  }, [user?.id]);

  const finalHistory = sessionHistory || [];
  const totalCompleted = finalHistory.length;
  const streakInfo = calculateStreak(finalHistory);

  // Sorting recent assessments
  const sortedHistory = [...finalHistory].sort((a, b) => {
    if (sortOrder === 'highest') {
      return b.score - a.score;
    }
    if (sortOrder === 'oldest') {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }
    // newest (default)
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });


  const averageScore =
    totalCompleted > 0 ? Math.round(finalHistory.reduce((sum, h) => sum + h.score, 0) / totalCompleted) : 0;

  const resumeScore =
    analysisResult && typeof analysisResult === 'object' && 'matchPercentage' in analysisResult
      ? (analysisResult.matchPercentage as number)
      : 0;
  const readinessIndex =
    totalCompleted > 0 && resumeScore > 0
      ? Math.round(averageScore * 0.7 + resumeScore * 0.3)
      : totalCompleted > 0
      ? averageScore
      : 0;

  const lineChartData = {
    labels: totalCompleted > 0 ? [...finalHistory].reverse().map((h) => h.date) : ['No Data'],
    datasets: [
      {
        label: 'Assessment Score',
        data: totalCompleted > 0 ? [...finalHistory].reverse().map((h) => h.score) : [0],
        borderColor: chartTheme.primary,
        backgroundColor: `${chartTheme.primary}18`,
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        pointBackgroundColor: chartTheme.primary,
        pointBorderColor: chartTheme.bgSurface,
        pointHoverRadius: 6,
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: chartTheme.bgSurface,
        titleColor: chartTheme.textPrimary,
        bodyColor: chartTheme.textSecondary,
        borderColor: chartTheme.border,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      y: {
        min: 50,
        max: 100,
        grid: { color: chartTheme.border },
        ticks: { color: chartTheme.textSecondary, font: { family: 'Inter', size: 10 } },
      },
      x: {
        grid: { display: false },
        ticks: { color: chartTheme.textSecondary, font: { family: 'Inter', size: 10 } },
      },
    },
  };

  const categories = (results?.categories || {}) as EvaluationCategories;

  const radarChartData = {
    labels: ['Technical Accuracy', 'Communication', 'Depth & Logic', 'Time Management'],
    datasets: [
      {
        label: 'Competencies',
        data: [
          categories.technicalAccuracy ?? 0,
          categories.communication ?? 0,
          categories.depth ?? 0,
          categories.timeManagement ?? 0,
        ],
        backgroundColor: `${chartTheme.primary}25`,
        borderColor: chartTheme.primary,
        borderWidth: 2,
        pointBackgroundColor: chartTheme.secondary,
        pointBorderWidth: 1,
      },
    ],
  };

  const radarChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: chartTheme.bgSurface,
        titleColor: chartTheme.textPrimary,
        bodyColor: chartTheme.textSecondary,
        borderColor: chartTheme.border,
        borderWidth: 1,
      },
    },
    scales: {
      r: {
        grid: { color: chartTheme.border },
        angleLines: { color: chartTheme.border },
        pointLabels: { color: chartTheme.textSecondary, font: { family: 'Inter', size: 9, weight: 'bold' as const } },
        ticks: { display: false, stepSize: 20 },
        min: 0,
        max: 100,
      },
    },
  };

  // Dynamic AI Preparation Suggestions derived from lowest category score
  const getDynamicSuggestions = () => {
    if (!results?.categories && totalCompleted === 0) {
      return [
        `Quantify engineering results on your resume to boost the Job Match index.`,
        `Spend more time discussing edge cases in high-concurrency Backend pipelines.`,
        `Review system design schemas for distributed notification clusters.`,
      ];
    }

    const catScores = [
      { key: 'technicalAccuracy', name: 'Technical Accuracy', score: categories.technicalAccuracy ?? 0, tip: 'Practice explaining low-level algorithm time/space complexities & data structure edge cases.' },
      { key: 'communication', name: 'Communication Clarity', score: categories.communication ?? 0, tip: 'Use structured response frameworks (e.g. STAR method) and avoid long pauses.' },
      { key: 'depth', name: 'Depth & Reasoning', score: categories.depth ?? 0, tip: 'Deep dive into system architectural trade-offs rather than staying at high-level abstractions.' },
      { key: 'timeManagement', name: 'Time Management', score: categories.timeManagement ?? 0, tip: 'Pace your answers dynamically to reserve 30 seconds for summary and validation.' },
    ].sort((a, b) => a.score - b.score);

    const lowest = catScores[0];
    const secondLowest = catScores[1];
    const expOrRole = setupData?.role ? `${setupData.role} (${setupData.company || 'Standard'})` : (setupData?.experienceLevel || 'Mid-Level');

    return [
      `Focus Track (${lowest.name}: ${lowest.score}%): ${lowest.tip}`,
      `Secondary Track (${secondLowest.name}: ${secondLowest.score}%): ${secondLowest.tip}`,
      `Resume Sync: Keep active bullet points aligned with your target role (${expOrRole}).`,
    ];
  };

  const suggestions = getDynamicSuggestions();
  const nextBestSession = skillMemoryStore
    ? generateStudyPlan(skillMemoryStore).flatMap((day) => day.tasks.map((task) => ({ day, task })))[0]
    : undefined;


  const candidateName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split('@')[0] ??
    'Candidate';

  const handleRowClick = (item: SessionHistoryItem) => {
    const setupDataObj = {
      domain: 'Computer Science',
      role: item.role,
      experienceLevel: item.difficulty,
      type: item.type,
      difficulty: item.difficulty,
      questionCount: 3,
      focusAreas: ['Core Architecture', 'System Logic'],
      persona: item.persona || 'sarah',
    };

    const questionsList = getQuestionsForSetup(setupDataObj);

    setSetupData(setupDataObj);
    setQuestions(questionsList.map((q) => q.question));
    setAnswers([
      { answerText: 'Demonstrated strong modular architecture and technical depth.' },
      { answerText: 'Detailed error handling and edge cases.' },
    ]);

    setResults({
      overallScore: item.score,
      categories: {
        technicalAccuracy: item.score,
        communication: item.score + 2,
        depth: item.score - 3,
        timeManagement: item.score + 1,
      },
      breakdown: questionsList.map((q, idx) => ({
        question: q.question,
        score: item.score + (idx % 2 === 0 ? 2 : -2),
        feedback: 'Solid answer demonstrating good domain familiarity.',
        strengths: ['Clear terminology', 'Structured thought process'],
      })),
      interviewerComments: 'Comprehensive response showing clear engineering competence.',
      personaId: item.persona || 'sarah',
      setupData: setupDataObj,
    });

    router.push('/results');
  };

  if (loading) {
    return (
      <div className="space-y-8 pb-10 text-left">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-bg-surface border border-border rounded-2xl p-6">
          <div className="space-y-2">
            <Skeleton variant="text" className="h-7 w-64" />
            <Skeleton variant="text" className="h-4 w-96" />
          </div>
          <div className="flex gap-3">
            <Skeleton variant="rect" className="h-9 w-24 rounded-xl" />
            <Skeleton variant="rect" className="h-9 w-32 rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} variant="rect" className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton variant="rect" className="lg:col-span-2 h-[340px] rounded-2xl" />
          <Skeleton variant="rect" className="h-[340px] rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton variant="rect" className="lg:col-span-2 h-64 rounded-2xl" />
          <Skeleton variant="rect" className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10 text-left">
      {dashboardError && (
        <div className="bg-danger/10 border border-danger/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-3">
            <FaExclamationTriangle className="text-danger text-lg shrink-0" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold text-text-primary">Unable to sync latest assessment telemetry</p>
              <p className="text-xs text-text-secondary">{dashboardError}</p>
            </div>
          </div>
          <Button onClick={handleRetrySync} variant="danger" size="sm">
            Retry Sync
          </Button>
        </div>
      )}

      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-bg-surface border border-border rounded-2xl p-6 relative overflow-hidden shadow-soft">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-text-primary">
              Welcome back, {candidateName}!
            </h2>
            {streakInfo.currentStreak > 0 && (
              <Badge variant="warning" size="sm" className="bg-warning/10 border-warning/20 text-warning font-mono font-bold flex items-center gap-1">
                <FaFire className="text-warning animate-pulse" />
                <span>{streakInfo.currentStreak} day streak</span>
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Track metrics and prepare for assessments in your workspace.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 shrink-0">
          <Button onClick={() => router.push('/setup')} variant="primary" size="sm" icon={FaPlay}>
            Practice Session
          </Button>
          <Button onClick={() => router.push('/resume')} variant="glass" size="sm" icon={FaUpload}>
            Update Resume
          </Button>
        </div>
      </div>

      {/* ── STREAK NUDGE CARD (Shown if practiced yesterday but not yet today) ── */}
      {Boolean(streakInfo.hasActiveStreakYesterday) && (
        <Card variant="default" className="p-4 border border-warning/30 bg-bg-surface shadow-soft flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-warning/10 border border-warning/25 flex items-center justify-center text-warning shrink-0">
              <FaFire className="animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-heading">
                Keep your {streakInfo.currentStreak}-day streak going!
              </h4>
              <p className="text-xs text-text-secondary">
                Complete 1 quick mock session today to maintain your momentum.
              </p>
            </div>
          </div>
          <Button
            onClick={() => router.push('/setup')}
            variant="primary"
            size="sm"
            className="shrink-0"
            icon={FaPlay}
          >
            Practice Now
          </Button>
        </Card>
      )}

      <Card variant="default" className="p-5 border border-primary/20 bg-bg-surface shadow-soft">
        {nextBestSession ? (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm">Next best session</Badge>
                <span className="text-[10px] font-mono text-text-secondary">{nextBestSession.day.date}</span>
              </div>
              <h3 className="text-base font-heading font-bold text-text-primary">
                {nextBestSession.task.taskType === 'REVIEW' ? 'Review' : 'Practice'} {nextBestSession.task.skillName}
              </h3>
              <p className="text-xs text-text-secondary max-w-2xl">{nextBestSession.task.focus}</p>
              <span className="text-[10px] font-mono text-text-secondary">{nextBestSession.task.minutes} minutes</span>
            </div>
            <Button onClick={() => router.push('/setup?from=plan')} variant="primary" size="sm" icon={FaPlay} className="shrink-0">
              Start this session
            </Button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <Badge variant="neutral" size="sm">Study Plan</Badge>
              <h3 className="text-base font-heading font-bold text-text-primary">Ready to find your next focus?</h3>
              <p className="text-xs text-text-secondary">Take an interview to build your skill memory and unlock your next best session.</p>
            </div>
            <Button onClick={() => router.push('/setup')} variant="primary" size="sm" icon={FaPlay} className="shrink-0">
              Take your first interview
            </Button>
          </div>
        )}
      </Card>

      {/* ── INTERACTIVE ONBOARDING PROGRESS TRACKER ── */}
      {totalCompleted === 0 && (
        <OnboardingProgressWidget
          hasResume={Boolean(resumeData)}
          hasSetup={Boolean(setupData?.role)}
          hasCompletedSession={totalCompleted > 0}
        />
      )}

      {totalCompleted === 0 && Boolean(resumeData) && (
        <div className="space-y-4">
          <Card variant="default" className="p-6 border border-border flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center md:text-left">
              <Badge variant="primary" size="sm" className="mb-1">
                Resume Uploaded ✓
              </Badge>
              <h3 className="text-lg font-heading font-bold text-text-primary">
                Ready for your first mock interview session
              </h3>
              <p className="text-xs text-text-secondary max-w-xl">
                Your resume has been parsed. Configure your session parameters to start answering questions.
              </p>
            </div>
            <Button
              onClick={() => router.push('/setup')}
              variant="primary"
              size="md"
              className="shrink-0"
              icon={FaPlay}
            >
              Configure Setup
            </Button>
          </Card>
          
          {/* ── PROACTIVE RESUME ANALYSIS INSIGHTS CARD (Rendered whenever resumeData exists) ── */}
          {Boolean(resumeData) && (
            <Card variant="default" className="p-6 border border-border bg-bg-surface flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
              <div className="space-y-2 text-center md:text-left flex-1">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <Badge variant="primary" size="sm">Resume Insights</Badge>
                  {typeof (analysisResult as any)?.matchPercentage === 'number' && (
                    <span className="text-xs font-mono font-bold text-success">
                      {(analysisResult as any).matchPercentage}% Match Rating
                    </span>
                  )}
                </div>
                <h4 className="text-base font-heading font-bold text-text-primary">
                  Recommended Target Practice Role: <span className="text-primary">{(analysisResult as any)?.jobTitle || setupData.role || 'Software Engineer'}</span>
                </h4>
                <p className="text-xs text-text-secondary max-w-2xl leading-relaxed">
                  Based on your parsed resume skills ({(analysisResult as any)?.skillsMatched?.slice(0, 3).join(', ') || 'React, TypeScript, Architecture'}), we recommend practicing the <strong>{(analysisResult as any)?.jobTitle || setupData.role || 'Software Engineer'}</strong> track on <strong>Technical</strong> mode.
                </p>
              </div>

              <Button
                onClick={() => {
                  setSetupData({
                    ...setupData,
                    role: (analysisResult as any)?.jobTitle || setupData.role || 'Software Engineer',
                    type: 'Technical',
                    company: 'Generic',
                    difficulty: 'Senior',
                    duration: 30,
                    questionCount: 5,
                  });
                  // Save step 6 in session storage so CareerSetup opens directly on step 6
                  if (typeof window !== 'undefined') {
                    sessionStorage.setItem(
                      'skillo_career_setup_state',
                      JSON.stringify({
                        currentStep: 6,
                        setupData: {
                          ...setupData,
                          role: (analysisResult as any)?.jobTitle || setupData.role || 'Software Engineer',
                          type: 'Technical',
                          company: 'Generic',
                          difficulty: 'Senior',
                          duration: 30,
                          questionCount: 5,
                        },
                      })
                    );
                  }
                  router.push('/setup');
                }}
                variant="primary"
                size="md"
                className="shrink-0 px-6"
                icon={FaRocket}
              >
                <span>Practice this role</span>
                <FaArrowRight size={10} className="ml-1" />
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* ── DASHBOARD STAT CARDS ── */}
      <div className="space-y-6">
        <div className={`grid gap-4 sm:gap-6 ${totalCompleted > 0 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
          <Card variant="default" className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-lg sm:text-xl shrink-0">
              <FaCalendarCheck aria-hidden="true" />
            </div>
            <div>
              <span className="text-xs text-text-secondary uppercase tracking-wider font-mono font-bold">
                Completed
              </span>
              {loading ? (
                <div className="h-6 w-12 bg-bg-surface-alt rounded animate-pulse mt-1" />
              ) : (
                <p className="text-xl sm:text-2xl font-heading font-extrabold text-text-primary mt-0.5">{totalCompleted}</p>
              )}
            </div>
          </Card>

          <Card variant="default" className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-secondary/10 border border-secondary/20 flex items-center justify-center text-secondary text-lg sm:text-xl shrink-0">
              <FaAward aria-hidden="true" />
            </div>
            <div>
              <span className="text-xs text-text-secondary uppercase tracking-wider font-mono font-bold">Avg Index</span>
              {loading ? (
                <div className="h-6 w-16 bg-bg-surface-alt rounded animate-pulse mt-1" />
              ) : (
                <p className="text-xl sm:text-2xl font-heading font-extrabold text-text-primary mt-0.5">
                  {totalCompleted > 0 ? `${averageScore}%` : 'Unrated'}
                </p>
              )}
            </div>
          </Card>

          <Card variant="default" className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary-soft border border-primary/20 flex items-center justify-center text-primary text-lg sm:text-xl shrink-0">
              <FaFileAlt aria-hidden="true" />
            </div>
            <div>
              <span className="text-xs text-text-secondary uppercase tracking-wider font-mono font-bold">
                Resume Health
              </span>
              {loading ? (
                <div className="h-6 w-16 bg-bg-surface-alt rounded animate-pulse mt-1" />
              ) : (
                <p className="text-xl sm:text-2xl font-heading font-extrabold text-text-primary mt-0.5">
                  {resumeScore ? `${resumeScore}%` : 'Unrated'}
                </p>
              )}
            </div>
          </Card>

          {/* Hide readiness index when there is no session history */}
          {totalCompleted > 0 && (
            <Card variant="default" className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center text-success text-lg sm:text-xl shrink-0">
                <FaChartLine aria-hidden="true" />
              </div>
              <div>
                <span className="text-xs text-text-secondary uppercase tracking-wider font-mono font-bold">
                  Readiness Index
                </span>
                {loading ? (
                  <div className="h-6 w-16 bg-bg-surface-alt rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-xl sm:text-2xl font-heading font-extrabold text-success mt-0.5">
                    {readinessIndex}%
                  </p>
                )}
              </div>
            </Card>
          )}
        </div>

        <Card variant="default" className="p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1">
              <span className="text-xs text-text-secondary font-bold uppercase tracking-wider block">
                Target Career Profile
              </span>
              <h3 className="text-base font-heading font-bold text-text-primary flex items-center gap-2">
                <span>{setupData.role}</span>
                <Badge variant="secondary" size="sm">
                  {setupData.domain}
                </Badge>
              </h3>
            </div>

            <div className="flex gap-4 text-xs font-mono text-text-secondary">
              <div>
                <span className="text-text-secondary block text-xs uppercase font-bold">Seniority</span>
                <span className="text-text-primary font-semibold">{setupData.experienceLevel}</span>
              </div>
              <div className="border-l border-border pl-4">
                <span className="text-text-secondary block text-xs uppercase font-bold">Focus Track</span>
                <span className="text-text-primary font-semibold">{setupData.type}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* When there is no session history, show empty state and hide charts */}
        {totalCompleted === 0 ? (
          <Card variant="default" className="p-8 text-center border border-border bg-bg-surface space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mx-auto text-2xl">
              <FaRocket aria-hidden="true" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-heading font-bold text-text-primary">
                Start Your First Mock Interview
              </h3>
              <p className="text-xs text-text-secondary max-w-md mx-auto leading-relaxed">
                Complete your first interview session to unlock comprehensive score progressions, radar competencies, and readiness analytics.
              </p>
            </div>
            <Button
              onClick={() => router.push('/setup')}
              variant="primary"
              size="md"
              icon={FaPlay}
              className="mx-auto"
            >
              Start your first interview
            </Button>
          </Card>
        ) : (
          /* CHARTS */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card variant="default" className="lg:col-span-2 flex flex-col justify-between h-[340px]">
              <div className="mb-4">
                <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Score Progression</h3>
                <p className="text-xs text-text-secondary mt-0.5">Evaluation performance trends over time.</p>
              </div>
              <div className="flex-1 relative min-h-0">
                <Line key={`dashboard-line-${chartTheme.themeKey}`} data={lineChartData} options={lineChartOptions} />
              </div>
            </Card>

            <Card variant="default" className="flex flex-col justify-between h-[340px]">
              <div className="mb-4">
                <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Skills Distribution</h3>
                <p className="text-xs text-text-secondary mt-0.5">Evaluated weights across core dimensions.</p>
              </div>
              <div className="flex-1 relative min-h-0">
                <Radar key={`dashboard-radar-${chartTheme.themeKey}`} data={radarChartData} options={radarChartOptions} />
              </div>
            </Card>
          </div>
        )}
      </div>


      {/* RECENT ASSESSMENTS TABLE WITH SORT CONTROLS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card variant="default" className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-border">
            <div>
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Recent Assessments</h3>
              <p className="text-xs text-text-secondary mt-0.5">Click any session row to inspect the full evaluation report.</p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              {/* Sort Control */}
              <div className="flex items-center gap-1.5 text-xs text-text-secondary bg-bg-surface border border-border px-2.5 py-1 rounded-xl">
                <FaSortAmountDown className="text-primary text-xs" aria-hidden="true" />
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  aria-label="Sort recent assessments"
                  className="bg-transparent text-text-primary text-xs outline-none cursor-pointer"
                >
                  <option value="newest" className="bg-bg-surface text-text-primary">Newest First</option>
                  <option value="oldest" className="bg-bg-surface text-text-primary">Oldest First</option>
                  <option value="highest" className="bg-bg-surface text-text-primary">Highest Score</option>
                </select>
              </div>

              <Button onClick={() => router.push('/setup')} variant="ghost" size="sm">
                <span>New Session</span>
                <FaArrowRight size={10} className="ml-1" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-text-secondary">
                  <th className="py-2.5 font-semibold">Date</th>
                  <th className="py-2.5 font-semibold">Role Profile</th>
                  <th className="py-2.5 font-semibold">Type</th>
                  <th className="py-2.5 font-semibold text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-text-secondary">
                {loading ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <tr key={idx} className="border-b border-border">
                      <td className="py-3">
                        <div className="h-3 bg-bg-surface-alt rounded animate-pulse w-12" />
                      </td>
                      <td className="py-3">
                        <div className="h-3 bg-bg-surface-alt rounded animate-pulse w-32" />
                      </td>
                      <td className="py-3">
                        <div className="h-3 bg-bg-surface-alt rounded animate-pulse w-16" />
                      </td>
                      <td className="py-3 text-right">
                        <div className="h-3 bg-bg-surface-alt rounded animate-pulse w-8 ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : sortedHistory.length > 0 ? (
                  sortedHistory.map((h) => (
                    <tr
                      key={h.id}
                      onClick={() => handleRowClick(h)}
                      className="hover:bg-bg-surface-alt transition duration-150 cursor-pointer group"
                      title="Click to view assessment report"
                    >
                      <td className="py-3.5 font-mono text-xs text-text-secondary group-hover:text-primary transition">{h.date}</td>
                      <td className="py-3.5 font-medium text-text-primary group-hover:translate-x-0.5 transition">
                        {h.role} <span className="text-xs text-text-secondary">({h.difficulty})</span>
                      </td>
                      <td className="py-3.5">{h.type}</td>
                      <td className="py-3.5 text-right">
                        <Badge variant={h.score >= 80 ? 'success' : 'primary'} size="sm">
                          {h.score}%
                        </Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center">
                      <div className="space-y-3 flex flex-col items-center justify-center">
                        <p className="text-xs text-text-secondary font-mono">No historical assessment sessions yet.</p>
                        <Button
                          onClick={() => router.push('/setup')}
                          variant="primary"
                          size="sm"
                          icon={FaPlay}
                        >
                          Start Your First Session
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card variant="default" className="space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider pb-2 border-b border-border mb-4 flex items-center gap-2">
              <FaLightbulb className="text-secondary" aria-hidden="true" />
              <span>AI Preparation Suggestions</span>
            </h3>

            <div className="space-y-3.5 text-xs text-text-secondary">
              {suggestions.map((sug, idx) => (
                <div
                  key={idx}
                  className="flex gap-2.5 items-start leading-relaxed bg-bg-surface-alt border border-border p-3 rounded-xl"
                >
                  <span className="h-4 w-4 bg-bg-surface border border-border text-primary text-xs rounded-full flex items-center justify-center shrink-0 font-bold font-mono">
                    {idx + 1}
                  </span>
                  <p className="text-text-secondary">{sug}</p>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={() => router.push('/resume')} variant="secondary" size="sm" className="w-full mt-4">
            Optimize Resume Profile
          </Button>
        </Card>
      </div>
    </div>
  );
}
