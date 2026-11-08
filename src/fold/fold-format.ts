import { OPS_VERSION, parseMarks, parseOp, type Op } from './ops';
import { CATEGORIES, DIFFICULTIES, STEP_KINDS, type About, type FoldFrame, type Mark, type OrigamiModel, type Step, type StepKind, type Tape } from './types';

/**
 * Reading and writing .fold files (https://github.com/edemaine/fold). The start of the model is the file's
 * top-level frame and each step is one of `file_frames`. Standard fields keep their FOLD names; Gami's own
 * fields are prefixed `gami:`, which other FOLD tools ignore.
 *
 * A step may also say how it was made (`gami:op`, see ops.ts), so it can be folded again after an earlier
 * step changes. Files with operations say which version of them they use in `gami:ops`.
 *
 * What a step draws on the paper is part of the step, like its frame (`gami:marks`: lines and fills as points
 * on the sheet, and the side they're on). It doesn't depend on the operations, so a file whose operations
 * can't be read still shows its drawings.
 *
 * How the gallery describes the model (`gami:about`: its blurb, difficulty, category, minutes and how its card
 * shows it) travels with it too. Anything there that isn't understood is left out.
 *
 * Bent paper (see docs/bending-plan.md) is written compactly, as it's most of a bent model's file: its points to
 * 1/`BENT`; the frames a bend passes through (`gami:via`), which share the step's triangles, points on the sheet
 * and seams, as just how far each point moves from one to the next (`gami:moves`); and the paths of the bend's
 * guides the same way (`gami:path`, in whole millionths, as recipes round them). Files written before still read.
 */

interface FoldFileFrame {
  frame_title?: string;
  vertices_coords: number[][];
  faces_vertices: number[][];
  'gami:vertices_paper': number[][];
  'gami:faces_parent'?: number[];
  'gami:faces_layer'?: number[];
  /** Scissor cuts made so far, as segments on the sheet (see FoldFrame.cuts). */
  'gami:cuts'?: number[][][];
  /** Tape laid so far, each strip as its pieces on the sheet (see FoldFrame.tapes). */
  'gami:tapes'?: { pieces: Mark[] }[];
  /** Seams between triangles of bent paper cut from one face (see FoldFrame.soft). */
  'gami:soft'?: number[][];
  'gami:text'?: string;
  'gami:kind'?: StepKind;
  'gami:section'?: string;
  /** Frames the step passes through on its way, as when unfolding several folds one after another. */
  'gami:via'?: (FoldFileFrame | MovedFrame)[];
  /** What the step draws on the paper. */
  'gami:marks'?: Mark[];
  /** How the step was made: an operation, a bend's guides' paths written as moves (see `writeOp`). */
  'gami:op'?: Op | Record<string, unknown>;
}

/**
 * A frame a bend passes through, which has the step's triangles, points on the sheet and seams: where its points
 * are, as whole steps of 1/`BENT` from where they were in the frame before (from 0 in the first), x, y, z for each.
 */
interface MovedFrame {
  'gami:moves': number[];
  'gami:faces_parent'?: number[];
}

export interface FoldFile extends FoldFileFrame {
  file_spec: number;
  file_creator: string;
  file_title: string;
  file_classes: string[];
  'gami:id': string;
  'gami:sheets': OrigamiModel['sheets'];
  /** Files from before multi-sheet models had a single sheet. */
  'gami:sheet'?: OrigamiModel['sheets'][number];
  'gami:about'?: About & { card?: OrigamiModel['card'] };
  /** The version of the operations in `gami:op`, when any step has one. */
  'gami:ops'?: number;
  file_frames: FoldFileFrame[];
}

