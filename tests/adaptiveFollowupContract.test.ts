/**
 * tests/adaptiveFollowupContract.test.ts
 *
 * Focused verification suite for LATS adaptive follow-up contract and question list insertion:
 * 1. API endpoint exposes followUpQuestion at the root matching selectedBranch.questionText
 * 2. API endpoint preserves full backward compatibility (selectedBranch, allBranches, prmScore, uctValue)
 * 3. Client question list insertion accepts followUpQuestion and splices into questions at currentQuestionIndex + 1
 * 4. Client question list insertion safely accepts legacy selectedBranch.questionText fallback
 * 5. Short/negative answers or needsFollowUp: false preserve the question list unchanged
 */

const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(async (token: string) => {
      if (token === 'valid_test_token') {
        return { data: { user: { id: 'usr_test_lats_123', email: 'tester@example.com' } }, error: null };
      }
      return { data: { user: null }, error: new Error('Invalid or expired token') };
    }),
  },
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockResolvedValue({ data: [], count: 0, error: null }),
  })),
};

jest.mock('../src/lib/supabase', () => ({
  __esModule: true,
  supabase: mockSupabaseClient,
  isSupabaseConfigured: true,
}));

jest.mock('../src/lib/server/supabaseAdmin', () => ({
  __esModule: true,
  getSupabaseAdmin: jest.fn(() => mockSupabaseClient),
  supabaseAdmin: mockSupabaseClient,
}));

import { POST as followupHandler } from '../app/api/interview/followup/route';

const AUTH_HEADER = { Authorization: 'Bearer valid_test_token' };

/**
 * Replicates the exact insertion routine from InterviewSession.tsx:615-634
 */
function handleFollowUpData(
  questions: string[],
  currentQuestionIndex: number,
  data: any
): { updatedQuestions: string[]; nextIndex: number; wasInserted: boolean } {
  const followUpText = data?.followUpQuestion || data?.selectedBranch?.questionText;
  if (data && data.needsFollowUp && followUpText) {
    const newQuestionsList = [...questions];
    const insertIdx = currentQuestionIndex + 1;
    newQuestionsList.splice(insertIdx, 0, followUpText);
    return {
      updatedQuestions: newQuestionsList,
      nextIndex: insertIdx,
      wasInserted: true,
    };
  }
  return {
    updatedQuestions: questions,
    nextIndex: currentQuestionIndex + 1,
    wasInserted: false,
  };
}

