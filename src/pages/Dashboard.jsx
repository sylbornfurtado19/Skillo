import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FaPlay, 
  FaUpload, 
  FaArrowRight, 
  FaCheckCircle, 
  FaUserTie, 
  FaFileAlt, 
  FaSlidersH,
  FaCalendarCheck,
  FaAward,
  FaChartLine,
  FaLightbulb
} from 'react-icons/fa';
import { useInterview } from '../context/InterviewContext';
import { INTERVIEWER_PERSONAS } from '../services/interviewApi';

// ChartJS imports
import { Radar, Line } from 'react-chartjs-2';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/FeedbackHelpers';
import { Progress } from '../components/ui/Loader';

export default function Dashboard() {
  const navigate = useNavigate();
  const { resumeData, analysisResult, results, setupData, sessionHistory } = useInterview();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const finalHistory = sessionHistory || [];

  const totalCompleted = finalHistory.length;
  const averageScore = totalCompleted > 0 ? Math.round(finalHistory.reduce((sum, h) => sum + h.score, 0) / totalCompleted) : 0;
  const highestScore = totalCompleted > 0 ? Math.max(...finalHistory.map(h => h.score)) : 0;

  // Readiness calculation: baseAverage + delta based on resume presence
  const resumeScore = analysisResult ? analysisResult.matchPercentage : 0;
  const readinessIndex = Math.round(averageScore * 0.7 + (resumeScore || 60) * 0.3);

  // Line chart: progression
  const lineChartData = {
    labels: totalCompleted > 0 ? [...finalHistory].reverse().map(h => h.date) : ['No Data'],
    datasets: [
      {
        label: 'Assessment Score',
        data: totalCompleted > 0 ? [...finalHistory].reverse().map(h => h.score) : [0],
        borderColor: '#6366F1',
        backgroundColor: 'rgba(99, 102, 241, 0.05)',
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#06B6D4',
        pointBorderColor: '#fff',
        pointHoverRadius: 6,
      }
    ]
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111827',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
      }
    },
    scales: {
      y: {
        min: 50,
        max: 100,
        grid: { color: 'rgba(255, 255, 255, 0.02)' },
        ticks: { color: '#94A3B8', font: { family: 'Inter', size: 10 } }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#94A3B8', font: { family: 'Inter', size: 10 } }
      }
    }
  };

  // Skills radar chart
  const radarChartData = {
    labels: ['Technical Accuracy', 'Communication', 'Depth & Logic', 'Time Management'],
    datasets: [
      {
        label: 'Competencies',
        data: results ? [
          results.categories.technicalAccuracy,
          results.categories.communication,
          results.categories.depth,
          results.categories.timeManagement
        ] : [80, 84, 75, 88],
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        borderColor: '#8B5CF6',
        borderWidth: 2,
        pointBackgroundColor: '#06B6D4',
        pointBorderWidth: 1,
      }
    ]
  };

  const radarChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      r: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        angleLines: { color: 'rgba(255, 255, 255, 0.04)' },
        pointLabels: { color: '#94A3B8', font: { family: 'Inter', size: 9, weight: 'bold' } },
        ticks: { display: false, stepSize: 20 },
        min: 0,
        max: 100
      }
    }
  };

  // AI Suggestions list
  const suggestions = [
    `Quantify engineering results on your resume to boost the Job Match index.`,
    `Spend more time discussing edge cases in high-concurrency Backend pipelines.`,
    `Review system design schemas for distributed notification clusters.`
  ];

  return (
    <div className="space-y-8 pb-10 text-left">
      
      {/* 1. Welcome Hero */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gradient-to-r from-primary/5 to-secondary/5 border border-white/5 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
        
        <div>
          <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-white">Welcome back, Alex!</h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Track metrics and prepare for assessments in your workspace.
          </p>
        </div>

        <div className="flex gap-3 shrink-0">
          <Button 
            onClick={() => navigate('/app/setup')}
            variant="primary"
            size="sm"
            icon={FaPlay}
          >
            Practice Session
          </Button>
          <Button 
            onClick={() => navigate('/app/resume')}
            variant="glass"
            size="sm"
            icon={FaUpload}
          >
            Update Resume
          </Button>
        </div>
      </div>

      {/* 2. KPI Summary Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Completed */}
        <Card variant="glass" className="p-5 flex items-center gap-4">
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-lg sm:text-xl shrink-0">
            <FaCalendarCheck />
          </div>
          <div>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono font-bold">Completed</span>
            {loading ? (
              <div className="h-6 w-12 bg-white/5 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-xl sm:text-2xl font-heading font-extrabold text-white mt-0.5">{totalCompleted}</p>
            )}
          </div>
        </Card>

        {/* Average Score */}
        <Card variant="glass" className="p-5 flex items-center gap-4">
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-secondary/10 border border-secondary/20 flex items-center justify-center text-secondary text-lg sm:text-xl shrink-0">
            <FaAward />
          </div>
          <div>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono font-bold">Avg Index</span>
            {loading ? (
              <div className="h-6 w-16 bg-white/5 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-xl sm:text-2xl font-heading font-extrabold text-white mt-0.5">{averageScore}%</p>
            )}
          </div>
        </Card>

        {/* Resume Health Score */}
        <Card variant="glass" className="p-5 flex items-center gap-4">
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent text-lg sm:text-xl shrink-0">
            <FaFileAlt />
          </div>
          <div>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono font-bold">Resume Health</span>
            {loading ? (
              <div className="h-6 w-16 bg-white/5 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-xl sm:text-2xl font-heading font-extrabold text-white mt-0.5">{resumeScore ? `${resumeScore}%` : 'Unrated'}</p>
            )}
          </div>
        </Card>

        {/* Readiness index */}
        <Card variant="glass" className="p-5 flex items-center gap-4">
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg sm:text-xl shrink-0">
            <FaChartLine />
          </div>
          <div>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono font-bold">Readiness Index</span>
            {loading ? (
              <div className="h-6 w-16 bg-white/5 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-xl sm:text-2xl font-heading font-extrabold text-emerald-400 mt-0.5">{readinessIndex}%</p>
            )}
          </div>
        </Card>
      </div>

      {/* Career Profile Details HUD */}
      <Card variant="solid" className="p-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Target Career Profile</span>
            <h3 className="text-base font-heading font-bold text-white flex items-center gap-2">
              <span>{setupData.role}</span>
              <Badge variant="accent" size="sm">{setupData.domain}</Badge>
            </h3>
          </div>

          <div className="flex gap-4 text-xs font-mono text-gray-400">
            <div>
              <span className="text-gray-500 block text-[9px] uppercase font-bold">Seniority</span>
              <span className="text-white font-semibold">{setupData.experienceLevel}</span>
            </div>
            <div className="border-l border-white/5 pl-4">
              <span className="text-gray-500 block text-[9px] uppercase font-bold">Focus Track</span>
              <span className="text-white font-semibold">{setupData.type}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Performance Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Chart */}
        <Card variant="glass" className="lg:col-span-2 flex flex-col justify-between h-[340px]">
          <div className="mb-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Score Progression</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">Evaluation performance trends over time.</p>
          </div>
          <div className="flex-1 relative min-h-0">
            <Line data={lineChartData} options={lineChartOptions} />
          </div>
        </Card>

        {/* Radar Chart */}
        <Card variant="glass" className="flex flex-col justify-between h-[340px]">
          <div className="mb-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Skills Distribution</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">Evaluated weights across core dimensions.</p>
          </div>
          <div className="flex-1 relative min-h-0">
            <Radar data={radarChartData} options={radarChartOptions} />
          </div>
        </Card>
      </div>

      {/* 4. Recent Session Log & AI Suggestions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Session Log */}
        <Card variant="glass" className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Recent Assessments</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">Historical session logs and marks.</p>
            </div>
            <Button
              onClick={() => navigate('/app/setup')}
              variant="ghost"
              size="sm"
            >
              <span>New Session</span>
              <FaArrowRight size={10} className="ml-1" />
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-gray-500">
                  <th className="py-2.5 font-semibold">Date</th>
                  <th className="py-2.5 font-semibold">Role Profile</th>
                  <th className="py-2.5 font-semibold">Type</th>
                  <th className="py-2.5 font-semibold text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {loading ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <tr key={idx} className="border-b border-white/5">
                      <td className="py-3"><div className="h-3 bg-white/5 rounded animate-pulse w-12" /></td>
                      <td className="py-3"><div className="h-3 bg-white/5 rounded animate-pulse w-32" /></td>
                      <td className="py-3"><div className="h-3 bg-white/5 rounded animate-pulse w-16" /></td>
                      <td className="py-3 text-right"><div className="h-3 bg-white/5 rounded animate-pulse w-8 ml-auto" /></td>
                    </tr>
                  ))
                ) : finalHistory.length > 0 ? (
                  finalHistory.map((h) => (
                    <tr key={h.id} className="hover:bg-white/2 transition">
                      <td className="py-3 font-mono text-[10px] text-gray-400">{h.date}</td>
                      <td className="py-3 font-medium text-white">{h.role} <span className="text-[10px] text-gray-500">({h.difficulty})</span></td>
                      <td className="py-3">{h.type}</td>
                      <td className="py-3 text-right">
                        <Badge variant={h.score >= 80 ? 'success' : 'primary'} size="sm">
                          {h.score}%
                        </Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="py-6 text-center text-gray-500 font-mono text-[11px]">
                      No historical sessions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* AI Suggestions Box */}
        <Card variant="glass" className="space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider pb-2 border-b border-white/5 mb-4 flex items-center gap-2">
              <FaLightbulb className="text-secondary" />
              <span>AI Preparation Suggestions</span>
            </h3>

            <div className="space-y-3.5 text-xs text-gray-300">
              {suggestions.map((sug, idx) => (
                <div key={idx} className="flex gap-2.5 items-start leading-relaxed bg-[#030712]/30 border border-white/5 p-3 rounded-xl">
                  <span className="h-4 w-4 bg-[#111827] border border-white/10 text-primary text-[10px] rounded-full flex items-center justify-center shrink-0 font-bold font-mono">
                    {idx + 1}
                  </span>
                  <p className="text-gray-400">{sug}</p>
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={() => navigate('/app/resume')}
            variant="secondary"
            size="sm"
            className="w-full mt-4"
          >
            Optimize Resume Profile
          </Button>
        </Card>
      </div>

    </div>
  );
}
