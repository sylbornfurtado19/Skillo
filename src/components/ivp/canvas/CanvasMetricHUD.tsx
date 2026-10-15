'use client';

import React from 'react';
import type { DiagnosticMode, DiagnosticMetrics } from './types';

export interface CanvasMetricHUDProps {
  activeMode: DiagnosticMode;
  liveMetrics: DiagnosticMetrics;
}

export default function CanvasMetricHUD({ activeMode, liveMetrics }: CanvasMetricHUDProps) {
  return (
    <div className="absolute bottom-3 right-3 bg-surface/95 backdrop-blur-md border border-border shadow-soft px-3 py-1.5 rounded-xl text-[10px] font-mono flex items-center gap-3">
      {activeMode === 'SOBEL_GRADIENTS' && liveMetrics.sobelStats && (
        <>
          <span className="text-text-secondary">
            Max |∇|: <strong className="text-success">{liveMetrics.sobelStats.maxMagnitude} px</strong>
          </span>
          <span className="text-text-secondary">
            Edge Coverage: <strong className="text-warning">{liveMetrics.sobelStats.edgePixelRatio.toFixed(1)}%</strong>
          </span>
        </>
      )}

      {activeMode === 'YCRCB_SKIN_OTSU' && liveMetrics.otsuStats && (
        <>
          <span className="text-text-secondary">
            Otsu Threshold t*: <strong className="text-success">{liveMetrics.otsuStats.otsuThreshold}</strong>
          </span>
          <span className="text-text-secondary">
            Skin Area: <strong className="text-secondary">{liveMetrics.otsuStats.skinPixelRatio.toFixed(1)}%</strong>
          </span>
        </>
      )}

      {activeMode === 'LUMINANCE_HISTEQ' && liveMetrics.histStats && (
        <>
          <span className="text-text-secondary">
            Mean Luma: <strong className="text-success">{liveMetrics.histStats.meanVal.toFixed(1)}</strong>
          </span>
          <span className="text-text-secondary">
            Range: <strong className="text-text-primary">[{liveMetrics.histStats.minVal}..{liveMetrics.histStats.maxVal}]</strong>
          </span>
        </>
      )}

      {activeMode === 'TEMPORAL_MAD' && liveMetrics.madStats && (
        <>
          <span className="text-text-secondary">
            MAD Score: <strong className="text-danger">{liveMetrics.madStats.madScore.toFixed(2)}</strong>
          </span>
          <span className="text-text-secondary">
            Motion Area: <strong className="text-warning">{liveMetrics.madStats.motionAreaRatio.toFixed(1)}%</strong>
          </span>
        </>
      )}
    </div>
  );
}
