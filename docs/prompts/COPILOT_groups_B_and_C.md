# Skillo: Group B and C Prompts for VS Code Copilot (Agent Mode)

Written for GitHub Copilot Chat. Copilot has a smaller working context than other agents, so every feature is split into short steps that reference exact files with `#file:`.

## How to use

1. Open Copilot Chat, switch to **Agent** mode (not Ask), and pick your strongest available model.
2. Paste the **Setup file** below into `.github/copilot-instructions.md` once. Copilot then applies those rules to every chat, so you don't repeat them.
3. Run one step at a time. Copilot will propose edits and terminal commands; review the diff, accept, then run:
   `npx tsc --noEmit` and `npm test`
4. Start a **new chat** (`+`) for each feature (B1, B2, ...) so context stays small. Steps inside a feature stay in the same chat.
5. Commit after each feature.

> Do Group A prompt 2 first (shared AI client, current model, `source: 'live' | 'fallback'` flag). Group B and C assume it exists.

## Setup file: `.github/copilot-instructions.md`

```markdown
# Skillo project rules
- Stack: Next.js 16 App Router, React 19, TypeScript strict, Tailwind 3, Zod 4, Jest 30.
- Server AI calls go through `executeAnthropicRequest` in src/lib/ai/aiConfig.ts. Never call fetch to the model API directly and never hardcode a model id.
- Every AI engine result must expose `source: 'live' | 'fallback'`. Never present fallback output as a real evaluation.
- Validate all API input with Zod. API routes use the Bearer auth + rate limit pattern from app/api/interview/evaluate/route.ts.
- Use theme tokens (var(--primary), var(--border), ...) for colours. No hardcoded hex or Tailwind palette colours (see THEME.md).
- Add or update Jest tests in tests/ for any new logic. Keep existing tests passing.
- Do not touch VERCEL_ENV.txt. Do not rewrite git history.
- Prefer small, focused edits. Explain which files changed.
```

---

# GROUP B: Make the research claims true

## B1. Semantic clustering for Semantic Entropy

**Step 1: pure clustering helper (no UI)**
```
@workspace Look at #file:src/lib/services/interviewEvaluation.server.ts, specifically computeSemanticEquivalenceAndEntropy. It clusters passes by overall-score difference <= 0.5, which is not semantic equivalence.

Add a new exported async function clusterPassesSemantically(passes) in the same file:
- Build comparison text per pass from criterionEvidence + decisionSummary + feedback.
- One call through executeAnthropicRequest (temperature 0) asking for JSON { clusters: number[][] } where each inner array holds the pass indices that say the same thing about the candidate.
- Validate with Zod. Reject output where indices are missing, duplicated or out of range.
- On any failure return null.
Do not change the entropy formula or thresholds yet.
```

**Step 2: wire it in**
```
In #file:src/lib/services/interviewEvaluation.server.ts, make performInterviewEvaluation use clusterPassesSemantically. If it returns clusters, compute Pc and Semantic Entropy from them; otherwise keep the existing score-variance clustering. Add `clusteringMethod: 'semantic-llm' | 'score-variance'` to SUQEvaluationResult in #file:src/types/index.ts and set it. Default N stays 3, deep mode 5.
```

**Step 3: UI and tests**
```
Show clusteringMethod as a small label in #file:src/components/ui/SUQConfidenceDashboard.tsx. Then add tests in tests/ for: identical passes (one cluster, SE 0), split passes, malformed model JSON (falls back to score-variance). Mock executeAnthropicRequest.
```

---

## B2. Real multi-iteration LATS with a persistent tree

