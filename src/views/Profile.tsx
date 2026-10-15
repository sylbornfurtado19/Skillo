'use client';

import React, { useState, useEffect, useId } from 'react';
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
import { Skeleton } from '../components/ui/Skeleton';
import Button from '../components/ui/Button';
import { FaExclamationTriangle } from 'react-icons/fa';
import '../lib/chartSetup';
import { useChartTheme } from '../hooks/useChartTheme';
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
  const chartTheme = useChartTheme();
  const {
    sessionHistory,
    setQuestions,
    setAnswers,
    setResults,
    setSetupData,
  } = useInterview();


  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const assessorSelectId = useId();
  const senioritySelectId = useId();
  const modeSelectId = useId();

  const [profileSettings, setProfileSettings] = useState({
    defaultInterviewer: 'sarah',
    defaultDifficulty: 'senior',
    preferredMode: 'speak',
  });

  const loadProfileData = () => {
    if (!user?.id) {
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    setProfileError(null);
    getProfile(user.id)
      .then(({ data, error }) => {
        if (error) {
          setProfileError(typeof error === 'string' ? error : 'Failed to retrieve profile data.');
        } else if (data) {
          setUserProfile(data);
          if (data.profileSettings) {
            setProfileSettings({
              defaultInterviewer: data.profileSettings.defaultInterviewer || 'sarah',
              defaultDifficulty: data.profileSettings.defaultDifficulty || 'senior',
              preferredMode: data.profileSettings.preferredMode || 'speak',
            });
          }
        }
      })
      .catch((err) => {
        setProfileError(err?.message || 'Error communicating with profile service');
      })
      .finally(() => {
        setProfileLoading(false);
      });
  };

  useEffect(() => {
    loadProfileData();
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
      <div className="bg-bg-surface rounded-2xl p-8 border border-border shadow-soft text-center max-w-md mx-auto mt-12 space-y-6">
        <LogoIcon size={56} className="mx-auto" />
        <h3 className="text-lg font-heading font-bold text-text-primary">Sign In Required</h3>
        <p className="text-xs text-text-secondary leading-relaxed">
          Please sign in to access your candidate profile dashboard, settings, and assessment history.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="inline-block px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-xs font-semibold text-text-on-primary shadow-sm cursor-pointer transition"
        >
          Sign In Now
        </button>
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-8 pb-16 text-left">
        <div className="bg-bg-surface rounded-2xl p-6 sm:p-8 border border-border shadow-soft flex flex-col md:flex-row items-center md:items-start gap-6">
          <Skeleton variant="avatar" className="w-24 h-24 rounded-2xl" />
          <div className="space-y-3 flex-1 w-full">
            <Skeleton variant="text" className="h-7 w-56" />
            <Skeleton variant="text" className="h-4 w-72" />
            <Skeleton variant="text" className="h-4 w-40" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton variant="rect" className="h-44 rounded-2xl" />
          <Skeleton variant="rect" className="md:col-span-2 h-44 rounded-2xl" />
        </div>

        <Skeleton variant="rect" className="h-64 rounded-2xl" />
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
        backgroundColor: [chartTheme.primary, chartTheme.border],
        borderColor: [chartTheme.primary, chartTheme.border],
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
      {profileError && (
        <div className="bg-danger/10 border border-danger/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-3">
            <FaExclamationTriangle className="text-danger text-lg shrink-0" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold text-text-primary">Profile Sync Notice</p>
              <p className="text-xs text-text-secondary">{profileError}</p>
            </div>
          </div>
          <Button onClick={loadProfileData} variant="danger" size="sm">
            Retry Sync
          </Button>
        </div>
      )}

      <div className="bg-bg-surface rounded-2xl p-6 sm:p-8 border border-border shadow-soft relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="relative w-24 h-24 rounded-2xl overflow-hidden border border-border shrink-0 bg-primary-soft flex items-center justify-center">
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
                <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-text-primary">{candidate.name}</h1>
                <div className="text-sm text-text-secondary font-medium flex items-center justify-center md:justify-start gap-1.5 mt-1">
                  <FaBriefcase className="text-primary text-xs" />
                  {candidate.title ? (
                    <span className="text-text-primary">{candidate.title}</span>
                  ) : (
                    <button
                      onClick={() => router.push('/settings')}
                      className="text-xs text-primary hover:underline flex items-center gap-1 font-mono cursor-pointer"
                    >
                      <FaEdit size={10} /> Add target role title in Settings
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={() => router.push('/setup')}
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover font-semibold text-xs text-text-on-primary shadow-sm cursor-pointer transition"
              >
                Start New Session
              </button>
            </div>

            <div className="flex flex-wrap justify-center md:justify-start gap-3.5 text-xs text-text-secondary pt-2 font-mono items-center">
              <span className="flex items-center gap-1">
                <FaMapMarkerAlt className="text-text-secondary text-xs" aria-hidden="true" />
                {candidate.location ? (
                  candidate.location
                ) : (
                  <button onClick={() => router.push('/settings')} className="hover:text-text-primary underline">
                    Not set
                  </button>
                )}
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <FaClock className="text-text-secondary text-xs" aria-hidden="true" />
                {candidate.experience ? (
                  candidate.experience
                ) : (
                  <button onClick={() => router.push('/settings')} className="hover:text-text-primary underline">
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
                  className="text-xs px-2.5 py-0.5 rounded-full bg-bg-surface-alt border border-border text-text-secondary font-mono"
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
        <div className="bg-bg-surface rounded-2xl p-6 border border-border shadow-soft flex flex-col justify-between items-center text-center relative overflow-hidden">
          <span className="text-xs text-text-secondary font-bold uppercase tracking-wider block border-b border-border pb-2 w-full">
            Average Rating
          </span>

          <div className="relative h-36 w-36 flex items-center justify-center my-6">
            <div className="absolute inset-0">
              <Doughnut key={`profile-doughnut-${chartTheme.themeKey}`} data={doughnutData} options={doughnutOptions} />
            </div>
            <div className="flex flex-col items-center">
              <span className="text-4xl font-heading font-extrabold text-text-primary">
                {candidate.averageScore ? `${candidate.averageScore}%` : 'N/A'}
              </span>
              <span className="text-xs text-text-secondary font-bold uppercase tracking-wider font-mono">
                Overall AVG
              </span>
            </div>
          </div>

          <div className="w-full text-xs text-text-secondary leading-normal">
            {candidate.completedSessions > 0
              ? 'Performance score calculated across your historical assessment sessions.'
              : 'Complete your first practice session to generate your average rating rating.'}
          </div>
        </div>

        <div className="bg-bg-surface rounded-2xl p-6 border border-border shadow-soft flex flex-col justify-between lg:col-span-2 space-y-4">
          <span className="text-xs text-text-secondary font-bold uppercase tracking-wider block border-b border-border pb-2 w-full text-left">
            Assessor Settings Configuration
          </span>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <div className="space-y-1.5">
              <label htmlFor={assessorSelectId} className="text-xs text-text-secondary font-bold uppercase tracking-wider">Default Assessor</label>
              <select
                id={assessorSelectId}
                value={profileSettings.defaultInterviewer}
                onChange={(e) => handleUpdateSetting('defaultInterviewer', e.target.value)}
                className="w-full rounded-xl bg-bg-surface-alt border border-border px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="sarah">Sarah Chen (Staff)</option>
                <option value="david">David Vance (EM)</option>
                <option value="techbot">TechBot v2 (Strict)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor={senioritySelectId} className="text-xs text-text-secondary font-bold uppercase tracking-wider">Default Seniority</label>
              <select
                id={senioritySelectId}
                value={profileSettings.defaultDifficulty}
                onChange={(e) => handleUpdateSetting('defaultDifficulty', e.target.value)}
                className="w-full rounded-xl bg-bg-surface-alt border border-border px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="Junior">Junior</option>
                <option value="Mid-Level">Mid-Level</option>
                <option value="Senior">Senior</option>
                <option value="Tech Lead">Tech Lead</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor={modeSelectId} className="text-xs text-text-secondary font-bold uppercase tracking-wider">Default Response Mode</label>
              <select
                id={modeSelectId}
                value={profileSettings.preferredMode}
                onChange={(e) => handleUpdateSetting('preferredMode', e.target.value)}
                className="w-full rounded-xl bg-bg-surface-alt border border-border px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="speak">Speak Mode (Voice)</option>
                <option value="type">Type Mode (Editor)</option>
              </select>
            </div>
          </div>

          <div className="bg-bg-surface-alt border border-border rounded-xl p-4 text-left flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-primary-soft flex items-center justify-center text-primary text-xs mt-0.5 shrink-0" aria-hidden="true">
              i
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              These saved settings automatically pre-fill your practice session parameters, saving setup steps when starting new assessments.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-bg-surface rounded-2xl p-6 border border-border shadow-soft space-y-4">
          <div className="border-b border-border pb-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary text-left">Assessment History Log</h3>
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
                    className="bg-bg-surface-alt rounded-xl p-4 border border-border flex items-center justify-between text-left group hover:border-primary/30 transition duration-200"
                  >
                    <div className="space-y-1 min-w-0 pr-4">
                      <h4 className="text-xs font-semibold text-text-primary truncate">{trackName}</h4>
                      <div className="flex items-center gap-2 text-xs text-text-secondary font-mono">
                        <span>{item.date}</span>
                        <span aria-hidden="true">&bull;</span>
                        <span>Assessor: {interviewer.name}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleLoadPastReport(item)}
                      aria-label={`View report for ${trackName}, score ${item.score} out of 100`}
                      className="flex items-center gap-2 text-xs font-semibold text-primary hover:text-primary-hover transition duration-200 shrink-0 cursor-pointer"
                    >
                      <span className="font-mono">{item.score}/100</span>
                      <FaArrowRight aria-hidden="true" size={10} />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="bg-bg-surface-alt rounded-xl p-6 border border-border text-center space-y-2">
                <p className="text-xs text-text-secondary font-medium">No completed assessments yet</p>
                <p className="text-xs text-text-secondary">
                  Complete an interview session to see your evaluation history and metrics here.
                </p>
                <button
                  onClick={() => router.push('/setup')}
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary-hover font-semibold pt-1 transition duration-200 cursor-pointer"
                >
                  <span>Start Practice Interview</span>
                  <FaArrowRight aria-hidden="true" size={10} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-bg-surface rounded-2xl p-6 border border-border shadow-soft space-y-4">
          <div className="border-b border-border pb-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary text-left">Uploaded Resumes Log</h3>
          </div>

          <div className="space-y-3">
            <div className="bg-bg-surface-alt rounded-xl p-4 border border-border flex items-center justify-between text-left">
              <div className="space-y-1 min-w-0 pr-4">
                <h4 className="text-xs font-semibold text-text-primary truncate">
                  {userProfile?.name ? `${userProfile.name.replace(/\s+/g, '_')}_Resume.pdf` : 'Candidate_Resume.pdf'}
                </h4>
                <div className="flex items-center gap-2 text-xs text-text-secondary font-mono">
                  <span>Current</span>
                  <span aria-hidden="true">&bull;</span>
                  <span>Role: {userProfile?.title || 'Software Engineer'}</span>
                </div>
              </div>

              <span className="text-xs font-mono font-bold text-primary bg-primary-soft border border-primary/20 px-2 py-0.5 rounded">
                Active
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
