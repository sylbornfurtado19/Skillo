import { downsampleEvenly, downsampleByGroup } from '../src/lib/utils/downsample';

describe('downsampleEvenly', () => {
  it('returns a copy when the input already fits', () => {
    const input = [1, 2, 3];
    const out = downsampleEvenly(input, 5);
    expect(out).toEqual([1, 2, 3]);
    expect(out).not.toBe(input);
  });

  it('keeps first and last and spreads picks evenly', () => {
    const input = Array.from({ length: 1001 }, (_, i) => i);
    const out = downsampleEvenly(input, 11);
    expect(out).toHaveLength(11);
    expect(out[0]).toBe(0);
    expect(out[10]).toBe(1000);
    expect(out).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
  });

  it('handles degenerate limits', () => {
    expect(downsampleEvenly([1, 2, 3], 0)).toEqual([]);
    expect(downsampleEvenly([1, 2, 3], 1)).toEqual([1]);
    expect(downsampleEvenly([], 10)).toEqual([]);
  });
});

describe('downsampleByGroup', () => {
  const frame = (q: string, t: number) => ({ questionId: q, t });

  it('never exceeds the cap and keeps every question represented', () => {
    const frames = [
      ...Array.from({ length: 4000 }, (_, i) => frame('q_1', i)),
      ...Array.from({ length: 1500 }, (_, i) => frame('q_2', 4000 + i)),
      ...Array.from({ length: 500 }, (_, i) => frame('q_3', 5500 + i)),
    ];
    const out = downsampleByGroup(frames, 1000, (f) => f.questionId);
    expect(out.length).toBeLessThanOrEqual(1000);
    expect(new Set(out.map((f) => f.questionId))).toEqual(new Set(['q_1', 'q_2', 'q_3']));
  });

  it('preserves original ordering', () => {
    const frames = Array.from({ length: 3000 }, (_, i) => frame(i % 2 ? 'a' : 'b', i));
    const out = downsampleByGroup(frames, 100, (f) => f.questionId);
    const times = out.map((f) => f.t);
    expect([...times].sort((x, y) => x - y)).toEqual(times);
  });

  it('keeps small inputs untouched', () => {
    const frames = [frame('q_1', 1), frame('q_2', 2)];
    expect(downsampleByGroup(frames, 1000, (f) => f.questionId)).toEqual(frames);
  });

  it('handles more groups than budget', () => {
    const frames = Array.from({ length: 300 }, (_, i) => frame(`q_${i}`, i));
    const out = downsampleByGroup(frames, 50, (f) => f.questionId);
    expect(out.length).toBeLessThanOrEqual(50);
  });
});
