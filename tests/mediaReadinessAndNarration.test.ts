import { getMediaReadiness, describeMediaError } from '../src/lib/media/mediaReadiness';
import { splitIntoSentences, estimateNarrationMs, pickEnglishVoice } from '../src/lib/media/narration';
import { IVPCameraManager } from '../src/lib/services/ivpCameraManager';

const live = (kind: 'video' | 'audio') => ({ kind, readyState: 'live', enabled: true, muted: false, stop: jest.fn() });
const streamOf = (...tracks: any[]) => ({
  active: true,
  getTracks: () => tracks,
  getVideoTracks: () => tracks.filter((t) => t.kind === 'video'),
  getAudioTracks: () => tracks.filter((t) => t.kind === 'audio'),
});

describe('getMediaReadiness', () => {
  it('needs both a live camera and a live microphone', () => {
    expect(getMediaReadiness(null)).toMatchObject({ ready: false, missing: ['camera', 'microphone'] });
    expect(getMediaReadiness(streamOf(live('video')))).toMatchObject({ ready: false, missing: ['microphone'] });
    expect(getMediaReadiness(streamOf(live('audio')))).toMatchObject({ ready: false, missing: ['camera'] });
    expect(getMediaReadiness(streamOf(live('video'), live('audio')))).toMatchObject({ ready: true, missing: [] });
  });

  it('treats ended, disabled and muted tracks as off', () => {
    const ended = { ...live('audio'), readyState: 'ended' };
    const disabled = { ...live('audio'), enabled: false };
    const muted = { ...live('audio'), muted: true };
    for (const mic of [ended, disabled, muted]) {
      expect(getMediaReadiness(streamOf(live('video'), mic)).microphoneLive).toBe(false);
    }
  });
});

describe('describeMediaError', () => {
  it('maps browser errors to actionable guidance', () => {
    expect(describeMediaError(null)).toBeNull();
    expect(describeMediaError('NotAllowedError')?.title).toMatch(/blocked/i);
    expect(describeMediaError('NotFoundError')?.title).toMatch(/no camera or microphone/i);
    expect(describeMediaError('NotReadableError')?.title).toMatch(/another app/i);
    expect(describeMediaError('SomethingElse')?.title).toMatch(/couldn't start/i);
  });
});

describe('narration helpers', () => {
  it('splits a question into sentences', () => {
    expect(splitIntoSentences('Explain CAP. Why does it matter? Give an example!')).toEqual([
      'Explain CAP.',
      'Why does it matter?',
      'Give an example!',
    ]);
    expect(splitIntoSentences('No punctuation here')).toEqual(['No punctuation here']);
    expect(splitIntoSentences('   ')).toEqual(['']);
  });

  it('estimates a bounded read time that scales with rate', () => {
    const text = Array.from({ length: 150 }, () => 'word').join(' ');
    expect(estimateNarrationMs(text, 1)).toBeCloseTo(60_000, -3);
    expect(estimateNarrationMs(text, 2)).toBeCloseTo(30_000, -3);
    expect(estimateNarrationMs('', 1)).toBe(1500);
    expect(estimateNarrationMs('hi', 0)).toBeGreaterThanOrEqual(1500);
  });

  it('prefers a local en-US voice, then any English voice', () => {
    const voices = [
      { name: 'de', lang: 'de-DE', localService: true },
      { name: 'en-gb-remote', lang: 'en-GB', localService: false },
      { name: 'en-us-local', lang: 'en-US', localService: true },
    ];
    expect(pickEnglishVoice(voices)?.name).toBe('en-us-local');
    expect(pickEnglishVoice(voices.slice(0, 2))?.name).toBe('en-gb-remote');
    expect(pickEnglishVoice([])).toBeUndefined();
  });
});

describe('IVPCameraManager requireAudio', () => {
  const originalNavigator = (global as any).navigator;
  afterEach(() => {
    Object.defineProperty(global, 'navigator', { value: originalNavigator, configurable: true });
  });

  function mockMedia(impl: jest.Mock) {
    Object.defineProperty(global, 'navigator', {
      value: { mediaDevices: { getUserMedia: impl } },
      configurable: true,
    });
  }

  it('does not fall back to video-only when the microphone is required', async () => {
    const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    const getUserMedia = jest.fn().mockRejectedValue(denied);
    mockMedia(getUserMedia);

    await expect(new IVPCameraManager().acquireCamera({ enableAudio: true, requireAudio: true })).rejects.toBe(denied);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('still falls back to video-only when audio is optional (existing behaviour)', async () => {
    const videoOnly = streamOf(live('video'));
    const getUserMedia = jest.fn().mockRejectedValueOnce(new Error('no mic')).mockResolvedValueOnce(videoOnly);
    mockMedia(getUserMedia);

    const result = await new IVPCameraManager().acquireCamera({ enableAudio: true });
    expect(result).toBe(videoOnly);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('replaces an existing video-only stream when the microphone becomes required', async () => {
    const videoOnly = streamOf(live('video'));
    const full = streamOf(live('video'), live('audio'));
    const getUserMedia = jest.fn().mockResolvedValueOnce(videoOnly).mockResolvedValueOnce(full);
    mockMedia(getUserMedia);

    const manager = new IVPCameraManager();
    await manager.acquireCamera({ enableAudio: false });
    const upgraded = await manager.acquireCamera({ enableAudio: true, requireAudio: true });

    expect(upgraded).toBe(full);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect((videoOnly.getTracks()[0] as any).stop).toHaveBeenCalled();
  });
});
