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
    Google: 'bg-primary-soft text-primary border-primary/25',
    Meta: 'bg-primary-soft text-primary border-primary/25',
    Amazon: 'bg-warning/15 text-warning border-warning/30',
    Stripe: 'bg-secondary/15 text-secondary border-secondary/30',
    Generic: 'bg-bg-surface-alt text-text-secondary border-border',
    Custom: 'bg-success/15 text-success border-success/30',
  };

  const currentBadgeClass = companyColorMap[activeMode.company] || companyColorMap.Generic;

  return (
    <Card variant="default" className="p-5 space-y-4 border border-border relative overflow-hidden bg-bg-surface shadow-soft">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <FaBrain className="text-primary text-sm" />
          <span className="text-xs font-mono font-bold text-text-secondary uppercase tracking-wider">
            Simulation Mode Preview
          </span>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${currentBadgeClass}`}>
          {activeMode.company} Preset
        </div>
      </div>

      {/* Primary Details Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-xl bg-bg-surface-alt border border-border space-y-1">
          <div className="flex items-center gap-1.5 text-text-secondary text-[10px]">
            <FaBuilding className="text-text-secondary" />
            <span>Target Company</span>
          </div>
          <p className="font-bold text-text-primary font-heading">{activeMode.company}</p>
        </div>

        <div className="p-2.5 rounded-xl bg-bg-surface-alt border border-border space-y-1">
          <div className="flex items-center gap-1.5 text-text-secondary text-[10px]">
            <FaUserTie className="text-text-secondary" />
            <span>Target Role</span>
          </div>
          <p className="font-bold text-text-primary font-heading truncate">{activeMode.role}</p>
        </div>

        <div className="p-2.5 rounded-xl bg-bg-surface-alt border border-border space-y-1">
          <div className="flex items-center gap-1.5 text-text-secondary text-[10px]">
            <FaBullseye className="text-text-secondary" />
            <span>Interview Track</span>
          </div>
          <p className="font-bold text-primary font-heading">{activeMode.interviewType}</p>
        </div>

        <div className="p-2.5 rounded-xl bg-bg-surface-alt border border-border space-y-1">
          <div className="flex items-center gap-1.5 text-text-secondary text-[10px]">
            <FaClock className="text-text-secondary" />
            <span>Difficulty & Duration</span>
          </div>
          <p className="font-bold text-text-primary font-heading">
            {activeMode.difficulty} &bull; {activeMode.duration}m
          </p>
        </div>
      </div>

      {/* Evaluated Skills Badges */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-[10px] font-mono text-text-secondary">
          <span>EVALUATED SKILLS & COMPETENCIES</span>
          <span className="text-primary font-bold">{activeMode.skillsEvaluated.length} Metrics</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {activeMode.skillsEvaluated.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-bg-surface-alt border border-border text-[10px] font-medium text-text-primary"
            >
              <FaCheckCircle className="text-success text-[9px]" />
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Rubric Weights Visual Bar */}
      <div className="space-y-1.5 pt-2 border-t border-border">
        <div className="flex items-center justify-between text-[9px] font-mono text-text-secondary uppercase">
          <span>Prometheus-2 Weighting Matrix</span>
          <span className="text-text-secondary">Tech {Math.round(activeMode.evaluationRubric.technicalWeight * 100)}% | Arch {Math.round(activeMode.evaluationRubric.architectureWeight * 100)}% | Comm {Math.round(activeMode.evaluationRubric.communicationWeight * 100)}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-border">
          <div
            className="h-full bg-primary"
            style={{ width: `${activeMode.evaluationRubric.technicalWeight * 100}%` }}
            title="Technical Accuracy"
          />
          <div
            className="h-full bg-primary-hover"
            style={{ width: `${activeMode.evaluationRubric.architectureWeight * 100}%` }}
            title="System Architecture"
          />
          <div
            className="h-full bg-secondary"
            style={{ width: `${activeMode.evaluationRubric.edgeCaseWeight * 100}%` }}
            title="Edge Case Awareness"
          />
          <div
            className="h-full bg-success"
            style={{ width: `${activeMode.evaluationRubric.communicationWeight * 100}%` }}
            title="Communication"
          />
        </div>
      </div>
    </Card>
  );
};
