import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaUpload, 
  FaMicrophone, 
  FaChartBar, 
  FaArrowRight, 
  FaCode, 
  FaRobot, 
  FaUserTie, 
  FaCheckCircle, 
  FaLaptopCode,
  FaChevronDown,
  FaChevronUp,
  FaSlidersH,
  FaFileAlt,
  FaBrain,
  FaChartLine
} from 'react-icons/fa';
import { LogoIcon } from '../components/common/Logo';
import { INTERVIEWER_PERSONAS } from '../services/interviewApi';
import { CAREER_DOMAINS } from '../services/careerApi';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/FeedbackHelpers';

export default function Landing() {
  const navigate = useNavigate();
  const [demoInput, setDemoInput] = useState('');
  const [demoEvaluating, setDemoEvaluating] = useState(false);
  const [demoFeedback, setDemoFeedback] = useState(null);
  
  // Domains tracking state
  const [selectedDomain, setSelectedDomain] = useState('Computer Science');
  
  // FAQ state
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  const handleDemoSubmit = (e) => {
    e.preventDefault();
    if (!demoInput.trim()) return;

    setDemoEvaluating(true);
    setDemoFeedback(null);

    setTimeout(() => {
      setDemoEvaluating(false);
      setDemoFeedback({
        score: 88,
        strengths: 'Excellent conceptual separation. Correctly detailed value-caching vs. function-instance-caching.',
        improvements: 'Mention React 19 compiler automatic memoization optimizations to display cutting edge industry insight.',
      });
    }, 2000);
  };

  const handleDemoFill = () => {
    setDemoInput(
      'useMemo caches the returned value of an expensive calculation, while useCallback caches the actual function instance between renders to prevent breaking child reference checks.'
    );
  };

  const faqItems = [
    {
      q: 'How does the resume analysis work?',
      a: 'You upload a PDF, enter a job title and description, and the app compares your skills against what the role asks for. It shows what matches, what\'s missing, and how to improve your resume.'
    },
    {
      q: 'Are the questions customized?',
      a: 'Yes. Questions change based on the domain, role, and difficulty you select. Technical, behavioral, and system design tracks each have their own question sets.'
    },
    {
      q: 'Can I practice behavioral and system design questions?',
      a: 'Yes — there are separate tracks for technical questions, behavioral (STAR method), and system design. You can also do a mixed session.'
    },
    {
      q: 'Is there a backend I can connect?',
      a: 'The project ships with a FastAPI backend scaffold. You can run it locally and swap the front-end mock services to hit the real API. Check the backend/ folder in the repo.'
    }
  ];

  return (
    <div className="space-y-28 py-8">
      {/* 1. Hero Section */}
      <section className="relative flex flex-col items-center text-center max-w-4xl mx-auto pt-10 px-4">
        {/* Glow Tag */}
        <Badge variant="primary" size="md" className="mb-6 animate-pulse">
          <span className="h-1.5 w-1.5 rounded-full bg-accent mr-1.5 inline-block"></span>
          Open Source &middot; Free to Use
        </Badge>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="font-heading font-extrabold text-4xl sm:text-6xl tracking-tight text-white leading-tight"
        >
           Practice interviews that actually{' '}
          <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            prepare you
          </span>
        </motion.h1>

        {/* Subhead */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-base sm:text-lg text-gray-400 mt-6 max-w-2xl leading-relaxed mx-auto text-center"
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
            onClick={() => navigate('/app/dashboard')}
            variant="primary"
            size="lg"
            className="w-full sm:w-auto"
            icon={FaArrowRight}
          >
            Start Preparing Now
          </Button>
          <a
            href="#features"
            className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition duration-200 flex items-center justify-center font-semibold text-base"
          >
            See Features
          </a>
        </motion.div>
      </section>

      {/* 2. Capability Features & Performance Flows */}
      <section id="features" className="space-y-28 px-4 max-w-6xl mx-auto scroll-mt-24">
        {/* PART 1 — "How It Works" Flow */}
        <motion.div 
          id="how-it-works"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="space-y-12 scroll-mt-28"
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
                <div key={idx} className="relative flex flex-col md:flex-row items-center w-full">
                  <Card variant="glass" className="p-5 flex-1 h-full text-center flex flex-col items-center justify-between border border-white/5 relative z-10 w-full">
                    <div className="flex flex-col items-center">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-sm mb-3.5 shadow-lg shadow-primary/10 mx-auto">
                        <IconComp />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-primary uppercase block mb-1">{item.step}</span>
                      <h4 className="font-heading font-bold text-sm text-white mb-1.5">{item.title}</h4>
                      <p className="text-xs text-gray-400 leading-normal">{item.desc}</p>
                    </div>
                  </Card>
                  {idx < 3 && (
                    <div className="hidden md:flex absolute -right-5 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-[#111827] border border-white/5 items-center justify-center text-gray-500 text-xs shadow-md">
                      <FaArrowRight />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* PART 2 — Feature Highlights Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="space-y-12"
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
                colorClass: 'text-accent',
                borderClass: 'border-t-2 border-t-accent',
                bgClass: 'bg-accent/5'
              },
              {
                title: 'Interviewer Personas',
                icon: FaUserTie,
                desc: 'Train with different styles to build comfort for any situation.',
                colorClass: 'text-secondary',
                borderClass: 'border-t-2 border-t-secondary',
                bgClass: 'bg-secondary/5'
              },
              {
                title: 'Domain Focus',
                icon: FaBrain,
                desc: 'Questions customized for your specific technical field.',
                colorClass: 'text-primary',
                borderClass: 'border-t-2 border-t-primary',
                bgClass: 'bg-primary/5'
              },
              {
                title: 'Growth Analytics',
                icon: FaChartLine,
                desc: 'See exactly where you stand and what to practice next.',
                colorClass: 'text-emerald-400',
                borderClass: 'border-t-2 border-t-emerald-500',
                bgClass: 'bg-emerald-500/5'
              }
            ].map((f, idx) => {
              const IconComp = f.icon;
              return (
                <Card key={idx} variant="glass" className={`p-6 text-center ${f.borderClass} ${f.bgClass} flex flex-col items-center justify-center gap-3`}>
                  <div className={`h-10 w-10 rounded-xl bg-[#030712]/60 border border-white/5 flex items-center justify-center shrink-0 text-sm ${f.colorClass}`}>
                    <IconComp />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-heading font-bold text-sm text-white">{f.title}</h4>
                    <p className="text-xs text-gray-400 leading-relaxed max-w-sm mx-auto">{f.desc}</p>
                  </div>
                </Card>
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
          <Card variant="solid" className="p-8 border border-white/5 bg-[#111827]/30">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center text-center">
              {/* Left Side */}
              <div className="space-y-4 flex flex-col items-center">
                <span className="text-[10px] text-primary font-mono font-bold uppercase tracking-wider block">
                  SAMPLE FEEDBACK
                </span>
                <h3 className="text-xl sm:text-2xl font-heading font-extrabold text-white leading-tight">
                  Clear, honest evaluation
                </h3>
                <p className="text-xs sm:text-sm text-gray-400 leading-relaxed max-w-md mx-auto">
                  Every session generates a private performance breakdown, scoring your clarity and confidence.
                </p>
                <div className="pt-2 flex justify-center w-full">
                  <Button
                    onClick={() => navigate('/login')}
                    variant="primary"
                    size="sm"
                    icon={FaArrowRight}
                  >
                    Get Your First Score
                  </Button>
                </div>
              </div>

              {/* Right Side */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-8 bg-[#030712]/40 rounded-2xl p-6 border border-white/5">
                {/* SVG Score Circle */}
                <div className="relative h-32 w-32 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="50"
                      stroke="rgba(255, 255, 255, 0.03)"
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
                        <stop offset="0%" stopColor="#6366F1" />
                        <stop offset="50%" stopColor="#8B5CF6" />
                        <stop offset="100%" stopColor="#06B6D4" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-heading font-extrabold text-white">87</span>
                    <span className="text-[9px] text-gray-500 font-mono font-bold uppercase">Average</span>
                  </div>
                </div>

                {/* Mini Stat Pills */}
                <div className="grid grid-cols-2 gap-3 w-full sm:w-auto">
                  {[
                    { label: 'Tech Depth', val: '91%', color: 'text-primary border-primary/20 bg-primary/5' },
                    { label: 'Delivery', val: '85%', color: 'text-secondary border-secondary/20 bg-secondary/5' },
                    { label: 'Confidence', val: '78%', color: 'text-accent border-accent/20 bg-accent/5' },
                    { label: 'Logic', val: '88%', color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' },
                  ].map((item, idx) => (
                    <div key={idx} className={`px-3 py-2 rounded-xl border flex flex-col items-center justify-center text-center min-w-[120px] ${item.color}`}>
                      <span className="text-[9px] font-mono text-gray-500 font-bold uppercase">{item.label}</span>
                      <span className="text-sm font-heading font-extrabold mt-0.5">{item.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </section>

      {/* 4. Supported Domains (Interactive V1 Directory) */}
      <section id="domains" className="space-y-12 px-4 max-w-6xl mx-auto scroll-mt-24">
        <SectionHeader           title="Supported Career Domains"
            description="Pick the field you're interviewing for. Questions and roles adjust automatically."
          className="text-center max-w-2xl mx-auto"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Domains selector */}
          <div className="space-y-3 lg:col-span-1 text-center">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-2 text-center">Select Domain</span>
            {Object.keys(CAREER_DOMAINS).map((domain) => (
              <button
                key={domain}
                onClick={() => setSelectedDomain(domain)}
                className={`w-full p-4 rounded-xl border text-center font-heading font-bold text-sm transition duration-200 flex items-center justify-center gap-2.5 cursor-pointer ${
                  selectedDomain === domain 
                    ? 'border-primary bg-primary/10 text-white shadow-lg shadow-primary/5' 
                    : 'border-white/5 bg-[#111827]/40 text-gray-400 hover:border-white/10 hover:text-white'
                }`}
              >
                <span>{domain}</span>
                <FaArrowRight size={10} className={`${selectedDomain === domain ? 'translate-x-1' : 'opacity-0'} transition duration-200`} />
              </button>
            ))}
          </div>

          {/* Roles list */}
          <div className="lg:col-span-2 text-center">
            <Card variant="solid" className="h-full flex flex-col justify-between items-center text-center">
              <div className="w-full">
                <div className="flex flex-col sm:flex-row justify-center items-center gap-2 border-b border-white/5 pb-3 mb-6">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Available Roles ({selectedDomain})</span>
                  <Badge variant="secondary">Verified Roles</Badge>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  {CAREER_DOMAINS[selectedDomain].map((role) => (
                    <div 
                      key={role} 
                      className="flex flex-col sm:flex-row items-center justify-center text-center gap-2.5 p-3 rounded-xl bg-white/2 border border-white/5 hover:border-white/10 transition duration-200"
                    >
                      <div className="h-2 w-2 rounded-full bg-accent shrink-0" />
                      <span className="text-xs font-semibold text-white">{role}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-white/5 flex flex-col items-center text-center gap-4 w-full">
                <p className="text-[11px] text-gray-500">
                  Selecting a domain automatically filters available roles on the setup page.
                </p>
                <Button 
                  onClick={() => navigate('/app/setup')}
                  variant="accent" 
                  size="sm"
                >
                  Configure This Domain
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>



      {/* 6. Platform Highlights */}
      <section className="bg-gradient-to-r from-primary/5 via-[#030712] to-accent/5 border-y border-white/5 py-16 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          <div className="space-y-1">
            <p className="text-4xl font-heading font-extrabold text-white">5</p>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Industry Domains</p>
          </div>
          <div className="space-y-1">
            <p className="text-4xl font-heading font-extrabold text-white">30+</p>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Common Job Profiles</p>
          </div>
          <div className="space-y-1">
            <p className="text-4xl font-heading font-extrabold text-white">3</p>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Assessor Styles</p>
          </div>
        </div>
      </section>

      {/* 7. AI Assessor Personas */}
      <section className="space-y-12 bg-[#111827]/25 rounded-3xl border border-white/5 p-8 md:p-12 max-w-6xl mx-auto px-4">
        <SectionHeader            title="Pick your interviewer"
            description="Each one asks questions differently — practice with all three to cover your bases."
          className="text-center max-w-2xl mx-auto"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.values(INTERVIEWER_PERSONAS).map((persona) => (
            <Card
              key={persona.id}
              variant={persona.id === 'sarah' ? 'glow-primary' : persona.id === 'david' ? 'glow-secondary' : 'glow-accent'}
              className="flex flex-col items-center text-center gap-4 p-6"
            >
              <div className="flex flex-col items-center gap-2">
                <img
                  src={persona.avatar}
                  alt={persona.name}
                  className="w-12 h-12 rounded-xl object-cover border border-white/10 shadow-lg"
                />
                <div>
                  <h4 className="font-heading font-bold text-white text-sm">{persona.name}</h4>
                  <p className="text-[10px] text-gray-400">{persona.role}</p>
                  <p className="text-[9px] text-primary font-medium tracking-wide uppercase font-mono">{persona.company}</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed min-h-16 text-center">
                {persona.description}
              </p>
              <span className={`text-[10px] font-semibold ${persona.accentColor} font-mono mt-auto text-center`}>
                &bull; {persona.id === 'sarah' ? 'Encouraging Review' : persona.id === 'david' ? 'Pragmatic Leadership' : 'Strict Compliance'}
              </span>
            </Card>
          ))}
        </div>
      </section>



      {/* 9. FAQ Section */}
      <section className="space-y-12 px-4 max-w-3xl mx-auto">
        <SectionHeader            title="Frequently Asked Questions"
            description=""
          className="text-center"
        />

        <div className="space-y-4">
          {faqItems.map((item, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div 
                key={index} 
                className="bg-[#111827]/40 border border-white/5 rounded-2xl overflow-hidden transition-all duration-300 animate-fade"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                  className="w-full p-5 flex items-center justify-center gap-4 text-center hover:bg-white/[0.01] transition duration-200 cursor-pointer relative"
                >
                  <span className="text-xs sm:text-sm font-semibold text-white pr-6">{item.q}</span>
                  <span className="absolute right-5 top-1/2 -translate-y-1/2">
                    {isOpen ? <FaChevronUp className="text-gray-500 text-xs shrink-0" /> : <FaChevronDown className="text-gray-500 text-xs shrink-0" />}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs text-gray-400 leading-relaxed border-t border-white/5 bg-[#030712]/10 text-center">
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
        <Card variant="glow-secondary" className="p-8 sm:p-12 text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-white">
            Ready to practice?
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 max-w-xl mx-auto leading-relaxed">
            Set up takes about a minute. Upload your resume, pick a role, and start your first mock interview.
          </p>
          <Button
            onClick={() => navigate('/app/dashboard')}
            variant="secondary"
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
