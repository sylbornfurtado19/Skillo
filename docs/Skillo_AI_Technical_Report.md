# Skillo AI — Technical Report
### AI Architecture, Research Engines & API Integration

**Document Type:** Technical Report  
**Platform:** Skillo AI — Next-Gen Interview Simulation & Career Intelligence  
**Version:** 2.0  
**Date:** October 2026  
**Prepared By:** Skillo AI Engineering Team

---

## Table of Contents

1. Executive Summary
2. System Architecture Overview
3. AI Reasoning & Memory Engines
   - 3.1 Prometheus-2 Rubric & Semantic Uncertainty Quantification (SUQ)
   - 3.2 Language Agent Tree Search (LATS)
   - 3.3 GraphRAG — Skill Gap Mapper
   - 3.4 Reflexion Agent — Cross-Session Memory Coach
   - 3.5 SimPO — FAANG Benchmark Comparator
4. IVP Vision & Audio Processing Engines
   - 4.1 LayoutLMv3 — Resume Visual Layout Critic
   - 4.2 L2CS-Net — Eye Contact Coach
   - 4.3 HopeNet — Head Pose & Body Language Reader
   - 4.4 AffectNet — Composure & Emotion Gauge
   - 4.5 SyncNet — Audio-Visual Alignment Tracker
5. AI API Configuration & Provider Layer
6. Interview & Resume API Endpoints
7. Privacy, Security & Data Architecture
8. Research Foundation & Citations
9. Conclusion

---

## 1. Executive Summary

Skillo AI is a full-stack, research-backed technical interview simulation and career intelligence platform. Unlike conventional AI interview tools that rely on a single model call with a static rubric, Skillo integrates ten distinct AI and computer vision research engines — five focused on evaluating what a candidate says, and five evaluating how they say it.

Every engine in the platform is grounded in peer-reviewed research originally designed for fields ranging from game-tree AI to LLM alignment, driver monitoring, and lip-sync verification. Together, they form a cohesive system capable of producing structured, multi-dimensional candidate evaluation reports with mathematical confidence metrics.

This report provides a comprehensive breakdown of each AI component, the research motivating it, its implementation within the codebase, and the API surfaces through which these engines communicate.

---

## 2. System Architecture Overview

Skillo is divided into three tiers. The client layer handles the Next.js App Router, MediaStream audio/video capture, Canvas2D HUDs, and interactive evaluation cards. This communicates over HTTPS with a server API tier that exposes routes for resume analysis, interview evaluation, follow-up generation, and session setup. Beneath the API tier, two parallel engine clusters operate: the AI Reasoning Engines running server-side, and the IVP Vision & Audio Engines running entirely client-side inside the browser. All structured evaluation results are persisted to a Supabase PostgreSQL layer storing candidate skill memory, reflection traces, and session logs.

---

## 3. AI Reasoning & Memory Engines

### 3.1 Prometheus-2 Rubric & Semantic Uncertainty Quantification (SUQ)

**Purpose:** Consistent, statistically confident answer grading.

**The Problem It Solves**

A single AI evaluation pass on a candidate response is inherently non-deterministic. Asking the same model twice for a score on identical input often yields diverging results. This undermines trust in any evaluation system built on a single call.

**How It Works**

Skillo executes N = 3 parallel evaluation passes by default (N = 5 in deep analysis mode). Each pass grades the response against structured rubric criteria, producing a score and a decision summary. Results are clustered into equivalence groups based on score variance (delta <= 0.5). Shannon base-2 Semantic Entropy is calculated across clusters to quantify disagreement:

    SE(x) = - SUM P(c) * log2 P(c)

The resulting entropy score determines a confidence level:

| Entropy (SE)    | Confidence Level | Action                       |
|-----------------|------------------|------------------------------|
| SE < 0.5        | HIGH             | Accept score directly        |
| 0.5 <= SE <= 1.2| MEDIUM           | Soft flag                    |
| SE > 1.2        | LOW              | Trigger validation pass      |

**Implementation File:** src/lib/services/interviewEvaluation.server.ts  
**Research Foundation:** Prometheus 2 (Kim et al., 2024); Semantic Uncertainty (Kuhn et al., ICLR 2023)

---

### 3.2 Language Agent Tree Search (LATS)

**Purpose:** Dynamic, adaptive follow-up question generation that mirrors a real human interviewer.

**The Problem It Solves**

