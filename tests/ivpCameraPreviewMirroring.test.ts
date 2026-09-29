/**
 * Focused Unit Tests for IVPCameraPreview Mirroring
 * Verifies that:
 * 1. Diagnostic canvases (gaze and pose) do NOT have CSS transform scaleX(-1) mirroring.
 * 2. Only the video element has CSS scaleX(-1) for selfie mirroring.
 * 3. The pose canvas drawing path mirrors only the video frame via canvas 2D transform (save/translate/scale/drawImage/restore),
 *    ensuring that 3D diagnostic overlays, orientation axes, and HUD text remain un-mirrored and directionally correct.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'fs';
import path from 'path';
import IVPCameraPreview from '../src/components/ui/IVPCameraPreview';

describe('IVPCameraPreview Canvas Mirroring Fix', () => {
  const componentPath = path.resolve(__dirname, '../src/components/ui/IVPCameraPreview.tsx');
  const fileContent = fs.readFileSync(componentPath, 'utf8');

  it('diagnostic canvases do NOT contain scaleX(-1) CSS transform styling', () => {
    // Neither canvas tag should have scaleX(-1)
    const gazeCanvasMatch = fileContent.match(/<canvas[\s\S]*?ref=\{gazeCanvasRef\}[\s\S]*?\/>/);
    expect(gazeCanvasMatch).not.toBeNull();
    expect(gazeCanvasMatch![0]).not.toMatch(/scaleX\(-1\)/);

    const poseCanvasMatch = fileContent.match(/<canvas[\s\S]*?ref=\{poseCanvasRef\}[\s\S]*?\/>/);
    expect(poseCanvasMatch).not.toBeNull();
    expect(poseCanvasMatch![0]).not.toMatch(/scaleX\(-1\)/);
  });

  it('authoritative video element maintains scaleX(-1) for selfie camera display', () => {
    const videoMatch = fileContent.match(/<video[\s\S]*?ref=\{videoRef\}[\s\S]*?\/>/);
    expect(videoMatch).not.toBeNull();
    expect(videoMatch![0]).toMatch(/scaleX\(-1\)/);
  });

  it('pose canvas drawing path mirrors only the video frame via ctx transform', () => {
    // Must save context, translate and scaleX(-1), draw the video, and restore context before rendering HUD diagnostics
    expect(fileContent).toMatch(/ctx\.save\(\);/);
    expect(fileContent).toMatch(/ctx\.translate\(w,\s*0\);/);
    expect(fileContent).toMatch(/ctx\.scale\(-1,\s*1\);/);
    expect(fileContent).toMatch(/ctx\.drawImage\(video,\s*0,\s*0,\s*w,\s*h\);/);
    expect(fileContent).toMatch(/ctx\.restore\(\);/);
  });

  it('renders static markup with unmirrored diagnostic canvases and mirrored video element', () => {
    const mockVideoRef = { current: null } as React.RefObject<HTMLVideoElement | null>;
    const html = renderToStaticMarkup(
      React.createElement(IVPCameraPreview, {
        videoRef: mockVideoRef,
        visible: true,
      })
    );

    // Verify video has transform: scaleX(-1) or scaleX(-1)
    expect(html).toContain('scaleX(-1)');

    // Count occurrences of scaleX(-1) in rendered HTML: should be exactly 1 (for the video element only)
    const matches = html.match(/scaleX\(-1\)/g) || [];
    expect(matches.length).toBe(1);

    // Both canvases should be present without scaleX(-1)
    const canvasMatches = html.match(/<canvas[^>]*>/g) || [];
    expect(canvasMatches.length).toBe(2);
    canvasMatches.forEach((canvasTag) => {
      expect(canvasTag).not.toContain('scaleX(-1)');
    });
  });
});
