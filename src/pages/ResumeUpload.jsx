import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaCloudUploadAlt, 
  FaFilePdf, 
  FaArrowRight, 
  FaTimes, 
  FaCheck, 
  FaExclamationTriangle,
  FaRedo
} from 'react-icons/fa';
import { useInterview } from '../context/InterviewContext';
import { simulateResumeAnalysis } from '../services/resumeApi';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/FeedbackHelpers';
import { Progress, Loader } from '../components/ui/Loader';

export default function ResumeUpload() {
  const navigate = useNavigate();
  const {
    isAuthenticated,
    resumeData,
    setResumeData,
    jobTitle,
    setJobTitle,
    jobDescription,
    setJobDescription,
    analysisResult,
    setAnalysisResult,
  } = useInterview();

  if (!isAuthenticated) {
    return (
      <div className="glass-card rounded-2xl p-8 border border-white/5 text-center max-w-md mx-auto mt-12 space-y-6">
        <div className="h-12 w-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-xl mx-auto animate-pulse">
          <FaExclamationTriangle />
        </div>
        <h3 className="text-lg font-heading font-bold text-white">Sign In Required</h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          Please sign in to access the resume parser and targeted mock interview generation engine.
        </p>
        <Button
          onClick={() => navigate('/login', { state: { from: { pathname: '/app/resume' } } })}
          variant="primary"
          size="md"
        >
          Sign In Now
        </Button>
      </div>
    );
  }

  // State Machine variables
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentState, setCurrentState] = useState(resumeData && analysisResult ? 'complete' : 'idle'); // idle, uploading, analyzing, complete, failed
  const [analysisStep, setAnalysisStep] = useState(0);

  const analysisSteps = [
    'Parsing PDF text layers...',
    'Extracting technical skill matrices...',
    'Matching profile experience to target job description...',
    'Generating optimal mock question sets...'
  ];

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = (selectedFile) => {
    // Basic validation
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.endsWith('.pdf') && !selectedFile.name.endsWith('.docx') && !selectedFile.name.endsWith('.txt')) {
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
        setCurrentState('idle'); // file loaded, ready for analysis form submit
        setResumeData({
          fileName: selectedFile.name,
          fileSize: `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`,
        });
      }
    }, 150);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setUploadProgress(0);
    setResumeData(null);
    setAnalysisResult(null);
    setCurrentState('idle');
  };

  const handleStartAnalysis = (e) => {
    e.preventDefault();
    if (!file || !jobTitle.trim() || !jobDescription.trim()) return;

    setCurrentState('analyzing');
    setAnalysisStep(0);

    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      if (step < analysisSteps.length) {
        setAnalysisStep(step);
      } else {
        clearInterval(interval);
        
        // Mocked comprehensive analysis details
        const baseResult = simulateResumeAnalysis(file.name, jobTitle, jobDescription);
        const detailedMockedResult = {
          ...baseResult,
          detectedSkills: ['React 19', 'TypeScript', 'JavaScript (ES6+)', 'HTML5 & CSS3', 'Tailwind CSS', 'Vite Bundlers'],
          detectedTech: ['Redux Toolkit', 'React Router v7', 'Framer Motion', 'Vitest Testing', 'ESLint/Oxlint'],
          projects: [
            { name: 'InterviewIQ Dashboard', desc: 'Designed a premium dashboard using React 19, Tailwind CSS, and ChartJS representing real-time metric analytics.' },
            { name: 'SaaS Finance Engine', desc: 'Built a lightweight ledger accounting tool with robust export capabilities and client transaction tables.' }
          ],
          experience: [
            { company: 'SaaS Tech Corp', role: 'Senior Frontend Engineer', period: '2023 - Present', bullet: 'Led a small development team to structure custom React libraries reducing rendering metrics by 35%.' }
          ],
          education: [
            { school: 'Tech Institute of Science', degree: 'B.S. in Computer Science', period: '2016 - 2020' }
          ]
        };
        
        setAnalysisResult(detailedMockedResult);
        setCurrentState('complete');
      }
    }, 1000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 text-left">
      <SectionHeader
        title="Upload Resume & Job Description"
        description="Our AI parses technical experience matrices, estimates profile alignment, and generates focused questions."
        className="text-center max-w-2xl mx-auto"
      />

      <AnimatePresence mode="wait">
        {/* State 1: Uploading */}
        {currentState === 'uploading' && (
          <motion.div
            key="uploading"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="glass-card rounded-2xl p-10 border border-white/5 flex flex-col items-center justify-center min-h-[300px] text-center"
          >
            <div className="h-14 w-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-2xl mb-4 animate-bounce">
              <FaCloudUploadAlt />
            </div>
            <h3 className="text-lg font-heading font-bold text-white mb-2">Uploading Document</h3>
            <p className="text-xs text-gray-500 mb-6 font-mono">Transferring package payload...</p>
            <Progress value={uploadProgress} max={100} showLabel={true} label="Upload Status" className="max-w-xs" />
          </motion.div>
        )}

        {/* State 2: Analyzing */}
        {currentState === 'analyzing' && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="glass-card rounded-2xl p-10 border border-white/5 flex flex-col items-center justify-center min-h-[350px] text-center glow-primary"
          >
            <Loader size="lg" className="mb-6" />
            <h3 className="text-lg font-heading font-bold text-white mb-2">Analyzing Resume</h3>
            <p className="text-xs text-gray-500 font-mono mb-6">Running AI scanning queries...</p>

            <div className="w-full max-w-md bg-[#030712]/50 border border-white/5 rounded-xl p-5 space-y-3.5 text-left">
              {analysisSteps.map((stepDesc, idx) => {
                const isDone = idx < analysisStep;
                const isCurrent = idx === analysisStep;
                return (
                  <div key={idx} className="flex items-center gap-3 text-xs">
                    {isDone ? (
                      <div className="h-4 w-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-[10px]">
                        <FaCheck />
                      </div>
                    ) : isCurrent ? (
                      <div className="h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                      </div>
                    ) : (
                      <div className="h-4 w-4 rounded-full bg-white/5 border border-white/10 shrink-0" />
                    )}
                    <span className={`font-mono ${isDone ? 'text-emerald-400' : isCurrent ? 'text-white font-semibold' : 'text-gray-500'}`}>
                      {stepDesc}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* State 3: Failed */}
        {currentState === 'failed' && (
          <motion.div
            key="failed"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="glass-card rounded-2xl p-10 border border-red-500/20 bg-red-500/5 flex flex-col items-center justify-center min-h-[300px] text-center"
          >
            <div className="h-12 w-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-xl mb-4">
              <FaExclamationTriangle />
            </div>
            <h3 className="text-lg font-heading font-bold text-white mb-2">Invalid Document Type</h3>
            <p className="text-xs text-gray-400 leading-relaxed max-w-sm mb-6">
              Please upload a supported file layout. We accept only standard **PDF**, **DOCX**, or **TXT** files.
            </p>
            <Button
              onClick={() => setCurrentState('idle')}
              variant="danger"
              size="sm"
              icon={FaRedo}
            >
              Retry Upload
            </Button>
          </motion.div>
        )}

        {/* State 4: Complete Dashboard */}
        {currentState === 'complete' && analysisResult && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card variant="glow-secondary" className="p-6 sm:p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                {/* Score Doughnut wheel */}
                <div className="flex flex-col items-center justify-center text-center p-4 border-b md:border-b-0 md:border-r border-white/5">
                  <span className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-4">Alignment Score</span>
                  
                  <div className="relative h-32 w-32 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="52"
                        stroke="rgba(255, 255, 255, 0.03)"
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
                        strokeDashoffset={326.7 - (326.7 * analysisResult.matchPercentage) / 100}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                      <defs>
                        <linearGradient id="resumeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#8B5CF6" />
                          <stop offset="100%" stopColor="#06B6D4" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-3xl font-heading font-extrabold text-white">
                        {analysisResult.matchPercentage}%
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] text-gray-500 font-mono mt-4 truncate max-w-full">
                    {analysisResult.fileName}
                  </span>
                </div>

                {/* Score Breakdown Text */}
                <div className="col-span-2 space-y-4">
                  <div>
                    <h3 className="text-lg font-heading font-bold text-white">
                      Profile Alignment Index for {jobTitle}
                    </h3>
                    <p className="text-xs text-gray-400 leading-relaxed mt-2">
                      {analysisResult.summary}
                    </p>
                  </div>

                  {/* Skills tags */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-[#030712]/50 border border-white/5 rounded-xl p-3">
                      <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block mb-2">
                        Matched Tech ({analysisResult.skillsMatched.length})
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {analysisResult.skillsMatched.map((s, idx) => (
                          <Badge key={idx} variant="success" size="sm">{s}</Badge>
                        ))}
                      </div>
                    </div>

                    <div className="bg-[#030712]/50 border border-white/5 rounded-xl p-3">
                      <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider block mb-2">
                        Missing Keywords ({analysisResult.skillsMissing.length})
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {analysisResult.skillsMissing.map((s, idx) => (
                          <Badge key={idx} variant="warning" size="sm">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Extracted Profile Details Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Skills and technologies */}
              <Card variant="glass" className="space-y-4">
                <h4 className="text-sm font-heading font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2">
                  Detected Competencies
                </h4>
                
                <div className="space-y-3">
                  <div>
                    <span className="text-[9px] text-gray-500 font-bold uppercase block mb-1">Core Skills</span>
                    <div className="flex flex-wrap gap-1.5">
                      {analysisResult.detectedSkills?.map((s) => (
                        <Badge key={s} variant="primary" size="sm">{s}</Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] text-gray-500 font-bold uppercase block mb-1">Frameworks & Tools</span>
                    <div className="flex flex-wrap gap-1.5">
                      {analysisResult.detectedTech?.map((s) => (
                        <Badge key={s} variant="secondary" size="sm">{s}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Suggestions */}
              <Card variant="glass" className="space-y-4">
                <h4 className="text-sm font-heading font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2">
                  Suggested Improvements
                </h4>
                <div className="space-y-3">
                  {analysisResult.recommendations.map((rec, idx) => (
                    <div key={idx} className="flex gap-2.5 text-xs text-gray-400 leading-relaxed items-start">
                      <span className="h-4 w-4 rounded-full bg-[#030712] border border-white/10 flex items-center justify-center font-mono font-bold text-[9px] shrink-0">
                        {idx + 1}
                      </span>
                      <p>{rec}</p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Projects */}
              <Card variant="glass" className="space-y-4 md:col-span-2">
                <h4 className="text-sm font-heading font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2">
                  Parsed Experience & Projects
                </h4>
                
                <div className="space-y-4">
                  {/* Experience */}
                  <div className="space-y-2">
                    <span className="text-[9px] text-gray-500 font-bold uppercase block">Professional History</span>
                    {analysisResult.experience?.map((exp, idx) => (
                      <div key={idx} className="p-3 bg-white/2 border border-white/5 rounded-xl space-y-1">
                        <div className="flex justify-between items-center text-xs font-semibold text-white">
                          <span>{exp.role} @ {exp.company}</span>
                          <span className="text-gray-500 text-[10px] font-mono">{exp.period}</span>
                        </div>
                        <p className="text-[11px] text-gray-400 leading-relaxed">{exp.bullet}</p>
                      </div>
                    ))}
                  </div>

                  {/* Projects */}
                  <div className="space-y-2">
                    <span className="text-[9px] text-gray-500 font-bold uppercase block">Highlighted Projects</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {analysisResult.projects?.map((proj, idx) => (
                        <div key={idx} className="p-3 bg-white/2 border border-white/5 rounded-xl space-y-1 text-xs">
                          <h5 className="font-semibold text-white">{proj.name}</h5>
                          <p className="text-[11px] text-gray-400 leading-relaxed">{proj.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Education */}
                  <div className="space-y-2">
                    <span className="text-[9px] text-gray-500 font-bold uppercase block">Academic Degrees</span>
                    {analysisResult.education?.map((edu, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-white/2 border border-white/5 rounded-xl text-xs">
                        <span className="font-semibold text-white">{edu.degree} &bull; <span className="text-gray-400">{edu.school}</span></span>
                        <span className="text-gray-500 text-[10px] font-mono">{edu.period}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            {/* Actions panel */}
            <div className="flex justify-between items-center bg-[#111827]/40 rounded-xl p-4 border border-white/5">
              <button
                onClick={handleRemoveFile}
                className="px-4 py-2 text-xs rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition duration-200"
              >
                Upload Different Resume
              </button>
              <Button
                onClick={() => navigate('/app/setup')}
                variant="primary"
                size="md"
                className="bg-gradient-to-r from-primary to-accent"
              >
                <span>Configure Career Setup</span>
                <FaArrowRight className="text-xs ml-1" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* State 5: Idle (Upload Zone / Form submit) */}
        {currentState === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {/* Left: Drag Drop Area */}
            <div
              className={`glass-card rounded-2xl border p-6 flex flex-col justify-between items-center transition duration-300 min-h-[380px] ${
                dragging
                  ? 'border-primary bg-primary/5 glow-primary'
                  : 'border-white/5 hover:border-white/10'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="w-full flex items-center justify-between border-b border-white/5 pb-3">
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Candidate Profile</span>
                <Badge variant="neutral">PDF, DOCX, TXT</Badge>
              </div>

              {!file ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-4">
                  <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10 text-gray-400 text-3xl group hover:text-primary transition duration-300">
                    <FaCloudUploadAlt className="animate-pulse" />
                  </div>
                  <div className="text-center space-y-1">
                    <label className="text-sm font-semibold text-white cursor-pointer hover:text-primary transition duration-200">
                      <span>Click to upload file</span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.docx,.txt"
                        onChange={handleFileSelect}
                      />
                    </label>
                    <p className="text-xs text-gray-500">or drag and drop resume here</p>
                  </div>
                </div>
              ) : (
                <div className="w-full flex items-center gap-4 bg-[#030712]/60 rounded-xl p-4 border border-white/5 relative">
                  <div className="h-12 w-12 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-2xl shrink-0">
                    <FaFilePdf />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-white truncate">{file.name}</h4>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={handleRemoveFile}
                    className="h-8 w-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-gray-500 hover:text-white transition duration-200 shrink-0"
                  >
                    <FaTimes />
                  </button>
                </div>
              )}

              <div className="w-full text-center text-[10px] text-gray-500">
                Data processed locally. Max file size limit: 12MB.
              </div>
            </div>

            {/* Right: Job Specs Form */}
            <form
              onSubmit={handleStartAnalysis}
              className="glass-card rounded-2xl p-6 border border-white/5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-4">
                <div className="w-full flex items-center justify-between border-b border-white/5 pb-3">
                  <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Job Target Specs</span>
                  <Badge variant="primary">Target Matrix</Badge>
                </div>

                {/* Job Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Job Title</label>
                  <input
                    type="text"
                    required
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g., Software Engineer"
                    className="w-full rounded-xl bg-background border border-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50 transition duration-200"
                  />
                </div>

                {/* Job Description */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Job Description</label>
                    <button
                      type="button"
                      onClick={() =>
                        setJobDescription(
                          'We are looking for a Software Engineer with 3+ years of experience building scalable applications. Must be fluent in React, TypeScript, state management stores, and responsive layouts.'
                        )
                      }
                      className="text-[10px] text-primary hover:text-accent font-medium font-mono"
                    >
                      Load Sample JD
                    </button>
                  </div>
                  <textarea
                    required
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the target job description requirements here..."
                    className="w-full h-32 rounded-xl bg-background border border-white/10 p-4 text-sm text-white focus:outline-none focus:border-primary/50 transition duration-200 resize-none font-mono"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={!file || !jobTitle.trim() || !jobDescription.trim()}
                variant="primary"
                size="md"
                className="w-full bg-gradient-to-r from-primary to-accent"
              >
                <span>Analyze Alignment & Build Questions</span>
                <FaArrowRight className="text-xs ml-1" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