Real interviewers do not read from a static list of questions. They listen, adapt, and branch their line of inquiry based on how well or poorly the candidate is answering. Pre-scripted interview bots fail entirely at this.

**How It Works**

LATS adapts Monte Carlo Tree Search (MCTS) — a classical game-tree algorithm — to the interview domain. After every candidate response, the engine explores exactly three distinct follow-up branches:

- DEEP_DIVE: probe for weaknesses in the stated answer
- PIVOT: transition to a related but unexplored topic
- EDGE_CASE_CHALLENGE: stress-test the candidate's boundary knowledge

A Process Reward Model (PRM) scores each candidate state with a value V in [0, 1]. The engine selects the next action using the Upper Confidence Bound applied to Trees (UCT) formula:

    UCT(s, a) = Q(s, a) + c_puct * P(s, a) * sqrt(N(s)) / (1 + N(s, a))

Where c_puct = 1.414 (sqrt(2)) balances exploration versus exploitation. The engine runs for a configurable number of MCTS rounds (default: 3 on Anthropic, 1 on Groq free tier) per follow-up.

**Implementation File:** src/lib/services/latsEngine.server.ts  
**Research Foundation:** LATS: Language Agent Tree Search (Zhou et al., ICML 2024)

---

### 3.3 GraphRAG — Skill Gap Mapper

**Purpose:** Intelligent resume analysis that traces skill gaps to their root prerequisites.

**The Problem It Solves**

Traditional ATS resume parsers match surface-level buzzwords. They cannot distinguish between a candidate who has used Redis and one who genuinely understands distributed caching theory. More critically, they miss hierarchical dependencies — a missing foundation can silently block multiple advanced skills.

**How It Works**

Skillo constructs a directed entity-relationship knowledge graph from the resume and job description. Node types include SKILL, FRAMEWORK, CONCEPT, and DOMAIN. Edges encode relationships like DEPENDS_ON, APPLIED_IN, and EXPANDS_UPON.

The engine executes a BFS connected-component clustering pass to partition skills into a three-tier hierarchy:

| Level | Type         | Example                |
|-------|--------------|------------------------|
| L0    | Macro Domain | Backend Systems        |
| L1    | Core Pillar  | Distributed Caching    |
| L2    | Leaf Utility | Redis Sentinel         |

It then reverse-traverses the graph to identify which missing foundations are blocking the most advanced skills, surfacing root-cause gaps rather than surface symptoms.

**Implementation File:** src/lib/services/graphRAG.server.ts  
**Research Foundation:** Microsoft Research GraphRAG (Edge et al., arXiv:2404.16130, 2024)

---

### 3.4 Reflexion Agent — Cross-Session Memory Coach

**Purpose:** Persistent candidate skill tracking and personalized adaptation across practice sessions.

**The Problem It Solves**

Most practice platforms evaluate each attempt in complete isolation. They have no knowledge of a candidate's previous sessions, past errors, or long-term improvement trajectory. Every session starts from zero.

**How It Works**

After each evaluation, the Reflexion Agent fires a non-blocking background verbal self-critique (SR_t) summarizing the candidate's demonstrated weaknesses and notable improvements. This reflection payload is persisted to Supabase as structured JSONB.

When the candidate begins a new session, the platform retrieves historical reflection data and uses it to tailor question difficulty, focus areas, and feedback tone.

Candidate proficiency is tracked across a four-state machine:

    NOVICE --> DEVELOPING --> PROFICIENT --> MASTERED

State thresholds:

| State       | Condition                              |
|-------------|----------------------------------------|
| NOVICE      | < 40% progress score                   |
| DEVELOPING  | 40-64%                                 |
| PROFICIENT  | 65-84%                                 |
| MASTERED    | >= 85% across >= 3 attempts            |

**Implementation File:** src/lib/services/reflexionEngine.server.ts  
**Research Foundation:** Reflexion: Language Agents with Verbal Reinforcement Learning (Shinn et al., NeurIPS 2023)

---

### 3.5 SimPO — FAANG Benchmark Comparator

**Purpose:** Measure candidate answer quality relative to top-tier industry benchmark responses.

**The Problem It Solves**

Generic qualitative feedback such as "your answer was somewhat incomplete" is not actionable. Candidates need to understand not just that they fell short, but by how much and in which specific dimensions.

**How It Works**

