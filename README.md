# Skillo AI — Next-Gen AI Technical Interview Simulation & Career Intelligence Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.2.12-black?style=for-the-badge&logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8_Strict-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.17-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database_%26_Auth-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Jest](https://img.shields.io/badge/Jest-100%25_Pass-C21325?style=for-the-badge&logo=jest)](https://jestjs.io/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

**Skillo AI** is a state-of-the-art technical interview simulation and career intelligence platform designed for software engineers, systems architects, and technical leaders. By uniting **5 LLM Reasoning Core Engines** with **5 Computer Vision & Audio Signal Engines (IVP)**, Skillo AI transforms technical interview preparation from subjective guesswork into a rigorous, multi-modal science.

---

## 🏛️ System Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT WORKSPACE LAYER                                   │
│  [Next.js App Router]  [MediaStream Audio/Video]  [Canvas2D HUDs]  [Interactive Cards]   │
└──────────────────────────────────────────┬──────────────────────────────────────────────┘
                                           │
                                     HTTPS │ JSON Payloads / Frames
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                SERVER / API ROUTE TIER                                  │
│            /api/resume/analyze         │         /api/interview/evaluate                │
└────────────────────┬───────────────────┴────────────────────┬───────────────────────────┘
                     │                                        │
                     ▼                                        ▼
┌─────────────────────────────────────────┐  ┌───────────────────────────────────────────┐
│        AI REASONING ENGINES             │  │         IVP VISION & AUDIO ENGINES         │
│  1. Prometheus-2 Rubric + SUQ Engine    │  │  6. LayoutLMv3 Visual Document AI         │
│  2. LATS MCTS Adaptive Interviewer      │  │  7. L2CS-Net 3D Gaze Estimation           │
│  3. GraphRAG Skill Gap Mapper           │  │  8. HopeNet 3D Head Pose & Gestures       │
│  4. Reflexion Agent & Dynamic Memory    │  │  9. AffectNet Facial Composure            │
│  5. SimPO Contrastive Evaluator         │  │ 10. SyncNet Audio-Visual Lip-Sync         │
└────────────────────┬────────────────────┘  └────────────────────┬──────────────────────┘
                     │                                            │
                     └────────────────────┬───────────────────────┘
                                          │ Structured Evaluation Report
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                             SUPABASE PERSISTENCE LAYER                                  │
│           [PostgreSQL]  [Auth API]  [JSONB Skill Memory Store & Traces]                  │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔬 Core Architectural & Research Engines

Skillo AI integrates 10 distinct AI and Computer Vision research engines to deliver end-to-end evaluation:

### Part A: AI Reasoning & Memory Core (5 Engines)

