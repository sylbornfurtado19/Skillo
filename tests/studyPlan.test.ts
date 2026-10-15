import type { CandidateSkillMemoryStore } from '../src/types';
import { generateStudyPlan } from '../src/lib/services/studyPlan';

const store = (nodes: CandidateSkillMemoryStore['nodes']): CandidateSkillMemoryStore => ({
  userId: 'user-1',
  nodes,
  globalReflectionSummary: '',
});

const node = (skillId: string, proficiencyLevel: 'NOVICE' | 'DEVELOPING' | 'PROFICIENT' | 'MASTERED', severity: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW') => ({
  skillId,
  skillName: skillId,
  proficiencyLevel,
  attemptsCount: 1,
  reflections: [{
    id: `reflection-${skillId}`,
    sessionId: 'session-1',
    skillTag: skillId,
    timestamp: '2026-01-01T00:00:00.000Z',
    mistakeSummary: 'missed concept',
    rootCauseAnalysis: 'insufficient practice',
    actionableRemediation: `Practice ${skillId}`,
    severity,
  }],
  persistentDeficiencies: [],
  remediationProgress: 0,
  lastUpdated: '2026-01-01T00:00:00.000Z',
});

describe('generateStudyPlan', () => {
  it('orders high-severity and novice skills first while respecting prerequisites', () => {
    const plan = generateStudyPlan(store({
      dependent: node('dependent', 'NOVICE', 'HIGH'),
      prerequisite: node('prerequisite', 'PROFICIENT', 'LOW'),
      other: node('other', 'NOVICE', 'HIGH'),
    }), [{ skillId: 'dependent', prerequisiteSkillIds: ['prerequisite'] }], new Date('2026-01-01T12:00:00Z'));

    expect(plan[0].tasks.map((task) => task.skillId)).toEqual(['other']);
    expect(plan[1].tasks.map((task) => task.skillId)).toEqual(['prerequisite']);
    expect(plan[2].tasks.map((task) => task.skillId)).toEqual(['other', 'dependent']);
    expect(plan.findIndex((day) => day.tasks.some((task) => task.skillId === 'prerequisite')))
      .toBeLessThan(plan.findIndex((day) => day.tasks.some((task) => task.skillId === 'dependent')));
    expect(plan.every((day) => day.tasks.reduce((minutes, task) => minutes + task.minutes, 0) <= 45)).toBe(true);
  });

  it('schedules repetitions on days 1, 3, and 7 for novice skills', () => {
    const plan = generateStudyPlan(store({ algorithms: node('algorithms', 'NOVICE') }), [], new Date('2026-01-01T12:00:00Z'));
    expect(plan.flatMap((day) => day.tasks.map((task, index) => ({ day: day.date, task, index }))).filter(({ task }) => task.skillId === 'algorithms').map(({ day }) => day))
      .toEqual(['2026-01-01', '2026-01-03', '2026-01-07']);
  });

  it('returns seven empty dated days for an empty store', () => {
    const plan = generateStudyPlan(store({}), [], new Date('2026-01-01T12:00:00Z'));
    expect(plan).toHaveLength(7);
    expect(plan.every((day) => day.tasks.length === 0)).toBe(true);
  });
});
