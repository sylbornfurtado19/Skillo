/**
 * IVP Engine Unit Tests — Skillo Platform
 * Covers Part B IVP Engines:
 * 1. LayoutLMv3 Visual Document AI (bounding box normalization & formatting penalty scores)
 * 2. L2CS-Net 3D Gaze Estimation (soft-argmax, gaze vector, focus zone, distraction events)
 * 3. HopeNet 3D Head Pose & Gestures (Euler soft-argmax, angular velocity, nod/shake detection)
 * 4. AffectNet Facial Expression & Composure (2D V-A space, Euclidean composure, stress spikes)
 * 5. SyncNet Lip-Speech Sync & Anti-Spoofing (L2 cross-modal distance, temporal offset, verification status)
 */

import { analyzeVisualDocumentLayout } from '../src/lib/services/documentVision.server';
import {
  softArgmax,
  computeGazeVector,
  evaluateEyeContact,
  classifyFocusZone,
  detectDistractionEvents,
  processGazeFrames,
} from '../src/lib/services/ivpGazeEngine';

import {
  softArgmaxAngle,
  processPoseFrame,
  analyzeGesturalEvents,
  analyzeHeadPoseAndGestures,
} from '../src/lib/services/ivpPoseEngine';
import {
  softArgmaxVA,
  calculateComposureScore,
  classifyDiscreteEmotion,
  detectStressSpikes,
  processAffectFrames,
} from '../src/lib/services/ivpAffectEngine';
import {
  calculateL2Distance,
  evaluateSyncStatus,
  processSyncWindow,
  detectSpoofingAlerts,
  processLipSyncWindows,
} from '../src/lib/services/ivpSyncEngine';

