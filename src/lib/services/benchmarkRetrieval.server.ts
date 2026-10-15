import fs from 'fs';
import path from 'path';

export type BenchmarkSource = 'corpus' | 'hybrid' | 'generated';

export interface BenchmarkEntry {
  id: string;
  domain: string;
  split: 'calibration' | 'validation' | 'test';
  question: string;
  preferred: string;
  dispreferred: string;
}

export interface BenchmarkCorpus {
  version: string;
  description?: string;
  splits?: Record<string, string>;
  entries: BenchmarkEntry[];
}

export interface ScoredBenchmarkMatch {
  entry: BenchmarkEntry;
  similarity: number;
  rawSimilarity: number;
  domainBoostApplied: boolean;
}

export interface RetrievalResult {
  source: BenchmarkSource;
  similarity: number;
  bestMatch: BenchmarkEntry | null;
  topMatches: ScoredBenchmarkMatch[];
}

export interface RetrievalOptions {
  role?: string;
  domain?: string;
  topK?: number;
  corpusPath?: string;
  forceReload?: boolean;
}

// English stop words for technical question retrieval
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from',
  'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him',
  'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me',
  'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only',
  'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so',
  'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there',
  'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was',
  'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would',
  'you', 'your', 'yours', 'yourself', 'yourselves'
]);

/**
 * Tokenizes text into lowercase alphanumeric terms excluding stop words.
 */
export function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

interface PreparedDoc {
  entry: BenchmarkEntry;
  tokens: string[];
  tf: Map<string, number>;
  vector: Map<string, number>;
  norm: number;
}

interface BenchmarkIndex {
  corpusPath: string;
  entries: BenchmarkEntry[];
  idf: Map<string, number>;
  docs: PreparedDoc[];
}

let cachedIndex: BenchmarkIndex | null = null;

const DEFAULT_CORPUS_PATH = path.resolve(process.cwd(), 'data', 'benchmarks', 'interview_benchmarks.json');

/**
 * Reset module-level cache for testing purposes.
 */
export function resetBenchmarkCorpusCache(): void {
  cachedIndex = null;
}

/**
 * Evaluates retrieval similarity score according to CRAG-style routing:
 *  similarity >= 0.45         -> 'corpus'   (use retrieved preferred answer directly)
 *  0.25 <= similarity < 0.45  -> 'hybrid'   (combine retrieved entry + LLM-refined)
 *  similarity < 0.25          -> 'generated' (generate with the LLM as today)
 */
export function evaluateRetrievalRouting(similarity: number): BenchmarkSource {
  if (similarity >= 0.45) return 'corpus';
  if (similarity >= 0.25) return 'hybrid';
  return 'generated';
}

/**
 * Loads the benchmark corpus once from disk and builds the in-memory TF-IDF index.
 * Gracefully handles missing, empty, or malformed corpus files without throwing.
 */
export function loadBenchmarkCorpus(customPath?: string, forceReload = false): BenchmarkIndex {
  const corpusPath = customPath || DEFAULT_CORPUS_PATH;

  if (cachedIndex && cachedIndex.corpusPath === corpusPath && !forceReload) {
    return cachedIndex;
  }

  let entries: BenchmarkEntry[] = [];
  try {
    if (fs.existsSync(corpusPath)) {
      const rawContent = fs.readFileSync(corpusPath, 'utf-8').trim();
      if (rawContent.length > 0) {
        const parsed = JSON.parse(rawContent) as BenchmarkCorpus;
        if (Array.isArray(parsed?.entries)) {
          entries = parsed.entries;
        }
      }
    }
  } catch (err) {
    console.warn(`[BenchmarkRetrieval] Failed to load corpus from ${corpusPath}:`, err);
    entries = [];
  }

  // Build TF-IDF index over question texts
  const totalDocs = entries.length;
  const docTokensList: string[][] = [];
  const dfMap = new Map<string, number>();

  for (const entry of entries) {
    const tokens = tokenize(entry.question);
    docTokensList.push(tokens);
    const uniqueTerms = new Set(tokens);
    for (const term of uniqueTerms) {
      dfMap.set(term, (dfMap.get(term) ?? 0) + 1);
    }
  }

  // Compute smooth IDF: ln(1 + N / (1 + df)) + 1
  const idfMap = new Map<string, number>();
  for (const [term, df] of dfMap.entries()) {
    const idf = Math.log(1 + totalDocs / (1 + df)) + 1;
    idfMap.set(term, idf);
  }

  // Prepare document vectors
  const docs: PreparedDoc[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const tokens = docTokensList[i];
    const tf = new Map<string, number>();
    const len = tokens.length || 1;

    for (const token of tokens) {
      tf.set(token, (tf.get(token) ?? 0) + 1);
    }

    const vector = new Map<string, number>();
    let sumSq = 0;
    for (const [token, count] of tf.entries()) {
      const idf = idfMap.get(token) ?? 1;
      const weight = (count / len) * idf;
      vector.set(token, weight);
      sumSq += weight * weight;
    }

    docs.push({
      entry,
      tokens,
      tf,
      vector,
      norm: Math.sqrt(sumSq),
    });
  }

  const index: BenchmarkIndex = {
    corpusPath,
    entries,
    idf: idfMap,
    docs,
  };

  cachedIndex = index;
  return index;
}

