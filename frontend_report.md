# Skillo — Frontend Report
> Generated: 2026-10-07 | Repository: `sylbornfurtado19/Skillo` | Branch: up-to-date ✅

---

## 1. Product Overview

**Skillo** is an AI-powered interview preparation and resume screening SaaS application. It provides:
- AI-driven mock interviews (behavioral, technical, system design, coding)
- Resume parsing & skill-gap analysis
- Real-time vision/biometric analysis (gaze, posture, affect, lip-sync)
- Post-session evaluation reports with charts and scorecards
- IVP Lab — an advanced interactive vision pipeline research environment

**Deployment target:** Vercel (`https://skillo-theta.vercel.app`)

---

## 2. Tech Stack

### Core Framework
| Layer | Technology | Version |
|---|---|---|
| Framework | **Next.js** (App Router) | `^16.2.12` |
| Runtime | **React** | `^19.2.8` |
| Language | **TypeScript** | `^5.8.2` |
| Package Manager | npm | — |

### Styling
| Layer | Technology | Version |
|---|---|---|
| Utility CSS | **Tailwind CSS** | `^3.4.17` |
| PostCSS | autoprefixer + postcss | `^10.5.2 / ^8.5.15` |
| Global CSS | `src/index.css` (vanilla CSS + Tailwind layers) | — |

### Animation
| Library | Version | Usage |
|---|---|---|
| **Framer Motion** | `^12.41.0` | Page transitions, card hover-lifts, mobile menus, toasts, progress bars |

### Icons
| Library | Version |
|---|---|
| **react-icons** | `^5.6.0` |

### Data Visualization
| Library | Version | Charts Used |
|---|---|---|
| **Chart.js** | `^4.5.1` | Radar, Line |
| **react-chartjs-2** | `^5.3.1` | Wrapper for Chart.js in React |

### Authentication & Backend
| Layer | Technology | Version |
|---|---|---|
| Auth provider | **Supabase** (`@supabase/supabase-js`, `@supabase/ssr`) | `^2.111.0 / ^0.12.4` |
| OAuth | **Google OAuth** (`@react-oauth/google`) | `^0.13.5` |
| BaaS/DB | **Supabase** (Postgres) | — |
| API layer | Next.js App Router API Routes (`app/api/`) | — |

### AI / Vision
| Layer | Technology | Version |
|---|---|---|
| On-device inference | **ONNX Runtime Web** | `^1.29.0` |
| Pose/gaze/face | **MediaPipe Tasks Vision** | `^0.10.35` |
| Schema validation | **Zod** | `^4.4.3` |

### PDF / Export
| Library | Version |
|---|---|
| **jsPDF** | `^4.2.1` |
| **html2canvas** | `^1.4.1` |

### Testing
| Tool | Version | Type |
|---|---|---|
| Jest | `^30.4.2` | Unit / integration |
| ts-jest | `^29.4.12` | TypeScript runner |
| Playwright | `^1.63.0` | E2E |
| oxlint | `^1.69.0` | Linting |

---

## 3. Project Structure

```
Skillo-main/
├── app/                          ← Next.js App Router
│   ├── (app)/                    ← Authenticated route group
│   │   ├── dashboard/
│   │   ├── interview/
│   │   ├── ivp-lab/
│   │   ├── profile/
│   │   ├── results/
│   │   ├── resume/
│   │   ├── settings/
│   │   └── setup/
│   ├── api/                      ← Server-side API routes
│   ├── login/
│   ├── layout.tsx                ← Root layout (fonts, metadata, providers)
│   ├── page.tsx                  ← Landing page entry
│   └── providers.tsx             ← Context providers wrapper
│
└── src/
    ├── components/
    │   ├── common/               ← Navbar, Logo, Footer, ThemeSwitcher, PageTransition, ProtectedRoute
    │   ├── dashboard/            ← OnboardingProgressWidget
    │   ├── interview/            ← 34 specialized components (HUDs, trackers, visualizers)
    │   └── ui/                   ← Design system primitives (Button, Card, Badge, Toast, Loader, InputFields)
    ├── context/
    │   ├── AuthContext.tsx
    │   └── InterviewContext.tsx  ← Central state machine
    ├── hooks/
    │   ├── useAuth.ts
    │   ├── useInterviewCamera.ts
    │   ├── useIVPSessionPipeline.ts
    │   ├── useONNXWorker.ts
    │   └── useVisionWorker.ts    ← 622-line vision pipeline orchestrator
    ├── layouts/
    │   ├── AppLayout.tsx         ← Authenticated app shell (sidebar + header)
    │   └── MainLayout.tsx        ← Public layout
    ├── lib/
    │   ├── ai/                   ← AI config
    │   ├── schemas/              ← Zod schemas
    │   ├── server/               ← Server-only utilities
    │   ├── services/             ← graphRAG, simpoEngine, visionPipeline
    │   └── workers/              ← ONNX/Vision web workers
    ├── services/                 ← Client-side service modules (auth, resume, interview, profile, constants)
    ├── types/                    ← 11 TypeScript definition files
    ├── views/                    ← 10 full-page view components
    └── index.css                 ← Global CSS + Tailwind + theme variables
```