export function toFoldFile(model: OrigamiModel): FoldFile {
  return {
    file_spec: 1.2,
    file_creator: 'Gami',
    file_title: model.title,
    file_classes: ['diagrams'],
    'gami:id': model.id,
    'gami:sheets': model.sheets,
    ...((model.about || model.card) && { 'gami:about': { ...model.about, ...(model.card && { card: model.card }) } }),
    ...(model.steps.some((s) => s.op) && { 'gami:ops': OPS_VERSION }),
    // The start is kept exactly, as everything replayed from the file starts from it: a sheet's corners can be
    // irrational (an A4 sheet's are at ±√2/2), and rounded they'd put every later step a hair out.
    ...writeFrame(model.start, true),
    file_frames: model.steps.map((s) => ({
      frame_title: s.title,
      ...(s.text && { 'gami:text': s.text }),
      ...(s.kind && { 'gami:kind': s.kind }),
      ...(s.section && { 'gami:section': s.section }),
      ...(s.via?.length && { 'gami:via': writeVia(s.via, s.frame) }),
      ...(s.marks?.length && { 'gami:marks': s.marks.map(writeMark) }),
      ...(s.op && { 'gami:op': writeOp(s.op) }),
      ...writeFrame(s.frame),
    })),
  };
}

/**
 * Reads a .fold file made by Gami. Operations that aren't well formed, or are from a newer version of Gami,
 * are left out, so those steps can only be played, not folded again; `warnings` collects why.
 */
export function fromFoldFile(file: FoldFile, warnings: string[] = []): OrigamiModel {
  const sheets = file['gami:sheets'] ?? (file['gami:sheet'] && [file['gami:sheet']]);
  if (!sheets || !Array.isArray(file.file_frames)) throw new Error('This .fold file wasn’t made by Gami.');
  const version = file['gami:ops'];
  const withOps = version === OPS_VERSION;
  if (version !== undefined && !withOps) warnings.push(`This file’s steps were saved by a newer Gami, so they can be played but not changed.`);
  const opOf = (f: FoldFileFrame, k: number): { op?: Op } => {
    if (!withOps || f['gami:op'] === undefined) return {};
    try {
      return { op: parseOp(readOp(f['gami:op']), `step ${k + 1}`) };
    } catch (e) {
      warnings.push((e as Error).message);
      return {};
    }
  };
  const marksOf = (f: FoldFileFrame, k: number): { marks?: Mark[] } => {
    if (f['gami:marks'] === undefined) return {};
    try {
      return { marks: parseMarks(f['gami:marks'], `step ${k + 1} marks`) };
    } catch (e) {
      warnings.push((e as Error).message);
      return {};
    }
  };
  return {
    id: file['gami:id'],
    title: file.file_title,
    ...aboutOf(file['gami:about']),
    sheets,
    start: readFrame(file),
    steps: file.file_frames.map((f, k): Step => {
      const frame = readFrame(f);
      const via = f['gami:via'] && viaOf(f['gami:via'], frame, k, warnings);
      return {
        title: f.frame_title ?? '',
        ...(f['gami:text'] && { text: f['gami:text'] }),
        ...(STEP_KINDS.includes(f['gami:kind']!) && { kind: f['gami:kind'] }),
        ...(f['gami:section'] && { section: f['gami:section'] }),
        ...(via && { via }),
        frame,
        ...marksOf(f, k),
        ...opOf(f, k),
      };
    }),
  };
}

/** The gallery details in a file, keeping only what's well formed. */
function aboutOf(x: unknown): Pick<OrigamiModel, 'about' | 'card'> {
  if (typeof x !== 'object' || x === null) return {};
  const o = x as Record<string, unknown>;
  const about: About = {
    ...(typeof o.blurb === 'string' && o.blurb.trim() && { blurb: o.blurb.slice(0, 500) }),
    ...(DIFFICULTIES.includes(o.difficulty as About['difficulty'] & number) && { difficulty: o.difficulty as About['difficulty'] }),
    ...(CATEGORIES.includes(o.category as About['category'] & string) && { category: o.category as About['category'] }),
    ...(typeof o.minutes === 'number' && o.minutes > 0 && o.minutes <= 600 && { minutes: Math.round(o.minutes) }),
  };
  return {
    ...(Object.keys(about).length && { about }),
    ...((o.card === 'flat' || o.card === 'finished') && { card: o.card }),
  };
}

/** Coordinates rounded to 1e-9: enough for any sheet, and keeps files small and diffs readable. */
export const roundCoord = (x: number) => Math.round(x * 1e9) / 1e9 || 0;

/**
 * Bent paper's points are kept to 1/BENT of the sheet, a seventieth of the gap between layers: finer than anything
 * shows, and nothing folds from them (nothing can be folded after a bend).
 */
