'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  FaUpload,
  FaMicrophone,
  FaArrowRight,
  FaUserTie,
  FaChevronDown,
  FaChevronUp,
  FaSlidersH,
  FaFileAlt,
  FaBrain,
  FaChartLine,
} from 'react-icons/fa';
import { INTERVIEWER_PERSONAS, CAREER_DOMAINS } from '../services/constants';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/FeedbackHelpers';

export default function Landing() {
  const router = useRouter();

  // Domains tracking state
  const [selectedDomain, setSelectedDomain] = useState<string>('Computer Science');

  // FAQ state
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const faqItems = [
    {
      q: 'How does the resume analysis work?',
      a: 'You upload a PDF, enter a job title and description, and the app compares your skills against what the role asks for. It shows what matches, what\'s missing, and how to improve your resume.',
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
      q: 'Is there a backend I can connect?',
      a: 'The application uses a built-in Next.js App Router backend with API routes under app/api/. It natively handles AI evaluation, rate limiting, and Supabase persistence without needing a separate backend server.',
    },
  ];

  return (
    <div className="space-y-28 py-8">
      {/* 1. Hero Section */}
      <section className="relative flex flex-col items-center text-center max-w-4xl mx-auto pt-10 px-4">

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="font-heading font-extrabold text-4xl sm:text-6xl tracking-tight text-[var(--text-primary)] leading-tight"
        >
          Practice interviews that actually{' '}
          <span className="text-[var(--primary)] font-extrabold">
            prepare you
          </span>
        </motion.h1>

        {/* Subhead */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-base sm:text-lg text-[var(--text-secondary)] mt-6 max-w-2xl leading-relaxed mx-auto text-center"
        >
          Get real-time feedback on your interview performance. We analyze your responses and provide actionable insights so you can sharpen your skills before the actual day.
        </motion.p>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center gap-4 mt-10 w-full justify-center"
        >
          <Button
            onClick={() => router.push('/dashboard')}
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
                  <Card variant="glass" className="p-5 flex-1 h-full text-center flex flex-col items-center justify-between border border-[var(--border)] hover:border-[var(--primary)] transition-all duration-300 relative z-10 w-full group">
                    <div className="flex flex-col items-center">
                      <div className="h-10 w-10 rounded-full bg-[var(--primary)] flex items-center justify-center text-[var(--text-on-primary)] text-sm mb-3.5 shadow-sm group-hover:scale-110 transition duration-300 mx-auto">
                        <IconComp />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-[var(--primary)] uppercase block mb-1">{item.step}</span>
                      <h4 className="font-heading font-bold text-sm text-[var(--text-primary)] mb-1.5">{item.title}</h4>
                      <p className="text-xs text-[var(--text-secondary)] leading-normal">{item.desc}</p>
                    </div>
                  </Card>
                  {idx < 3 && (
                    <div className="hidden md:flex absolute -right-5 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-[var(--bg-surface-alt)] border border-[var(--border)] items-center justify-center text-[var(--text-secondary)] text-xs shadow-sm">
                      <FaArrowRight />
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
                  <Card variant="glass" className={`p-6 text-center ${f.borderClass} ${f.bgClass} flex flex-col items-center justify-center gap-3 hover:scale-102 hover:shadow-[var(--shadow)] transition-all duration-300 group`}>
                    <div className={`h-11 w-11 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)] flex items-center justify-center shrink-0 text-base ${f.colorClass} group-hover:scale-110 transition duration-300`}>
                      <IconComp />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-heading font-bold text-sm text-[var(--text-primary)]">{f.title}</h4>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-sm mx-auto">{f.desc}</p>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center text-center">
              <div className="space-y-4 flex flex-col items-center">
                <span className="text-[10px] text-[var(--primary)] font-mono font-bold uppercase tracking-wider block">
                  SAMPLE FEEDBACK
                </span>
                <h3 className="text-xl sm:text-2xl font-heading font-extrabold text-[var(--text-primary)] leading-tight">
                  Clear, honest evaluation
                </h3>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-md mx-auto">
                  Every session generates a private performance breakdown, scoring your clarity and confidence.
                </p>
                <div className="pt-2 flex justify-center w-full">
                  <Button
                    onClick={() => router.push('/login')}
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
                    <span className="text-[9px] text-[var(--text-secondary)] font-mono font-bold uppercase">Average</span>
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
                      <span className="text-[9px] font-mono text-[var(--text-secondary)] font-bold uppercase">{item.label}</span>
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
          <div className="space-y-3 lg:col-span-1 text-center">
            <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider block mb-2 text-center">Select Domain</span>
            {Object.keys(CAREER_DOMAINS).map((domain) => (
              <button
                key={domain}
                onClick={() => setSelectedDomain(domain)}
                className={`w-full p-4 rounded-xl border text-center font-heading font-bold text-sm transition duration-200 flex items-center justify-center gap-2.5 cursor-pointer ${
                  selectedDomain === domain
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)] shadow-sm'
                    : 'border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <span>{domain}</span>
                <FaArrowRight size={10} className={`${selectedDomain === domain ? 'translate-x-1' : 'opacity-0'} transition duration-200`} />
              </button>
            ))}
          </div>

          <div className="lg:col-span-2 text-center">
            <Card variant="solid" className="h-full flex flex-col justify-between items-center text-center">
              <div className="w-full">
                <div className="flex flex-col sm:flex-row justify-center items-center gap-2 border-b border-[var(--border)] pb-3 mb-6">
                  <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Available Roles ({selectedDomain})</span>
                  <Badge variant="secondary">Verified Roles</Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  {(CAREER_DOMAINS[selectedDomain as keyof typeof CAREER_DOMAINS] || []).map((role) => (
                    <div
                      key={role}
                      className="flex flex-col sm:flex-row items-center justify-center text-center gap-2.5 p-3 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)] hover:border-[var(--primary)] transition duration-200"
                    >
                      <div className="h-2 w-2 rounded-full bg-[var(--primary)] shrink-0" />
                      <span className="text-xs font-semibold text-[var(--text-primary)]">{role}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-[var(--border)] flex flex-col items-center text-center gap-4 w-full">
                <p className="text-[11px] text-[var(--text-secondary)]">
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
            <p className="text-4xl font-heading font-extrabold text-[var(--text-on-primary)]">5</p>
            <p className="text-[10px] text-[var(--text-on-primary)]/80 font-bold uppercase tracking-wider">Industry Domains</p>
          </div>
          <div className="space-y-1">
            <p className="text-4xl font-heading font-extrabold text-[var(--text-on-primary)]">30+</p>
            <p className="text-[10px] text-[var(--text-on-primary)]/80 font-bold uppercase tracking-wider">Common Job Profiles</p>
          </div>
          <div className="space-y-1">
            <p className="text-4xl font-heading font-extrabold text-[var(--text-on-primary)]">3</p>
            <p className="text-[10px] text-[var(--text-on-primary)]/80 font-bold uppercase tracking-wider">Assessor Styles</p>
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
              variant="glass"
              className="flex flex-col items-center text-center gap-4 p-6"
            >
              <div className="flex flex-col items-center gap-2">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-[var(--border)] shadow-md shrink-0">
                  <Image
                    src={persona.avatar}
                    alt={persona.name}
                    width={48}
                    height={48}
                    className="object-cover h-full w-full"
                  />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-[var(--text-primary)] text-sm">{persona.name}</h4>
                  <p className="text-[10px] text-[var(--text-secondary)]">{persona.role}</p>
                  <p className="text-[9px] text-[var(--primary)] font-medium tracking-wide uppercase font-mono">{persona.company}</p>
                </div>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed min-h-16 text-center">
                {persona.description}
              </p>
              <span className={`text-[10px] font-semibold text-[var(--secondary)] font-mono mt-auto text-center`}>
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
          className="text-center"
        />

        <div className="space-y-4">
          {faqItems.map((item, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div
                key={index}
                className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--shadow)] transition-all duration-300"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                  className="w-full p-5 flex items-center justify-center gap-4 text-center hover:bg-[var(--bg-surface-alt)] transition duration-200 cursor-pointer relative"
                >
                  <span className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] pr-6">{item.q}</span>
                  <span className="absolute right-5 top-1/2 -translate-y-1/2">
                    {isOpen ? <FaChevronUp className="text-[var(--text-secondary)] text-xs shrink-0" /> : <FaChevronDown className="text-[var(--text-secondary)] text-xs shrink-0" />}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs text-[var(--text-secondary)] leading-relaxed border-t border-[var(--border)] bg-[var(--bg-surface-alt)] text-center">
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
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-[var(--text-primary)]">
            Ready to practice?
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-xl mx-auto leading-relaxed">
            Set up takes about a minute. Upload your resume, pick a role, and start your first mock interview.
          </p>
          <Button
            onClick={() => router.push('/dashboard')}
            variant="primary"
            size="lg"
            icon={FaArrowRight}
          >
            Start Preparing Now
          </Button>
        </Card>
      </section>
    </div>
  );
}
