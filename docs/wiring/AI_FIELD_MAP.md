# AI Field Map: Response Schemas $\rightarrow$ Screen Pixels

This document establishes the canonical field-level mapping from every AI endpoint and backend reasoning engine to the frontend component and UI line rendering it.

Every AI payload in Skillo visibly contributes to candidate feedback or is omitted from prompt generation.

---

## 1. `/api/interview/evaluate` $\rightarrow$ Assessment Report (`Results.tsx`)

| Response Field | Type | Rendering Component | Source Line | Pixel / UI Surface |
|---|---|---|---|---|
| `overallScore` | `number` (0–100) | `Results.tsx` | `Results.tsx:820` | Central SVG radial score ring & badge |
| `categories.technicalAccuracy` | `number` (0–100) | `Results.tsx` | `Results.tsx:895` | Radar matrix profile & metric breakdown |
| `categories.systemDesignLogic` | `number` (0–100) | `Results.tsx` | `Results.tsx:899` | Radar matrix profile & metric breakdown |
| `categories.edgeCaseHandling` | `number` (0–100) | `Results.tsx` | `Results.tsx:903` | Radar matrix profile & metric breakdown |
| `categories.communication` | `number` (0–100) | `Results.tsx` | `Results.tsx:907` | Radar matrix profile & metric breakdown |
| `interviewerComments` | `string` | `Results.tsx` | `Results.tsx:933` | Assessor evaluation card with persona avatar & quote |
| `suqEvaluation` | `SUQEvaluationResult` | `SUQConfidenceDashboard.tsx` | `Results.tsx:941` | Semantic Entropy gauge, confidence badge, cluster breakdown |
| `simpoContrastiveResult` | `ContrastiveEvaluationResult` | `SimPOContrastiveCard.tsx` | `Results.tsx:949` | Margin ($\Delta q$) meter, FAANG target contrastive delta cards |
| `latsTreeState` | `LATSTreeState` | `LATSTreeVisualizer.tsx` | `Results.tsx:966` | Interactive Monte Carlo search tree, PRM scores & trajectory path |
| `deliveryComposite` | `number` (0–100) | `Results.tsx` | `Results.tsx:539` | Presence & Delivery composite gauge |
| `eyeContactMetrics` | `EyeContactSessionMetrics` | `GazeAnalyticsCard.tsx` | `Results.tsx:1037` | L2CS-Net gaze ray focus zone donut & distraction log |
| `headPoseMetrics` | `HeadPoseSessionMetrics` | `PostureComposureCard.tsx` | `Results.tsx:1044` | HopeNet 3D stability gauge, affirmative nod & shake counter |
| `affectiveMetrics` | `AffectiveSessionMetrics` | `FacialComposureCard.tsx` | `Results.tsx:1051` | AffectNet Valence-Arousal 2D circumplex scatter plot |
| `lipSyncMetrics` | `LipSyncSessionMetrics` | `LipSyncVerificationCard.tsx` | `Results.tsx:1058` | SyncNet audio-visual latency offset & anti-spoofing badge |
| `breakdown[].question` | `string` | `Results.tsx` | `Results.tsx:1152` | Accordion question title |
| `breakdown[].userAnswer` | `string` | `Results.tsx` | `Results.tsx:1186` | Grounded candidate answer with grounded quote mark chips |
| `breakdown[].score` | `number` | `Results.tsx` | `Results.tsx:1157` | Per-question score badge |
| `breakdown[].feedback` | `string` | `Results.tsx` | `Results.tsx:1212` | Qualitative assessor feedback paragraph |
| `breakdown[].suggestions` | `string[]` | `Results.tsx` | `Results.tsx:1248` | Actionable remediation bullet points |
| `evaluationMode` / `source` | `'live' \| 'fallback'` | `Results.tsx`, `SimPOContrastiveCard.tsx` | `Results.tsx:584`, `SimPOContrastiveCard.tsx:76` | Warning badge: "Offline estimate, not a live AI evaluation" |

---

## 2. `/api/interview/setup` $\rightarrow$ Interview Session (`InterviewSession.tsx`, `CareerSetup.tsx`)

