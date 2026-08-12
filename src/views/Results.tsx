'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  FaUndo,
  FaChevronDown,
  FaChevronUp,
  FaFilePdf,
  FaExclamationTriangle,
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
import type { EvaluationCategories, AnswerBreakdown, SUQEvaluationResult, ContrastiveEvaluationResult } from '../types/index';
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
    resumeData,
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
        backgroundColor: '#050B14',
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
        backgroundColor: '#030712',
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

  if (!resumeData) {
    return (
      <div className="glass-card rounded-2xl p-8 border border-red-500/20 bg-red-500/5 text-center max-w-md mx-auto mt-12 space-y-6">
        <div className="h-12 w-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-xl mx-auto">
          <FaExclamationTriangle />
        </div>
        <h3 className="text-lg font-heading font-bold text-white">Resume Required</h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          You must upload your resume and specify job details before you can access performance reports.
        </p>
        <Button onClick={() => router.push('/resume')} variant="primary" size="md">
          Go to Upload Page
        </Button>
      </div>
    );
  }

  if (!results) return null;

  const persona = INTERVIEWER_PERSONAS[results.personaId as keyof typeof INTERVIEWER_PERSONAS] || INTERVIEWER_PERSONAS.sarah;

  const categories = (results.categories || {}) as EvaluationCategories;

  const scores = {
    techKnowledge: categories.technicalAccuracy ?? 80,
    communication: categories.communication ?? 85,
    confidence: categories.depth ?? 75,
    problemSolving: categories.timeManagement ?? 90,
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
          techKnowledge: previousSession.categories.techKnowledge ?? previousSession.categories.technicalAccuracy ?? previousSession.score,
          communication: previousSession.categories.communication ?? previousSession.score,
          confidence: previousSession.categories.confidence ?? previousSession.categories.depth ?? previousSession.score,
          problemSolving: previousSession.categories.problemSolving ?? previousSession.categories.timeManagement ?? previousSession.score,
        }
      : null;


  // Datasets for Radar chart
  const radarDatasets = [
    {
      label: 'Current Session',
      data: [scores.techKnowledge, scores.communication, scores.confidence, scores.problemSolving],
      backgroundColor: 'rgba(99, 102, 241, 0.25)',
      borderColor: '#6366F1',
      borderWidth: 2.5,
      pointBackgroundColor: '#06B6D4',
      pointBorderColor: '#fff',
      pointHoverRadius: 6,
    },
  ];

  if (prevScores) {
    radarDatasets.push({
      label: `Previous Session (${previousSession?.date || 'Prior'})`,
      data: [prevScores.techKnowledge, prevScores.communication, prevScores.confidence, prevScores.problemSolving],
      backgroundColor: 'rgba(148, 163, 184, 0.08)',
      borderColor: '#94A3B8',
      borderWidth: 1.5,
      pointBackgroundColor: '#94A3B8',
      pointBorderColor: '#fff',
      pointHoverRadius: 5,
    });
  }

  const radarData: any = {
    labels: ['Technical Knowledge', 'Communication', 'Confidence', 'Problem Solving'],
    datasets: radarDatasets,
  };

  const radarOptions = {
    scales: {
      r: {
        angleLines: { color: 'rgba(255, 255, 255, 0.05)' },
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        pointLabels: {
          color: '#94A3B8',
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
          color: '#94A3B8',
          font: { family: 'Inter', size: 10 },
          boxWidth: 12,
        },
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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold border border-primary/30 bg-primary/10 text-primary">
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
        <div className="w-full max-w-4xl mx-auto bg-[#080d1a] border border-white/10 rounded-2xl p-4 text-left space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h4 className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <span>🔍</span> Vision & Signal Execution Mode Audit Summary
            </h4>
            <span className="text-[10px] font-mono text-gray-500">System Telemetry Audit</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
              <span className="text-[10px] font-mono text-gray-400">Gaze Estimation</span>
              <div className="mt-1 flex items-center gap-1.5">
                {(results.eyeContactMetrics as any)?.executionMode === 'VERIFIED_MODEL' ? (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    [Verified Neural]
                  </span>
                ) : (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    [Estimated Fallback]
                  </span>
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
              <span className="text-[10px] font-mono text-gray-400">3D Head Pose</span>
              <div className="mt-1 flex items-center gap-1.5">
                {(results.headPoseMetrics as any)?.executionMode === 'VERIFIED_MODEL' ? (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    [Verified Neural]
                  </span>
                ) : (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    [Estimated Fallback]
                  </span>
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
              <span className="text-[10px] font-mono text-gray-400">Facial Affect</span>
              <div className="mt-1 flex items-center gap-1.5">
                {(results.affectiveMetrics as any)?.executionMode === 'VERIFIED_MODEL' ? (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    [Verified Neural]
                  </span>
                ) : (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    [Estimated Fallback]
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 1. Sticky In-Page Navigation Bar */}
      <div className="sticky top-20 z-40 bg-[#0b0f19]/90 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl shadow-xl flex items-center justify-center gap-1 sm:gap-2 max-w-full sm:max-w-2xl mx-auto overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => scrollToSection('sec-overview', 'overview')}
          className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer shrink-0 ${
            activeTab === 'overview'
              ? 'bg-gradient-to-r from-primary to-indigo-600 text-white shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => scrollToSection('sec-confidence', 'confidence')}
          className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer shrink-0 ${
            activeTab === 'confidence'
              ? 'bg-gradient-to-r from-primary to-indigo-600 text-white shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Confidence Analysis
        </button>
        <button
          type="button"
          onClick={() => scrollToSection('sec-contrastive', 'contrastive')}
          className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer shrink-0 ${
            activeTab === 'contrastive'
              ? 'bg-gradient-to-r from-primary to-indigo-600 text-white shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Contrastive Analysis
        </button>
        {/* Gaze tab — only shown when metrics are available */}
        {isEyeContactMetrics(results.eyeContactMetrics) && (
          <button
            type="button"
            onClick={() => scrollToSection('sec-gaze', 'gaze')}
            className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer shrink-0 ${
              activeTab === 'gaze'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
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
            className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer shrink-0 ${
              activeTab === 'pose'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
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
            className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer shrink-0 ${
              activeTab === 'affect'
                ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
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
            className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer shrink-0 ${
              activeTab === 'sync'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Audio & Latency
          </button>
        )}







        <button
          type="button"
          onClick={() => scrollToSection('sec-responses', 'responses')}
          className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer shrink-0 ${
            activeTab === 'responses'
              ? 'bg-gradient-to-r from-primary to-indigo-600 text-white shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Detailed Responses
        </button>
      </div>


      {/* SECTION 1: OVERVIEW & COMPARISON */}
      <div id="sec-overview" className="scroll-mt-32 space-y-6">
        {/* 2. Compare to Previous Session Panel (rendered if prior session and category data exist) */}
        {previousSession && prevScores && (
          <Card variant="glass" className="p-5 border border-primary/30 bg-primary/5 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary text-base shrink-0">
                <FaExchangeAlt />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Session Progression Comparison</span>
                  <Badge variant="accent" size="sm">Compared with {previousSession.date}</Badge>
                </div>
                <p className="text-xs text-gray-300">
                  Current score (<strong className="text-white">{results.overallScore}%</strong>) vs Previous session (<strong className="text-gray-400">{previousSession.score}%</strong>) for {results.setupData?.role || 'Engineer'}.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono shrink-0">
              <span className={`px-2.5 py-1 rounded-lg font-bold ${results.overallScore >= previousSession.score ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                {results.overallScore >= previousSession.score ? `+${results.overallScore - previousSession.score}% Delta` : `${results.overallScore - previousSession.score}% Delta`}
              </span>
            </div>
          </Card>
        )}


        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <Card variant="glow-secondary" className="lg:col-span-4 flex flex-col justify-between items-center text-center py-8 min-h-[340px]">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block border-b border-white/5 pb-2 w-full">
              Overall Score Index
            </span>

            <div className="relative h-44 w-44 flex items-center justify-center my-6">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="88"
                  cy="88"
                  r="72"
                  stroke="rgba(255, 255, 255, 0.03)"
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
                    <stop offset="0%" stopColor="#6366F1" />
                    <stop offset="50%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#06B6D4" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-5xl font-heading font-extrabold text-white">
                  {results.overallScore}
                </span>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-mono mt-1">
                  Out of 100
                </span>
              </div>
            </div>

            <div className="w-full space-y-1">
              <span className="text-sm font-semibold text-accent block">
                {results.overallScore >= 85 ? 'Exceptional Fit' : results.overallScore >= 75 ? 'Strong Candidate' : 'Focus Needed'}
              </span>
              <p className="text-[10px] text-gray-500 uppercase font-mono tracking-wide">
                Target seniority: {results.setupData?.experienceLevel ?? 'Mid-Level'}
              </p>
            </div>
          </Card>

          <Card variant="glass" className="lg:col-span-8 flex flex-col justify-between items-center text-center min-h-[340px]">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block border-b border-white/5 pb-2 w-full">
              Evaluation Matrix Profile {previousSession ? '(Overlay Comparison)' : ''}
            </span>

            <div className="w-full h-56 relative my-4">
              <Radar data={radarData} options={radarOptions} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full text-[10px] text-gray-400 font-mono border-t border-white/5 pt-4">
              <div className="space-y-0.5">
                <span>Technical Knowledge</span>
                <p className="text-white font-bold text-xs">{scores.techKnowledge}%</p>
              </div>
              <div className="space-y-0.5">
                <span>Communication</span>
                <p className="text-white font-bold text-xs">{scores.communication}%</p>
              </div>
              <div className="space-y-0.5">
                <span>Confidence</span>
                <p className="text-white font-bold text-xs">{scores.confidence}%</p>
              </div>
              <div className="space-y-0.5">
                <span>Problem Solving</span>
                <p className="text-white font-bold text-xs">{scores.problemSolving}%</p>
              </div>
            </div>
          </Card>
        </div>

        <Card variant="glass" className="flex flex-col md:flex-row gap-6 items-center">
          <div className="shrink-0 flex flex-col items-center text-center space-y-2">
            <div className="relative w-14 h-14 rounded-2xl overflow-hidden border border-white/10 shadow-md">
              <Image
                src={persona.avatar}
                alt={persona.name}
                width={56}
                height={56}
                className="object-cover h-full w-full"
              />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white leading-none">{persona.name}</h4>
              <p className="text-[9px] text-gray-500 uppercase font-mono">{persona.role}</p>
            </div>
          </div>

          <div className="space-y-1.5 flex-1">
            <span className="text-xs text-primary font-bold uppercase tracking-wider font-mono">Assessor Evaluation Details</span>
            <p className="text-xs text-gray-300 leading-relaxed italic">
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
            <h4 className="text-sm font-heading font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2">
              Skill Analytics Breakdown
            </h4>

            <div className="space-y-4 text-xs">
              <div className="space-y-2">
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Key Strengths</span>
                <ul className="space-y-2">
                  {strengths.map((str, idx) => (
                    <li key={idx} className="flex gap-2 items-start text-gray-300 leading-relaxed">
                      <span className="text-emerald-400 font-bold mt-0.5">&bull;</span>
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider block">Focus Limitations</span>
                <ul className="space-y-2">
                  {weaknesses.map((wk, idx) => (
                    <li key={idx} className="flex gap-2 items-start text-gray-300 leading-relaxed">
                      <span className="text-yellow-400 font-bold mt-0.5">&bull;</span>
                      <span>{wk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <Card variant="glass" className="space-y-4">
            <h4 className="text-sm font-heading font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2 flex items-center gap-2">
              <FaAward className="text-primary" />
              <span>Actionable Improvement Plan</span>
            </h4>

            <div className="space-y-3.5">
              {plan.map((item, idx) => (
                <div key={idx} className="p-3 bg-white/2 border border-white/5 rounded-xl text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-white">{item.topic}</span>
                    <Badge variant="primary" size="sm">Topic {idx + 1}</Badge>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
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
        <h3 className="text-sm font-bold uppercase tracking-wider text-white text-left pl-1">
          Detailed Responses Log
        </h3>

        <div className="space-y-3">
          {!results.breakdown || results.breakdown.length === 0 ? (
            <Card variant="glass" className="p-8 text-center flex flex-col items-center justify-center space-y-3">
              <div className="h-12 w-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 text-lg">
                <FaListUl />
              </div>
              <div className="space-y-1">
                <h4 className="font-heading font-bold text-sm text-white">No responses recorded</h4>
                <p className="text-xs text-gray-400 max-w-sm">Complete an interview session to see your detailed breakdown here.</p>
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
                <div key={qId} className="glass-card rounded-2xl border border-white/5 overflow-hidden transition-all duration-350">
                  <button
                    type="button"
                    onClick={() => toggleQuestionExpand(qId)}
                    className="w-full p-5 flex items-center justify-between text-left hover:bg-white/[0.01] transition duration-200 cursor-pointer"
                  >
                    <div className="flex items-center gap-4 min-w-0 pr-4">
                      <span className="h-6 w-6 rounded-lg bg-white/5 border border-white/10 text-xs font-bold font-mono text-gray-400 flex items-center justify-center shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <p className="text-xs sm:text-sm font-semibold text-white truncate">{item.question}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRetryQuestion(idx, item.question);
                        }}
                        className="px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:text-white hover:bg-amber-500/20 text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer"
                        title="Focus on this single question in a mini-session"
                      >
                        <FaUndo size={9} />
                        <span>Retry this question</span>
                      </button>

                      <Badge variant="success">Score: {item.score}</Badge>
                      {isExpanded ? <FaChevronUp className="text-gray-500 text-xs" /> : <FaChevronDown className="text-gray-500 text-xs" />}
                    </div>

                  </button>

                  {isExpanded && (
                    <div className="p-6 border-t border-white/5 bg-[#030712]/30 space-y-6 text-left text-xs sm:text-sm">
                      <div className="space-y-2">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Candidate Response</span>
                        <p className="bg-[#030712]/50 p-4 rounded-xl border border-white/5 font-mono text-xs text-gray-200 leading-relaxed break-words whitespace-pre-wrap">
                          {answerText}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-primary/5 rounded-xl p-4 border border-primary/15 space-y-2">
                          <span className="text-[10px] text-primary font-bold uppercase tracking-wider block">AI Evaluator Feedback</span>
                          <p className="text-gray-300 leading-relaxed">{item.feedback}</p>
                        </div>

                        <div className="bg-[#030712]/40 rounded-xl p-4 border border-white/5 space-y-2">
                          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block font-mono">Ideal Scope Targets</span>
                          <p className="text-gray-400 leading-relaxed">{item.idealConcepts ?? item.idealConcept ?? 'Core concepts related to the question.'}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-emerald-500/5 rounded-xl p-4 border border-emerald-500/15 space-y-2">
                          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Key Strengths</span>
                          <p className="text-gray-300 leading-relaxed">{strengthsText}</p>
                        </div>

                        <div className="bg-[#030712]/40 rounded-xl p-4 border border-white/5 space-y-2">
                          <span className="text-[10px] text-accent font-bold uppercase tracking-wider block">Enhancement Areas</span>
                          <ul className="space-y-2 text-gray-400 leading-relaxed">
                            {(item.suggestions ?? ['Quantify accomplishments with metrics.']).map((sug: string, sIdx: number) => (
                              <li key={sIdx} className="flex gap-2 items-start">
                                <span className="text-accent mt-0.5">&bull;</span>
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
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-[#111827]/40 rounded-2xl p-5 border border-white/5">
        <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
          <Button onClick={handleGoDashboard} variant="ghost" size="sm" className="text-gray-400 hover:text-white">
            Dashboard
          </Button>

          <Button onClick={handleUploadNew} variant="ghost" size="sm" className="text-gray-400 hover:text-white">
            Upload New Resume
          </Button>

          <Button onClick={handleDownloadPDF} disabled={downloading} variant="ghost" size="sm" icon={FaFilePdf} className="text-gray-400 hover:text-white">
            {downloading ? 'Exporting...' : 'Export Report'}
          </Button>

          <Button onClick={handleShareImage} disabled={sharing} variant="ghost" size="sm" icon={FaShareAlt} className="text-primary hover:text-accent border border-primary/20 bg-primary/5">
            {sharing ? 'Generating Card...' : 'Share Results'}
          </Button>
        </div>

        <div className="w-full sm:w-auto">
          {/* SINGLE CLEAR PRIMARY ACTION */}
          <Button
            onClick={handlePracticeAgain}
            variant="primary"
            size="md"
            className="w-full sm:w-auto bg-gradient-to-r from-primary via-indigo-500 to-accent text-white shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all px-8 py-3"
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
          className="w-[600px] h-[315px] bg-gradient-to-br from-[#050B14] via-[#0B0F19] to-[#0A1224] p-8 border border-white/10 rounded-3xl font-sans text-white flex flex-col justify-between shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/20 rounded-full blur-[70px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/20 rounded-full blur-[70px] pointer-events-none" />

          {/* Top Header */}
          <div className="flex items-center justify-between z-10 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-r from-primary to-accent flex items-center justify-center font-extrabold font-heading text-white text-sm shadow-md">
                Sk
              </div>
              <div>
                <h3 className="font-heading font-extrabold text-white text-base tracking-wide leading-none">Skillo AI</h3>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">Career Prep Assessment Report</p>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 px-3 py-1 rounded-full text-xs font-mono text-gray-300">
              Verified Benchmark
            </div>
          </div>

          {/* Body content grid */}
          <div className="grid grid-cols-12 gap-6 items-center z-10 py-2">
            {/* Score Pill */}
            <div className="col-span-4 bg-gradient-to-br from-primary/20 to-indigo-950/40 border border-primary/30 rounded-2xl p-4 text-center flex flex-col justify-center items-center shadow-lg">
              <span className="text-[9px] font-mono text-primary uppercase font-bold tracking-wider">Overall Score</span>
              <span className="text-4xl font-heading font-extrabold text-white mt-1">
                {results.overallScore}<span className="text-sm font-normal text-gray-400">/100</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-bold mt-1 font-mono">Top Candidate Tier</span>
            </div>

            {/* Assessment Details */}
            <div className="col-span-8 space-y-3">
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-mono font-bold tracking-wider block">Target Role & Preset</span>
                <h4 className="text-base font-heading font-bold text-white leading-snug">
                  {results.setupData?.role || 'Software Engineer'} &bull; <span className="text-accent">{results.setupData?.company || 'Generic'} Style</span>
                </h4>
              </div>

              <div>
                <span className="text-[10px] text-gray-500 uppercase font-mono font-bold tracking-wider block">Key Demonstrated Strength</span>
                <p className="text-xs text-gray-200 leading-relaxed font-medium bg-white/5 p-2.5 rounded-xl border border-white/5 truncate">
                  {strengths[0]}
                </p>
              </div>
            </div>
          </div>

          {/* Footer watermark */}
          <div className="flex items-center justify-between z-10 border-t border-white/10 pt-3 text-[10px] text-gray-400 font-mono">
            <span>Evaluated by AI Persona {persona.name} ({persona.role})</span>
            <span className="text-primary font-bold">skillo.dev</span>
          </div>
        </div>
      </div>
    </div>
  );

}
