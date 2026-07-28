import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaUserAlt, FaBriefcase, FaCalendarAlt, FaFileAlt, FaSlidersH, FaChartLine, FaRobot, FaArrowRight } from 'react-icons/fa';
import { useInterview } from '../context/InterviewContext';
import { INTERVIEWER_PERSONAS, getQuestionsForSetup } from '../services/interviewApi';
import { generateFeedbackReport } from '../services/resultsApi';

// Re-using chart configurations
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

import { LogoIcon } from '../components/common/Logo';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function Profile() {
  const navigate = useNavigate();
  const { isAuthenticated, setResumeData, setQuestions, setCurrentQuestionIndex, setAnswers, setResults, setSetupData } = useInterview();

  if (!isAuthenticated) {
    return (
      <div className="glass-card rounded-2xl p-8 border border-white/5 text-center max-w-md mx-auto mt-12 space-y-6">
        <LogoIcon size={56} className="mx-auto animate-pulse" />
        <h3 className="text-lg font-heading font-bold text-white">Sign In Required</h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          Please sign in to access your candidate profile dashboard, settings, and assessment history.
        </p>
        <button
          onClick={() => navigate('/login', { state: { from: { pathname: '/app/profile' } } })}
          className="inline-block px-5 py-2.5 rounded-xl bg-primary text-xs font-semibold text-white shadow-lg shadow-primary/25 cursor-pointer hover:scale-102 transition active:scale-98"
        >
          Sign In Now
        </button>
      </div>
    );
  }


  // Mock data for user's profile
  const candidate = {
    name: 'Alex Mercer',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120',
    title: 'Senior Frontend Architect',
    location: 'San Francisco, CA (Remote)',
    experience: '6 Years',
    skills: ['React 19', 'TypeScript', 'Tailwind CSS', 'Vite', 'GraphQL', 'System Design'],
    averageScore: 82,
    completedSessions: 8,
  };

  // Mock past interview logs
  const pastInterviews = [
    {
      id: 'past_1',
      date: 'Jun 24, 2026',
      track: 'React 19 Core & Architecture',
      difficulty: 'Senior',
      assessor: 'sarah',
      score: 86,
      answers: [
        "React 19 introduces automated memoization, meaning we can write code without useMemo and useCallback in most cases. Data mutations are also improved via transitions.",
        "Reconciliation works by comparing trees. Keys give elements a persistent identity across renders, allowing React to move nodes instead of recreating them.",
        "I optimize page loads via code-splitting using React.lazy, using modern formats, compressing assets, and monitoring core web vitals like INP."
      ],
    },
    {
      id: 'past_2',
      date: 'Jun 20, 2026',
      track: 'Engineering Collaboration & STAR',
      difficulty: 'Senior',
      assessor: 'david',
      score: 80,
      answers: [
        "I had a technical disagreement regarding state stores. We resolved it by building a lightweight sandbox and benchmarking performance profiles.",
        "I communicated a delay proactively by explaining that database migrations had unexpected schema conflicts, and delivered a clean roll-back plan."
      ]
    },
    {
      id: 'past_3',
      date: 'Jun 12, 2026',
      track: 'System Scalability Design',
      difficulty: 'Lead',
      assessor: 'techbot',
      score: 78,
      answers: [
        "A notification system needs a message bus (like Kafka), email delivery integrations (like SendGrid), and database rate limiters to avoid spamming.",
        "Google Docs concurrent editing works via Operational Transformation or CRDTs. WebSockets are used to broadcast operation lists in real-time."
      ]
    }
  ];

  // Mock resume upload history
  const resumeHistory = [
    {
      id: 'res_1',
      fileName: 'Alex_Mercer_Resume_Architect.pdf',
      date: 'Jun 24, 2026',
      targetRole: 'Staff Frontend Engineer',
      matchScore: 88,
    },
    {
      id: 'res_2',
      fileName: 'Alex_Mercer_Resume_General.pdf',
      date: 'Jun 10, 2026',
      targetRole: 'Senior Software Engineer',
      matchScore: 78,
    }
  ];

  // Setup options
  const [profileSettings, setProfileSettings] = useState({
    defaultInterviewer: 'sarah',
    defaultDifficulty: 'senior',
    preferredMode: 'speak',
  });

  // Doughnut metrics
  const doughnutData = {
    labels: ['Completed', 'Target'],
    datasets: [
      {
        data: [candidate.averageScore, 100 - candidate.averageScore],
        backgroundColor: ['#6366F1', 'rgba(255, 255, 255, 0.03)'],
        borderColor: ['#6366F1', 'rgba(255, 255, 255, 0.05)'],
        borderWidth: 1,
        cutout: '75%',
      }
    ]
  };

  const doughnutOptions = {
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    maintainAspectRatio: false
  };

  // Launch / reload a past assessment report
  const handleLoadPastReport = (interview) => {
    const questionsList = getQuestionsForSetup(
      interview.assessor === 'david' ? 'behavioral' : interview.assessor === 'techbot' ? 'system-design' : 'technical',
      interview.difficulty.toLowerCase()
    );

    // Mock restore session data in context
    setResumeData({
      fileName: 'Alex_Mercer_Resume_Architect.pdf',
      fileSize: '1.24 MB'
    });
    setSetupData({
      type: interview.assessor === 'david' ? 'behavioral' : interview.assessor === 'techbot' ? 'system-design' : 'technical',
      difficulty: interview.difficulty.toLowerCase(),
      focusAreas: ['React 19', 'System Design'],
      persona: interview.assessor,
    });
    setQuestions(questionsList);
    setAnswers(interview.answers);
    
    // Custom structured past report
    setResults({
      overallScore: interview.score,
      categories: {
        technicalAccuracy: interview.score - 2,
        communication: interview.score + 5,
        depth: interview.score - 4,
        timeManagement: interview.score + 1,
      },
      breakdown: questionsList.slice(0, interview.answers.length).map((q, idx) => ({
        id: q.id,
        question: q.question,
        userAnswer: interview.answers[idx],
        score: interview.score + (idx % 2 === 0 ? 3 : -3),
        idealConcepts: q.hint,
        feedback: "Highly robust description covering core architecture mechanics.",
        suggestions: ["Explain specific production scale issues to push this score higher."],
        strengths: "Excellent command of terminology."
      })),
      interviewerComments: "A very solid assessment. Exhibits strong depth in framework architecture and modular design.",
      personaId: interview.assessor,
      setupData: {
        type: interview.assessor === 'david' ? 'behavioral' : interview.assessor === 'techbot' ? 'system-design' : 'technical',
        difficulty: interview.difficulty.toLowerCase(),
        focusAreas: ['React 19'],
        persona: interview.assessor,
      }
    });

    navigate('/app/results');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Profile Header Card */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 border border-white/5 glow-primary relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          <img
            src={candidate.avatar}
            alt={candidate.name}
            className="w-24 h-24 rounded-2xl object-cover border border-white/10 shadow-2xl"
          />

          <div className="text-center md:text-left space-y-2 flex-1">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-white">{candidate.name}</h1>
                <p className="text-sm text-gray-400 font-medium flex items-center justify-center md:justify-start gap-1.5 mt-1">
                  <FaBriefcase className="text-primary" /> {candidate.title}
                </p>
              </div>

              <button
                onClick={() => {
                  setResumeData({
                    fileName: 'Alex_Mercer_Resume_Architect.pdf',
                    fileSize: '1.24 MB'
                  });
                  navigate('/app/setup');
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent font-semibold text-xs text-white shadow-lg cursor-pointer hover:scale-102 transition active:scale-98"
              >
                Start New Session
              </button>
            </div>

            <div className="flex flex-wrap justify-center md:justify-start gap-3.5 text-xs text-gray-500 pt-2 font-mono">
              <span>Location: {candidate.location}</span>
              <span>&bull;</span>
              <span>Exp: {candidate.experience}</span>
              <span>&bull;</span>
              <span>Sessions: {candidate.completedSessions} completed</span>
            </div>

            {/* Tech badges */}
            <div className="flex flex-wrap justify-center md:justify-start gap-1.5 pt-3">
              {candidate.skills.map((skill, idx) => (
                <span
                  key={idx}
                  className="text-[10px] px-2.5 py-0.5 rounded-full bg-white/5 border border-white/5 text-gray-300 font-mono"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Core Stats & Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Aggregated Score Meter */}
        <div className="glass-card rounded-2xl p-6 border border-white/5 flex flex-col justify-between items-center text-center relative overflow-hidden glow-secondary">
          <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block border-b border-white/5 pb-2 w-full">
            Average Rating
          </span>

          <div className="relative h-36 w-36 flex items-center justify-center my-6">
            <div className="absolute inset-0">
              <Doughnut data={doughnutData} options={doughnutOptions} />
            </div>
            <div className="flex flex-col items-center">
              <span className="text-4xl font-heading font-extrabold text-white">
                {candidate.averageScore}%
              </span>
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">
                Overall AVG
              </span>
            </div>
          </div>

          <div className="w-full text-xs text-gray-400 leading-normal">
            Your performance ranks in the <strong className="text-primary">top 12%</strong> for Senior engineering roles.
          </div>
        </div>

        {/* past diagnostics info */}
        <div className="glass-card rounded-2xl p-6 border border-white/5 flex flex-col justify-between lg:col-span-2 space-y-4">
          <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block border-b border-white/5 pb-2 w-full text-left">
            Assessor Settings Configuration
          </span>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Default Assessor</label>
              <select
                value={profileSettings.defaultInterviewer}
                onChange={(e) => setProfileSettings({ ...profileSettings, defaultInterviewer: e.target.value })}
                className="w-full rounded-xl bg-background border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50"
              >
                <option value="sarah">Sarah Chen (Staff)</option>
                <option value="david">David Vance (EM)</option>
                <option value="techbot">TechBot v2 (Strict)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Default Seniority</label>
              <select
                value={profileSettings.defaultDifficulty}
                onChange={(e) => setProfileSettings({ ...profileSettings, defaultDifficulty: e.target.value })}
                className="w-full rounded-xl bg-background border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50"
              >
                <option value="junior">Junior</option>
                <option value="mid">Mid-Level</option>
                <option value="senior">Senior</option>
                <option value="lead">Tech Lead</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Default Response Mode</label>
              <select
                value={profileSettings.preferredMode}
                onChange={(e) => setProfileSettings({ ...profileSettings, preferredMode: e.target.value })}
                className="w-full rounded-xl bg-background border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50"
              >
                <option value="speak">Speak Mode (Voice)</option>
                <option value="type">Type Mode (Editor)</option>
              </select>
            </div>
          </div>

          <div className="bg-[#030712]/50 border border-white/5 rounded-xl p-4 text-left flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-accent/15 flex items-center justify-center text-accent text-xs mt-0.5 shrink-0">
              i
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              These choices will automatically pre-populate the parameters on your next mock interview session, skipping manual configuration steps.
            </p>
          </div>
        </div>
      </div>

      {/* past assessments lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Card: Assessment history list */}
        <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
          <div className="border-b border-white/5 pb-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white text-left">
              Assessment History Log
            </h3>
          </div>

          <div className="space-y-3">
            {pastInterviews.map((item) => {
              const interviewer = INTERVIEWER_PERSONAS[item.assessor];
              return (
                <div
                  key={item.id}
                  className="bg-[#030712]/50 rounded-xl p-4 border border-white/5 flex items-center justify-between text-left group hover:border-white/10 transition duration-200"
                >
                  <div className="space-y-1 min-w-0 pr-4">
                    <h4 className="text-xs font-semibold text-white truncate">{item.track}</h4>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono">
                      <span>{item.date}</span>
                      <span>&bull;</span>
                      <span>Assessor: {interviewer.name}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleLoadPastReport(item)}
                    className="flex items-center gap-2 text-[11px] font-semibold text-primary group-hover:text-accent transition duration-200 shrink-0 cursor-pointer"
                  >
                    <span className="font-mono">{item.score}/100</span>
                    <FaArrowRight size={8} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Card: Uploaded Resume History list */}
        <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
          <div className="border-b border-white/5 pb-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white text-left">
              Uploaded Resumes Log
            </h3>
          </div>

          <div className="space-y-3">
            {resumeHistory.map((res) => (
              <div
                key={res.id}
                className="bg-[#030712]/50 rounded-xl p-4 border border-white/5 flex items-center justify-between text-left"
              >
                <div className="space-y-1 min-w-0 pr-4">
                  <h4 className="text-xs font-semibold text-white truncate">{res.fileName}</h4>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono">
                    <span>{res.date}</span>
                    <span>&bull;</span>
                    <span>Role: {res.targetRole}</span>
                  </div>
                </div>

                <span className="text-xs font-mono font-bold text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded">
                  {res.matchScore}% Match
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