**Step 1: engine rewrite**
```
@workspace Open #file:src/lib/services/latsEngine.server.ts and #file:src/types/index.ts (LATSTreeNode, LATSTreeState).

Currently runLATSMCTS expands one level, scores 3 children once and picks the best; selectNode is unused.
Rewrite it as bounded MCTS:
- K rounds (read K from AI_CONFIG, default 3) with an overall time budget.
- Selection: walk from the root using computeUCT until a leaf.
- Expansion: 3 branches (DEEP_DIVE, PIVOT, EDGE_CASE_CHALLENGE) on that leaf.
- Evaluation: PRM score for each new child.
- Backpropagation: update visitCount and running mean Q on every node up to the root.
- Keep the prior P(s,a) as its own field (uniform 1/3 among siblings), separate from the PRM value.
- Accept an optional previous LATSTreeState as input and continue from it.
Keep the exported function name and the fallback behaviour, and set source: 'fallback' when the model is unavailable.
```

**Step 2: persist across turns**
```
In #file:app/api/interview/followup/route.ts, extend the Zod request schema with an optional `previousTree` (size-capped: max 200 nodes, max depth 6). Pass it to runLATSMCTS and return the updated tree. In #file:src/views/InterviewSession.tsx (around the fetch to /api/interview/followup, line ~564), store the returned tree in state and send it back on the next follow-up.
```

**Step 3: visualiser and tests**
```
Update #file:src/components/ui/LATSTreeVisualizer.tsx to show node depth, visit counts and highlight the selected path. Add tests for: Q is the running mean after backprop, an unvisited node is selected before a visited one, depth grows after two consecutive turns.
```

---

## B3. Retrieval-based FAANG benchmark answers (CRAG-style)

**Step 1: retriever**
```
Create src/lib/services/benchmarkRetrieval.server.ts. Load #file:data/benchmarks/interview_benchmarks.json once (module-level cache). Implement a TF-IDF cosine retriever over the `question` field with a small boost when the domain matches. Export retrieveBenchmark(question, role) returning the top match plus similarity (0..1). No new npm dependency. Handle a missing or empty file by returning null.
```

**Step 2: retrieval evaluator in SimPO**
```
In #file:src/lib/services/simpoEngine.server.ts, inside generateSimPOContrastiveEvaluation, call retrieveBenchmark first:
- similarity >= 0.45: use the retrieved `preferred` text, skip the benchmark-generation LLM call.
- 0.25 to 0.45: ask the model to refine the retrieved answer for this exact question (hybrid).
- below 0.25 or null: generate as today.
Add benchmarkSource ('corpus' | 'hybrid' | 'generated') and retrievalSimilarity to ContrastiveEvaluationResult in #file:src/types/index.ts, and show both in #file:src/components/ui/SimPOContrastiveCard.tsx.
```

**Step 3: grow the corpus and test**
```
Add 20 new entries to #file:data/benchmarks/interview_benchmarks.json following the same schema, ids ds_031 onward unique, covering frontend, ML engineering and behavioural (STAR). Keep split labels around 70/15/15 and update the file's description count. Add tests for: exact question match returns corpus, unrelated question returns generated, missing file returns null.
```

---

## B4. Evidence-grounded feedback guard

**Step 1: verifier**
```
Create src/lib/services/groundingVerifier.ts exporting verifyQuotes(quotes: string[], source: string) returning per-quote { verified: boolean, similarity } and an overall groundingScore. Match is case and whitespace insensitive; accept exact substring or fuzzy similarity >= 0.85 (simple token-level or Levenshtein ratio, no new dependency). Add unit tests: exact, paraphrase, fabricated, empty.
```

**Step 2: prompt and parsing change**
```
In #file:src/lib/services/interviewEvaluation.server.ts, update the single-pass prompt and singlePassSchema so each criterionEvidence entry is { claim: string, quote: string } where quote is verbatim from the candidate answer. Keep backward compatibility: accept plain strings and treat them as unverified. Update CriterionEvidence in #file:src/types/index.ts.
```

