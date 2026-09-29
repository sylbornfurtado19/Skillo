'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { FaBriefcase, FaArrowRight, FaEdit, FaMapMarkerAlt, FaClock } from 'react-icons/fa';
import { getProfile, updateProfile } from '../services/profile';
import type { UserProfile } from '../types/index';
import { INTERVIEWER_PERSONAS } from '../services/constants';
import { useAuth } from '../hooks/useAuth';
import { useInterview, type SessionHistoryItem } from '../context/InterviewContext';
import { LogoIcon } from '../components/common/Logo';
import '../lib/chartSetup';
import SkillMemoryGraph from '../components/ui/SkillMemoryGraph';

const Doughnut = dynamic(() => import('react-chartjs-2').then((m) => m.Doughnut), { ssr: false });

export function loadPastReport(
  interview: SessionHistoryItem,
  callbacks: {
    setResults: (results: any) => void;
    setSetupData: (data: any) => void;
    setQuestions: (q: string[]) => void;
    setAnswers: (a: any[]) => void;
    router: { push: (path: string) => void };
  }
) {
  const { setResults, setSetupData, setQuestions, setAnswers, router } = callbacks;
  if (interview.report) {
    setResults(interview.report);
    if (interview.report.setupData) {
      setSetupData(interview.report.setupData as any);
    } else {
      setSetupData({
        domain: 'Computer Science',
        role: interview.role || 'Software Engineer',
        experienceLevel: interview.difficulty || 'Mid-Level',
        type: interview.type || 'Technical',
        difficulty: interview.difficulty || 'Mid-Level',
        questionCount: Array.isArray(interview.report.breakdown) ? interview.report.breakdown.length : 3,
        focusAreas: ['Core Architecture', 'System Logic'],
        persona: interview.persona || 'sarah',
        company: interview.company || 'Generic',
        duration: interview.duration || 45,
      });
    }

    if (Array.isArray(interview.report.breakdown) && interview.report.breakdown.length > 0) {
      setQuestions(interview.report.breakdown.map((b) => b.question));
      setAnswers(
        interview.report.breakdown.map((b) => ({
          answerText: b.userAnswer || b.answerText || '',
        }))
      );
    } else {
      setQuestions([]);
      setAnswers([]);
    }
    router.push('/results');
    return;
  }

  const setupDataObj = {
    domain: 'Computer Science',
    role: interview.role || 'Software Engineer',
    experienceLevel: interview.difficulty || 'Mid-Level',
    type: interview.type || 'Technical',
    difficulty: interview.difficulty || 'Mid-Level',
    questionCount: 0,
    focusAreas: [interview.role || 'Software Engineering'],
    persona: interview.persona || 'sarah',
    company: interview.company || 'Generic',
    duration: interview.duration || 45,
  };
  setSetupData(setupDataObj);
  const cats = interview.categories || {};
  setResults({
    overallScore: interview.score,
    categories: {
      technicalAccuracy: cats.technicalAccuracy ?? cats.techKnowledge ?? interview.score,
      communication: cats.communication ?? interview.score,
      depth: cats.depth ?? cats.confidence ?? interview.score,
      timeManagement: cats.timeManagement ?? cats.problemSolving ?? interview.score,
    },
    breakdown: [],
    interviewerComments: `Historical assessment record from ${interview.date}. Overall score: ${interview.score}%.`,
    personaId: interview.persona || 'sarah',
    setupData: setupDataObj,
  });
  setQuestions([]);
  setAnswers([]);
  router.push('/results');
}

