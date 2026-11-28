import { affine } from './animate';
import { facePositions, framesOf, normal } from './frames';
import { joinedSegment } from './geometry2d';
import { sheetOf } from './sheets';
import type { FoldFrame, OrigamiModel, Vec2, Vec3 } from './types';

/**
 * Paper come apart where a step comes to rest: two faces joined along a crease (not across a scissor cut) whose
 * shared edge isn't in the same place on both, as the viewer draws them. The viewer closes the gap between layers
 * pressed flat on each other at a fold with a rounded bend (see FoldedPaper.tsx), so a gap between faces lying
 * parallel, across their faces, doesn't show; anywhere else the paper shows torn, one part floating off the paper
 * it's folded from (the king bee's body, opening its wings, stood 6 mm clear of its wings on a 15 cm sheet:
 * November 2026). `partings` in collisions.ts looks for paper coming apart as steps play, beyond what's apart at
 * their ends; this looks at the ends.
 */
export interface RestingBreak {
  /** The step (1-based) whose frame it is. */
  step: number;
  /** The two faces of the step's frame that have parted. */
  faces: [number, number];
  /** How far apart the ends of their shared edge are, at the most. A sheet's width is 1, a layer 0.0007. */
  gap: number;
  /** The shared edge's middle on the sheet, to find it by. */
  paper: Vec2;
  /** Which sheet it's on. */
  sheet: number;
}

/**
 * How far apart joined paper may be where a step comes to rest, other than stacked layers' gaps at a fold: as far
 * as it may come apart as a step plays (`TEAR` in models/known-clipping.ts), about the thickness of a 14-layer
 * stack, 1.5 mm on a 15 cm sheet. A shaped stack stands its layers off one another by their gaps, each with its own
 * corners (see shape.ts), so a fold stood up from paper lying flat is apart by up to its layers' gaps there.
 */
export const BREAK = 0.01;

/** How nearly two faces have to face the same way, or opposite, for the viewer to draw a bend between them. */
const PARALLEL = 0.999;

/** Joined paper apart by more than `limit` in each step's frame, as it comes to rest (see `RestingBreak`). */
export function restingBreaks(model: OrigamiModel, limit = BREAK): RestingBreak[] {
  return framesOf(model).flatMap((frame, k) =>
    k ? breaksIn(frame, limit).map((b) => ({ ...b, step: k, sheet: sheetOf(model.sheets, [b.paper]) })) : [],
  );
}

/** The widest break in each step that has one (1-based), for warning whoever is making the model. */
export function brokenSteps(model: OrigamiModel, limit = BREAK): { step: number; gap: number }[] {
  const worst = new Map<number, number>();
  for (const b of restingBreaks(model, limit)) worst.set(b.step, Math.max(worst.get(b.step) ?? 0, b.gap));
  return [...worst].map(([step, gap]) => ({ step, gap }));
}

/** Joined paper apart by more than `limit` in one frame, but for which step and sheet it's in. */
export function breaksIn(frame: FoldFrame, limit = BREAK): Omit<RestingBreak, 'step' | 'sheet'>[] {
  const pose = facePositions(frame);
  const paper = frame.faces_vertices.map((face) => face.map((v) => frame.vertices_paper[v]));
  const normals = pose.map(normal);
  const bounds = paper.map((p) => {
    const us = p.map((q) => q[0]);
    const vs = p.map((q) => q[1]);
    return [Math.min(...us), Math.min(...vs), Math.max(...us), Math.max(...vs)];
  });
  const out: Omit<RestingBreak, 'step' | 'sheet'>[] = [];
  for (let a = 0; a < paper.length; a++) {
    for (let b = a + 1; b < paper.length; b++) {
      const [p, q] = [bounds[a], bounds[b]];
      if (p[0] > q[2] + 1e-7 || q[0] > p[2] + 1e-7 || p[1] > q[3] + 1e-7 || q[1] > p[3] + 1e-7) continue;
      const ends = joinedSegment(paper[a], paper[b], frame.cuts);
      if (!ends) continue;
      const onA = ends.map(affine(paper[a], pose[a]));
      const onB = ends.map(affine(paper[b], pose[b]));
      const gaps = onA.map((e, i) => sub(onB[i], e));
      const gap = Math.max(...gaps.map((g) => Math.hypot(...g)));
      if (gap <= limit) continue;
      // Layers pressed flat on each other: the viewer draws a bend across the gap between them, along their normal.
      const [na, nb] = [normals[a], normals[b]];
      const stacked = Math.abs(dot(na, nb)) >= PARALLEL && gaps.every((g) => Math.hypot(...g) - Math.abs(dot(g, na)) < BREAK);
      if (stacked) continue;
      out.push({ faces: [a, b], gap, paper: [(ends[0][0] + ends[1][0]) / 2, (ends[0][1] + ends[1][1]) / 2] });
    }
  }
  return out;
}

const sub = (p: Vec3, q: Vec3): Vec3 => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const dot = (p: Vec3, q: Vec3) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
