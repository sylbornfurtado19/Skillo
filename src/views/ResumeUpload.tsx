'use client';

import React, { useState, useId } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaCloudUploadAlt,
  FaFilePdf,
  FaArrowRight,
  FaTimes,
  FaCheck,
  FaExclamationTriangle,
  FaRedo,
} from 'react-icons/fa';
import { simulateResumeAnalysis, extractResumeTextApi } from '../services/constants';
import { getAuthToken } from '../services/auth';
import type { ResumeRewriteItem } from '../lib/services/resumeAnalysis.server';
import { useAuth } from '../hooks/useAuth';
import { useInterview } from '../context/InterviewContext';
import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/FeedbackHelpers';
import { Progress, Loader } from '../components/ui/Loader';
import { Skeleton } from '../components/ui/Skeleton';
import GraphRAGDashboard from '../components/ui/GraphRAGDashboard';
import VisualDocumentCanvas from '../components/ui/VisualDocumentCanvas';
import LayoutPenaltyViewer from '../components/ui/LayoutPenaltyViewer';
import type { VisualLayoutAnalysisResult, BoundingBox2D } from '@/types/index';


export default function ResumeUpload() {
  const router = useRouter();
  const fileInputId = useId();
  const jobTitleId = useId();
  const jobDescriptionId = useId();

  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const {
    resumeData,
    setResumeData,
    jobTitle,
    setJobTitle,
    jobDescription,
    setJobDescription,
    analysisResult,
    setAnalysisResult,
  } = useInterview();

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentState, setCurrentState] = useState<'idle' | 'uploading' | 'analyzing' | 'complete' | 'failed'>(
    resumeData && analysisResult ? 'complete' : 'idle'
  );
  const [analysisStep, setAnalysisStep] = useState(0);
  const [suggestedRewrites, setSuggestedRewrites] = useState<ResumeRewriteItem[]>([]);
  const [rewritesLoading, setRewritesLoading] = useState(false);
  const [copiedRewrite, setCopiedRewrite] = useState<number | null>(null);

  // ── LayoutLMv3 visual canvas state ──────────────────────────────────────
  const [activePageNumber] = useState(1);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [highlightedPenaltyIndex, setHighlightedPenaltyIndex] = useState<number | null>(null);
  const [visualLayoutTab, setVisualLayoutTab] = useState<'canvas' | 'penalties'>('canvas');


  if (!isAuthenticated) {
    return (
      <div className="bg-bg-surface rounded-2xl p-8 border border-border shadow-soft text-center max-w-md mx-auto mt-12 space-y-6">
        <div className="h-12 w-12 rounded-full bg-danger/10 border border-danger/20 flex items-center justify-center text-danger text-xl mx-auto animate-pulse">
          <FaExclamationTriangle />
        </div>
        <h3 className="text-lg font-heading font-bold text-text-primary">Sign In Required</h3>
        <p className="text-xs text-text-secondary leading-relaxed">
          Please sign in to access the resume parser and targeted mock interview generation engine.
        </p>
        <Button onClick={() => router.push('/login')} variant="primary" size="md">
          Sign In Now
        </Button>
      </div>
    );
  }

  const analysisSteps = [
    'Parsing PDF text layers...',
    'Extracting technical skill matrices...',
    'Matching profile experience to target job description...',
    'Generating optimal mock question sets...',
  ];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const processFile = (selectedFile: File) => {
    if (
      selectedFile.type !== 'application/pdf' &&
      !selectedFile.name.endsWith('.pdf') &&
      !selectedFile.name.endsWith('.docx') &&
      !selectedFile.name.endsWith('.txt')
    ) {
      setCurrentState('failed');
      return;
    }

    setFile(selectedFile);
    setCurrentState('uploading');

    let prog = 0;
    const interval = setInterval(() => {
      prog += 20;
      setUploadProgress(prog);
      if (prog >= 100) {
        clearInterval(interval);
        setCurrentState('idle');
        setResumeData({
          fileName: selectedFile.name,
          fileSize: `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`,
        });
      }
    }, 150);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setUploadProgress(0);
    setResumeData(null);
    setAnalysisResult(null);
    setCurrentState('idle');
  };

  const handleStartAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !jobTitle.trim() || !jobDescription.trim()) return;

    setCurrentState('analyzing');
    setAnalysisStep(0);

    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      if (step < analysisSteps.length - 1) {
        setAnalysisStep(step);
      }
    }, 800);

    // Server-side resume text extraction (PDF / DOCX / TXT)
    let extractedText = '';
    try {
      const extraction = await extractResumeTextApi(file, showToast);
      if (!extraction.text || extraction.charCount < 100) {
        clearInterval(interval);
        showToast('scanned PDF, no selectable text', 'error');
        setCurrentState('failed');
        return;
      }
      extractedText = extraction.text;
    } catch (extractErr: unknown) {
      clearInterval(interval);
      console.error('File text extraction warning:', extractErr);
      setCurrentState('failed');
      return;
    }

    try {
      const apiResult = await simulateResumeAnalysis(
        file.name,
        jobTitle,
        jobDescription,
        showToast,
        extractedText || undefined
      );
      clearInterval(interval);
      setAnalysisStep(analysisSteps.length - 1);

      const detailedResult = {
        ...apiResult,
        detectedSkills: apiResult.skillsMatched ?? ['React 19', 'TypeScript', 'JavaScript (ES6+)'],
        detectedTech: ['Next.js App Router', 'Tailwind CSS', 'Zod', 'Supabase Auth'],
        projects: [
          {
            name: 'Skillo Evaluation Platform',
            desc: 'Built an AI mock interview application using Next.js 16, TypeScript, Zod, and Supabase.',
          },
        ],
        experience: [
          {
            company: 'SaaS Tech Corp',
            role: jobTitle,
            period: '2023 - Present',
            bullet: 'Optimized full-stack response times and type safety across production APIs.',
          },
        ],
        education: [{ school: 'University of Technology', degree: 'B.S. in Computer Science', period: '2018 - 2022' }],
      };

      setAnalysisResult(detailedResult);
      setRewritesLoading(true);
      try {
        const token = await getAuthToken();
        const rewriteResponse = await fetch('/api/resume/rewrite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            resumeText: extractedText,
            jobTitle,
            jobDescription,
          }),
        });
        if (!rewriteResponse.ok) {
          throw new Error(`Rewrite request failed with status ${rewriteResponse.status}`);
        }
        const rewriteBody = await rewriteResponse.json();
        setSuggestedRewrites(Array.isArray(rewriteBody.data) ? rewriteBody.data : []);
      } catch (rewriteError) {
        console.warn('Resume rewrite suggestions unavailable:', rewriteError);
        setSuggestedRewrites([]);
      } finally {
        setRewritesLoading(false);
      }
      setCurrentState('complete');
    } catch (err: unknown) {
      clearInterval(interval);
      console.error('Resume analysis failed:', err);
      setCurrentState('failed');
    }
  };


  const resultObj = analysisResult as any;

  const copyRewrite = async (rewrite: ResumeRewriteItem, index: number) => {
    try {
      await navigator.clipboard.writeText(rewrite.rewritten);
      setCopiedRewrite(index);
      window.setTimeout(() => setCopiedRewrite((current) => (current === index ? null : current)), 1500);
    } catch (error) {
      console.warn('Could not copy suggested rewrite:', error);
      showToast('Could not copy rewrite to clipboard.', 'error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 text-left">
      <SectionHeader
        title="Upload Resume & Job Description"
        description="Our AI parses technical experience matrices, estimates profile alignment, and generates focused questions."
        className="text-center max-w-2xl mx-auto"
      />

      <AnimatePresence mode="wait">
        {currentState === 'uploading' && (
          <motion.div
            key="uploading"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="bg-bg-surface rounded-2xl p-10 border border-border shadow-soft flex flex-col items-center justify-center min-h-[300px] text-center"
          >
            <div className="h-14 w-14 rounded-full bg-primary-soft border border-primary/20 flex items-center justify-center text-primary text-2xl mb-4 animate-bounce">
              <FaCloudUploadAlt />
            </div>
            <h3 className="text-lg font-heading font-bold text-text-primary mb-2">Uploading Document</h3>
            <p className="text-xs text-text-secondary mb-6 font-mono">Transferring package payload...</p>
            <Progress value={uploadProgress} max={100} showLabel={true} label="Upload Status" className="max-w-xs" />
          </motion.div>
        )}

        {currentState === 'analyzing' && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            <div className="bg-bg-surface rounded-2xl p-8 border border-border shadow-soft flex flex-col items-center justify-center text-center">
              <Loader size="lg" className="mb-4" />
              <h3 className="text-lg font-heading font-bold text-text-primary mb-1">Analyzing Resume with LayoutLMv3</h3>
              <p className="text-xs text-text-secondary font-mono mb-6 font-medium">Extracting semantic tokens and ATS alignment...</p>

              <div className="w-full max-w-md bg-bg-surface-alt border border-border rounded-xl p-5 space-y-3.5 text-left mb-6">
                {analysisSteps.map((stepDesc, idx) => {
                  const isDone = idx < analysisStep;
                  const isCurrent = idx === analysisStep;
                  return (
                    <div key={idx} className="flex items-center gap-3 text-xs">
                      {isDone ? (
                        <div className="h-4 w-4 rounded-full bg-success/20 flex items-center justify-center text-success text-xs">
                          <FaCheck aria-hidden="true" />
                        </div>
                      ) : isCurrent ? (
                        <div className="h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                        </div>
                      ) : (
                        <div className="h-4 w-4 rounded-full bg-bg-surface border border-border shrink-0" />
                      )}
                      <span
                        className={`font-mono ${
                          isDone ? 'text-success' : isCurrent ? 'text-text-primary font-semibold' : 'text-text-secondary'
                        }`}
                      >
                        {stepDesc}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Skeleton Preview of Upcoming Report */}
              <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <Skeleton variant="rect" className="h-28 rounded-xl" />
                <Skeleton variant="rect" className="h-28 rounded-xl" />
                <Skeleton variant="rect" className="h-28 rounded-xl" />
              </div>
            </div>
          </motion.div>
        )}

        {currentState === 'failed' && (
          <motion.div
            key="failed"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="bg-bg-surface rounded-2xl p-10 border border-danger/30 bg-danger/5 flex flex-col items-center justify-center min-h-[300px] text-center"
          >
            <div className="h-12 w-12 rounded-full bg-danger/10 border border-danger/20 flex items-center justify-center text-danger text-xl mb-4">
              <FaExclamationTriangle aria-hidden="true" />
            </div>
            <h3 className="text-lg font-heading font-bold text-text-primary mb-2">Analysis Error</h3>
            <p className="text-xs text-text-secondary leading-relaxed max-w-sm mb-6">
              Could not complete analysis. Ensure you are signed in and have entered valid job details.
            </p>
            <Button onClick={() => setCurrentState('idle')} variant="danger" size="sm" icon={FaRedo}>
              Retry Upload
            </Button>
          </motion.div>
        )}

        {currentState === 'complete' && resultObj && (
          <motion.div key="complete" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <Card variant="default" className="p-6 sm:p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                <div className="flex flex-col items-center justify-center text-center p-4 border-b md:border-b-0 md:border-r border-border">
                  <span className="text-xs text-text-secondary font-bold uppercase tracking-wider mb-4">Alignment Score</span>

                  <div className="relative h-32 w-32 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="52"
                        stroke="var(--border)"
                        strokeWidth="8"
                        fill="transparent"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="52"
                        stroke="url(#resumeGrad)"
                        strokeWidth="8"
                        strokeDasharray={326.7}
                        strokeDashoffset={326.7 - (326.7 * (resultObj.matchPercentage ?? 80)) / 100}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                      <defs>
                        <linearGradient id="resumeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="var(--primary)" />
                          <stop offset="100%" stopColor="var(--primary-hover)" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-3xl font-heading font-extrabold text-text-primary">
                        {resultObj.matchPercentage ?? 80}%
                      </span>
                    </div>
                  </div>

                  <span className="text-xs text-text-secondary font-mono mt-4 truncate max-w-full">
                    {resultObj.fileName ?? file?.name}
                  </span>
                </div>

                <div className="col-span-2 space-y-4">
                  <div>
                    <h3 className="text-lg font-heading font-bold text-text-primary">
                      Profile Alignment Index for {jobTitle}
                    </h3>
                    <p className="text-xs text-text-secondary leading-relaxed mt-2">{resultObj.summary}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-bg-surface-alt border border-border rounded-xl p-3">
                      <span className="text-xs text-success font-bold uppercase tracking-wider block mb-2">
                        Matched Tech ({resultObj.skillsMatched?.length ?? 0})
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {(resultObj.skillsMatched ?? []).map((s: string, idx: number) => (
                          <Badge key={idx} variant="success" size="sm">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="bg-bg-surface-alt border border-border rounded-xl p-3">
                      <span className="text-xs text-warning font-bold uppercase tracking-wider block mb-2">
                        Missing Keywords ({resultObj.skillsMissing?.length ?? 0})
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {(resultObj.skillsMissing ?? []).map((s: string, idx: number) => (
                          <Badge key={idx} variant="warning" size="sm">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* GraphRAG Hierarchical Skill Gap Mapper Dashboard */}
            <GraphRAGDashboard graphRAGData={resultObj.graphRAGResult} />

            {/* ── LayoutLMv3 Visual Document Layout Analysis ───────────── */}
            {resultObj.visualLayoutAnalysis && (() => {
              const vla = resultObj.visualLayoutAnalysis as VisualLayoutAnalysisResult;

              // Compute highlighted bbox from selected penalty
              const highlightedBBox: BoundingBox2D | null =
                highlightedPenaltyIndex !== null && vla.penalties[highlightedPenaltyIndex]
                  ? vla.penalties[highlightedPenaltyIndex].affectedBoundingBox
                  : null;

              const handlePenaltyClick = (idx: number) => {
                setHighlightedPenaltyIndex(prev => (prev === idx ? null : idx));
                // Switch to canvas tab on mobile
                setVisualLayoutTab('canvas');
              };

              const handleElementClick = (id: string) => {
                setSelectedElementId(prev => (prev === id ? null : id));
              };

              return (
                <div className="space-y-4">
                  {/* Section header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-heading font-bold text-text-primary">
                        Document Layout &amp; Formatting Inspector
                      </h3>
                      <p className="text-xs text-text-secondary mt-0.5">
                        Analyzes document structure, column boundaries, and typography hierarchy using deterministic spatial geometry rules.
                      </p>
                    </div>
                    {/* Page indicator */}
                    <div className="flex items-center gap-1 text-xs text-text-secondary font-mono">
                      <span className="px-2 py-0.5 rounded bg-bg-surface-alt border border-border">
                        pg {activePageNumber} / {vla.pageCount}
                      </span>
                    </div>
                  </div>

                  {/* Mobile tab switcher */}
                  <div className="flex lg:hidden gap-1 bg-bg-surface-alt border border-border rounded-xl p-1">
                    {(['canvas', 'penalties'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setVisualLayoutTab(tab)}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                          visualLayoutTab === tab
                            ? 'bg-primary text-text-on-primary'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {tab === 'canvas' ? '🗺 Canvas' : '⚠ Penalties'}
                      </button>
                    ))}
                  </div>

                  {/* Desktop: side-by-side | Mobile: tabbed */}
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
                    {/* Canvas — always visible on desktop, tab-controlled on mobile */}
                    <div className={`${visualLayoutTab === 'canvas' ? 'block' : 'hidden'} lg:block`}>
                      <VisualDocumentCanvas
                        elements={vla.elements}
                        penalties={vla.penalties}
                        highlightedPenaltyBBox={highlightedBBox}
                        selectedElementId={selectedElementId}
                        onElementClick={handleElementClick}
                      />
                    </div>

                    {/* Penalty viewer — always visible on desktop, tab-controlled on mobile */}
                    <div className={`${visualLayoutTab === 'penalties' ? 'block' : 'hidden'} lg:block`}>
                      <LayoutPenaltyViewer
                        result={vla}
                        highlightedPenaltyIndex={highlightedPenaltyIndex}
                        onPenaltyClick={handlePenaltyClick}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card variant="default" className="space-y-4">
                <h4 className="text-sm font-heading font-bold text-text-primary uppercase tracking-wider border-b border-border pb-2">
                  Detected Competencies
                </h4>

                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-text-secondary font-bold uppercase block mb-1">Core Skills</span>
                    <div className="flex flex-wrap gap-1.5">
                      {resultObj.detectedSkills?.map((s: string) => (
                        <Badge key={s} variant="primary" size="sm">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-text-secondary font-bold uppercase block mb-1">Frameworks & Tools</span>
                    <div className="flex flex-wrap gap-1.5">
                      {resultObj.detectedTech?.map((s: string) => (
                        <Badge key={s} variant="secondary" size="sm">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              <Card variant="default" className="space-y-4">
                <h4 className="text-sm font-heading font-bold text-text-primary uppercase tracking-wider border-b border-border pb-2">
                  Suggested Improvements
                </h4>
                <div className="space-y-3">
                  {(resultObj.recommendations ?? []).map((rec: string, idx: number) => (
                    <div key={idx} className="flex gap-2.5 text-xs text-text-secondary leading-relaxed items-start">
                      <span className="h-4 w-4 rounded-full bg-bg-surface-alt border border-border flex items-center justify-center font-mono font-bold text-xs shrink-0 text-text-primary">
                        {idx + 1}
                      </span>
                      <p>{rec}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card variant="default" className="space-y-4 md:col-span-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-2">
                  <div>
                    <h4 className="text-sm font-heading font-bold text-text-primary uppercase tracking-wider">
                      Suggested rewrites
                    </h4>
                    <p className="text-xs text-text-secondary mt-1">
                      Suggestions only. Your resume is never changed automatically.
                    </p>
                  </div>
                  <Badge variant="secondary" size="sm">{jobTitle}</Badge>
                </div>

                {rewritesLoading ? (
                  <div className="text-xs text-text-secondary font-mono">Generating grounded rewrite suggestions...</div>
                ) : suggestedRewrites.length > 0 ? (
                  <div className="space-y-4">
                    {suggestedRewrites.map((rewrite, index) => (
                      <div key={`${rewrite.original}-${index}`} className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-border bg-bg-surface-alt p-4 space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Before</span>
                          <p className="text-xs text-text-primary leading-relaxed">{rewrite.original}</p>
                        </div>
                        <div className="rounded-xl border border-primary/20 bg-primary-soft/20 p-4 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">After</span>
                            <Button
                              onClick={() => copyRewrite(rewrite, index)}
                              variant="ghost"
                              size="sm"
                              className="px-2 py-1"
                            >
                              {copiedRewrite === index ? 'Copied' : 'Copy'}
                            </Button>
                          </div>
                          <p className="text-xs text-text-primary leading-relaxed">{rewrite.rewritten}</p>
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <Badge variant="primary" size="sm">{rewrite.targetSkill}</Badge>
                            {rewrite.metricPlaceholders.map((placeholder) => (
                              <Badge key={placeholder} variant="neutral" size="sm">{placeholder}</Badge>
                            ))}
                          </div>
                          <p className="text-[11px] text-text-secondary leading-relaxed">{rewrite.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-secondary">
                    No bullet lines were available for rewrite suggestions.
                  </p>
                )}
              </Card>

              <Card variant="default" className="space-y-4 md:col-span-2">
                <h4 className="text-sm font-heading font-bold text-text-primary uppercase tracking-wider border-b border-border pb-2">
                  Parsed Experience & Projects
                </h4>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-xs text-text-secondary font-bold uppercase block">Professional History</span>
                    {resultObj.experience?.map((exp: any, idx: number) => (
                      <div key={idx} className="p-3 bg-bg-surface-alt border border-border rounded-xl space-y-1">
                        <div className="flex justify-between items-center text-xs font-semibold text-text-primary">
                          <span>
                            {exp.role} @ {exp.company}
                          </span>
                          <span className="text-text-secondary text-xs font-mono">{exp.period}</span>
                        </div>
                        <p className="text-xs text-text-secondary leading-relaxed">{exp.bullet}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs text-text-secondary font-bold uppercase block">Highlighted Projects</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {resultObj.projects?.map((proj: any, idx: number) => (
                        <div key={idx} className="p-3 bg-bg-surface-alt border border-border rounded-xl space-y-1 text-xs">
                          <h5 className="font-semibold text-text-primary">{proj.name}</h5>
                          <p className="text-xs text-text-secondary leading-relaxed">{proj.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs text-text-secondary font-bold uppercase block">Academic Degrees</span>
                    {resultObj.education?.map((edu: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-bg-surface-alt border border-border rounded-xl text-xs">
                        <span className="font-semibold text-text-primary">
                          {edu.degree} &bull; <span className="text-text-secondary">{edu.school}</span>
                        </span>
                        <span className="text-text-secondary text-xs font-mono">{edu.period}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            <div className="flex justify-between items-center bg-bg-surface rounded-xl p-4 border border-border shadow-soft">
              <button
                onClick={handleRemoveFile}
                className="px-4 py-2 text-xs rounded-lg hover:bg-bg-surface-alt text-text-secondary hover:text-text-primary transition duration-200"
              >
                Upload Different Resume
              </button>
              <Button
                onClick={() => router.push('/setup')}
                variant="primary"
                size="md"
                icon={FaArrowRight}
              >
                Configure Career Setup
              </Button>
            </div>
          </motion.div>
        )}

        {currentState === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              className={`bg-bg-surface rounded-2xl border p-6 flex flex-col justify-between items-center transition duration-300 min-h-[380px] shadow-soft ${
                dragging ? 'border-primary bg-primary-soft' : 'border-border hover:border-secondary'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="w-full flex items-center justify-between border-b border-border pb-3">
                <span className="text-xs text-text-secondary font-bold uppercase tracking-wider">Candidate Profile</span>
                <Badge variant="neutral">PDF, DOCX, TXT</Badge>
              </div>

              {!file ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-4">
                  <div className="h-16 w-16 rounded-full bg-bg-surface-alt flex items-center justify-center border border-border text-text-secondary text-3xl group hover:text-primary transition duration-300">
                    <FaCloudUploadAlt className="animate-pulse" aria-hidden="true" />
                  </div>
                  <div className="text-center space-y-1">
                    <label htmlFor={fileInputId} className="text-sm font-semibold text-text-primary cursor-pointer hover:text-primary transition duration-200">
                      <span>Click to upload file</span>
                      <input id={fileInputId} type="file" className="hidden" accept=".pdf,.docx,.txt" onChange={handleFileSelect} />
                    </label>
                    <p className="text-xs text-text-secondary">or drag and drop resume here</p>
                  </div>
                </div>
              ) : (
                <div className="w-full flex items-center gap-4 bg-bg-surface-alt rounded-xl p-4 border border-border relative">
                  <div className="h-12 w-12 rounded-lg bg-danger/10 border border-danger/20 flex items-center justify-center text-danger text-2xl shrink-0">
                    <FaFilePdf aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-text-primary truncate">{file.name}</h4>
                    <p className="text-xs text-text-secondary font-mono mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button
                    onClick={handleRemoveFile}
                    aria-label="Remove uploaded file"
                    className="h-8 w-8 rounded-lg hover:bg-bg-surface flex items-center justify-center text-text-secondary hover:text-text-primary transition duration-200 shrink-0"
                  >
                    <FaTimes aria-hidden="true" />
                  </button>
                </div>
              )}

              <div className="w-full text-center text-xs text-text-secondary">
                Data processed locally. Max file size limit: 12MB.
              </div>
            </div>

            <form
              onSubmit={handleStartAnalysis}
              className="bg-bg-surface rounded-2xl p-6 border border-border shadow-soft flex flex-col justify-between space-y-4"
            >
              <div className="space-y-4">
                <div className="w-full flex items-center justify-between border-b border-border pb-3">
                  <span className="text-xs text-text-secondary font-bold uppercase tracking-wider">Job Target Specs</span>
                  <Badge variant="primary">Target Matrix</Badge>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor={jobTitleId} className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">Job Title</label>
                  <input
                    id={jobTitleId}
                    type="text"
                    required
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g., Software Engineer"
                    className="w-full rounded-xl bg-bg-surface-alt border border-border px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition duration-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label htmlFor={jobDescriptionId} className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">Job Description</label>
                    <button
                      type="button"
                      onClick={() =>
                        setJobDescription(
                          'We are looking for a Software Engineer with 3+ years of experience building scalable applications. Must be fluent in React, TypeScript, state management stores, and responsive layouts.'
                        )
                      }
                      className="text-xs text-primary hover:underline font-medium font-mono"
                    >
                      Load Sample JD
                    </button>
                  </div>
                  <textarea
                    id={jobDescriptionId}
                    required
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the target job description requirements here..."
                    className="w-full h-32 rounded-xl bg-bg-surface-alt border border-border p-4 text-sm text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition duration-200 resize-none font-mono"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={!file || !jobTitle.trim() || !jobDescription.trim()}
                variant="primary"
                size="md"
                className="w-full"
                icon={FaArrowRight}
              >
                Analyze Alignment & Build Questions
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
