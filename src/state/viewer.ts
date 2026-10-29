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
  /** Show each step's crease and arrow. */
  guides: boolean;
  /** Show the step card. Kept from model to model, so hiding it once is enough. */
  instructions: boolean;
  /** The view cube held until it grew, so a face, edge or corner is easier to pick. */
  cubeZoomed: boolean;
  /**
   * The camera frames each new step as it comes (keeping the angle). Off, it stays where it is from step to step
   * until reset. Kept from model to model, and in this browser.
   */
  follow: boolean;
  command: CameraCommand;

  setView(view: View): void;
  lookFrom(dir: [number, number, number]): void;
  resetCamera(): void;
  toggleLock(): void;
  toggleGuides(): void;
  toggleInstructions(): void;
  setCubeZoomed(zoomed: boolean): void;
  toggleFollow(): void;
  /** The user rotated the camera by hand, so it's no longer at a preset. */
  leftPreset(): void;
  /** Back to the starting view, for a newly opened model. */
  init(): void;
}

let nextId = 1;

const FOLLOW_KEY = 'gami.followSteps';

function readFollow(): boolean {
  try {
    return localStorage.getItem(FOLLOW_KEY) === '1';
  } catch {
    return false;
  }
}

function saveFollow(follow: boolean) {
  try {
    localStorage.setItem(FOLLOW_KEY, follow ? '1' : '0');
  } catch {
    // Nothing to do: it still applies for this visit.
  }
}

export const useViewer = create<ViewerState>()((set) => ({
  view: 'free',
  locked: false,
  guides: true,
  instructions: true,
  cubeZoomed: false,
  follow: readFollow(),
  command: { kind: 'reset', id: 0 },

  setView: (view) => set({ view, command: { kind: 'view', view, id: nextId++ } }),
  lookFrom: (dir) => set({ view: viewFor(dir), command: { kind: 'dir', dir, id: nextId++ } }),
  resetCamera: () => set({ view: 'free', command: { kind: 'reset', id: nextId++ } }),
  toggleLock: () => set((s) => ({ locked: !s.locked })),
  toggleGuides: () => set((s) => ({ guides: !s.guides })),
  toggleInstructions: () => set((s) => ({ instructions: !s.instructions })),
  setCubeZoomed: (cubeZoomed) => set({ cubeZoomed }),
  toggleFollow: () =>
    set((s) => {
      saveFollow(!s.follow);
      return { follow: !s.follow };
    }),
  leftPreset: () => set((s) => (s.view === 'free' ? s : { view: 'free' })),
  init: () => set({ view: 'free', locked: false, cubeZoomed: false, command: { kind: 'reset', id: nextId++ } }),
}));
