import { rewriteResumeBullets } from '../src/lib/services/resumeAnalysis.server';

describe('rewriteResumeBullets', () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterAll(() => {
    if (originalApiKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalApiKey;
  });

  it('does not invent digits beyond those present in each original line', async () => {
    const result = await rewriteResumeBullets({
      resumeText: '- Built a dashboard for 120 users\n- Improved API reliability for internal teams',
      jobTitle: 'Frontend Engineer',
      jobDescription: 'Build accessible React applications.',
    });

    expect(result).toHaveLength(2);
    result.forEach((item) => {
      const originalDigits: string[] = item.original.match(/\d+/g) ?? [];
      const rewrittenDigits: string[] = item.rewritten.match(/\d+/g) ?? [];
      expect(rewrittenDigits.every((digit) => originalDigits.includes(digit))).toBe(true);
    });
  });

  it('returns an empty array for an empty resume', async () => {
    await expect(rewriteResumeBullets({
      resumeText: '',
      jobTitle: 'Software Engineer',
      jobDescription: 'Build reliable systems.',
    })).resolves.toEqual([]);
  });
});
