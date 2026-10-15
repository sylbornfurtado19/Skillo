import fs from 'fs';
import path from 'path';
import os from 'os';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  tokenize,
  evaluateRetrievalRouting,
  retrieveBenchmarkAnswer,
  resetBenchmarkCorpusCache,
  loadBenchmarkCorpus,
} from '../src/lib/services/benchmarkRetrieval.server';
import { generateSimPOContrastiveEvaluation } from '../src/lib/services/simpoEngine.server';
import SimPOContrastiveCard from '../src/components/ui/SimPOContrastiveCard';

describe('B3 — Benchmark Retrieval & CRAG Routing (TF-IDF & Cosine Similarity)', () => {
  beforeEach(() => {
    resetBenchmarkCorpusCache();
  });

  describe('Tokenizer & CRAG Threshold Evaluator', () => {
    it('tokenizes query string, strips punctuation and filters English stop words', () => {
      const tokens = tokenize('How would you design a distributed rate limiter for an API gateway?');
      expect(tokens).toContain('design');
      expect(tokens).toContain('distributed');
      expect(tokens).toContain('rate');
      expect(tokens).toContain('limiter');
      expect(tokens).toContain('api');
      expect(tokens).toContain('gateway');
      expect(tokens).not.toContain('how');
      expect(tokens).not.toContain('would');
      expect(tokens).not.toContain('you');
      expect(tokens).not.toContain('a');
      expect(tokens).not.toContain('for');
      expect(tokens).not.toContain('an');
    });

    it('handles empty or blank text gracefully', () => {
      expect(tokenize('')).toEqual([]);
      expect(tokenize('   ')).toEqual([]);
    });

    it('evaluates CRAG routing thresholds correctly', () => {
      expect(evaluateRetrievalRouting(1.0)).toBe('corpus');
      expect(evaluateRetrievalRouting(0.45)).toBe('corpus');
      expect(evaluateRetrievalRouting(0.449)).toBe('hybrid');
      expect(evaluateRetrievalRouting(0.25)).toBe('hybrid');
      expect(evaluateRetrievalRouting(0.249)).toBe('generated');
      expect(evaluateRetrievalRouting(0.0)).toBe('generated');
    });
  });

  describe('Corpus Loading & Resilience to Missing / Empty / Corrupted Files', () => {
    it('gracefully handles non-existent corpus file path without throwing', () => {
      const fakePath = path.join(os.tmpdir(), `non_existent_corpus_${Date.now()}.json`);
      const result = retrieveBenchmarkAnswer('Design a distributed cache.', {
        corpusPath: fakePath,
        forceReload: true,
      });

      expect(result.source).toBe('generated');
      expect(result.similarity).toBe(0);
      expect(result.bestMatch).toBeNull();
      expect(result.topMatches).toEqual([]);
    });

    it('gracefully handles empty corpus file without throwing', () => {
      const emptyFile = path.join(os.tmpdir(), `empty_corpus_${Date.now()}.json`);
      fs.writeFileSync(emptyFile, '');
      try {
        const result = retrieveBenchmarkAnswer('How does consistent hashing work?', {
          corpusPath: emptyFile,
          forceReload: true,
        });

        expect(result.source).toBe('generated');
        expect(result.similarity).toBe(0);
        expect(result.bestMatch).toBeNull();
      } finally {
        if (fs.existsSync(emptyFile)) fs.unlinkSync(emptyFile);
      }
    });

    it('gracefully handles malformed JSON corpus without throwing', () => {
      const malformedFile = path.join(os.tmpdir(), `malformed_corpus_${Date.now()}.json`);
      fs.writeFileSync(malformedFile, '{ "invalidJson": [ unterminated ');
      try {
        const result = retrieveBenchmarkAnswer('Explain the CAP theorem.', {
          corpusPath: malformedFile,
          forceReload: true,
        });

        expect(result.source).toBe('generated');
        expect(result.similarity).toBe(0);
        expect(result.bestMatch).toBeNull();
      } finally {
        if (fs.existsSync(malformedFile)) fs.unlinkSync(malformedFile);
      }
    });
  });

  describe('Retrieval Scenarios: Exact Match, Hybrid, and Unrelated Questions', () => {
    it('exact question match returns similarity >= 0.45 and source "corpus"', () => {
      const question =
        'How would you design a distributed rate limiter for a high-traffic API gateway serving 1M req/s?';
      const result = retrieveBenchmarkAnswer(question, { role: 'Distributed Systems Engineer' });

      expect(result.similarity).toBeGreaterThanOrEqual(0.45);
      expect(result.source).toBe('corpus');
      expect(result.bestMatch).not.toBeNull();
      expect(result.bestMatch?.id).toBe('ds_001');
      expect(result.bestMatch?.preferred).toContain('Redis Sorted Sets');
    });

    it('exact match for new ML Engineering corpus entry returns "corpus"', () => {
      const question =
        'How would you design an end-to-end real-time recommendation system serving 50M daily active users?';
      const result = retrieveBenchmarkAnswer(question, { role: 'Senior ML Engineer' });

      expect(result.similarity).toBeGreaterThanOrEqual(0.45);
      expect(result.source).toBe('corpus');
      expect(result.bestMatch?.id).toBe('ml_001');
      expect(result.bestMatch?.preferred).toContain('Two-tower neural network');
    });

    it('exact match for new Behavioural STAR entry returns "corpus"', () => {
      const question =
        'Tell me about a time you had to resolve a major architectural disagreement with another senior engineer.';
      const result = retrieveBenchmarkAnswer(question, { role: 'Engineering Lead' });

      expect(result.similarity).toBeGreaterThanOrEqual(0.45);
      expect(result.source).toBe('corpus');
      expect(result.bestMatch?.id).toBe('star_001');
      expect(result.bestMatch?.preferred).toContain('Situation:');
    });

    it('unrelated question returns similarity < 0.25 and source "generated"', () => {
      const unrelatedQuestion =
        'What is your favorite recipe for baking sourdough bread with chocolate chips?';
      const result = retrieveBenchmarkAnswer(unrelatedQuestion, { role: 'Baker' });

      expect(result.similarity).toBeLessThan(0.25);
      expect(result.source).toBe('generated');
    });

    it('partially matching question returns similarity in [0.25, 0.45) and source "hybrid"', () => {
      const partialQuestion = 'How would you design a rate limiter for APIs?';
      const result = retrieveBenchmarkAnswer(partialQuestion);

      expect(result.similarity).toBeGreaterThanOrEqual(0.25);
      expect(result.similarity).toBeLessThan(0.45);
      expect(result.source).toBe('hybrid');
      expect(result.bestMatch).not.toBeNull();
    });
  });

  describe('SimPO Engine Integration & Source Transparency', () => {
    it('sets benchmarkSource: "corpus" when question matches benchmark corpus', async () => {
      const result = await generateSimPOContrastiveEvaluation({
        question:
          'How would you design a distributed rate limiter for a high-traffic API gateway serving 1M req/s?',
        candidateAnswer: 'I will use Redis with atomic counter and reset every minute.',
        role: 'Distributed Systems Engineer',
        score: 45,
      });

      expect(result.benchmarkSource).toBe('corpus');
      expect(result.retrievalSimilarity).toBeGreaterThanOrEqual(0.45);
      expect(result.contrastivePair.preferredAnswer.text).toContain('Redis Sorted Sets');
    });

    it('sets benchmarkSource: "generated" when question is completely unrelated to corpus', async () => {
      const result = await generateSimPOContrastiveEvaluation({
        question:
          'What are the key ingredients and cooking steps for authentic homemade Italian pizza?',
        candidateAnswer: 'Flour, yeast, water, salt, knead the dough and bake at 500F.',
        role: 'Pizza Chef',
        score: 75,
      });

      expect(result.benchmarkSource).toBe('generated');
      expect(result.retrievalSimilarity).toBeLessThan(0.25);
    });

    it('sets benchmarkSource: "hybrid" when question is partially related to corpus', async () => {
      const result = await generateSimPOContrastiveEvaluation({
        question: 'Can you explain how to implement rate limiting tokens?',
        candidateAnswer: 'Use a token bucket algorithm with a refill rate and bucket capacity.',
        role: 'Backend Engineer',
        score: 60,
      });

      expect(result.benchmarkSource).toBe('hybrid');
      expect(result.retrievalSimilarity).toBeGreaterThanOrEqual(0.25);
      expect(result.retrievalSimilarity).toBeLessThan(0.45);
    });
  });

  describe('Done-When Acceptance Criterion: SimPOContrastiveCard displays benchmarkSource', () => {
    it('renders "benchmarkSource: corpus" in card when question matches corpus', async () => {
      const contrastiveResult = await generateSimPOContrastiveEvaluation({
        question:
          'How would you design a distributed rate limiter for a high-traffic API gateway serving 1M req/s?',
        candidateAnswer: 'Store timestamps in Redis and prune expired keys.',
        role: 'Distributed Systems Engineer',
        score: 50,
      });

      const html = renderToStaticMarkup(
        React.createElement(SimPOContrastiveCard, { contrastiveResult })
      );

      expect(html).toContain('benchmarkSource: corpus');
      expect(html).not.toContain('benchmarkSource: generated');
    });

    it('renders "benchmarkSource: generated" in card when question is unrelated', async () => {
      const contrastiveResult = await generateSimPOContrastiveEvaluation({
        question:
          'What are the key ingredients and cooking steps for authentic homemade Italian pizza?',
        candidateAnswer: 'Flour, yeast, water, salt, knead the dough and bake at 500F.',
        role: 'Pizza Chef',
        score: 75,
      });

      const html = renderToStaticMarkup(
        React.createElement(SimPOContrastiveCard, { contrastiveResult })
      );

      expect(html).toContain('benchmarkSource: generated');
      expect(html).not.toContain('benchmarkSource: corpus');
    });
  });
});
