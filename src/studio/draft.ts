import { create } from 'zustand';
import type { SavedModel, Status } from '../cloud/models';
import { fromFoldFile, toFoldFile, type FoldFile } from '../fold/fold-format';
import { layOut } from '../fold/sheets';
import type { FoldFrame, OrigamiModel, Sheet, Step } from '../fold/types';
import { BLANK_SHEET } from '../models';

/**
 * The model being made in the Studio. Kept in this browser's storage so a refresh doesn't lose it, along with
 * which cloud model it is (if it's been saved) and whether it has changes since.
 */

const STORAGE_KEY = 'gami.studio.draft';

/** The saved copy in the cloud this draft belongs to. */
export interface CloudInfo {
  id: string;
  status: Status;
  reviewNote: string | null;
  shareToken: string | null;
}

interface DraftState {
  model: OrigamiModel;
  cloud: CloudInfo | null;
  /** Changed since it was last saved to (or opened from) the cloud. */
  dirty: boolean;
  /** The paper after the last step: what the next fold starts from. */
  current(): FoldFrame;
  addStep(step: Step): void;
  /** Removes the last step. Earlier steps can't be removed, since every later step builds on them. */
  undo(): void;
  editStep(index: number, patch: Partial<Pick<Step, 'title' | 'text'>>): void;
  setInfo(patch: Partial<Pick<OrigamiModel, 'id' | 'title'>>): void;
  /** Changes the sheets (their colours, sizes, how many), laid out in a row. Only before the first step. */
  setSheets(sheets: Sheet[]): void;
  /** Opens a model from a file: it's new to the cloud. */
  replace(model: OrigamiModel): void;
  /** Opens or has just saved a cloud model. `withModel` also replaces the model (when opening). */
  fromCloud(saved: SavedModel, withModel: boolean): void;
  /** Catches up with the cloud copy's status (after a review), keeping any local changes. */
  updateStatus(saved: SavedModel): void;
  /** Keeps working on this model as a new, unsaved one (after its cloud copy was submitted or deleted). */
  detach(): void;
  clear(): void;
}

function emptyModel(): OrigamiModel {
  return { ...BLANK_SHEET, id: 'untitled', title: 'Untitled model' };
}

interface Stored {
  fold: FoldFile;
  cloud: CloudInfo | null;
  dirty: boolean;
}

function restore(): Pick<DraftState, 'model' | 'cloud' | 'dirty'> {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Stored | FoldFile | null;
    // Drafts saved before cloud saving were just the .fold file.
    if (saved && 'fold' in saved) return { model: fromFoldFile(saved.fold), cloud: saved.cloud, dirty: saved.dirty };
    if (saved) return { model: fromFoldFile(saved), cloud: null, dirty: true };
  } catch {
    // Storage blocked or the saved draft is unreadable: start fresh.
  }
  return { model: emptyModel(), cloud: null, dirty: false };
}

const cloudInfo = (s: SavedModel): CloudInfo => ({ id: s.id, status: s.status, reviewNote: s.reviewNote, shareToken: s.shareToken });

export const useDraft = create<DraftState>()((set, get) => ({
  ...restore(),
  current() {
    const { model } = get();
    return model.steps.at(-1)?.frame ?? model.start;
  },
  addStep(step) {
    set(({ model }) => ({ model: { ...model, steps: [...model.steps, step] }, dirty: true }));
  },
  undo() {
    set(({ model }) => ({ model: { ...model, steps: model.steps.slice(0, -1) }, dirty: true }));
  },
  editStep(index, patch) {
    set(({ model }) => ({ model: { ...model, steps: model.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)) }, dirty: true }));
  },
  setInfo(patch) {
    set(({ model }) => ({ model: { ...model, ...patch }, dirty: true }));
  },
  setSheets(sheets) {
    set(({ model }) => (model.steps.length ? {} : { model: { ...model, ...layOut(sheets) }, dirty: true }));
  },
  replace(model) {
    set({ model, cloud: null, dirty: true });
  },
  fromCloud(saved, withModel) {
    set({ ...(withModel && { model: saved.model }), cloud: cloudInfo(saved), dirty: false });
  },
  updateStatus(saved) {
    set({ cloud: cloudInfo(saved) });
  },
  detach() {
    set({ cloud: null, dirty: true });
  },
  clear() {
    set({ model: emptyModel(), cloud: null, dirty: false });
  },
}));

useDraft.subscribe(({ model, cloud, dirty }, prev) => {
  if (model === prev.model && cloud === prev.cloud && dirty === prev.dirty) return;
  try {
    const stored: Stored = { fold: toFoldFile(model), cloud, dirty };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage full or blocked: the draft still works for this visit, and Export saves it for good.
  }
});
