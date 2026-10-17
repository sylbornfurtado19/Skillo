# Skillo — Professor Demo Runbook (DEMO_RUNBOOK.md)
**Mission Codename:** PLUS ULTRA  
**Demonstration Length:** ~8 Minutes  
**Audience:** College Placement Cell & Computer Vision Faculty Reviewers  

---

### Step 0: Pre-Flight Environment Setup (1 Minute)
1. **Start the local server:**
   ```bash
   npm run dev
   ```
2. **Open browser:** Navigate to `http://localhost:3000`.
3. **If Camera Hardware is Unavailable or Restricted:**
   Launch Chrome with fake media flags:
   ```bash
   chrome.exe --use-fake-ui-for-media-stream --use-fake-device-for-media-stream http://localhost:3000
   ```
4. **Database Migration Note (D6):**
   The application works immediately out-of-the-box with automatic retry fallback. To persist full evidence to Supabase Postgres, execute the guarded snippet in `supabase_schema.sql`:
   ```sql
   ALTER TABLE mock_interviews ADD COLUMN IF NOT EXISTS ivp_evidence JSONB DEFAULT NULL;
   ALTER TABLE mock_interviews ADD COLUMN IF NOT EXISTS session_integrity JSONB DEFAULT NULL;
   ```

---

### Minute 1–2: Setup & Hardware Preflight Gate (Objective O1)
1. From the Dashboard, click **"Start Practice Session"** to open Career Setup (`/setup`).
2. Select your persona (e.g. "Sarah Chen - Tech Lead"), set question count to 2, and click **"Start Secure Interview"**.
3. **Point of Proof (O1):**
   - The browser lands on `/interview`.
   - Point out that **the interview has NOT started**: no questions are revealed, no timer is ticking, no audio is narrating.
   - Show the **"Camera & Microphone Check"** cards verifying green checkmarks on both hardware tracks.
   - Point out the **Biometric Privacy Notice**: explain to the professor that all classical IVP processing is done locally via WebAssembly, with zero facial images sent over the wire.
4. Click **"Begin secure interview"**.
   - The app attempts full-screen entry and transitions immediately to the active exam room.

---

### Minute 2–4: Active Exam Room & Classical IVP Engine (Objectives O4 & O8)
1. **Point of Proof (O8 - Proctored Exam Room):**
   - Highlight the top persistent **Session Status Bar**:
     - `REC` live indicator.
     - Green camera & microphone live indicators with dynamic microphone audio-level meter.
     - Countdown timer synchronized to the millisecond ledger.
     - Integrity status chip (`Security: Clean`).
     - **Dynamic IVP Chip:** `IVP ENGINE ● ACTIVE · {n} frames · 4 Hz`.
     - Point out the frame counter **visibly incrementing in real time**, proving the headless classical engine is actively analyzing frames.
2. **Point of Proof (O4 - Live IVP Diagnostic Panel):**
   - Direct attention to the right surveillance rail.
   - Show the **3D Head-Pose Pinhole Projection** cube overlaying the candidate's face.
   - Show the **Classical IVP Live Panel**:
     - Click **"HistEq"**: shows real 256-bin equalized grayscale buffer.
     - Click **"Otsu"**: shows real YCrCb human skin mask segmentation.
     - Click **"Sobel"**: shows 3x3 spatial gradient magnitude edge field.
     - Click **"Motion"**: shows temporal minimum absolute difference (MAD) motion heatmap.
     - Show the **EAR/MAR live sparkline** reflecting real candidate blinks.
     - Point out the status label: **"Feeding the evaluator"**.

---

### Minute 4–5: Anti-Cheating & Integrity Pause Machine (Objectives O2, O3, O7)
1. **Point of Proof (O2 - Copy & Drag Deterrence):**
   - Attempt to select or right-click the question text in the interviewer card.
   - Show that context menus and text highlighting are disabled on question content.
   - Type an answer into the Candidate Workspace textarea: show that normal candidate typing is completely responsive and uninhibited.
2. **Point of Proof (O3 & O7 - Window Blur / Tab Switching & Hardware Disconnect):**
   - Switch tabs or click outside the browser window (Alt-Tab).
   - Switch back immediately: show that the **Session Integrity Pause Overlay** has taken over the screen.
   - Show that:
     - The countdown timer is **frozen** at the exact second.
     - Narration and speech recognition are halted.
     - IVP sampling is paused.
     - The overlay displays: `Action required: Candidate switched window or hidden tab`.
   - Click **"Resume Interview"**: the session resumes seamlessly without granting or deducting any unfair time.

---

### Minute 5–7: Final Submission & Evaluator Grading (Objective O5)
1. Click **"Next Question"** or **"Submit Answer"** to proceed through Question 2.
2. Click **"Finish Interview"**:
   - The button shows `Grading in Progress...` with an animated spinner.
   - Explain to the professor:
     - The client compiles the classical IVP sensor metrics (luminance, contrast, skin coverage, Sobel sharpness, motion energy).
     - Generates a **canonical SHA-256 cryptographic digest** (`crypto.subtle`).
     - Transmits the bounded payload to `/api/interview/evaluate`.
     - The server injects the telemetry into the delivery context block.
     - The AI evaluator provides explicit delivery feedback tagged with evidence IDs (`IVP-Q1`, `IVP-Q2`).

---

### Minute 7–8: Results Page Proof of Evidence (Objectives O3, O5, D10)
1. On the `/results` page, scroll to Section 3f and 3g:
2. **Classical IVP Evidence Card (Section 3f):**
   - Show the green badge: **"Consumed by AI Evaluator"**.
   - Show total frames analyzed, average kernel latency (< 8ms), and kernel counts.
   - Show the **Cryptographic SHA-256 seal**: click the copy button to show the hash can be audited.
   - Show the per-question table with exact metrics.
   - Show the **AI Evaluator Delivery Observations** citing `IVP-Q1` and `IVP-Q2`.
3. **Session Integrity Card (Section 3g):**
   - Show the **Integrity Verdict** badge (`Verified Clean Integrity` or `Minor Flags`).
   - Show the **Pause Timeline**: shows the exact timestamp and duration of the test tab switch performed during Minute 4!
   - Highlight the **Honest Limitations Notice**: affirming transparency in browser deterrence versus OS-level constraints.

---

### Conclusion to Presenters
"Skillo has successfully unified academic image processing with a production-grade proctored placement interview. Every visual claim on this screen is backed by authentic WebAssembly kernels and cryptographic proofs running live."
