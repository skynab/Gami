import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayback } from './playback';

/** Animation frames run by hand: `advance(ms)` moves the clock on and runs the frame waiting. */
let now = 0;
let waiting: FrameRequestCallback | null = null;
const advance = (ms: number) => {
  now += ms;
  const run = waiting;
  waiting = null;
  run?.(now);
};

beforeEach(() => {
  now = 0;
  waiting = null;
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => ((waiting = f), 1));
  vi.stubGlobal('cancelAnimationFrame', () => (waiting = null));
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  usePlayback.getState().load(5, 1);
  advance(5000);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('pausing', () => {
  it('stops one step’s fold part way, where the paper is', () => {
    usePlayback.getState().goTo(2);
    advance(800);
    const { pos } = usePlayback.getState();
    expect(pos).toBeGreaterThan(1);
    expect(pos).toBeLessThan(2);
    usePlayback.getState().pause();
    advance(5000);
    expect(usePlayback.getState().pos).toBe(pos);
    expect(usePlayback.getState().step).toBe(2);
  });

  it('stops playing on through the steps', () => {
    usePlayback.getState().togglePlay();
    advance(400);
    usePlayback.getState().pause();
    const { pos } = usePlayback.getState();
    advance(5000);
    expect(usePlayback.getState()).toMatchObject({ playing: false, pos });
  });

  it('leaves a finished fold as it is', () => {
    expect(usePlayback.getState().pos).toBe(1);
    usePlayback.getState().pause();
    expect(usePlayback.getState()).toMatchObject({ playing: false, pos: 1, step: 1 });
  });
});
