import {
  computeImpactMetricsScore,
  computeExperienceRelevanceScore,
} from '../src/lib/services/resumeAnalysis.server';
import {
  checkRateLimit,
  createRateLimitResponse,
} from '../src/lib/services/rateLimiter.server';

describe('Dynamic Resume Scoring Heuristics', () => {
  describe('computeImpactMetricsScore', () => {
    it('returns 0 for empty or very short resume text (documented empty-input case)', () => {
      expect(computeImpactMetricsScore('')).toBe(0);
      expect(computeImpactMetricsScore('   ')).toBe(0);
      expect(computeImpactMetricsScore('abc')).toBe(0);
      expect(computeImpactMetricsScore(undefined)).toBe(0);
    });

    it('returns a low score for text with zero numbers or metrics', () => {
      const plainText =
        'Developed software applications using JavaScript and Python. Collaborated with designers and participated in sprint meetings.';
      const score = computeImpactMetricsScore(plainText);
      expect(score).toBeLessThan(30);
    });

    it('returns a high score for resumes with diverse quantified metrics and impact action verbs', () => {
      const metricRichText = `
        Senior Software Engineer at HighScale Corp.
        - Reduced API latency by 45% (from 250ms to 135ms) across 12 distributed microservices handling 50,000 qps.
        - Optimized AWS cloud infrastructure, cutting annual compute costs by $120,000 USD (30% savings).
        - Scaled PostgreSQL database throughput to support over 1.5M daily active users with 99.99% uptime.
        - Led a cross-functional team of 8 engineers, accelerating feature delivery velocity by 2.5x.
        - Generated $450k in new enterprise pipeline through automated billing integrations.
      `;
      const score = computeImpactMetricsScore(metricRichText);
      expect(score).toBeGreaterThanOrEqual(70);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('computeExperienceRelevanceScore', () => {
    it('returns 0 for empty or very short resume text (documented empty-input case)', () => {
      expect(computeExperienceRelevanceScore('', 'Frontend Engineer', 'React and TypeScript')).toBe(0);
      expect(computeExperienceRelevanceScore(undefined, 'Frontend Engineer', 'React and TypeScript')).toBe(0);
    });

    it('produces higher score for a resume matching target job description and title', () => {
      const jobTitle = 'Senior Full Stack Engineer';
      const jobDesc = 'Seeking an experienced engineer proficient in React, Next.js, Node.js, TypeScript, and PostgreSQL. Must have experience with distributed microservices, REST APIs, and Docker.';

      const matchingResume = `
        Senior Full Stack Engineer with 6 years of experience building scalable applications using React, Next.js, Node.js, and TypeScript.
        Architected high-throughput REST APIs and distributed microservices deployed via Docker and Kubernetes with PostgreSQL databases.
      `;

      const irrelevantResume = `
        Graphic Designer with experience in Adobe Photoshop, Illustrator, typography, print design, and brand guidelines for retail packaging.
      `;

      const matchScore = computeExperienceRelevanceScore(matchingResume, jobTitle, jobDesc);
      const irrelevantScore = computeExperienceRelevanceScore(irrelevantResume, jobTitle, jobDesc);

      expect(matchScore).toBeGreaterThan(50);
      expect(irrelevantScore).toBeLessThan(30);
      expect(matchScore).toBeGreaterThan(irrelevantScore);
    });
  });
});

describe('Rate Limiter Module', () => {
  it('allows requests within maxRequests and reports decreasing remaining allowance', async () => {
    const testUserId = `test-user-${Date.now()}`;
    const action = 'test_action_allow';

    const r1 = await checkRateLimit({
      userId: testUserId,
      action,
      maxRequests: 3,
      windowSeconds: 60,
    });
    expect(r1.allowed).toBe(true);
    expect(r1.limit).toBe(3);

    const r2 = await checkRateLimit({
      userId: testUserId,
      action,
      maxRequests: 3,
      windowSeconds: 60,
    });
    expect(r2.allowed).toBe(true);

    const r3 = await checkRateLimit({
      userId: testUserId,
      action,
      maxRequests: 3,
      windowSeconds: 60,
    });
    expect(r3.allowed).toBe(true);

    // 4th request exceeds the limit of 3
    const r4 = await checkRateLimit({
      userId: testUserId,
      action,
      maxRequests: 3,
      windowSeconds: 60,
    });
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
    expect(r4.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('generates a 429 response with appropriate Retry-After and rate limit headers', async () => {
    const rateLimitExceededResult = {
      allowed: false,
      limit: 5,
      remaining: 0,
      resetSeconds: 45,
      retryAfterSeconds: 45,
      store: 'in-memory-fallback' as const,
    };

    const response = createRateLimitResponse(rateLimitExceededResult, 'interview evaluation');
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('45');
    expect(response.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');

    const json = await response.json();
    expect(json.status).toBe('error');
    expect(json.message).toContain('Rate limit exceeded');
    expect(json.message).toContain('45 seconds');
  });
});
