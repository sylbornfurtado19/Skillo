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