SimPO compares every candidate answer against a curated pair of preferred (FAANG-quality) and dispreferred (weak) reference responses. It calculates a length-normalized implicit reward score to prevent verbose answers from gaming the metric:

    r_SimPO(x, y) = (beta * qualityScore) / max(1, |y|)

Where beta = 2.0 and the target margin gamma = 0.5. The engine emits structural deltas validated by Zod schema, breaking down the gap across: logic, algorithmic complexity (Big-O), edge case coverage, and communication clarity.

**Implementation File:** src/lib/services/simpoEngine.server.ts  
**Research Foundation:** SimPO: Simple Preference Optimization with Target Reward Margin (Meng et al., ICML 2024)

---

## 4. IVP Vision & Audio Processing Engines

Skillo's Interactive Video Processing (IVP) suite evaluates how a candidate presents themselves during an interview — not just what they say. All five IVP engines run entirely client-side inside the user's browser using Web Workers and OffscreenCanvas. No raw video frames are transmitted to any server.

---

### 4.1 LayoutLMv3 — Resume Visual Layout Critic

**Purpose:** Evaluate resume design quality as a visual document, not just as extracted text.

**How It Works**

Uploaded PDF resumes are treated as visual page images. Elements are extracted with 2D bounding boxes, normalized onto an integer coordinate grid [0, 1000]:

    x0 = floor(left / W * 1000),   y0 = floor(top / H * 1000)

Layout quality rules:

| Rule                | Condition             | Penalty           |
|---------------------|-----------------------|-------------------|
| Left Margin Violation | x0 < 20             | -8 pts (Moderate) |
| Right Overflow       | x1 > 980             | -15 pts (Critical)|
| Column Overlap       | Y-overlap ratio > 30% | -12 pts (Moderate)|

**Implementation File:** src/lib/services/documentVision.server.ts  
**Research Foundation:** LayoutLMv3 (Huang et al., ACM MM 2022)

---

### 4.2 L2CS-Net — Eye Contact Coach

**Purpose:** Detect and quantify sustained eye contact from a standard webcam feed.

**How It Works**

The engine predicts continuous pitch and yaw gaze angles from facial keyframes using soft-argmax expectations over discretized angle bins. Gaze vectors are evaluated against screen-contact bounds (|pitch| <= 12 degrees, |yaw| <= 15 degrees). Deviations sustained longer than 1,500 ms are logged as distraction events, distinguishing genuine looking-away from transient blinks.

**Implementation File:** src/lib/services/ivpGazeEngine.ts  
**Research Foundation:** L2CS-Net (Abdelrahman et al., CVPR 2023)

---

### 4.3 HopeNet — Head Pose & Body Language Reader

**Purpose:** Classify head movement patterns as meaningful body language signals.

**How It Works**

HopeNet predicts continuous 3D Euler angles — Yaw, Pitch, and Roll — from facial bounding crops without requiring landmark keypoints. Angular velocity is computed over rolling 1-second windows. Movement patterns are classified as:

| Gesture     | Condition                                     |
|-------------|-----------------------------------------------|
| Nodding     | Cyclic pitch delta >= 6 degrees in 0.25-0.8s  |
| Head Shaking| Cyclic yaw delta >= 8 degrees in 0.25-0.8s    |
| Restlessness| Elevated sustained angular velocity over session|

**Implementation File:** src/lib/services/ivpPoseEngine.ts  
**Research Foundation:** HopeNet (Ruiz et al., CVPR Workshop 2018)

---

### 4.4 AffectNet — Composure & Emotion Gauge

**Purpose:** Continuously measure candidate emotional composure using a 2D affective dimensional model.

**How It Works**

Rather than labeling discrete emotions, AffectNet maps facial expressions into a continuous 2D valence-arousal space. Valence (V) ranges from -1.0 (negative) to +1.0 (positive). Arousal (A) ranges from -1.0 (calm) to +1.0 (activated). Composure is calculated as the inverse Euclidean distance from a target calm-confidence vector (V = 0.40, A = 0.20):

    Composure = max(0, 100 * (1.0 - sqrt((V-0.40)^2 + (A-0.20)^2) / sqrt(8)))

A Stress Spike Flag is triggered when A >= 0.65 AND V <= -0.30 for >= 3 consecutive keyframes sustained over >= 1.0 second.

**Implementation File:** src/lib/services/ivpAffectEngine.ts  
**Research Foundation:** AffectNet (Mollahosseini et al., IEEE Trans. Affective Computing 2019)