export const BENT = 1e5;
const roundBent = (x: number) => Math.round(x * BENT) / BENT || 0;

/** Guides' paths as recipes round them: whole millionths of the sheet. */
const GUIDE = 1e6;

/** A frame as the file keeps it: `exact` for the start, which everything replayed is folded from. */
function writeFrame(f: FoldFrame, exact = false): FoldFileFrame {
  const round = exact ? (x: number) => x : roundCoord;
  const coord = exact ? round : f.soft?.length ? roundBent : roundCoord;
  return {
    vertices_coords: f.vertices_coords.map((p) => p.map(coord)),
    faces_vertices: f.faces_vertices,
    'gami:vertices_paper': f.vertices_paper.map((p) => p.map(round)),
    ...(f.faces_parent && { 'gami:faces_parent': f.faces_parent }),
    ...(f.faces_layer && { 'gami:faces_layer': f.faces_layer }),
    ...(f.cuts?.length && { 'gami:cuts': f.cuts.map((c) => c.map((p) => p.map(round))) }),
    ...(f.tapes?.length && { 'gami:tapes': f.tapes.map((t) => ({ pieces: t.pieces.map(writeMark) })) }),
    ...(f.soft?.length && { 'gami:soft': f.soft }),
  };
}

/**
 * A step's in-between frames: as moves (see MovedFrame) when they're a bend's, with the step's triangles, points on
 * the sheet and seams, else as frames of their own.
 */
function writeVia(via: FoldFrame[], frame: FoldFrame): FoldFileFrame[] | MovedFrame[] {
  const shared = (v: FoldFrame) =>
    v.vertices_coords.length === frame.vertices_coords.length && same(v.faces_vertices, frame.faces_vertices) && same(v.vertices_paper, frame.vertices_paper) && same(v.soft, frame.soft);
  if (!frame.soft?.length || !via.every(shared)) return via.map((v) => writeFrame(v));
  let before = frame.vertices_coords.flatMap(() => [0, 0, 0]);
  return via.map((v): MovedFrame => {
    const now = v.vertices_coords.flatMap((p) => p.map((x) => Math.round(x * BENT)));
    const moves = now.map((x, i) => x - before[i] || 0);
    before = now;
    return { 'gami:moves': moves, ...(v.faces_parent && { 'gami:faces_parent': v.faces_parent }) };
  });
}

/** In-between frames read from a file: written whole, or as moves, with the step's frame's triangles (see MovedFrame). */
function viaOf(entries: (FoldFileFrame | MovedFrame)[], frame: FoldFrame, k: number, warnings: string[]): FoldFrame[] | undefined {
  if (!Array.isArray(entries)) return undefined;
  if (!entries.some((e) => 'gami:moves' in e)) return entries.map((e) => readFrame(e as FoldFileFrame));
  const n = frame.vertices_coords.length * 3;
  const whole = (m: unknown): m is number[] => Array.isArray(m) && m.length === n && m.every((x) => Number.isSafeInteger(x));
  if (!entries.every((e) => 'gami:moves' in e && whole(e['gami:moves']))) {
    warnings.push(`Step ${k + 1}’s in-between frames aren’t well formed, so it plays straight to its end.`);
    return undefined;
  }
  let at = new Array<number>(n).fill(0);
  return (entries as MovedFrame[]).map((e): FoldFrame => {
    at = at.map((x, i) => x + e['gami:moves'][i]);
    const parent = e['gami:faces_parent'];
    const { faces_parent: _, ...shared } = frame;
    return {
      ...shared,
      vertices_coords: frame.vertices_coords.map((_q, v) => [at[3 * v] / BENT || 0, at[3 * v + 1] / BENT || 0, at[3 * v + 2] / BENT || 0]),
      ...(Array.isArray(parent) && parent.every((f) => Number.isInteger(f)) && { faces_parent: parent }),
    };
  });
}

