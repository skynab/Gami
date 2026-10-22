import { OPS_VERSION, parseMarks, parseOp, type Op } from './ops';
import type { FoldFrame, Mark, OrigamiModel, Step, StepKind } from './types';

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
  'gami:text'?: string;
  'gami:kind'?: StepKind;
  'gami:section'?: string;
  /** Frames the step passes through on its way, as when unfolding several folds one after another. */
  'gami:via'?: FoldFileFrame[];
  /** What the step draws on the paper. */
  'gami:marks'?: Mark[];
  'gami:op'?: Op;
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
    ...(model.steps.some((s) => s.op) && { 'gami:ops': OPS_VERSION }),
    ...writeFrame(model.start),
    file_frames: model.steps.map((s) => ({
      frame_title: s.title,
      ...(s.text && { 'gami:text': s.text }),
      ...(s.kind && { 'gami:kind': s.kind }),
      ...(s.section && { 'gami:section': s.section }),
      ...(s.via?.length && { 'gami:via': s.via.map(writeFrame) }),
      ...(s.marks?.length && { 'gami:marks': s.marks.map(writeMark) }),
      ...(s.op && { 'gami:op': s.op }),
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
      return { op: parseOp(f['gami:op'], `step ${k + 1}`) };
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
    sheets,
    start: readFrame(file),
    steps: file.file_frames.map(
      (f, k): Step => ({
        title: f.frame_title ?? '',
        ...(f['gami:text'] && { text: f['gami:text'] }),
        ...(f['gami:kind'] && { kind: f['gami:kind'] }),
        ...(f['gami:section'] && { section: f['gami:section'] }),
        ...(f['gami:via'] && { via: f['gami:via'].map(readFrame) }),
        frame: readFrame(f),
        ...marksOf(f, k),
        ...opOf(f, k),
      }),
    ),
  };
}

/** Coordinates rounded to 1e-9: enough for any sheet, and keeps files small and diffs readable. */
const round = (x: number) => Math.round(x * 1e9) / 1e9 || 0;

function writeFrame(f: FoldFrame): FoldFileFrame {
  return {
    vertices_coords: f.vertices_coords.map((p) => p.map(round)),
    faces_vertices: f.faces_vertices,
    'gami:vertices_paper': f.vertices_paper.map((p) => p.map(round)),
    ...(f.faces_parent && { 'gami:faces_parent': f.faces_parent }),
    ...(f.faces_layer && { 'gami:faces_layer': f.faces_layer }),
    ...(f.cuts?.length && { 'gami:cuts': f.cuts.map((c) => c.map((p) => p.map(round))) }),
  };
}

function writeMark(m: Mark): Mark {
  return { side: m.side, points: m.points.map(([u, v]) => [round(u), round(v)]), ...(m.fill && { fill: true }) };
}

function readFrame(f: FoldFileFrame): FoldFrame {
  return {
    vertices_coords: f.vertices_coords as FoldFrame['vertices_coords'],
    vertices_paper: f['gami:vertices_paper'] as FoldFrame['vertices_paper'],
    faces_vertices: f.faces_vertices,
    ...(f['gami:faces_parent'] && { faces_parent: f['gami:faces_parent'] }),
    ...(f['gami:faces_layer'] && { faces_layer: f['gami:faces_layer'] }),
    ...(cutsOf(f['gami:cuts']) && { cuts: cutsOf(f['gami:cuts']) }),
  };
}

/** Cuts read from a file: segments of two points each. Anything else is left out. */
function cutsOf(x: unknown): FoldFrame['cuts'] | undefined {
  if (!Array.isArray(x)) return undefined;
  const point = (p: unknown): p is [number, number] => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number' && Number.isFinite(n));
  const cuts = x.filter((c): c is [[number, number], [number, number]] => Array.isArray(c) && c.length === 2 && c.every(point));
  return cuts.length ? cuts : undefined;
}
