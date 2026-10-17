import { create } from 'zustand';
import { fromFoldFile, toFoldFile } from '../fold/fold-format';
import type { FoldFrame, OrigamiModel, Step } from '../fold/types';
import { BLANK_SHEET } from '../models';

/** The model being made in the Studio. Kept in this browser's storage so a refresh doesn't lose it. */

const STORAGE_KEY = 'gami.studio.draft';

interface DraftState {
  model: OrigamiModel;
  /** The paper after the last step: what the next fold starts from. */
  current(): FoldFrame;
  addStep(step: Step): void;
  /** Removes the last step. Earlier steps can't be removed, since every later step builds on them. */
  undo(): void;
  editStep(index: number, patch: Partial<Pick<Step, 'title' | 'text'>>): void;
  setInfo(patch: Partial<Pick<OrigamiModel, 'id' | 'title'>>): void;
  replace(model: OrigamiModel): void;
  clear(): void;
}

function emptyModel(): OrigamiModel {
  return { ...BLANK_SHEET, id: 'untitled', title: 'Untitled model' };
}

function restore(): OrigamiModel {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return fromFoldFile(JSON.parse(saved));
  } catch {
    // Storage blocked or the saved draft is unreadable: start fresh.
  }
  return emptyModel();
}

export const useDraft = create<DraftState>()((set, get) => ({
  model: restore(),
  current() {
    const { model } = get();
    return model.steps.at(-1)?.frame ?? model.start;
  },
  addStep(step) {
    set(({ model }) => ({ model: { ...model, steps: [...model.steps, step] } }));
  },
  undo() {
    set(({ model }) => ({ model: { ...model, steps: model.steps.slice(0, -1) } }));
  },
  editStep(index, patch) {
    set(({ model }) => ({ model: { ...model, steps: model.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)) } }));
  },
  setInfo(patch) {
    set(({ model }) => ({ model: { ...model, ...patch } }));
  },
  replace(model) {
    set({ model });
  },
  clear() {
    set({ model: emptyModel() });
  },
}));

useDraft.subscribe(({ model }, prev) => {
  if (model === prev.model) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toFoldFile(model)));
  } catch {
    // Storage full or blocked: the draft still works for this visit, and Export saves it for good.
  }
});