/** A bend's guides' paths, when they're whole millionths, as moves from one entry to the next (see `readOp`). */
function writeOp(op: Op): Op | Record<string, unknown> {
  if (op.op !== 'bend') return op;
  const onGrid = (x: number) => Math.abs(x * GUIDE - Math.round(x * GUIDE)) < 1e-6;
  return {
    ...op,
    goals: op.goals.map((g) => {
      if (!('guide' in g) || !g.path.every((q) => q.every(onGrid))) return g;
      const whole = g.path.flatMap((q) => q.map((x) => Math.round(x * GUIDE)));
      return { guide: g.guide, 'gami:path': whole.map((x, i) => (i < 3 ? x : x - whole[i - 3]) || 0) };
    }),
  };
}

/** A bend's guides' paths back from moves (see `writeOp`), before the operation is checked like any other. */
function readOp(x: unknown): unknown {
  const o = x as { op?: unknown; goals?: unknown };
  if (typeof x !== 'object' || x === null || o.op !== 'bend' || !Array.isArray(o.goals)) return x;
  return {
    ...o,
    goals: o.goals.map((g) => {
      const moves = (g as Record<string, unknown> | null)?.['gami:path'];
      if (!Array.isArray(moves) || moves.length % 3 || !moves.every((m) => Number.isSafeInteger(m))) return g;
      const { 'gami:path': _, ...rest } = g as Record<string, unknown>;
      const at = [0, 0, 0];
      const path = Array.from({ length: moves.length / 3 }, (_q, i) => at.map((_x, c) => (at[c] += moves[3 * i + c]) / GUIDE || 0));
      return { ...rest, path };
    }),
  };
}

/** Whether two arrays read the same, entry by entry, nested or not. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((x, i) => same(x, b[i]));
}

function writeMark(m: Mark): Mark {
  return { side: m.side, points: m.points.map(([u, v]) => [roundCoord(u), roundCoord(v)]), ...(m.fill && { fill: true }) };
}

function readFrame(f: FoldFileFrame): FoldFrame {
  return {
    vertices_coords: f.vertices_coords as FoldFrame['vertices_coords'],
    vertices_paper: f['gami:vertices_paper'] as FoldFrame['vertices_paper'],
    faces_vertices: f.faces_vertices,
    ...(f['gami:faces_parent'] && { faces_parent: f['gami:faces_parent'] }),
    ...(f['gami:faces_layer'] && { faces_layer: f['gami:faces_layer'] }),
    ...(cutsOf(f['gami:cuts']) && { cuts: cutsOf(f['gami:cuts']) }),
    ...(tapesOf(f['gami:tapes']) && { tapes: tapesOf(f['gami:tapes']) }),
    ...(softOf(f['gami:soft'], f.vertices_coords.length) && { soft: softOf(f['gami:soft'], f.vertices_coords.length) }),
  };
}

/** Soft edges read from a file: pairs of the frame's vertices. Anything else is left out. */
function softOf(x: unknown, vertices: number): FoldFrame['soft'] | undefined {
  if (!Array.isArray(x)) return undefined;
  const vertex = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < vertices;
  const soft = x.filter((e): e is [number, number] => Array.isArray(e) && e.length === 2 && e.every(vertex));
  return soft.length ? soft : undefined;
}

/** Tape read from a file: strips of filled pieces on the sheet. Anything else is left out. */
function tapesOf(x: unknown): FoldFrame['tapes'] | undefined {
  if (!Array.isArray(x)) return undefined;
  const tapes = x.flatMap((t): Tape[] => {
    if (!t || typeof t !== 'object' || !Array.isArray((t as { pieces?: unknown }).pieces)) return [];
    try {
      const pieces = parseMarks((t as { pieces: unknown }).pieces).filter((p) => p.fill);
      return pieces.length ? [{ pieces }] : [];
    } catch {
      return [];
    }
  });
  return tapes.length ? tapes : undefined;
}

/** Cuts read from a file: segments of two points each. Anything else is left out. */
function cutsOf(x: unknown): FoldFrame['cuts'] | undefined {
  if (!Array.isArray(x)) return undefined;
  const point = (p: unknown): p is [number, number] => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number' && Number.isFinite(n));
  const cuts = x.filter((c): c is [[number, number], [number, number]] => Array.isArray(c) && c.length === 2 && c.every(point));
  return cuts.length ? cuts : undefined;
}