describe('LATS Adaptive Follow-up Contract & Question List Insertion', () => {
  describe('1. API Route Contract Verification (/api/interview/followup)', () => {
    it('returns followUpQuestion at the root of the response matching selectedBranch.questionText', async () => {
      const req = new Request('http://localhost:3000/api/interview/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify({
          role: 'Backend Engineer',
          question: 'How do you design a high-throughput distributed message queue?',
          answerText:
            'I would partition topics across multiple broker nodes and use consumer groups for parallelized horizontal scaling.',
        }),
      });

      const res = await followupHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.needsFollowUp).toBe(true);

      // Verify root-level followUpQuestion contract
      expect(typeof json.followUpQuestion).toBe('string');
      expect(json.followUpQuestion.trim().length).toBeGreaterThan(0);

      // Verify backward compatibility with selectedBranch and allBranches
      expect(json.selectedBranch).toBeDefined();
      expect(json.selectedBranch.questionText).toBe(json.followUpQuestion);
      expect(typeof json.selectedBranch.prmScore).toBe('number');
      expect(typeof json.selectedBranch.uctValue).toBe('number');
      expect(Array.isArray(json.allBranches)).toBe(true);
      expect(json.allBranches.length).toBeGreaterThan(0);
    });

    it('returns needsFollowUp: false for empty or trivial candidate answers', async () => {
      const req = new Request('http://localhost:3000/api/interview/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify({
          role: 'Backend Engineer',
          question: 'What is database sharding?',
          answerText: 'I do not know.', // < 20 chars
        }),
      });

      const res = await followupHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.needsFollowUp).toBe(false);
      expect(json.followUpQuestion).toBeUndefined();
    });
  });

  describe('2. Interview Question List Insertion Flow', () => {
    const initialQuestions = [
      'Question 1: Explain event-driven architecture.',
      'Question 2: How do you handle distributed consensus?',
      'Question 3: Describe zero-downtime database migrations.',
    ];

    it('inserts the follow-up question immediately after current question when followUpQuestion is provided', async () => {
      const currentQuestionIndex = 0;
      const apiResponse = {
        needsFollowUp: true,
        followUpQuestion: 'Follow-up: How would you prevent message loss during broker crash?',
        selectedBranch: {
          actionType: 'DEEP_DIVE',
          questionText: 'Follow-up: How would you prevent message loss during broker crash?',
          rationale: 'Probe replication durability.',
          prmScore: 0.88,
          uctValue: 1.45,
        },
      };

      const result = handleFollowUpData(initialQuestions, currentQuestionIndex, apiResponse);

      expect(result.wasInserted).toBe(true);
      expect(result.updatedQuestions.length).toBe(4);
      expect(result.nextIndex).toBe(1);
      expect(result.updatedQuestions[0]).toBe(initialQuestions[0]);
      expect(result.updatedQuestions[1]).toBe(apiResponse.followUpQuestion);
      expect(result.updatedQuestions[2]).toBe(initialQuestions[1]);
      expect(result.updatedQuestions[3]).toBe(initialQuestions[2]);
    });

    it('safely falls back to selectedBranch.questionText if followUpQuestion is missing (backward compatibility)', () => {
      const currentQuestionIndex = 1;
      const legacyApiResponse = {
        needsFollowUp: true,
        // followUpQuestion is omitted
        selectedBranch: {
          actionType: 'EDGE_CASE_CHALLENGE',
          questionText: 'Legacy Follow-up: What if split-brain occurs in the Raft cluster?',
          rationale: 'Challenge edge case recovery.',
          prmScore: 0.92,
          uctValue: 1.51,
        },
      };

      const result = handleFollowUpData(initialQuestions, currentQuestionIndex, legacyApiResponse);

      expect(result.wasInserted).toBe(true);
      expect(result.updatedQuestions.length).toBe(4);
      expect(result.nextIndex).toBe(2);
      expect(result.updatedQuestions[1]).toBe(initialQuestions[1]);
      expect(result.updatedQuestions[2]).toBe(legacyApiResponse.selectedBranch.questionText);
      expect(result.updatedQuestions[3]).toBe(initialQuestions[2]);
    });

    it('does not insert any question when needsFollowUp is false', () => {
      const currentQuestionIndex = 0;
      const noFollowUpResponse = {
        needsFollowUp: false,
        trajectoryDepth: 0,
      };

      const result = handleFollowUpData(initialQuestions, currentQuestionIndex, noFollowUpResponse);

      expect(result.wasInserted).toBe(false);
      expect(result.updatedQuestions.length).toBe(3);
      expect(result.updatedQuestions).toEqual(initialQuestions);
      expect(result.nextIndex).toBe(1);
    });

    it('end-to-end: live API call result directly populates the question list', async () => {
      const req = new Request('http://localhost:3000/api/interview/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify({
          role: 'Full Stack Engineer',
          question: 'How does React 19 handle automated memoization?',
          answerText:
            'The React Compiler automatically memoizes components and hooks at compile time based on dependency analysis.',
        }),
      });

      const res = await followupHandler(req);
      const json = await res.json();

      expect(json.needsFollowUp).toBe(true);
      expect(json.followUpQuestion).toBeDefined();

      const { updatedQuestions, nextIndex, wasInserted } = handleFollowUpData(
        initialQuestions,
        0,
        json
      );

      expect(wasInserted).toBe(true);
      expect(updatedQuestions.length).toBe(initialQuestions.length + 1);
      expect(nextIndex).toBe(1);
      expect(updatedQuestions[1]).toBe(json.followUpQuestion);
    });
  });
});
