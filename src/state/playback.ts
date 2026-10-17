import { create } from 'zustand';

/** How long one step's fold takes at 1× speed, and the pause between steps while playing. */
const STEP_MS = 1600;
const HOLD_MS = 700;

interface PlaybackState {
  /** Number of steps in the open model (0 when it has no step data). */
  total: number;
  /** The step being shown, 1…total. */
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
  /** Plays step k's fold. While playing, carries on to the next step after a short pause. */
  function animate(k: number) {
    stop();
    // With reduced motion, a step appears already folded, unless the user asked to watch by pressing play.
    if (reducedMotion() && !get().playing) {
      set({ step: k, pos: k });
      return;
    }
    set({ step: k, pos: k - 1 });
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, ((now - start) * get().speed) / STEP_MS);
      set({ pos: k - 1 + ease(t) });
      if (t < 1) frame = requestAnimationFrame(tick);
      else if (get().playing) {
        if (k < get().total) hold = window.setTimeout(() => animate(k + 1), HOLD_MS / get().speed);
        else set({ playing: false });
      }
    };
    frame = requestAnimationFrame(tick);
  }

  const clampStep = (k: number) => Math.min(get().total, Math.max(1, Math.round(k)));

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
