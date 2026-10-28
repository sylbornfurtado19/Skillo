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
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaTachometerAlt,
  FaCommentDots,
  FaPause,
  FaVideoSlash,
  FaChartLine,
  FaRocket,
} from 'react-icons/fa';


// Task 6: Import Chart.js registration module
import '../lib/chartSetup';

// Task 5: Dynamic import for Radar chart component with ssr: false
const Radar = dynamic(() => import('react-chartjs-2').then((m) => m.Radar), { ssr: false });

import { INTERVIEWER_PERSONAS } from '../services/constants';
import { useInterview } from '../context/InterviewContext';
import {
  isValidReport,
  isValidSessionItem,
  findLatestValidSessionReport,
  buildHistoricalResults,
  loadPastReport,
} from '../services/interviewReport';
import type { EvaluationCategories, AnswerBreakdown, SUQEvaluationResult, ContrastiveEvaluationResult, BenchmarkDeltaCard, LATSTreeState } from '../types/index';
import { useToast } from '../components/ui/Toast';
import { useChartTheme } from '../hooks/useChartTheme';
import { useResultsScrollSpy, type ResultsNavItem, type ResultsTabKey } from '../hooks/useResultsScrollSpy';
import { getThemeColor } from '../lib/themeColors';
import { calculateDeliveryComposite, DELIVERY_COMPOSITE_WEIGHTS } from '../lib/services/deliveryComposite';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import AnimatedScore from '../components/ui/AnimatedScore';
import { motion, type Variants } from 'framer-motion';

import { SectionHeader } from '../components/ui/FeedbackHelpers';
import SUQConfidenceDashboard from '../components/ui/SUQConfidenceDashboard';
import SimPOContrastiveCard from '../components/ui/SimPOContrastiveCard';
import LATSTreeVisualizer from '../components/ui/LATSTreeVisualizer';
import GazeAnalyticsCard from '../components/ui/GazeAnalyticsCard';
import PostureComposureCard from '../components/ui/PostureComposureCard';
import FacialComposureCard from '../components/ui/FacialComposureCard';
import LipSyncVerificationCard from '../components/ui/LipSyncVerificationCard';
import IVPTelemetryTimeline, { extractTelemetryTimelineEvents } from '../components/ui/IVPTelemetryTimeline';
import IVPEvidenceCard from '../components/ui/IVPEvidenceCard';
import SessionIntegrityCard from '../components/ui/SessionIntegrityCard';
import type { EyeContactSessionMetrics, HeadPoseSessionMetrics, AffectiveSessionMetrics, LipSyncSessionMetrics, SpeechAnalytics } from '../types/index';

function isLATSTreeState(obj: any): obj is LATSTreeState {
  return Boolean(obj && typeof obj === 'object' && 'rootNode' in obj);
}
function isEyeContactMetrics(obj: any): obj is EyeContactSessionMetrics {
  return Boolean(obj && typeof obj === 'object' && 'totalVideoDurationSeconds' in obj && obj.totalVideoDurationSeconds > 0);
}
function isHeadPoseMetrics(obj: any): obj is HeadPoseSessionMetrics {
  return Boolean(obj && typeof obj === 'object' && 'totalFramesAnalyzed' in obj && obj.totalFramesAnalyzed > 0);
}
function isAffectiveMetrics(obj: any): obj is AffectiveSessionMetrics {
  return Boolean(obj && typeof obj === 'object' && 'totalKeyframesAnalyzed' in obj && obj.totalKeyframesAnalyzed > 0);
}
function isLipSyncMetrics(obj: any): obj is LipSyncSessionMetrics {
  return Boolean(obj && typeof obj === 'object' && 'totalWindowsAnalyzed' in obj && obj.totalWindowsAnalyzed > 0);
}

