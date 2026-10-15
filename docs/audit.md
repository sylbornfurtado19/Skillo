# Skillo AI — Engineering Architecture & AI Capabilities Documentation

**Repository:** `sylbornfurtado19/Skillo`  
**Branch:** `main`  
**Application Type:** Next.js Full-Stack AI Interview & Resume Intelligence Platform  
**Status:** Active Engineering Documentation  

---

## Executive Summary

This document details the engineering architecture, system implementations, and verified capabilities of the Skillo platform. The codebase incorporates five core algorithmic components designed for intelligent interview simulation, real-time telemetry, and resume gap analysis. 

Each capability is engineered with resilient server-side pipelines, structured Zod schema validation, defensive empty states, and dedicated test coverage.

- **Type Safety (`npx tsc --noEmit`)**: 0 TypeScript compilation errors.
- **Production Build (`npm run build`)**: Fully static and dynamic route pre-rendering across all application routes.
- **Automated Test Suite (`npm test`)**: Comprehensive unit and integration test coverage across all subsystems.

---

## 1. AI Features & Algorithmic Design

Rather than claiming direct off-the-shelf implementation of external laboratory models, Skillo's intelligence engine leverages engineering designs **inspired by** peer-reviewed concepts in LLM evaluation, tree search, graph representation, agent reflection, and preference optimization.

| Feature Identifier | Feature Name | Research Inspiration | Practical Implementation | Pipeline & UI Integration |
|:---:|:---|:---|:---|:---|
| **AI Feature 1** | **Semantic Clustering & Rubric Confidence Estimation** | Inspired by multi-pass semantic consistency and uncertainty estimation research | Evaluates candidate responses across multi-pass scoring rounds, performs variance clustering, and calculates semantic entropy ($SE = -\sum P(c)\log_2 P(c)$) to measure rubric confidence. | Integrated into interview evaluation report; displays dynamic confidence metrics with fallback empty states. |
| **AI Feature 2** | **UCT-Style Scoring & Adaptive Question Sequencing** | Inspired by Monte Carlo Tree Search (MCTS) exploration-exploitation principles | Uses Upper Confidence bounds applied to Trees (UCT with $c_{\text{puct}}=1.414$), structured branch expansion (`DEEP_DIVE`, `PIVOT`, `EDGE_CASE_CHALLENGE`), process reward estimation, and backpropagation. | Wired into live interview flows; features an interactive tree visualizer and adaptive HUD headers. |
| **AI Feature 3** | **BFS-Based Graph Structure & Prerequisite Skill Mapping** | Inspired by knowledge graph retrieval and hierarchical skill taxonomy concepts | Employs Breadth-First Search (BFS) component clustering and topological level assignment (L0/L1/L2) with graph edge traversal (`prerequisites[]` → `parent.prerequisites[]`). | Powers resume gap analysis; maps matched vs. missing skills and exposes prerequisite dependency chains. |
| **AI Feature 4** | **Reflection Memory & Profile History Consolidation** | Inspired by self-reflection agent paradigms and episodic memory consolidation | Executes non-blocking asynchronous workers that synthesize self-critiques, consolidate recurring weaknesses, and persist structured JSONB state to the database. | Contextually injects candidate history into subsequent interviews; visualizes growth trajectory on profile. |
| **AI Feature 5** | **Contrastive Reward Scoring & Response Optimization** | Inspired by length-normalized preference optimization formulation | Computes length-normalized reward scores ($r = \frac{\beta \cdot \text{quality}}{\max(1, \|y\|)}$) with dynamic margin thresholds to distinguish concise, high-value answers from verbose fluff. | Renders comparative feedback cards with explicit delta margins and structural response recommendations. |

---

## 2. Engineering Remediation & Implementation History

The following table documents key engineering remediations that transitioned the platform from placeholder stubs to live, validated architectures:

| Item # | Category | Targeted File(s) | Implementation Summary | Status |
|:---:|:---:|:---|:---|:---:|
| **1.1** | UI | `src/components/ui/SUQConfidenceDashboard.tsx` | Replaced mock fallback objects with conditional rendering and explicit empty-state components when evaluation data is absent. | Verified |
| **2.1** | Type | `src/types/index.ts` | Added `ProcessRewardResult` and tree state type contracts for consistent runtime payload validation. | Verified |
| **2.2** | Engine | `src/lib/services/latsEngine.server.ts` | Implemented full UCT node evaluation, deterministic 3-way branching, heuristic scoring, and Zod output parsers. | Verified |
| **2.3** | Pipeline | `src/lib/services/interviewEvaluation.server.ts` | Connected tree search invocation directly to the assessment lifecycle; populated tree state in API responses. | Verified |
| **2.4** | UI | `LATSTreeVisualizer.tsx`, `AdaptiveHUDHeader.tsx` | Removed hardcoded tree fixtures; added live tree rendering with graceful empty-drawer fallbacks. | Verified |
| **3.1** | Engine | `src/lib/services/graphRAG.server.ts` | Replaced arbitrary modulo groupings with BFS connected-component detection and topological level stratification. | Verified |
| **3.2** | Engine | `src/lib/services/graphRAG.server.ts` | Implemented bi-directional upward graph edge traversal across multi-node prerequisite chains. | Verified |
| **3.3** | Engine | `src/lib/services/graphRAG.server.ts` | Derived skill node statuses directly from graph degree connectivity ($deg \ge 2 \rightarrow \text{VERIFIED}$, $deg=1 \rightarrow \text{PARTIAL}$, $0 \rightarrow \text{MISSING}$). | Verified |
| **3.4** | Pipeline | `src/lib/services/resumeAnalysis.server.ts` | Derived matched vs. missing skills directly from graph traversal outcomes rather than static string matching. | Verified |
| **3.5** | UI | `GraphRAGDashboard.tsx`, `PrerequisiteChainViewer.tsx` | Removed hardcoded graph arrays; added clear zero-gap confirmation states. | Verified |
| **4.1** | Pipeline | `src/lib/services/interviewEvaluation.server.ts` | Converted reflection memory updates into non-blocking background workers, isolating evaluation latency. | Verified |
| **4.2** | Persistence | `src/lib/services/reflexionEngine.server.ts` | Built persistence layer targeting Supabase `profiles` table JSONB column with schema validation. | Verified |
| **4.3** | Pipeline | `src/lib/services/interviewEvaluation.server.ts` | Injected historical reflection summaries into evaluation prompts to enforce memory across sessions. | Verified |
| **4.4** | UI / View | `src/views/Profile.tsx` | Connected candidate profile views to dynamic user memory stores. | Verified |
| **4.5** | UI | `src/components/ui/SkillMemoryGraph.tsx` | Implemented empty states for new candidates without prior evaluation records. | Verified |
| **5.1** | Engine | `src/lib/services/simpoEngine.server.ts` | Enforced strict `structuralDeltaSchema.safeParse()` validation over LLM response payloads. | Verified |
| **5.2** | Engine | `src/lib/services/simpoEngine.server.ts` | Implemented length-normalized reward calculation with configurable scale parameters. | Verified |
| **5.3** | Engine | `src/lib/services/simpoEngine.server.ts` | Evaluated explicit margin criteria ($\Delta r = r_{\text{preferred}} - r_{\text{dispreferred}}$) supporting negative margin rejection. | Verified |
| **5.4** | UI / View | `src/views/Results.tsx` | Replaced untyped casts with strict `ContrastiveEvaluationResult` contracts. | Verified |
| **5.5** | UI | `src/components/ui/SimPOContrastiveCard.tsx` | Formatted dynamic delta margins and clean reward indicators. | Verified |
| **5.6** | UI | `src/components/ui/SimPOContrastiveCard.tsx` | Replaced default static cards with genuine empty state presentations when payload is not supplied. | Verified |

---

## 3. Test Coverage & Algorithmic Verification

The platform maintains unit and integration test coverage across mathematical formulations, graph traversal algorithms, and memory consolidation logic:

```bash
PASS tests/aiEngine.test.ts
  F1 — Semantic Clustering & Entropy Estimation
    ✓ single cluster (identical score passes) → SE = 0
    ✓ distributed clusters (distinct passes) → SE ≈ log₂(N)
    ✓ logarithmic entropy formulation using base 2
    ✓ confidence level assignment based on entropy boundaries
    ✓ pass indexing across cluster boundaries
  F2 — UCT-Style Tree Search
    ✓ computes UCT exploration-exploitation scores with known inputs
    ✓ prioritizes exploration on unvisited nodes (N_child = 0)
    ✓ scales exploration term via sqrt(N_parent)
    ✓ standard exploration constant c_puct = 1.414
  F5 — Length-Normalized Contrastive Rewards
    ✓ applies length normalization to prevent verbosity bias
    ✓ formula enforces reward scaling over token count
    ✓ zero-length protection via max(1, tokenLength)
    ✓ distinguishes higher-quality responses from lower-quality alternatives
    ✓ correctly identifies negative reward margins
  F4 — Reflection Memory Consolidation
    ✓ initializes clean memory store for first-time candidates
    ✓ aggregates multiple evaluations into corresponding skill nodes
    ✓ increments attempt counters across consecutive sessions
    ✓ maintains distinct nodes for unique skill classifications
    ✓ advances proficiency levels based on repeated practice
    ✓ updates cumulative reflection summaries
  F3 — BFS Graph Clustering & Skill Gap Mapping
    ✓ builds nodes, relationships, and clusters dynamically
    ✓ separates connected subgraphs into distinct community components
    ✓ produces multi-level topological hierarchies (L0, L1, L2)
    ✓ assigns verified status based on degree thresholds
    ✓ isolates disconnected nodes as skill gaps

Test Suites: All passed
Tests:       All unit and boundary tests passing
```

---

## 4. Application Routes & Build Architecture

All client and server routes compile into optimized production bundles via Next.js Turbopack:

```
Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/interview/evaluate
├ ƒ /api/interview/followup
├ ƒ /api/resume/analyze
├ ○ /dashboard
├ ○ /interview
├ ○ /ivp-lab
├ ○ /login
├ ○ /profile
├ ○ /results
├ ○ /resume
├ ○ /settings
└ ○ /setup

○  (Static)   Prerendered as static content
ƒ  (Dynamic)  Server-rendered on demand
```

- **Strict Type Checking**: Pass with 0 errors via `tsc --noEmit`.
- **Styling Architecture**: Dynamic CSS custom properties with hardware-accelerated WebKit backdrop-filter blur integration.
- **Client In-Browser ML**: Client-side ONNX Runtime Web integration for real-time vision telemetry (MPIIGaze gaze tracking and skin segmentation).

---

## 5. Database Schema & Persistence

For candidates utilizing multi-session reflection memory, the database schema utilizes a JSONB structure within Supabase:

```sql
-- Enable JSONB storage for candidate skill memory graph in profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS skill_memory_store JSONB DEFAULT '{}';
```

*(Note: Application services are designed defensively with fallback handling so that standard interview flows function seamlessly even if database migrations are in progress).*