| Response Field | Type | Rendering Component | Source Line | Pixel / UI Surface |
|---|---|---|---|---|
| `questions[].id` | `string` | `InterviewSession.tsx` | `InterviewSession.tsx:210` | Unique question telemetry scope key |
| `questions[].question` | `string` | `InterviewSession.tsx` | `InterviewSession.tsx:540` | Live interview teleprompter question card |
| `questions[].duration` | `number` | `InterviewSession.tsx` | `InterviewSession.tsx:545` | Real-time countdown timer clock |
| `questions[].hint` | `string` | `InterviewSession.tsx` | `InterviewSession.tsx:580` | Collapsible interviewer guidance hint drawer |
| `questions[].targetedWeakness` | `string` | `AdaptiveHUDHeader.tsx` | `AdaptiveHUDHeader.tsx:64` | Targeted deficiency alert tag from prior sessions |
| `pastCritiques` | `string[]` | `CareerSetup.tsx` | `CareerSetup.tsx:320` | "Prior Session Insights" memory banner |
| `recalledMemoryNotice` | `string` | `CareerSetup.tsx` | `CareerSetup.tsx:325` | "Candidate Memory Activated" notification badge |

---

## 3. `/api/interview/followup` $\rightarrow$ Adaptive Follow-Up (`InterviewSession.tsx`)

| Response Field | Type | Rendering Component | Source Line | Pixel / UI Surface |
|---|---|---|---|---|
| `followUpQuestion` | `string` | `InterviewSession.tsx` | `InterviewSession.tsx:620` | Dynamic interviewer follow-up challenge modal |
| `actionType` | `LATSActionType` | `AdaptiveHUDHeader.tsx` | `AdaptiveHUDHeader.tsx:82` | Action pill (`DEEP_DIVE`, `PIVOT`, `EDGE_CASE_CHALLENGE`) |
| `prmScore` | `number` (0–1) | `AdaptiveHUDHeader.tsx` | `AdaptiveHUDHeader.tsx:95` | Process Reward Model score progress bar |
| `rationale` | `string` | `AdaptiveHUDHeader.tsx` | `AdaptiveHUDHeader.tsx:102` | Assessor intent explanation drawer |

---

## 4. `/api/resume/analyze` $\rightarrow$ Resume Intelligence (`ResumeUpload.tsx`)

| Response Field | Type | Rendering Component | Source Line | Pixel / UI Surface |
|---|---|---|---|---|
| `matchPercentage` | `number` (0–100) | `ResumeUpload.tsx` | `ResumeUpload.tsx:420` | Hero radial match ring |
| `summary` | `string` | `ResumeUpload.tsx` | `ResumeUpload.tsx:445` | Executive candidate alignment summary paragraph |
| `skillsMatched` | `string[]` | `ResumeUpload.tsx` | `ResumeUpload.tsx:470` | Green checkmark verified skill chips |
| `skillsMissing` | `string[]` | `ResumeUpload.tsx` | `ResumeUpload.tsx:490` | Amber warning deficiency skill chips |
| `scoreBreakdown.formatting` | `number` | `ResumeUpload.tsx` | `ResumeUpload.tsx:515` | Sectional formatting bar gauge |
| `scoreBreakdown.skills` | `number` | `ResumeUpload.tsx` | `ResumeUpload.tsx:520` | Skill density score bar gauge |
| `scoreBreakdown.experienceRelevance` | `number` | `ResumeUpload.tsx` | `ResumeUpload.tsx:525` | Experience alignment bar gauge |
| `scoreBreakdown.impactMetrics` | `number` | `ResumeUpload.tsx` | `ResumeUpload.tsx:530` | STAR quantification bar gauge |
| `graphRAGResult` | `GraphRAGAnalysisResult` | `GraphRAGDashboard.tsx` | `ResumeUpload.tsx:560` | Interactive hierarchical force-directed knowledge graph |
| `graphRAGResult.missingPrerequisiteChains` | `PrerequisiteChain[]` | `PrerequisiteChainViewer.tsx` | `GraphRAGDashboard.tsx:282` | Step-by-step prerequisite learning paths |
| `visualLayoutAnalysis` | `VisualLayoutAnalysisResult` | `VisualDocumentCanvas.tsx` | `ResumeUpload.tsx:585` | LayoutLMv3 canvas bounding box document overlay |
| `visualLayoutAnalysis.penaltyBreakdown` | `PenaltyBreakdown` | `LayoutPenaltyViewer.tsx` | `ResumeUpload.tsx:602` | ATS layout integrity audit card |

---

## 5. Candidate Skill Memory Store $\rightarrow$ Profile (`Profile.tsx`)

| Response Field | Type | Rendering Component | Source Line | Pixel / UI Surface |
|---|---|---|---|---|
| `skillMemoryStore.nodes` | `Record<string, SkillMemoryNode>` | `SkillMemoryGraph.tsx` | `Profile.tsx:387` | Multi-session skill mastery & deficiency radar |
| `skillMemoryStore.nodes[].reflections` | `ReflectionEpisode[]` | `ReflectionTimelineDrawer.tsx` | `SkillMemoryGraph.tsx:155` | Chronological self-critique history drawer |
