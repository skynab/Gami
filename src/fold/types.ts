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
  /**
   * Scissor cuts made so far, as segments on the sheet. Faces meeting along a cut aren't joined there, though
   * they may share its ends. Kept from frame to frame once made.
   */
  cuts?: [Vec2, Vec2][];
  /** Strips of sticky tape on the paper so far (see tape.ts). Kept from frame to frame once laid. */
  tapes?: Tape[];
  /**
   * Edges between triangles of bent paper cut from one face (see docs/bending-plan.md), as pairs of vertices:
   * seams of the mesh rather than creases, so drawn without lines, and shaded smoothly across.
   */
  soft?: [number, number][];
}

export const STEP_KINDS = ['fold', 'unfold', 'turn-over', 'rotate', 'squash', 'reverse', 'petal', 'sink', 'assemble', 'pose', 'draw', 'cut', 'tape'] as const;
export type StepKind = (typeof STEP_KINDS)[number];

/**
 * A line or a filled shape drawn on the paper, as points on the unfolded sheet and the side of the paper it's
 * on, so it moves with the paper wherever it goes. A line runs through its points; a fill is the outline they
 * make. Marks aren't paper: they never change how it folds.
 */
export interface Mark {
  side: 'front' | 'back';
  points: Vec2[];
  fill?: boolean;
}

/**
 * A strip of sticky tape: a piece of it on each face it covers, each a fill on the sheet on the side of the paper
 * it's stuck to (as a mark), so it moves with the paper. The faces under its pieces are stuck together.
 */
export interface Tape {
  pieces: Mark[];
}

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
  /** What this step draws on the paper (shown from this step on). Kept with the step, like its frame. */
  marks?: Mark[];
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
   * seen at a slant.
   */
  card?: 'flat' | 'finished';
  /** How the gallery describes it, kept in its file so a shared model carries it along. */
  about?: About;
}

/** `lesson`: lessons rather than models (the basics, folds, bases and geometry), badged as such on their cards. */
export const CATEGORIES = ['lesson', 'animal', 'object', 'toy', 'plane', 'modular', 'flower'] as const;
export type Category = (typeof CATEGORIES)[number];
export const DIFFICULTIES = [1, 2, 3, 4, 5] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/**
 * A model's gallery details. The tools it needs aren't among them: they follow from its steps (`toolsNeeded`).
 */
export interface About {
  /** A sentence for its card. */
  blurb?: string;
  difficulty?: Difficulty;
  category?: Category;
  /** About how long it takes to fold. */
  minutes?: number;
}

/** Tools beyond paper: scissors for a cut, a pen for drawing, tape to hold paper together. */
export type Tool = 'scissors' | 'pen' | 'tape';
