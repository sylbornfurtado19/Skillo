import type { SinglePassEvaluation, GroundedEvidence, CriterionEvidence } from '@/types/index';

export interface QuoteVerificationResult {
  verified: boolean;
  similarity: number;
  matchedSubstring?: string;
}

export interface MultiPassGroundingResult {
  verifiedPasses: SinglePassEvaluation[];
  passesForEntropy: SinglePassEvaluation[];
  overallGroundingScore: number;
  excludedPassesCount: number;
  totalQuotes: number;
  totalVerifiedQuotes: number;
}

/**
 * Normalizes text for case-insensitive, whitespace-insensitive comparison.
 */
export function normalizeForGrounding(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9\s"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes standard Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  // Single-row DP optimization
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    const aChar = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const bChar = b.charCodeAt(j - 1);
      const cost = aChar === bChar ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,       // insertion
        prev[j] + 1,           // deletion
        prev[j - 1] + cost     // substitution
      );
    }
    const temp = prev;
    prev = curr;
    curr = temp;
  }

  return prev[n];
}

/**
 * Computes character bigram Dice coefficient in [0, 1].
 */
export function diceBigramSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.length < 2 || b.length < 2) return 0.0;

  const getBigrams = (str: string): Map<string, number> => {
    const map = new Map<string, number>();
    for (let i = 0; i < str.length - 1; i++) {
      const bg = str.slice(i, i + 2);
      map.set(bg, (map.get(bg) ?? 0) + 1);
    }
    return map;
  };

  const aBigrams = getBigrams(a);
  const bBigrams = getBigrams(b);

  let intersection = 0;
  for (const [bg, count] of aBigrams.entries()) {
    if (bBigrams.has(bg)) {
      intersection += Math.min(count, bBigrams.get(bg)!);
    }
  }

  const total = (a.length - 1) + (b.length - 1);
  return total > 0 ? (2 * intersection) / total : 0;
}

/**
 * Verifies whether a quote appears in the sanitized candidate submission
 * using case/whitespace-insensitive matching, sliding-window fuzzy matching (>= threshold, default 0.85).
 */
export function verifyQuoteInText(
  quote: string,
  candidateSubmission: string,
  threshold = 0.85
): QuoteVerificationResult {
  const normQuote = normalizeForGrounding(quote);
  const normSub = normalizeForGrounding(candidateSubmission);

  if (!normQuote || normQuote.length === 0) {
    return { verified: false, similarity: 0 };
  }
  if (!normSub || normSub.length === 0) {
    return { verified: false, similarity: 0 };
  }

  // 1. Direct exact or substring match
  if (normSub.includes(normQuote)) {
    return {
      verified: true,
      similarity: 1.0,
      matchedSubstring: quote,
    };
  }

  // 2. Sliding window fuzzy matching
  const quoteWords = normQuote.split(' ').filter(Boolean);
  const subWords = normSub.split(' ').filter(Boolean);

  if (quoteWords.length === 0 || subWords.length === 0) {
    return { verified: false, similarity: 0 };
  }

  let bestSimilarity = 0;
  let bestMatchSubstring: string | undefined;

  // Window sizes from |quoteWords| - 2 to |quoteWords| + 2
  const minLen = Math.max(1, quoteWords.length - 2);
  const maxLen = Math.min(subWords.length, quoteWords.length + 2);

  for (let wLen = minLen; wLen <= maxLen; wLen++) {
    for (let i = 0; i <= subWords.length - wLen; i++) {
      const sliceWords = subWords.slice(i, i + wLen);
      const candidateSlice = sliceWords.join(' ');

      const maxLenStr = Math.max(normQuote.length, candidateSlice.length);
      const levDist = levenshteinDistance(normQuote, candidateSlice);
      const levSim = maxLenStr > 0 ? 1 - levDist / maxLenStr : 0;
      const diceSim = diceBigramSimilarity(normQuote, candidateSlice);

      const sim = Math.max(levSim, diceSim);
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestMatchSubstring = candidateSlice;
        if (bestSimilarity >= 0.98) break; // early exit on near-exact
      }
    }
    if (bestSimilarity >= 0.98) break;
  }

  const roundedSim = Math.round(bestSimilarity * 1000) / 1000;
  const verified = roundedSim >= threshold;

  return {
    verified,
    similarity: roundedSim,
    matchedSubstring: verified ? bestMatchSubstring : undefined,
  };
}

