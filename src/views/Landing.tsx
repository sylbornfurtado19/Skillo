'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  FaUpload,
  FaMicrophone,
  FaArrowRight,
  FaChevronDown,
  FaChevronUp,
  FaSlidersH,
  FaFileAlt,
  FaBrain,
  FaChartLine,
  FaUserTie,
} from 'react-icons/fa';
import { INTERVIEWER_PERSONAS, CAREER_DOMAINS } from '../services/constants';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/FeedbackHelpers';

export default function Landing() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  // Domains tracking state
  const [selectedDomain, setSelectedDomain] = useState<string>('Computer Science');

  // FAQ state
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Computed platform statistics
  const domainCount = Object.keys(CAREER_DOMAINS).length;
  const roleCount = Object.values(CAREER_DOMAINS).reduce((acc, roles) => acc + roles.length, 0);
  const personaCount = Object.keys(INTERVIEWER_PERSONAS).length;

  const handleStartPreparing = () => {
    if (isAuthenticated) {
      router.push('/dashboard');
    } else {
      router.push('/login?from=/dashboard');
    }
  };

  const faqItems = [
    {
      q: 'How does the resume analysis work?',
      a: "You upload a PDF, enter a job title and description, and the app compares your skills against what the role asks for. It shows what matches, what's missing, and how to improve your resume.",
    },
    {
      q: 'Are the questions customized?',
      a: 'Yes. Questions change based on the domain, role, and difficulty you select. Technical, behavioral, and system design tracks each have their own question sets.',
    },
    {
      q: 'Can I practice behavioral and system design questions?',
      a: 'Yes — there are separate tracks for technical questions, behavioral (STAR method), and system design. You can also do a mixed session.',
    },
    {
      q: 'Is my data private?',
      a: 'Yes. Video telemetry, gaze tracking, and facial analysis run entirely client-side in your browser using local edge models — no raw video or webcam feeds are ever uploaded or stored. Your interview history and resume analysis are encrypted and accessible only to your authenticated account.',
    },
    {
      q: 'Do I need a camera or microphone?',
      a: 'A microphone is recommended for full spoken mock interviews, and a camera enables the optional IVP telemetry to track eye contact and posture. However, neither is mandatory — you can also practice by typing your responses, and all camera features can be toggled off at any time.',
    },
  ];

  return (
    <div className="space-y-28 py-8">
      {/* 1. Hero Section */}
      <section className="relative max-w-6xl mx-auto pt-8 px-4">
        {/* Hero Heading: centered */}
        <div className="text-center max-w-4xl mx-auto mb-10 sm:mb-14">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="font-heading font-extrabold text-4xl sm:text-6xl tracking-tight text-[var(--text-primary)] leading-tight text-center"
          >
            Practice interviews that actually{' '}
            <span className="text-[var(--primary)] font-extrabold">
              prepare you
            </span>
          </motion.h1>
        </div>

        {/* Desktop 2-column layout: text left, product preview card right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: body copy and actions */}
          <div className="lg:col-span-6 space-y-6 text-left">
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed text-left"
            >
              Get real-time feedback on your interview performance. We analyze your responses and provide actionable insights so you can sharpen your skills before the actual day.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center gap-4 pt-2 w-full justify-start"
            >
              <Button
                onClick={handleStartPreparing}
                variant="primary"
                size="lg"
                className="w-full sm:w-auto relative group overflow-hidden shadow-[var(--shadow)]"
              >
                Start Preparing Now
              </Button>

              <a
                href="#features"
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-[var(--bg-surface-alt)] hover:bg-[var(--border)] text-[var(--text-primary)] border border-[var(--border)] hover:scale-102 active:scale-98 transition-all duration-200 flex items-center justify-center font-semibold text-base shadow-[var(--shadow)]"
              >
                See Features
              </a>
            </motion.div>
          </div>

          {/* Right Column: product preview card */}
          <div className="lg:col-span-6 w-full">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.25 }}
            >
              <Card variant="solid" className="p-6 sm:p-8 border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow)] rounded-2xl">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-3 mb-6">
                  <div>
                    <span className="text-xs font-mono font-bold uppercase text-[var(--primary)] tracking-wider">Live Assessment Preview</span>
                    <h3 className="text-sm font-heading font-bold text-[var(--text-primary)]">Candidate Readiness Score</h3>
                  </div>
                  <Badge variant="success">Verified Rubric</Badge>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-6 bg-[var(--bg-surface-alt)] rounded-2xl p-6 border border-[var(--border)]">
                  <div className="relative h-32 w-32 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="50"
                        stroke="var(--border)"
                        strokeWidth="8"
                        fill="transparent"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="50"
                        stroke="url(#gradientScoreHero)"
                        strokeWidth="8"
                        strokeDasharray={2 * Math.PI * 50}
                        strokeDashoffset={2 * Math.PI * 50 * (1 - 0.87)}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                      <defs>
                        <linearGradient id="gradientScoreHero" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="var(--primary)" />
                          <stop offset="100%" stopColor="var(--primary-hover)" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-heading font-extrabold text-[var(--text-primary)]">87</span>
                      <span className="text-xs text-[var(--text-secondary)] font-mono font-bold uppercase">Average</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 w-full sm:w-auto">
                    {[
                      { label: 'Tech Depth', val: '91%', color: 'text-[var(--primary)] border-[var(--border)] bg-[var(--primary-soft)]' },
                      { label: 'Delivery', val: '85%', color: 'text-[var(--secondary)] border-[var(--border)] bg-[var(--bg-surface-alt)]' },
                      { label: 'Confidence', val: '78%', color: 'text-[var(--secondary)] border-[var(--border)] bg-[var(--bg-surface-alt)]' },
                      { label: 'Logic', val: '88%', color: 'text-[var(--success)] border-[var(--border)] bg-[var(--bg-surface-alt)]' },
                    ].map((item, idx) => (
                      <div key={idx} className={`px-3 py-2 rounded-xl border flex flex-col items-center justify-center text-center min-w-[110px] ${item.color}`}>
                        <span className="text-xs font-mono text-[var(--text-secondary)] font-bold uppercase">{item.label}</span>
                        <span className="text-sm font-heading font-extrabold mt-0.5">{item.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 2. Capability Features & Performance Flows */}
      <section className="space-y-28 px-4 max-w-6xl mx-auto">
        {/* PART 1 — "How It Works" Flow */}
        <motion.div
          id="how-it-works"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.15 },
            },
          }}
          className="space-y-12 scroll-mt-32"
        >
          <SectionHeader
            title="How It Works"
            description="Clear steps to bridge the gap between your resume and a job offer."
            className="text-center max-w-2xl mx-auto"
          />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-stretch relative">
            {[
              { step: 'Step 01', title: 'Upload Resume', icon: FaUpload, desc: 'We parse your experience to find potential talking points.' },
              { step: 'Step 02', title: 'Set Parameters', icon: FaSlidersH, desc: 'Pick your domain, role, and preferred interview intensity.' },
              { step: 'Step 03', title: 'Practice', icon: FaMicrophone, desc: 'Answer questions in real-time to simulate interview pressure.' },
              { step: 'Step 04', title: 'Get Feedback', icon: FaChartLine, desc: 'Receive a score with notes on how to improve your delivery.' },
            ].map((item, idx) => {
              const IconComp = item.icon;
              return (
                <motion.div
                  key={idx}
                  variants={{
                    hidden: { opacity: 0, y: 35 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
                  }}
                  className="relative flex flex-col md:flex-row items-center w-full"
                >
                  <Card variant="default" className="p-5 flex-1 h-full text-left flex flex-col items-start justify-between border border-[var(--border)] hover:border-[var(--primary)] transition-all duration-300 relative z-10 w-full group">
                    <div className="flex flex-col items-start text-left w-full">
                      <div className="h-10 w-10 rounded-full bg-[var(--primary)] flex items-center justify-center text-[var(--text-on-primary)] text-sm mb-3.5 shadow-sm group-hover:scale-110 transition duration-300">
                        <IconComp aria-hidden="true" />
                      </div>
                      <span className="text-xs font-mono font-bold text-[var(--primary)] uppercase block mb-1">{item.step}</span>
                      <h4 className="font-heading font-bold text-sm text-[var(--text-primary)] mb-1.5">{item.title}</h4>
                      <p className="text-xs text-[var(--text-secondary)] leading-normal text-left">{item.desc}</p>
                    </div>
                  </Card>
                  {idx < 3 && (
                    <div className="hidden md:flex absolute -right-5 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-[var(--bg-surface-alt)] border border-[var(--border)] items-center justify-center text-[var(--text-secondary)] text-xs shadow-sm">
                      <FaArrowRight aria-hidden="true" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* PART 2 — Feature Highlights Grid */}
        <motion.div
          id="features"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.12 },
            },
          }}
          className="space-y-12 scroll-mt-32"
        >
          <SectionHeader
            title="Features"
            description="Tools designed to help you communicate more effectively."
            className="text-center max-w-2xl mx-auto"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                title: 'Resume Review',
                icon: FaFileAlt,
                desc: 'Tailor your experience to match specific job descriptions.',
                colorClass: 'text-[var(--primary)]',
                borderClass: 'border-t-2 border-t-[var(--primary)]',
                bgClass: 'bg-[var(--bg-surface)]',
              },
              {
                title: 'Interviewer Personas',
                icon: FaUserTie,
                desc: 'Train with different styles to build comfort for any situation.',
                colorClass: 'text-[var(--secondary)]',
                borderClass: 'border-t-2 border-t-[var(--secondary)]',
                bgClass: 'bg-[var(--bg-surface)]',
              },
              {
                title: 'Domain Focus',
                icon: FaBrain,
                desc: 'Questions customized for your specific technical field.',
                colorClass: 'text-[var(--primary)]',
                borderClass: 'border-t-2 border-t-[var(--primary)]',
                bgClass: 'bg-[var(--bg-surface)]',
              },
              {
                title: 'Growth Analytics',
                icon: FaChartLine,
                desc: 'See exactly where you stand and what to practice next.',
                colorClass: 'text-[var(--success)]',
                borderClass: 'border-t-2 border-t-[var(--success)]',
                bgClass: 'bg-[var(--bg-surface)]',
              },
            ].map((f, idx) => {
              const IconComp = f.icon;
              return (
                <motion.div
                  key={idx}
                  variants={{
                    hidden: { opacity: 0, y: 30 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
                  }}
                >
                  <Card variant="default" className={`p-6 text-left ${f.borderClass} ${f.bgClass} flex flex-col items-start justify-start gap-3 hover:scale-102 hover:shadow-[var(--shadow)] transition-all duration-300 group`}>
                    <div className={`h-11 w-11 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)] flex items-center justify-center shrink-0 text-base ${f.colorClass} group-hover:scale-110 transition duration-300`}>
                      <IconComp />
                    </div>
                    <div className="space-y-1 text-left">
                      <h4 className="font-heading font-bold text-sm text-[var(--text-primary)] text-left">{f.title}</h4>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed text-left">{f.desc}</p>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* PART 3 — Mock Results Preview Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card variant="solid" className="p-8 border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow)]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center text-left">
              <div className="space-y-4 flex flex-col items-start text-left">
                <span className="text-xs text-[var(--primary)] font-mono font-bold uppercase tracking-wider block">
                  SAMPLE FEEDBACK
                </span>
                <h3 className="text-xl sm:text-2xl font-heading font-extrabold text-[var(--text-primary)] leading-tight text-left">
                  Clear, honest evaluation
                </h3>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed text-left">
                  Every session generates a private performance breakdown, scoring your clarity, system depth, and communication confidence.
                </p>
                <div className="pt-2 flex justify-start w-full">
                  <Button
                    onClick={handleStartPreparing}
                    variant="primary"
                    size="sm"
                    icon={FaArrowRight}
                  >
                    Get Your First Score
                  </Button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-8 bg-[var(--bg-surface-alt)] rounded-2xl p-6 border border-[var(--border)]">
                <div className="relative h-32 w-32 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="50"
                      stroke="var(--border)"
                      strokeWidth="8"
                      fill="transparent"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="50"
                      stroke="url(#gradientScore)"
                      strokeWidth="8"
                      strokeDasharray={2 * Math.PI * 50}
                      strokeDashoffset={2 * Math.PI * 50 * (1 - 0.87)}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                    <defs>
                      <linearGradient id="gradientScore" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="var(--primary)" />
                        <stop offset="100%" stopColor="var(--primary-hover)" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-heading font-extrabold text-[var(--text-primary)]">87</span>
                    <span className="text-xs text-[var(--text-secondary)] font-mono font-bold uppercase">Average</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 w-full sm:w-auto">
                  {[
                    { label: 'Tech Depth', val: '91%', color: 'text-[var(--primary)] border-[var(--border)] bg-[var(--primary-soft)]' },
                    { label: 'Delivery', val: '85%', color: 'text-[var(--secondary)] border-[var(--border)] bg-[var(--bg-surface-alt)]' },
                    { label: 'Confidence', val: '78%', color: 'text-[var(--secondary)] border-[var(--border)] bg-[var(--bg-surface-alt)]' },
                    { label: 'Logic', val: '88%', color: 'text-[var(--success)] border-[var(--border)] bg-[var(--bg-surface-alt)]' },
                  ].map((item, idx) => (
                    <div key={idx} className={`px-3 py-2 rounded-xl border flex flex-col items-center justify-center text-center min-w-[120px] ${item.color}`}>
                      <span className="text-xs font-mono text-[var(--text-secondary)] font-bold uppercase">{item.label}</span>
                      <span className="text-sm font-heading font-extrabold mt-0.5">{item.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </section>

      {/* 4. Supported Domains */}
      <section id="domains" className="space-y-12 px-4 max-w-6xl mx-auto scroll-mt-32">
        <SectionHeader
          title="Supported Career Domains"
          description="Pick the field you're interviewing for. Questions and roles adjust automatically."
          className="text-center max-w-2xl mx-auto"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-3 lg:col-span-1 text-left">
            <span className="text-xs text-[var(--text-secondary)] font-bold uppercase tracking-wider block mb-2 text-left">Select Domain</span>
            {Object.keys(CAREER_DOMAINS).map((domain) => (
              <button
                key={domain}
                onClick={() => setSelectedDomain(domain)}
                className={`w-full p-4 rounded-xl border text-left font-heading font-bold text-sm transition duration-200 flex items-center justify-between gap-2.5 cursor-pointer ${
                  selectedDomain === domain
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)] shadow-sm'
                    : 'border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <span>{domain}</span>
                <FaArrowRight aria-hidden="true" size={10} className={`${selectedDomain === domain ? 'translate-x-1' : 'opacity-0'} transition duration-200`} />
              </button>
            ))}
          </div>

          <div className="lg:col-span-2 text-left">
            <Card variant="solid" className="h-full flex flex-col justify-between items-start text-left">
              <div className="w-full">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[var(--border)] pb-3 mb-6">
                  <span className="text-xs text-[var(--text-secondary)] font-bold uppercase tracking-wider">Available Roles ({selectedDomain})</span>
                  <Badge variant="secondary">Verified Roles</Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  {(CAREER_DOMAINS[selectedDomain as keyof typeof CAREER_DOMAINS] || []).map((role) => (
                    <div
                      key={role}
                      className="flex flex-row items-center justify-start text-left gap-2.5 p-3 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)] hover:border-[var(--primary)] transition duration-200"
                    >
                      <div className="h-2 w-2 rounded-full bg-[var(--primary)] shrink-0" />
                      <span className="text-xs font-semibold text-[var(--text-primary)] text-left">{role}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-[var(--border)] flex flex-col items-start text-left gap-4 w-full">
                <p className="text-xs text-[var(--text-secondary)] text-left">
                  Selecting a domain automatically filters available roles on the setup page.
                </p>
                <Button
                  onClick={() => router.push('/setup')}
                  variant="primary"
                  size="sm"
                >
                  Configure This Domain
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* 6. Platform Highlights Banner */}
      <section className="bg-[var(--primary)] text-[var(--text-on-primary)] py-16 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          <div className="space-y-1">
            <p className="text-4xl font-heading font-extrabold text-[var(--text-on-primary)]">{domainCount}</p>
            <p className="text-xs text-[var(--text-on-primary)]/80 font-bold uppercase tracking-wider">Industry Domains</p>
          </div>
          <div className="space-y-1">
            <p className="text-4xl font-heading font-extrabold text-[var(--text-on-primary)]">{roleCount}+</p>
            <p className="text-xs text-[var(--text-on-primary)]/80 font-bold uppercase tracking-wider">Common Job Profiles</p>
          </div>
          <div className="space-y-1">
            <p className="text-4xl font-heading font-extrabold text-[var(--text-on-primary)]">{personaCount}</p>
            <p className="text-xs text-[var(--text-on-primary)]/80 font-bold uppercase tracking-wider">Assessor Styles</p>
          </div>
        </div>
      </section>

      {/* 7. AI Assessor Personas */}
      <section className="space-y-12 bg-[var(--bg-surface)] rounded-3xl border border-[var(--border)] p-8 md:p-12 max-w-6xl mx-auto px-4 shadow-[var(--shadow)]">
        <SectionHeader
          title="Pick your interviewer"
          description="Each one asks questions differently — practice with all three to cover your bases."
          className="text-center max-w-2xl mx-auto"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.values(INTERVIEWER_PERSONAS).map((persona) => (
            <Card
              key={persona.id}
              variant="default"
              className="flex flex-col items-start text-left gap-4 p-6"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-[var(--border)] shadow-md shrink-0">
                  <Image
                    src={persona.avatar}
                    alt={persona.name}
                    width={48}
                    height={48}
                    className="object-cover h-full w-full"
                  />
                </div>
                <div className="text-left">
                  <h4 className="font-heading font-bold text-[var(--text-primary)] text-sm">{persona.name}</h4>
                  <p className="text-xs text-[var(--text-secondary)]">{persona.role}</p>
                  <p className="text-xs text-[var(--primary)] font-medium tracking-wide uppercase font-mono">{persona.company}</p>
                </div>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed min-h-16 text-left">
                {persona.description}
              </p>
              <span className={`text-xs font-semibold text-[var(--secondary)] font-mono mt-auto text-left`}>
                &bull; {persona.id === 'sarah' ? 'Encouraging Review' : persona.id === 'david' ? 'Pragmatic Leadership' : 'Strict Compliance'}
              </span>
            </Card>
          ))}
        </div>
      </section>

      {/* 9. FAQ Section */}
      <section className="space-y-12 px-4 max-w-3xl mx-auto">
        <SectionHeader
          title="Frequently Asked Questions"
          description=""
          className="text-center max-w-2xl mx-auto"
        />

        <div className="space-y-4">
          {faqItems.map((item, index) => {
            const isOpen = openFaqIndex === index;
            const buttonId = `faq-btn-${index}`;
            const panelId = `faq-panel-${index}`;
            return (
              <div
                key={index}
                className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--shadow)] transition-all duration-300"
              >
                <button
                  type="button"
                  id={buttonId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                  className="w-full p-5 flex items-center justify-between gap-4 text-left hover:bg-[var(--bg-surface-alt)] transition duration-200 cursor-pointer relative"
                >
                  <span className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] text-left pr-6">{item.q}</span>
                  <span className="shrink-0">
                    {isOpen ? (
                      <FaChevronUp aria-hidden="true" className="text-[var(--text-secondary)] text-xs" />
                    ) : (
                      <FaChevronDown aria-hidden="true" className="text-[var(--text-secondary)] text-xs" />
                    )}
                  </span>
                </button>
                {isOpen && (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className="px-5 pb-5 pt-1 text-xs text-[var(--text-secondary)] leading-relaxed border-t border-[var(--border)] bg-[var(--bg-surface-alt)] text-left"
                  >
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 10. CTA Box */}
      <section className="max-w-4xl mx-auto px-4 pb-12">
        <Card variant="solid" className="p-8 sm:p-12 text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-[var(--text-primary)] text-center">
            Ready to practice?
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-xl mx-auto leading-relaxed text-left">
            Set up takes about a minute. Upload your resume, pick a role, and start your first mock interview.
          </p>
          <div className="flex justify-center pt-2">
            <Button
              onClick={handleStartPreparing}
              variant="primary"
              size="lg"
              icon={FaArrowRight}
            >
              Start Preparing Now
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}