export default function Profile() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const {
    sessionHistory,
    setQuestions,
    setAnswers,
    setResults,
    setSetupData,
  } = useInterview();


  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [profileSettings, setProfileSettings] = useState({
    defaultInterviewer: 'sarah',
    defaultDifficulty: 'senior',
    preferredMode: 'speak',
  });

  useEffect(() => {
    if (user?.id) {
      getProfile(user.id).then(({ data }) => {
        if (data) {
          setUserProfile(data);
          if (data.profileSettings) {
            setProfileSettings({
              defaultInterviewer: data.profileSettings.defaultInterviewer || 'sarah',
              defaultDifficulty: data.profileSettings.defaultDifficulty || 'senior',
              preferredMode: data.profileSettings.preferredMode || 'speak',
            });
          }
        }
      });
    }
  }, [user?.id]);

  const handleUpdateSetting = async (key: string, val: string) => {
    const updated = { ...profileSettings, [key]: val };
    setProfileSettings(updated);
    if (user?.id) {
      const currentPs = userProfile?.profileSettings || {};
      await updateProfile(user.id, {
        profileSettings: { ...currentPs, [key]: val },
      });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="glass-card rounded-2xl p-8 border border-white/5 text-center max-w-md mx-auto mt-12 space-y-6">
        <LogoIcon size={56} className="mx-auto animate-pulse" />
        <h3 className="text-lg font-heading font-bold text-white">Sign In Required</h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          Please sign in to access your candidate profile dashboard, settings, and assessment history.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="inline-block px-5 py-2.5 rounded-xl bg-primary text-xs font-semibold text-white shadow-lg shadow-primary/25 cursor-pointer hover:scale-102 transition active:scale-98"
        >
          Sign In Now
        </button>
      </div>
    );
  }

  const candidateName =
    userProfile?.name ??
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split('@')[0] ??
    'Candidate';

  const avatarUrl =
    userProfile?.avatar_url ??
    (user?.user_metadata?.avatar_url as string | undefined) ??
    (user?.user_metadata?.picture as string | undefined) ??
    null;

  const userInitial = candidateName.charAt(0).toUpperCase();

  const completedCount = sessionHistory ? sessionHistory.length : 0;
  const avgScore =
    completedCount > 0
      ? Math.round(sessionHistory.reduce((sum, item) => sum + item.score, 0) / completedCount)
      : 0;

  const candidate = {
    name: candidateName,
    avatar: avatarUrl,
    title: userProfile?.title ?? null,
    location: userProfile?.location ?? null,
    experience: userProfile?.experience ?? null,
    skills: userProfile?.skillMemoryStore?.nodes
      ? Object.values(userProfile.skillMemoryStore.nodes).map((n) => n.skillId).slice(0, 6)
      : ['React 19', 'TypeScript', 'Next.js', 'System Design'],


    averageScore: avgScore,
    completedSessions: completedCount,
  };

  const doughnutData = {
    labels: ['Score', 'Remaining'],
    datasets: [
      {
        data: candidate.completedSessions > 0
          ? [candidate.averageScore, 100 - candidate.averageScore]
          : [0, 100],
        backgroundColor: ['#6366F1', 'rgba(255, 255, 255, 0.03)'],
        borderColor: ['#6366F1', 'rgba(255, 255, 255, 0.05)'],
        borderWidth: 1,
        cutout: '75%',
      },
    ],
  };

  const doughnutOptions = {
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    maintainAspectRatio: false,
  };



  const handleLoadPastReport = (interview: SessionHistoryItem) => {
    loadPastReport(interview, {
      setResults,
      setSetupData,
      setQuestions,
      setAnswers,
      router,
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16 text-left">
      <div className="glass-card rounded-2xl p-6 sm:p-8 border border-white/5 glow-primary relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="relative w-24 h-24 rounded-2xl overflow-hidden border border-white/10 shadow-2xl shrink-0 bg-primary/20 flex items-center justify-center">
            {candidate.avatar ? (
              <Image
                src={candidate.avatar}
                alt={candidate.name}
                width={96}
                height={96}
                unoptimized
                className="object-cover h-full w-full"
              />
            ) : (
              <span className="text-3xl font-heading font-extrabold text-primary">{userInitial}</span>
            )}
          </div>

          <div className="text-center md:text-left space-y-2 flex-1">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-white">{candidate.name}</h1>
                <div className="text-sm text-gray-400 font-medium flex items-center justify-center md:justify-start gap-1.5 mt-1">
                  <FaBriefcase className="text-primary text-xs" />
                  {candidate.title ? (
                    <span className="text-gray-200">{candidate.title}</span>
                  ) : (
                    <button
                      onClick={() => router.push('/settings')}
                      className="text-xs text-primary/80 hover:text-primary flex items-center gap-1 font-mono hover:underline cursor-pointer"
                    >
                      <FaEdit size={10} /> Add target role title in Settings
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={() => router.push('/setup')}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent font-semibold text-xs text-white shadow-lg cursor-pointer hover:scale-102 transition active:scale-98"
              >
                Start New Session
              </button>
            </div>

            <div className="flex flex-wrap justify-center md:justify-start gap-3.5 text-xs text-gray-500 pt-2 font-mono items-center">
              <span className="flex items-center gap-1">
                <FaMapMarkerAlt className="text-gray-600 text-[10px]" />
                {candidate.location ? (
                  candidate.location
                ) : (
                  <button onClick={() => router.push('/settings')} className="hover:text-gray-300 underline">
                    Not set
                  </button>
                )}
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <FaClock className="text-gray-600 text-[10px]" />
                {candidate.experience ? (
                  candidate.experience
                ) : (
                  <button onClick={() => router.push('/settings')} className="hover:text-gray-300 underline">
                    Not set
                  </button>
                )}
              </span>
              <span>&bull;</span>
              <span>Sessions: {candidate.completedSessions} completed</span>
            </div>

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

      <SkillMemoryGraph memoryStore={userProfile?.skillMemoryStore} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                {candidate.averageScore ? `${candidate.averageScore}%` : 'N/A'}
              </span>
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">
                Overall AVG
              </span>
            </div>
          </div>

          <div className="w-full text-xs text-gray-400 leading-normal">
            {candidate.completedSessions > 0
              ? 'Performance score calculated across your historical assessment sessions.'
              : 'Complete your first practice session to generate your average rating rating.'}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 border border-white/5 flex flex-col justify-between lg:col-span-2 space-y-4">
          <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block border-b border-white/5 pb-2 w-full text-left">
            Assessor Settings Configuration
          </span>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Default Assessor</label>
              <select
                value={profileSettings.defaultInterviewer}
                onChange={(e) => handleUpdateSetting('defaultInterviewer', e.target.value)}
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
                onChange={(e) => handleUpdateSetting('defaultDifficulty', e.target.value)}
                className="w-full rounded-xl bg-background border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50"
              >
                <option value="Junior">Junior</option>
                <option value="Mid-Level">Mid-Level</option>
                <option value="Senior">Senior</option>
                <option value="Tech Lead">Tech Lead</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Default Response Mode</label>
              <select
                value={profileSettings.preferredMode}
                onChange={(e) => handleUpdateSetting('preferredMode', e.target.value)}
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
              These saved settings automatically pre-fill your practice session parameters, saving setup steps when starting new assessments.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
          <div className="border-b border-white/5 pb-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white text-left">Assessment History Log</h3>
          </div>

          <div className="space-y-3">
            {sessionHistory && sessionHistory.length > 0 ? (
              sessionHistory.map((item) => {
                const interviewer =
                  (item.persona && INTERVIEWER_PERSONAS[item.persona as keyof typeof INTERVIEWER_PERSONAS]) ||
                  INTERVIEWER_PERSONAS.sarah;
                const trackName = item.role
                  ? `${item.role}${item.difficulty ? ` (${item.difficulty})` : ''}`
                  : 'Practice Assessment';

                return (
                  <div
                    key={item.id}
                    className="bg-[#030712]/50 rounded-xl p-4 border border-white/5 flex items-center justify-between text-left group hover:border-white/10 transition duration-200"
                  >
                    <div className="space-y-1 min-w-0 pr-4">
                      <h4 className="text-xs font-semibold text-white truncate">{trackName}</h4>
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
              })
            ) : (
              <div className="bg-[#030712]/50 rounded-xl p-6 border border-white/5 text-center space-y-2">
                <p className="text-xs text-gray-400 font-medium">No completed assessments yet</p>
                <p className="text-[11px] text-gray-500">
                  Complete an interview session to see your evaluation history and metrics here.
                </p>
                <button
                  onClick={() => router.push('/setup')}
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-accent font-semibold pt-1 transition duration-200 cursor-pointer"
                >
                  <span>Start Practice Interview</span>
                  <FaArrowRight size={8} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
          <div className="border-b border-white/5 pb-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white text-left">Uploaded Resumes Log</h3>
          </div>

          <div className="space-y-3">
            <div className="bg-[#030712]/50 rounded-xl p-4 border border-white/5 flex items-center justify-between text-left">
              <div className="space-y-1 min-w-0 pr-4">
                <h4 className="text-xs font-semibold text-white truncate">
                  {userProfile?.name ? `${userProfile.name.replace(/\s+/g, '_')}_Resume.pdf` : 'Candidate_Resume.pdf'}
                </h4>
                <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono">
                  <span>Current</span>
                  <span>&bull;</span>
                  <span>Role: {userProfile?.title || 'Software Engineer'}</span>
                </div>
              </div>

              <span className="text-xs font-mono font-bold text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded">
                Active
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
