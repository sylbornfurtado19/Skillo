import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { motion } from 'framer-motion';
import { 
  FaUndo, 
  FaUpload, 
  FaChevronDown, 
  FaChevronUp, 
  FaFilePdf, 
  FaCheckCircle, 
  FaExclamationTriangle, 
  FaTimes, 
  FaArrowRight,
  FaAward,
  FaListUl,
  FaCheck
} from 'react-icons/fa';
import { useInterview } from '../context/InterviewContext';
import { INTERVIEWER_PERSONAS } from '../services/interviewApi';
import { useToast } from '../components/ui/Toast';

// ChartJS imports
import { Radar } from 'react-chartjs-2';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/FeedbackHelpers';

export default function Results() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { resumeData, results, setResults, setQuestions, setCurrentQuestionIndex, setAnswers, resetSession } = useInterview();

  const reportRef = useRef(null);

  // Redirect if no results
  useEffect(() => {
    if (!results) {
      navigate('/app/resume');
    }
  }, [results, navigate]);

  const [expandedQuestion, setExpandedQuestion] = useState(null);
  const [downloading, setDownloading] = useState(false);

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
        <Button
          onClick={() => navigate('/app/resume')}
          variant="primary"
          size="md"
        >
          Go to Upload Page
        </Button>
      </div>
    );
  }

  if (!results) return null;

  const persona = INTERVIEWER_PERSONAS[results.personaId] || INTERVIEWER_PERSONAS.sarah;

  // Map values for the 4 required dimensions
  const scores = {
    techKnowledge: results.categories.technicalAccuracy || 80,
    communication: results.categories.communication || 85,
    confidence: results.categories.depth || 75,
    problemSolving: results.categories.timeManagement || 90,
  };

  // Chart configuration: Radar
  const radarData = {
    labels: ['Technical Knowledge', 'Communication', 'Confidence', 'Problem Solving'],
    datasets: [
      {
        label: 'Your Score Profile',
        data: [
          scores.techKnowledge,
          scores.communication,
          scores.confidence,
          scores.problemSolving
        ],
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        borderColor: '#6366F1',
        borderWidth: 2,
        pointBackgroundColor: '#06B6D4',
        pointBorderColor: '#fff',
        pointHoverRadius: 6,
      }
    ],
  };

  const radarOptions = {
    scales: {
      r: {
        angleLines: { color: 'rgba(255, 255, 255, 0.05)' },
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        pointLabels: {
          color: '#94A3B8',
          font: { family: 'Sora', size: 10, weight: 'bold' }
        },
        ticks: {
          display: false,
          stepSize: 20
        },
        suggestedMin: 50,
        suggestedMax: 100,
      }
    },
    plugins: {
      legend: { display: false }
    },
    maintainAspectRatio: false
  };

  const handleDownloadPDF = () => {
    if (!reportRef.current) return;
    setDownloading(true);

    const element = reportRef.current;

    html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#030712',
      logging: false,
    })
      .then((canvas) => {
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

        pdf.save('InterviewIQ_Report.pdf');
        setDownloading(false);
      })
      .catch((err) => {
        console.error('PDF export failed:', err);
        setDownloading(false);
        showToast('Failed to generate PDF. Please try again.', 'error');
      });
  };

  const toggleQuestionExpand = (id) => {
    setExpandedQuestion(expandedQuestion === id ? null : id);
  };

  const handlePracticeAgain = () => {
    setResults(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setAnswers([]);
    navigate('/app/setup');
  };

  const handleUploadNew = () => {
    resetSession();
    navigate('/app/resume');
  };

  const handleGoDashboard = () => {
    navigate('/app/dashboard');
  };

  // Structured strengths & weaknesses (read dynamically from results with fallbacks)
  const strengths = results.strengths || [
    'Excellent usage of domain-specific terminology during technical reviews.',
    'Clear architectural scaffolding: structured responses starting from top-level blocks down to low-level instances.',
    'Confident voice modulation and conversational pacing.'
  ];

  const weaknesses = results.weaknesses || [
    'Tended to state general abstracts on system scalability rather than analyzing concrete trade-offs.',
    'Under-explained error boundaries and validation checks in core code paths.'
  ];

  // Improvement plan
  const plan = results.plan || [
    { topic: 'React 19 Hooks', desc: 'Review useActionState and transition APIs to manage form actions natively.' },
    { topic: 'Cache Invalidation Protocols', desc: 'Study write-through vs cache-aside architectures to handle distributed data consistency.' },
    { topic: 'Quantitative STAR Metrics', desc: 'Focus on integrating numerical output measurements into behavioral scenario explanations.' }
  ];

  return (
    <div ref={reportRef} className="max-w-6xl mx-auto space-y-8 pb-16 text-left p-4">
      <SectionHeader
        title="Performance Report"
        description="A review of your logical accuracy, communication metrics, and technical dimension matrices."
        className="text-center max-w-2xl mx-auto"
      />

      {/* Circle Gauge & Radar Chart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Core Circular Score (Spans 4 columns) */}
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
              Target seniority: {results.setupData.experienceLevel || 'Mid-Level'}
            </p>
          </div>
        </Card>

        {/* Radar Matrix Dimensions (Spans 8 columns) */}
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

      {/* AI Recruiter Feedback */}
      <Card variant="glass" className="flex flex-col md:flex-row gap-6 items-center">
        <div className="shrink-0 flex flex-col items-center text-center space-y-2">
          <img
            src={persona.avatar}
            alt={persona.name}
            className="w-14 h-14 rounded-2xl object-cover border border-white/10 shadow-md"
          />
          <div>
            <h4 className="text-xs font-bold text-white leading-none">{persona.name}</h4>
            <p className="text-[9px] text-gray-500 uppercase font-mono">{persona.role}</p>
          </div>
        </div>

        <div className="space-y-1.5 flex-1">
          <span className="text-xs text-primary font-bold uppercase tracking-wider font-mono">Assessor Evaluation Details</span>
          <p className="text-xs text-gray-300 leading-relaxed italic">
            "{results.interviewerComments}"
          </p>
        </div>
      </Card>

      {/* Strengths, Weaknesses, and Roadmaps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Strengths & Weaknesses */}
        <Card variant="glass" className="space-y-4">
          <h4 className="text-sm font-heading font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2">
            Skill Analytics Breakdown
          </h4>

          <div className="space-y-4 text-xs">
            {/* Strengths */}
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

            {/* Weaknesses */}
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

        {/* Improvement plan */}
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

      {/* Detailed Response Accordion Breakdown */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-white text-left pl-1">
          Detailed Responses Log
        </h3>

        <div className="space-y-3">
          {(!results.breakdown || results.breakdown.length === 0) ? (
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
            results.breakdown.map((item, idx) => {
              const isExpanded = expandedQuestion === item.id;
              return (
                <div
                  key={item.id}
                  className="glass-card rounded-2xl border border-white/5 overflow-hidden transition-all duration-350"
                >
                  {/* Accordion Header */}
                  <button
                    type="button"
                    onClick={() => toggleQuestionExpand(item.id)}
                    className="w-full p-5 flex items-center justify-between text-left hover:bg-white/[0.01] transition duration-200 cursor-pointer"
                  >
                    <div className="flex items-center gap-4 min-w-0 pr-4">
                      <span className="h-6 w-6 rounded-lg bg-white/5 border border-white/10 text-xs font-bold font-mono text-gray-400 flex items-center justify-center shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <p className="text-xs sm:text-sm font-semibold text-white truncate">
                        {item.question}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant="success">Score: {item.score}</Badge>
                      {isExpanded ? <FaChevronUp className="text-gray-500 text-xs" /> : <FaChevronDown className="text-gray-500 text-xs" />}
                    </div>
                  </button>

                  {/* Accordion Body */}
                  {isExpanded && (
                    <div className="p-6 border-t border-white/5 bg-[#030712]/30 space-y-6 text-left text-xs sm:text-sm">
                      <div className="space-y-2">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Candidate Response</span>
                        <p className="bg-[#030712]/50 p-4 rounded-xl border border-white/5 font-mono text-xs text-gray-200 leading-relaxed break-words whitespace-pre-wrap">
                          {item.userAnswer}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-primary/5 rounded-xl p-4 border border-primary/15 space-y-2">
                          <span className="text-[10px] text-primary font-bold uppercase tracking-wider block">AI Evaluator Feedback</span>
                          <p className="text-gray-300 leading-relaxed">
                            {item.feedback}
                          </p>
                        </div>

                        <div className="bg-[#030712]/40 rounded-xl p-4 border border-white/5 space-y-2">
                          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block font-mono">Ideal Scope Targets</span>
                          <p className="text-gray-400 leading-relaxed">
                            {item.idealConcepts}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-emerald-500/5 rounded-xl p-4 border border-emerald-500/15 space-y-2">
                          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Key Strengths</span>
                          <p className="text-gray-300 leading-relaxed">
                            {item.strengths}
                          </p>
                        </div>

                        <div className="bg-[#030712]/40 rounded-xl p-4 border border-white/5 space-y-2">
                          <span className="text-[10px] text-accent font-bold uppercase tracking-wider block">Enhancement Areas</span>
                          <ul className="space-y-2 text-gray-400 leading-relaxed">
                            {item.suggestions.map((sug, sIdx) => (
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

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-[#111827]/40 rounded-2xl p-5 border border-white/5">
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <Button
            onClick={handlePracticeAgain}
            variant="glass"
            size="sm"
            icon={FaUndo}
          >
            Practice Again
          </Button>

          <Button
            onClick={handleGoDashboard}
            variant="glass"
            size="sm"
          >
            Dashboard
          </Button>
        </div>

        <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3 items-center">
          <Button
            onClick={handleDownloadPDF}
            disabled={downloading}
            variant="glass"
            size="sm"
            icon={FaFilePdf}
          >
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