---

## 4. Routing Architecture

The project uses **Next.js App Router** with a route group pattern:

| Route | View | Auth Required | Notes |
|---|---|---|---|
| `/` | `Landing.tsx` | No | Marketing page with FAQ, domains, features |
| `/login` | `Login.tsx` | No | Google OAuth via Supabase |
| `/dashboard` | `Dashboard.tsx` | Yes | Radar chart, session history, onboarding |
| `/resume` | `ResumeUpload.tsx` | Yes | PDF upload + skill gap analysis |
| `/setup` | `CareerSetup.tsx` | Yes | Interview configuration wizard |
| `/interview` | `InterviewSession.tsx` | Yes | Live AI interview (61KB, most complex view) |
| `/ivp-lab` | `IVPLab.tsx` | Yes | Vision pipeline research sandbox |
| `/results` | `Results.tsx` | Yes | Scorecards, feedback, PDF export |
| `/profile` | `Profile.tsx` | Yes | User profile management |
| `/settings` | `Settings.tsx` | Yes | Theme switcher, preferences |

---

## 5. Design System

### 5.1 Typography

| Role | Font | CSS Variable |
|---|---|---|
| Headings (`h1`-`h6`) | **Sora** (Google Fonts) | `--font-heading` |
| Body text | **Inter** (Google Fonts) | `--font-body` |
| Monospaced labels | System mono | `font-mono` (Tailwind) |

Fonts are loaded via `next/font/google` in the root layout and injected as CSS variables into the `<html>` element.

### 5.2 Color System — Multi-Theme Architecture

The color system is built entirely on **CSS custom properties** (`var(--color-*)`) scoped via `[data-theme]` attribute selectors on the root element. The theme attribute is set dynamically by `InterviewContext`.

#### Theme 1 — Onyx Glass (Default)
> *"Ultra-deep space black background with translucent glassmorphic cards and indigo/violet neon accents."*

| Role | Hex | Description |
|---|---|---|
| Background | `#030712` | Near-black deep space |
| Card | `#0B0F19` | Dark navy |
| Card Border | `rgba(255,255,255,0.08)` | Subtle white glint |
| **Primary** | `#6366F1` | Indigo-500 |
| Primary Dark | `#4F46E5` | Indigo-600 |
| **Secondary** | `#8B5CF6` | Violet-500 |
| **Accent** | `#06B6D4` | Cyan-500 |
| Glow 1 | `rgba(99,102,241,0.25)` | Indigo fog |
| Glow 2 | `rgba(139,92,246,0.25)` | Violet fog |

#### Theme 2 — Cyberpunk Dark
> *"High-contrast synthwave dark purple canvas with vibrant electric cyan and hot pink neon highlights."*

| Role | Hex | Description |
|---|---|---|
| Background | `#090414` | Dark purple-black |
| Card | `#140A23` | Deep violet |
| Card Border | `rgba(236,72,153,0.3)` | Hot pink glow |
| **Primary** | `#EC4899` | Pink-500 |
| Primary Dark | `#DB2777` | Pink-600 |
| **Secondary** | `#A855F7` | Purple-500 |
| **Accent** | `#00F0FF` | Electric cyan |
| Glow 1 | `rgba(236,72,153,0.35)` | Pink fog |
| Glow 2 | `rgba(0,240,255,0.35)` | Cyan fog |

#### Theme 3 — Enterprise Slate
> *"Refined dark slate blue-gray background with minimalist sky blue and emerald executive accents."*

| Role | Hex | Description |
|---|---|---|
| Background | `#0F172A` | Slate-900 |
| Card | `#1E293B` | Slate-800 |
| Card Border | `rgba(56,189,248,0.2)` | Sky blue trim |
| **Primary** | `#38BDF8` | Sky-400 |
| Primary Dark | `#0284C7` | Sky-600 |
| **Secondary** | `#6366F1` | Indigo-500 |
| **Accent** | `#10B981` | Emerald-500 |
| Glow 1 | `rgba(56,189,248,0.3)` | Sky fog |
| Glow 2 | `rgba(16,185,129,0.3)` | Emerald fog |

