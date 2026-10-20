/**
 * tests/apiValidationAndSecurity.test.ts
 *
 * Negative security and schema validation tests:
 * 1. Unauthenticated requests are rejected with HTTP 401.
 * 2. Oversized answer text (> 10,000 chars) is rejected with HTTP 422 Unprocessable Entity.
 * 3. Mismatched questions and answers array length is rejected with HTTP 422.
 * 4. Malformed diagram state (> 50 nodes or > 100 edges) is rejected with HTTP 422.
 * 5. Non-finite telemetry coordinates are rejected with HTTP 422.
 * 6. Followup endpoint rejects oversized candidate answers (> 10,000 chars) with HTTP 400.
 * 7. Resume analyze endpoint rejects oversized documents (> 30,000 chars) with HTTP 422.
 */



import { POST as evaluateHandler } from '../app/api/interview/evaluate/route';
import { POST as followupHandler } from '../app/api/interview/followup/route';
import { POST as setupHandler } from '../app/api/interview/setup/route';
import { POST as analyzeHandler } from '../app/api/resume/analyze/route';
import { POST as extractHandler } from '../app/api/resume/extract/route';

const AUTH_HEADER = { Authorization: 'Bearer valid_test_token' };

describe('API Validation & Abuse Prevention Suite', () => {
  describe('Authentication Enforcement', () => {
    it('rejects setup request without authorization header with HTTP 401', async () => {
      const req = new Request('http://localhost:3000/api/interview/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const res = await setupHandler(req);
      expect(res.status).toBe(401);
    });

    it('rejects evaluate request without authorization header with HTTP 401', async () => {
      const req = new Request('http://localhost:3000/api/interview/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const res = await evaluateHandler(req);
      expect(res.status).toBe(401);
    });

    it('rejects followup request without authorization header with HTTP 401', async () => {
      const req = new Request('http://localhost:3000/api/interview/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const res = await followupHandler(req);
      expect(res.status).toBe(401);
    });

    it('rejects resume analyze request without authorization header with HTTP 401', async () => {
      const req = new Request('http://localhost:3000/api/resume/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const res = await analyzeHandler(req);
      expect(res.status).toBe(401);
    });

    it('rejects resume extract request without authorization header with HTTP 401', async () => {
      const req = new Request('http://localhost:3000/api/resume/extract', {
        method: 'POST',
        body: new FormData(),
      });
      const res = await extractHandler(req);
      expect(res.status).toBe(401);
    });
  });

  describe('/api/interview/evaluate Route Validation', () => {
    it('rejects payload when candidate answer exceeds character limit', async () => {
      const oversizedAnswer = 'A'.repeat(12000);
      const req = new Request('http://localhost:3000/api/interview/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify({
          setupData: { role: 'Frontend Engineer' },
          questionsList: [{ question: 'Explain React reconciliation.' }],
          answersList: [oversizedAnswer],
        }),
      });

      const res = await evaluateHandler(req);
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.message).toBe('Validation failed');
      expect(JSON.stringify(data.errors)).toContain('10,000 characters limit');
    });

    it('rejects payload when questionsList and answersList have mismatched lengths', async () => {
      const req = new Request('http://localhost:3000/api/interview/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify({
          setupData: { role: 'Backend Engineer' },
          questionsList: [
            { question: 'Explain database sharding.' },
            { question: 'Explain consistent hashing.' },
          ],
          answersList: ['Sharding partitions data across multiple nodes.'], // only 1 answer for 2 questions
        }),
      });

      const res = await evaluateHandler(req);
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.message).toBe('Validation failed');
      expect(JSON.stringify(data.errors)).toContain('must have exactly equal lengths');
    });

    it('rejects payload when diagram state exceeds maximum allowed nodes', async () => {
      // 51 nodes exceeds max 50 limit
      const excessiveNodes = Array.from({ length: 51 }, (_, i) => ({
        id: `node_${i}`,
        type: 'SERVICE' as const,
        label: `Service ${i}`,
        x: 100,
        y: 100,
        width: 120,
        height: 80,
      }));

      const req = new Request('http://localhost:3000/api/interview/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify({
          setupData: { role: 'Systems Architect' },
          questionsList: [{ question: 'Design a scalable message queue.' }],
          answersList: [
            {
              answerText: 'Architecture diagram submitted.',
              diagramState: {
                nodes: excessiveNodes,
                edges: [],
              },
            },
          ],
        }),
      });

      const res = await evaluateHandler(req);
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.errors.answersList).toBeDefined();
    });

    it('rejects payload when diagram state has non-numeric coordinates', async () => {
      const req = new Request('http://localhost:3000/api/interview/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify({
          setupData: { role: 'Systems Architect' },
          questionsList: [{ question: 'Design a cache.' }],
          answersList: [
            {
              answerText: 'Valid answer text.',
              diagramState: {
                nodes: [
                  {
                    id: 'node_1',
                    type: 'CACHE',
                    label: 'Redis',
                    x: 'invalid_string_coord', // NaN coordinate
                    y: 100,
                    width: 120,
                    height: 80,
                  },
                ],
                edges: [],
              },
            },
          ],
        }),
      });

      const res = await evaluateHandler(req);
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.message).toBe('Validation failed');
    });

    it('rejects non-finite telemetry frame metrics', async () => {
      const req = new Request('http://localhost:3000/api/interview/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify({
          setupData: { role: 'Mobile Engineer' },
          questionsList: [{ question: 'What is iOS memory management?' }],
          answersList: ['ARC tracks references automatically.'],
          gazeFrames: [
            {
              timestampMs: 1000,
              pitchDegrees: 9999, // exceeds max 90 degrees
            },
          ],
        }),
      });

      const res = await evaluateHandler(req);
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.message).toBe('Validation failed');
    });
  });

  describe('/api/interview/followup Route Validation', () => {
    it('rejects payload when answerText exceeds character limit', async () => {
      const req = new Request('http://localhost:3000/api/interview/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify({
          role: 'Backend Engineer',
          question: 'How does Kafka guarantee message ordering?',
          answerText: 'B'.repeat(12000), // exceeds 10,000 limit
        }),
      });

      const res = await followupHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toBe('Invalid payload');
      expect(JSON.stringify(data.errors)).toContain('10,000 characters limit');
    });

    it('returns followUpQuestion at the root matching selectedBranch.questionText for valid payload', async () => {
      const req = new Request('http://localhost:3000/api/interview/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify({
          role: 'Backend Engineer',
          question: 'How does Kafka guarantee message ordering?',
          answerText: 'Kafka partitions topic messages by key. Within each partition, messages are assigned sequential offset IDs.',
        }),
      });

      const res = await followupHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.needsFollowUp).toBe(true);
      expect(typeof data.followUpQuestion).toBe('string');
      expect(data.followUpQuestion.length).toBeGreaterThan(0);
      expect(data.selectedBranch).toBeDefined();
      expect(data.followUpQuestion).toBe(data.selectedBranch.questionText);
    });
  });

  describe('/api/resume/analyze Route Validation', () => {
    it('rejects payload when resumeText exceeds character limit', async () => {
      const req = new Request('http://localhost:3000/api/resume/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify({
          fileName: 'large_resume.pdf',
          jobTitle: 'Senior Infrastructure Engineer',
          jobDescription: 'Kubernetes, Terraform, AWS.',
          resumeText: 'C'.repeat(35000), // exceeds 30,000 limit
        }),
      });

      const res = await analyzeHandler(req);
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.message).toBe('Validation failed');
      expect(JSON.stringify(data.errors)).toContain('30,000 characters limit');
    });
  });

  describe('/api/resume/extract Route Validation', () => {
    it('rejects extract request when no file is uploaded', async () => {
      const formData = new FormData();
      const req = new Request('http://localhost:3000/api/resume/extract', {
        method: 'POST',
        headers: { ...AUTH_HEADER },
        body: formData,
      });

      const res = await extractHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toMatch(/No file provided/i);
    });

    it('successfully extracts text from valid uploaded multipart txt file', async () => {
      const validText =
        'Alice Smith is a Staff Software Engineer with over 10 years of experience designing distributed cloud architectures, Kubernetes clusters, and microservices.';
      const file = new File([validText], 'resume.txt', { type: 'text/plain' });
      const formData = new FormData();
      formData.append('file', file);

      const req = new Request('http://localhost:3000/api/resume/extract', {
        method: 'POST',
        headers: { ...AUTH_HEADER },
        body: formData,
      });

      const res = await extractHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('success');
      expect(data.text).toBe(validText);
      expect(data.charCount).toBe(validText.length);
      expect(data.pageCount).toBe(1);
    });

    it('rejects extract request when text is under 100 characters (scanned document)', async () => {
      const file = new File(['Short bio'], 'short.txt', { type: 'text/plain' });
      const formData = new FormData();
      formData.append('file', file);

      const req = new Request('http://localhost:3000/api/resume/extract', {
        method: 'POST',
        headers: { ...AUTH_HEADER },
        body: formData,
      });

      const res = await extractHandler(req);
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.code).toBe('SHORT_TEXT');
      expect(data.message).toMatch(/scanned PDF, no selectable text/i);
    });
  });
});

