# Skillo — Proctoring, Vision, and Privacy Limitations (LIMITATIONS.md)

This document provides transparent, mathematically and technologically honest disclosures regarding the security boundaries, browser constraints, and privacy guarantees of the Skillo platform.

---

### 1. Browser Proctoring Boundaries: Detection & Deterrence vs. "Prevention"
- **OS-Level Screenshots Cannot Be Blocked by Web Applications (D1):**
  Operating system-level capture utilities (e.g. Windows Snipping Tool / `Win+Shift+S`, macOS `Cmd+Shift+3/4/5`, physical external cameras, second displays, or mobile phone photography) execute outside the browser sandbox and are invisible to JavaScript APIs. Skillo implements **deterrence and detection** (blocking `beforeprint`, intercepting known screenshot shortcut keystrokes, disabling context menus, disabling drag/selection on question prompts), but never claims prevention.
- **Tab & Window Switching Detection (D2):**
  Browsers cannot prevent a user from Alt-Tabbing or switching applications. Skillo uses standard Page Visibility APIs (`visibilitychange`) and window focus/blur hooks coupled with `BroadcastChannel` multi-tab locks to detect when the candidate leaves the proctored viewport. Defocus and tab hide events trigger an immediate session pause, halt all interview countdown clocks, and log an integrity strike to the immutable session ledger.
- **No Reliance on Invasive DevTools Traps:**
  Skillo intentionally avoids heuristic devtools-detection loops (such as timing `console.log` getters or recursive debugger breakpoints). Such techniques trigger false positives and severely degrade candidate accessibility.

---

### 2. Biometric Privacy & Device-Only Processing (D9)
- **Zero Facial Images or Video Uploaded:**
  All computer vision and signal processing kernels (MediaPipe FaceLandmarker, ONNX inference, and classical IVP algorithms) execute **entirely on the candidate's client device** via WebAssembly and WebGL/WebGPU workers.
- **Only Mathematical Scalars Leave the Device:**
  The server and persistent database only ever receive anonymous mathematical scalars (e.g., mean luminance, skin pixel ratio, Sobel edge magnitude, temporal MAD score, blink frequency) and a canonical SHA-256 digest receipt.
- **Client-Side Proof Thumbnails:**
  Low-resolution diagnostic thumbnails (<= 64x48 px, <= 6 thumbnails per session) display only derived mathematical filters (Sobel edge maps, Otsu binary masks, temporal difference heatmaps), never raw RGB faces. These thumbnails reside strictly in ephemeral client memory/sessionStorage and are stripped before network transmission.

---

### 3. Fairness Policy & Algorithmic Non-Biasing (D7, D8)
- **Zero Score Penalization for Visual Anomalies:**
  Lighting variations, natural gaze divergence, cultural eye contact norms, and physiological differences must never artificially lower a candidate's technical rubric score.
- **Evidence Restricted to Capture Quality & Delivery Commentary:**
  Classical IVP evidence is fenced in the AI evaluator prompt and is strictly used to comment on audio/video delivery conditions (e.g., advising a candidate if their room is underexposed). It is strictly forbidden from lowering technical problem-solving scores.
- **Separation of Integrity Strikes from AI Evaluation:**
  Integrity flags (tab switches, pauses, clipboard attempts) are compiled into an independent audit timeline for college placement cell human review; they do not covertly degrade the candidate's knowledge score.

---

### 4. Hardware Support & Graceful Degradation
- **Supported Browsers:**
  Google Chrome, Microsoft Edge, Mozilla Firefox, and Apple Safari (desktop and mobile).
- **Fullscreen Gesture Requirement (D14):**
  Browsers require an explicit user gesture to enter fullscreen mode. Skillo requests fullscreen from the "Begin secure interview" button click. If fullscreen is declined or unsupported on a given device (e.g., iOS Safari), the interview proceeds safely with a `fullscreen_unavailable` telemetry log rather than locking out the candidate.
- **Graceful Persistence Fallback (D6):**
  If database schemas have not yet applied the latest optional telemetry columns (`ivp_evidence`, `session_integrity`), Skillo's persistence engine catches the missing-column response and retries without dropping core interview answers, ensuring candidate history is never lost.
