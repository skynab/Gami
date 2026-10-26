import { create } from 'zustand';

/** How long one step's fold takes at 1× speed, and the pause between steps while playing. */
const STEP_MS = 1600;
const HOLD_MS = 700;

interface PlaybackState {
  /** Number of steps in the open model (0 when it has no step data). */
  total: number;
  /** The step being shown, 1…total, or 0 for the paper before any step. */
  step: number;
  /**
   * Where the paper is, 0…total. Step k animates pos from k − 1 to k, so 2.5 is halfway through step 3.
   * Changes every animation frame: the 3D view reads it with `subscribe`, not as React state.
   */
  pos: number;
  /** Playing on through the steps by itself. */
  playing: boolean;
  speed: number;

  /** Opens a model at a step. */
  load(total: number, step: number): void;
  /** Shows a step, playing its fold from the start. */
  goTo(step: number): void;
  replay(): void;
  /** Plays on to the next half step: halfway through the fold being shown, or to its end. Stops playback. */
  half(): void;
  /** Moves the paper to any point, as when dragging the scrubber. Stops playback. */
  scrub(pos: number): void;
  togglePlay(): void;
  setSpeed(speed: number): void;
}

let frame = 0;
let hold = 0;

function stop() {
  cancelAnimationFrame(frame);
  clearTimeout(hold);
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export const usePlayback = create<PlaybackState>()((set, get) => {
  /**
   * Plays step k's fold, or the part of it from `from` to `to`. While playing, carries on to the next step after
   * a short pause.
   */
  function animate(k: number, from = k - 1, to = k) {
    stop();
    // Step 0 is the paper before any step: nothing to play.
    if (k === 0) {
      set({ step: 0, pos: 0 });
      return;
    }
    // With reduced motion, a step appears already folded, unless the user asked to watch by pressing play.
    if (reducedMotion() && !get().playing) {
      set({ step: k, pos: to });
      return;
    }
    set({ step: k, pos: from });
    const start = performance.now();
    const length = STEP_MS * (to - from);
    const tick = (now: number) => {
      const t = Math.min(1, ((now - start) * get().speed) / length);
      set({ pos: from + (to - from) * ease(t) });
      if (t < 1) frame = requestAnimationFrame(tick);
      else if (get().playing && to === k) {
        if (k < get().total) hold = window.setTimeout(() => animate(k + 1), HOLD_MS / get().speed);
        else set({ playing: false });
      }
    };
    frame = requestAnimationFrame(tick);
  }

  const clampStep = (k: number) => Math.min(get().total, Math.max(0, Math.round(k)));

  return {
    total: 0,
    step: 1,
    pos: 0,
    playing: false,
    speed: 1,

    load(total, step) {
      stop();
      set({ total, playing: false });
      if (total) animate(clampStep(step));
      else set({ step: 1, pos: 0 });
    },
    goTo(step) {
      if (!get().total) return;
      set({ playing: false });
      animate(clampStep(step));
    },
    replay() {
      get().goTo(get().step);
    },
    half() {
      const { total, pos } = get();
      if (!total || pos >= total) return;
      set({ playing: false });
      // The next half-step mark past where the paper is now (not one it's only a hair short of).
      const to = Math.min(total, Math.floor(pos * 2 + 1 + 1e-6) / 2);
      const k = Math.ceil(to);
      // Into a new step: start from its beginning.
      animate(k, Math.max(pos, k - 1), to);
    },
    scrub(pos) {
      stop();
      const p = Math.min(get().total, Math.max(0, pos));
      set({ playing: false, pos: p, step: clampStep(Math.ceil(p)) });
    },
    togglePlay() {
      const { playing, total, step, pos } = get();
      if (!total) return;
      if (playing) {
        stop();
        set({ playing: false });
        return;
      }
      set({ playing: true });
      // From the end, start over. Otherwise carry on: replay this step if it's part way, else play the next.
      if (pos >= total) animate(1);
      else if (pos < step) animate(step);
      else animate(step + 1);
    },
    setSpeed(speed) {
      set({ speed });
    },
  };
});
