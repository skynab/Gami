import { create } from 'zustand';
import type { SavedModel, Status } from '../cloud/models';
import { fromFoldFile, toFoldFile } from '../fold/fold-format';
import type { Replay } from '../fold/ops';
import { layOut } from '../fold/sheets';
import { thumbnailSvg } from '../fold/thumbnail';
import type { FoldFrame, OrigamiModel, Sheet, Step } from '../fold/types';
import { BLANK_SHEET } from '../models';
import { putDesign, type LocalDesign } from './library';

/**
 * The design being made in the Studio, saved to this browser's library (studio/library.ts) as it changes so a
 * refresh doesn't lose it, along with which cloud model it is (if it's been saved) and whether it has changes since.
 */

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
  /** The library design being edited, or null before one is opened. */
  designId: string | null;
  created: number;
  model: OrigamiModel;
  problem: Problem | null;
  /** The model before each change this visit, latest last, for undo. */
  history: { model: OrigamiModel; problem: Problem | null }[];
  cloud: CloudInfo | null;
  /** Changed since it was last saved to (or opened from) the cloud. */
  dirty: boolean;
  /** The last change couldn't be written to the library: Export is the way to keep it. */
  unsaved: boolean;
  /** The paper after the last step: what the next fold starts from. */
  current(): FoldFrame;
  /** Starts editing a design from the library. */
  open(design: LocalDesign): void;
  addStep(step: Step): void;
  /** Takes back the last change this visit, or with none, removes the last step. */
  undo(): void;
  /** Takes a change to the steps in the middle (from studio/steps.ts), folded again from there. */
  change(result: Replay): void;
  /** Drops every step from step `index` (0-based) on. */
  removeFrom(index: number): void;
  editStep(index: number, patch: Partial<Pick<Step, 'title' | 'text'>>): void;
  setInfo(patch: Partial<Pick<OrigamiModel, 'id' | 'title' | 'about' | 'card'>>): void;
  /** Changes the sheets (their colours, sizes, how many), laid out in a row. Only before the first step. */
  setSheets(sheets: Sheet[]): void;
  /** Has just saved to the cloud. */
  fromCloud(saved: SavedModel): void;
  /** Catches up with the cloud copy's status (after a review), keeping any local changes. */
  updateStatus(saved: SavedModel): void;
  /** Keeps working on this model as a new, unsaved one (after its cloud copy was submitted or deleted). */
  detach(): void;
}

export function emptyModel(): OrigamiModel {
  return { ...BLANK_SHEET, id: 'untitled', title: 'Untitled model' };
}

/** Undo keeps this many changes. */
const HISTORY = 50;

export const cloudInfo = (s: SavedModel): CloudInfo => ({ id: s.id, status: s.status, reviewNote: s.reviewNote, shareToken: s.shareToken });

export const useDraft = create<DraftState>()((set, get) => ({
  designId: null,
  created: 0,
  model: emptyModel(),
  problem: null,
  history: [],
  cloud: null,
  dirty: false,
  unsaved: false,
  current() {
    const { model } = get();
    return model.steps.at(-1)?.frame ?? model.start;
  },
  open(design) {
    clearTimeout(timer);
    set({
      designId: design.id,
      created: design.created,
      model: fromFoldFile(design.file),
      problem: design.problem ?? null,
      history: [],
      cloud: design.cloud ?? null,
      dirty: design.dirty ?? false,
      unsaved: false,
    });
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
  fromCloud(saved) {
    set({ cloud: cloudInfo(saved), dirty: false });
  },
  updateStatus(saved) {
    set({ cloud: cloudInfo(saved) });
  },
  detach() {
    set({ cloud: null, dirty: true });
  },
}));

const remember = ({ model, problem, history }: DraftState) => [...history.slice(1 - HISTORY), { model, problem }];

/** Changes are written this long after the last one, so typing a title doesn't write the model each key. */
const WAIT = 400;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Writes the open design to the library now, rather than after the wait. */
export async function saveDraft() {
  clearTimeout(timer);
  const { designId, created, model, cloud, dirty, problem } = useDraft.getState();
  if (!designId) return;
  let thumbnail: string | undefined;
  try {
    thumbnail = thumbnailSvg(model, 160);
  } catch {
    // A picture is a convenience: the list shows a plain sheet instead.
  }
  const file = toFoldFile(model);
  const ok = await putDesign({ id: designId, file, title: model.title, steps: model.steps.length, created, updated: Date.now(), thumbnail, cloud, dirty, problem });
  // Unless another design was opened meanwhile.
  if (useDraft.getState().designId === designId) useDraft.setState({ unsaved: !ok });
}

useDraft.subscribe(({ designId, model, cloud, dirty, problem }, prev) => {
  // Opening a design isn't a change to it.
  if (!designId || designId !== prev.designId) return;
  if (model === prev.model && cloud === prev.cloud && dirty === prev.dirty && problem === prev.problem) return;
  clearTimeout(timer);
  timer = setTimeout(() => void saveDraft(), WAIT);
});