// ═══════════════════════════════════════════════════════════════════════════════
// Engine 6 — LayoutLMv3 Visual Document AI
// ═══════════════════════════════════════════════════════════════════════════════
describe('Engine 6 — LayoutLMv3: analyzeVisualDocumentLayout', () => {
  it('normalizes coordinates to [0,1000] scale and calculates layout formatting score', () => {
    const result = analyzeVisualDocumentLayout('Resume text content with experience and education.');
    expect(result.layoutIntegrityScore).toBeGreaterThanOrEqual(0);
    expect(result.layoutIntegrityScore).toBeLessThanOrEqual(100);
    expect(result.elements.length).toBeGreaterThan(0);
    result.elements.forEach(el => {
      expect(el.boundingBox.x0).toBeGreaterThanOrEqual(0);
      expect(el.boundingBox.y0).toBeGreaterThanOrEqual(0);
      expect(el.boundingBox.x1).toBeLessThanOrEqual(1000);
      expect(el.boundingBox.y1).toBeLessThanOrEqual(1000);
    });
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Engine 7 — L2CS-Net 3D Gaze Estimation
// ═══════════════════════════════════════════════════════════════════════════════
describe('Engine 7 — L2CS-Net: Gaze Estimation', () => {
  it('soft-argmax computes continuous angle expectation', () => {
    const logits = new Array(90).fill(0);
    logits[44] = 10; logits[45] = 10; // Symmetric peak around center bin 44.5 -> 0 degrees
    const angle = softArgmax(logits);
    expect(angle).toBeCloseTo(0, 0);
  });

  it('evaluates eye contact threshold: |pitch| <= 12 and |yaw| <= 15', () => {
    expect(evaluateEyeContact(5, 10)).toBe(true);
    expect(evaluateEyeContact(15, 10)).toBe(false);
    expect(evaluateEyeContact(5, 20)).toBe(false);
  });

  it('classifies focus zones correctly', () => {
    expect(classifyFocusZone(5, 5)).toBe('CENTER_SCREEN');
    expect(classifyFocusZone(0, -25)).toBe('LOOKING_LEFT');
    expect(classifyFocusZone(0, 25)).toBe('LOOKING_RIGHT');
    expect(classifyFocusZone(20, 0)).toBe('LOOKING_UP');
    expect(classifyFocusZone(-20, 0)).toBe('LOOKING_DOWN');
  });

  it('detects distraction events sustained > 1.5 seconds', () => {
    const frames = [
      { frameTimestampMs: 0, gazeAngles: { pitchDegrees: 0, yawDegrees: -30 }, isEyeContact: false, screenFocusZone: 'LOOKING_LEFT' as const, confidenceScore: 0.8 },
      { frameTimestampMs: 1000, gazeAngles: { pitchDegrees: 0, yawDegrees: -30 }, isEyeContact: false, screenFocusZone: 'LOOKING_LEFT' as const, confidenceScore: 0.8 },
      { frameTimestampMs: 2000, gazeAngles: { pitchDegrees: 0, yawDegrees: -30 }, isEyeContact: false, screenFocusZone: 'LOOKING_LEFT' as const, confidenceScore: 0.8 },
    ];
    const events = detectDistractionEvents(frames);
    expect(events.length).toBe(1);
    expect(events[0].durationSeconds).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Engine 8 — HopeNet 3D Head Pose & Gestures
// ═══════════════════════════════════════════════════════════════════════════════
describe('Engine 8 — HopeNet: Head Pose & Gestures', () => {
  it('soft-argmaxAngle computes 3D Euler rotation angles', () => {
    const logits = new Array(90).fill(0);
    logits[44] = 10; logits[45] = 10;
    const angle = softArgmaxAngle(logits);
    expect(angle).toBeCloseTo(0, 0);
  });


  it('calculates angular velocity between consecutive frames', () => {
    const f1 = processPoseFrame({ timestampMs: 0, yawDegrees: 0, pitchDegrees: 0, rollDegrees: 0 });
    const f2 = processPoseFrame({ timestampMs: 1000, yawDegrees: 30, pitchDegrees: 0, rollDegrees: 0 }, f1);
    expect(f2.angularVelocity).toBeCloseTo(30, 0);
  });

  it('detects cyclic nodding gesture (pitch oscillation >= 6 deg)', () => {
    const inputs = [
      { timestampMs: 0, pitchDegrees: 0, yawDegrees: 0, rollDegrees: 0 },
      { timestampMs: 300, pitchDegrees: 10, yawDegrees: 0, rollDegrees: 0 },
      { timestampMs: 600, pitchDegrees: 0, yawDegrees: 0, rollDegrees: 0 },
    ];
    const res = analyzeHeadPoseAndGestures(inputs);
    expect(res.nodCount).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Engine 9 — AffectNet Facial Expression & Composure
// ═══════════════════════════════════════════════════════════════════════════════
describe('Engine 9 — AffectNet: Facial Expression & Composure', () => {
  it('calculates Composure Score relative to target (V=0.40, A=0.20)', () => {
    const idealScore = calculateComposureScore(0.40, 0.20);
    expect(idealScore).toBe(100);
  });

  it('classifies discrete emotions accurately', () => {
    expect(classifyDiscreteEmotion(0.4, 0.2)).toBe('CONFIDENT');
    expect(classifyDiscreteEmotion(-0.4, 0.4)).toBe('STRESSED');
    expect(classifyDiscreteEmotion(-0.4, -0.4)).toBe('HESITANT');
    expect(classifyDiscreteEmotion(0.0, 0.0)).toBe('THINKING');
    expect(classifyDiscreteEmotion(0.0, 0.8)).toBe('SURPRISED');
  });

  it('detects stress spike events (A >= 0.65, V <= -0.30 for >= 3 keyframes)', () => {
    const inputs = [
      { timestampMs: 0, valence: -0.4, arousal: 0.7 },
      { timestampMs: 500, valence: -0.4, arousal: 0.7 },
      { timestampMs: 1000, valence: -0.4, arousal: 0.7 },
    ];
    const res = processAffectFrames(inputs);
    expect(res.stressSpikeEvents.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Engine 10 — SyncNet Lip-Speech Sync & Anti-Spoofing
// ═══════════════════════════════════════════════════════════════════════════════
describe('Engine 10 — SyncNet: Lip-Speech Sync & Anti-Spoofing', () => {
  it('calculates cross-modal L2 distance D(v,a)', () => {
    const vecA = [1.0, 2.0, 3.0];
    const vecB = [1.0, 2.0, 3.0];
    expect(calculateL2Distance(vecA, vecB)).toBe(0);
  });

  it('evaluates sync verification status thresholds', () => {
    expect(evaluateSyncStatus(0.9, 20)).toBe('VERIFIED_GENUINE');
    expect(evaluateSyncStatus(1.0, 120)).toBe('LATENCY_LAG_WARNING');
    expect(evaluateSyncStatus(1.8, 20)).toBe('SPOOFING_ALERT_TRIGGERED');
    expect(evaluateSyncStatus(0.9, 20, 0.01)).toBe('NO_AUDIO_DETECTED');
  });

  it('detects spoofing alert events when desynchronized', () => {
    const inputs = [
      { timestampMs: 0, visualDistance: 1.8, offsetMs: 300, audioEnergy: 0.5 },
      { timestampMs: 1000, visualDistance: 1.8, offsetMs: 300, audioEnergy: 0.5 },
      { timestampMs: 2000, visualDistance: 1.8, offsetMs: 300, audioEnergy: 0.5 },
    ];
    const res = processLipSyncWindows(inputs);
    expect(res.spoofingAlerts.length).toBe(1);
    expect(res.verificationStatus).toBe('SPOOFING_ALERT_TRIGGERED');
  });
});