#### Semantic / Status Colors (shared across all themes)
| Role | Value |
|---|---|
| Success | `#10B981` (emerald-500) |
| Warning | `#EAB308` (yellow-500) |
| Danger | `#EF4444` (red-500) |
| Text base | `#f3f4f6` (gray-100) |
| Text muted | `gray-400` / `gray-500` |
| Online indicator | `emerald-500` (pulsing dot) |

### 5.3 Spacing & Border Radius

The app uses Tailwind's default scale with consistent radius choices:
- Cards / panels: `rounded-2xl` (16px)
- Buttons / inputs: `rounded-xl` (12px)
- Badges / avatars / status dots: `rounded-full`

---

## 6. UI Component Library

All primitive components live in `src/components/ui/`.

### Button
- Built on `motion.button` (Framer Motion) with `whileHover` / `whileTap` spring animations
- **Variants:** `primary`, `secondary`, `accent`, `glass`, `ghost`, `danger`
- **Sizes:** `sm`, `md`, `lg`
- Shimmer sweep animation on hover

### Card
- **Variants:** `glass`, `solid`, `glow-primary`, `glow-secondary`, `glow-accent`
- Optional `hoverLift` prop: animates `y: -6` on hover via Framer Motion
- Glassmorphism via `backdrop-filter: blur(12px)` + semi-transparent background

### Badge
- **Variants:** `primary`, `secondary`, `accent`, `success`, `warning`, `danger`, `neutral`
- Font: `font-mono`, `uppercase`, pill-shaped
- **Sizes:** `sm` (9px), `md` (10px)

### Toast
- Context-based system (`ToastProvider` + `useToast` hook)
- Framer Motion spring animation (`stiffness: 300, damping: 25`)
- Auto-dismiss: 3.5 seconds
- **Variants:** `info`, `success`, `error`
- Fixed bottom-right, z-index 999

### Loader / Progress / Skeleton
- `Loader`: spinning ring — sizes `sm/md/lg`
- `Progress`: animated fill via Framer Motion, variants `primary/secondary/accent/success`
- `Skeleton`: pulsing `bg-white/5` placeholder

---

## 7. Global CSS Utilities (`src/index.css`)

### Glassmorphism Classes
| Class | backdrop-filter | Background opacity | Use |
|---|---|---|---|
| `.glass` | `blur(12px)` | 65% card | General panels |
| `.glass-card` | `blur(16px)` | 60% card | Elevated cards |
| `.glass-nav` | `blur(16px)` | 75% background | Navbar |

### Glow Effects
| Class | Effect |
|---|---|
| `.glow-primary` | `box-shadow: 0 0 50px -5px var(--color-glow-1)` |
| `.glow-secondary` | `box-shadow: 0 0 50px -5px var(--color-glow-2)` |
| `.glow-accent` | `box-shadow: 0 0 50px -5px var(--color-glow-1)` |

### Animations
| Name | Description |
|---|---|
| `.animated-glow-border` | Rotating gradient border (primary → secondary → accent → primary), 6s loop |
| `.animate-shimmer` | 2.5s sweep shimmer |
| `body transition` | `background-color + color 0.4s ease` — smooth theme switching |

### Scrollbar Styling
Custom 8px scrollbar: `rgba(255,255,255,0.15)` thumb, hover to `0.3`.

---

## 8. Layout Architecture

### Public Layout (`MainLayout.tsx`)
Wraps public routes (landing, login) with `Navbar` and `Footer`.

### App Layout (`AppLayout.tsx`)
Authenticated shell featuring:
- **Desktop:** Fixed left sidebar (256px), navigation with active state highlight
- **Mobile:** Slide-in drawer via Framer Motion `AnimatePresence`
- **Top header:** Page title, notification bell with dropdown, user avatar
- Navigation items: Dashboard, Resume, Career Setup, Interview, IVP Lab, Results, Settings
- User avatar: Google profile picture or initials fallback with gradient border + pulsing online dot

---

## 9. State Management

| Context | Responsibility |
|---|---|
| `AuthContext` | Supabase session, user object, `signIn` / `signOut` |
| `InterviewContext` | Central state machine — resume data, setup config, questions, answers, results, session history, theme, streaks |

Session history and theme preference are persisted to `localStorage`.

---

## 10. Key Custom Hooks

| Hook | Purpose |
|---|---|
| `useAuth` | Thin wrapper around `AuthContext` |
| `useInterviewCamera` | Webcam stream lifecycle (`getUserMedia`) |
| `useVisionWorker` | Orchestrates MediaPipe Web Worker — frame dispatch, FPS throttle, EMA latency/drop-rate tracking (622 lines) |
| `useONNXWorker` | Manages ONNX Runtime Web Worker for on-device ML inference |
| `useIVPSessionPipeline` | High-level IVP Lab session pipeline — combines vision + ONNX + telemetry |

