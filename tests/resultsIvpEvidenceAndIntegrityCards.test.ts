import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import IVPEvidenceCard from '../src/components/ui/IVPEvidenceCard';
import SessionIntegrityCard from '../src/components/ui/SessionIntegrityCard';
import type { IVPEvidenceReceipt } from '../src/types/ivpEvidence';
import type { SessionIntegrityReport } from '../src/types/integrity';

describe('Phase 6: Results Page IVPEvidenceCard & SessionIntegrityCard (O3, O5, D16)', () => {
  const mockEvidence: IVPEvidenceReceipt = {
    kernelVersion: '1.0.0-ivp-classical',
    samplingHz: 4,
    framesAnalyzed: 180,
    kernelCounts: {
      histogramEq: 180,
      otsuYCrCb: 180,
      sobel: 180,
      temporalMAD: 180,
      earMar: 180,
    },
    avgKernelMs: 3.4,
    perQuestion: [
      {
        questionId: 'q_1',
        questionIndex: 0,
        frames: 90,
        meanLuminance: 126.2,
        contrastStdDev: 41.5,
        clippedPct: 0.5,
        illumination: 'ok',
        skinMaskCoveragePct: 19.4,
        presenceRatio: 0.99,
        sobelEdgeDensity: 14.8,
        sharpnessScore: 72.0,
        motionEnergy: 0.14,
        blinkRatePerMin: 18,
        mouthActivityPct: 38,
        evidenceId: 'IVP-Q1',
      },
    ],
    digestSha256: 'fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
    provenance: 'client-reported',
    consumedByEvaluator: true,
    transmitted: true,
  };

  const mockIntegrity: SessionIntegrityReport = {
    events: [
      {
        id: 'evt_1',
        type: 'tab_hidden',
        atMs: 30000,
        questionId: 'q_1',
        questionIndex: 0,
        pauseReason: 'tab_hidden',
        durationMs: 4200,
        blocked: false,
      },
      {
        id: 'evt_2',
        type: 'copy_attempt',
        atMs: 45000,
        questionId: 'q_1',
        questionIndex: 0,
        blocked: true,
      },
    ],
    totals: {
      pauses: 1,
      pausedMs: 4200,
      tabSwitches: 1,
      fullscreenExits: 0,
      copyPasteAttempts: 1,
      screenshotKeyAttempts: 0,
      navigationAttempts: 0,
      reloads: 0,
    },
    verdict: 'minor_flags',
    policyVersion: '1.0.0-academic',
    limitationsNote: 'Browser integrity monitoring provides detection and deterrence only.',
  };

  describe('IVPEvidenceCard', () => {
    it('renders full receipt, per-question signals, and evaluator observations when present', () => {
      const observations = [
        { evidenceId: 'IVP-Q1', observation: 'Lighting was balanced and eye contact was maintained.' },
      ];

      const html = renderToStaticMarkup(
        React.createElement(IVPEvidenceCard, {
          evidence: mockEvidence,
          observations,
        })
      );

      expect(html).toContain('Classical IVP Evidence Receipt');
      expect(html).toContain('1.0.0-ivp-classical');
      expect(html).toContain('Consumed by AI Evaluator');
      expect(html).toContain('180'); // framesAnalyzed
      expect(html).toContain('3.4 ms'); // avgKernelMs
      expect(html).toContain('900'); // total kernel executions (180 * 5)
      expect(html).toContain('IVP-Q1');
      expect(html).toContain('Q1');
      expect(html).toContain('72 / 100'); // sharpness
      expect(html).toContain('Lighting was balanced and eye contact was maintained.');
      expect(html).toContain('Biometric Privacy Guarantee');
    });

    it('renders unconsumed badge in offline/fallback state without crashing', () => {
      const fallbackEvidence = {
        ...mockEvidence,
        consumedByEvaluator: false,
      };

      const html = renderToStaticMarkup(
        React.createElement(IVPEvidenceCard, {
          evidence: fallbackEvidence,
          observations: null,
        })
      );

      expect(html).toContain('Telemetry Preserved (Unconsumed)');
      expect(html).not.toContain('Consumed by AI Evaluator');
    });

    it('renders graceful fallback card when evidence is absent (D16)', () => {
      const html = renderToStaticMarkup(
        React.createElement(IVPEvidenceCard, {
          evidence: null,
          observations: null,
        })
      );

      expect(html).toContain('Classical IVP Evidence Not Recorded');
      expect(html).not.toContain('Consumed by AI Evaluator');
    });
  });

  describe('SessionIntegrityCard', () => {
    it('renders minor_flags verdict, totals grid, and pause timeline when present', () => {
      const html = renderToStaticMarkup(
        React.createElement(SessionIntegrityCard, {
          integrity: mockIntegrity,
        })
      );

      expect(html).toContain('Placement Proctoring &amp; Integrity Audit');
      expect(html).toContain('Minor Integrity Flags');
      expect(html).toContain('4.2 s'); // paused time
      expect(html).toContain('Pause &amp; Event Accounting Timeline');
      expect(html).toContain('tab hidden');
      expect(html).toContain('Question 1');
      expect(html).toContain('System Integrity Transparency');
      expect(html).toContain('Browser integrity monitoring provides detection and deterrence only.');
    });

    it('renders clean verdict and uninterrupted message when session had zero flags', () => {
      const cleanIntegrity: SessionIntegrityReport = {
        events: [],
        totals: {
          pauses: 0,
          pausedMs: 0,
          tabSwitches: 0,
          fullscreenExits: 0,
          copyPasteAttempts: 0,
          screenshotKeyAttempts: 0,
          navigationAttempts: 0,
          reloads: 0,
        },
        verdict: 'clean',
        policyVersion: '1.0.0-academic',
        limitationsNote: 'Browser integrity monitoring provides detection and deterrence only.',
      };

      const html = renderToStaticMarkup(
        React.createElement(SessionIntegrityCard, {
          integrity: cleanIntegrity,
        })
      );

      expect(html).toContain('Verified Clean Integrity');
      expect(html).toContain('Uninterrupted session. Zero pause interruptions or device disconnections recorded.');
    });

    it('renders graceful fallback card when integrity is absent (D16)', () => {
      const html = renderToStaticMarkup(
        React.createElement(SessionIntegrityCard, {
          integrity: null,
        })
      );

      expect(html).toContain('Session Integrity Not Recorded');
      expect(html).not.toContain('Verified Clean Integrity');
    });
  });
});
