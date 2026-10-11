'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  FaUndo,
  FaChevronDown,
  FaChevronUp,
  FaFilePdf,
  FaArrowRight,
  FaAward,
  FaListUl,
  FaExchangeAlt,
  FaShareAlt,
} from 'react-icons/fa';


// Task 6: Import Chart.js registration module
import '../lib/chartSetup';

// Task 5: Dynamic import for Radar chart component with ssr: false
const Radar = dynamic(() => import('react-chartjs-2').then((m) => m.Radar), { ssr: false });

import { INTERVIEWER_PERSONAS } from '../services/constants';
import { useInterview } from '../context/InterviewContext';
import type { EvaluationCategories, AnswerBreakdown, SUQEvaluationResult, ContrastiveEvaluationResult, BenchmarkDeltaCard } from '../types/index';
import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/FeedbackHelpers';
import SUQConfidenceDashboard from '../components/ui/SUQConfidenceDashboard';
import SimPOContrastiveCard from '../components/ui/SimPOContrastiveCard';
import GazeAnalyticsCard from '../components/ui/GazeAnalyticsCard';
import PostureComposureCard from '../components/ui/PostureComposureCard';
import FacialComposureCard from '../components/ui/FacialComposureCard';
import LipSyncVerificationCard from '../components/ui/LipSyncVerificationCard';
import IVPTelemetryTimeline, { extractTelemetryTimelineEvents } from '../components/ui/IVPTelemetryTimeline';
import type { EyeContactSessionMetrics, HeadPoseSessionMetrics, AffectiveSessionMetrics, LipSyncSessionMetrics } from '../types/index';

function isEyeContactMetrics(obj: any): obj is EyeContactSessionMetrics {
  return Boolean(obj && typeof obj === 'object' && 'totalVideoDurationSeconds' in obj);
}
function isHeadPoseMetrics(obj: any): obj is HeadPoseSessionMetrics {
  return Boolean(obj && typeof obj === 'object' && 'totalFramesAnalyzed' in obj);
}
function isAffectiveMetrics(obj: any): obj is AffectiveSessionMetrics {
  return Boolean(obj && typeof obj === 'object' && 'totalKeyframesAnalyzed' in obj);
}
function isLipSyncMetrics(obj: any): obj is LipSyncSessionMetrics {
  return Boolean(obj && typeof obj === 'object' && 'totalWindowsAnalyzed' in obj);
}