#### 1. Prometheus-2 Rubric & Semantic Uncertainty Quantification (SUQ) Engine
* **Service**: [`src/lib/services/interviewEvaluation.server.ts`](file:///c:/Users/Ritunjay%20Deo/OneDrive/Desktop/Skillo-main/src/lib/services/interviewEvaluation.server.ts)
* **Research Foundation**: *Prometheus 2: An Open Source Language Model for Fine-Grained Evaluation* (Kim et al., 2024) & *Semantic Uncertainty: Determining What LLMs Know* (Kuhn et al., 2023)
* **Mathematical Model**: Executes $N=5$ parallel Chain-of-Thought (CoT) evaluation passes. Answers are clustered by score variance ($\delta \le 0.5$). Calculates base-2 Shannon Semantic Entropy over semantic equivalence clusters $\mathcal{C}$:
  $$SE(x) = -\sum_{c \in \mathcal{C}} P(c) \log_2 P(c)$$
* **Confidence Bounds**:
  - $SE < 0.5 \longrightarrow \text{\texttt{HIGH}}$ Confidence
  - $0.5 \le SE \le 1.2 \longrightarrow \text{\texttt{MEDIUM}}$ Confidence
  - $SE > 1.2 \longrightarrow \text{\texttt{LOW}}$ Confidence (Triggers validation pass)

#### 2. Language Agent Tree Search (LATS) MCTS Adaptive Interviewer
* **Service**: [`src/lib/services/latsEngine.server.ts`](file:///c:/Users/Ritunjay%20Deo/OneDrive/Desktop/Skillo-main/src/lib/services/latsEngine.server.ts)
* **Research Foundation**: *LATS: Language Agent Tree Search Unifies Reasoning, Acting, and Planning in LLMs* (Zhou et al., ICML 2024)
* **Mathematical Model**: 4-phase Monte Carlo Tree Search (Selection $\rightarrow$ Expansion $\rightarrow$ PRM Evaluation $\rightarrow$ Backprop) operating at $c_{\text{puct}} = 1.414$:
  $$\text{UCT}(s, a) = Q(s, a) + c_{\text{puct}} \cdot P(s, a) \frac{\sqrt{N(s)}}{1 + N(s, a)}$$
* **Branch Strategy**: Generates 3 distinct follow-up branches (`DEEP_DIVE`, `PIVOT`, `EDGE_CASE_CHALLENGE`) scored via Process Reward Model ($V \in [0, 1]$).

#### 3. GraphRAG Hierarchical Skill Gap Mapper
* **Service**: [`src/lib/services/graphRAG.server.ts`](file:///c:/Users/Ritunjay%20Deo/OneDrive/Desktop/Skillo-main/src/lib/services/graphRAG.server.ts)
* **Research Foundation**: *From Local to Global: A GraphRAG Approach to Query-Focused Summarization* (Edge et al., Microsoft Research 2024)
* **Hierarchy Tiers**:
  - **Level 0 ($L_0$)**: Macro Domains (High-level architecture concepts)
  - **Level 1 ($L_1$)**: Core Technical Pillars (Sub-domain modules)
  - **Level 2 ($L_2$)**: Leaf Utilities (Specific tools, libraries, syntax)
* **Graph Traversal**: Uses topological edge-walking (`sourceId -> targetId`) to isolate root-cause prerequisite skill gaps.

#### 4. Reflexion Agent & Dynamic Skill Memory Store
* **Service**: [`src/lib/services/reflexionEngine.server.ts`](file:///c:/Users/Ritunjay%20Deo/OneDrive/Desktop/Skillo-main/src/lib/services/reflexionEngine.server.ts)
* **Research Foundation**: *Reflexion: Language Agents with Verbal Reinforcement Learning* (Shinn et al., NeurIPS 2023)
* **Memory Lifecycle**: Non-blocking asynchronous self-critique loops ($SR_t$) persisted to Supabase JSONB. Tracks candidate proficiency transitions across interview sessions:
  $$\text{NOVICE} \longrightarrow \text{DEVELOPING} \longrightarrow \text{PROFICIENT} \longrightarrow \text{MASTERED}$$

#### 5. SimPO Length-Normalized Contrastive Evaluator
* **Service**: [`src/lib/services/simpoEngine.server.ts`](file:///c:/Users/Ritunjay%20Deo/OneDrive/Desktop/Skillo-main/src/lib/services/simpoEngine.server.ts)
* **Research Foundation**: *SimPO: Simple Preference Optimization with Target Reward Margin* (Meng et al., 2024)
* **Mathematical Model**: Reference-free implicit reward length normalization ($\beta = 2.0$, target margin $\gamma = 0.5$):
  $$r_{\text{SimPO}}(x, y) = \frac{\beta \cdot \text{qualityScore}}{\max(1, \vert{}y\vert{})}$$
* **Delta Analysis**: Emits Zod-validated structural deltas comparing candidate responses against top-decile FAANG benchmarks.

---

### Part B: Image, Video & Audio Processing (IVP Core)

#### 6. LayoutLMv3 Visual Document AI Engine
* **Service**: [`src/lib/services/documentVision.server.ts`](file:///c:/Users/Ritunjay%20Deo/OneDrive/Desktop/Skillo-main/src/lib/services/documentVision.server.ts)
* **Research Foundation**: *LayoutLMv3: Pre-training for Document AI with Unstructured and Structured Documents* (Huang et al., 2022)
* **Spatial Normalization**: Coordinates normalized to integer grid $[0, 1000]$:
  $$x_0 = \left\lfloor \frac{\text{left}}{W} \times 1000 \right\rfloor, \quad y_0 = \left\lfloor \frac{\text{top}}{H} \times 1000 \right\rfloor$$
* **Penalty Rules**: Detects right/left margin overflows ($x_0 < 20 \lor x_1 > 980$) and multi-column overlap ratios $>30\%$.

#### 7. L2CS-Net Real-Time 3D Gaze Estimation Engine
* **Service**: [`src/lib/services/ivpGazeEngine.ts`](file:///c:/Users/Ritunjay%20Deo/OneDrive/Desktop/Skillo-main/src/lib/services/ivpGazeEngine.ts)
* **Research Foundation**: *L2CS-Net: Fine-Grained Gaze Estimation in the Wild using Data-Driven Continuous Binning* (Abdelrahman et al., CVPR 2023)
* **Soft-Argmax Expectation**: Computes continuous pitch ($\hat{\theta}_p$) and yaw ($\hat{\theta}_y$) angles:
  $$\hat{\theta} = \sum_{i=1}^{N} p_i \cdot \text{bin}_i$$
* **Eye Contact Threshold**: $|\hat{\theta}_p| \le 12^\circ \land |\hat{\theta}_y| \le 15^\circ$. Aggregates off-screen distraction events sustained $>1.5\text{s}$.

#### 8. HopeNet 3D Head Pose & Gestural Tracking Engine
* **Service**: [`src/lib/services/ivpPoseEngine.ts`](file:///c:/Users/Ritunjay%20Deo/OneDrive/Desktop/Skillo-main/src/lib/services/ivpPoseEngine.ts)
* **Research Foundation**: *Fine-Grained Head Pose Estimation Without Keypoints* (Ruiz et al., CVPR 2018)
* **Euler Dynamics**: Computes angular velocity $\omega(t) = \sqrt{\dot{\theta}_y^2 + \dot{\theta}_p^2 + \dot{\theta}_r^2}$.
* **Gesture Oscillations**: Detects nodding ($\Delta\theta_p \ge 6^\circ$ within $0.25-0.8\text{s}$) and head shaking ($\Delta\theta_y \ge 8^\circ$ within $0.25-0.8\text{s}$).

#### 9. AffectNet Facial Expression & Composure Engine
* **Service**: [`src/lib/services/ivpAffectEngine.ts`](file:///c:/Users/Ritunjay%20Deo/OneDrive/Desktop/Skillo-main/src/lib/services/ivpAffectEngine.ts)
* **Research Foundation**: *AffectNet: A Database for Facial Expression, Valence, and Arousal Computing in the Wild* (Mollahosseini et al., IEEE 2019)
* **Composure Formula**: Distance in 2D Valence-Arousal space relative to target vector $(V=0.40, A=0.20)$:
  $$\text{Composure} = \max\left(0, 100 \times \left(1.0 - \frac{\sqrt{(V - 0.40)^2 + (A - 0.20)^2}}{\sqrt{8}}\right)\right)$$
* **Stress Spike Detection**: Triggered when $A \ge 0.65 \land V \le -0.30$ for $\ge 3$ consecutive keyframes.

#### 10. SyncNet Audio-Visual Lip-Sync & Anti-Spoofing Engine
* **Service**: [`src/lib/services/ivpSyncEngine.ts`](file:///c:/Users/Ritunjay%20Deo/OneDrive/Desktop/Skillo-main/src/lib/services/ivpSyncEngine.ts)
* **Research Foundation**: *Out of Time: Automated Lip Sync in the Wild* (Chung & Zisserman, ACCV 2016)
* **Cross-Modal Metric**: Computes Euclidean distance $D(v, a) = \|\mathbf{f}_v(v) - \mathbf{f}_a(a)\|_2$ and time offset $\Delta t^* \in [-500\text{ms}, +500\text{ms}]$.
* **Security Statuses**:
  - $D \le 1.15 \land |\Delta t^*| \le 80\text{ms} \longrightarrow \text{\texttt{VERIFIED\_GENUINE}}$
  - $80\text{ms} < |\Delta t^*| \le 250\text{ms} \longrightarrow \text{\texttt{LATENCY\_LAG\_WARNING}}$
  - $D > 1.60 \lor |\Delta t^*| > 250\text{ms} \text{ for } >2.0\text{s} \longrightarrow \text{\texttt{SPOOFING\_ALERT\_TRIGGERED}}$

---

## 🛠️ Technology Stack

| Layer | Technology / Framework | Purpose |
|---|---|---|
| **Frontend UI** | Next.js 16 (App Router), React 19, Tailwind CSS | High-performance dynamic web client with glassmorphism UI |
| **Icons & Motion** | Lucide React, React Icons, Framer Motion | Fluid HUD animations and micro-interactions |
| **Visualizations** | Chart.js, React-ChartJS-2, HTML5 Canvas2D | Live gaze ray, 3D pose axis, and V-A quadrant rendering |
| **Language & Type System** | TypeScript 5.8 (Strict Mode) | End-to-end type safety (0 `--noEmit` errors) |
| **Schema Validation** | Zod 4.4 | Safe parsing of all LLM and computer vision JSON payloads |
| **Backend & API Tier** | Next.js Server Actions & API Routes | Asynchronous engine pipeline processing |
| **Database & Auth** | Supabase (PostgreSQL, SSR, JSONB) | Persisted candidate skill memory & multi-modal trace logs |
| **Test Automation** | Jest 30, Ts-Jest | 7 test suites, 76 unit tests (100% Pass Rate) |

---

## 📁 Repository Directory Structure

```
Skillo-main/
├── app/                        # Next.js App Router Pages & API Routes
│   ├── api/
│   │   ├── interview/
│   │   │   ├── evaluate/       # Main Evaluation Endpoint (Prometheus-2, IVP, LATS)
│   │   │   └── followup/       # LATS Follow-up Question Generator
│   │   └── resume/
│   │       └── analyze/        # Resume Parser Endpoint (LayoutLMv3, GraphRAG)
│   ├── dashboard/              # Candidate Career Dashboard
│   ├── interview/              # Live Interview Studio
│   ├── profile/                # Skill Memory Graph & Reflection Drawer
│   ├── results/                # Evaluation Results & IVP Analytics
│   ├── resume/                 # Document Layout Visualizer View
│   └── layout.tsx              # Root HTML & Context Providers
├── src/
│   ├── components/
│   │   └── ui/                 # Component Library
│   │       ├── VisualDocumentCanvas.tsx     # LayoutLMv3 BBox Overlay
│   │       ├── IVPGazeTracker.tsx           # Live Gaze Ray Projection Canvas
│   │       ├── IVPPoseTracker.tsx           # Live 3D Head Orientation Axis Canvas
│   │       ├── IVPAffectTracker.tsx         # Live Valence-Arousal Sampler
│   │       ├── IVPSyncTracker.tsx           # Audio-Visual Lip Sync Sampler
│   │       ├── SUQConfidenceDashboard.tsx   # Prometheus-2 Entropy Dashboard
│   │       ├── LATSTreeVisualizer.tsx       # MCTS Decision Tree Viewer
│   │       ├── GraphRAGDashboard.tsx        # 3-Tier Skill Hierarchy Graph
│   │       ├── SkillMemoryGraph.tsx         # Reflexion Memory Progression Graph
│   │       ├── SimPOContrastiveCard.tsx     # SimPO Reward Delta Card
│   │       ├── GazeAnalyticsCard.tsx        # Gaze Session Results Card
│   │       ├── PostureComposureCard.tsx     # Head Pose Session Results Card
│   │       ├── FacialComposureCard.tsx      # Affective Session Results Card
│   │       └── LipSyncVerificationCard.tsx  # Anti-Spoofing Audit Card
│   ├── lib/
│   │   └── services/           # 10 Server/Edge Research Engines
│   │       ├── documentVision.server.ts     # Engine 6: LayoutLMv3
│   │       ├── graphRAG.server.ts           # Engine 3: GraphRAG
│   │       ├── interviewEvaluation.server.ts# Engine 1: Prometheus-2 SUQ
│   │       ├── ivpAffectEngine.ts           # Engine 9: AffectNet
│   │       ├── ivpGazeEngine.ts             # Engine 7: L2CS-Net
│   │       ├── ivpPoseEngine.ts             # Engine 8: HopeNet
│   │       ├── ivpSyncEngine.ts             # Engine 10: SyncNet
│   │       ├── latsEngine.server.ts         # Engine 2: LATS MCTS
│   │       ├── reflexionEngine.server.ts    # Engine 4: Reflexion
│   │       ├── resumeAnalysis.server.ts     # Resume Service Orchestrator
│   │       └── simpoEngine.server.ts        # Engine 5: SimPO
│   ├── types/                  # Type Contracts
│   │   ├── affectEngine.ts
│   │   ├── gazeEngine.ts
│   │   ├── layoutLMv3.ts
│   │   ├── poseEngine.ts
│   │   ├── syncEngine.ts
│   │   └── index.ts            # Master Type Barrels
│   └── views/                  # Main Page Layout Components
├── tests/                      # Jest Test Suites (76 Tests)
│   ├── aiEngine.test.ts
│   ├── boundaryTesting.test.ts  # Phase 8 Boundary & Adversarial Suite
│   ├── interviewModes.test.ts
│   ├── ivpEngine.test.ts       # Part B IVP Engine Suite
│   ├── onboardingWidget.test.ts
│   ├── systemDesignCanvas.test.ts
│   └── theme.test.ts
├── package.json
└── tsconfig.json
```

---

## ⚡ Quick Start & Installation Guide

### Prerequisites
- **Node.js**: v20.0.0 or higher
- **npm**: v10.0.0 or higher (or `pnpm`)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/sylbornfurtado19/Skillo.git
cd Skillo
npm install
```

### 2. Environment Configuration
Create a `.env.local` file at the root of the project:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# LLM API Keys
ANTHROPIC_API_KEY=your-anthropic-api-key
OPENAI_API_KEY=your-openai-api-key
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Code Quality & Test Verification
```bash
# Type Check (Zero errors)
npx tsc --noEmit

# Run Full Test Suite (76/76 Pass)
npm test

# Production Build Test
npm run build
```

---

## 🌐 API Specifications & Contracts

### 1. Evaluate Interview Submission (`POST /api/interview/evaluate`)

#### Request Payload
```json
{
  "setupData": {
    "role": "Frontend Architect",
    "experienceLevel": "Senior",
    "type": "Technical"
  },
  "questionsList": [
    { "id": "q_1", "question": "Explain how React Fiber scheduler handles priority interruptions." }
  ],
  "answersList": [
    { "answerText": "React Fiber breaks rendering into work units called fibers..." }
  ],
  "gazeFrames": [
    { "timestampMs": 1000, "pitchDegrees": 2.1, "yawDegrees": -3.4 }
  ],
  "poseFrames": [
    { "timestampMs": 1000, "yawDegrees": 1.2, "pitchDegrees": 0.5, "rollDegrees": 0.1 }
  ],
  "affectFrames": [
    { "timestampMs": 1000, "valence": 0.45, "arousal": 0.20 }
  ],
  "syncWindows": [
    { "timestampMs": 1000, "visualDistance": 0.95, "offsetMs": 20 }
  ]
}
```

#### Response Structure
```json
{
  "overallScore": 88,
  "suqEvaluation": {
    "semanticEntropy": 0.32,
    "confidenceLevel": "HIGH",
    "requiresValidationPass": false,
    "clusters": [
      { "clusterId": 1, "representativeScore": 4.5, "probability": 0.8 }
    ]
  },
  "latsTreeState": {
    "currentNodeId": "node_child_0",
    "currentPRMScore": 85,
    "activeActionType": "DEEP_DIVE"
  },
  "simpoContrastiveResult": {
    "preferenceMarginSatisfied": true,
    "rewardMargin": 0.62,
    "structuralDeltas": [
      { "dimension": "EDGE_CASES", "candidateDeficiency": "Omitted lane priority preemptions." }
    ]
  },
  "eyeContactMetrics": {
    "eyeContactPercentage": 92.4,
    "focusStabilityScore": 94.0
  },
  "headPoseMetrics": {
    "postureComposureScore": 91.5,
    "nodCount": 4
  },
  "affectiveMetrics": {
    "overallComposureScore": 89.2,
    "dominantEmotionDistribution": { "CONFIDENT": 65, "NEUTRAL": 35 }
  },
  "lipSyncMetrics": {
    "verificationStatus": "VERIFIED_GENUINE",
    "overallSyncScore": 98.0
  }
}
```

---

## 📚 Literature & Research Citations

1. **Prometheus-2**: Kim et al., *Prometheus 2: An Open Source Language Model for Fine-Grained Evaluation*, arXiv:2405.01535, 2024.
2. **Semantic Uncertainty (SUQ)**: Kuhn et al., *Semantic Uncertainty: Determining What LLMs Know*, ICLR 2023.
3. **Language Agent Tree Search (LATS)**: Zhou et al., *Language Agent Tree Search Unifies Reasoning, Acting, and Planning in LLMs*, ICML 2024.
4. **GraphRAG**: Edge et al., *From Local to Global: A GraphRAG Approach to Query-Focused Summarization*, Microsoft Research, arXiv:2404.16130, 2024.
5. **Reflexion**: Shinn et al., *Reflexion: Language Agents with Verbal Reinforcement Learning*, NeurIPS 2023.
6. **SimPO**: Meng et al., *SimPO: Simple Preference Optimization with Target Reward Margin*, arXiv:2405.14734, 2024.
7. **LayoutLMv3**: Huang et al., *LayoutLMv3: Pre-training for Document AI with Unstructured and Structured Documents*, ACM MM 2022.
8. **L2CS-Net**: Abdelrahman et al., *L2CS-Net: Fine-Grained Gaze Estimation in the Wild using Data-Driven Continuous Binning*, CVPR 2023.
9. **HopeNet**: Ruiz et al., *Fine-Grained Head Pose Estimation Without Keypoints*, CVPR Workshop 2018.
10. **AffectNet**: Mollahosseini et al., *AffectNet: A Database for Facial Expression, Valence, and Arousal Computing in the Wild*, IEEE Trans. Affective Computing 2019.
11. **SyncNet**: Chung & Zisserman, *Out of Time: Automated Lip Sync in the Wild*, ACCV 2016.

---

## 📄 License & Acknowledgments

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

Built with ❤️ by the **Skillo AI Engineering Team**. Dedicated to advancing open, objective, multi-modal career intelligence.
