export interface RecognitionSegment {
  text: string;
  startMs: number;
  endMs: number;
}

export interface DeliveryScoreBreakdown {
  speed: {
    score: number;
    explanation: string;
  };
  fillers: {
    score: number;
    explanation: string;
  };
  pauses: {
    score: number;
    explanation: string;
  };
}

export interface SpeechAnalytics {
  wordsPerMinute: number;
  fillerCount: number;
  fillerRate: number;
  fillerCounts: Record<string, number>;
  longestPauseMs: number;
  averagePauseMs: number;
  deliveryScore: number;
  breakdown: DeliveryScoreBreakdown;
}

const FILLER_WORDS = new Set(['um', 'uh', 'like', 'basically', 'actually', 'so']);
const TARGET_WPM_MIN = 130;
const TARGET_WPM_MAX = 170;

const round = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export const tokenizeWords = (text: string): string[] =>
  text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? [];

export const countFillerWords = (words: string[]): number => {
  let count = 0;

  for (let index = 0; index < words.length; index += 1) {
    if (words[index] === 'you' && words[index + 1] === 'know') {
      count += 1;
      index += 1;
    } else if (FILLER_WORDS.has(words[index])) {
      count += 1;
    }
  }

  return count;
};

export const getFillerCounts = (words: string[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (let index = 0; index < words.length; index += 1) {
    const filler = words[index] === 'you' && words[index + 1] === 'know'
      ? 'you know'
      : FILLER_WORDS.has(words[index])
        ? words[index]
        : null;
    if (filler) {
      counts[filler] = (counts[filler] ?? 0) + 1;
      if (filler === 'you know') index += 1;
    }
  }
  return counts;
};

export const getPauseDurations = (segments: RecognitionSegment[]): number[] => {
  const orderedSegments = [...segments].sort((a, b) => a.startMs - b.startMs);
  const pauses: number[] = [];

  for (let index = 1; index < orderedSegments.length; index += 1) {
    const pause = orderedSegments[index].startMs - orderedSegments[index - 1].endMs;
    pauses.push(Math.max(0, pause));
  }

  return pauses;
};

const scoreSpeed = (wordsPerMinute: number): number => {
  if (wordsPerMinute >= TARGET_WPM_MIN && wordsPerMinute <= TARGET_WPM_MAX) {
    return 100;
  }

  if (wordsPerMinute < TARGET_WPM_MIN) {
    return Math.max(0, (wordsPerMinute / TARGET_WPM_MIN) * 100);
  }

  return Math.max(0, 100 - ((wordsPerMinute - TARGET_WPM_MAX) / TARGET_WPM_MAX) * 100);
};

const scoreFillers = (fillerRate: number): number => Math.max(0, 100 - fillerRate * 10);

const scorePauses = (averagePauseMs: number): number =>
  averagePauseMs <= 500 ? 100 : Math.max(0, 100 - ((averagePauseMs - 500) / 2500) * 100);

export const calculateDeliveryScore = (
  wordsPerMinute: number,
  fillerRate: number,
  averagePauseMs: number,
): { score: number; breakdown: DeliveryScoreBreakdown } => {
  const speedScore = round(scoreSpeed(wordsPerMinute));
  const fillerScore = round(scoreFillers(fillerRate));
  const pauseScore = round(scorePauses(averagePauseMs));

  return {
    score: round(speedScore * 0.4 + fillerScore * 0.3 + pauseScore * 0.3),
    breakdown: {
      speed: {
        score: speedScore,
        explanation: `Scored against a target speaking pace of ${TARGET_WPM_MIN}-${TARGET_WPM_MAX} words per minute.`,
      },
      fillers: {
        score: fillerScore,
        explanation: 'Starts at 100 and decreases by 10 points for each filler per 100 words.',
      },
      pauses: {
        score: pauseScore,
        explanation: 'Pauses up to 500ms score 100; longer average pauses reduce the score over 2.5 seconds.',
      },
    },
  };
};

export const analyzeSpeech = (segments: RecognitionSegment[]): SpeechAnalytics => {
  if (segments.length === 0) {
    return {
      wordsPerMinute: 0,
      fillerCount: 0,
      fillerRate: 0,
      fillerCounts: {},
      longestPauseMs: 0,
      averagePauseMs: 0,
      deliveryScore: 0,
      breakdown: {
        speed: { score: 0, explanation: 'No speech segments were provided.' },
        fillers: { score: 0, explanation: 'No speech segments were provided.' },
        pauses: { score: 0, explanation: 'No speech segments were provided.' },
      },
    };
  }

  const words = segments.flatMap((segment) => tokenizeWords(segment.text));
  const fillerCount = countFillerWords(words);
  const fillerCounts = getFillerCounts(words);
  const firstStartMs = Math.min(...segments.map((segment) => segment.startMs));
  const lastEndMs = Math.max(...segments.map((segment) => segment.endMs));
  const durationMs = Math.max(0, lastEndMs - firstStartMs);
  const wordsPerMinute = durationMs > 0 ? (words.length / durationMs) * 60_000 : 0;
  const fillerRate = words.length > 0 ? (fillerCount / words.length) * 100 : 0;
  const pauses = getPauseDurations(segments);
  const longestPauseMs = pauses.length > 0 ? Math.max(...pauses) : 0;
  const averagePauseMs =
    pauses.length > 0 ? pauses.reduce((sum, pause) => sum + pause, 0) / pauses.length : 0;
  const delivery = calculateDeliveryScore(wordsPerMinute, fillerRate, averagePauseMs);

  return {
    wordsPerMinute: round(wordsPerMinute),
    fillerCount,
    fillerRate: round(fillerRate),
    fillerCounts,
    longestPauseMs,
    averagePauseMs: round(averagePauseMs),
    deliveryScore: delivery.score,
    breakdown: delivery.breakdown,
  };
};
