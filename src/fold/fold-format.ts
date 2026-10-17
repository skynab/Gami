import type { FoldFrame, OrigamiModel, Step, StepKind } from './types';

/**
 * Reading and writing .fold files (https://github.com/edemaine/fold). The start of the model is the file's
 * top-level frame and each step is one of `file_frames`. Standard fields keep their FOLD names; Gami's own
 * fields are prefixed `gami:`, which other FOLD tools ignore.
 */

interface FoldFileFrame {
  frame_title?: string;
  vertices_coords: number[][];
  faces_vertices: number[][];
  'gami:vertices_paper': number[][];
  'gami:faces_parent'?: number[];
  'gami:faces_layer'?: number[];
  'gami:text'?: string;
  'gami:kind'?: StepKind;
  /** Frames the step passes through on its way, as when unfolding several folds one after another. */
  'gami:via'?: FoldFileFrame[];
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
    ...writeFrame(model.start),
    file_frames: model.steps.map((s) => ({
      frame_title: s.title,
      ...(s.text && { 'gami:text': s.text }),
      ...(s.kind && { 'gami:kind': s.kind }),
      ...(s.via?.length && { 'gami:via': s.via.map(writeFrame) }),
      ...writeFrame(s.frame),
    })),
  };
}

export function fromFoldFile(file: FoldFile): OrigamiModel {
  const sheets = file['gami:sheets'] ?? (file['gami:sheet'] && [file['gami:sheet']]);
  if (!sheets || !Array.isArray(file.file_frames)) throw new Error('This .fold file wasn’t made by Gami.');
  return {
    id: file['gami:id'],
    title: file.file_title,
    sheets,
    start: readFrame(file),
    steps: file.file_frames.map(
      (f): Step => ({
        title: f.frame_title ?? '',
        ...(f['gami:text'] && { text: f['gami:text'] }),
        ...(f['gami:kind'] && { kind: f['gami:kind'] }),
        ...(f['gami:via'] && { via: f['gami:via'].map(readFrame) }),
        frame: readFrame(f),
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
  };
}

function readFrame(f: FoldFileFrame): FoldFrame {
  return {
    vertices_coords: f.vertices_coords as FoldFrame['vertices_coords'],
    vertices_paper: f['gami:vertices_paper'] as FoldFrame['vertices_paper'],
    faces_vertices: f.faces_vertices,
    ...(f['gami:faces_parent'] && { faces_parent: f['gami:faces_parent'] }),
    ...(f['gami:faces_layer'] && { faces_layer: f['gami:faces_layer'] }),
  };
}
