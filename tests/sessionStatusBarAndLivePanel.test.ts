import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SessionStatusBar from '../src/components/interview/session/SessionStatusBar';
import IVPLivePanel from '../src/components/interview/session/IVPLivePanel';
import type { IVPEvidenceRunnerHandle } from '../src/hooks/useIVPEvidenceRunner';

describe('Phase 4: SessionStatusBar & IVPLivePanel (O4 verification)', () => {
  describe('SessionStatusBar', () => {
    it('proves IVP Engine chip text is derived dynamically from runner state', () => {
      // 1. Active state with 42 frames at 4 Hz
      const activeHtml = renderToStaticMarkup(
        React.createElement(SessionStatusBar, {
          cameraActive: true,
          micActive: true,
          audioLevel: 0.75,
          ivpStatus: 'active',
          framesAnalyzed: 42,
          samplingHz: 4,
          integrityFlagsCount: 0,
          currentQuestionIndex: 1,
          totalQuestions: 5,
          timeLeftSec: 125,
          showIvpEngineChip: true,
        })
      );

      expect(activeHtml).toContain('IVP ENGINE');
      expect(activeHtml).toContain('ACTIVE · 42 frames · 4 Hz');
      expect(activeHtml).toContain('Secure · 0 flags');
      expect(activeHtml).toContain('2:05'); // 125 seconds
      expect(activeHtml).toContain('REC');
      expect(activeHtml).toContain('CAM ON');
      expect(activeHtml).toContain('MIC');

      // 2. Paused state with 88 frames
      const pausedHtml = renderToStaticMarkup(
        React.createElement(SessionStatusBar, {
          cameraActive: false,
          micActive: true,
          audioLevel: 0.1,
          ivpStatus: 'paused',
          framesAnalyzed: 88,
          samplingHz: 4,
          integrityFlagsCount: 3,
          currentQuestionIndex: 2,
          totalQuestions: 5,
          timeLeftSec: 25,
          showIvpEngineChip: true,
        })
      );

      expect(pausedHtml).toContain('PAUSED · 88 frames');
      expect(pausedHtml).not.toContain('ACTIVE · 88 frames');
      expect(pausedHtml).toContain('3 flags');
      expect(pausedHtml).toContain('0:25');
      expect(pausedHtml).toContain('CAM OFF');

      // 3. Idle state (by default showIvpEngineChip is false to hide diagnostic chip on frontend)
      const idleHtml = renderToStaticMarkup(
        React.createElement(SessionStatusBar, {
          cameraActive: false,
          micActive: false,
          audioLevel: 0,
          ivpStatus: 'stopped',
          framesAnalyzed: 0,
          samplingHz: 0,
          integrityFlagsCount: 0,
          currentQuestionIndex: 0,
          totalQuestions: 3,
          timeLeftSec: 180,
        })
      );

      expect(idleHtml).not.toContain('IVP ENGINE');
      expect(idleHtml).toContain('Secure · 0 flags');
    });
  });

  describe('IVPLivePanel', () => {
    const createMockRunner = (status: 'running' | 'paused' | 'idle', frames: number): IVPEvidenceRunnerHandle => ({
      status,
      framesAnalyzed: frames,
      samplingHz: 4,
      avgKernelMs: 3.2,
      kernelCounts: {
        histogramEq: frames,
        otsuYCrCb: frames,
        sobel: frames,
        temporalMAD: frames,
        earMar: frames,
      },
      latestBuffers: null,
      latestThumbnails: [],
      getReceipt: jest.fn().mockResolvedValue({} as any),
      reset: jest.fn(),
    });

    it('shows "Feeding the evaluator" badge only when runner is actively running', () => {
      const runningRunner = createMockRunner('running', 105);
      const runningHtml = renderToStaticMarkup(
        React.createElement(IVPLivePanel, { runner: runningRunner, sparklineSignal: 0.45 })
      );

      expect(runningHtml).toContain('Feeding the evaluator');
      expect(runningHtml).toContain('105');
      expect(runningHtml).toContain('4 Hz');
      expect(runningHtml).toContain('3.2 ms');

      const pausedRunner = createMockRunner('paused', 105);
      const pausedHtml = renderToStaticMarkup(
        React.createElement(IVPLivePanel, { runner: pausedRunner, sparklineSignal: 0.45 })
      );

      expect(pausedHtml).not.toContain('Feeding the evaluator');
      expect(pausedHtml).toContain('PAUSED');
      expect(pausedHtml).toContain('105');
    });

    it('renders diagnostic mode tabs replicating the IVP Lab capabilities', () => {
      const runner = createMockRunner('running', 50);
      const html = renderToStaticMarkup(
        React.createElement(IVPLivePanel, { runner, defaultMode: 'grid' })
      );

      expect(html).toContain('Grid');
      expect(html).toContain('HistEq');
      expect(html).toContain('Otsu');
      expect(html).toContain('Sobel');
      expect(html).toContain('Motion');
      expect(html).toContain('Unit 2');
      expect(html).toContain('Unit 6-7');
      expect(html).toContain('Unit 4');
      expect(html).toContain('Unit 8');
    });
  });
});
