import type {
  CandidateSkillMemoryStore,
  GraphEntity,
  PrerequisiteGapChain,
  SkillMemoryNode,
} from '@/types/index';

export type StudyPlanTaskType = 'LEARN' | 'REVIEW';

export interface StudyPlanTask {
  skillId: string;
  skillName: string;
  taskType: StudyPlanTaskType;
  focus: string;
  minutes: number;
}

export interface StudyPlanDay {
  date: string;
  tasks: StudyPlanTask[];
}

export interface StudyPlanPrerequisiteChain {
  skillId: string;
  prerequisiteSkillIds: string[];
}

export type StudyPlanPrerequisite =
  | StudyPlanPrerequisiteChain
  | Pick<GraphEntity, 'id' | 'name' | 'prerequisites'>
  | Pick<PrerequisiteGapChain, 'blockedCapability' | 'remediationPath'>;

const DAY_OFFSETS_BY_LEVEL: Record<SkillMemoryNode['proficiencyLevel'], readonly number[]> = {
  NOVICE: [0, 2, 6],
  DEVELOPING: [0, 2, 6],
  PROFICIENT: [0, 6],
  MASTERED: [0],
};

const SEVERITY_WEIGHT = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
const INITIAL_MINUTES = 30;
const REVIEW_MINUTES = 15;
const MAX_MINUTES_PER_DAY = 45;

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function prerequisitePairs(
  prerequisites: readonly StudyPlanPrerequisite[],
  nodes: readonly SkillMemoryNode[]
): Array<[string, string]> {
  const idByName = new Map(nodes.map((node) => [normalize(node.skillName), node.skillId]));
  const pairs: Array<[string, string]> = [];

  for (const prerequisite of prerequisites) {
    if ('skillId' in prerequisite) {
      for (const prerequisiteId of prerequisite.prerequisiteSkillIds) {
        pairs.push([prerequisiteId, prerequisite.skillId]);
      }
      continue;
    }

    if ('remediationPath' in prerequisite) {
      const path = prerequisite.remediationPath;
      const dependentId = idByName.get(normalize(prerequisite.blockedCapability)) ?? prerequisite.blockedCapability;
      for (let index = 0; index < path.length; index += 1) {
        const prerequisiteId = idByName.get(normalize(path[index])) ?? path[index];
        pairs.push([prerequisiteId, index === path.length - 1 ? dependentId : (idByName.get(normalize(path[index + 1])) ?? path[index + 1])]);
      }
      continue;
    }

    if ('id' in prerequisite) {
      const dependentId = prerequisite.id;
      for (const prerequisiteName of prerequisite.prerequisites ?? []) {
        const prerequisiteId = idByName.get(normalize(prerequisiteName)) ?? prerequisiteName;
        pairs.push([prerequisiteId, dependentId]);
      }
      continue;
    }
  }

  return pairs;
}

function orderedNodes(
  nodes: readonly SkillMemoryNode[],
  prerequisites: readonly StudyPlanPrerequisite[]
): SkillMemoryNode[] {
  const byId = new Map(nodes.map((node) => [node.skillId, node]));
  const dependencies = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();

  for (const node of nodes) {
    dependencies.set(node.skillId, new Set());
    dependents.set(node.skillId, new Set());
  }
  for (const [prerequisiteId, dependentId] of prerequisitePairs(prerequisites, nodes)) {
    if (byId.has(prerequisiteId) && byId.has(dependentId) && prerequisiteId !== dependentId) {
      dependencies.get(dependentId)?.add(prerequisiteId);
      dependents.get(prerequisiteId)?.add(dependentId);
    }
  }

  const remaining = new Set(nodes.map((node) => node.skillId));
  const result: SkillMemoryNode[] = [];
  const priority = (node: SkillMemoryNode): [number, number, string] => [
    SEVERITY_WEIGHT[node.reflections.reduce((highest, reflection) => (
      SEVERITY_WEIGHT[reflection.severity] < SEVERITY_WEIGHT[highest] ? reflection.severity : highest
    ), 'LOW' as keyof typeof SEVERITY_WEIGHT)],
    node.proficiencyLevel === 'NOVICE' ? 0 : 1,
    node.skillId,
  ];

  while (remaining.size > 0) {
    const available = nodes
      .filter((node) => remaining.has(node.skillId))
      .filter((node) => [...(dependencies.get(node.skillId) ?? [])].every((id) => !remaining.has(id)))
      .sort((left, right) => {
        const a = priority(left);
        const b = priority(right);
        return a[0] - b[0] || a[1] - b[1] || a[2].localeCompare(b[2]);
      });
    const next = available[0] ?? nodes.filter((node) => remaining.has(node.skillId)).sort((left, right) => left.skillId.localeCompare(right.skillId))[0];
    result.push(next);
    remaining.delete(next.skillId);
    for (const dependent of dependents.get(next.skillId) ?? []) {
      dependencies.get(dependent)?.delete(next.skillId);
    }
  }
  return result;
}

function focusFor(node: SkillMemoryNode, taskType: StudyPlanTaskType): string {
  if (taskType === 'REVIEW') return `Recall and apply ${node.skillName}.`;
  return node.persistentDeficiencies[0]
    ?? node.reflections.find((reflection) => reflection.actionableRemediation)?.actionableRemediation
    ?? `Build a working understanding of ${node.skillName}.`;
}

export function generateStudyPlan(
  store: CandidateSkillMemoryStore,
  prerequisiteChains: readonly StudyPlanPrerequisite[] = [],
  startDate: Date = new Date()
): StudyPlanDay[] {
  const days: StudyPlanDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startDate);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() + index);
    return { date: date.toISOString().slice(0, 10), tasks: [] };
  });
  const nodes = orderedNodes(Object.values(store.nodes), prerequisiteChains);
  const dayMinutes = days.map(() => 0);

  for (const node of nodes) {
    const offsets = DAY_OFFSETS_BY_LEVEL[node.proficiencyLevel];
    const primaryDay = Math.min(days.length - 1, nodes.indexOf(node));
    for (const offset of offsets) {
      const preferredDay = Math.min(days.length - 1, primaryDay + offset);
      const taskType: StudyPlanTaskType = offset === 0 ? 'LEARN' : 'REVIEW';
      const minutes = offset === 0 ? INITIAL_MINUTES : REVIEW_MINUTES;
      let dayIndex = preferredDay;
      while (dayIndex < days.length && dayMinutes[dayIndex] + minutes > MAX_MINUTES_PER_DAY) dayIndex += 1;
      if (dayIndex >= days.length) continue;
      days[dayIndex].tasks.push({
        skillId: node.skillId,
        skillName: node.skillName,
        taskType,
        focus: focusFor(node, taskType),
        minutes,
      });
      dayMinutes[dayIndex] += minutes;
    }
  }
  return days;
}