const CRITERION_KEYS: (keyof CriterionEvidence)[] = [
  'technicalAccuracy',
  'systemDesignLogic',
  'edgeCaseHandling',
  'communicationClarity',
];

/**
 * Evaluates and annotates evidence grounding on a single evaluation pass.
 * Sets groundingScore = verified quotes / total quotes, flags unverified evidence,
 * and marks isUngrounded = true if groundingScore < 0.5.
 */
export function verifyPassGrounding(
  pass: SinglePassEvaluation,
  candidateSubmission: string,
  threshold = 0.85
): SinglePassEvaluation {
  if (!pass.criterionEvidence) {
    pass.groundingScore = 1.0;
    pass.isUngrounded = false;
    return pass;
  }

  const ce = pass.criterionEvidence;
  let totalQuotes = 0;
  let verifiedQuotes = 0;

  for (const key of CRITERION_KEYS) {
    const val = ce[key];
    if (!val) continue;

    if (typeof val === 'object' && val !== null && 'claim' in val) {
      const evidence = val as GroundedEvidence;
      totalQuotes++;
      const res = verifyQuoteInText(evidence.quote, candidateSubmission, threshold);
      evidence.verified = res.verified;
      evidence.similarity = res.similarity;
      if (res.verified) {
        verifiedQuotes++;
        evidence.flagged = false;
      } else {
        evidence.flagged = true;
      }
    } else if (typeof val === 'string') {
      // For string format, look for embedded quotes in quotation marks
      const match = val.match(/"([^"]{4,})"/);
      if (match) {
        totalQuotes++;
        const res = verifyQuoteInText(match[1], candidateSubmission, threshold);
        if (res.verified) {
          verifiedQuotes++;
        }
      }
    }
  }

  const groundingScore = totalQuotes > 0
    ? Math.round((verifiedQuotes / totalQuotes) * 100) / 100
    : 1.0;

  const isUngrounded = groundingScore < 0.5;

  pass.groundingScore = groundingScore;
  pass.isUngrounded = isUngrounded;

  return pass;
}

/**
 * Verifies grounding across all passes, computes overall groundingScore,
 * and excludes passes with groundingScore < 0.5 from semantic entropy calculation.
 */
export function verifyMultiPassGrounding(
  passes: SinglePassEvaluation[],
  candidateSubmission: string,
  threshold = 0.85
): MultiPassGroundingResult {
  let totalQuotes = 0;
  let totalVerified = 0;

  const verifiedPasses = passes.map((pass) => {
    const verifiedPass = verifyPassGrounding(pass, candidateSubmission, threshold);

    if (verifiedPass.criterionEvidence) {
      const ce = verifiedPass.criterionEvidence;
      for (const key of CRITERION_KEYS) {
        const val = ce[key];
        if (typeof val === 'object' && val !== null && 'quote' in val) {
          totalQuotes++;
          if (val.verified) totalVerified++;
        }
      }
    }

    return verifiedPass;
  });

  const passesForEntropy = verifiedPasses.filter((p) => !p.isUngrounded);
  const excludedPassesCount = verifiedPasses.length - passesForEntropy.length;

  const overallGroundingScore = totalQuotes > 0
    ? Math.round((totalVerified / totalQuotes) * 100) / 100
    : 1.0;

  return {
    verifiedPasses,
    passesForEntropy: passesForEntropy.length > 0 ? passesForEntropy : verifiedPasses,
    overallGroundingScore,
    excludedPassesCount,
    totalQuotes,
    totalVerifiedQuotes: totalVerified,
  };
}
