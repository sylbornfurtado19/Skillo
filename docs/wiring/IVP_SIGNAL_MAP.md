# IVP Multi-Modal Signal Map

This document establishes the canonical **Producer $\rightarrow$ Consumer $\rightarrow$ Pixel** mapping across all Interactive Vision Pipeline (IVP) signals, mathematical transforms, and UI components in Skillo.

Every vision signal in Skillo follows a deterministic journey:
1. **Producer**: Capture/worker engine generating numerical telemetry frames.
2. **Intermediate Consumer**: Session buffers, mathematical aggregators, EMA smoothers, or evaluation services.
3. **Pixel**: The specific UI element, chart, SVG overlay, canvas, badge, or card displayed to the candidate.

---

## 1. Master Signal Flow Matrix

| Signal Domain | Model / Engine (Producer) | Pipeline / Aggregator (Consumer) | Screen / Pixel Surface | Visual Representation |
|---|---|---|---|---|
| **Gaze Rays & Focus Zones** | **L2CS-Net** (`src/workers/onnx.worker.ts`, `src/lib/services/ivpGazeEngine.ts`) | `useIVPSessionPipeline.ts` $\rightarrow$ `GazeAngleEMA` $\rightarrow$ `processGazeFrames` $\rightarrow$ `interviewEvaluation.server.ts` | 1. Live HUD (`IVPCameraPreview.tsx`)<br>2. Results Overview (`Results.tsx`)<br>3. Gaze Card (`GazeAnalyticsCard.tsx`) | 3D Ray vector projection, Focus Zone badge (`LOOKING_UP`, `CENTER_SCREEN`, etc.), Eye contact ratio meter & Distraction timeline markers |
| **3D Head Pose & Gestures** | **HopeNet** (`src/workers/onnx.worker.ts`, `src/lib/services/ivpPoseEngine.ts`) | `useIVPSessionPipeline.ts` $\rightarrow$ `HeadPoseEMA` $\rightarrow$ `analyzeHeadPoseAndGestures` $\rightarrow$ `interviewEvaluation.server.ts` | 1. Live HUD (`IVPCameraPreview.tsx`)<br>2. Pose Card (`PostureComposureCard.tsx`)<br>3. Timeline (`IVPTelemetryTimeline.tsx`) | 3D Euler coordinate axes (Yaw, Pitch, Roll), Cyclic nod/head-shake counter badges, Posture stability percentage gauge |
| **Facial Affect & Composure** | **AffectNet** (`src/workers/onnx.worker.ts`, `src/lib/services/ivpAffectEngine.ts`) | `useIVPSessionPipeline.ts` $\rightarrow$ `AffectiveEMA` $\rightarrow$ `processAffectFrames` $\rightarrow$ `interviewEvaluation.server.ts` | 1. Affect Card (`FacialComposureCard.tsx`)<br>2. Timeline Track (`IVPTelemetryTimeline.tsx`)<br>3. Lab Quadrant (`IVPInteractiveCanvas.tsx`) | 2D Valence-Arousal coordinate plane ($V \in [-1, 1]$, $A \in [-1, 1]$), Discrete emotion chip, Stress spike warning banners |
| **Lip Sync & Anti-Spoofing** | **SyncNet** (`src/lib/services/ivpSyncEngine.ts`, `src/components/ui/IVPSyncTracker.tsx`) | `useIVPSessionPipeline.ts` $\rightarrow$ `processLipSyncWindows` $\rightarrow$ `interviewEvaluation.server.ts` | 1. Live Session (`IVPSyncTracker.tsx`)<br>2. Verification Card (`LipSyncVerificationCard.tsx`) | Audio-visual cross-modal L2 distance bar, Audio latency offset ($ms$), Anti-spoofing authenticity status chip |
| **Temporal Motion & Presence** | **Otsu Motion Engine** (`src/lib/services/temporalMotion.ts`, `src/lib/services/backgroundSegmentation.ts`) | `TemporalMotionDetector` $\rightarrow$ `useVisionWorker.ts` $\rightarrow$ `useIVPSessionPipeline.ts` | 1. Live HUD Alert (`IVPCameraPreview.tsx`)<br>2. IVP Lab (`IVPLab.tsx`) | Subject presence indicator chip (`PRESENT` vs `VACANT`), Excessive motion jitter warning banner |
| **Delivery Composite** | **Multi-Modal Weight Engine** (`src/lib/services/deliveryComposite.ts`) | `calculateDeliveryComposite` $\rightarrow$ `interviewEvaluation.server.ts` $\rightarrow$ `Results.tsx` | Presence & Delivery Card (`Results.tsx:528-560`) | 0–100 composite delivery gauge with dynamic weights breakdown tooltip/badges |
| **Synchronized Telemetry Timeline** | **Timeline Transformer** (`src/lib/services/ivpTimelineTransformer.ts`) | `extractTelemetryTimelineEvents` $\rightarrow$ `IVPTelemetryTimeline.tsx` | Multi-Modal Timeline (`Results.tsx:990-1000`) | Chronological horizontal multi-track scrubber showing stress spikes, off-screen gaze shifts, and affirmative gestures |

