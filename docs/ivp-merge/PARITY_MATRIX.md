# Skillo IVP Capability Parity Matrix (O0 — "Merge, Don'\''t Make it Disappear")

This document records the exact transition of every feature, kernel, and visualization from the standalone IVP Lab into the live, proctored interview session.

| Lab Capability | Historical Location | Live Interview Location | Verification Proof Test | Status |
|---|---|---|---|---|
| Raw Feed / Camera Preview | `IVPCameraPreview.tsx`, `IVPLab.tsx` | `IVPCameraPreview.tsx` in `InterviewSession.tsx` | `tests/interviewDeviceGate.test.ts` | Kept & Active |
| Grayscale & 256-bin Histogram Eq (Unit 2) | `IVPInteractiveCanvas.tsx`, `ivpDiagnosticKernels.ts` | `ivpKernelRunner.ts` -> `IVPLivePanel.tsx` | `tests/ivpKernelRunner.test.ts` | Merged into live runner |
| YCrCb + Otsu Person Mask & Skin Segmentation (Units 6-7) | `IVPInteractiveCanvas.tsx`, `ivpDiagnosticKernels.ts` | `ivpKernelRunner.ts` -> `IVPLivePanel.tsx` | `tests/ivpKernelRunner.test.ts` | Merged into live runner |
| Spatial 3x3 Sobel Gradient Field (Unit 4) | `IVPInteractiveCanvas.tsx`, `ivpDiagnosticKernels.ts` | `ivpKernelRunner.ts` -> `IVPLivePanel.tsx` | `tests/ivpKernelRunner.test.ts` | Merged into live runner |
| Temporal MAD Motion Heatmap (Unit 8) | `IVPInteractiveCanvas.tsx`, `ivpDiagnosticKernels.ts` | `ivpKernelRunner.ts` -> `IVPLivePanel.tsx` | `tests/ivpKernelRunner.test.ts` | Merged into live runner |
| EAR / MAR Blink & Mouth Activity | `IVPSignalOscilloscope.tsx`, `ivpSignalCalculators.ts` | `useIVPSessionPipeline.ts` -> `useIVPEvidenceRunner.ts` | `tests/ivpSignalCalculators.test.ts` | Merged into evidence runner |
| Pinhole 3-D Head Pose Projection (Unit 1) | `IVPCameraPreview.tsx`, `ivpDiagnosticKernels.ts` | `IVPCameraPreview.tsx` (overlay over live face) | `tests/coordAndFaceRoi.test.ts` | Kept & Active |
| Gaze / Pose / AffectNet ONNX Telemetry | `useONNXWorker.ts`, `useIVPSessionPipeline.ts` | `useIVPSessionPipeline.ts` in `InterviewSession.tsx` | `tests/onnxWorkerContract.test.ts` | Kept & Active |
| Diagnostic Mode Switcher | `CanvasHeaderControls.tsx` dropdown in `IVPLab.tsx` | Mode pill selector inside `IVPLivePanel.tsx` | `tests/e2e/interviewIntegrity.spec.ts` | Merged into live panel |
| Signal Oscilloscope Waveforms | `IVPSignalOscilloscope.tsx` canvas | Compact live sparklines in `IVPLivePanel.tsx` | `tests/e2e/interviewIntegrity.spec.ts` | Merged into live panel |
| File Upload / Sample Image Mode | File input in `IVPLab.tsx` | Intentionally dropped from candidate interview product (not an interview concept). Retained `public/images/sample-face.jpg` as test fixture. | `tests/faceRoiCrop.test.ts` | Dropped per §6 plan |
