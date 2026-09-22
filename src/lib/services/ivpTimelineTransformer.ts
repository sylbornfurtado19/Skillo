/**
 * IVP Telemetry Timeline Event Transformer
 *
 * Converts server-side multi-modal telemetry metrics from an EvaluationReport
 * into normalized, chronological TelemetryEvent objects for IVPTelemetryTimeline.
 */

import type {
  EvaluationReport,
  DistractionEvent,
  StressSpikeEvent,
  GesturalEvent,
} from '@/types/index';
import type { TelemetryEvent } from '@/components/ui/IVPTelemetryTimeline';

function formatDirection(direction: string): string {
  switch (direction) {
    case 'LOOKING_LEFT':
      return 'Looking Left';
    case 'LOOKING_RIGHT':
      return 'Looking Right';
    case 'LOOKING_DOWN':
      return 'Looking Down';
    case 'OFF_SCREEN':
      return 'Off-Screen';
    default:
      return direction.replace(/_/g, ' ');
  }
}

/**
 * Extracts and maps all anomalous or gestural telemetry events from an EvaluationReport
 * into a single chronological TelemetryEvent[] array for the timeline visualizer.
 */
export function extractTelemetryTimelineEvents(
  report?: Partial<EvaluationReport> | null
): TelemetryEvent[] {
  if (!report) return [];

  const events: TelemetryEvent[] = [];

  // 1. Gaze Distraction Events
  const distractionEvents: DistractionEvent[] =
    report.eyeContactMetrics?.distractionEvents ?? [];

  for (const d of distractionEvents) {
    const rawMs = d.startTimeMs ?? (d as any).startMs ?? 0;
    const timestampSec = Math.max(0, Math.round((rawMs / 1000) * 10) / 10);
    const duration = d.durationSeconds ? Math.round(d.durationSeconds * 10) / 10 : 1.5;
    const dirLabel = formatDirection(d.direction);

    events.push({
      timestampSec,
      type: 'gaze_distraction',
      label: d.direction === 'OFF_SCREEN' ? 'Off-Screen Gaze Deviation' : `Gaze Shift (${dirLabel})`,
      detail:
        d.direction === 'OFF_SCREEN'
          ? `Gaze diverted off-screen sustained for ${duration}s.`
          : `Gaze deviation towards ${dirLabel.toLowerCase()} sustained for ${duration}s.`,
      severity: (d.severity?.toLowerCase() as 'low' | 'medium' | 'high') || 'medium',
    });
  }

  // 2. Stress / Arousal Spike Events
  const stressEvents: StressSpikeEvent[] =
    report.affectiveMetrics?.stressSpikeEvents ?? [];

  for (const s of stressEvents) {
    const rawMs = s.startTimeMs ?? (s as any).timestampMs ?? 0;
    const timestampSec = Math.max(0, Math.round((rawMs / 1000) * 10) / 10);
    const peakArousal = typeof s.peakArousal === 'number' ? s.peakArousal : 0.7;
    const nadirValence = typeof s.nadirValence === 'number' ? s.nadirValence : -0.35;
    const duration = s.durationSeconds ? Math.round(s.durationSeconds * 10) / 10 : 1.0;

    events.push({
      timestampSec,
      type: 'stress_spike',
      label: 'Stress / Arousal Spike',
      detail:
        s.triggerContext ||
        `Arousal reached ${peakArousal.toFixed(2)} with Valence ${nadirValence.toFixed(2)} sustained for ${duration}s.`,
      severity: peakArousal >= 0.75 ? 'high' : peakArousal >= 0.65 ? 'medium' : 'low',
    });
  }

  // 3. Gestural Events (Nodding and Head Shaking)
  const gesturalEvents: GesturalEvent[] =
    report.headPoseMetrics?.gesturalEvents ?? [];

  for (const g of gesturalEvents) {
    const rawMs = g.startTimeMs ?? (g as any).timestampMs ?? 0;
    const timestampSec = Math.max(0, Math.round((rawMs / 1000) * 10) / 10);
    const duration = g.durationSeconds ? Math.round(g.durationSeconds * 10) / 10 : 0.5;
    const severity = (g.intensity?.toLowerCase() as 'low' | 'medium' | 'high') || 'low';

    const gType = String(g.gestureType || '').toUpperCase();

    if (gType === 'NODDING') {
      events.push({
        timestampSec,
        type: 'nodding',
        label: 'Affirmative Nodding Detected',
        detail: `Cyclic pitch oscillation (${duration}s duration, ${severity} intensity).`,
        severity,
      });
    } else if (gType === 'HEAD_SHAKING' || gType === 'HEAD_SHAKE') {
      events.push({
        timestampSec,
        type: 'head_shake',
        label: 'Head Shaking Detected',
        detail: `Cyclic yaw oscillation (${duration}s duration, ${severity} intensity).`,
        severity: severity === 'low' ? 'medium' : severity,
      });
    }
    // Note: Other gestures (e.g. POSTURE_SLUMP, RAPID_TILT) are omitted as they do not map to TelemetryEvent types
  }

  // Sort events chronologically by timestampSec
  events.sort((a, b) => a.timestampSec - b.timestampSec);

  return events;
}