---

## 2. Modality Deep Dives

### 2.1 L2CS-Net 3D Gaze Estimation
* **Producer**: `src/workers/onnx.worker.ts` running quantized ONNX L2CS-Net or pure angular regression fallback in `ivpGazeEngine.ts`.
  - Input: $224 \times 224 \times 3$ tightly cropped face patch computed via `computeFaceRoiCrop`.
  - Output: Soft-argmax continuous pitch ($\theta_p$) and yaw ($\theta_y$) in degrees, plus confidence score $c \in [0, 1]$.
* **Consumer**:
  - `useIVPSessionPipeline.ts` filters raw frames through `GazeAngleEMA` ($\alpha = 0.35$).
  - Evaluates instantaneous eye contact ($|\theta_p| \le 12.5^\circ \land |\theta_y| \le 15.0^\circ$) and focus zone (`CENTER_SCREEN`, `LOOKING_UP`, etc.).
  - Distraction detector flags sustained deviations $> 1.5\text{s}$.
  - `interviewEvaluation.server.ts` aggregates into `eyeContactPercentage` and `distractionEvents`.
* **Pixel Output**:
  - In `IVPCameraPreview.tsx`: Green/amber circular focus crosshair indicating candidate's immediate fixation target.
  - In `GazeAnalyticsCard.tsx`: Donut meter showing eye contact percentage, directional deviation distribution, and sustained distraction event log.

### 2.2 HopeNet 3D Head Pose & Gestures
* **Producer**: `src/workers/onnx.worker.ts` executing HopeNet ResNet-50 Euler model or soft-argmax kinematics in `ivpPoseEngine.ts`.
  - Output: 3D rotation angles $(\text{Yaw}, \text{Pitch}, \text{Roll})$ in degrees $[-90^\circ, 90^\circ]$.
* **Consumer**:
  - `HeadPoseEMA` smooths high-frequency camera vibration.
  - Kinetic velocity calculator computes angular velocity $\Delta \theta / \Delta t$ to distinguish deliberate affirmative nods (cyclic pitch oscillations) and negative head shakes (cyclic yaw oscillations) from static composure.
  - Aggregated into `postureComposureScore` and `detectedGestures` in `interviewEvaluation.server.ts`.
* **Pixel Output**:
  - In `IVPCameraPreview.tsx`: 3D orthogonal coordinate axes overlay (Red: X-Pitch, Green: Y-Yaw, Blue: Z-Roll).
  - In `PostureComposureCard.tsx`: Posture stability gauge (0–100%), nod count, head-shake count, and slouch warnings.

### 2.3 AffectNet Facial Affect & Emotional Composure
* **Producer**: `src/workers/onnx.worker.ts` running MobileNet-AffectNet extracting continuous Valence $V \in [-1, 1]$ and Arousal $A \in [-1, 1]$.
* **Consumer**:
  - `AffectiveEMA` and `CategoricalConsensusSmoother` prevent rapid oscillation across discrete emotion classes (`neutral`, `confident`, `stressed`, `engaged`).
  - Euclidean composure metric $C = 100 \cdot (1 - \frac{\sqrt{(V - V_\text{opt})^2 + (A - A_\text{opt})^2}}{\sqrt{8}})$.
  - Stress spike detector flags windows where Arousal $> 0.70 \land \text{Valence} < -0.30$.
