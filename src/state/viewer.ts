import { create } from 'zustand';
import { viewFor, type View } from '../viewer/views';

/** Something the camera should do once. `id` changes every time, so repeating a request still runs. */
export type CameraCommand =
  | { kind: 'view'; view: View; id: number }
  | { kind: 'dir'; dir: [number, number, number]; id: number }
  | { kind: 'reset'; id: number };

interface ViewerState {
  /** The preset the camera is at, or "free" once the user orbits away from it. */
  view: View;
  /** Locked: dragging pans instead of rotating, so the chosen view stays put. */
  locked: boolean;
  command: CameraCommand;

  setView(view: View): void;
  lookFrom(dir: [number, number, number]): void;
  resetCamera(): void;
  toggleLock(): void;
  /** The user rotated the camera by hand, so it's no longer at a preset. */
  leftPreset(): void;
  /** Back to the starting view, for a newly opened model. */
  init(): void;
}

let nextId = 1;

export const useViewer = create<ViewerState>()((set) => ({
  view: 'free',
  locked: false,
  command: { kind: 'reset', id: 0 },

  setView: (view) => set({ view, command: { kind: 'view', view, id: nextId++ } }),
  lookFrom: (dir) => set({ view: viewFor(dir), command: { kind: 'dir', dir, id: nextId++ } }),
  resetCamera: () => set({ view: 'free', command: { kind: 'reset', id: nextId++ } }),
  toggleLock: () => set((s) => ({ locked: !s.locked })),
  leftPreset: () => set((s) => (s.view === 'free' ? s : { view: 'free' })),
  init: () => set({ view: 'free', locked: false, command: { kind: 'reset', id: nextId++ } }),
}));
