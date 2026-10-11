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
} from 'react-icons/fa';


import '../lib/chartSetup';

const Radar = dynamic(() => import('react-chartjs-2').then((m) => m.Radar), { ssr: false });
const Line = dynamic(() => import('react-chartjs-2').then((m) => m.Line), { ssr: false });

import { useAuth } from '../hooks/useAuth';
import { useInterview, calculateStreak } from '../context/InterviewContext';
import type { SessionHistoryItem } from '../context/InterviewContext';



import type { EvaluationCategories } from '../types/index';
import { INTERVIEWER_PERSONAS, getQuestionsForSetup } from '../services/constants';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { OnboardingProgressWidget } from '../components/dashboard/OnboardingProgressWidget';

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    resumeData,
    analysisResult,
    results,
    setResults,
    setSetupData,
    setQuestions,
    setAnswers,
    setResumeData,
    setupData,
    sessionHistory,
  } = useInterview();

  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'highest'>('newest');

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

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
  const readinessIndex = Math.round(averageScore * 0.7 + (resumeScore || 60) * 0.3);

  const lineChartData = {
    labels: totalCompleted > 0 ? [...finalHistory].reverse().map((h) => h.date) : ['No Data'],
    datasets: [
      {
        label: 'Assessment Score',
        data: totalCompleted > 0 ? [...finalHistory].reverse().map((h) => h.score) : [0],
        borderColor: '#9B2218',
        backgroundColor: 'rgba(155, 34, 24, 0.08)',
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#9B2218',
        pointBorderColor: '#FBF9F6',
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
        backgroundColor: '#FBF9F6',
        titleColor: '#2B2523',
        bodyColor: '#6A625E',
        borderColor: '#E2DDD5',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      y: {
        min: 50,
        max: 100,
        grid: { color: '#E2DDD5' },
        ticks: { color: '#6A625E', font: { family: 'Inter', size: 10 } },
      },
      x: {
        grid: { display: false },
        ticks: { color: '#6A625E', font: { family: 'Inter', size: 10 } },
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
          categories.technicalAccuracy ?? 80,
          categories.communication ?? 84,
          categories.depth ?? 75,
          categories.timeManagement ?? 88,
        ],
        backgroundColor: 'rgba(155, 34, 24, 0.15)',
        borderColor: '#9B2218',
        borderWidth: 2,
        pointBackgroundColor: '#6B6E70',
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
        backgroundColor: '#FBF9F6',
        titleColor: '#2B2523',
        bodyColor: '#6A625E',
        borderColor: '#E2DDD5',
        borderWidth: 1,
      },
    },
    scales: {
      r: {
        grid: { color: '#E2DDD5' },
        angleLines: { color: '#E2DDD5' },
        pointLabels: { color: '#6A625E', font: { family: 'Inter', size: 9, weight: 'bold' as const } },
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
      { key: 'technicalAccuracy', name: 'Technical Accuracy', score: categories.technicalAccuracy ?? 80, tip: 'Practice explaining low-level algorithm time/space complexities & data structure edge cases.' },
      { key: 'communication', name: 'Communication Clarity', score: categories.communication ?? 84, tip: 'Use structured response frameworks (e.g. STAR method) and avoid long pauses.' },
      { key: 'depth', name: 'Depth & Reasoning', score: categories.depth ?? 75, tip: 'Deep dive into system architectural trade-offs rather than staying at high-level abstractions.' },
      { key: 'timeManagement', name: 'Time Management', score: categories.timeManagement ?? 88, tip: 'Pace your answers dynamically to reserve 30 seconds for summary and validation.' },
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

  return (
    <div className="space-y-8 pb-10 text-left">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 relative overflow-hidden shadow-[var(--shadow)]">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-[var(--text-primary)]">
              Welcome back, {candidateName}!
            </h2>
            {streakInfo.currentStreak > 0 && (
              <Badge variant="accent" size="sm" className="bg-[var(--warning)]/10 border-[var(--warning)]/20 text-[var(--warning)] font-mono font-bold flex items-center gap-1">
                <FaFire className="text-[var(--warning)] animate-pulse" />
                <span>{streakInfo.currentStreak} day streak</span>
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Track metrics and prepare for assessments in your workspace.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 shrink-0">
          <Button onClick={() => router.push('/ivp-lab')} variant="secondary" size="sm" icon={FaFlask}>
            IVP Lab
          </Button>
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
        <Card variant="glass" className="p-4 border border-[var(--warning)]/30 bg-[var(--bg-surface)] shadow-[var(--shadow)] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[var(--warning)]/10 border border-[var(--warning)]/25 flex items-center justify-center text-[var(--warning)] shrink-0">
              <FaFire className="animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider font-heading">
                Keep your {streakInfo.currentStreak}-day streak going!
              </h4>
              <p className="text-[11px] text-[var(--text-secondary)]">
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
          <Card variant="glass" className="p-6 border border-[var(--border)] flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center md:text-left">
              <Badge variant="accent" size="sm" className="mb-1">
                Resume Uploaded ✓
              </Badge>
              <h3 className="text-lg font-heading font-bold text-[var(--text-primary)]">
                Ready for your first mock interview session
              </h3>
              <p className="text-xs text-[var(--text-secondary)] max-w-xl">
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
            <Card variant="glass" className="p-6 border border-[var(--border)] bg-[var(--bg-surface)] flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
              <div className="space-y-2 text-center md:text-left flex-1">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <Badge variant="primary" size="sm">Resume Insights</Badge>
                  {typeof (analysisResult as any)?.matchPercentage === 'number' && (
                    <span className="text-xs font-mono font-bold text-[var(--success)]">
                      {(analysisResult as any).matchPercentage}% Match Rating
                    </span>
                  )}
                </div>
                <h4 className="text-base font-heading font-bold text-[var(--text-primary)]">
                  Recommended Target Practice Role: <span className="text-[var(--primary)]">{(analysisResult as any)?.jobTitle || setupData.role || 'Software Engineer'}</span>
                </h4>
                <p className="text-xs text-[var(--text-secondary)] max-w-2xl leading-relaxed">
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
          {/* ── PROACTIVE RESUME ANALYSIS INSIGHTS CARD (Rendered whenever resumeData exists) ── */}
          {Boolean(resumeData) && (
            <Card variant="glass" className="p-6 border border-[var(--border)] bg-[var(--bg-surface)] flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
              <div className="space-y-2 text-center md:text-left flex-1">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <Badge variant="primary" size="sm">Resume Insights</Badge>
                  {typeof (analysisResult as any)?.matchPercentage === 'number' && (
                    <span className="text-xs font-mono font-bold text-[var(--success)]">
                      {(analysisResult as any).matchPercentage}% Match Rating
                    </span>
                  )}
                </div>
                <h4 className="text-base font-heading font-bold text-[var(--text-primary)]">
                  Recommended Target Practice Role: <span className="text-[var(--primary)]">{(analysisResult as any)?.jobTitle || setupData.role || 'Software Engineer'}</span>
                </h4>
                <p className="text-xs text-[var(--text-secondary)] max-w-2xl leading-relaxed">
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

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <Card variant="glass" className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)] text-lg sm:text-xl shrink-0">
                <FaCalendarCheck />
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-mono font-bold">
                  Completed
                </span>
                {loading ? (
                  <div className="h-6 w-12 bg-[var(--bg-surface-alt)] rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-xl sm:text-2xl font-heading font-extrabold text-[var(--text-primary)] mt-0.5">{totalCompleted}</p>
                )}
              </div>
            </Card>

            <Card variant="glass" className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-[var(--secondary)]/10 border border-[var(--secondary)]/20 flex items-center justify-center text-[var(--secondary)] text-lg sm:text-xl shrink-0">
                <FaAward />
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-mono font-bold">Avg Index</span>
                {loading ? (
                  <div className="h-6 w-16 bg-[var(--bg-surface-alt)] rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-xl sm:text-2xl font-heading font-extrabold text-[var(--text-primary)] mt-0.5">{averageScore}%</p>
                )}
              </div>
            </Card>

            <Card variant="glass" className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-[var(--primary-soft)] border border-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)] text-lg sm:text-xl shrink-0">
                <FaFileAlt />
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-mono font-bold">
                  Resume Health
                </span>
                {loading ? (
                  <div className="h-6 w-16 bg-[var(--bg-surface-alt)] rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-xl sm:text-2xl font-heading font-extrabold text-[var(--text-primary)] mt-0.5">
                    {resumeScore ? `${resumeScore}%` : 'Unrated'}
                  </p>
                )}
              </div>
            </Card>

            <Card variant="glass" className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-[var(--success)]/10 border border-[var(--success)]/20 flex items-center justify-center text-[var(--success)] text-lg sm:text-xl shrink-0">
                <FaChartLine />
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-mono font-bold">
                  Readiness Index
                </span>
                {loading ? (
                  <div className="h-6 w-16 bg-[var(--bg-surface-alt)] rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-xl sm:text-2xl font-heading font-extrabold text-[var(--success)] mt-0.5">
                    {readinessIndex}%
                  </p>
                )}
              </div>
            </Card>
          </div>

          <Card variant="solid" className="p-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1">
                <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider block">
                  Target Career Profile
                </span>
                <h3 className="text-base font-heading font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span>{setupData.role}</span>
                  <Badge variant="accent" size="sm">
                    {setupData.domain}
                  </Badge>
                </h3>
              </div>

              <div className="flex gap-4 text-xs font-mono text-[var(--text-secondary)]">
                <div>
                  <span className="text-[var(--text-secondary)] block text-[9px] uppercase font-bold">Seniority</span>
                  <span className="text-[var(--text-primary)] font-semibold">{setupData.experienceLevel}</span>
                </div>
                <div className="border-l border-[var(--border)] pl-4">
                  <span className="text-[var(--text-secondary)] block text-[9px] uppercase font-bold">Focus Track</span>
                  <span className="text-[var(--text-primary)] font-semibold">{setupData.type}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* CHARTS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card variant="glass" className="lg:col-span-2 flex flex-col justify-between h-[340px]">
              <div className="mb-4">
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Score Progression</h3>
                <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Evaluation performance trends over time.</p>
              </div>
              <div className="flex-1 relative min-h-0">
                <Line data={lineChartData} options={lineChartOptions} />
              </div>
            </Card>

            <Card variant="glass" className="flex flex-col justify-between h-[340px]">
              <div className="mb-4">
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Skills Distribution</h3>
                <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Evaluated weights across core dimensions.</p>
              </div>
              <div className="flex-1 relative min-h-0">
                <Radar data={radarChartData} options={radarChartOptions} />
              </div>
            </Card>
          </div>
        </div>


      {/* RECENT ASSESSMENTS TABLE WITH SORT CONTROLS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card variant="glass" className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-[var(--border)]">
            <div>
              <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Recent Assessments</h3>
              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Click any session row to inspect the full evaluation report.</p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              {/* Sort Control */}
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border)] px-2.5 py-1 rounded-xl">
                <FaSortAmountDown className="text-[var(--primary)] text-[10px]" />
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="bg-transparent text-[var(--text-primary)] text-xs outline-none cursor-pointer"
                >
                  <option value="newest" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">Newest First</option>
                  <option value="oldest" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">Oldest First</option>
                  <option value="highest" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">Highest Score</option>
                </select>
              </div>

              <Button onClick={() => router.push('/setup')} variant="ghost" size="sm">
                <span>New Session</span>
                <FaArrowRight size={10} className="ml-1" />
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-secondary)]">
                  <th className="py-2.5 font-semibold">Date</th>
                  <th className="py-2.5 font-semibold">Role Profile</th>
                  <th className="py-2.5 font-semibold">Type</th>
                  <th className="py-2.5 font-semibold text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[var(--text-secondary)]">
                {loading ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <tr key={idx} className="border-b border-[var(--border)]">
                      <td className="py-3">
                        <div className="h-3 bg-[var(--bg-surface-alt)] rounded animate-pulse w-12" />
                      </td>
                      <td className="py-3">
                        <div className="h-3 bg-[var(--bg-surface-alt)] rounded animate-pulse w-32" />
                      </td>
                      <td className="py-3">
                        <div className="h-3 bg-[var(--bg-surface-alt)] rounded animate-pulse w-16" />
                      </td>
                      <td className="py-3 text-right">
                        <div className="h-3 bg-[var(--bg-surface-alt)] rounded animate-pulse w-8 ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : sortedHistory.length > 0 ? (
                  sortedHistory.map((h) => (
                    <tr
                      key={h.id}
                      onClick={() => handleRowClick(h)}
                      className="hover:bg-[var(--bg-surface-alt)] transition duration-150 cursor-pointer group"
                      title="Click to view assessment report"
                    >
                      <td className="py-3.5 font-mono text-[10px] text-[var(--text-secondary)] group-hover:text-[var(--primary)] transition">{h.date}</td>
                      <td className="py-3.5 font-medium text-[var(--text-primary)] group-hover:translate-x-0.5 transition">
                        {h.role} <span className="text-[10px] text-[var(--text-secondary)]">({h.difficulty})</span>
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
                    <td colSpan={4} className="py-6 text-center text-[var(--text-secondary)] font-mono text-[11px]">
                      No historical sessions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card variant="glass" className="space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider pb-2 border-b border-[var(--border)] mb-4 flex items-center gap-2">
              <FaLightbulb className="text-[var(--secondary)]" />
              <span>AI Preparation Suggestions</span>
            </h3>

            <div className="space-y-3.5 text-xs text-[var(--text-secondary)]">
              {suggestions.map((sug, idx) => (
                <div
                  key={idx}
                  className="flex gap-2.5 items-start leading-relaxed bg-[var(--bg-surface-alt)] border border-[var(--border)] p-3 rounded-xl"
                >
                  <span className="h-4 w-4 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--primary)] text-[10px] rounded-full flex items-center justify-center shrink-0 font-bold font-mono">
                    {idx + 1}
                  </span>
                  <p className="text-[var(--text-secondary)]">{sug}</p>
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
