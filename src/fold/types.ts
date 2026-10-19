import type { Op } from './ops';

/**
 * How a model is stored. Loosely follows the FOLD format (https://github.com/edemaine/fold): each frame is
 * the whole paper after one step, as vertices and polygon faces. Field names match FOLD where they overlap.
 */

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

/**
 * The paper's state after a step. Coordinates: the table is the XZ plane, +Y is up, +Z faces the viewer.
 * The unfolded sheet lies at y = 0 with paper point (u, v) at (u, 0, v), front (coloured) side up.
 */
export interface FoldFrame {
  /** Where each vertex is in 3D. */
  vertices_coords: Vec3[];
  /** Where each vertex is on the unfolded sheet (the crease pattern). Never changes for a given paper point. */
  vertices_paper: Vec2[];
  /** Each face as vertex indices, counter-clockwise when the front side is seen from on top of the unfolded sheet. */
  faces_vertices: number[][];
  /**
   * For each face, the face of the previous frame it came from. A fold splits faces, so several faces can
   * share a parent. Leave it out when the faces are the same as last frame's.
   */
  faces_parent?: number[];
  /** Stacking order of faces that lie flat on top of each other. Higher is on top. Defaults to 0. */
  faces_layer?: number[];
}

export type StepKind = 'fold' | 'unfold' | 'turn-over' | 'rotate' | 'squash' | 'reverse' | 'petal' | 'sink' | 'assemble' | 'pose' | 'draw';

export interface Step {
  title: string;
  text?: string;
  kind?: StepKind;
  /** Set on the first step of a part of the model, such as each topic of a lesson: its name. The timeline marks it. */
  section?: string;
  /** The paper after this step. */
  frame: FoldFrame;
  /**
   * Frames the step passes through on its way there, in order, when one movement can't show it: unfolding
   * several folds at once plays them back one after another.
   */
  via?: FoldFrame[];
  /** How the step was made from the paper before it, so it can be made again after an earlier step changes. */
  op?: Op;
}

export interface Sheet {
  /** Width and height on the unfolded sheet. 1 × 1 is a standard square. */
  size: Vec2;
  front: string;
  back: string;
  /**
   * Where this sheet's centre is in sheet coordinates. Each sheet of a multi-sheet model gets its own
   * patch of sheet coordinates, so a point there says which sheet it's on. Defaults to (0, 0).
   */
  origin?: Vec2;
}

export interface OrigamiModel {
  id: string;
  title: string;
  /** One sheet for most models; two or more for modular ones like the ninja star. */
  sheets: Sheet[];
  /** The paper before step 1, usually the flat sheet. */
  start: FoldFrame;
  steps: Step[];
  /**
   * How the gallery card shows a model finished in 3D: as it was just before (the default), or finished,
   * seen at a slant. Only used when building cards, so not kept in .fold files.
   */
  card?: 'flat' | 'finished';
}