---

## 11. Interview Modes System

Defined in `src/types/interviewModes.ts`. Preset registry with company-specific configurations:

| Preset | Company | Type | Difficulty |
|---|---|---|---|
| `google-swe-coding` | Google | Coding | Hard |
| `meta-behavioral` | Meta | Behavioral | Medium |
| `amazon-pm` | Amazon | Mixed | Medium |
| `stripe-backend` | Stripe | Technical | Hard |

Each mode includes `evaluationRubric`, `interviewerStyle`, and `systemPromptConfig`.

---

## 12. Vision & AI Components (IVP Suite)

34 specialized components in `src/components/interview/`, running entirely client-side via Web Workers.

| Component | Description |
|---|---|
| `IVPInteractiveCanvas.tsx` (~100KB) | Master canvas orchestrator for the IVP Lab |
| `IVPGazeTracker.tsx` | Real-time gaze direction estimation |
| `IVPPoseTracker.tsx` | Body posture analysis |
| `IVPAffectTracker.tsx` | Facial affect / emotion detection |
| `IVPSyncTracker.tsx` | Audio-visual sync analysis |
| `IVPCameraPreview.tsx` | Camera feed with overlay controls |
| `IVPSignalOscilloscope.tsx` | Signal waveform visualizer |
| `IVPTelemetryTimeline.tsx` | Frame-by-frame telemetry timeline |
| `EyeContactHUD.tsx` | Real-time eye contact scoring overlay |
| `PostureHUD.tsx` | Posture quality HUD |
| `AffectiveHUD.tsx` | Emotion state HUD |
| `LipSyncHUD.tsx` | Lip sync verification HUD |
| `GazeAnalyticsCard.tsx` | Gaze analytics summary card |
| `FacialComposureCard.tsx` | Facial composure scoring |
| `PostureComposureCard.tsx` | Posture composure scoring |
| `LipSyncVerificationCard.tsx` | Lip sync quality details |
| `SUQConfidenceDashboard.tsx` | Speech / utterance quality dashboard |
| `SimPOContrastiveCard.tsx` | SimPO contrastive training visualization |
| `GraphRAGDashboard.tsx` | GraphRAG knowledge retrieval visualization |
| `LATSTreeVisualizer.tsx` | LATS tree search visualization |
| `SkillMemoryGraph.tsx` | Skill memory graph visualization |
| `VisualDocumentCanvas.tsx` | Document layout analysis canvas |
| `SystemDesignCanvas.tsx` | Interactive system design whiteboard (27KB) |
| `ReflectionTimelineDrawer.tsx` | Session reflection timeline |
| + 10 more supporting components | (HUD headers, penalty viewers, prerequisite chains, etc.) |

---

## 13. Performance Considerations

| Pattern | Implementation |
|---|---|
| Dynamic imports | `next/dynamic` for Chart.js components with `ssr: false` |
| Web Workers | Vision and ONNX inference off the main thread |
| Frame throttling | EMA-based adaptive FPS throttling in `useVisionWorker` |
| Image optimization | `next/image` with allowlisted remote patterns (Unsplash, DiceBear) |
| Lazy-loaded fonts | `next/font/google` with Latin subset |
| Scroll listeners | `{ passive: true }` on all scroll events |
| React Strict Mode | Enabled in `next.config.js` |

---

## 14. SEO & Metadata

Defined in `app/layout.tsx`:

| Tag | Value |
|---|---|
| `<title>` | Skillo - Intelligent Resume Screening & AI Interview Assistant |
| `<meta description>` | Practice realistic, AI-driven behavioral and technical interviews... |
| OpenGraph | Full OG tags with 1200x630 Unsplash image |
| Twitter Card | `summary_large_image` |
| Locale | `en_US` |
| Site URL | `https://skillo-theta.vercel.app` |

---

## 15. Summary Metrics

| Metric | Value |
|---|---|
| Total route pages | 10 |
| UI primitive components | 7 (Button, Card, Badge, Toast, Loader, Progress, Skeleton) |
| Common components | 6 (Navbar, Logo, Footer, ThemeSwitcher, PageTransition, ProtectedRoute) |
| Specialized UI components | 34 (IVP + interview HUDs / cards) |
| Custom hooks | 5 |
| Theme presets | 3 (Onyx Glass, Cyberpunk Dark, Enterprise Slate) |
| TypeScript type files | 11 |
| Frontend service modules | 7 |
| Largest view | `InterviewSession.tsx` — 61 KB |
| Largest component | `IVPInteractiveCanvas.tsx` — ~100 KB |