* **Pixel Output**:
  - In `FacialComposureCard.tsx`: 2D Russell circumplex scatter plot with calibrated optimal zone $(V=0.40, A=0.20)$.
  - In `IVPTelemetryTimeline.tsx`: Top horizontal track with red pulse markers for stress events.

### 2.4 SyncNet Lip-Speech Synchronization
* **Producer**: `src/lib/services/ivpSyncEngine.ts` and `src/components/ui/IVPSyncTracker.tsx`.
  - Cross-correlates lip landmark vertical opening velocity ($\Delta \text{MAR} / \Delta t$) with audio energy envelope.
* **Consumer**:
  - Computes minimum Euclidean distance $d(v, a)$ across candidate temporal offsets $\tau \in [-300\text{ms}, 300\text{ms}]$.
  - Flags spoofing alerts if distance remains high during continuous speech ($d > 1.85$).
* **Pixel Output**:
  - In `IVPSyncTracker.tsx`: Micro-meter showing sync latency ($\pm \text{ms}$) in bottom HUD corner.
  - In `LipSyncVerificationCard.tsx`: Audio-video offset latency chart, sync confidence status badge (`VERIFIED` vs `DESYNC`).

### 2.5 Temporal Motion & Otsu Presence
* **Producer**: `src/lib/services/temporalMotion.ts` coupled with `src/lib/services/backgroundSegmentation.ts`.
  - Frame differencing with Otsu adaptive thresholding over downsampled luminance buffers.
* **Consumer**:
  - Flags candidate absence when inter-frame foreground pixels drop below presence threshold for $> 2.0\text{s}$.
  - Flags excessive jitter when motion energy variance exceeds standard baseline.
* **Pixel Output**:
  - In `IVPCameraPreview.tsx`: Status chip displaying `CANDIDATE PRESENT` (green) or `SUBJECT ABSENT` (flashing red).

### 2.6 Delivery Composite
* **Producer**: `src/lib/services/deliveryComposite.ts`.
  - Mathematical formulation:
    $$\text{Composite} = \sum_{m \in M} w_m \cdot S_m \Bigg/ \sum_{m \in M} w_m$$
  - Normalized weights:
    - `eyeContactRatio`: 30% ($w = 0.30$)
    - `postureStability`: 25% ($w = 0.25$)
    - `affectComposure`: 20% ($w = 0.20$)
    - `speechDeliveryScore`: 25% ($w = 0.25$)
* **Consumer**: `interviewEvaluation.server.ts` computes composite; `Results.tsx` renders breakdown.
* **Pixel Output**:
  - "Presence & Delivery" score card (`Results.tsx:528-560`) with individual component cards showing exact percentage weights and status badges.

### 2.7 Multi-Modal Timeline Transformer
* **Producer**: `src/lib/services/ivpTimelineTransformer.ts`.
  - Takes raw `EvaluationReport` metrics and transforms them into time-indexed `TelemetryEvent` structures sorted chronologically.
* **Consumer**: `IVPTelemetryTimeline.tsx` renders interactive scrubbing canvas.
* **Pixel Output**:
  - Horizontal timeline with time markers, event badges, and click-to-inspect detail panel.
  - When camera telemetry is absent, gracefully displays the "Camera Biometrics Unavailable" card with guidance.

---

## 3. Truthfulness Guarantee

Skillo strictly forbids the fabrication of telemetry data:
- **No Mock Fallbacks in Live Reports**: When camera permissions are denied or telemetry is unrecorded, metrics are set to `undefined` and UI renders the `Camera Biometrics Unavailable` banner.
- **Explicit Demo Safeguard**: Synthetic telemetry (`DEFAULT_EVENTS`) is only rendered when `isDemo={true}` is explicitly passed (e.g. in standalone styleguide previews).
