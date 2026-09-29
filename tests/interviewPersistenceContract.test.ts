/**
 * Focused Unit Tests for Interview Persistence Contract
 * Verifies that:
 * 1. mapEvaluationToMockInterviewPayload maps an EvaluationReport to the exact mock_interviews schema.
 * 2. Database column names (overall_score, experience_level, interview_type, breakdown, etc.) match supabase_schema.sql.
 * 3. Fallbacks and defaults are applied when optional properties are omitted.
 * 4. saveMockInterview sends the aligned payload to supabase.from('mock_interviews').insert().
 */

import { mapEvaluationToMockInterviewPayload, saveMockInterview } from '../src/services/interview';
import type { EvaluationReport } from '../src/types/index';
import { supabase } from '../src/lib/supabase';

// Mock Supabase client
jest.mock('../src/lib/supabase', () => {
  const mockSingle = jest.fn();
  const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
  const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
  const mockFrom = jest.fn().mockReturnValue({ insert: mockInsert });

  return {
    supabase: {
      from: mockFrom,
    },
    isSupabaseConfigured: true,
  };
});

describe('Interview Persistence Contract & Schema Alignment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockEvaluationReport: EvaluationReport = {
    overallScore: 88,
    categories: {
      technicalAccuracy: 90,
      communication: 85,
      depth: 88,
      timeManagement: 90,
      systemDesignLogic: 85,
      edgeCaseHandling: 86,
    },
    breakdown: [
      {
        id: 'q_1',
        question: 'Design a distributed cache system with TTL eviction.',
        userAnswer: 'I would use consistent hashing with Redis cluster and a ring topology.',
        score: 88,
        idealConcepts: 'Consistent hashing, TTL, LRU eviction, replication',
        feedback: 'Strong understanding of distributed caching fundamentals.',
      },
    ],
    interviewerComments: 'Excellent demonstration of distributed systems principles.',
    personaId: 'alex',
    evaluatedAt: '2026-09-30T10:00:00.000Z',
    userId: 'user_test_456',
    setupData: {
      domain: 'Cloud Architecture',
      role: 'Staff Infrastructure Engineer',
      experienceLevel: 'Principal',
      type: 'System Design',
      company: 'Stripe',
      duration: 60,
      interviewModeId: 'system-design-deep',
      systemDesignDiagram: {
        nodes: [{ id: 'node_1', type: 'cache', label: 'Redis Cluster' }],
        edges: [],
      },
    },
  };

  describe('1. mapEvaluationToMockInterviewPayload', () => {
    it('correctly maps all EvaluationReport fields to mock_interviews database columns', () => {
      const payload = mapEvaluationToMockInterviewPayload(mockEvaluationReport);

      // Verify exact database column mappings from supabase_schema.sql
      expect(payload.domain).toBe('Cloud Architecture');
      expect(payload.role).toBe('Staff Infrastructure Engineer');
      expect(payload.experience_level).toBe('Principal');
      expect(payload.interview_type).toBe('System Design');
      expect(payload.persona).toBe('alex');
      expect(payload.overall_score).toBe(88);
      expect(payload.categories).toEqual(mockEvaluationReport.categories);
      expect(payload.breakdown).toEqual(mockEvaluationReport.breakdown);
      expect(payload.interviewer_comments).toBe('Excellent demonstration of distributed systems principles.');
      expect(payload.company).toBe('Stripe');
      expect(payload.duration).toBe(60);
      expect(payload.interview_mode_id).toBe('system-design-deep');
      expect(payload.system_design_diagram).toEqual({
        nodes: [{ id: 'node_1', type: 'cache', label: 'Redis Cluster' }],
        edges: [],
      });
      expect(payload.created_at).toBe('2026-09-30T10:00:00.000Z');

      // Ensure no non-schema properties exist on the payload
      expect((payload as any).feedback).toBeUndefined();
      expect((payload as any).score).toBeUndefined();
      expect((payload as any).difficulty).toBeUndefined();
    });

    it('uses fallback setup data when report.setupData is partially omitted', () => {
      const reportWithoutSetup: EvaluationReport = {
        overallScore: 75,
        categories: { technicalAccuracy: 75, communication: 75 },
        breakdown: [],
        interviewerComments: 'Good baseline interview.',
      };

      const fallbackSetup = {
        domain: 'Frontend Engineering',
        role: 'Senior React Developer',
        experienceLevel: 'Senior',
        type: 'Technical',
        persona: 'marcus',
        company: 'Meta',
        duration: 45,
        interviewModeId: 'frontend-coding',
      };

      const payload = mapEvaluationToMockInterviewPayload(reportWithoutSetup, fallbackSetup);

      expect(payload.domain).toBe('Frontend Engineering');
      expect(payload.role).toBe('Senior React Developer');
      expect(payload.experience_level).toBe('Senior');
      expect(payload.interview_type).toBe('Technical');
      expect(payload.persona).toBe('marcus');
      expect(payload.overall_score).toBe(75);
      expect(payload.company).toBe('Meta');
      expect(payload.duration).toBe(45);
      expect(payload.interview_mode_id).toBe('frontend-coding');
      expect(payload.interviewer_comments).toBe('Good baseline interview.');
    });

    it('applies safe defaults when both report setupData and fallbackSetup are absent', () => {
      const minimalReport: EvaluationReport = {
        overallScore: 70,
        categories: {},
        breakdown: [],
      };

      const payload = mapEvaluationToMockInterviewPayload(minimalReport);

      expect(payload.domain).toBe('Computer Science');
      expect(payload.role).toBe('Software Engineer');
      expect(payload.experience_level).toBe('Mid-Level');
      expect(payload.interview_type).toBe('Technical');
      expect(payload.persona).toBe('sarah');
      expect(payload.overall_score).toBe(70);
      expect(payload.company).toBe('Generic');
      expect(payload.duration).toBe(45);
      expect(payload.interview_mode_id).toBe('generic-technical');
      expect(payload.interviewer_comments).toBe('');
      expect(payload.system_design_diagram).toEqual({});
    });
  });

  describe('2. saveMockInterview Service', () => {
    it('persists payload with user_id to public.mock_interviews table', async () => {
      const mockResultRow = {
        id: 'mock_uuid_123',
        user_id: 'user_123',
        domain: 'Cloud Architecture',
        role: 'Staff Infrastructure Engineer',
        overall_score: 88,
      };

      const mockSingle = jest.fn().mockResolvedValue({ data: mockResultRow, error: null });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
      (supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });

      const payload = mapEvaluationToMockInterviewPayload(mockEvaluationReport);
      const res = await saveMockInterview('user_123', payload);

      expect(supabase.from).toHaveBeenCalledWith('mock_interviews');
      expect(mockInsert).toHaveBeenCalledTimes(1);

      const insertedRecord = mockInsert.mock.calls[0][0][0];
      expect(insertedRecord.user_id).toBe('user_123');
      expect(insertedRecord.domain).toBe('Cloud Architecture');
      expect(insertedRecord.role).toBe('Staff Infrastructure Engineer');
      expect(insertedRecord.experience_level).toBe('Principal');
      expect(insertedRecord.interview_type).toBe('System Design');
      expect(insertedRecord.persona).toBe('alex');
      expect(insertedRecord.overall_score).toBe(88);
      expect(insertedRecord.company).toBe('Stripe');
      expect(insertedRecord.duration).toBe(60);
      expect(insertedRecord.interview_mode_id).toBe('system-design-deep');

      expect(res.data).toEqual(mockResultRow);
      expect(res.error).toBeNull();
    });

    it('returns error safely when Supabase insert fails', async () => {
      const mockDbError = new Error('Database connection failed');
      const mockSingle = jest.fn().mockResolvedValue({ data: null, error: mockDbError });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
      (supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });

      const payload = mapEvaluationToMockInterviewPayload(mockEvaluationReport);
      const res = await saveMockInterview('user_123', payload);

      expect(res.data).toBeNull();
      expect(res.error).toEqual(mockDbError);
    });
  });
});