---

### 4.5 SyncNet — Audio-Visual Alignment Tracker

**Purpose:** Verify that audio and video streams are temporally aligned, detecting latency and microphone issues in real time.

**How It Works**

The engine samples speech frequency energy using the browser Web Audio API AnalyserNode and cross-correlates it against visual frame motion energy. A cross-modal distance metric D(v, a) is evaluated, and the optimal temporal offset delta_t is identified.

Status classifications:

| Status               | Condition                              |
|----------------------|----------------------------------------|
| VERIFIED_GENUINE     | D <= 1.15 AND |offset| <= 80ms         |
| LATENCY_LAG_WARNING  | |offset| > 80ms OR D > 1.15            |
| NO_AUDIO_DETECTED    | Audio energy < 0.05                    |

All processing is local — no raw audio is transmitted to external servers.

**Implementation File:** src/lib/services/ivpSyncEngine.ts  
**Research Foundation:** SyncNet (Chung & Zisserman, ACCV 2016)

---

## 5. AI API Configuration & Provider Layer

Skillo's AI reasoning engines are provider-agnostic. The platform supports two backend providers:

| Provider   | Endpoint                                              | Default Model          |
|------------|-------------------------------------------------------|------------------------|
| Anthropic  | https://api.anthropic.com/v1/messages                 | claude-sonnet-5-5      |
| Groq       | https://api.groq.com/openai/v1/chat/completions       | openai/gpt-oss-120b    |

**Configuration File:** src/lib/ai/aiConfig.ts

### Provider Resolution

The platform resolves the active provider in this priority order:
1. Explicit AI_PROVIDER environment variable (anthropic or groq)
2. Whichever API key is present (ANTHROPIC_API_KEY takes priority)
3. Falls back to Anthropic (reported as unconfigured)

### Request Execution Engine

All AI requests route through executeAiRequest() — a resilient execution function with:

- AbortController timeouts per operation type
- Retry-After aware exponential backoff for rate-limited (HTTP 429) responses
- Per-instance concurrency semaphore limiting parallel in-flight calls
- Non-retryable 4xx detection — only transient errors (408, 429, 500, 502, 503, 504) are retried

### Timeout Configuration by Engine

| Operation              | Timeout    |
|------------------------|------------|
| Single evaluation pass | 4,500ms    |
| SimPO scoring          | 12,000ms   |
| LATS branch generation | 15,000ms   |
| Reflexion self-critique| 12,000ms   |
| Resume analysis        | 18,000ms   |
| Interview setup        | 15,000ms   |

### Temperature Settings by Engine

| Engine                     | Temperature | Rationale                         |
|----------------------------|-------------|-----------------------------------|
| Prometheus-2 SUQ           | 0.70        | Diverse multi-pass evaluation     |
| SimPO Contrastive          | 0.25        | Deterministic benchmarking        |
| LATS Branch Generation     | 0.70        | Creative follow-up diversity      |
| Reflexion Self-Critique    | 0.30        | Consistent self-assessment        |
| Resume Extraction          | 0.10        | Precise structured parsing        |

---

## 6. Interview & Resume API Endpoints

### POST /api/interview/setup

Initializes a new interview session. Generates a question set based on candidate role, experience level, and interview type (Technical / Behavioral / System Design). AI calibrates difficulty and topic coverage.

---

### POST /api/interview/evaluate

The primary evaluation endpoint. Accepts a completed response bundle and runs the full AI and IVP engine pipeline simultaneously.

AI Engines Invoked: Prometheus-2 SUQ, SimPO, Reflexion  
IVP Data Accepted: gaze frames, pose frames, affect frames, sync windows

Sample Response:
{
  "overallScore": 88,
  "suqEvaluation": { "semanticEntropy": 0.32, "confidenceLevel": "HIGH" },
  "simpoContrastiveResult": { "preferenceMarginSatisfied": true, "rewardMargin": 0.62 },
  "eyeContactMetrics": { "eyeContactPercentage": 92.4 },
  "affectiveMetrics": { "overallComposureScore": 89.2 }
}

---

### POST /api/interview/followup

Generates the next adaptive interview question using the LATS MCTS engine. Takes the current conversation tree state, PRM score, and last response to select the optimal branch action.

AI Engine Invoked: LATS (Language Agent Tree Search)

---

