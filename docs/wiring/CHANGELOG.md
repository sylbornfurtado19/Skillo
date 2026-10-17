# Wiring Refactor Changelog

## [Iteration 0] - 2026-10-17
- **What**: Initialized wiring audit tooling (`scripts/wiring/audit-wiring.mjs`), package scripts (`audit:wiring`, `audit:wiring:strict`), generated baseline (`docs/wiring/BASELINE.md`), created `refactor/wiring` branch, and removed stray benchmark/failure artifacts from git index (`git rm --cached`).
- **Why**: Establish external ledger and automated reachability/dead-export tracking without modifying runtime behavior.
- **Evidence**: `audit:wiring` reports 180 total TS files, 169 reachable, 11 orphans, 15 dead exports; 62 repo-root and doc files classified in `LEDGER.csv` (384 unreviewed remaining).

## [Iteration 1] - 2026-10-17
- **What**: Implemented shared tight Face-ROI cropping (`computeFaceRoiCrop`) with aspect preservation & margin clamping for ONNX inference in IVP Lab and session pipeline; removed unused `face_detection_yunet_2023mar.onnx`; wired `backgroundSegmentation.ts` into `temporalMotion.ts` presence detection and IVP Lab `PERSON_SEGMENTATION` mode; trimmed 5 dead internal exports in `onnxInferenceService.ts`.
- **Why**: Eliminate whole-frame squashing artifacts on 224x224 neural models, wire orphaned person segmentation, prune unreferenced model payload, and clean dead exports.
- **Evidence**: 77/77 Jest suites pass (626 tests); regression tests pass with Lip RMSE: 0.67 px, Pupil RMSE: 0.16 px, Latency p95: 0.04 ms; reachable files increased 169 -> 170; orphans decreased 11 -> 10; dead exports decreased 15 -> 14; 25 ledger rows classified (360 unreviewed remaining).

## [Iteration 2] - 2026-10-17
- **What**: Replaced fake/fabricated initial numbers in IVP Lab (`0.285` EAR, `0.145` MAR, `14.5` blink rate, `32` speech activity) with truthful null/waiting states and offline fallback asset (`public/images/sample-face.jpg`); implemented pure functional signal calculators (`computeBlinkRate`, `computeSpeechActivity`, `computeSpeechCadence`, `processBlinkDetection` in `ivpSignalCalculators.ts` with 16 unit tests); updated `IVPSignalOscilloscope` to gracefully render null states; wired `calculateEAR`, `getRawIVPFeatureFlags`, and `resetIVPFeatureFlags` eliminating 3 dead exports.
- **Why**: Enforce strict screen truthfulness across physiological signals, eliminate dead exports, avoid offline/CSP failure on external Unsplash image, and ensure Safe Mode properly gates experimental processing.
- **Evidence**: 78/78 Jest suites pass (642 tests); CI regression passing (Lip RMSE 0.66 px, Pupil RMSE 0.18 px, Latency p95 0.02 ms); dead exports decreased 14 -> 11; reachable files increased 170 -> 171; 13 ledger rows classified (350 unreviewed remaining).
## [Iteration 3] - 2026-10-17
- **What**: Removed 3 legacy heuristic vision trackers (`IVPGazeTracker.tsx`, `IVPPoseTracker.tsx`, `IVPAffectTracker.tsx`, -1,187 LOC); eliminated fake fallback numbers (`84%`, `88`, `90`) in `IVPTelemetryTimeline.tsx` and guarded Section 3a in `Results.tsx` with a clean "Camera Biometrics Unavailable" card; tightened session metric type guards to require non-zero frame counts; computed and surfaced `DELIVERY_COMPOSITE_WEIGHTS` directly in UI breakdown; computed `deliveryComposite` on server in `interviewEvaluation.server.ts`; created canonical `docs/wiring/IVP_SIGNAL_MAP.md`; clarified local processing in `README.md`.
- **Why**: Enforce signal truthfulness in live evaluation reports and ensure that candidates practicing without a camera are never presented with fabricated metrics, while wiring dead exports into active UI and eliminating orphan legacy code.
- **Evidence**: 78/78 Jest suites pass (642 tests); CI regression passing (Lip RMSE: 0.66 px, Pupil RMSE: 0.16 px, Latency p95: 0.04 ms); total repo files decreased 181 -> 178; orphans decreased 10 -> 7; `testOnlyExports` decreased 87 -> 86; 20 ledger rows classified (327 unreviewed remaining).

## [Iteration 4] - 2026-10-17
- **What**: Mounted `LATSTreeVisualizer` in `Results.tsx` under an explicit section (`#sec-lats`) and in the docked navigation bar; created canonical `docs/wiring/AI_FIELD_MAP.md` mapping every API response schema to rendering lines; verified `source: 'live' | 'fallback'` tags across SUQ, SimPO, and LATS; verified `handleShareImage` and `handleDownloadPDF` in action bar; removed dead export `executeAiRequest` from `src/lib/ai/aiConfig.ts`.
- **Why**: Wire AI decision reasoning directly to candidate screen pixels, document full AI field consumption, and eliminate unused gateway aliases.
- **Evidence**: 78/78 Jest suites pass (642 tests); CI regression passing (Lip RMSE: 0.64 px, Pupil RMSE: 0.16 px, Latency p95: 0.03 ms); dead exports decreased 11 -> 10; 18 ledger rows classified (310 unreviewed remaining).

## [Iteration 5] - 2026-10-17
- **What**: Wired server environment startup validation (`getServerEnv`, `validateEnvironment` from `@/lib/server/env`) into `app/layout.tsx`; removed dead export `getAdminStorage` from `src/lib/firebase/admin.ts`; removed 5 dead/orphaned data services superseded by SSR API routes and server actions (`src/services/jobs.ts`, `src/lib/firebase/services/jobs.firebase.ts`, `src/services/resume.ts`, `src/lib/firebase/services/resume.firebase.ts`, `src/services/analysis.ts`); wired `PROMETHEUS2_RUBRICS` to dynamically generate Prometheus-2 evaluation system prompts and attached rubric metadata to evaluate route response; updated `.env.example`.
- **Why**: Ensure server environment integrity at root layout startup, eliminate 5 dead service orphans, and eliminate dead exports in evaluation engine.
- **Evidence**: 78/78 Jest suites pass (642 tests); CI regression passing; orphan files decreased 7 -> 1; dead exports decreased 10 -> 2; total files decreased 178 -> 173; reachable files increased 171 -> 172.

## [Iteration 6] - 2026-10-17
- **What**: Wired `Input` and `Textarea` from `src/components/ui/InputFields.tsx` into `Settings.tsx` Candidate Profile section (binding Full Name, Email, Target Role, and a new Preparation Goals & Notes field stored in profile settings); unified temporal smoothing in `src/hooks/useIVPSessionPipeline.ts` using `VisionTelemetrySmoother` (connecting gaze, pose, affect, and emotion consensus under a single pipeline with synchronized reset on question transitions); verified root error/loading boundaries (`app/error.tsx`, `app/loading.tsx`, `app/not-found.tsx`).
- **Why**: Reach 100% reachability across all components in `src/` and `app/`, eliminating all remaining orphan files (0 orphans) and dead exports (0 dead exports).
- **Evidence**: `audit:wiring` reports 173/173 files reachable (0 orphans), 0 dead exports, 0 tsc errors, 0 lint errors, 78/78 test suites passing, and CI regression passing.


