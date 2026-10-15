'use client';

import React from 'react';

export interface CalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  calibrationStep: number;
  setCalibrationStep: (step: number) => void;
  calibrationBias: { x: number; y: number };
  setCalibrationBias: (bias: { x: number; y: number }) => void;
  lastRawNormPts: Array<{ x: number; y: number }> | null;
}

export default function CalibrationModal({
  isOpen,
  onClose,
  calibrationStep,
  setCalibrationStep,
  calibrationBias,
  setCalibrationBias,
  lastRawNormPts,
}: CalibrationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-2xl p-6 max-w-md w-full shadow-soft space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="text-sm font-mono font-bold text-text-primary flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
            Personal Face Calibration
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary text-xs font-mono cursor-pointer"
          >
            ✕ CLOSE
          </button>
        </div>

        <div className="space-y-3 text-xs text-text-secondary">
          <div className="flex items-center justify-center py-4">
            <div className="w-24 h-24 rounded-full border-2 border-dashed border-primary/40 flex items-center justify-center animate-pulse">
              <span className="text-2xl">👤</span>
            </div>
          </div>

          {calibrationStep === 1 && (
            <div className="text-center space-y-2">
              <p className="font-semibold text-text-primary">Step 1: Neutral Gaze Alignment</p>
              <p className="text-text-secondary text-[11px]">
                Look straight ahead into the webcam with a relaxed, neutral expression.
              </p>
              <button
                type="button"
                onClick={() => setCalibrationStep(2)}
                className="w-full mt-3 py-2 bg-primary hover:bg-primary-hover text-text-on-primary rounded-lg font-mono text-xs font-bold transition cursor-pointer"
              >
                CONTINUE TO STEP 2 ▶
              </button>
            </div>
          )}

          {calibrationStep === 2 && (
            <div className="text-center space-y-2">
              <p className="font-semibold text-text-primary">Step 2: Natural Smile & Speech</p>
              <p className="text-text-secondary text-[11px]">
                Smile gently or speak a short sentence to register your natural lip corner dynamics.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (lastRawNormPts && lastRawNormPts.length >= 70) {
                    const lp = lastRawNormPts[68];
                    const rp = lastRawNormPts[69];
                    const midX = (lp.x + rp.x) / 2;
                    const midY = (lp.y + rp.y) / 2;
                    const bias = {
                      x: (midX - 0.5) * 0.05,
                      y: (midY - 0.45) * 0.05,
                    };
                    setCalibrationBias(bias);
                    try {
                      window.localStorage.setItem('ivp_user_calibration', JSON.stringify({ bias, calibratedAt: Date.now() }));
                    } catch {}
                  }
                  setCalibrationStep(3);
                }}
                className="w-full mt-3 py-2 bg-primary hover:bg-primary-hover text-text-on-primary rounded-lg font-mono text-xs font-bold transition cursor-pointer"
              >
                FINALIZE CALIBRATION ▶
              </button>
            </div>
          )}

          {calibrationStep === 3 && (
            <div className="text-center space-y-3">
              <div className="text-success font-bold text-sm">✓ Calibration Complete!</div>
              <p className="text-text-secondary text-[11px]">
                Personalized anchor bias saved: ({calibrationBias.x.toFixed(4)}, {calibrationBias.y.toFixed(4)}).
                Additive offsets will cling tightly to your unique facial geometry.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCalibrationBias({ x: 0, y: 0 });
                    try { window.localStorage.removeItem('ivp_user_calibration'); } catch {}
                    onClose();
                  }}
                  className="flex-1 py-2 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20 rounded-lg font-mono text-xs transition cursor-pointer"
                >
                  RESET TO DEFAULTS
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 bg-primary hover:bg-primary-hover text-text-on-primary rounded-lg font-mono text-xs font-bold transition cursor-pointer"
                >
                  DONE
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