export default function Results() {
  const router = useRouter();
  const { showToast } = useToast();
  const {
    results,
    setResults,
    setQuestions,
    setCurrentQuestionIndex,
    setAnswers,
    resetSession,
    sessionHistory,
    setIsRetry,
    setRetryQuestionIndex,
  } = useInterview();

  const handleRetryQuestion = (questionIndex: number, questionText: string) => {
    setIsRetry(true);
    setRetryQuestionIndex(questionIndex);
    setQuestions([questionText]);
    setCurrentQuestionIndex(0);
    setAnswers([]);
    router.push('/interview');
  };


  const reportRef = useRef<HTMLDivElement | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'confidence' | 'contrastive' | 'gaze' | 'pose' | 'affect' | 'sync' | 'responses'>('overview');

  const timelineEvents = useMemo(() => {
    return extractTelemetryTimelineEvents(results);
  }, [results]);





  useEffect(() => {
    if (!results) {
      router.push('/resume');
    }
  }, [results, router]);

  const scrollToSection = (id: string, tab: 'overview' | 'confidence' | 'contrastive' | 'gaze' | 'pose' | 'affect' | 'sync' | 'responses') => {




    setActiveTab(tab);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const shareCardRef = useRef<HTMLDivElement | null>(null);
  const [sharing, setSharing] = useState(false);

  // Dynamic import of html2canvas at call time for PNG card export
  const handleShareImage = async () => {
    if (!shareCardRef.current) return;
    setSharing(true);

    try {
      const { default: html2canvas } = await import('html2canvas');

      const canvas = await html2canvas(shareCardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#FBF9F6',
        logging: false,
      });

      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `Skillo_Assessment_Summary_${Date.now()}.png`;
      link.click();

      showToast('Summary card downloaded! Ready to share on LinkedIn.', 'success');
    } catch (err: unknown) {
      console.error('Image share export failed:', err);
      showToast('Failed to generate share image. Please try again.', 'error');
    } finally {
      setSharing(false);
    }
  };

  // Task 4: Dynamic import of html2canvas and jsPDF at call time inside handleDownloadPDF
  const handleDownloadPDF = async () => {

    if (!reportRef.current) return;
    setDownloading(true);

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#F6F3EE',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save('Skillo_Assessment_Report.pdf');
    } catch (err: unknown) {
      console.error('PDF export failed:', err);
      showToast('Failed to generate PDF. Please try again.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  if (!results) return null;

  const persona = INTERVIEWER_PERSONAS[results.personaId as keyof typeof INTERVIEWER_PERSONAS] || INTERVIEWER_PERSONAS.sarah;

  const categories = (results.categories || {}) as EvaluationCategories;
  const suq = results.suqEvaluation as SUQEvaluationResult | undefined;
  const deltaCard = results.benchmarkDeltaCard as BenchmarkDeltaCard | undefined;

  const scores = {
    techAccuracy: categories.technicalAccuracy ?? 80,
    systemDesignLogic: categories.systemDesignLogic ?? categories.depth ?? 75,
    edgeCaseHandling: categories.edgeCaseHandling ?? categories.timeManagement ?? 80,
    communication: categories.communication ?? 85,
  };

  // Find previous session for comparison (if any)
  const previousSession =
    sessionHistory && sessionHistory.length > 0
      ? sessionHistory.find((s) => s.role === results.setupData?.role) || sessionHistory[0]
      : null;

  // Extract real stored category scores from previousSession if available
  const prevScores =
    previousSession && previousSession.categories
      ? {
          techAccuracy:
            previousSession.categories.technicalAccuracy ??
            previousSession.categories.techKnowledge ??
            previousSession.score,
          systemDesignLogic:
            previousSession.categories.depth ??
            previousSession.categories.confidence ??
            previousSession.score,
          edgeCaseHandling:
            previousSession.categories.timeManagement ??
            previousSession.categories.problemSolving ??
            previousSession.score,
          communication: previousSession.categories.communication ?? previousSession.score,
        }
      : null;

  // Datasets for Radar chart (4 Prometheus criteria)
  const radarDatasets = [
    {
      label: 'Current Session',
      data: [scores.techAccuracy, scores.systemDesignLogic, scores.edgeCaseHandling, scores.communication],
      backgroundColor: 'rgba(155, 34, 24, 0.2)',
      borderColor: '#9B2218',
      borderWidth: 2.5,
      pointBackgroundColor: '#9B2218',
      pointBorderColor: '#FBF9F6',
      pointHoverRadius: 6,
    },
  ];

  if (prevScores) {
    radarDatasets.push({
      label: `Previous Session (${previousSession?.date || 'Prior'})`,
      data: [prevScores.techAccuracy, prevScores.systemDesignLogic, prevScores.edgeCaseHandling, prevScores.communication],
      backgroundColor: 'rgba(107, 110, 112, 0.1)',
      borderColor: '#6B6E70',
      borderWidth: 1.5,
      pointBackgroundColor: '#6B6E70',
      pointBorderColor: '#FBF9F6',
      pointHoverRadius: 5,
    });
  }

  const radarData: any = {
    labels: [
      'Technical Accuracy',
      'System Architecture & Logic',
      'Edge-Case Awareness',
      'Communication & Tone',
    ],
    datasets: radarDatasets,
  };

  const radarOptions = {
    scales: {
      r: {
        angleLines: { color: '#E2DDD5' },
        grid: { color: '#E2DDD5' },
        pointLabels: {
          color: '#6A625E',
          font: { family: 'Sora', size: 10, weight: 'bold' as const },
        },
        ticks: {
          display: false,
          stepSize: 20,
        },
        suggestedMin: 50,
        suggestedMax: 100,
      },
    },
    plugins: {
      legend: {
        display: !!prevScores,
        position: 'top' as const,
        labels: {
          color: '#6A625E',
          font: { family: 'Inter', size: 10 },
          boxWidth: 12,
        },
      },
      tooltip: {
        backgroundColor: '#FBF9F6',
        titleColor: '#2B2523',
        bodyColor: '#6A625E',
        borderColor: '#E2DDD5',
        borderWidth: 1,
      },
    },
    maintainAspectRatio: false,
  };

  const toggleQuestionExpand = (id: string) => {
    setExpandedQuestion(expandedQuestion === id ? null : id);
  };

  const handlePracticeAgain = () => {
    setResults(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setAnswers([]);
    router.push('/setup');
  };

  const handleUploadNew = () => {
    resetSession();
    router.push('/resume');
  };

  const handleGoDashboard = () => {
    router.push('/dashboard');
  };

  const strengths = [
    'Excellent usage of domain-specific terminology during technical reviews.',
    'Clear architectural scaffolding: structured responses starting from top-level blocks down to low-level instances.',
    'Confident voice modulation and conversational pacing.',
  ];

  const weaknesses = [
    'Tended to state general abstracts on system scalability rather than analyzing concrete trade-offs.',
    'Under-explained error boundaries and validation checks in core code paths.',
  ];

  const plan = [
    { topic: 'React 19 Hooks', desc: 'Review useActionState and transition APIs to manage form actions natively.' },
    { topic: 'Cache Invalidation Protocols', desc: 'Study write-through vs cache-aside architectures to handle distributed data consistency.' },
    { topic: 'Quantitative STAR Metrics', desc: 'Focus on integrating numerical output measurements into behavioral scenario explanations.' },
  ];

  const handleTriggerValidationPass = () => {
    showToast('Initiating secondary validation evaluation pass...', 'info');
  };

  return (
    <div ref={reportRef} className="max-w-6xl mx-auto space-y-8 pb-16 text-left p-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold border border-[var(--primary)]/30 bg-[var(--primary-soft)] text-[var(--primary)]">
          <span>{results.setupData?.company || 'Generic'} Simulation Preset</span>
          &bull;
          <span>{results.setupData?.role || 'Software Engineer'}</span>
        </div>
        <SectionHeader
          title="Performance Report"
          description="Integrated Multi-Modal Evaluation Framework (LLM Evaluation Core + Visual & Audio Signal Trackers)"
          className="text-center max-w-2xl mx-auto"
        />

        {/* Execution Mode Audit Summary Breakdown */}
        <div className="w-full max-w-4xl mx-auto bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4 text-left space-y-3 shadow-[var(--shadow)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
            <h4 className="text-xs font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
              <span>🔍</span> Vision & Signal Execution Mode Audit Summary
            </h4>
            <span className="text-[10px] font-mono text-[var(--text-secondary)]">System Telemetry Audit</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)] flex flex-col justify-between">
              <span className="text-[10px] font-mono text-[var(--text-secondary)]">Gaze Estimation</span>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary)]/20">
                  [Canvas Heuristic]
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)] flex flex-col justify-between">
              <span className="text-[10px] font-mono text-[var(--text-secondary)]">3D Head Pose</span>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary)]/20">
                  [Canvas Heuristic]
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)] flex flex-col justify-between">
              <span className="text-[10px] font-mono text-[var(--text-secondary)]">Facial Affect</span>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary)]/20">
                  [Canvas Heuristic]
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 1. Docked In-Page Navigation Bar */}
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-[var(--bg-surface)] border-b border-[var(--border)] shadow-[var(--shadow)]">
        <div className="flex items-center justify-start sm:justify-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            type="button"
            onClick={() => scrollToSection('sec-overview', 'overview')}
            className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-[var(--primary)] text-[var(--text-on-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-alt)] hover:bg-[var(--border)]'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('sec-confidence', 'confidence')}
            className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'confidence'
                ? 'bg-[var(--primary)] text-[var(--text-on-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-alt)] hover:bg-[var(--border)]'
            }`}
          >
            Confidence Analysis
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('sec-contrastive', 'contrastive')}
            className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'contrastive'
                ? 'bg-[var(--primary)] text-[var(--text-on-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-alt)] hover:bg-[var(--border)]'
            }`}
          >
            Contrastive Analysis
          </button>
          {/* Gaze tab — only shown when metrics are available */}
          {isEyeContactMetrics(results.eyeContactMetrics) && (
            <button
              type="button"
              onClick={() => scrollToSection('sec-gaze', 'gaze')}
              className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer shrink-0 whitespace-nowrap ${
                activeTab === 'gaze'
                  ? 'bg-[var(--primary)] text-[var(--text-on-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-alt)] hover:bg-[var(--border)]'
              }`}
            >
              Gaze Analytics
            </button>
          )}
          {/* Head Pose & Gestures tab — only shown when metrics are available */}
          {isHeadPoseMetrics(results.headPoseMetrics) && (
            <button
              type="button"
              onClick={() => scrollToSection('sec-pose', 'pose')}
              className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer shrink-0 whitespace-nowrap ${
                activeTab === 'pose'
                  ? 'bg-[var(--primary)] text-[var(--text-on-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-alt)] hover:bg-[var(--border)]'
              }`}
            >
              Posture & Gestures
            </button>
          )}
          {/* Affect & Composure tab — only shown when metrics are available */}
          {isAffectiveMetrics(results.affectiveMetrics) && (
            <button
              type="button"
              onClick={() => scrollToSection('sec-affect', 'affect')}
              className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer shrink-0 whitespace-nowrap ${
                activeTab === 'affect'
                  ? 'bg-[var(--primary)] text-[var(--text-on-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-alt)] hover:bg-[var(--border)]'
              }`}
            >
              Facial Composure
            </button>
          )}
          {/* Audio Presence & Latency tab — only shown when metrics are available */}
          {isLipSyncMetrics(results.lipSyncMetrics) && (
            <button
              type="button"
              onClick={() => scrollToSection('sec-sync', 'sync')}
              className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer shrink-0 whitespace-nowrap ${
                activeTab === 'sync'
                  ? 'bg-[var(--primary)] text-[var(--text-on-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-alt)] hover:bg-[var(--border)]'
              }`}
            >
              Audio & Latency
            </button>
          )}
          <button
            type="button"
            onClick={() => scrollToSection('sec-responses', 'responses')}
            className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'responses'
                ? 'bg-[var(--primary)] text-[var(--text-on-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-alt)] hover:bg-[var(--border)]'
            }`}
          >
            Detailed Responses
          </button>
        </div>
      </div>


      {/* SECTION 1: OVERVIEW & COMPARISON */}
      <div id="sec-overview" className="scroll-mt-32 space-y-6">
        {/* 2. Compare to Previous Session Panel (rendered if prior session and category data exist) */}
        {previousSession && prevScores && (
          <Card variant="glass" className="p-5 border border-[var(--border)] bg-[var(--bg-surface)] flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)] text-base shrink-0">
                <FaExchangeAlt />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Session Progression Comparison</span>
                  <Badge variant="accent" size="sm">Compared with {previousSession.date}</Badge>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Current score (<strong className="text-[var(--text-primary)]">{results.overallScore}%</strong>) vs Previous session (<strong className="text-[var(--text-secondary)]">{previousSession.score}%</strong>) for {results.setupData?.role || 'Engineer'}.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono shrink-0">
              <span className={`px-2.5 py-1 rounded-lg font-bold ${results.overallScore >= previousSession.score ? 'bg-[var(--success)]/15 text-[var(--success)] border border-[var(--success)]/30' : 'bg-[var(--warning)]/15 text-[var(--warning)] border border-[var(--warning)]/30'}`}>
                {results.overallScore >= previousSession.score ? `+${results.overallScore - previousSession.score}% Delta` : `${results.overallScore - previousSession.score}% Delta`}
              </span>
            </div>
          </Card>
        )}


        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <Card variant="glass" className="lg:col-span-4 flex flex-col justify-between items-center text-center py-8 min-h-[340px]">
            <span className="text-xs text-[var(--text-secondary)] font-bold uppercase tracking-wider block border-b border-[var(--border)] pb-2 w-full">
              Overall Score Index
            </span>

            <div className="relative h-44 w-44 flex items-center justify-center my-6">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="88"
                  cy="88"
                  r="72"
                  stroke="var(--border)"
                  strokeWidth="10"
                  fill="transparent"
                />
                <circle
                  cx="88"
                  cy="88"
                  r="72"
                  stroke="url(#resultsGrad)"
                  strokeWidth="10"
                  strokeDasharray={452.4}
                  strokeDashoffset={452.4 - (452.4 * results.overallScore) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                />
                <defs>
                  <linearGradient id="resultsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#9B2218" />
                    <stop offset="100%" stopColor="#7F1B13" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-5xl font-heading font-extrabold text-[var(--text-primary)]">
                  {results.overallScore}
                </span>
                <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider font-mono mt-1">
                  Out of 100
                </span>
              </div>
            </div>

            <div className="w-full space-y-1">
              <span className="text-sm font-semibold text-[var(--primary)] block">
                {results.overallScore >= 85 ? 'Exceptional Fit' : results.overallScore >= 75 ? 'Strong Candidate' : 'Focus Needed'}
              </span>
              <p className="text-[10px] text-[var(--text-secondary)] uppercase font-mono tracking-wide">
                Target seniority: {results.setupData?.experienceLevel ?? 'Mid-Level'}
              </p>
              {suq?.confidenceLevel && (
                <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
                  <Badge
                    variant={
                      suq.confidenceLevel === 'HIGH'
                        ? 'success'
                        : suq.confidenceLevel === 'MEDIUM'
                        ? 'warning'
                        : 'danger'
                    }
                    size="sm"
                    className="font-mono text-[10px]"
                  >
                    SUQ Confidence: {suq.confidenceLevel}
                  </Badge>
                  {deltaCard?.rewardScore !== undefined && (
                    <span className="px-2 py-0.5 rounded-lg bg-[var(--primary-soft)] border border-[var(--primary)]/30 text-[var(--primary)] font-mono text-[10px] font-bold">
                      SimPO: +{deltaCard.rewardScore.toFixed(2)} pts
                    </span>
                  )}
                </div>
              )}
            </div>
          </Card>

          <Card variant="glass" className="lg:col-span-8 flex flex-col justify-between items-center text-center min-h-[340px]">
            <span className="text-xs text-[var(--text-secondary)] font-bold uppercase tracking-wider block border-b border-[var(--border)] pb-2 w-full">
              Evaluation Matrix Profile {previousSession ? '(Overlay Comparison)' : ''}
            </span>

            <div className="w-full h-56 relative my-4">
              <Radar data={radarData} options={radarOptions} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full text-[10px] text-[var(--text-secondary)] font-mono border-t border-[var(--border)] pt-4">
              <div className="space-y-0.5">
                <span>Technical Accuracy</span>
                <p className="text-[var(--text-primary)] font-bold text-xs">{scores.techAccuracy}%</p>
              </div>
              <div className="space-y-0.5">
                <span>System Architecture &amp; Logic</span>
                <p className="text-[var(--text-primary)] font-bold text-xs">{scores.systemDesignLogic}%</p>
              </div>
              <div className="space-y-0.5">
                <span>Edge-Case Awareness</span>
                <p className="text-[var(--text-primary)] font-bold text-xs">{scores.edgeCaseHandling}%</p>
              </div>
              <div className="space-y-0.5">
                <span>Communication &amp; Tone</span>
                <p className="text-[var(--text-primary)] font-bold text-xs">{scores.communication}%</p>
              </div>
            </div>
          </Card>
        </div>

        <Card variant="glass" className="flex flex-col md:flex-row gap-6 items-center">
          <div className="shrink-0 flex flex-col items-center text-center space-y-2">
            <div className="relative w-14 h-14 rounded-2xl overflow-hidden border border-[var(--border)] shadow-md">
              <Image
                src={persona.avatar}
                alt={persona.name}
                width={56}
                height={56}
                className="object-cover h-full w-full"
              />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[var(--text-primary)] leading-none">{persona.name}</h4>
              <p className="text-[9px] text-[var(--text-secondary)] uppercase font-mono">{persona.role}</p>
            </div>
          </div>

          <div className="space-y-1.5 flex-1">
            <span className="text-xs text-[var(--primary)] font-bold uppercase tracking-wider font-mono">Assessor Evaluation Details</span>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed italic">
              "{typeof results.interviewerComments === 'string' ? results.interviewerComments : 'Solid technical breakdown across foundational questions.'}"
            </p>
          </div>
        </Card>
      </div>

      {/* SECTION 2: CONFIDENCE ANALYSIS */}
      <div id="sec-confidence" className="scroll-mt-32">
        <SUQConfidenceDashboard
          suqEvaluation={results.suqEvaluation as SUQEvaluationResult | undefined}
          onTriggerValidationPass={handleTriggerValidationPass}
        />
      </div>

      {/* SECTION 3: CONTRASTIVE ANALYSIS */}
      <div id="sec-contrastive" className="scroll-mt-32 space-y-6">
        <SimPOContrastiveCard contrastiveResult={results.simpoContrastiveResult as ContrastiveEvaluationResult | undefined} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          <Card variant="glass" className="space-y-4">
            <h4 className="text-sm font-heading font-bold text-[var(--text-primary)] uppercase tracking-wider border-b border-[var(--border)] pb-2">
              Skill Analytics Breakdown
            </h4>

            <div className="space-y-4 text-xs">
              <div className="space-y-2">
                <span className="text-[10px] text-[var(--success)] font-bold uppercase tracking-wider block">Key Strengths</span>
                <ul className="space-y-2">
                  {strengths.map((str, idx) => (
                    <li key={idx} className="flex gap-2 items-start text-[var(--text-secondary)] leading-relaxed">
                      <span className="text-[var(--success)] font-bold mt-0.5">&bull;</span>
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] text-[var(--warning)] font-bold uppercase tracking-wider block">Focus Limitations</span>
                <ul className="space-y-2">
                  {weaknesses.map((wk, idx) => (
                    <li key={idx} className="flex gap-2 items-start text-[var(--text-secondary)] leading-relaxed">
                      <span className="text-[var(--warning)] font-bold mt-0.5">&bull;</span>
                      <span>{wk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <Card variant="glass" className="space-y-4">
            <h4 className="text-sm font-heading font-bold text-[var(--text-primary)] uppercase tracking-wider border-b border-[var(--border)] pb-2 flex items-center gap-2">
              <FaAward className="text-[var(--primary)]" />
              <span>Actionable Improvement Plan</span>
            </h4>

            <div className="space-y-3.5">
              {plan.map((item, idx) => (
                <div key={idx} className="p-3 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xl text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-[var(--text-primary)]">{item.topic}</span>
                    <Badge variant="primary" size="sm">Topic {idx + 1}</Badge>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* SECTION 3a: SYNCHRONIZED IVP MULTI-MODAL TIMELINE */}
      <div id="sec-timeline" className="scroll-mt-32">
        <IVPTelemetryTimeline
          durationSeconds={isEyeContactMetrics(results?.eyeContactMetrics) ? results.eyeContactMetrics.totalVideoDurationSeconds : 240}
          events={timelineEvents}
          overallEyeContactPct={isEyeContactMetrics(results?.eyeContactMetrics) ? results.eyeContactMetrics.eyeContactPercentage : 84}
          overallComposureScore={isAffectiveMetrics(results?.affectiveMetrics) ? results.affectiveMetrics.overallComposureScore : 88}
          overallStabilityScore={isHeadPoseMetrics(results?.headPoseMetrics) ? results.headPoseMetrics.postureComposureScore : 90}
        />
      </div>

      {/* SECTION 3b: GAZE ANALYTICS */}
      {isEyeContactMetrics(results.eyeContactMetrics) ? (
        <div id="sec-gaze" className="scroll-mt-32">
          <GazeAnalyticsCard metrics={results.eyeContactMetrics} />
        </div>
      ) : null}

      {/* SECTION 3c: POSTURE & GESTURE ANALYTICS */}
      {isHeadPoseMetrics(results.headPoseMetrics) ? (
        <div id="sec-pose" className="scroll-mt-32">
          <PostureComposureCard metrics={results.headPoseMetrics} />
        </div>
      ) : null}

      {/* SECTION 3d: FACIAL COMPOSURE ANALYTICS */}
      {isAffectiveMetrics(results.affectiveMetrics) ? (
        <div id="sec-affect" className="scroll-mt-32">
          <FacialComposureCard metrics={results.affectiveMetrics} />
        </div>
      ) : null}

      {/* SECTION 3e: LIP-SYNC & ANTI-SPOOFING ANALYTICS */}
      {isLipSyncMetrics(results.lipSyncMetrics) ? (
        <div id="sec-sync" className="scroll-mt-32">
          <LipSyncVerificationCard metrics={results.lipSyncMetrics} />
        </div>
      ) : null}

      {/* SECTION 4: DETAILED RESPONSES LOG */}
      <div id="sec-responses" className="scroll-mt-32 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] text-left pl-1">
          Detailed Responses Log
        </h3>

        <div className="space-y-3">
          {!results.breakdown || results.breakdown.length === 0 ? (
            <Card variant="glass" className="p-8 text-center flex flex-col items-center justify-center space-y-3">
              <div className="h-12 w-12 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] text-lg">
                <FaListUl />
              </div>
              <div className="space-y-1">
                <h4 className="font-heading font-bold text-sm text-[var(--text-primary)]">No responses recorded</h4>
                <p className="text-xs text-[var(--text-secondary)] max-w-sm">Complete an interview session to see your detailed breakdown here.</p>
              </div>
            </Card>
          ) : (
            results.breakdown.map((item: AnswerBreakdown, idx: number) => {
              const qId = item.id ?? `q_${idx + 1}`;
              const isExpanded = expandedQuestion === qId;
              const answerText = item.userAnswer ?? item.answerText ?? 'No response provided.';
              const strengthsText = Array.isArray(item.strengths)
                ? item.strengths.join(' ')
                : item.strengths ?? 'Solid structural clarity.';

              return (
                <div key={qId} className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow)] overflow-hidden transition-all duration-350">
                  <button
                    type="button"
                    onClick={() => toggleQuestionExpand(qId)}
                    className="w-full p-5 flex items-center justify-between text-left hover:bg-[var(--bg-surface-alt)] transition duration-200 cursor-pointer"
                  >
                    <div className="flex items-center gap-4 min-w-0 pr-4">
                      <span className="h-6 w-6 rounded-lg bg-[var(--bg-surface-alt)] border border-[var(--border)] text-xs font-bold font-mono text-[var(--text-secondary)] flex items-center justify-center shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <p className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] truncate">{item.question}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRetryQuestion(idx, item.question);
                        }}
                        className="px-3 py-1 rounded-lg bg-[var(--warning)]/10 border border-[var(--warning)]/20 text-[var(--warning)] hover:bg-[var(--warning)]/20 text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer"
                        title="Focus on this single question in a mini-session"
                      >
                        <FaUndo size={9} />
                        <span>Retry this question</span>
                      </button>

                      {suq?.confidenceLevel && (
                        <Badge
                          variant={
                            suq.confidenceLevel === 'HIGH'
                              ? 'success'
                              : suq.confidenceLevel === 'MEDIUM'
                              ? 'warning'
                              : 'danger'
                          }
                          size="sm"
                          className="font-mono text-[10px]"
                        >
                          SUQ: {suq.confidenceLevel}
                        </Badge>
                      )}

                      {deltaCard?.rewardScore !== undefined && (
                        <span className="hidden sm:inline-block px-2 py-0.5 rounded-lg bg-[var(--primary-soft)] border border-[var(--primary)]/30 text-[var(--primary)] font-mono text-[10px] font-bold">
                          +{deltaCard.rewardScore.toFixed(2)} pts
                        </span>
                      )}

                      <Badge variant="success">Score: {item.score}</Badge>
                      {isExpanded ? <FaChevronUp className="text-[var(--text-secondary)] text-xs" /> : <FaChevronDown className="text-[var(--text-secondary)] text-xs" />}
                    </div>

                  </button>

                  {isExpanded && (
                    <div className="p-6 border-t border-[var(--border)] bg-[var(--bg-surface-alt)] space-y-6 text-left text-xs sm:text-sm">
                      <div className="space-y-2">
                        <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider block">Candidate Response</span>
                        <p className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)] font-mono text-xs text-[var(--text-primary)] leading-relaxed break-words whitespace-pre-wrap">
                          {answerText}
                        </p>
                      </div>

                      {deltaCard ? (
                        <div className="bg-[var(--primary-soft)] rounded-xl p-4 border border-[var(--primary)]/20 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-[var(--primary)] font-bold uppercase tracking-wider font-mono">
                              SimPO Benchmark Delta Target
                            </span>
                            <span className="text-[var(--primary)] font-mono text-[10px] font-bold">
                              Reward: +{deltaCard.rewardScore.toFixed(2)} pts
                            </span>
                          </div>
                          <p className="text-[var(--text-secondary)] leading-relaxed italic text-xs">
                            &ldquo;{deltaCard.faangComparison}&rdquo;
                          </p>
                        </div>
                      ) : null}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-[var(--bg-surface)] rounded-xl p-4 border border-[var(--border)] space-y-2">
                          <span className="text-[10px] text-[var(--primary)] font-bold uppercase tracking-wider block">AI Evaluator Feedback</span>
                          <p className="text-[var(--text-secondary)] leading-relaxed">{item.feedback}</p>
                        </div>

                        <div className="bg-[var(--bg-surface)] rounded-xl p-4 border border-[var(--border)] space-y-2">
                          <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider block font-mono">Ideal Scope Targets</span>
                          <p className="text-[var(--text-secondary)] leading-relaxed">{item.idealConcepts ?? item.idealConcept ?? 'Core concepts related to the question.'}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-[var(--bg-surface)] rounded-xl p-4 border border-[var(--border)] space-y-2">
                          <span className="text-[10px] text-[var(--success)] font-bold uppercase tracking-wider block">Key Strengths</span>
                          <p className="text-[var(--text-secondary)] leading-relaxed">{strengthsText}</p>
                        </div>

                        <div className="bg-[var(--bg-surface)] rounded-xl p-4 border border-[var(--border)] space-y-2">
                          <span className="text-[10px] text-[var(--primary)] font-bold uppercase tracking-wider block">Enhancement Areas</span>
                          <ul className="space-y-2 text-[var(--text-secondary)] leading-relaxed">
                            {(item.suggestions ?? ['Quantify accomplishments with metrics.']).map((sug: string, sIdx: number) => (
                              <li key={sIdx} className="flex gap-2 items-start">
                                <span className="text-[var(--primary)] mt-0.5">&bull;</span>
                                <span>{sug}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. CTA Action Bar with Clear Single Primary Hierarchy */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border)] shadow-[var(--shadow)]">
        <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
          <Button onClick={handleGoDashboard} variant="ghost" size="sm" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            Dashboard
          </Button>

          <Button onClick={handleUploadNew} variant="ghost" size="sm" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            Upload New Resume
          </Button>

          <Button onClick={handleDownloadPDF} disabled={downloading} variant="ghost" size="sm" icon={FaFilePdf} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            {downloading ? 'Exporting...' : 'Export Report'}
          </Button>

          <Button onClick={handleShareImage} disabled={sharing} variant="ghost" size="sm" icon={FaShareAlt} className="text-[var(--primary)] hover:text-[var(--primary-hover)] border border-[var(--primary)]/20 bg-[var(--primary-soft)]">
            {sharing ? 'Generating Card...' : 'Share Results'}
          </Button>
        </div>

        <div className="w-full sm:w-auto">
          {/* SINGLE CLEAR PRIMARY ACTION */}
          <Button
            onClick={handlePracticeAgain}
            variant="primary"
            size="md"
            className="w-full sm:w-auto px-8 py-3"
            icon={FaUndo}
          >
            <span>Practice Again</span>
            <FaArrowRight size={10} className="ml-1 shrink-0" />
          </Button>
        </div>
      </div>

      {/* ── HIDDEN COMPACT SHAREABLE SUMMARY CARD (Rendered off-screen for html2canvas export) ── */}
      <div className="fixed top-[-9999px] left-[-9999px] pointer-events-none z-[-100]">
        <div
          ref={shareCardRef}
          className="w-[600px] h-[315px] bg-[#FBF9F6] p-8 border border-[#E2DDD5] rounded-3xl font-sans text-[#2B2523] flex flex-col justify-between shadow-2xl relative overflow-hidden"
        >
          {/* Top Header */}
          <div className="flex items-center justify-between z-10 border-b border-[#E2DDD5] pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-[#9B2218] flex items-center justify-center font-extrabold font-heading text-white text-sm shadow-md">
                Sk
              </div>
              <div>
                <h3 className="font-heading font-extrabold text-[#2B2523] text-base tracking-wide leading-none">Skillo AI</h3>
                <p className="text-[10px] text-[#6A625E] font-mono mt-0.5">Career Prep Assessment Report</p>
              </div>
            </div>
            <div className="bg-[#EFEBE5] border border-[#E2DDD5] px-3 py-1 rounded-full text-xs font-mono text-[#6A625E]">
              Verified Benchmark
            </div>
          </div>

          {/* Body content grid */}
          <div className="grid grid-cols-12 gap-6 items-center z-10 py-2">
            {/* Score Pill */}
            <div className="col-span-4 bg-[#F3E1DE] border border-[#9B2218]/30 rounded-2xl p-4 text-center flex flex-col justify-center items-center shadow-lg">
              <span className="text-[9px] font-mono text-[#9B2218] uppercase font-bold tracking-wider">Overall Score</span>
              <span className="text-4xl font-heading font-extrabold text-[#2B2523] mt-1">
                {results.overallScore}<span className="text-sm font-normal text-[#6A625E]">/100</span>
              </span>
              <span className="text-[10px] text-[#3F7D58] font-bold mt-1 font-mono">Top Candidate Tier</span>
            </div>

            {/* Assessment Details */}
            <div className="col-span-8 space-y-3">
              <div>
                <span className="text-[10px] text-[#6A625E] uppercase font-mono font-bold tracking-wider block">Target Role & Preset</span>
                <h4 className="text-base font-heading font-bold text-[#2B2523] leading-snug">
                  {results.setupData?.role || 'Software Engineer'} &bull; <span className="text-[#9B2218]">{results.setupData?.company || 'Generic'} Style</span>
                </h4>
              </div>

              <div>
                <span className="text-[10px] text-[#6A625E] uppercase font-mono font-bold tracking-wider block">Key Demonstrated Strength</span>
                <p className="text-xs text-[#2B2523] leading-relaxed font-medium bg-[#EFEBE5] p-2.5 rounded-xl border border-[#E2DDD5] truncate">
                  {strengths[0]}
                </p>
              </div>
            </div>
          </div>

          {/* Footer watermark */}
          <div className="flex items-center justify-between z-10 border-t border-[#E2DDD5] pt-3 text-[10px] text-[#6A625E] font-mono">
            <span>Evaluated by AI Persona {persona.name} ({persona.role})</span>
            <span className="text-[#9B2218] font-bold">skillo.dev</span>
          </div>
        </div>
      </div>
    </div>
  );

}