**Step 3: apply in evaluation and show in UI**
```
In performInterviewEvaluation run verifyQuotes on each pass against the sanitized submission. A pass with groundingScore < 0.5 is marked 'ungrounded' and excluded from entropy (record excludedPasses). Add groundingScore and excludedPasses to SUQEvaluationResult. Show them in #file:src/components/ui/SUQConfidenceDashboard.tsx, and in #file:src/views/Results.tsx highlight verified quotes inside the candidate's answer in the feedback cards.
```

---

# GROUP C: Missing features from the document

## C1. Code editor and sandboxed execution

**Step 1: runner API**
```
Create app/api/code/run/route.ts following the auth, rate-limit (5/min) and Zod pattern of #file:app/api/interview/followup/route.ts. Body: { language: 'javascript'|'typescript'|'python'|'java', source: string (max 10 KB), stdin?: string }. Execute through an external sandbox only: POST to env CODE_RUNNER_URL (Piston-compatible API), 5 s timeout. If CODE_RUNNER_URL is unset return 501 { message: 'Code runner not configured' }. Never execute code in the Next.js process. Return { stdout, stderr, exitCode, timeMs }. Add route tests for validation, size limit and the 501 case.
```

**Step 2: editor component**
```
Install @monaco-editor/react. Create src/components/interview/CodeWorkspace.tsx: dynamic import with ssr false, language dropdown, theme that follows document.documentElement.dataset.theme (light or dark), Run button calling /api/code/run with the Bearer token (look at how #file:src/views/InterviewSession.tsx calls /api/interview/followup), output panel for stdout/stderr, and a clear message for 501. Use theme tokens for colours.
```

**Step 3: integrate with the interview and evaluator**
```
In #file:src/views/InterviewSession.tsx show CodeWorkspace when the question belongs to a coding mode (check #file:src/types/interviewModes.ts). Include codeAnswer { language, source, stdout, stderr } in the payload sent to /api/interview/evaluate. In #file:app/api/interview/evaluate/route.ts extend evaluateSchema with an optional codeAnswer, and in #file:src/lib/services/interviewEvaluation.server.ts add the code and its run output to the submission text with a short instruction to judge complexity, edge cases and readability.
```

---

## C2. Speech analytics

**Step 1: pure analytics module**
```
Create src/lib/services/speechAnalytics.ts with pure functions and unit tests. Input: array of { text: string, startMs: number, endMs: number } recognition segments. Output: wordsPerMinute, fillerCount and fillerRate per 100 words (um, uh, like, you know, basically, actually, so), longestPauseMs, averagePauseMs, and deliveryScore 0-100 with a breakdown object explaining each component. Handle empty input.
```

**Step 2: capture timestamps**
```
In #file:src/views/InterviewSession.tsx, around the SpeechRecognition setup (line ~344), record a segment { text, startMs, endMs } for each final result relative to the answer start. Compute analytics when the answer is submitted, keep them per question in state, and add an optional speechAnalytics field to the payload for /api/interview/evaluate (extend evaluateSchema in #file:app/api/interview/evaluate/route.ts and the report type in #file:src/types/index.ts).
```

**Step 3: Results card**
```
In #file:src/views/Results.tsx add a "Delivery" card: WPM with a 120-160 target band, filler word list with counts, pause summary. Use icons plus text labels (not colour only) and theme tokens. If no speech data exists, show a short note instead of the card. If SpeechRecognition is unsupported, make InterviewSession show a notice and keep typing available.
```

---

## C3. Personalised study plan from skill memory

**Step 1: plan generator**
```
Create src/lib/services/studyPlan.ts. Input: CandidateSkillMemoryStore (see #file:src/types/index.ts and #file:src/lib/services/reflexionService.ts) and optional prerequisite chains from GraphRAG. Output: 7 dated days, each with { skillId, skillName, taskType, focus, minutes }. Rules: HIGH severity and NOVICE first; prerequisites before dependents; spaced repetition at day 1, 3 and 7 depending on proficiencyLevel; max 45 minutes per day. Deterministic, no LLM. Add tests: ordering, repetition dates, empty store.
```

