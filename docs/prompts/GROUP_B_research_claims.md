# Skillo: Group B Prompts (Make the Research Claims True)

Run these in order, one per chat. After each: `npx tsc --noEmit`, `npm test`, then commit.
Run Group A prompt 2 (shared AI client + `source` flag) first, because these build on it.

## Paste at the top of every new chat

```
Project: Skillo (Next.js 16 App Router, TypeScript strict, Zod, Jest). Keep existing tests passing, add tests for new logic, don't touch VERCEL_ENV.txt, don't rewrite git history. Show me a short list of files changed at the end.
```

---

## B1. Semantic clustering for Semantic Entropy

```
Problem: computeSemanticEquivalenceAndEntropy in src/lib/services/interviewEvaluation.server.ts clusters passes by overall-score difference <= 0.5, which is not semantic equivalence (Kuhn et al. 2023).

Task: Cluster by meaning of the pass output.
- Build the comparison text for each pass from its criterionEvidence + decisionSummary + feedback.
- Implement bidirectional-entailment-style clustering: use one LLM call (executeAnthropicRequest, temperature 0, Zod-validated JSON) that receives all N pass texts and returns cluster assignments (arrays of pass indices that say semantically the same thing about the candidate).
- Keep the current score-variance clustering as the fallback when the call fails, and record `clusteringMethod: 'semantic-llm' | 'score-variance'` in SUQEvaluationResult.
- Semantic Entropy formula, thresholds (0.3 / 0.8) and N (default 3, 5 in deep mode) stay unchanged.
- Show clusteringMethod in src/components/ui/SUQConfidenceDashboard.tsx.
- Add tests with mocked cluster responses: identical passes, split passes, malformed JSON.
```

**Done when:** the dashboard shows which clustering method was used, and a malformed model response still produces a result via fallback.

---

## B2. Real multi-iteration LATS with a persistent tree

```
Problem: src/lib/services/latsEngine.server.ts runLATSMCTS only expands one level (3 children), scores them once, and picks the best; selectNode is unused; the tree is rebuilt every turn.

Task: Implement a real bounded MCTS.
- Iterate K rounds (K from AI_CONFIG, default 3, capped by a total timeout budget): Selection with computeUCT from the root down to a leaf (use selectNode with correct visit counts), Expansion of that leaf into 3 branches (DEEP_DIVE, PIVOT, EDGE_CASE_CHALLENGE), PRM evaluation, Backpropagation that updates visitCount and running mean Q along the whole path to the root.
- Persist the tree per sessionId: accept an optional previous LATSTreeState in the request body of app/api/interview/followup/route.ts (Zod-validated, size-capped) and return the updated tree so the client sends it back next turn. trajectoryHistory must grow across turns.
- The prior P(s,a) must be a separate field from the PRM value (use uniform 1/3 over siblings, or the LLM's rationale confidence), not the PRM score itself.
- Update src/components/ui/LATSTreeVisualizer.tsx to show depth, visit counts and the selected path.
- Add tests: Q values average correctly, UCT picks unvisited nodes first, depth grows over two turns.
```

**Done when:** two consecutive follow-up calls produce a tree of depth 2+ with visit counts that sum correctly.

---

## B3. Retrieval-based FAANG benchmark answers (CRAG-style)

```
Task: Use data/benchmarks/interview_benchmarks.json at runtime instead of only generating the benchmark answer with the LLM.

- Create src/lib/services/benchmarkRetrieval.server.ts: load the corpus once, build a lightweight retriever (TF-IDF cosine similarity over question text with a domain boost; no new heavy dependency), return top-k with a similarity score.
- Retrieval evaluator (CRAG idea):
    similarity >= 0.45         -> use retrieved `preferred` answer        ("corpus")
    0.25 <= similarity < 0.45  -> combine retrieved entry + LLM-refined   ("hybrid")
    similarity < 0.25          -> generate with the LLM as today          ("generated")
- In generateSimPOContrastiveEvaluation (src/lib/services/simpoEngine.server.ts) add `benchmarkSource: 'corpus' | 'hybrid' | 'generated'` and `retrievalSimilarity` to the result and show them in src/components/ui/SimPOContrastiveCard.tsx.
- Grow the corpus: add at least 20 more entries (frontend, ML engineering, behavioural STAR) following the same schema and 70/15/15 split labels; keep ids unique.
- Tests: exact question match, unrelated question, missing/empty corpus file.
```

**Done when:** a question matching the corpus shows `benchmarkSource: corpus` in the card; an unrelated question shows `generated`.

---

## B4. Evidence-grounded feedback guard

```
Problem: feedback and criterionEvidence from the evaluator can be hallucinated, which the project's own abstract calls out.

Task: Add a grounding verifier in src/lib/services/ and use it in interviewEvaluation.server.ts.
- Change the single-pass prompt so each criterionEvidence entry includes a short verbatim quote from the candidate answer: { claim, quote }.
- After parsing, verify each quote appears (case/whitespace-insensitive, fuzzy match >= 0.85) in the sanitized candidate submission. Compute groundingScore = verified quotes / total quotes per pass and overall.
- Drop or flag unverified evidence. If a pass has groundingScore < 0.5, mark it 'ungrounded' and exclude it from the entropy calculation (record how many were excluded).
- Surface groundingScore in the SUQ dashboard and in src/views/Results.tsx feedback cards (quote highlighted in the candidate's answer).
- Tests: exact quote, paraphrased quote, fabricated quote.
```

**Done when:** a fabricated quote is flagged, the pass is excluded from entropy, and the dashboard shows how many passes were excluded.

---

## Suggested order and grouping

1. B1 then B4 (both touch the evaluator; do them together in one sitting).
2. B2 (self-contained, touches LATS engine, follow-up route and tree visualizer).
3. B3 (touches SimPO; do after Group A prompt 3, the SimPO margin fix, so the two don't conflict).

## Final check for this group

- Run one real interview end to end and confirm every result says `live`, not `fallback`.
- Update the evaluation document: N default, clustering method, LATS iteration depth, benchmark source.
