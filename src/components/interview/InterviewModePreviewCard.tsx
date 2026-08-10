import React from 'react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { resolveInterviewMode } from '@/types/interviewModes';
import {
  FaBuilding,
  FaUserTie,
  FaClock,
  FaChartLine,
  FaCheckCircle,
  FaBrain,
  FaBullseye,
} from 'react-icons/fa';

interface InterviewModePreviewCardProps {
  setupData: {
    company?: string;
    role?: string;
    type?: string;
    difficulty?: string;
    duration?: number;
    interviewModeId?: string;
  };
}

export const InterviewModePreviewCard: React.FC<InterviewModePreviewCardProps> = ({ setupData }) => {
  const activeMode = resolveInterviewMode({
    company: setupData.company,
    role: setupData.role,
    interviewType: setupData.type,
    difficulty: setupData.difficulty,
    duration: setupData.duration,
    interviewModeId: setupData.interviewModeId,
  });

  const companyColorMap: Record<string, string> = {
    Google: 'from-blue-500/20 to-emerald-500/20 text-blue-400 border-blue-500/30',
    Meta: 'from-blue-600/20 to-indigo-600/20 text-indigo-400 border-indigo-500/30',
    Amazon: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30',
    Stripe: 'from-violet-500/20 to-purple-500/20 text-violet-400 border-violet-500/30',
    Generic: 'from-gray-500/20 to-slate-500/20 text-gray-300 border-gray-500/30',
    Custom: 'from-emerald-500/20 to-teal-500/20 text-teal-400 border-teal-500/30',
  };

  const currentBadgeClass = companyColorMap[activeMode.company] || companyColorMap.Generic;

  return (
    <Card variant="glass" className="p-5 space-y-4 border border-white/10 relative overflow-hidden bg-[#0B0F19]/90">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <FaBrain className="text-primary text-sm" />
          <span className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider">
            Simulation Mode Preview
          </span>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border bg-gradient-to-r ${currentBadgeClass}`}>
          {activeMode.company} Preset
        </div>
      </div>

      {/* Primary Details Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
          <div className="flex items-center gap-1.5 text-gray-400 text-[10px]">
            <FaBuilding className="text-gray-500" />
            <span>Target Company</span>
          </div>
          <p className="font-bold text-white font-heading">{activeMode.company}</p>
        </div>

        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
          <div className="flex items-center gap-1.5 text-gray-400 text-[10px]">
            <FaUserTie className="text-gray-500" />
            <span>Target Role</span>
          </div>
          <p className="font-bold text-white font-heading truncate">{activeMode.role}</p>
        </div>

        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
          <div className="flex items-center gap-1.5 text-gray-400 text-[10px]">
            <FaBullseye className="text-gray-500" />
            <span>Interview Track</span>
          </div>
          <p className="font-bold text-primary font-heading">{activeMode.interviewType}</p>
        </div>

        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
          <div className="flex items-center gap-1.5 text-gray-400 text-[10px]">
            <FaClock className="text-gray-500" />
            <span>Difficulty & Duration</span>
          </div>
          <p className="font-bold text-white font-heading">
            {activeMode.difficulty} &bull; {activeMode.duration}m
          </p>
        </div>
      </div>

      {/* Evaluated Skills Badges */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-[10px] font-mono text-gray-400">
          <span>EVALUATED SKILLS & COMPETENCIES</span>
          <span className="text-primary font-bold">{activeMode.skillsEvaluated.length} Metrics</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {activeMode.skillsEvaluated.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-medium text-gray-300"
            >
              <FaCheckCircle className="text-emerald-400 text-[9px]" />
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Rubric Weights Visual Bar */}
      <div className="space-y-1.5 pt-2 border-t border-white/5">
        <div className="flex items-center justify-between text-[9px] font-mono text-gray-400 uppercase">
          <span>Prometheus-2 Weighting Matrix</span>
          <span className="text-gray-500">Tech {Math.round(activeMode.evaluationRubric.technicalWeight * 100)}% | Arch {Math.round(activeMode.evaluationRubric.architectureWeight * 100)}% | Comm {Math.round(activeMode.evaluationRubric.communicationWeight * 100)}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-white/5">
          <div
            className="h-full bg-indigo-500"
            style={{ width: `${activeMode.evaluationRubric.technicalWeight * 100}%` }}
            title="Technical Accuracy"
          />
          <div
            className="h-full bg-violet-500"
            style={{ width: `${activeMode.evaluationRubric.architectureWeight * 100}%` }}
            title="System Architecture"
          />
          <div
            className="h-full bg-cyan-500"
            style={{ width: `${activeMode.evaluationRubric.edgeCaseWeight * 100}%` }}
            title="Edge Case Awareness"
          />
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${activeMode.evaluationRubric.communicationWeight * 100}%` }}
            title="Communication"
          />
        </div>
      </div>
    </Card>
  );
};