**Step 2: UI**
```
Add a "Study Plan" section to #file:src/views/Profile.tsx using the generator and the existing skillMemoryStore, and a "Next best session" card to #file:src/views/Dashboard.tsx. Show an empty state with a "Take your first interview" button when there is no memory. Use existing Card and Badge components and theme tokens.
```

**Step 3: pre-fill setup**
```
In #file:src/views/CareerSetup.tsx, when arriving with the query param ?from=plan, pre-fill domain, role and difficulty from the top-priority skill in the study plan. Add a "Start this session" button on the Dashboard card that navigates there.
```

---

## C4. Resume rewriter and JD tailoring

**Step 1: service and route**
```
Create app/api/resume/rewrite/route.ts using the auth, rate limit and Zod pattern of #file:app/api/resume/analyze/route.ts. Input: resumeText, jobTitle, jobDescription. Logic in #file:src/lib/services/resumeAnalysis.server.ts (new exported function): find up to 5 weakest bullet lines using computeImpactMetricsScore density, then return [{ original, rewritten, reason, targetSkill, metricPlaceholders }]. Rewrites use an action verb plus a quantified outcome using placeholders like [X%] and never invent numbers. If the model is unavailable use a rule-based verb upgrade and mark source: 'fallback'. Validate output with Zod.
```

**Step 2: UI and tests**
```
In #file:src/views/ResumeUpload.tsx add a "Suggested rewrites" panel after the analysis: before/after side by side, copy button, and the targeted JD skill as a Badge. Never apply changes automatically. Add tests: no digits are invented beyond those in the original line, empty resume returns [].
```

---

## C5. Calibration dashboard and vision fusion

**Step 1: calibration script**
```
Extend #file:scripts/eval/verify_ai_benchmarks.ts (or add scripts/eval/calibration.ts) to run the validation and test splits from #file:data/benchmarks/interview_benchmarks.json through the evaluator. Report: pairwise accuracy (preferred outscores dispreferred), mean confidence per tier, Expected Calibration Error (10 bins). Write results to docs/calibration-latest.json. If ANTHROPIC_API_KEY is missing, write { skipped: true, reason } and never report fallback scores as results.
```

**Step 2: calibration page**
```
Add an admin-only page at app/(app)/calibration/page.tsx that reads docs/calibration-latest.json through a server component and renders accuracy, ECE and a confidence vs accuracy bar chart using the existing Chart.js setup in #file:src/lib/chartSetup.ts. Gate it with an env ADMIN_EMAILS allow-list checked server side.
```

**Step 3: delivery composite**
```
Create src/lib/services/deliveryComposite.ts: combine eye-contact ratio, posture stability, affect composure (from the IVP timeline, see #file:src/lib/services/ivpTimelineTransformer.ts) and speech deliveryScore (C2) into a 0-100 deliveryComposite. Keep weights in one exported constant and re-normalise over the signals that are present. Add tests for missing signals. Add the value to the EvaluationReport type in #file:src/types/index.ts.
```

**Step 4: show it separately**
```
In #file:src/views/Results.tsx add a "Presence & Delivery" section showing deliveryComposite with its components and an explanation of which signals were available. It must never change the technical score. Show a short note when camera signals were not captured.
```

---

## Tips for Copilot

- If Copilot edits too many files, reply: "Only change the files named in the prompt. Revert the rest."
- If it stops after a plan, reply: "Proceed and make the edits."
- Use `/tests` on a finished file if a step's tests are thin.
- Attach files with `#file:` rather than describing them; `@workspace` helps it find callers (for example "where is generateSimPOContrastiveEvaluation used").
- Run `npx tsc --noEmit` after each step. Paste any errors back into the same chat.
- Suggested overall order: B4 -> B1 -> B2 -> B3 -> C2 -> C5 steps 3-4 -> C1 -> C3 -> C4 -> C5 steps 1-2.