### POST /api/resume/analyze

Runs the complete resume intelligence pipeline: text extraction, skill graph construction via GraphRAG, and visual layout scoring via LayoutLMv3.

---

### POST /api/resume/extract

Extracts raw structured text from uploaded PDF resumes, normalizing content for downstream GraphRAG and matching engine analysis.

---

### POST /api/resume/rewrite

AI-powered resume rewrite engine that rewrites candidate resume sections to better match a target job description and improve ATS compatibility.

---

### POST /api/code/run

Executes candidate-submitted code snippets in a Piston-compatible sandboxed runtime. Returns execution output, errors, and pass/fail test results.

---

## 7. Privacy, Security & Data Architecture

Skillo is built around privacy-by-design, particularly for the IVP suite that processes webcam and audio data.

Key Privacy Guarantees:

- 100% local video processing: All face tracking, gaze, pose, and emotion processing runs inside the user's browser. No video stream leaves the device.
- Numerical-only export: The telemetry schema exports only mathematical vectors — normalized landmark coordinates, tracking latencies, filter confidences — never raw images.
- Opt-in telemetry: Network telemetry export defaults to disabled (enableTelemetryOptIn: false). Exporting requires explicit user action, generating a local JSON file on the user's filesystem.
- Multi-face isolation: Tracker state is bound to activeFaceId. When a new face enters frame, all templates and state are immediately purged.

Authentication: All server-side API routes validate authenticated sessions via src/lib/server/authenticateRequest.ts, gating all evaluation endpoints behind verified user identity.

Data Persistence: Reflexion memory payloads and evaluation traces are persisted as Supabase JSONB, queryable per userId and sessionId with PostgreSQL row-level security.

---

## 8. Research Foundation & Citations

| #  | Engine          | Paper                                                               | Venue                    |
|----|-----------------|---------------------------------------------------------------------|--------------------------|
| 1  | Prometheus-2    | Kim et al., Prometheus 2: Open Source LM for Fine-Grained Evaluation | arXiv:2405.01535, 2024 |
| 2  | LATS            | Zhou et al., Language Agent Tree Search Unifies Reasoning & Planning | ICML 2024              |
| 3  | GraphRAG        | Edge et al., From Local to Global: A GraphRAG Approach              | MS Research, 2024        |
| 4  | Reflexion       | Shinn et al., Reflexion: Language Agents with Verbal RL             | NeurIPS 2023             |
| 5  | SimPO           | Meng et al., SimPO: Simple Preference Optimization                  | arXiv:2405.14734, 2024   |
| 6  | LayoutLMv3      | Huang et al., LayoutLMv3: Pre-training for Document AI              | ACM MM 2022              |
| 7  | L2CS-Net        | Abdelrahman et al., Fine-Grained Gaze Estimation in the Wild        | CVPR 2023                |
| 8  | HopeNet         | Ruiz et al., Fine-Grained Head Pose Estimation Without Keypoints    | CVPR Workshop 2018       |
| 9  | AffectNet       | Mollahosseini et al., AffectNet: Valence and Arousal in the Wild    | IEEE Trans. AC 2019      |
| 10 | SyncNet         | Chung & Zisserman, Out of Time: Automated Lip Sync in the Wild      | ACCV 2016                |

---

## 9. Conclusion

Skillo represents a meaningful departure from conventional AI interview tools. Rather than treating evaluation as a single model call against a static rubric, it assembles a layered pipeline of ten research-backed AI engines — each addressing a specific, well-defined limitation of simpler approaches.

The evaluation layer ensures scores are statistically confident and benchmarked against real industry standards. The adaptive interview layer dynamically follows the candidate's reasoning, the same way an experienced human interviewer would. The resume analysis layer looks beneath surface keywords to trace skill gaps to their structural roots. And the IVP suite observes, in real time, the non-verbal dimensions of communication that a purely text-based system cannot measure.

Every component of Skillo is grounded in published research and implemented with production-grade engineering standards including full TypeScript strict-mode type safety, Zod schema validation on all AI outputs, comprehensive automated test coverage, and a privacy-first architecture for all video and audio processing.

The platform is purpose-built not just to simulate an interview, but to provide the kind of structured, multi-dimensional, actionable feedback that meaningfully advances a candidate's career readiness.

---

Document End — Skillo AI Technical Report v2.0
© 2026 Skillo AI Engineering Team. MIT License.
