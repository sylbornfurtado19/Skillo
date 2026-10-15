# Skillo: Group C Prompts (Missing Features From the Document)

Run these in order, one per chat. After each: `npx tsc --noEmit`, `npm test`, then commit.
C1 and C5 are the largest; if the tool runs out of room, ask it to finish "part 1" first and continue in a new message.

## Paste at the top of every new chat

```
Project: Skillo (Next.js 16 App Router, TypeScript strict, Zod, Jest). Keep existing tests passing, add tests for new logic, don't touch VERCEL_ENV.txt, don't rewrite git history. Show me a short list of files changed at the end.
```

---

## C1. Real code editor and sandboxed execution

```
Problem: the document promises a "code editor" workspace, but answers are plain text and there is no editor dependency.

Task:
- Add @monaco-editor/react, loaded with next/dynamic (ssr: false) only in the interview session. Create src/components/interview/CodeWorkspace.tsx with a language selector (JavaScript, TypeScript, Python, Java), a theme that follows data-theme light/dark, and a "Run" button.
- Create app/api/code/run/route.ts that executes code through an external sandbox (Piston public API or Judge0, endpoint from env CODE_RUNNER_URL; if unset return 501 with a clear message). Bearer auth, Zod validation, 5/min rate limit, 10 KB source cap, 5 s execution limit. Never execute code on the Next.js server itself.
- In src/views/InterviewSession.tsx show CodeWorkspace for coding questions (check src/types/interviewModes.ts, e.g. google-swe-coding). Include the code and run output in the answer payload sent to /api/interview/evaluate: extend the Zod schema with optional codeAnswer { language, source, stdout, stderr }, and add a code-review note to the evaluator prompt (complexity, edge cases, readability).
- Tests for the route's validation and limits.
```

**Done when:** a coding question shows the editor, Run returns output (or a clear "runner not configured" message), and the code reaches the evaluator.

---

## C2. Speech analytics (delivery metrics)

```
Add delivery analytics from the existing Web Speech API transcript flow in src/views/InterviewSession.tsx (around line 344).

- Create src/lib/services/speechAnalytics.ts (pure functions, unit-tested): words per minute, filler-word count and rate (um, uh, like, you know, basically, actually, so), longest pause, average pause using result timestamps, and a 0-100 deliveryScore with explained components.
- Capture timestamps per recognition result, compute analytics per answer, include them in the evaluate payload (Zod-validated, optional) and in the final report.
- Show a "Delivery" card in src/views/Results.tsx: WPM gauge with a 120-160 target band, filler list, pause timeline. Use text labels in addition to colours.
- If SpeechRecognition is unsupported, show a clear notice and let the user type; do not break the flow.
```

**Done when:** after a spoken answer, Results shows WPM, filler count and pauses; typing-only sessions still work.

---

## C3. Personalised study plan from skill memory

```
Use the existing CandidateSkillMemoryStore (src/types/index.ts, src/lib/services/reflexionService.ts) to create an actionable plan.

- src/lib/services/studyPlan.ts: given skill nodes (proficiencyLevel, remediationProgress, severity history, lastUpdated) and optional GraphRAG prerequisite chains, produce a 7-day plan:
    * prioritise HIGH severity + NOVICE skills
    * order prerequisites before dependents
    * schedule spaced repetition (revisit after 1, 3, 7 days based on level)
    * assign a concrete practice task per day (question type + focus + estimated minutes)
  Deterministic logic first; optionally one LLM call to phrase tasks, with a template fallback.
- Add a "Study Plan" section to src/views/Profile.tsx and a "Next best session" suggestion on src/views/Dashboard.tsx. src/views/CareerSetup.tsx should be able to pre-fill domain and difficulty from the top-priority skill.
- Tests: ordering, spaced-repetition dates, empty memory store.
```

**Done when:** a profile with skill memory shows a dated 7-day plan, and an empty profile shows a sensible empty state.

---

## C4. Resume rewriter and JD tailoring

```
Extend src/lib/services/resumeAnalysis.server.ts and add app/api/resume/rewrite/route.ts (same Bearer auth, rate-limit and Zod pattern as app/api/resume/analyze/route.ts).

- For up to 5 weakest bullet points (lowest impact-metric density from computeImpactMetricsScore), return { original, rewritten, reason, addedMetricPlaceholders }. Rewrites use action verb + quantified outcome and never invent numbers: use [X%] placeholders the user must fill.
- Map each rewrite to the JD skill it strengthens (from skillsMissing / GraphRAG nodes).
- UI: in src/views/ResumeUpload.tsx add a "Suggested rewrites" panel with copy buttons and a before/after diff. Never auto-apply.
- Output is Zod-validated, with a rule-based fallback (verb upgrade list) when the model call fails, flagged source: 'fallback'.
- Tests: no-invented-numbers rule, empty resume.
```

**Done when:** an uploaded resume shows up to 5 rewrites with placeholders instead of fabricated numbers.

---

## C5. Calibration dashboard and fusing vision signals into the report

```
Two integration pieces. Do part 1 first, then part 2.

PART 1: Calibration.
- Create a script and an admin-only page /calibration (or extend scripts/eval/verify_ai_benchmarks.ts) that runs the benchmark corpus's validation + test splits (data/benchmarks/interview_benchmarks.json) through the evaluator and reports: pairwise accuracy (preferred must outscore dispreferred), mean confidence per tier, and Expected Calibration Error.
- Persist the last result as JSON under docs/ and render it on the page with the existing Chart.js setup (src/lib/chartSetup.ts).
- With no API key, state clearly that the run was skipped; never report fallback numbers as results.

PART 2: Vision fusion.
- The IVP suite already produces gaze, posture, affect and lip-sync signals (src/lib/services/ivpTimelineTransformer.ts, src/components/ui/*Card.tsx). Define a documented `deliveryComposite` (0-100) combining eye-contact ratio, posture stability, affect composure and speech analytics (if available). Keep the weights in one constant and re-normalise when signals are missing.
- Add it to the final EvaluationReport and show it as a separate "Presence & Delivery" section in src/views/Results.tsx. It is never mixed into the technical score.
- Tests for missing-signal re-normalisation.
```

**Done when:** `/calibration` shows ECE and pairwise accuracy for a live run, and Results shows a separate Presence & Delivery section.

---

## Suggested order

1. C2 then C5 part 2 (speech analytics feeds the delivery composite).
2. C1 (largest; its own chat).
3. C3 and C4 (independent, any order).
4. C5 part 1 last, once the evaluator changes from Group B are done, so the calibration numbers reflect the final engine.

## Final check for this group

- Update the evaluation document: code editor, speech analytics, study plan, resume rewriter, calibration results.
- Add the IVP vision suite to the document as its own module, since it is implemented but not currently described.
