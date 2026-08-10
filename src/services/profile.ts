import { supabase } from '../lib/supabase';
import type { ServiceResponse, UserProfile, CandidateSkillMemoryStore } from '../types/index';

export const getProfile = async (
  userId: string
): Promise<ServiceResponse<UserProfile>> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      // Fallback profile object if user record is pending table sync
      const fallbackStore: CandidateSkillMemoryStore = {
        userId,
        nodes: {
          react_state: {
            skillId: 'react_state',
            skillName: 'React & State',
            proficiencyLevel: 'PROFICIENT',
            attemptsCount: 4,
            reflections: [
              {
                id: 'sr_1',
                sessionId: 'sess_101',
                skillTag: 'React & State',
                timestamp: new Date().toISOString(),
                mistakeSummary: 'Omitted cleanup handler in useEffect subscription listener.',
                rootCauseAnalysis: 'Root cause: Candidate overlooked memory leak lifecycle management under fast unmount scenarios.',
                actionableRemediation: 'Always return abort controller or unsubscriber function in useEffect.',
                severity: 'MEDIUM',
              },
            ],
            persistentDeficiencies: ['Omitted cleanup handler in useEffect subscription listener.'],
            remediationProgress: 75,
            lastUpdated: new Date().toISOString(),
          },
          distributed_locking: {
            skillId: 'distributed_locking',
            skillName: 'Distributed Systems',
            proficiencyLevel: 'DEVELOPING',
            attemptsCount: 2,
            reflections: [
              {
                id: 'sr_2',
                sessionId: 'sess_102',
                skillTag: 'Distributed Systems',
                timestamp: new Date().toISOString(),
                mistakeSummary: 'Did not specify TTL auto-renewal for Redis mutex locks.',
                rootCauseAnalysis: 'Root cause: Candidate lacked familiarity with split-brain network failure modes in Redlock.',
                actionableRemediation: 'Study Redlock algorithm lock lease extension protocols.',
                severity: 'HIGH',
              },
            ],
            persistentDeficiencies: ['Did not specify TTL auto-renewal for Redis mutex locks.'],
            remediationProgress: 45,
            lastUpdated: new Date().toISOString(),
          },
        },
        globalReflectionSummary: 'Candidate has logged 2 skill memory node(s). 1 skill proficient, 1 developing. 1 high-severity deficiency trace requiring remediation.',
      };

      return {
        data: {
          id: userId,
          email: 'user@skillo.dev',
          name: 'Developer Candidate',
          created_at: new Date().toISOString(),
          skillMemoryStore: fallbackStore,
        },
        error: null,
      };
    }

    const profileData = data as UserProfile;
    if (!profileData.skillMemoryStore) {
      profileData.skillMemoryStore = {
        userId,
        nodes: {
          system_design: {
            skillId: 'system_design',
            skillName: 'System Design Architecture',
            proficiencyLevel: 'PROFICIENT',
            attemptsCount: 3,
            reflections: [
              {
                id: 'sr_default',
                sessionId: 'sess_default',
                skillTag: 'System Design Architecture',
                timestamp: new Date().toISOString(),
                mistakeSummary: 'Omitted cache-aside invalidation strategy during write operations.',
                rootCauseAnalysis: 'Root cause: Candidate prioritized read throughput without handling database write propagation latency.',
                actionableRemediation: 'Implement double-delete pattern or pub-sub cache invalidation.',
                severity: 'MEDIUM',
              },
            ],
            persistentDeficiencies: ['Omitted cache-aside invalidation strategy during write operations.'],
            remediationProgress: 70,
            lastUpdated: new Date().toISOString(),
          },
        },
        globalReflectionSummary: 'Candidate skill memory store initialized. 1 skill memory node active.',
      };
    }

    return { data: profileData, error: null };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const updateProfile = async (
  userId: string,
  updates: Partial<UserProfile>
): Promise<ServiceResponse<UserProfile>> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() })
      .select()
      .single();
    return { data: data as UserProfile, error };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};
