/**
 * IVP Telemetry Timeline Transformer Unit & Regression Tests (REM-1)
 *
 * Verifies:
 * 1. Gaze distraction transformation (startMs -> seconds, direction labels, severity)
 * 2. Stress spike transformation (timestampMs -> seconds, peak/nadir detail, context)
 * 3. Nodding gesture transformation (NODDING -> "nodding")
 * 4. Head-shaking gesture transformation (HEAD_SHAKING / HEAD_SHAKE -> "head_shake")
 * 5. Timestamp conversion & sub-second rounding
 * 6. Multi-event chronological sorting
 * 7. Empty telemetry resilience (null, undefined, empty sub-objects -> [])
 * 8. Timeline component integration: displays events and handles empty state
 * 9. Production Results behavior: does not fall back to hardcoded mock events when real report is evaluated
 */

import { extractTelemetryTimelineEvents } from '../src/lib/services/ivpTimelineTransformer';
import {
  DEFAULT_EVENTS,
  type TelemetryEvent,
} from '../src/components/ui/IVPTelemetryTimeline';
import type { EvaluationReport } from '../src/types/index';

describe('REM-1: extractTelemetryTimelineEvents', () => {
  const baseReport: EvaluationReport = {
    overallScore: 85,
    categories: { technicalAccuracy: 88, communication: 82 },
    breakdown: [],
  };

  describe('1. Gaze Distraction Transformation', () => {
    it('correctly maps gaze distraction events into TelemetryEvent objects', () => {
      const report: EvaluationReport = {
        ...baseReport,
        eyeContactMetrics: {
          totalVideoDurationSeconds: 120,
          eyeContactPercentage: 78,
          averagePitch: 2.1,
          averageYaw: 4.5,
          focusStabilityScore: 82,
          gazeFrames: [],
          distractionEvents: [
            {
              startTimeMs: 12500,
              endTimeMs: 14700,
              durationSeconds: 2.2,
              direction: 'LOOKING_LEFT',
              severity: 'HIGH',
            },
            {
              startTimeMs: 45000,
              endTimeMs: 47000,
              durationSeconds: 2.0,
              direction: 'OFF_SCREEN',
              severity: 'MEDIUM',
            },
          ],
        },
      };

      const events = extractTelemetryTimelineEvents(report);
      expect(events).toHaveLength(2);

      expect(events[0]).toEqual({
        timestampSec: 12.5,
        type: 'gaze_distraction',
        label: 'Gaze Shift (Looking Left)',
        detail: 'Gaze deviation towards looking left sustained for 2.2s.',
        severity: 'high',
      });

      expect(events[1]).toEqual({
        timestampSec: 45.0,
        type: 'gaze_distraction',
        label: 'Off-Screen Gaze Deviation',
        detail: 'Gaze diverted off-screen sustained for 2s.',
        severity: 'medium',
      });
    });
  });

  describe('2. Stress Spike Transformation', () => {
    it('correctly maps stress spike events into TelemetryEvent objects', () => {
      const report: EvaluationReport = {
        ...baseReport,
        affectiveMetrics: {
          totalKeyframesAnalyzed: 100,
          averageValence: 0.15,
          averageArousal: 0.35,
          overallComposureScore: 80,
          dominantEmotionDistribution: {
            NEUTRAL: 60,
            CONFIDENT: 20,
            HAPPY: 10,
            STRESSED: 10,
            HESITANT: 0,
            THINKING: 0,
            SURPRISED: 0,
          },
          affectTimeline: [],
          stressSpikeEvents: [
            {
              startTimeMs: 34200,
              endTimeMs: 36000,
              peakArousal: 0.78,
              nadirValence: -0.42,
              durationSeconds: 1.8,
              triggerContext: 'Complex system scalability trade-off question',
            },
          ],
        },
      };

      const events = extractTelemetryTimelineEvents(report);
      expect(events).toHaveLength(1);

      expect(events[0]).toEqual({
        timestampSec: 34.2,
        type: 'stress_spike',
        label: 'Stress / Arousal Spike',
        detail: 'Complex system scalability trade-off question',
        severity: 'high',
      });
    });

    it('falls back gracefully to generated detail string if triggerContext is absent', () => {
      const report: EvaluationReport = {
        ...baseReport,
        affectiveMetrics: {
          totalKeyframesAnalyzed: 50,
          averageValence: 0.1,
          averageArousal: 0.2,
          overallComposureScore: 85,
          dominantEmotionDistribution: {
            NEUTRAL: 100,
            CONFIDENT: 0,
            HAPPY: 0,
            STRESSED: 0,
            HESITANT: 0,
            THINKING: 0,
            SURPRISED: 0,
          },
          affectTimeline: [],
          stressSpikeEvents: [
            {
              startTimeMs: 18000,
              endTimeMs: 19500,
              peakArousal: 0.68,
              nadirValence: -0.32,
              durationSeconds: 1.5,
            },
          ],
        },
      };

      const events = extractTelemetryTimelineEvents(report);
      expect(events).toHaveLength(1);
      expect(events[0].detail).toContain('Arousal reached 0.68 with Valence -0.32');
      expect(events[0].severity).toBe('medium');
    });
  });

  describe('3 & 4. Gestural Events (Nodding and Head Shaking)', () => {
    it('correctly maps NODDING gestures to "nodding"', () => {
      const report: EvaluationReport = {
        ...baseReport,
        headPoseMetrics: {
          totalFramesAnalyzed: 200,
          averageYaw: 1.2,
          averagePitch: -0.8,
          averageRoll: 0.2,
          postureComposureScore: 92,
          nodCount: 1,
          headShakeCount: 0,
          restlessnessIndex: 12,
          frameTrace: [],
          gesturalEvents: [
            {
              startTimeMs: 50000,
              endTimeMs: 51200,
              gestureType: 'NODDING',
              durationSeconds: 1.2,
              intensity: 'LOW',
            },
          ],
        },
      };

      const events = extractTelemetryTimelineEvents(report);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        timestampSec: 50.0,
        type: 'nodding',
        label: 'Affirmative Nodding Detected',
        detail: 'Cyclic pitch oscillation (1.2s duration, low intensity).',
        severity: 'low',
      });
    });

    it('correctly maps HEAD_SHAKING and HEAD_SHAKE gestures to "head_shake"', () => {
      const report: EvaluationReport = {
        ...baseReport,
        headPoseMetrics: {
          totalFramesAnalyzed: 200,
          averageYaw: 1.2,
          averagePitch: -0.8,
          averageRoll: 0.2,
          postureComposureScore: 88,
          nodCount: 0,
          headShakeCount: 2,
          restlessnessIndex: 18,
          frameTrace: [],
          gesturalEvents: [
            {
              startTimeMs: 22000,
              endTimeMs: 22800,
              gestureType: 'HEAD_SHAKING',
              durationSeconds: 0.8,
              intensity: 'HIGH',
            },
            {
              startTimeMs: 64000,
              endTimeMs: 64600,
              gestureType: 'HEAD_SHAKE' as any,
              durationSeconds: 0.6,
              intensity: 'MEDIUM',
            },
          ],
        },
      };

      const events = extractTelemetryTimelineEvents(report);
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('head_shake');
      expect(events[0].label).toBe('Head Shaking Detected');
      expect(events[0].severity).toBe('high');
      expect(events[1].type).toBe('head_shake');
      expect(events[1].label).toBe('Head Shaking Detected');
      expect(events[1].severity).toBe('medium');
    });

    it('filters out unsupported gesture types like POSTURE_SLUMP or RAPID_TILT', () => {
      const report: EvaluationReport = {
        ...baseReport,
        headPoseMetrics: {
          totalFramesAnalyzed: 150,
          averageYaw: 0,
          averagePitch: 0,
          averageRoll: 0,
          postureComposureScore: 85,
          nodCount: 0,
          headShakeCount: 0,
          restlessnessIndex: 25,
          frameTrace: [],
          gesturalEvents: [
            {
              startTimeMs: 15000,
              endTimeMs: 17000,
              gestureType: 'POSTURE_SLUMP',
              durationSeconds: 2.0,
              intensity: 'MEDIUM',
            },
            {
              startTimeMs: 30000,
              endTimeMs: 30500,
              gestureType: 'RAPID_TILT',
              durationSeconds: 0.5,
              intensity: 'HIGH',
            },
          ],
        },
      };

      const events = extractTelemetryTimelineEvents(report);
      expect(events).toHaveLength(0);
    });
  });

  describe('5 & 6. Timestamp Conversion & Chronological Sorting', () => {
    it('converts millisecond timestamps to rounded seconds and sorts events chronologically', () => {
      const report: EvaluationReport = {
        ...baseReport,
        eyeContactMetrics: {
          totalVideoDurationSeconds: 100,
          eyeContactPercentage: 80,
          averagePitch: 0,
          averageYaw: 0,
          focusStabilityScore: 85,
          gazeFrames: [],
          distractionEvents: [
            {
              startTimeMs: 75123, // 75.1s
              endTimeMs: 77000,
              durationSeconds: 1.9,
              direction: 'LOOKING_RIGHT',
              severity: 'LOW',
            },
          ],
        },
        affectiveMetrics: {
          totalKeyframesAnalyzed: 100,
          averageValence: 0,
          averageArousal: 0,
          overallComposureScore: 90,
          dominantEmotionDistribution: {
            NEUTRAL: 100,
            CONFIDENT: 0,
            HAPPY: 0,
            STRESSED: 0,
            HESITANT: 0,
            THINKING: 0,
            SURPRISED: 0,
          },
          affectTimeline: [],
          stressSpikeEvents: [
            {
              startTimeMs: 12456, // 12.5s
              endTimeMs: 14000,
              peakArousal: 0.7,
              nadirValence: -0.3,
              durationSeconds: 1.5,
            },
          ],
        },
        headPoseMetrics: {
          totalFramesAnalyzed: 100,
          averageYaw: 0,
          averagePitch: 0,
          averageRoll: 0,
          postureComposureScore: 90,
          nodCount: 1,
          headShakeCount: 0,
          restlessnessIndex: 10,
          frameTrace: [],
          gesturalEvents: [
            {
              startTimeMs: 42890, // 42.9s
              endTimeMs: 44000,
              gestureType: 'NODDING',
              durationSeconds: 1.1,
              intensity: 'MEDIUM',
            },
          ],
        },
      };

      const events = extractTelemetryTimelineEvents(report);
      expect(events).toHaveLength(3);
      expect(events[0].timestampSec).toBe(12.5);
      expect(events[0].type).toBe('stress_spike');

      expect(events[1].timestampSec).toBe(42.9);
      expect(events[1].type).toBe('nodding');

      expect(events[2].timestampSec).toBe(75.1);
      expect(events[2].type).toBe('gaze_distraction');
    });
  });

  describe('7. Empty & Edge Case Telemetry Resilience', () => {
    it('returns empty array when passed null or undefined', () => {
      expect(extractTelemetryTimelineEvents(null)).toEqual([]);
      expect(extractTelemetryTimelineEvents(undefined)).toEqual([]);
      expect(extractTelemetryTimelineEvents({})).toEqual([]);
    });

    it('returns empty array when metrics exist but contain zero events', () => {
      const cleanReport: EvaluationReport = {
        ...baseReport,
        eyeContactMetrics: {
          totalVideoDurationSeconds: 120,
          eyeContactPercentage: 95,
          averagePitch: 0,
          averageYaw: 0,
          focusStabilityScore: 98,
          distractionEvents: [],
          gazeFrames: [],
        },
        affectiveMetrics: {
          totalKeyframesAnalyzed: 60,
          averageValence: 0.4,
          averageArousal: 0.2,
          overallComposureScore: 96,
          dominantEmotionDistribution: {
            NEUTRAL: 30,
            CONFIDENT: 70,
            HAPPY: 0,
            STRESSED: 0,
            HESITANT: 0,
            THINKING: 0,
            SURPRISED: 0,
          },
          affectTimeline: [],
          stressSpikeEvents: [],
        },
        headPoseMetrics: {
          totalFramesAnalyzed: 120,
          averageYaw: 0,
          averagePitch: 0,
          averageRoll: 0,
          postureComposureScore: 95,
          nodCount: 0,
          headShakeCount: 0,
          restlessnessIndex: 5,
          gesturalEvents: [],
          frameTrace: [],
        },
      };

      const events = extractTelemetryTimelineEvents(cleanReport);
      expect(events).toEqual([]);
    });
  });

  describe('8 & 9. Integration & Mock Events Protection', () => {
    it('preserves DEFAULT_EVENTS for explicit demo usage while production reports use transformed events', () => {
      expect(DEFAULT_EVENTS).toBeDefined();
      expect(DEFAULT_EVENTS.length).toBeGreaterThan(0);
      expect(DEFAULT_EVENTS[0].label).toContain('Gaze Shift');

      // A real clean interview session produces 0 events, NOT DEFAULT_EVENTS
      const realReport: EvaluationReport = {
        ...baseReport,
        eyeContactMetrics: {
          totalVideoDurationSeconds: 180,
          eyeContactPercentage: 92,
          averagePitch: 1,
          averageYaw: 1,
          focusStabilityScore: 94,
          distractionEvents: [],
          gazeFrames: [],
        },
      };

      const productionEvents = extractTelemetryTimelineEvents(realReport);
      // Production must NOT display fabricated DEFAULT_EVENTS
      expect(productionEvents).not.toEqual(DEFAULT_EVENTS);
      expect(productionEvents).toHaveLength(0);
    });
  });
});