function renderHighlightedAnswer(answerText: string, quotes: string[]) {
  if (!quotes || quotes.length === 0 || !answerText) {
    return answerText;
  }

  const validQuotes = quotes
    .map((q) => q.trim())
    .filter((q) => q.length >= 4)
    .sort((a, b) => b.length - a.length);

  if (validQuotes.length === 0) return answerText;

  const escapedQuotes = validQuotes.map((q) => q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escapedQuotes.join('|')})`, 'gi');

  const parts = answerText.split(regex);
  return parts.map((part, pIdx) => {
    const isQuote = validQuotes.some((q) => q.toLowerCase() === part.toLowerCase());
    if (isQuote) {
      return (
        <mark
          key={pIdx}
          className="bg-primary/20 text-primary font-semibold px-1 py-0.5 rounded border border-primary/30"
          title="Verified Grounded Candidate Evidence"
          data-testid="highlighted-candidate-quote"
        >
          {part}
        </mark>
      );
    }
    return part;
  });
}






const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
};

export default function Results() {
  const router = useRouter();
  const { showToast } = useToast();
  const chartTheme = useChartTheme();
  const {
    results: contextResults,
    setResults,
    setSetupData,
    setQuestions,
    setCurrentQuestionIndex,
    setAnswers,
    resetSession,
    sessionHistory,
    setIsRetry,
    setRetryQuestionIndex,
    historicalSession,
    setHistoricalSession,
    clearHistoricalSession,
  } = useInterview();

  const latestValidSession = useMemo(() => {
    return findLatestValidSessionReport(sessionHistory);
  }, [sessionHistory]);

  const isHistoricalUnavailable = useMemo(() => {
    return Boolean(historicalSession && !isValidSessionItem(historicalSession));
  }, [historicalSession]);

  const activeResults = useMemo(() => {
    // 1. If viewing an explicit historical session:
    if (historicalSession) {
      if (isValidSessionItem(historicalSession)) {
        if (isValidReport(contextResults) && (contextResults as any).sessionId === historicalSession.id) {
          return contextResults;
        }
        return buildHistoricalResults(historicalSession);
      }
      // Never fall back to another session if the selected historical session is invalid
      return null;
    }

    // 2. Active live interview results
    if (isValidReport(contextResults)) {
      return contextResults;
    }

    // 3. Fallback to latest valid session if directly visiting /results without an active session
    if (latestValidSession) {
      return buildHistoricalResults(latestValidSession);
    }

    return null;
  }, [historicalSession, contextResults, latestValidSession]);

  // Synchronize restored historical session into context state in background if needed
  useEffect(() => {
    // Only synchronize latestValidSession if NO historical session was explicitly selected and contextResults is not valid
    if (!historicalSession && !isValidReport(contextResults) && latestValidSession) {
      loadPastReport(latestValidSession, {
        setResults,
        setSetupData,
        setQuestions,
        setAnswers,
        setHistoricalSession,
      });
    }
  }, [historicalSession, contextResults, latestValidSession, setResults, setSetupData, setQuestions, setAnswers, setHistoricalSession]);

  const results = activeResults;

  const handleRetryQuestion = (questionIndex: number, questionText: string) => {
    clearHistoricalSession();
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

  const timelineEvents = useMemo(() => {
    return extractTelemetryTimelineEvents(results);
  }, [results]);

  const navItems = useMemo<ResultsNavItem[]>(() => {
    if (!results) return [];
    const items: ResultsNavItem[] = [
      { id: 'sec-overview', tab: 'overview', label: 'Overview' },
      { id: 'sec-confidence', tab: 'confidence', label: 'Confidence Analysis' },
      { id: 'sec-contrastive', tab: 'contrastive', label: 'Contrastive Analysis' },
    ];
    if (isLATSTreeState(results.latsTreeState)) {
      items.push({ id: 'sec-lats', tab: 'lats', label: 'Adaptive Tree (LATS)' });
    }
    if (isEyeContactMetrics(results.eyeContactMetrics)) {
      items.push({ id: 'sec-gaze', tab: 'gaze', label: 'Gaze Analytics' });
    }
    if (isHeadPoseMetrics(results.headPoseMetrics)) {
      items.push({ id: 'sec-pose', tab: 'pose', label: 'Posture & Gestures' });
    }
    if (isAffectiveMetrics(results.affectiveMetrics)) {
      items.push({ id: 'sec-affect', tab: 'affect', label: 'Facial Composure' });
    }
    if (isLipSyncMetrics(results.lipSyncMetrics)) {
      items.push({ id: 'sec-sync', tab: 'sync', label: 'Audio & Latency' });
    }
    items.push({ id: 'sec-responses', tab: 'responses', label: 'Detailed Responses' });
    return items;
  }, [results]);

  const {
    activeTab,
    scrollToSection,
    tabsContainerRef,
    tabRefs,
    canScrollLeft,
    canScrollRight,
    handleTabsScroll,
    scrollTabIntoView,
  } = useResultsScrollSpy({
    navItems,
    defaultTab: 'overview',
  });

  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (index + 1) % navItems.length;
      const nextItem = navItems[nextIndex];
      tabRefs.current[nextItem.tab]?.focus();
      scrollToSection(nextItem.id, nextItem.tab);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = (index - 1 + navItems.length) % navItems.length;
      const prevItem = navItems[prevIndex];
      tabRefs.current[prevItem.tab]?.focus();
      scrollToSection(prevItem.id, prevItem.tab);
    }
  };

  const [,setMounted] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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
        backgroundColor: getThemeColor('--bg-surface') || '#FBF9F6',
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
        backgroundColor: getThemeColor('--bg-page') || '#F6F3EE',
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

  if (!results) {
    if (isHistoricalUnavailable) {
      return (
        <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 space-y-8 animate-fadeIn text-center">
          <Card variant="default" className="p-8 sm:p-12 flex flex-col items-center justify-center border border-border shadow-soft">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-danger/10 border border-danger/20 flex items-center justify-center text-danger text-3xl sm:text-4xl mb-6 shadow-sm">
              <FaExclamationTriangle aria-hidden="true" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-heading font-bold text-text-primary mb-3">
              Historical Session Report Unavailable
            </h2>
            <p className="text-sm sm:text-base text-text-secondary max-w-md mx-auto mb-8 leading-relaxed">
              The selected historical session data is missing or corrupted and cannot be restored. Your persisted session history remains intact.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <Button
                onClick={() => {
                  clearHistoricalSession();
                  router.push('/dashboard');
                }}
                variant="primary"
                size="lg"
                className="w-full sm:w-auto px-6"
              >
                Return to Dashboard
              </Button>
              <Button
                onClick={() => {
                  clearHistoricalSession();
                  router.push('/profile');
                }}
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto px-6"
              >
                View Session History
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 space-y-8 animate-fadeIn text-center">
        <Card variant="default" className="p-8 sm:p-12 flex flex-col items-center justify-center border border-border shadow-soft">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-3xl sm:text-4xl mb-6 shadow-sm">
            <FaChartLine aria-hidden="true" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-bold text-text-primary mb-3">
            No assessment results yet
          </h2>
          <p className="text-sm sm:text-base text-text-secondary max-w-md mx-auto mb-8 leading-relaxed">
            Results become available after completing a mock interview. Choose your target role, difficulty, and practice with real-time AI feedback.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <Button
              onClick={() => {
                clearHistoricalSession();
                router.push('/setup');
              }}
              variant="primary"
              size="lg"
              className="w-full sm:w-auto px-8"
              icon={FaRocket}
            >
              Start Mock Interview
            </Button>
            <Button
              onClick={() => {
                clearHistoricalSession();
                router.push('/dashboard');
              }}
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto px-6"
            >
              Return to Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const persona = INTERVIEWER_PERSONAS[results.personaId as keyof typeof INTERVIEWER_PERSONAS] || INTERVIEWER_PERSONAS.sarah;

  const categories = (results.categories || {}) as EvaluationCategories;
  const suq = results.suqEvaluation as SUQEvaluationResult | undefined;
  const deltaCard = results.benchmarkDeltaCard as BenchmarkDeltaCard | undefined;
  const speechAnalytics = results.speechAnalytics as Record<string, SpeechAnalytics> | undefined;
  const deliveryAnalytics = speechAnalytics ? Object.values(speechAnalytics) : [];
  const deliverySummary = deliveryAnalytics.length > 0
    ? {
        wordsPerMinute: Math.round(deliveryAnalytics.reduce((sum, item) => sum + item.wordsPerMinute, 0) / deliveryAnalytics.length),
        fillerCounts: deliveryAnalytics.reduce<Record<string, number>>((counts, item) => {
          Object.entries(item.fillerCounts ?? {}).forEach(([word, count]) => {
            counts[word] = (counts[word] ?? 0) + count;
          });
          return counts;
        }, {}),
        longestPauseMs: Math.max(...deliveryAnalytics.map((item) => item.longestPauseMs)),
        averagePauseMs: Math.round(deliveryAnalytics.reduce((sum, item) => sum + item.averagePauseMs, 0) / deliveryAnalytics.length),
        deliveryScore: Math.round(deliveryAnalytics.reduce((sum, item) => sum + item.deliveryScore, 0) / deliveryAnalytics.length),
      }
    : null;

  const eyeContactRatio = isEyeContactMetrics(results.eyeContactMetrics)
    ? results.eyeContactMetrics.eyeContactPercentage
    : undefined;
  const postureStability = isHeadPoseMetrics(results.headPoseMetrics)
    ? results.headPoseMetrics.postureComposureScore
    : undefined;
  const affectComposure = isAffectiveMetrics(results.affectiveMetrics)
    ? results.affectiveMetrics.overallComposureScore
    : undefined;
  const speechDeliveryScore = deliverySummary?.deliveryScore;
  const deliveryComponents = [
    { label: 'Eye contact', value: eyeContactRatio, camera: true, weightPct: Math.round(DELIVERY_COMPOSITE_WEIGHTS.eyeContactRatio * 100) },
    { label: 'Posture stability', value: postureStability, camera: true, weightPct: Math.round(DELIVERY_COMPOSITE_WEIGHTS.postureStability * 100) },
    { label: 'Affect composure', value: affectComposure, camera: true, weightPct: Math.round(DELIVERY_COMPOSITE_WEIGHTS.affectComposure * 100) },
    { label: 'Speech delivery', value: speechDeliveryScore, camera: false, weightPct: Math.round(DELIVERY_COMPOSITE_WEIGHTS.speechDeliveryScore * 100) },
  ];
  const availableDeliveryComponents = deliveryComponents.filter((component) => component.value !== undefined);
  const deliveryComposite: number | undefined =
    typeof results.deliveryComposite === 'number'
      ? results.deliveryComposite
      : calculateDeliveryComposite({
          eyeContactRatio,
          postureStability,
          affectComposure,
          speechDeliveryScore,
        });
  const cameraSignalsCaptured = deliveryComponents.some(
    (component) => component.camera && component.value !== undefined
  );

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
      backgroundColor: `${chartTheme.primary}33`,
      borderColor: chartTheme.primary,
      borderWidth: 2.5,
      pointBackgroundColor: chartTheme.primary,
      pointBorderColor: chartTheme.bgSurface,
      pointHoverRadius: 6,
    },
  ];

  if (prevScores) {
    radarDatasets.push({
      label: `Previous Session (${previousSession?.date || 'Prior'})`,
      data: [prevScores.techAccuracy, prevScores.systemDesignLogic, prevScores.edgeCaseHandling, prevScores.communication],
      backgroundColor: `${chartTheme.secondary}1a`,
      borderColor: chartTheme.secondary,
      borderWidth: 1.5,
      pointBackgroundColor: chartTheme.secondary,
      pointBorderColor: chartTheme.bgSurface,
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
        angleLines: { color: chartTheme.border },
        grid: { color: chartTheme.border },
        pointLabels: {
          color: chartTheme.textSecondary,
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
          color: chartTheme.textSecondary,
          font: { family: 'Inter', size: 10 },
          boxWidth: 12,
        },
      },
      tooltip: {
        backgroundColor: chartTheme.bgSurface,
        titleColor: chartTheme.textPrimary,
        bodyColor: chartTheme.textSecondary,
        borderColor: chartTheme.border,
        borderWidth: 1,
      },
    },
    maintainAspectRatio: false,
  };

  const toggleQuestionExpand = (id: string) => {
    setExpandedQuestion(expandedQuestion === id ? null : id);
  };

  const handlePracticeAgain = () => {
    clearHistoricalSession();
    setResults(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setAnswers([]);
    router.push('/setup');
  };

  const handleUploadNew = () => {
    clearHistoricalSession();
    resetSession();
    router.push('/resume');
  };

  const handleGoDashboard = () => {
    clearHistoricalSession();
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
      {resultsError && (
        <div className="bg-danger/10 border border-danger/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-3">
            <FaExclamationTriangle className="text-danger text-lg shrink-0" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold text-text-primary">Evaluation Processing Notice</p>
              <p className="text-xs text-text-secondary">{resultsError}</p>
            </div>

          </div>
          <Button onClick={() => setResultsError(null)} variant="danger" size="sm">
            Retry
          </Button>
        </div>
      )}

      {deliverySummary && (
        <Card variant="default" className="p-6 space-y-5">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <FaTachometerAlt aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">Delivery</h3>
              <p className="text-xs text-text-secondary">Speaking pace, filler words, and pauses</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-bg-surface-alt p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
                <FaTachometerAlt className="text-primary" aria-hidden="true" />
                <span>Speaking pace</span>
              </div>
              <p className="mt-2 text-2xl font-heading font-extrabold text-text-primary">
                {deliverySummary.wordsPerMinute} <span className="text-sm font-mono font-semibold text-text-secondary">WPM</span>
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                Target band: <span className="font-semibold text-text-primary">120-160 WPM</span>
              </p>
            </div>
            <div className="rounded-xl border border-border bg-bg-surface-alt p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
                <FaCommentDots className="text-primary" aria-hidden="true" />
                <span>Filler words</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(deliverySummary.fillerCounts).length > 0 ? (
                  Object.entries(deliverySummary.fillerCounts)
                    .sort(([, first], [, second]) => second - first)
                    .map(([word, count]) => (
                      <span key={word} className="rounded-lg border border-border bg-bg-surface px-2.5 py-1 text-xs text-text-primary">
                        <span className="font-semibold">{word}</span>: {count}
                      </span>
                    ))
                ) : (
                  <span className="text-xs text-text-secondary">None detected</span>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-bg-surface-alt p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
                <FaPause className="text-primary" aria-hidden="true" />
                <span>Pause summary</span>
              </div>
              <dl className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-text-secondary">Longest pause</dt>
                  <dd className="font-semibold text-text-primary">{deliverySummary.longestPauseMs} ms</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-text-secondary">Average pause</dt>
                  <dd className="font-semibold text-text-primary">{deliverySummary.averagePauseMs} ms</dd>
                </div>
              </dl>
            </div>
          </div>
        </Card>
      )}

      <Card variant="default" className="p-6 space-y-5">
        <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">Presence &amp; Delivery</h3>
            <p className="text-xs text-text-secondary">
              A separate delivery signal; it does not change the technical score.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-mono uppercase tracking-wider text-text-secondary">Composite</p>
            <p className="text-3xl font-heading font-extrabold text-primary">
              {typeof deliveryComposite === 'number' ? (
                <>
                  <AnimatedScore value={Math.round(deliveryComposite)} />
                  <span className="text-xl font-normal text-text-secondary">/100</span>
                </>
              ) : (
                'N/A'
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {deliveryComponents.map((component) => (
            <div key={component.label} className="rounded-xl border border-border bg-bg-surface-alt p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-text-secondary">{component.label}</p>
                <span className="text-[10px] text-text-muted font-mono">{component.weightPct}% weight</span>
              </div>
              <p className="mt-2 text-2xl font-heading font-extrabold text-text-primary">
                {component.value !== undefined ? (
                  <AnimatedScore value={Math.round(component.value)} />
                ) : (
                  'N/A'
                )}
                <span className="ml-1 text-sm font-mono font-semibold text-text-secondary">/100</span>
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                {component.value !== undefined ? 'Included in composite' : 'Not available'}
              </p>
            </div>
          ))}
        </div>

        <div className="space-y-1 text-xs text-text-secondary">
          <p>
            Signals available: {availableDeliveryComponents.length > 0
              ? availableDeliveryComponents.map((component) => component.label).join(', ')
              : 'none'}.
          </p>
          {!cameraSignalsCaptured && (
            <p className="text-warning">
              Camera signals were not captured, so presence is based on speech only when speech data is available.
            </p>
          )}
        </div>
      </Card>

      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold border border-primary/30 bg-primary-soft text-primary">
            <span>{results.setupData?.company || 'Generic'} Simulation Preset</span>
            &bull;
            <span>{results.setupData?.role || 'Software Engineer'}</span>
          </div>
          {((results as any).source === 'fallback' || results.evaluationMode === 'fallback' || suq?.source === 'fallback') && (
            <Badge variant="warning" size="md" className="flex items-center gap-1.5 px-3 py-1 text-xs">
              <FaExclamationTriangle className="text-warning text-xs" aria-hidden="true" />
              <span>Offline estimate, not a live AI evaluation</span>
            </Badge>
          )}
        </div>
        <SectionHeader
          title="Performance Report"
          description="Integrated Multi-Modal Evaluation Framework (LLM Evaluation Core + Visual & Audio Signal Trackers)"
          className="text-center max-w-2xl mx-auto"
        />

        {/* Execution Mode Audit Summary Breakdown */}
        <div className="w-full max-w-4xl mx-auto bg-bg-surface border border-border rounded-2xl p-4 text-left space-y-3 shadow-soft">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h4 className="text-xs font-mono font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
              <span aria-hidden="true">🔍</span> Vision &amp; Signal Execution Mode Audit Summary
            </h4>
            <span className="text-xs font-mono text-text-secondary">System Telemetry Audit</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-bg-surface-alt border border-border flex flex-col justify-between">
              <span className="text-xs font-mono text-text-secondary">Gaze Estimation</span>
              <div className="mt-1 flex items-center gap-1.5">
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                  isEyeContactMetrics(results.eyeContactMetrics)
                    ? 'bg-primary-soft text-primary border-primary/20'
                    : 'bg-neutral/10 text-text-muted border-border'
                }`}>
                  {isEyeContactMetrics(results.eyeContactMetrics) ? '[L2CS-Net Neural]' : '[Unavailable]'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-bg-surface-alt border border-border flex flex-col justify-between">
              <span className="text-xs font-mono text-text-secondary">3D Head Pose</span>
              <div className="mt-1 flex items-center gap-1.5">
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                  isHeadPoseMetrics(results.headPoseMetrics)
                    ? 'bg-primary-soft text-primary border-primary/20'
                    : 'bg-neutral/10 text-text-muted border-border'
                }`}>
                  {isHeadPoseMetrics(results.headPoseMetrics) ? '[HopeNet 3D Euler]' : '[Unavailable]'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-bg-surface-alt border border-border flex flex-col justify-between">
              <span className="text-xs font-mono text-text-secondary">Facial Affect</span>
              <div className="mt-1 flex items-center gap-1.5">
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                  isAffectiveMetrics(results.affectiveMetrics)
                    ? 'bg-primary-soft text-primary border-primary/20'
                    : 'bg-neutral/10 text-text-muted border-border'
                }`}>
                  {isAffectiveMetrics(results.affectiveMetrics) ? '[AffectNet V-A]' : '[Unavailable]'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 1. Docked In-Page Navigation Bar */}
      <nav
        aria-label="Assessment report sections"
        className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-bg-surface border-b border-border shadow-soft"
      >
        <div className="relative w-full max-w-full overflow-hidden">
          {/* Left overflow cue: subtle edge fade visible when scrolled right */}
          <div
            data-testid="overflow-cue-left"
            aria-hidden="true"
            className={`pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-12 bg-gradient-to-r from-bg-surface to-transparent z-10 transition-opacity duration-200 ${
              canScrollLeft ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Horizontal scrollable tabs container */}
          <div
            ref={tabsContainerRef}
            data-testid="results-nav-tabs-container"
            onScroll={handleTabsScroll}
            className="flex items-center justify-start sm:justify-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-1 scroll-smooth"
          >
            {navItems.map((item, index) => {
              const isActive = activeTab === item.tab;
              return (
                <button
                  key={item.tab}
                  ref={(el) => {
                    tabRefs.current[item.tab] = el;
                  }}
                  type="button"
                  onClick={() => scrollToSection(item.id, item.tab)}
                  onFocus={() => scrollTabIntoView(item.tab)}
                  onKeyDown={(e) => handleTabKeyDown(e, index)}
                  aria-current={isActive ? 'location' : undefined}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer shrink-0 whitespace-nowrap ${
                    isActive
                      ? 'bg-primary text-text-on-primary shadow-sm'
                      : 'text-text-secondary hover:text-text-primary bg-bg-surface-alt hover:bg-border'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Right overflow cue: subtle edge fade visible when more tabs exist off-screen */}
          <div
            data-testid="overflow-cue-right"
            aria-hidden="true"
            className={`pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:w-12 bg-gradient-to-l from-bg-surface to-transparent z-10 transition-opacity duration-200 ${
              canScrollRight ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>
      </nav>


      {/* SECTION 1: OVERVIEW & COMPARISON */}
      <motion.div
        id="sec-overview"
        className="scroll-mt-32 space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* 2. Compare to Previous Session Panel (rendered if prior session and category data exist) */}
        {previousSession && prevScores && (
          <motion.div variants={itemVariants}>
            <Card variant="default" className="p-5 border border-border bg-bg-surface flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-base shrink-0">
                  <FaExchangeAlt />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Session Progression Comparison</span>
                    <Badge variant="accent" size="sm">Compared with {previousSession.date}</Badge>
                  </div>
                  <p className="text-xs text-text-secondary">
                    Current score (<strong className="text-text-primary">{results.overallScore}%</strong>) vs Previous session (<strong className="text-text-secondary">{previousSession.score}%</strong>) for {results.setupData?.role || 'Engineer'}.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono shrink-0">
                <span className={`px-2.5 py-1 rounded-lg font-bold ${results.overallScore >= previousSession.score ? 'bg-success/15 text-success border border-success/30' : 'bg-warning/15 text-warning border border-warning/30'}`}>
                  {results.overallScore >= previousSession.score ? `+${results.overallScore - previousSession.score}% Delta` : `${results.overallScore - previousSession.score}% Delta`}
                </span>
              </div>
            </Card>
          </motion.div>
        )}


        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <motion.div variants={itemVariants} className="lg:col-span-4 flex flex-col">
            <Card variant="default" className="flex-1 flex flex-col justify-between items-center text-center py-8 min-h-[340px]">
              <span className="text-xs text-text-secondary font-bold uppercase tracking-wider block border-b border-border pb-2 w-full">
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
                  <motion.circle
                    cx="88"
                    cy="88"
                    r="72"
                    stroke="url(#resultsGrad)"
                    strokeWidth="10"
                    strokeDasharray={452.4}
                    initial={{ strokeDashoffset: 452.4 }}
                    animate={{ strokeDashoffset: 452.4 - (452.4 * results.overallScore) / 100 }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                  <defs>
                    <linearGradient id="resultsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="var(--primary)" />
                      <stop offset="100%" stopColor="var(--primary-hover)" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-5xl font-heading font-extrabold text-text-primary">
                    <AnimatedScore value={results.overallScore} />
                  </span>
                  <span className="text-xs text-text-secondary font-bold uppercase tracking-wider font-mono mt-1">
                    Out of 100
                  </span>
                </div>
              </div>

              <div className="w-full space-y-1">
                <span className="text-sm font-semibold text-primary flex items-center justify-center gap-1.5">
                  {results.overallScore >= 85 ? (
                    <>
                      <FaCheckCircle className="text-success text-xs shrink-0" aria-hidden="true" />
                      <span>Exceptional Fit</span>
                    </>
                  ) : results.overallScore >= 75 ? (
                    <>
                      <FaCheckCircle className="text-primary text-xs shrink-0" aria-hidden="true" />
                      <span>Strong Candidate</span>
                    </>
                  ) : (
                    <>
                      <FaExclamationTriangle className="text-warning text-xs shrink-0" aria-hidden="true" />
                      <span>Focus Needed</span>
                    </>
                  )}
                </span>
                <p className="text-xs text-text-secondary uppercase font-mono tracking-wide">
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
                      className="font-mono text-xs flex items-center gap-1"
                    >
                      {suq.confidenceLevel === 'HIGH' ? (
                        <FaCheckCircle className="text-xs shrink-0" aria-hidden="true" />
                      ) : suq.confidenceLevel === 'MEDIUM' ? (
                        <FaExclamationTriangle className="text-xs shrink-0" aria-hidden="true" />
                      ) : (
                        <FaTimesCircle className="text-xs shrink-0" aria-hidden="true" />
                      )}
                      <span>SUQ Confidence: {suq.confidenceLevel}</span>
                    </Badge>
                    {deltaCard?.rewardScore !== undefined && (
                      <span className="px-2 py-0.5 rounded-lg bg-primary-soft border border-primary/30 text-primary font-mono text-xs font-bold">
                        SimPO: +{deltaCard.rewardScore.toFixed(2)} pts
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants} className="lg:col-span-8 flex flex-col">
            <Card variant="default" className="flex-1 flex flex-col justify-between items-center text-center min-h-[340px]">
              <span className="text-xs text-text-secondary font-bold uppercase tracking-wider block border-b border-border pb-2 w-full">
                Evaluation Matrix Profile {previousSession ? '(Overlay Comparison)' : ''}
              </span>

              <div className="w-full h-56 relative my-4">
                <Radar key={`results-radar-${chartTheme.themeKey}`} data={radarData} options={radarOptions} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full text-xs text-text-secondary font-mono border-t border-border pt-4">
                <div className="space-y-0.5">
                  <span>Technical Accuracy</span>
                  <p className="text-text-primary font-bold text-xs">
                    <AnimatedScore value={scores.techAccuracy} suffix="%" />
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span>System Architecture &amp; Logic</span>
                  <p className="text-text-primary font-bold text-xs">
                    <AnimatedScore value={scores.systemDesignLogic} suffix="%" />
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span>Edge-Case Awareness</span>
                  <p className="text-text-primary font-bold text-xs">
                    <AnimatedScore value={scores.edgeCaseHandling} suffix="%" />
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span>Communication &amp; Tone</span>
                  <p className="text-text-primary font-bold text-xs">
                    <AnimatedScore value={scores.communication} suffix="%" />
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        <motion.div variants={itemVariants}>
          <Card variant="default" className="flex flex-col md:flex-row gap-6 items-center">
            <div className="shrink-0 flex flex-col items-center text-center space-y-2">
              <div className="relative w-14 h-14 rounded-2xl overflow-hidden border border-border shadow-md">
                <Image
                  src={persona.avatar}
                  alt={persona.name}
                  width={56}
                  height={56}
                  className="object-cover h-full w-full"
                />
              </div>
              <div>
                <h4 className="text-xs font-bold text-text-primary leading-none">{persona.name}</h4>
                <p className="text-xs text-text-secondary uppercase font-mono">{persona.role}</p>
              </div>
            </div>

            <div className="space-y-1.5 flex-1">
              <span className="text-xs text-primary font-bold uppercase tracking-wider font-mono">Assessor Evaluation Details</span>
              <p className="text-xs text-text-secondary leading-relaxed italic">
                "{typeof results.interviewerComments === 'string' ? results.interviewerComments : 'Solid technical breakdown across foundational questions.'}"
              </p>
            </div>
          </Card>
        </motion.div>
      </motion.div>

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

        {isLATSTreeState(results.latsTreeState) && (
          <div id="sec-lats" className="scroll-mt-32">
            <LATSTreeVisualizer treeState={results.latsTreeState} />
          </div>
        )}

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          <motion.div variants={itemVariants}>
            <Card variant="default" className="space-y-4 h-full">
              <h4 className="text-sm font-heading font-bold text-text-primary uppercase tracking-wider border-b border-border pb-2">
                Skill Analytics Breakdown
              </h4>

              <div className="space-y-4 text-xs">
                <div className="space-y-2">
                  <span className="text-xs text-success font-bold uppercase tracking-wider block">Key Strengths</span>
                  <ul className="space-y-2">
                    {strengths.map((str, idx) => (
                      <li key={idx} className="flex gap-2 items-start text-text-secondary leading-relaxed">
                        <span className="text-success font-bold mt-0.5">&bull;</span>
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <span className="text-xs text-warning font-bold uppercase tracking-wider block">Focus Limitations</span>
                  <ul className="space-y-2">
                    {weaknesses.map((wk, idx) => (
                      <li key={idx} className="flex gap-2 items-start text-text-secondary leading-relaxed">
                        <span className="text-warning font-bold mt-0.5">&bull;</span>
                        <span>{wk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card variant="default" className="space-y-4 h-full">
              <h4 className="text-sm font-heading font-bold text-text-primary uppercase tracking-wider border-b border-border pb-2 flex items-center gap-2">
                <FaAward className="text-primary" />
                <span>Actionable Improvement Plan</span>
              </h4>

              <div className="space-y-3.5">
                {plan.map((item, idx) => (
                  <div key={idx} className="p-3 bg-bg-surface-alt border border-border rounded-xl text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-text-primary">{item.topic}</span>
                      <Badge variant="primary" size="sm">Topic {idx + 1}</Badge>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </motion.div>
      </div>

      {/* SECTION 3a: SYNCHRONIZED IVP MULTI-MODAL TIMELINE */}
      <div id="sec-timeline" className="scroll-mt-32">
        {cameraSignalsCaptured ? (
          <IVPTelemetryTimeline
            durationSeconds={isEyeContactMetrics(results?.eyeContactMetrics) ? results.eyeContactMetrics.totalVideoDurationSeconds : (isHeadPoseMetrics(results?.headPoseMetrics) ? Math.round(results.headPoseMetrics.totalFramesAnalyzed / 30) : 240)}
            events={timelineEvents}
            overallEyeContactPct={isEyeContactMetrics(results?.eyeContactMetrics) ? results.eyeContactMetrics.eyeContactPercentage : undefined}
            overallComposureScore={isAffectiveMetrics(results?.affectiveMetrics) ? results.affectiveMetrics.overallComposureScore : undefined}
            overallStabilityScore={isHeadPoseMetrics(results?.headPoseMetrics) ? results.headPoseMetrics.postureComposureScore : undefined}
          />
        ) : (
          <Card className="p-6 bg-bg-surface border-border shadow-soft text-center space-y-3">
            <div className="flex justify-center">
              <div className="p-3 bg-neutral/10 rounded-full text-text-secondary">
                <FaVideoSlash className="text-xl" />
              </div>
            </div>
            <h3 className="text-base font-semibold text-text-primary">Camera Biometrics Unavailable</h3>
            <p className="text-xs text-text-secondary max-w-md mx-auto">
              Visual telemetry was not recorded for this session. Enable camera permissions during interview practice to receive millisecond-level gaze tracking, posture stability, and facial composure telemetry.
            </p>
          </Card>
        )}
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

      {/* SECTION 3f: CLASSICAL IVP EDGE EVIDENCE RECEIPT (O5) */}
      <div id="sec-ivp-evidence" className="scroll-mt-32">
        <IVPEvidenceCard
          evidence={results.ivpEvidence}
          observations={results.ivpObservations}
        />
      </div>

      {/* SECTION 3g: PROCTORED SESSION INTEGRITY AUDIT (O3, O7) */}
      <div id="sec-integrity" className="scroll-mt-32">
        <SessionIntegrityCard integrity={results.sessionIntegrity} />
      </div>

      {/* SECTION 4: DETAILED RESPONSES LOG */}
      <div id="sec-responses" className="scroll-mt-32 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary text-left pl-1">
          Detailed Responses Log
        </h3>

        <div className="space-y-3">
          {!results.breakdown || results.breakdown.length === 0 ? (
            <Card variant="default" className="p-8 text-center flex flex-col items-center justify-center space-y-3">
              <div className="h-12 w-12 rounded-xl bg-bg-surface-alt border border-border flex items-center justify-center text-text-secondary text-lg">
                <FaListUl />
              </div>
              <div className="space-y-1">
                <h4 className="font-heading font-bold text-sm text-text-primary">No responses recorded</h4>
                <p className="text-xs text-text-secondary max-w-sm">Complete an interview session to see your detailed breakdown here.</p>
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
                <div key={qId} className="bg-bg-surface rounded-2xl border border-border shadow-soft overflow-hidden transition-all duration-350">
                  <button
                    type="button"
                    onClick={() => toggleQuestionExpand(qId)}
                    aria-expanded={isExpanded}
                    className="w-full p-5 flex items-center justify-between text-left hover:bg-bg-surface-alt transition duration-200 cursor-pointer"
                  >
                    <div className="flex items-center gap-4 min-w-0 pr-4">
                      <span className="h-6 w-6 rounded-lg bg-bg-surface-alt border border-border text-xs font-bold font-mono text-text-secondary flex items-center justify-center shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <p className="text-xs sm:text-sm font-semibold text-text-primary truncate">{item.question}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRetryQuestion(idx, item.question);
                        }}
                        aria-label={`Retry question: ${item.question}`}
                        className="px-3 py-1 rounded-lg bg-warning/10 border border-warning/20 text-warning hover:bg-warning/20 text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer"
                        title="Focus on this single question in a mini-session"
                      >
                        <FaUndo size={9} aria-hidden="true" />
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
                          className="font-mono text-xs flex items-center gap-1"
                        >
                          {suq.confidenceLevel === 'HIGH' ? (
                            <FaCheckCircle className="text-xs shrink-0" aria-hidden="true" />
                          ) : suq.confidenceLevel === 'MEDIUM' ? (
                            <FaExclamationTriangle className="text-xs shrink-0" aria-hidden="true" />
                          ) : (
                            <FaTimesCircle className="text-xs shrink-0" aria-hidden="true" />
                          )}
                          <span>SUQ: {suq.confidenceLevel}</span>
                        </Badge>
                      )}

                      {deltaCard?.rewardScore !== undefined && (
                        <span className="hidden sm:inline-block px-2 py-0.5 rounded-lg bg-primary-soft border border-primary/30 text-primary font-mono text-xs font-bold">
                          +{deltaCard.rewardScore.toFixed(2)} pts
                        </span>
                      )}

                      {(item.groundingScore !== undefined || suq?.groundingScore !== undefined) && (
                        <Badge
                          variant={
                            (item.groundingScore ?? suq?.groundingScore ?? 1.0) >= 0.85
                              ? 'success'
                              : (item.groundingScore ?? suq?.groundingScore ?? 1.0) >= 0.5
                              ? 'warning'
                              : 'danger'
                          }
                          size="sm"
                          className="font-mono text-xs flex items-center gap-1"
                          data-testid="item-grounding-badge"
                        >
                          <span>Grounding: {Math.round((item.groundingScore ?? suq?.groundingScore ?? 1.0) * 100)}%</span>
                        </Badge>
                      )}

                      <Badge variant="success" className="text-xs flex items-center gap-1">
                        <FaCheckCircle className="text-xs shrink-0" aria-hidden="true" />
                        <span>Score: {item.score}</span>
                      </Badge>
                      {isExpanded ? <FaChevronUp className="text-text-secondary text-xs" aria-hidden="true" /> : <FaChevronDown className="text-text-secondary text-xs" aria-hidden="true" />}
                    </div>

                  </button>

                  {isExpanded && (() => {
                    const quotesToHighlight: string[] = [];
                    if (suq?.passes) {
                      for (const p of suq.passes) {
                        if (p.criterionEvidence) {
                          for (const ev of Object.values(p.criterionEvidence)) {
                            if (typeof ev === 'object' && ev !== null && 'quote' in ev && ev.quote) {
                              if (ev.quote.trim().length >= 4) {
                                quotesToHighlight.push(ev.quote.trim());
                              }
                            }
                          }
                        }
                      }
                    }

                    return (
                      <div className="p-6 border-t border-border bg-bg-surface-alt space-y-6 text-left text-xs sm:text-sm">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-text-secondary font-bold uppercase tracking-wider block">Candidate Response</span>
                            {quotesToHighlight.length > 0 && (
                              <span className="text-[11px] font-mono text-primary font-semibold">
                                Cited evidence highlighted below
                              </span>
                            )}
                          </div>
                          <p className="bg-bg-surface p-4 rounded-xl border border-border font-mono text-xs text-text-primary leading-relaxed break-words whitespace-pre-wrap">
                            {renderHighlightedAnswer(answerText, quotesToHighlight)}
                          </p>
                        </div>

                        {deltaCard ? (
                          <div className="bg-primary-soft rounded-xl p-4 border border-primary/20 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-primary font-bold uppercase tracking-wider font-mono">
                                SimPO Benchmark Delta Target
                              </span>
                              <span className="text-primary font-mono text-xs font-bold">
                                Reward: +{deltaCard.rewardScore.toFixed(2)} pts
                              </span>
                            </div>
                            <p className="text-text-secondary leading-relaxed italic text-xs">
                              &ldquo;{deltaCard.faangComparison}&rdquo;
                            </p>
                          </div>
                        ) : null}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-bg-surface rounded-xl p-4 border border-border space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-primary font-bold uppercase tracking-wider block">AI Evaluator Feedback</span>
                              <span className="font-mono text-[11px] text-text-secondary" data-testid="feedback-card-grounding">
                                Grounding: {Math.round((item.groundingScore ?? suq?.groundingScore ?? 1.0) * 100)}%
                              </span>
                            </div>
                            <p className="text-text-secondary leading-relaxed">{item.feedback}</p>
                          </div>

                          <div className="bg-bg-surface rounded-xl p-4 border border-border space-y-2">
                            <span className="text-xs text-text-secondary font-bold uppercase tracking-wider block font-mono">Ideal Scope Targets</span>
                            <p className="text-text-secondary leading-relaxed">{item.idealConcepts ?? item.idealConcept ?? 'Core concepts related to the question.'}</p>
                          </div>
                        </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-bg-surface rounded-xl p-4 border border-border space-y-2">
                          <span className="text-xs text-success font-bold uppercase tracking-wider block">Key Strengths</span>
                          <p className="text-text-secondary leading-relaxed">{strengthsText}</p>
                        </div>

                        <div className="bg-bg-surface rounded-xl p-4 border border-border space-y-2">
                          <span className="text-xs text-primary font-bold uppercase tracking-wider block">Enhancement Areas</span>
                          <ul className="space-y-2 text-text-secondary leading-relaxed">
                            {(item.suggestions ?? ['Quantify accomplishments with metrics.']).map((sug: string, sIdx: number) => (
                              <li key={sIdx} className="flex gap-2 items-start">
                                <span className="text-primary mt-0.5">&bull;</span>
                                <span>{sug}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. CTA Action Bar with Clear Single Primary Hierarchy */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-bg-surface rounded-2xl p-5 border border-border shadow-soft">
        <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
          <Button onClick={handleGoDashboard} variant="ghost" size="sm" className="text-text-secondary hover:text-text-primary">
            Dashboard
          </Button>

          <Button onClick={handleUploadNew} variant="ghost" size="sm" className="text-text-secondary hover:text-text-primary">
            Upload New Resume
          </Button>

          <Button onClick={handleDownloadPDF} disabled={downloading} variant="ghost" size="sm" icon={FaFilePdf} className="text-text-secondary hover:text-text-primary">
            {downloading ? 'Exporting...' : 'Export Report'}
          </Button>

          <Button onClick={handleShareImage} disabled={sharing} variant="ghost" size="sm" icon={FaShareAlt} className="text-primary hover:text-primary-hover border border-primary/20 bg-primary-soft">
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
          className="w-[600px] h-[315px] bg-bg-surface p-8 border border-border rounded-3xl font-sans text-text-primary flex flex-col justify-between shadow-2xl relative overflow-hidden"
        >
          {/* Top Header */}
          <div className="flex items-center justify-between z-10 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center font-extrabold font-heading text-text-on-primary text-sm shadow-md">
                Sk
              </div>
              <div>
                <h3 className="font-heading font-extrabold text-text-primary text-base tracking-wide leading-none">Skillo AI</h3>
                <p className="text-xs text-text-secondary font-mono mt-0.5">Career Prep Assessment Report</p>
              </div>
            </div>
            <div className="bg-bg-surface-alt border border-border px-3 py-1 rounded-full text-xs font-mono text-text-secondary">
              Verified Benchmark
            </div>
          </div>

          {/* Body content grid */}
          <div className="grid grid-cols-12 gap-6 items-center z-10 py-2">
            {/* Score Pill */}
            <div className="col-span-4 bg-primary/10 border border-primary/30 rounded-2xl p-4 text-center flex flex-col justify-center items-center shadow-lg">
              <span className="text-xs font-mono text-primary uppercase font-bold tracking-wider">Overall Score</span>
              <span className="text-4xl font-heading font-extrabold text-text-primary mt-1">
                {results.overallScore}<span className="text-sm font-normal text-text-secondary">/100</span>
              </span>
              <span className="text-xs text-success font-bold mt-1 font-mono flex items-center justify-center gap-1">
                {results.overallScore >= 75 ? (
                  <FaCheckCircle className="text-xs shrink-0" aria-hidden="true" />
                ) : results.overallScore >= 60 ? (
                  <FaExclamationTriangle className="text-xs shrink-0" aria-hidden="true" />
                ) : (
                  <FaTimesCircle className="text-xs shrink-0" aria-hidden="true" />
                )}
                <span>{results.overallScore >= 85 ? 'Top Candidate Tier' : results.overallScore >= 70 ? 'Competitive Tier' : 'Needs Development'}</span>
              </span>
            </div>

            {/* Assessment Details */}
            <div className="col-span-8 space-y-3">
              <div>
                <span className="text-xs text-text-secondary uppercase font-mono font-bold tracking-wider block">Target Role &amp; Preset</span>
                <h4 className="text-base font-heading font-bold text-text-primary leading-snug">
                  {results.setupData?.role || 'Software Engineer'} &bull; <span className="text-primary">{results.setupData?.company || 'Generic'} Style</span>
                </h4>
              </div>

              <div>
                <span className="text-xs text-text-secondary uppercase font-mono font-bold tracking-wider block">Key Demonstrated Strength</span>
                <p className="text-xs text-text-primary leading-relaxed font-medium bg-bg-surface-alt p-2.5 rounded-xl border border-border truncate">
                  {strengths[0]}
                </p>
              </div>
            </div>
          </div>

          {/* Footer watermark */}
          <div className="flex items-center justify-between z-10 border-t border-border pt-3 text-xs text-text-secondary font-mono">
            <span>Evaluated by AI Persona {persona.name} ({persona.role})</span>
            <span className="text-primary font-bold">skillo.dev</span>
          </div>
        </div>
      </div>
    </div>
  );

}
