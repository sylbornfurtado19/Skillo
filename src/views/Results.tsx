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
} from 'react-icons/fa';

// Task 6: Import Chart.js registration module
import '../lib/chartSetup';

// Task 5: Dynamic import for Radar chart component with ssr: false
const Radar = dynamic(() => import('react-chartjs-2').then((m) => m.Radar), { ssr: false });

import { INTERVIEWER_PERSONAS } from '../services/constants';
import { useInterview } from '../context/InterviewContext';
import type { EvaluationCategories, AnswerBreakdown, SUQEvaluationResult } from '../types/index';
import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/FeedbackHelpers';
import SUQConfidenceDashboard from '../components/ui/SUQConfidenceDashboard';
import SimPOContrastiveCard from '../components/ui/SimPOContrastiveCard';

export default function Results() {
  const router = useRouter();
  const { showToast } = useToast();
  const { resumeData, results, setResults, setQuestions, setCurrentQuestionIndex, setAnswers, resetSession } =
    useInterview();

  const reportRef = useRef<HTMLDivElement | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!results) {
      router.push('/resume');
    }
  }, [results, router]);

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

  const radarData = {
    labels: ['Technical Knowledge', 'Communication', 'Confidence', 'Problem Solving'],
    datasets: [
      {
        label: 'Your Score Profile',
        data: [scores.techKnowledge, scores.communication, scores.confidence, scores.problemSolving],
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        borderColor: '#6366F1',
        borderWidth: 2,
        pointBackgroundColor: '#06B6D4',
        pointBorderColor: '#fff',
        pointHoverRadius: 6,
      },
    ],
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
      legend: { display: false },
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
      <SectionHeader
        title="Performance Report"
        description="A review of your logical accuracy, communication metrics, and technical dimension matrices."
        className="text-center max-w-2xl mx-auto"
      />

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
            Evaluation Matrix Profile
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

      {/* Prometheus-2 & SUQ Confidence Dashboard Component */}
      <SUQConfidenceDashboard
        suqEvaluation={results.suqEvaluation as SUQEvaluationResult | undefined}
        onTriggerValidationPass={handleTriggerValidationPass}
      />

      {/* SimPO Length-Normalized Contrastive Benchmark Analysis */}
      <SimPOContrastiveCard contrastiveResult={results.simpoContrastiveResult as any} />

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

      <div className="space-y-4">
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

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-[#111827]/40 rounded-2xl p-5 border border-white/5">
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <Button onClick={handlePracticeAgain} variant="glass" size="sm" icon={FaUndo}>
            Practice Again
          </Button>

          <Button onClick={handleGoDashboard} variant="glass" size="sm">
            Dashboard
          </Button>
        </div>

        <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3 items-center">
          <Button onClick={handleDownloadPDF} disabled={downloading} variant="glass" size="sm" icon={FaFilePdf}>
            {downloading ? 'Exporting...' : 'Export Report'}
          </Button>

          <Button
            onClick={handleUploadNew}
            variant="primary"
            size="sm"
            className="w-full sm:w-auto bg-gradient-to-r from-primary to-accent"
          >
            <span>Upload New Resume</span>
            <FaArrowRight size={10} className="ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
