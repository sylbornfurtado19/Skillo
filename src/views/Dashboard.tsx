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
        borderColor: '#6366F1',
        backgroundColor: 'rgba(99, 102, 241, 0.05)',
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#06B6D4',
        pointBorderColor: '#fff',
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
        backgroundColor: '#111827',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      y: {
        min: 50,
        max: 100,
        grid: { color: 'rgba(255, 255, 255, 0.02)' },
        ticks: { color: '#94A3B8', font: { family: 'Inter', size: 10 } },
      },
      x: {
        grid: { display: false },
        ticks: { color: '#94A3B8', font: { family: 'Inter', size: 10 } },
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
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        borderColor: '#8B5CF6',
        borderWidth: 2,
        pointBackgroundColor: '#06B6D4',
        pointBorderWidth: 1,
      },
    ],
  };

  const radarChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      r: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        angleLines: { color: 'rgba(255, 255, 255, 0.04)' },
        pointLabels: { color: '#94A3B8', font: { family: 'Inter', size: 9, weight: 'bold' as const } },
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gradient-to-r from-primary/10 via-secondary/5 to-accent/10 border border-white/10 rounded-2xl p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/15 rounded-full blur-[90px] pointer-events-none" />

        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-white">
              Welcome back, {candidateName}!
            </h2>
            {streakInfo.currentStreak > 0 && (
              <Badge variant="accent" size="sm" className="bg-amber-500/10 border-amber-500/20 text-amber-400 font-mono font-bold flex items-center gap-1">
                <FaFire className="text-amber-500 animate-pulse" />
                <span>{streakInfo.currentStreak} day streak</span>
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Track metrics and prepare for assessments in your workspace.
          </p>
        </div>


        <div className="flex gap-3 shrink-0">
          <Button onClick={() => router.push('/setup')} variant="primary" size="sm" icon={FaPlay}>
            Practice Session
          </Button>
          <Button onClick={() => router.push('/resume')} variant="glass" size="sm" icon={FaUpload}>
            Update Resume
          </Button>
        </div>
      </div>


      {/* ── STREAK NUDGE CARD (Shown if practiced yesterday but not yet today) ── */}
      {streakInfo.hasActiveStreakYesterday && (
        <Card variant="glass" className="p-4 border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-orange-950/20 to-amber-950/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <FaFire className="animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-heading">
                Keep your {streakInfo.currentStreak}-day streak going!
              </h4>
              <p className="text-[11px] text-gray-300">
                Complete 1 quick mock session today to maintain your momentum.
              </p>
            </div>
          </div>
          <Button
            onClick={() => router.push('/setup')}
            variant="primary"
            size="sm"
            className="shrink-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold border-none"
            icon={FaPlay}
          >
            Practice Now
          </Button>
        </Card>
      )}

      {/* ── FIRST-RUN ONBOARDING EMPTY STATE ── */}
      {totalCompleted === 0 && !resumeData ? (
        <Card variant="glass" className="p-8 border border-white/10 text-center space-y-8 glow-primary relative overflow-hidden">
          <div className="max-w-xl mx-auto space-y-3">
            <Badge variant="primary" size="md" className="mx-auto">
              <span className="h-2 w-2 rounded-full bg-accent mr-2 inline-block animate-pulse" />
              Welcome to Skillo Onboarding
            </Badge>
            <h3 className="text-2xl font-heading font-extrabold text-white">
              Get Started with Your AI Interview Assistant
            </h3>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
              Complete these 3 simple steps to generate your first benchmark score and targeted preparation plan.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-[#030712]/60 rounded-xl p-5 border border-white/10 flex flex-col items-center text-center space-y-3">
              <div className="h-10 w-10 rounded-xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold font-mono text-sm">
                1
              </div>
              <h4 className="font-heading font-bold text-white text-sm">Upload Resume</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Scan your experience to highlight talking points and role compatibility.
              </p>
            </div>

            <div className="bg-[#030712]/60 rounded-xl p-5 border border-white/10 flex flex-col items-center text-center space-y-3">
              <div className="h-10 w-10 rounded-xl bg-secondary/20 text-secondary border border-secondary/30 flex items-center justify-center font-bold font-mono text-sm">
                2
              </div>
              <h4 className="font-heading font-bold text-white text-sm">Configure Setup</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Choose your career domain, role target, and interviewer persona.
              </p>
            </div>

            <div className="bg-[#030712]/60 rounded-xl p-5 border border-white/10 flex flex-col items-center text-center space-y-3">
              <div className="h-10 w-10 rounded-xl bg-accent/20 text-accent border border-accent/30 flex items-center justify-center font-bold font-mono text-sm">
                3
              </div>
              <h4 className="font-heading font-bold text-white text-sm">Practice Session</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Answer live questions and receive instant scoring with feedback.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <Button
              onClick={() => router.push('/resume')}
              variant="primary"
              size="lg"
              className="px-8 py-3.5 shadow-lg shadow-primary/30"
              icon={FaRocket}
            >
              Start Step 1: Upload Resume
            </Button>
          </div>
        </Card>
      ) : totalCompleted === 0 && resumeData ? (
        /* ── READY FOR FIRST SESSION PROMPT & PROACTIVE RESUME INSIGHTS ── */
        <div className="space-y-4">
          <Card variant="glass" className="p-6 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 glow-accent">
            <div className="space-y-1 text-center md:text-left">
              <Badge variant="accent" size="sm" className="mb-1">
                Resume Uploaded ✓
              </Badge>
              <h3 className="text-lg font-heading font-bold text-white">
                Ready for your first mock interview session
              </h3>
              <p className="text-xs text-gray-400 max-w-xl">
                Your resume has been parsed. Configure your session parameters to start answering questions.
              </p>
            </div>
            <Button
              onClick={() => router.push('/setup')}
              variant="primary"
              size="md"
              className="shrink-0 bg-gradient-to-r from-primary to-accent"
              icon={FaPlay}
            >
              Configure Setup
            </Button>
          </Card>
          
          {/* ── PROACTIVE RESUME ANALYSIS INSIGHTS CARD (Rendered whenever resumeData exists) ── */}
          {Boolean(resumeData) && (
            <Card variant="glass" className="p-6 border border-primary/25 bg-gradient-to-r from-primary/10 via-indigo-950/20 to-purple-950/15 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">

              <div className="space-y-2 text-center md:text-left flex-1">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <Badge variant="primary" size="sm">Resume Insights</Badge>
                  {typeof (analysisResult as any)?.matchPercentage === 'number' && (
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {(analysisResult as any).matchPercentage}% Match Rating
                    </span>
                  )}
                </div>
                <h4 className="text-base font-heading font-bold text-white">
                  Recommended Target Practice Role: <span className="text-accent">{(analysisResult as any)?.jobTitle || setupData.role || 'Software Engineer'}</span>
                </h4>
                <p className="text-xs text-gray-300 max-w-2xl leading-relaxed">
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
                className="shrink-0 bg-gradient-to-r from-primary via-indigo-600 to-accent text-white shadow-lg shadow-primary/20 px-6"
                icon={FaRocket}
              >
                <span>Practice this role</span>
                <FaArrowRight size={10} className="ml-1" />
              </Button>
            </Card>
          )}
        </div>
      ) : (
        /* ── DASHBOARD STAT CARDS ── */
        <div className="space-y-6">
          {/* ── PROACTIVE RESUME ANALYSIS INSIGHTS CARD (Rendered whenever resumeData exists) ── */}
          {Boolean(resumeData) && (
            <Card variant="glass" className="p-6 border border-primary/25 bg-gradient-to-r from-primary/10 via-indigo-950/20 to-purple-950/15 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">

              <div className="space-y-2 text-center md:text-left flex-1">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <Badge variant="primary" size="sm">Resume Insights</Badge>
                  {typeof (analysisResult as any)?.matchPercentage === 'number' && (
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {(analysisResult as any).matchPercentage}% Match Rating
                    </span>
                  )}
                </div>
                <h4 className="text-base font-heading font-bold text-white">
                  Recommended Target Practice Role: <span className="text-accent">{(analysisResult as any)?.jobTitle || setupData.role || 'Software Engineer'}</span>
                </h4>
                <p className="text-xs text-gray-300 max-w-2xl leading-relaxed">
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
                className="shrink-0 bg-gradient-to-r from-primary via-indigo-600 to-accent text-white shadow-lg shadow-primary/20 px-6"
                icon={FaRocket}
              >
                <span>Practice this role</span>
                <FaArrowRight size={10} className="ml-1" />
              </Button>
            </Card>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">

            <Card variant="glass" className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-lg sm:text-xl shrink-0">
                <FaCalendarCheck />
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono font-bold">
                  Completed
                </span>
                {loading ? (
                  <div className="h-6 w-12 bg-white/5 rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-xl sm:text-2xl font-heading font-extrabold text-white mt-0.5">{totalCompleted}</p>
                )}
              </div>
            </Card>

            <Card variant="glass" className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-secondary/10 border border-secondary/20 flex items-center justify-center text-secondary text-lg sm:text-xl shrink-0">
                <FaAward />
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono font-bold">Avg Index</span>
                {loading ? (
                  <div className="h-6 w-16 bg-white/5 rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-xl sm:text-2xl font-heading font-extrabold text-white mt-0.5">{averageScore}%</p>
                )}
              </div>
            </Card>

            <Card variant="glass" className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent text-lg sm:text-xl shrink-0">
                <FaFileAlt />
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono font-bold">
                  Resume Health
                </span>
                {loading ? (
                  <div className="h-6 w-16 bg-white/5 rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-xl sm:text-2xl font-heading font-extrabold text-white mt-0.5">
                    {resumeScore ? `${resumeScore}%` : 'Unrated'}
                  </p>
                )}
              </div>
            </Card>

            <Card variant="glass" className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg sm:text-xl shrink-0">
                <FaChartLine />
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono font-bold">
                  Readiness Index
                </span>
                {loading ? (
                  <div className="h-6 w-16 bg-white/5 rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-xl sm:text-2xl font-heading font-extrabold text-emerald-400 mt-0.5">
                    {readinessIndex}%
                  </p>
                )}
              </div>
            </Card>
          </div>

          <Card variant="solid" className="p-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">
                  Target Career Profile
                </span>
                <h3 className="text-base font-heading font-bold text-white flex items-center gap-2">
                  <span>{setupData.role}</span>
                  <Badge variant="accent" size="sm">
                    {setupData.domain}
                  </Badge>
                </h3>
              </div>

              <div className="flex gap-4 text-xs font-mono text-gray-400">
                <div>
                  <span className="text-gray-500 block text-[9px] uppercase font-bold">Seniority</span>
                  <span className="text-white font-semibold">{setupData.experienceLevel}</span>
                </div>
                <div className="border-l border-white/5 pl-4">
                  <span className="text-gray-500 block text-[9px] uppercase font-bold">Focus Track</span>
                  <span className="text-white font-semibold">{setupData.type}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* CHARTS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card variant="glass" className="lg:col-span-2 flex flex-col justify-between h-[340px]">
              <div className="mb-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Score Progression</h3>
                <p className="text-[10px] text-gray-500 mt-0.5">Evaluation performance trends over time.</p>
              </div>
              <div className="flex-1 relative min-h-0">
                <Line data={lineChartData} options={lineChartOptions} />
              </div>
            </Card>

            <Card variant="glass" className="flex flex-col justify-between h-[340px]">
              <div className="mb-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Skills Distribution</h3>
                <p className="text-[10px] text-gray-500 mt-0.5">Evaluated weights across core dimensions.</p>
              </div>
              <div className="flex-1 relative min-h-0">
                <Radar data={radarChartData} options={radarChartOptions} />
              </div>
            </Card>
          </div>
        </div>
      )}


      {/* RECENT ASSESSMENTS TABLE WITH SORT CONTROLS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card variant="glass" className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-white/5">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Recent Assessments</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">Click any session row to inspect the full evaluation report.</p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              {/* Sort Control */}
              <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-background/80 border border-white/10 px-2.5 py-1 rounded-xl">
                <FaSortAmountDown className="text-primary text-[10px]" />
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="bg-transparent text-white text-xs outline-none cursor-pointer"
                >
                  <option value="newest" className="bg-[#0b0f19]">Newest First</option>
                  <option value="oldest" className="bg-[#0b0f19]">Oldest First</option>
                  <option value="highest" className="bg-[#0b0f19]">Highest Score</option>
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
                <tr className="border-b border-white/5 text-gray-500">
                  <th className="py-2.5 font-semibold">Date</th>
                  <th className="py-2.5 font-semibold">Role Profile</th>
                  <th className="py-2.5 font-semibold">Type</th>
                  <th className="py-2.5 font-semibold text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {loading ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <tr key={idx} className="border-b border-white/5">
                      <td className="py-3">
                        <div className="h-3 bg-white/5 rounded animate-pulse w-12" />
                      </td>
                      <td className="py-3">
                        <div className="h-3 bg-white/5 rounded animate-pulse w-32" />
                      </td>
                      <td className="py-3">
                        <div className="h-3 bg-white/5 rounded animate-pulse w-16" />
                      </td>
                      <td className="py-3 text-right">
                        <div className="h-3 bg-white/5 rounded animate-pulse w-8 ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : sortedHistory.length > 0 ? (
                  sortedHistory.map((h) => (
                    <tr
                      key={h.id}
                      onClick={() => handleRowClick(h)}
                      className="hover:bg-white/5 transition duration-150 cursor-pointer group"
                      title="Click to view assessment report"
                    >
                      <td className="py-3.5 font-mono text-[10px] text-gray-400 group-hover:text-primary transition">{h.date}</td>
                      <td className="py-3.5 font-medium text-white group-hover:translate-x-0.5 transition">
                        {h.role} <span className="text-[10px] text-gray-500">({h.difficulty})</span>
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
                    <td colSpan={4} className="py-6 text-center text-gray-500 font-mono text-[11px]">
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
            <h3 className="text-xs font-bold text-white uppercase tracking-wider pb-2 border-b border-white/5 mb-4 flex items-center gap-2">
              <FaLightbulb className="text-secondary" />
              <span>AI Preparation Suggestions</span>
            </h3>

            <div className="space-y-3.5 text-xs text-gray-300">
              {suggestions.map((sug, idx) => (
                <div
                  key={idx}
                  className="flex gap-2.5 items-start leading-relaxed bg-[#030712]/30 border border-white/5 p-3 rounded-xl"
                >
                  <span className="h-4 w-4 bg-[#111827] border border-white/10 text-primary text-[10px] rounded-full flex items-center justify-center shrink-0 font-bold font-mono">
                    {idx + 1}
                  </span>
                  <p className="text-gray-400">{sug}</p>
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
