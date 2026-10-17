# Skillo — IVP Merge Change Ledger (CHANGE_LEDGER.md)

Every file modified, created, or deleted is listed below with a single-sentence justification tied to Objectives O0–O8 and Devil's Advocate mitigations D1–D18.

| File | Action | Objective | Justification |
|---|---|---|---|
| `app/(app)/interview/page.tsx` | Modified | O8 | Renders the proctored interview view with full exam-room chrome. |
| `app/(app)/results/page.tsx` | Modified | O5 | Connects evaluation reports containing IVP evidence and integrity receipts. |
| `app/api/interview/evaluate/route.ts` | Modified | O5, D5, D9 | Adds bounded Zod validation schemas for server-safe IVP evidence and integrity payloads while discarding raw thumbnails. |
| `src/views/InterviewSession.tsx` | Modified | O1, O2, O3, O4, O7, O8, T6 | Implements preflight gate, remaining-time countdown ledger, single submission helper, status bar, and proctored exam layout. |
| `src/views/Results.tsx` | Modified | O3, O5, D16 | Integrates classical IVP Evidence and Session Integrity audit cards alongside existing ML telemetry with graceful missing data fallbacks. |
| `src/views/Dashboard.tsx` | Modified | O0 | Removes legacy navigation button pointing to the deprecated standalone IVP Lab. |
| `src/layouts/AppLayout.tsx` | Modified | O0, D17 | Retires `/ivp-lab` route info and hides sidebar/nav on `/interview` for secure exam mode. |
| `src/components/common/ProtectedRoute.tsx` | Modified | O0 | Eliminates `isPublicLab` unauthenticated bypass. |
| `src/hooks/useIVPSessionPipeline.ts` | Modified | O4 | Exposes pause gating and landmark signals to the classical IVP runner without modifying worker protocols. |
| `src/hooks/useMediaReadiness.ts` | Modified | O1, O3 | Exposes track live states and dropout detection for camera and microphone gating. |
| `src/hooks/useInterviewCamera.ts` | Modified | O1, O3 | Provides centralized hardware acquisition enforcing simultaneous audio and video readiness. |
| `src/components/interview/session/SessionPreflight.tsx` | Created | O1, D8, D14 | Renders preflight hardware checks, consent notices, and initiates fullscreen mode upon user click. |
| `src/components/interview/session/SessionStatusBar.tsx` | Created | O4 | Displays persistent REC indicator, hardware badges, real-time IVP frame counter, timer, and integrity strike counter. |
| `src/components/interview/session/SessionIntegrityOverlay.tsx` | Created | O3, O7, D13 | Focus-trapped modal overlay mounted non-destructively over camera feed during proctoring pauses. |
| `src/components/interview/session/IVPLivePanel.tsx` | Created | O4, O0 | Renders real-time kernel output buffers (HistEq, Otsu, Sobel, MAD), diagnostic mode switcher, and EAR sparklines. |
| `src/components/interview/session/SessionInterviewerCard.tsx` | Modified | O8 | Supports responsive exam-room layout with customizable class names. |
| `src/components/interview/session/SessionAnswerWorkspace.tsx` | Modified | O2, O8 | Excludes typing from anti-copy deterrence and fits exam-room layout. |
| `src/components/interview/CodeWorkspace.tsx` | Modified | D15 | Preserves Monaco editor typing and syntax highlighting under anti-copy policies. |
| `src/components/ui/IVPCameraPreview.tsx` | Modified | O4, O8 | Displays camera stream with MediaPipe mesh and 3D head-pose pinhole projection in the surveillance rail. |
| `src/components/ui/IVPSyncTracker.tsx` | Modified | O4 | Exposes microphone audio level meter for real-time status bar telemetry. |
| `src/components/ui/IVPEvidenceCard.tsx` | Created | O5, D9, D10 | Renders cryptographic SHA-256 evidence receipt, per-question sensor table, and AI delivery commentary. |
| `src/components/ui/SessionIntegrityCard.tsx` | Created | O3, O7, D8 | Renders integrity verdict, event strikes, pause timeline, and honest proctoring limitations notice. |
| `src/types/integrity.ts` | Created | O2, O3, O7 | Declares TypeScript data contracts for integrity events, pause reasons, and session reports. |
| `src/types/ivpEvidence.ts` | Created | O4, O5 | Declares TypeScript contracts for kernel sample metrics, per-question evidence, and SHA-256 receipts. |
| `src/types/index.ts` | Modified | O5 | Adds optional `ivpEvidence` and `sessionIntegrity` fields to `EvaluationReport` and `MockInterview`. |
| `src/lib/integrity/integrityPolicy.ts` | Created | O7, D8 | Defines canonical thresholds, deduplication windows, and display-only scoring policy. |
| `src/lib/integrity/integrityLedger.ts` | Created | O2, O3, O7, D3, D4 | Implements pure reducer managing integrity events, remaining-time countdown ledger, and state persistence. |
| `src/hooks/useInterviewIntegrity.ts` | Created | O2, O3, O7, D2 | Attaches DOM listeners for visibility changes, window blur, fullscreen exits, and clipboard attempts. |
| `src/lib/services/ivpKernelRunner.ts` | Created | O4, O0, D11, D12 | Executes classical IVP kernels sequentially at 160x120 resolution with single-threaded safety. |
| `src/lib/services/ivpEvidenceAggregator.ts` | Created | O5, D10 | Aggregates per-sample stats into question summaries and generates canonical SHA-256 digests. |
| `src/lib/services/evidencePrompt.ts` | Created | O5, D7 | Formats compact prompt block for AI evaluator delivery commentary without biasing rubric scores. |
| `src/hooks/useIVPEvidenceRunner.ts` | Created | O4 | Manages headless IVP kernel execution loop at <= 4 Hz with throttling and pause awareness. |
| `src/services/constants.ts` | Modified | O5, D5 | Passes `ivpEvidence` and `sessionIntegrity` to `/api/interview/evaluate` while preserving evidence on retry. |
| `src/services/interview.ts` | Modified | O5, D6 | Maps evidence and integrity to database payloads with automatic retry fallback if columns are missing. |
| `src/lib/firebase/services/interview.firebase.ts` | Modified | O5, D6 | Mirrors scalar evidence and integrity persistence safely for Firebase Firestore. |
| `src/lib/services/interviewEvaluation.server.ts` | Modified | O5, D7 | Injects evidence prompt block into delivery context and parses validated AI observations. |
| `src/context/InterviewContext.tsx` | Modified | D4, D5 | Persists questions, indices, answers, evidence, and integrity in sessionStorage across reloads. |
| `src/index.css` | Modified | O2 | Applies print hiding and non-selectable styling to secured question content while leaving inputs enabled. |
| `next.config.js` | Modified | O0 | Adds permanent redirect from `/ivp-lab` to `/dashboard` and strict security headers. |
| `package.json` | Modified | O0 | Repoints `test:e2e` script to `tests/e2e/interviewIntegrity.spec.ts`. |
| `playwright.config.ts` | Modified | O1 | Adds fake media stream flags and camera/microphone permissions. |
| `supabase_schema.sql` | Modified | D6 | Appends guarded `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` migration block for `ivp_evidence` and `session_integrity`. |
| `scripts/wiring/audit-wiring.mjs` | Modified | O0 | Updates sample-face comment for test suite usage. |
| `app/(app)/ivp-lab/page.tsx` | Deleted | O0 | Retired standalone lab route; capabilities ported into interview. |
| `src/views/IVPLab.tsx` | Deleted | O0 | Retired standalone lab view; capabilities ported into interview. |
| `src/components/ui/IVPInteractiveCanvas.tsx` | Deleted | O0 | Retired lab dual-viewport canvas. |
| `src/components/ui/IVPSignalOscilloscope.tsx` | Deleted | O0 | Retired lab oscilloscope; replaced by compact sparkline in `IVPLivePanel.tsx`. |
| `src/components/ivp/canvas/types.ts` | Deleted | O0 | Retired lab-only canvas types. |
| `src/components/ivp/canvas/CanvasHeaderControls.tsx` | Deleted | O0 | Retired lab-only canvas controls. |
| `src/components/ivp/canvas/CanvasMetricHUD.tsx` | Deleted | O0 | Retired lab-only canvas HUD. |
| `src/components/ivp/canvas/WarmupWarningBanner.tsx` | Deleted | O0 | Retired lab-only warmup banner. |
| `src/components/ivp/canvas/telemetryHelpers.ts` | Deleted | O0 | Retired lab-only telemetry helpers. |
| `src/components/ivp/canvas/CalibrationModal.tsx` | Deleted | O0 | Retired lab-only calibration modal. |
| `tests/integrityLedger.test.ts` | Created | O3, O7, D3 | Tests pure reducer, event deduplication, and countdown remaining-time accounting. |
| `tests/integrityPolicy.test.ts` | Created | O7 | Tests integrity thresholds and scoring penalty configurations. |
| `tests/ivpEvidenceAggregator.test.ts` | Created | O5, D10 | Tests evidence rollup, thumbnail stripping, and SHA-256 digest determinism. |
| `tests/ivpKernelRunner.test.ts` | Created | O4, D11, D12 | Tests sequential kernel execution, latency budgeting, and synthetic ImageData processing. |
| `tests/evidencePrompt.test.ts` | Created | O5, D7 | Tests prompt block generation and rubric score fence isolation. |
| `tests/interviewTimerPause.test.ts` | Created | O3, D3 | Verifies remaining-time ledger preserves exact clock ticks across pauses and question navigation. |
| `tests/interviewEvaluateIvpEvidence.test.ts` | Created | O5, D5, D9 | Tests evaluate route Zod validation, prompt observation extraction, and fallback integrity. |
| `tests/sessionStatusBarAndLivePanel.test.ts` | Created | O4 | Tests status bar chip states, frame counter rendering, and live panel diagnostic modes. |
| `tests/resultsIvpEvidenceAndIntegrityCards.test.ts` | Created | O3, O5, D16 | Tests results card rendering with present, missing, and fallback data shapes. |
| `tests/e2e/interviewIntegrity.spec.ts` | Created | O1-O8 | End-to-end test verifying preflight gate, IVP counter, pause overlay, copy deterrence, and results cards. |
| `tests/e2e/pageElementAudit.spec.ts` | Created | O6 | Element-by-element audit across 10 application routes verifying zero dead controls or placeholders. |
| `tests/e2e/antigravity-3-8-high-flash.spec.ts` | Modified | O0 | Repoints test target from `/ivp-lab` to `/interview`. |
| `tests/e2e/visualRegression.spec.ts` | Modified | O0 | Repoints visual regression target from `/ivp-lab` to `/interview`. |
| `tests/e2e/wiringScreenshots.spec.ts` | Modified | O0 | Repoints wiring verification from `/ivp-lab` to `/interview`. |
| `docs/ivp-merge/PARITY_MATRIX.md` | Created | O0 | Comprehensive parity matrix mapping every historical lab feature to live interview equivalents. |
| `docs/ivp-merge/ELEMENT_AUDIT.md` | Created | O6 | Detailed audit report recording 33 controls across 10 application routes. |
| `docs/ivp-merge/LIMITATIONS.md` | Created | D1, D2, D8 | Honest disclosures on browser proctoring boundaries, privacy, and non-biasing score policy. |
| `docs/ivp-merge/DEMO_RUNBOOK.md` | Created | Hand-off | 8-minute demonstration script for academic review and placement cell presentation. |
| `docs/ivp-merge/EXECUTION_LOG.md` | Created | Log | Chronological execution log documenting baseline, phase gates, and verification command tails. |
