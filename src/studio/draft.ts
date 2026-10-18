import { create } from 'zustand';
import type { SavedModel, Status } from '../cloud/models';
import { fromFoldFile, toFoldFile, type FoldFile } from '../fold/fold-format';
import type { Replay } from '../fold/ops';
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

/** A step that couldn't be folded again after an earlier one changed. It and the steps after it are as they were. */
export interface Problem {
  /** Numbered from 1, as the Studio shows steps. */
  step: number;
  message: string;
}

interface DraftState {
  model: OrigamiModel;
  problem: Problem | null;
  /** The model before each change this visit, latest last, for undo. */
  history: { model: OrigamiModel; problem: Problem | null }[];
  cloud: CloudInfo | null;
  /** Changed since it was last saved to (or opened from) the cloud. */
  dirty: boolean;
  /** The paper after the last step: what the next fold starts from. */
  current(): FoldFrame;
  addStep(step: Step): void;
  /** Takes back the last change this visit, or with none, removes the last step. */
  undo(): void;
  /** Takes a change to the steps in the middle (from studio/steps.ts), folded again from there. */
  change(result: Replay): void;
  /** Drops every step from step `index` (0-based) on. */
  removeFrom(index: number): void;
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
  problem?: Problem | null;
}

function restore(): Pick<DraftState, 'model' | 'cloud' | 'dirty' | 'problem' | 'history'> {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Stored | FoldFile | null;
    // Drafts saved before cloud saving were just the .fold file.
    if (saved && 'fold' in saved) return { model: fromFoldFile(saved.fold), cloud: saved.cloud, dirty: saved.dirty, problem: saved.problem ?? null, history: [] };
    if (saved) return { model: fromFoldFile(saved), cloud: null, dirty: true, problem: null, history: [] };
  } catch {
    // Storage blocked or the saved draft is unreadable: start fresh.
  }
  return { model: emptyModel(), cloud: null, dirty: false, problem: null, history: [] };
}

/** Undo keeps this many changes. */
const HISTORY = 50;

const cloudInfo = (s: SavedModel): CloudInfo => ({ id: s.id, status: s.status, reviewNote: s.reviewNote, shareToken: s.shareToken });

export const useDraft = create<DraftState>()((set, get) => ({
  ...restore(),
  current() {
    const { model } = get();
    return model.steps.at(-1)?.frame ?? model.start;
  },
  addStep(step) {
    set((s) => ({ model: { ...s.model, steps: [...s.model.steps, step] }, dirty: true, history: remember(s) }));
  },
  undo() {
    set(({ model, history }) => {
      const last = history.at(-1);
      if (last) return { ...last, history: history.slice(0, -1), dirty: true };
      return { model: { ...model, steps: model.steps.slice(0, -1) }, problem: null, dirty: true };
    });
  },
  change(result) {
    set((s) => ({ model: result.model, problem: result.error ?? null, dirty: true, history: remember(s) }));
  },
  removeFrom(index) {
    set((s) => ({ model: { ...s.model, steps: s.model.steps.slice(0, index) }, problem: null, dirty: true, history: remember(s) }));
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
    set({ model, cloud: null, dirty: true, problem: null, history: [] });
  },
  fromCloud(saved, withModel) {
    set({ ...(withModel && { model: saved.model, problem: null, history: [] }), cloud: cloudInfo(saved), dirty: false });
  },
  updateStatus(saved) {
    set({ cloud: cloudInfo(saved) });
  },
  detach() {
    set({ cloud: null, dirty: true });
  },
  clear() {
    set({ model: emptyModel(), cloud: null, dirty: false, problem: null, history: [] });
  },
}));

const remember = ({ model, problem, history }: DraftState) => [...history.slice(1 - HISTORY), { model, problem }];

useDraft.subscribe(({ model, cloud, dirty, problem }, prev) => {
  if (model === prev.model && cloud === prev.cloud && dirty === prev.dirty && problem === prev.problem) return;
  try {
    const stored: Stored = { fold: toFoldFile(model), cloud, dirty, problem };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage full or blocked: the draft still works for this visit, and Export saves it for good.
  }
});
