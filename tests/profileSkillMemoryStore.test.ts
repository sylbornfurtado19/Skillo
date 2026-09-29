/**
 * Focused Unit Tests for Supabase-to-Frontend Profile Mapping for Skill Memory
 * Verifies that:
 * 1. The database field `skill_memory_store` is correctly mapped to `UserProfile.skillMemoryStore`.
 * 2. When `skill_memory_store` is missing, null, or empty, safe empty default (undefined) is used.
 * 3. All existing profile fields (id, email, name, profileSettings) are preserved.
 * 4. `updateProfile` persists `skillMemoryStore` as `skill_memory_store` in the database payload.
 */

const mockSingle = jest.fn();
const mockEq = jest.fn(() => ({ single: mockSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq, single: mockSingle }));
const mockUpsert = jest.fn(() => ({ select: mockSelect }));

const mockFrom = jest.fn((_table: string) => ({
  select: mockSelect,
  upsert: mockUpsert,
}));

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
  isSupabaseConfigured: true,
}));

import { getProfile, updateProfile } from '../src/services/profile';
import type { CandidateSkillMemoryStore } from '../src/types/index';

describe('Supabase-to-Frontend Profile Mapping for Skill Memory Store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const sampleMemoryStore: CandidateSkillMemoryStore = {
    userId: 'usr_test_123',
    nodes: {
      react_state: {
        skillId: 'react_state',
        skillName: 'React & State Architecture',
        proficiencyLevel: 'PROFICIENT',
        attemptsCount: 3,
        reflections: [
          {
            id: 'sr_1',
            sessionId: 'sess_1',
            skillTag: 'React & State',
            timestamp: '2026-09-29T20:00:00.000Z',
            mistakeSummary: 'Omitted cleanup handler in useEffect listener.',
            rootCauseAnalysis: 'Candidate missed unmount cleanup lifecycle.',
            actionableRemediation: 'Always return cleanup function in useEffect.',
            severity: 'MEDIUM',
          },
        ],
        persistentDeficiencies: ['Omitted cleanup handler in useEffect listener.'],
        remediationProgress: 80,
        lastUpdated: '2026-09-29T20:00:00.000Z',
      },
    },
    globalReflectionSummary: 'Candidate has 1 skill memory node tracked.',
  };

  it('correctly maps database field skill_memory_store to UserProfile.skillMemoryStore', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'usr_test_123',
        email: 'alex@example.com',
        name: 'Alex Developer',
        title: 'Staff Engineer',
        profile_settings: { defaultDifficulty: 'senior' },
        skill_memory_store: sampleMemoryStore,
      },
      error: null,
    });

    const response = await getProfile('usr_test_123');

    expect(response.error).toBeNull();
    expect(response.data).toBeDefined();

    // Verify skill_memory_store was mapped to camelCase skillMemoryStore
    expect(response.data?.skillMemoryStore).toEqual(sampleMemoryStore);
    expect(response.data?.skillMemoryStore?.nodes.react_state.proficiencyLevel).toBe('PROFICIENT');

    // Verify existing profile fields and mappings are preserved
    expect(response.data?.id).toBe('usr_test_123');
    expect(response.data?.email).toBe('alex@example.com');
    expect(response.data?.name).toBe('Alex Developer');
    expect(response.data?.profileSettings).toEqual({ defaultDifficulty: 'senior' });
  });

  it('uses safe empty default (undefined) when skill_memory_store is null or missing in database', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'usr_no_memory_456',
        email: 'newuser@example.com',
        name: 'New User',
        profile_settings: {},
        skill_memory_store: null,
      },
      error: null,
    });

    const response = await getProfile('usr_no_memory_456');

    expect(response.error).toBeNull();
    expect(response.data).toBeDefined();

    // Must be undefined so SkillMemoryGraph and Profile view render safe empty state
    expect(response.data?.skillMemoryStore).toBeUndefined();

    // Verify existing fields remain intact
    expect(response.data?.id).toBe('usr_no_memory_456');
    expect(response.data?.email).toBe('newuser@example.com');
    expect(response.data?.profileSettings).toEqual({});
  });

  it('uses safe empty default (undefined) when database skill_memory_store is an empty object {}', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'usr_empty_obj_789',
        email: 'empty@example.com',
        name: 'Empty Schema User',
        profile_settings: null,
        skill_memory_store: {},
      },
      error: null,
    });

    const response = await getProfile('usr_empty_obj_789');

    expect(response.error).toBeNull();
    expect(response.data).toBeDefined();

    // Empty object {} must normalize to undefined so Object.keys(store.nodes) does not throw
    expect(response.data?.skillMemoryStore).toBeUndefined();
    expect(response.data?.profileSettings).toEqual({});
  });

  it('updateProfile maps skillMemoryStore in updates to snake_case skill_memory_store in database payload', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'usr_update_101',
        email: 'update@example.com',
        name: 'Updated User',
        skill_memory_store: sampleMemoryStore,
      },
      error: null,
    });

    const response = await updateProfile('usr_update_101', {
      name: 'Updated User',
      skillMemoryStore: sampleMemoryStore,
    });

    expect(response.error).toBeNull();
    expect(response.data?.skillMemoryStore).toEqual(sampleMemoryStore);

    // Verify upsert payload contains snake_case skill_memory_store
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'usr_update_101',
        name: 'Updated User',
        skill_memory_store: sampleMemoryStore,
      })
    );
  });
});