/**
 * Checks if candidate role or domain shares domain context with the benchmark entry.
 */
function isDomainMatch(entryDomain: string, roleOrDomain?: string): boolean {
  if (!roleOrDomain) return false;
  const normalizedQuery = roleOrDomain.toLowerCase();
  const normalizedEntry = entryDomain.toLowerCase();

  if (normalizedQuery.includes(normalizedEntry) || normalizedEntry.includes(normalizedQuery)) {
    return true;
  }

  // Domain synonym mappings
  const keywords: Record<string, string[]> = {
    'distributed systems': ['distributed', 'backend', 'infrastructure', 'platform', 'cloud'],
    'system design': ['system design', 'architect', 'backend', 'scalability', 'infra'],
    'frontend architecture': ['frontend', 'react', 'web', 'ui', 'client', 'javascript', 'typescript'],
    'ml engineering': ['ml', 'machine learning', 'ai', 'data science', 'llm', 'deep learning'],
    'behavioural star': ['behavioural', 'behavioral', 'star', 'leadership', 'management', 'interpersonal'],
  };

  for (const [canonical, syns] of Object.entries(keywords)) {
    if (normalizedEntry.includes(canonical)) {
      if (syns.some(s => normalizedQuery.includes(s))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Retrieves the top-k most similar benchmark entries from the corpus using TF-IDF cosine similarity
 * with domain boost, and returns the CRAG routing evaluation.
 */
export function retrieveBenchmarkAnswer(
  queryQuestion: string,
  options: RetrievalOptions = {}
): RetrievalResult {
  const index = loadBenchmarkCorpus(options.corpusPath, options.forceReload);
  const topK = options.topK ?? 3;

  if (!queryQuestion || index.docs.length === 0) {
    return {
      source: 'generated',
      similarity: 0,
      bestMatch: null,
      topMatches: [],
    };
  }

  const queryTokens = tokenize(queryQuestion);
  if (queryTokens.length === 0) {
    return {
      source: 'generated',
      similarity: 0,
      bestMatch: null,
      topMatches: [],
    };
  }

  // Build query TF-IDF vector
  const queryTf = new Map<string, number>();
  for (const token of queryTokens) {
    queryTf.set(token, (queryTf.get(token) ?? 0) + 1);
  }

  const queryLen = queryTokens.length;
  const queryVector = new Map<string, number>();
  let querySumSq = 0;

  for (const [token, count] of queryTf.entries()) {
    const idf = index.idf.get(token) ?? 1.0;
    const weight = (count / queryLen) * idf;
    queryVector.set(token, weight);
    querySumSq += weight * weight;
  }

  const queryNorm = Math.sqrt(querySumSq);
  if (queryNorm === 0) {
    return {
      source: 'generated',
      similarity: 0,
      bestMatch: null,
      topMatches: [],
    };
  }

  const roleOrDomain = options.domain || options.role;
  const scoredMatches: ScoredBenchmarkMatch[] = [];

  for (const doc of index.docs) {
    if (doc.norm === 0) continue;

    let dot = 0;
    for (const [token, qWeight] of queryVector.entries()) {
      const dWeight = doc.vector.get(token);
      if (dWeight !== undefined) {
        dot += qWeight * dWeight;
      }
    }

    const rawSim = Math.min(1.0, dot / (queryNorm * doc.norm));
    let finalSim = rawSim;
    let domainBoostApplied = false;

    // Apply domain boost (1.15x) if domain aligns and there is non-trivial textual relevance (> 0.05)
    if (rawSim > 0.05 && isDomainMatch(doc.entry.domain, roleOrDomain)) {
      finalSim = Math.min(1.0, rawSim * 1.15);
      domainBoostApplied = true;
    }

    const similarity = Math.round(finalSim * 1000) / 1000;
    scoredMatches.push({
      entry: doc.entry,
      similarity,
      rawSimilarity: Math.round(rawSim * 1000) / 1000,
      domainBoostApplied,
    });
  }

  // Sort descending by similarity
  scoredMatches.sort((a, b) => b.similarity - a.similarity);
  const topMatches = scoredMatches.slice(0, topK);
  const bestMatchItem = topMatches[0];

  const bestSimilarity = bestMatchItem?.similarity ?? 0;
  const bestMatch = bestSimilarity > 0 ? (bestMatchItem?.entry ?? null) : null;
  const source = evaluateRetrievalRouting(bestSimilarity);

  return {
    source,
    similarity: bestSimilarity,
    bestMatch,
    topMatches,
  };
}
