import {
  analyzeSpeech,
  calculateDeliveryScore,
  countFillerWords,
  getPauseDurations,
  tokenizeWords,
  type RecognitionSegment,
} from '../src/lib/services/speechAnalytics';

describe('speech analytics', () => {
  it('handles empty recognition input', () => {
    expect(analyzeSpeech([])).toMatchObject({
      wordsPerMinute: 0,
      fillerCount: 0,
      fillerRate: 0,
      longestPauseMs: 0,
      averagePauseMs: 0,
      deliveryScore: 0,
    });
    expect(analyzeSpeech([]).breakdown.speed.explanation).toBe('No speech segments were provided.');
  });

  it('calculates pace, fillers, and pauses from segments', () => {
    const segments: RecognitionSegment[] = [
      { text: 'Um, I like building tools.', startMs: 0, endMs: 2000 },
      { text: 'You know, actually shipping them.', startMs: 3000, endMs: 5000 },
    ];

    expect(analyzeSpeech(segments)).toMatchObject({
      wordsPerMinute: 120,
      fillerCount: 4,
      fillerRate: 40,
      longestPauseMs: 1000,
      averagePauseMs: 1000,
    });
  });

  it('counts the multi-word filler as one occurrence and normalizes punctuation', () => {
    expect(tokenizeWords('UM... you know, LIKE!')).toEqual(['um', 'you', 'know', 'like']);
    expect(countFillerWords(['um', 'you', 'know', 'like'])).toBe(3);
  });

  it('sorts segments before calculating pauses and ignores overlaps', () => {
    const segments: RecognitionSegment[] = [
      { text: 'second', startMs: 3000, endMs: 4000 },
      { text: 'first', startMs: 0, endMs: 3500 },
      { text: 'third', startMs: 6000, endMs: 7000 },
    ];

    expect(getPauseDurations(segments)).toEqual([0, 2000]);
    expect(analyzeSpeech(segments)).toMatchObject({
      longestPauseMs: 2000,
      averagePauseMs: 1000,
    });
  });

  it('returns a weighted score and an explanation for every score component', () => {
    const result = calculateDeliveryScore(150, 2, 500);

    expect(result.score).toBe(94);
    expect(result.breakdown).toEqual({
      speed: expect.objectContaining({ score: 100 }),
      fillers: expect.objectContaining({ score: 80 }),
      pauses: expect.objectContaining({ score: 100 }),
    });
    expect(result.breakdown.speed.explanation).toEqual(expect.any(String));
    expect(result.breakdown.fillers.explanation).toEqual(expect.any(String));
    expect(result.breakdown.pauses.explanation).toEqual(expect.any(String));
  });
});
