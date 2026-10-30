import { Matrix4, Quaternion, Vector3 } from 'three';
import { box, clearanceDepth, cornerKeys, crossDepth, overlapping } from './cross3d';
import { facePositions, framesOf, LAYER_GAP, normal, sphereAround } from './frames';
import { joinedSegment, overlapArea, type Cut } from './geometry2d';
import { applyOp, lastFold, reopened, select, type Op } from './ops';
import { inside } from './select';
import { sheetOf } from './sheets';
import type { FoldFrame, OrigamiModel, Vec2, Vec3 } from './types';

/**
 * Animating one step: every face of the new frame moves rigidly from where its paper was in the old frame
 * to where it is now. Faces are never stretched, so the paper keeps its shape mid-fold.
 *
 * Each move is a screw motion: a turn about an axis plus a slide along it. A plain fold is a pure turn
 * about the crease, so faces on either side of a crease stay joined all the way through. When part of the
 * paper stays still, faces can instead hang from it crease by crease (hinged), which follows compound folds
 * better; a step uses whichever passes less paper through other paper. Half turns go the way round that
 * crosses least, stacked layers turning together go together, and the whole model lifts off the table
 * rather than one part rising through the rest. Paper has some thickness to allow for: a stack folding over
 * eases off its crease, hinged layers settle into their new place on the way, and the creases of a compound
 * fold can fold one after another. A separate piece of paper in the way (tucking a point under another
 * unit) is lifted out of it while the step plays, and a compound fold can play in stages, its flap stood up
 * about its hinge before it's squashed.
 */

export interface FaceTrack {
  /** Corners on the unfolded sheet. */
  paper: Vec2[];
  /** Corners in 3D before and after the step. */
  before: Vec3[];
  after: Vec3[];
  /** Index into Transition.motions. Faces that move together share one. */
  motion: number;
}

export interface Motion {
  axis: Vector3;
  /** Radians. 0 means a straight slide by `shift`. */
  angle: number;
  /** A point on the turning axis. */
  pivot: Vector3;
  /** Slide along the axis (or the whole move, when there's no turn). */
  shift: Vector3;
  /** How far to raise the paper mid-move so nothing swings through the table, as when turning it over. The same for every group in a step. */
  lift: number;
  /**
   * How far a stack turning about a crease eases away from it mid-turn. A stack folding over turns about its
   * middle, so its lower layers would swing into the paper they hinge from by up to the stack's thickness;
   * real paper wraps round instead.
   */
  ease?: Vector3;
}

export interface Transition {
  faces: FaceTrack[];
  motions: Motion[];
  /**
   * For a step that passes through other frames on its way: a transition for each stretch, played one after
   * another, and for each stretch which of its faces each face of the step's final frame comes from.
   */
  path?: { parts: Transition[]; ancestors: number[][] };
  /**
   * Hinged motion, used when part of the paper stays still: each face turns about its crease with the face it
   * hangs from (`parent`, or -1 for paper that stays still), by its share of `angle`, so faces stay joined
   * at their creases all the way and follow the folds rather than cutting across. Faces that aren't hinged to
   * anything (-2) use their own motion. `order` lists faces parents first. Paper staying still slides by
   * `shift` (its layers renumbered); `fix` is how far each face's corners are from where they land, made up
   * on the way; with `stagger`, creases nearer the still paper fold first (or, below 0, last).
   */
  hinges?: { parent: number[]; at: Vec3[]; dir: Vec3[]; angle: number[]; order: number[]; lift: number; shift: Vec3[]; fix?: Vec3[][]; stagger?: number };
  /**
   * Paper that gets out of the way, as when tucking a point under another unit: a separate piece of paper
   * the moving paper would pass through tilts up about a line on the table first (`lifted` faces, turning by
   * `angle` about `axis` through `pivot`), the step plays while it's up, and it comes back down after.
   */
  makeWay?: { lifted: boolean[]; pivot: Vec3; axis: Vec3; angle: number };
  /**
   * Into paper that bends (a frame with soft edges): each face makes its own screw motion from where it was to
   * where it ends up (`moves`), then every corner is put where the faces sharing its vertex (`vertices`,
   * the end frame's) place it on average, so the small triangles of bending paper stay joined. The frames a
   * bend passes through are close together, so they barely disagree.
   */
  blend?: { moves: Motion[]; vertices: number[][] };
  /** Poses worked out some other way than by motions, as each copy of a unit folding as the first one did. */
  replay?: (s: number) => Vec3[][];
  /** A step played from its end back to its start (see `unfoldingBackwards`), and each face's face in it. */
  backwards?: { t: Transition; ancestors: number[] };
  /** Faces of separate paper that stay on the table while the rest lifts off it (see Motion.lift). */
  grounded?: boolean[];
  /**
   * When each face finishes its move (0–1): faces ending lower in the stack land first, so paper settles
   * bottom layer first, as it does by hand, instead of a lower layer coming down through upper ones.
   */
  landing?: number[];
}

const SAME = 1e-4;
/** How far stacked faces can shift as their layers are renumbered (a few gaps between layers). */
const SLACK = 20 * LAYER_GAP;

/** Transitions already worked out, by the frames they go between: the viewer, guides and camera all ask. */
const known = [0, 1, 2, 3].map(() => new WeakMap<FoldFrame, WeakMap<FoldFrame, Transition>>());
// (Frames made for a stage are new each time, so the stage depth needn't be part of the key.)

/**
 * How the paper gets from `from` to `to`. `makeWay` lets separate paper lift out of the way, and `stage` lets
 * a compound fold lift its moving paper first (both on unless asked otherwise).
 */
export function transition(from: FoldFrame, to: FoldFrame, { makeWay = true, stage = true } = {}): Transition {
  return transitionStaged(from, to, makeWay, stage ? STAGES : 0);
}

/** How many times over a step can be split into stages (a stage can itself be staged). */
const STAGES = 2;

function transitionStaged(from: FoldFrame, to: FoldFrame, makeWay: boolean, stages: number): Transition {
  const cache = known[(makeWay ? 1 : 0) + (makeWay && stages ? 2 : 0)];
  let byTo = cache.get(from);
  if (!byTo) cache.set(from, (byTo = new WeakMap()));
  let t = byTo.get(to);
  if (!t) byTo.set(to, (t = workOut(from, to, makeWay, stages)));
  return t;
}

function workOut(from: FoldFrame, to: FoldFrame, makeWay: boolean, stages: number): Transition {
  if (to.soft?.length) return blended(from, to);
  const t = moving(from, to);
  if (!makeWay) return t;
  const made = withWayMade(t);
  // With paper that can get out of the way, the way round that goes through it may be the better one.
  let best = made;
  let fewest = passesThrough(made, WAY_SAMPLES);
  if (!fewest) return made;
  const yielding = withWayMade(moving(from, to, { yielding: true }));
  const y = passesThrough(yielding, WAY_SAMPLES);
  if (y < fewest) [best, fewest] = [yielding, y];
  if (fewest && stages) {
    // Judged by how deep paper goes through, closely: staged moves are quicker, and slip through in a moment.
    // Not if staging pulls joined paper apart: paper lifted out of the way and put back, its neighbours left.
    let deepest = depthThrough(best);
    const torn = tornBy(best);
    for (const staged of stagedWays(from, to, t, stages - 1)) {
      const way = staged();
      if (!way) continue;
      const d = depthThrough(way, deepest);
      if (d < deepest && tornBy(way) <= Math.max(torn, TEAR / 2)) [best, deepest] = [way, d];
      if (!deepest) break;
    }
  }
  return best;
}

/** Into a bent frame (see Transition.blend), all as one motion. */
function blended(from: FoldFrame, to: FoldFrame): Transition {
  const fromPositions = facePositions(from);
  const toPositions = facePositions(to);
  const faces = to.faces_vertices.map((face, f): FaceTrack => {
    const parent = to.faces_parent?.[f] ?? f;
    const paper = face.map((v) => to.vertices_paper[v]);
    const toWorld = affine(from.faces_vertices[parent].map((v) => from.vertices_paper[v]), fromPositions[parent]);
    return { paper, before: paper.map(toWorld), after: toPositions[f], motion: 0 };
  });
  cutsOf.set(faces, to.cuts ?? from.cuts ?? []);
  const still: Motion = { axis: new Vector3(0, 1, 0), angle: 0, pivot: new Vector3(), shift: new Vector3(), lift: 0 };
  const moves = faces.map((f) => {
    const { q, t } = rigid(f.paper, f.before, f.after);
    return screwsFor(q, t)[0];
  });
  return { faces, motions: [still], blend: { moves, vertices: to.faces_vertices } };
}

/**
 * Each face making its own move, straight from where its paper was to where it ends up. For folding a pile of
 * units the same way as one already made (`copy`), a step that skips ahead, and for any step with more than
 * `SEPARATELY` faces, as a kusudama's sixty petals put together: working out a joined-up motion for hundreds of
 * faces at once takes seconds.
 */
const SEPARATELY = 400;

/** How the paper gets from one frame to the next: as `transition`, or face by face for very many faces. */
export function transitionBetween(from: FoldFrame, to: FoldFrame): Transition {
  return to.faces_vertices.length > SEPARATELY && !to.soft?.length ? separately(from, to) : transition(from, to);
}

function separately(from: FoldFrame, to: FoldFrame): Transition {
  const fromPositions = facePositions(from);
  const toPositions = facePositions(to);
  const motions: Motion[] = [];
  const faces = to.faces_vertices.map((face, f): FaceTrack => {
    const parent = to.faces_parent?.[f] ?? f;
    const paper = face.map((v) => to.vertices_paper[v]);
    const before = paper.map(affine(from.faces_vertices[parent].map((v) => from.vertices_paper[v]), fromPositions[parent]));
    const { q, t } = rigid(paper, before, toPositions[f]);
    return { paper, before, after: toPositions[f], motion: motions.push(screwsFor(q, t)[0]) - 1 };
  });
  cutsOf.set(faces, to.cuts ?? from.cuts ?? []);
  return { faces, motions };
}

/** Whether a step only folds more units like one already made. */
const copies = (op: Op): boolean => op.op === 'copy' || (op.op === 'together' && op.ops.every(copies));

/**
 * Folding more units like one already made (`copy`): each copy folds just as the first unit did, step by step,
 * then goes to its place, lifted clear of the rest. Units take turns, from the top of the pile, each turn taking
 * `TURN` of the step (more when there are few), starting evenly through the rest of it.
 */
function foldedLikeTheFirst(model: OrigamiModel, k: number, op: Op): Transition {
  const frames = framesOf(model);
  const [from, to] = [frames[k - 1], frames[k]];
  // Each copy's unit, and its turn: copies made together (the first of each copy's list, say) fold together.
  const sourceOf = new Map<number, number>();
  const turnOf = new Map<number, number>();
  const collect = (o: Op): void => {
    if (o.op === 'copy')
      o.to.forEach((t, n) => {
        sourceOf.set(t, o.from);
        turnOf.set(t, n);
      });
    else if (o.op === 'together') o.ops.forEach(collect);
  };
  collect(op);
  const history = Array.from({ length: k - 1 }, (_, j) => stepTransition(model, j + 1));
  const fromPositions = facePositions(from);
  const toPositions = facePositions(to);
  const origin = (n: number) => model.sheets[n]?.origin ?? [0, 0];
  const faces = to.faces_vertices.map((face, f): FaceTrack => {
    const paper = face.map((v) => to.vertices_paper[v]);
    const parent = to.faces_parent?.[f] ?? f;
    const before = paper.map(affine(from.faces_vertices[parent].map((v) => from.vertices_paper[v]), fromPositions[parent]));
    return { paper, before, after: toPositions[f], motion: 0 };
  });
  cutsOf.set(faces, to.cuts ?? from.cuts ?? []);
  const still: Motion = { axis: new Vector3(0, 1, 0), angle: 0, pivot: new Vector3(), shift: new Vector3(), lift: 0 };
  if (!history.length) return { faces, motions: [still] };

  // Each copied face: its unit, the same paper on the unit it copies, and that paper's face before this step and
  // in each step before it (following faces back).
  const copied = faces.map((f) => {
    const unit = sheetOf(model.sheets, f.paper);
    const source = sourceOf.get(unit);
    if (source === undefined) return null;
    const [tu, tv] = origin(unit);
    const [su, sv] = origin(source);
    const paper = f.paper.map(([u, v]): Vec2 => [u - tu + su, v - tv + sv]);
    const c: Vec2 = [paper.reduce((sum, p) => sum + p[0], 0) / paper.length, paper.reduce((sum, p) => sum + p[1], 0) / paper.length];
    let face = from.faces_vertices.findIndex((g) => inside(g.map((v) => from.vertices_paper[v]), c));
    if (face < 0) return null;
    const ancestors: number[] = [];
    for (let j = k - 1; j >= 1; j--) {
      ancestors[j - 1] = face;
      face = frames[j].faces_parent?.[face] ?? face;
    }
    return { unit, paper, ancestors };
  });
  // Turns go from the top of the pile, the last copies first.
  const turns = [...new Set(turnOf.values())].sort((a, b) => b - a);
  const turn = Math.min(1, Math.max(TURN, 2 / turns.length));
  const startOf = (unit: number) => {
    const j = turns.indexOf(turnOf.get(unit)!);
    return turns.length > 1 ? (j / (turns.length - 1)) * (1 - turn) : 0;
  };

  // Where the first unit's paper is `tau` of the way through its folding, each step played as it was. Moments are
  // rounded to `MOMENTS` a step and their poses kept, as many units fold at once and each frame asks again.
  const poses = new Map<number, Vec3[][]>();
  const sourceAt = (i: number, tau: number): Vec3[] => {
    const c = copied[i]!;
    const x = Math.min(history.length - 1e-9, Math.round(tau * history.length * MOMENTS) / MOMENTS);
    const j = Math.floor(x);
    let pose = poses.get(x);
    if (!pose) poses.set(x, (pose = poseAt(history[j], x - j)));
    const a = c.ancestors[j];
    return c.paper.map(affine(history[j].faces[a].paper, pose[a]));
  };
  // Each face moves along from where the first unit's paper was to where its own is: the same for all its corners.
  const offsets = faces.map((f, i) => {
    if (!copied[i]) return null;
    const [s0, s1] = [sourceAt(i, 0)[0], sourceAt(i, 1)[0]];
    return { start: f.before[0].map((x, d) => x - s0[d]) as Vec3, end: f.after[0].map((x, d) => x - s1[d]) as Vec3 };
  });
  const replay = (s: number): Vec3[][] => faces.map((f, i) => {
      const c = copied[i];
      const o = offsets[i];
      if (!c || !o) return f.before;
      const tau = Math.max(0, Math.min(1, (s - startOf(c.unit)) / turn));
      if (tau <= 0) return f.before;
      if (tau >= 1) return f.after;
      const rise = TURN_LIFT * raised(tau);
      return sourceAt(i, tau).map((p): Vec3 => [0, 1, 2].map((d) => p[d] + o.start[d] + (o.end[d] - o.start[d]) * tau + (d === 1 ? rise : 0)) as Vec3);
    });
  return { faces, motions: [still], replay };
}

/**
 * Putting units together (`assemble`), as you would by hand: each unit placed this step goes first to a spot just
 * outside its place, out from the middle of everything put together so far, then slides straight in. Going
 * straight to its place, a unit would cut through the ones already there. A unit is moved as one when it keeps
 * its shape; one bent as it's placed moves face by face.
 */
function comingIn(model: OrigamiModel, k: number, op: Extract<Op, { op: 'assemble' }>): Transition {
  const frames = framesOf(model);
  const [from, to] = [frames[k - 1], frames[k]];
  const fromPositions = facePositions(from);
  const toPositions = facePositions(to);
  const faces = to.faces_vertices.map((face, f): FaceTrack => {
    const paper = face.map((v) => to.vertices_paper[v]);
    const parent = to.faces_parent?.[f] ?? f;
    const before = paper.map(affine(from.faces_vertices[parent].map((v) => from.vertices_paper[v]), fromPositions[parent]));
    return { paper, before, after: toPositions[f], motion: 0 };
  });
  cutsOf.set(faces, to.cuts ?? from.cuts ?? []);
  const still: Motion = { axis: new Vector3(0, 1, 0), angle: 0, pivot: new Vector3(), shift: new Vector3(), lift: 0 };

  // The units placed this step, and everything placed in the run of assembly steps so far.
  const pick = (only: Parameters<typeof select>[0]) => select(only, { frame: to, sheets: model.sheets });
  const placing = op.pieces.filter((p) => p.pose).map((p) => pick(p.only));
  const run: Op[] = [op];
  for (let j = k - 1; j >= 1 && model.steps[j - 1].op?.op === 'assemble'; j--) run.push(model.steps[j - 1].op!);
  const placed = run.flatMap((o) => (o.op === 'assemble' ? o.pieces.filter((p) => p.pose).map((p) => pick(p.only)) : []));
  const unitOf = faces.map((f) => placing.findLastIndex((test) => test(f.paper)));
  const middle = (pts: Vec3[]): Vec3 => [0, 1, 2].map((d) => pts.reduce((sum, p) => sum + p[d], 0) / pts.length) as Vec3;
  const centre = middle(faces.filter((f) => placed.some((test) => test(f.paper))).flatMap((f) => f.after));

  // Each unit's way in: out from the middle, as far as the unit is across.
  const ways = placing.map((_, u) => {
    const pts = faces.filter((_, i) => unitOf[i] === u).flatMap((f) => f.after);
    if (!pts.length) return null;
    const c = middle(pts);
    const out = new Vector3(c[0] - centre[0], c[1] - centre[1], c[2] - centre[2]);
    if (out.lengthSq() < 1e-12) out.set(0, 1, 0);
    const across = Math.max(...pts.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2])));
    return out.normalize().multiplyScalar(COME_IN * across);
  });
  // Each face's move to just outside its place, as a screw motion of its own (the same for a whole unit that keeps its shape).
  const moves = faces.map((f, i) => {
    const way = ways[unitOf[i]];
    if (unitOf[i] < 0 || !way) return null;
    const outside = f.after.map((p): Vec3 => [p[0] + way.x, p[1] + way.y, p[2] + way.z]);
    const { q, t } = rigid(f.paper, f.before, outside);
    return { motion: screwsFor(q, t)[0], way };
  });
  const replay = (s: number): Vec3[][] =>
    faces.map((f, i) => {
      const m = moves[i];
      if (!m) return f.before.map((p, c) => [0, 1, 2].map((d) => p[d] + (f.after[c][d] - p[d]) * s) as Vec3);
      if (s < ARRIVE) return f.before.map((p) => move(m.motion, p, s / ARRIVE));
      const left = (1 - s) / (1 - ARRIVE);
      return f.after.map((p): Vec3 => [p[0] + m.way.x * left, p[1] + m.way.y * left, p[2] + m.way.z * left]);
    });
  return { faces, motions: [still], replay };
}

/** How far out a unit comes in from, for its size, and how much of the step it takes to get there before sliding in. */
const COME_IN = 0.8;
const ARRIVE = 0.65;

/** How much of a step each unit of a pile takes to fold, at least, and how high it's lifted as it goes. */
const TURN = 0.3;
const TURN_LIFT = 0.3;
/** How finely a copy's folding is played: the first unit's poses at this many moments a step. */
const MOMENTS = 40;

function blendedPose(t: Transition, s: number): Vec3[][] {
  const { moves, vertices } = t.blend!;
  const sum = new Map<number, { p: Vec3; n: number }>();
  t.faces.forEach((f, i) =>
    f.before.forEach((p, c) => {
      const out = move(moves[i], p, s);
      const e = sum.get(vertices[i][c]);
      if (!e) sum.set(vertices[i][c], { p: out, n: 1 });
      else {
        e.p = [e.p[0] + out[0], e.p[1] + out[1], e.p[2] + out[2]];
        e.n++;
      }
    }),
  );
  return vertices.map((face) =>
    face.map((v) => {
      const { p, n } = sum.get(v)!;
      return [p[0] / n, p[1] / n, p[2] / n] as Vec3;
    }),
  );
}

/**
 * A compound fold played in two stages, as you'd do it: the paper that moves first lifts off as one about the
 * line where it joins the paper staying put (a flap stood up before it's squashed), then each part goes to
 * its place from there. One way for each way of lifting it; none if the moving paper isn't joined along one line.
 */
function stagedWays(from: FoldFrame, to: FoldFrame, t: Transition, stages: number): (() => Transition | null)[] {
  const put = t.motions.map((m) => !m.angle && m.shift.length() < SLACK);
  const moving = t.faces.map((f) => !put[f.motion]);
  if (!moving.some(Boolean) || moving.every(Boolean)) return [];
  // Each joint between faces, where it is before the step.
  const joints = sharedEdges(t.faces).map(({ i, j, shared }) => {
    const place = affine(t.faces[i].paper, t.faces[i].before);
    return { i, j, ends: shared.map((q) => new Vector3(...place(q))) };
  });
  // A hinge is a line through a joint between moving and staying paper. The paper lifted about it is all
  // that's joined to the moving paper other than along it (a whole flap, parts of which end where they began),
  // so long as that isn't everything.
  const hinges: { a: Vector3; axis: Vector3; lifted: boolean[] }[] = [];
  for (const { i, j, ends } of joints) {
    if (moving[i] === moving[j]) continue;
    // Hinges are lines on the table: stacked layers' joints along one differ only by the gaps between layers.
    const [a, b] = ends;
    const axis = b.clone().sub(a).setY(0);
    if (axis.length() < 1e-6) continue;
    axis.normalize();
    const flat = (p: Vector3) => p.clone().sub(a).setY(0);
    const onLine = (p: Vector3) => flat(p).cross(axis).length() < 1e-5;
    if (hinges.some((h) => h.axis.clone().cross(axis).length() < 1e-6 && onLine(h.a))) continue;
    const lifted = moving.slice();
    const queue = lifted.flatMap((m, f) => (m ? [f] : []));
    while (queue.length) {
      const f = queue.pop()!;
      for (const e of joints) {
        if (e.i !== f && e.j !== f) continue;
        const g = e.i === f ? e.j : e.i;
        if (lifted[g] || e.ends.every(onLine)) continue;
        lifted[g] = true;
        queue.push(g);
      }
    }
    if (!lifted.every(Boolean)) hinges.push({ a, axis, lifted });
  }

  // The paper after the step, each face with its own corners, so the stages can share its faces.
  const own = (positions: Vec3[][], parent?: number[], layers?: number[]): FoldFrame => {
    let n = 0;
    return {
      vertices_coords: positions.flat(),
      vertices_paper: t.faces.flatMap((f) => f.paper),
      faces_vertices: positions.map((pts) => pts.map(() => n++)),
      ...(parent && { faces_parent: parent }),
      ...(layers && { faces_layer: layers }),
    };
  };
  const end = { ...to, faces_parent: undefined };
  const same = t.faces.map((_, i) => i);
  /** The step staged by standing the lifted paper up by `degrees` about its hinge first; null if that's into the table. */
  const stood = ({ a, axis, lifted }: (typeof hinges)[number], degrees: number): Transition | null => {
    const turn = new Matrix4()
      .makeTranslation(a.x, a.y, a.z)
      .multiply(new Matrix4().makeRotationAxis(axis, (degrees * Math.PI) / 180))
      .multiply(new Matrix4().makeTranslation(-a.x, -a.y, -a.z));
    const p = new Vector3();
    const positions = t.faces.map((f, i) => (lifted[i] ? f.before.map((q) => p.set(...q).applyMatrix4(turn).toArray() as Vec3) : f.before));
    if (positions.some((pts) => pts.some((q) => q[1] < -1e-6))) return null;
    const up = own(positions, to.faces_parent ?? same);
    // Standing it up is one plain turn; the rest can be staged again, `stages` more times.
    const parts = [transitionStaged(from, up, false, 0), transitionStaged(up, end, true, stages)];
    return { ...t, path: { parts, ancestors: [same, same] } };
  };
  // Worked out only when tried. The first stage tries a few heights to stand the paper up to; one within it, just upright.
  return hinges.flatMap((h) =>
    (stages ? [90, -90, 60, -60] : [90, -90]).map((degrees) => {
      let made: Transition | null | undefined;
      return () => (made === undefined ? (made = stood(h, degrees)) : made);
    }),
  );
}

/**
 * The paper's moves, without making way. `yielding` chooses which way round half turns go as if separate
 * pieces of paper staying put weren't there, since they can get out of the way.
 */
function moving(from: FoldFrame, to: FoldFrame, { yielding = false } = {}): Transition {
  const fromPositions = facePositions(from);
  const toPositions = facePositions(to);
  const reps: { q: Quaternion; t: Vector3; faces: number[] }[] = [];

  const faces = to.faces_vertices.map((face, f): FaceTrack => {
    const parent = to.faces_parent?.[f] ?? f;
    const parentPaper = from.faces_vertices[parent].map((v) => from.vertices_paper[v]);
    const paper = face.map((v) => to.vertices_paper[v]);
    const toWorld = affine(parentPaper, fromPositions[parent]);
    const before = paper.map(toWorld);
    const after = toPositions[f];

    const { q, t } = rigid(paper, before, after);
    let i = reps.findIndex((r) => Math.abs(r.q.dot(q)) > 1 - SAME && r.t.distanceTo(t) < SAME);
    if (i < 0) i = reps.push({ q, t, faces: [] }) - 1;
    reps[i].faces.push(f);
    return { paper, before, after, motion: i };
  });
  cutsOf.set(faces, to.cuts ?? from.cuts ?? []);

  // Moves with the same turn (stacked layers turning over together, say, which differ only by the gap
  // between layers) go the same way round and rise as high, so they never pass through each other. Only
  // about the same crease, though: layers stacked over it move apart up and down, not across the table.
  // The same turn about a crease elsewhere (both sides folding in to the middle) goes its own way round.
  const classes: number[][] = [];
  const across = (a: Vector3, b: Vector3) => Math.hypot(a.x - b.x, a.z - b.z);
  reps.forEach((r, i) => {
    const c = classes.find((c) => Math.abs(reps[c[0]].q.dot(r.q)) > 1 - SAME && across(reps[c[0]].t, r.t) < SLACK);
    if (c) c.push(i);
    else classes.push([i]);
  });
  const motions: Motion[] = new Array(reps.length);
  const choices: { c: number[]; options: Motion[][] }[] = [];
  const put = reps.map((r) => Math.abs(r.q.w) > 1 - 1e-9 && r.t.length() < SLACK);
  // A plain fold: one stack turning, the rest staying put.
  const plain = classes.filter((c) => !c.every((i) => put[i])).length === 1;
  for (const c of classes) {
    const points = c.map((i) => reps[i].faces.flatMap((f) => faces[f].before));
    // A half turn's axis could point either way, so line each one's two ways round up with the first's.
    const options = c.map((i) => screwsFor(reps[i].q, reps[i].t));
    for (const o of options) if (o.length > 1 && o[0].axis.dot(options[0][0].axis) < 0) o.reverse();
    // A half turn can go either way round: by default over the top, lifting the paper most, for all of them;
    // but in a plain fold, under, if it ends up beneath the paper staying put (folding behind).
    let way = 0;
    if (options[0].length > 1) {
      const higher = sum(options.map((o, k) => midHeight(o[1], points[k]))) > sum(options.map((o, k) => midHeight(o[0], points[k]))) + 1e-9 ? 1 : 0;
      way = plain && endsUnder(faces, c, put) ? 1 - higher : higher;
    }
    c.forEach((i, k) => (motions[i] = options[k][way]));
    if (options[0].length > 1) choices.push({ c, options });
  }
  // But going the other way is better if it passes through less paper, as when folding a layer behind.
  if (choices.length) {
    const ignore = faces.map(() => false);
    if (yielding) for (const piece of pieces(faces)) if (piece.every((f) => put[faces[f].motion])) for (const f of piece) ignore[f] = true;
    for (const { c, options } of choices) {
      const now = throughPaper(faces, motions, c, ignore);
      if (!now) continue;
      const other = motions.slice();
      c.forEach((i, k) => (other[i] = options[k].find((m) => m !== motions[i])!));
      if (throughPaper(faces, other, c, ignore) < now) c.forEach((i) => (motions[i] = other[i]));
    }
  }
  motions.forEach((m, i) => (motions[i] = { ...m, lift: liftFor(m, reps[i].faces.flatMap((f) => faces[f].before)) }));
  // Stacks turning together ease away from their creases together too, as far as the lowest of them needs.
  for (const c of classes) {
    const points = c.flatMap((i) => reps[i].faces.flatMap((f) => faces[f].before));
    const ease = easeFor(motions[c.reduce((a, i) => (motions[i].pivot.y > motions[a].pivot.y ? i : a))], points);
    for (const i of c) motions[i] = { ...motions[i], ease };
  }
  // Paper that would dip below the table (folding something behind) lifts it, and the rest of the paper with
  // it, as you'd pick the model up: lifting only the moving part would push it up through the layers above.
  // A separate piece of paper with nothing dipping (the other half of a model made of two) stays on the table.
  const lift = Math.max(0, ...motions.map((m) => m.lift));
  const grounded = faces.map(() => false);
  if (lift) for (const piece of pieces(faces)) if (piece.every((f) => !motions[faces[f].motion].lift)) for (const f of piece) grounded[f] = true;
  let out: Transition = { faces, motions: motions.map((m) => ({ ...m, lift })), ...(grounded.some(Boolean) && { grounded }) };
  // Easing away from creases only where it helps: it can nudge a stack into paper beside the crease instead.
  if (motions.some((m) => m.ease)) {
    const plain: Transition = { faces, motions: out.motions.map((m) => ({ ...m, ease: undefined })) };
    const without = passesThrough(plain, WAY_SAMPLES);
    if (!without || without <= passesThrough(out, WAY_SAMPLES, { limit: without })) out = plain;
  }
  const found = hingesFor(faces, reps);
  if (found) {
    // Folds of several creases rarely move in step: try the creases folding together, and nearest-first or
    // outermost-first when faces hang from turning paper, and keep whichever passes through least paper.
    // Faces that hang from nothing take their own motion, evenly through the step, so creases folding in turn
    // would leave them behind, coming apart from the paper they're joined to.
    const deep = found.order.some((f) => found.parent[f] >= 0 && found.parent[found.parent[f]] >= 0);
    const loose = found.parent.some((p) => p === -2);
    let hinged: Transition | null = null;
    let fewest = Infinity;
    for (const stagger of deep && !loose ? [0, 0.3, 0.5, -0.3] : [0]) {
      const tried = hingedWith(out, { ...found, stagger });
      const count = passesThrough(tried, WAY_SAMPLES);
      if (count < fewest) [hinged, fewest] = [tried, count];
      if (!count) break;
    }
    // Each way of moving has cases the other handles better: keep whichever passes through less paper. When
    // neither passes through any, as a collapse's faces all meeting at a point count as touching, judge a
    // compound fold by how deep any faces cut through each other, joined or not. A plain fold stays as one
    // turn: hinged, each layer of a stack turns about its own crease, and halfway they stand in one plane.
    const through = passesThrough(out, WAY_SAMPLES);
    // Unless hanging the faces from each other tears the paper where each turning its own way doesn't (a wing
    // swinging right over as the body stands up, both about one line); and the other way round, when neither
    // passes through more paper.
    const groups = cornerGroups(faces);
    const torn = (way: Transition) => Math.max(...TEAR_SAMPLES.map((s) => apart(rawPose(way, s), groups)));
    const [tornHinged, tornOwn] = [torn(hinged!), torn(out)];
    const tears = (a: number, b: number) => a > TEAR && b < a - TEAR;
    const tie = fewest === through && (tears(tornOwn, tornHinged) || (!plain && deepestCut(hinged!) <= deepestCut(out)));
    if (!tears(tornHinged, tornOwn) && (fewest < through || tie)) return landInOrder(hinged!);
  }
  return landInOrder(out);
}

/**
 * Whether the faces moving by the motions `group` end up mostly beneath the paper staying put that they land
 * on. Judged by where they finish, since faces joined at a crease can't be told apart by passing through.
 */
function endsUnder(faces: FaceTrack[], group: number[], put: boolean[]): boolean {
  const flat = (pts: Vec3[]): Vec2[] => pts.map((p) => [p[0], p[2]]);
  const height = (pts: Vec3[]) => pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const inGroup = new Set(group);
  let under = 0;
  let over = 0;
  for (const f of faces) {
    if (!inGroup.has(f.motion)) continue;
    for (const g of faces) {
      if (!put[g.motion]) continue;
      const area = overlapArea(flat(f.after), flat(g.after));
      if (area < 1e-6) continue;
      if (height(f.after) < height(g.after)) under += area;
      else over += area;
    }
  }
  return under > over;
}

/**
 * A transition landing bottom layer first instead, if that passes through less paper as it settles, without
 * tearing it: layers joined along a crease (a neck's two halves, at its spine) can't land one after the other.
 */
function landInOrder(t: Transition): Transition {
  // Only for paper settling flat: a step ending in 3D (petals opened out, say) has nothing to land.
  if (t.faces.some((f) => Math.abs(normal(f.after)[1]) < 0.999)) return t;
  // Judged by how deep paper goes through, as landing in order trades crossings in time for others.
  let best = t;
  let now = depthThrough(t);
  let torn: number | null = null;
  for (const spread of LANDS) {
    if (!now) break;
    const ordered = inLandingOrder(t, spread);
    const d = depthThrough(ordered, now);
    if (d >= now) continue;
    torn ??= tornBy(t);
    if (tornBy(ordered) <= Math.max(torn, TEAR / 2)) [best, now] = [ordered, d];
  }
  return best;
}

/** How far apart the same point of paper comes, at most, as a transition plays (before it's pulled together). */
function tornBy(t: Transition): number {
  const groups = cornerGroups(t.faces);
  return groups.length ? Math.max(...TEAR_SAMPLES.map((s) => apart(rawPose(t, s), groups))) : 0;
}

/** The deepest any two faces moving apart cut through each other, at a few points: faces joined at a corner too. */
function deepestCut(t: Transition): number {
  let deepest = 0;
  for (const s of WAY_SAMPLES) {
    const pose = rawPose(t, s);
    const boxes = pose.map(box);
    for (let a = 0; a < pose.length; a++) {
      for (let b = a + 1; b < pose.length; b++) {
        if (together(t, a, b) || !overlapping(boxes[a], boxes[b])) continue;
        deepest = Math.max(deepest, crossDepth(pose[a], pose[b]));
      }
    }
  }
  return deepest;
}

/** How much paper passes through paper, closely: the depth of each crossing past stacking, added up. */
function depthThrough(t: Transition, limit = Infinity): number {
  let total = 0;
  for (const s of STAGE_SAMPLES) {
    if (total > limit) break;
    const pose = rawPose(t, s);
    const boxes = pose.map(box);
    for (let a = 0; a < pose.length; a++) {
      for (let b = a + 1; b < pose.length; b++) {
        if (together(t, a, b) || !overlapping(boxes[a], boxes[b])) continue;
        if (touching(t.faces, a, b)) continue;
        total += Math.max(0, crossDepth(pose[a], pose[b]) - 2.5 * LAYER_GAP);
      }
    }
  }
  return total;
}

/**
 * Hinged motion for a transition, with how far its paper rises and how its layers settle into place.
 *
 * A layer folding right over from still paper can turn about the height halfway between where it starts and
 * where it lands, so the turn alone takes it to its place in the new stack: the layers of a stack swap order
 * by turning, as paper does, keeping their gaps, instead of meeting edge-on halfway (where they flicker through
 * each other) to be put right on the way. That's used unless it passes more paper through paper (a reverse
 * fold's layers turn in opposite ways, each into the other's place).
 */
function hingedWith(out: Transition, hinges: NonNullable<Transition['hinges']>): Transition {
  const plain = settled(out, { ...hinges, at: [...hinges.at] });
  const over = out.faces.flatMap((_, i) => {
    const p = hinges.parent[i];
    return p >= 0 && hinges.parent[p] === -1 && Math.abs(Math.abs(hinges.angle[i]) - Math.PI) < 1e-3 && Math.abs(hinges.dir[i][1]) < 1e-6 ? [i] : [];
  });
  if (!over.length) return plain;
  const height = (pts: Vec3[]) => pts.reduce((sum, q) => sum + q[1], 0) / pts.length;
  const at = [...hinges.at];
  for (const i of over) at[i] = [at[i][0], (height(out.faces[i].before) + height(out.faces[i].after)) / 2, at[i][2]];
  const turned = settled(out, { ...hinges, at });
  return passesThrough(turned) <= passesThrough(plain) && depthThrough(turned) <= depthThrough(plain) ? turned : plain;
}

/** Hinged motion about the given hinges: how far its paper rises, and how its layers settle into place. */
function settled(out: Transition, hinges: NonNullable<Transition['hinges']>): Transition {
  const hinged: Transition = { ...out, hinges };
  // Turning about its crease at the height it started from, a layer lands a little off its place in the new
  // stack (by up to the stack's thickness): it makes that up on the way, rather than jumping at the end.
  const end = hingedPose({ ...hinged, hinges: { ...hinges, fix: undefined, lift: 0 } }, 1);
  hinges.fix = out.faces.map((f, i) => f.after.map((a, c): Vec3 => [a[0] - end[i][c][0], a[1] - end[i][c][1], a[2] - end[i][c][2]]));
  // Hinged paper takes its own path, so it needs its own lift to keep it off the table.
  // The lift rises and falls through the step, so a dip early on needs more of it than one halfway.
  hinges.lift = 0;
  let need = 0;
  for (let i = 1; i < 32; i++) {
    const lowest = Math.min(0, ...rawPose(hinged, i / 32).flat().map((p) => p[1]));
    if (lowest < -1e-4) need = Math.max(need, (-lowest + 0.02) / raised(i / 32));
  }
  hinges.lift = need;
  return hinged;
}

/** Step k's animation (k from 1): straight from the frame before, or through the frames it passes on its way. */
export function stepTransition(model: OrigamiModel, k: number): Transition {
  const frames = framesOf(model);
  const op = model.steps[k - 1].op;
  if (op && copies(op)) return foldedLikeTheFirst(model, k, op);
  if (op?.op === 'assemble' && !op.straight && op.pieces.some((p) => p.pose)) return comingIn(model, k, op);
  const over = tuckedOver(model, k);
  if (over) return transitionVia([frames[k - 1], over, { ...frames[k], faces_parent: sameFaces(over, frames[k]) }]);
  if (!model.steps[k - 1].via?.length) return transitionBetween(frames[k - 1], frames[k]);
  const t = transitionVia([frames[k - 1], ...(model.steps[k - 1].via ?? []), frames[k]]);
  return t.path ? unfoldingBackwards(model, k, t) : t;
}

/**
 * Opening several folds at once (unfolding back to an earlier step) undoes them one at a time, each stretch
 * undoing one step still folded. Each plays that step's own animation backwards, as paper unfolds the way it
 * was folded: a collapse or petal fold opens as neatly as it closed, rather than each piece making its own way.
 */
function unfoldingBackwards(model: OrigamiModel, k: number, t: Transition): Transition {
  const step = model.steps[k - 1];
  if (step.op?.op !== 'unfold' || !t.path) return t;
  const before = model.steps.slice(0, k - 1);
  const to = step.op.to ?? lastFold(before);
  if (to === null) return t;
  // The frames the step passes through, by the step each one is placed like, latest first.
  const skip = reopened(before);
  const passes = [k - 1];
  for (let j = k - 2; j > to; j--) if (!skip.has(j)) passes.push(j);
  passes.push(to);
  if (passes.length !== t.path.parts.length + 1) return t;
  const frames = framesOf(model);
  const parts = t.path.parts.map((part, j) => {
    // Step a, played from its end back to its start: the steps between it and b were opened again already, so
    // the paper lies before step a as it does at b. Each face here is a piece of one of step a's faces.
    const a = passes[j];
    if (a < 1) return part;
    const forward = stepTransition(model, a);
    const ancestors = part.faces.map((_, f) => {
      let i = f;
      for (let kk = k - 1; kk > a; kk--) i = frames[kk].faces_parent?.[i] ?? i;
      return i;
    });
    return ancestors.every((i) => i < forward.faces.length) ? { ...part, backwards: { t: forward, ancestors } } : part;
  });
  return { ...t, path: { ...t.path, parts } };
}

/**
 * For a step that tucks paper into a pocket: the same folds with the paper landing on top of the pocket
 * instead. The step plays through it, folding the point over and then settling it in between the pocket's
 * layers, so the paper it tucks into stays where it is rather than lifting out of the way.
 */
function tuckedOver(model: OrigamiModel, k: number): FoldFrame | null {
  const op = model.steps[k - 1].op;
  if (op?.op !== 'collapse' || !op.under) return null;
  try {
    const { frame } = applyOp({ ...model, steps: model.steps.slice(0, k - 1) }, { ...op, under: undefined });
    return sameFaces(frame, model.steps[k - 1].frame) ? frame : null;
  } catch {
    return null;
  }
}

/** Each of `b`'s faces' index in `a`, matched by their corners on the sheet; undefined unless they're the same faces. */
function sameFaces(a: FoldFrame, b: FoldFrame): number[] | undefined {
  if (a.faces_vertices.length !== b.faces_vertices.length) return undefined;
  const key = (f: FoldFrame, i: number) =>
    f.faces_vertices[i]
      .map((v) => f.vertices_paper[v].map((c) => c.toFixed(6)).join(','))
      .sort()
      .join(' ');
  const at = new Map(a.faces_vertices.map((_, i) => [key(a, i), i]));
  const out = b.faces_vertices.map((_, i) => at.get(key(b, i)));
  return out.every((i) => i !== undefined) ? (out as number[]) : undefined;
}

/** How the paper gets through a list of frames, one after another, as a single step. */
export function transitionVia(frames: FoldFrame[]): Transition {
  if (frames.length <= 2) return transition(frames[0], frames.at(-1)!);
  const parts = frames.slice(1).map((f, j) => transition(frames[j], f));
  const last = frames.at(-1)!;
  // Each final face's ancestor in each frame, following faces_parent back from the end.
  const ancestors: number[][] = parts.map(() => []);
  last.faces_vertices.forEach((_, f) => {
    let a = f;
    for (let j = parts.length - 1; j >= 0; j--) {
      ancestors[j][f] = a;
      a = frames[j + 1].faces_parent?.[a] ?? a;
    }
  });
  // The step as a whole (where each face starts and ends, and which faces move together), from the first frame.
  const whole = transition(frames[0], { ...last, faces_parent: last.faces_vertices.map((_, f) => frames[1].faces_parent?.[ancestors[0][f]] ?? ancestors[0][f]) }, { makeWay: false });
  return { ...whole, path: { parts, ancestors } };
}

/**
 * Each face's corners `s` of the way (0–1) through the step: as each face moves, then with paper that has come
 * apart on the way (a compound fold, faces each going their own way) pulled back together.
 */
export function poseAt(t: Transition, s: number): Vec3[][] {
  const pose = fixedPose(t, s);
  // Resting on the table: lifted to clear it where something would dip below, but no higher. A lift big enough
  // for the deepest dip would otherwise hold the paper up in the air for the rest of the step. All of it moves
  // together, so nothing is pushed up through the paper above it. At the ends of the step too: paper shaped
  // upside down, a plane's wings opened before it's turned over, can reach a little below the table.
  let low = Infinity;
  for (const face of pose) for (const p of face) low = Math.min(low, p[1]);
  return Math.abs(low) > 1e-9 ? pose.map((face) => face.map(([x, y, z]): Vec3 => [x, y - low, z])) : pose;
}

/** Each face's corners `s` of the way through the step, put right (see `poseAt`) but not yet set down on the table. */
function fixedPose(t: Transition, s: number): Vec3[][] {
  const pose = rawPose(t, s);
  // Not at the very start, where the paper is as the step before left it; at the end, with layers held apart.
  const fixes = s > 0 ? fixesFor(t) : null;
  if (!fixes) return pose;
  const x = Math.min(1, s) * JOIN_SAMPLES;
  const i = Math.min(JOIN_SAMPLES - 1, Math.floor(x));
  const w = x - i;
  return pose.map((face, f) => {
    // Each face turned about its middle and moved, as blended between the samples either side: still rigid.
    const [a, b] = [fixes[i][f], fixes[i + 1][f]];
    return applyFix({ q: a.q.clone().slerp(b.q, w), shift: a.shift.clone().lerp(b.shift, w) }, face);
  });
}

/** Each face's corners `s` of the way through the step, as each face moves. */
function rawPose(t: Transition, s: number): Vec3[][] {
  if (s <= 0) return t.faces.map((f) => f.before);
  if (s >= 1) return t.faces.map((f) => f.after);
  if (t.replay) return t.replay(s);
  if (t.backwards) {
    const { t: forward, ancestors } = t.backwards;
    const pose = poseAt(forward, 1 - s);
    return t.faces.map((f, i) => f.paper.map(affine(forward.faces[ancestors[i]].paper, pose[ancestors[i]])));
  }
  if (t.makeWay) return wayMadePose(t, s);
  if (t.path) {
    const { parts, ancestors } = t.path;
    const j = Math.min(parts.length - 1, Math.floor(s * parts.length));
    const pose = rawPose(parts[j], s * parts.length - j);
    // Each face is part of a face of that stretch: place its corners like that face's.
    return t.faces.map((f, i) => {
      const a = ancestors[j][i];
      return f.paper.map(affine(parts[j].faces[a].paper, pose[a]));
    });
  }
  if (t.hinges) return hingedPose(t, s);
  if (t.blend) return blendedPose(t, s);
  return t.faces.map((f, i) => {
    const m = t.motions[f.motion];
    return f.before.map((p) => move(t.grounded?.[i] ? { ...m, lift: 0 } : m, p, landed(t, i, s)));
  });
}

/** Which faces share a corner on the sheet (joined there, so they touch without crossing), worked out once per step. */
const joinedAt = new WeakMap<FaceTrack[], Uint8Array>();
function touching(faces: FaceTrack[], a: number, b: number): boolean {
  let m = joinedAt.get(faces);
  if (!m) {
    const n = faces.length;
    const keys = faces.map((f) => cornerKeys(f.paper));
    m = new Uint8Array(n * n);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if ([...keys[i]].some((k) => keys[j].has(k))) m[i * n + j] = m[j * n + i] = 1;
    joinedAt.set(faces, m);
  }
  return m[a * faces.length + b] === 1;
}

/** Whether two faces move as one through a transition, so they can't pass through each other. Bending paper never does. */
export function together(t: Transition, a: number, b: number): boolean {
  if (t.blend) return false;
  return t.faces[a].motion === t.faces[b].motion && (!t.makeWay || t.makeWay.lifted[a] === t.makeWay.lifted[b]);
}

/** How much paper passes through paper in a transition: crossings deeper than stacking, at a few points. */
function passesThrough(
  t: Transition,
  samples = [0.25, 0.5, 0.75],
  { only, limit = Infinity, pairs }: { only?: (a: number, b: number) => boolean; limit?: number; pairs?: [number, number][] } = {},
): number {
  let count = 0;
  for (const s of samples) {
    if (count > limit) break;
    const pose = rawPose(t, s);
    const boxes = pose.map(box);
    for (let a = 0; a < pose.length; a++) {
      for (let b = a + 1; b < pose.length; b++) {
        if ((only && !only(a, b)) || together(t, a, b) || !overlapping(boxes[a], boxes[b])) continue;
        if (touching(t.faces, a, b)) continue;
        if (crossDepth(pose[a], pose[b]) > 2.5 * LAYER_GAP) {
          count++;
          pairs?.push([a, b]);
        }
      }
    }
  }
  return count;
}

/**
 * Finds how each face hangs from the paper that stays still, crease by crease: a face joined to a placed face
 * along an edge, whose move relative to it is a turn about that edge, hangs from it. Null if no paper stays
 * still (turning the paper over, say), when every face just takes its own motion.
 */
function hingesFor(faces: FaceTrack[], reps: { q: Quaternion; t: Vector3; faces: number[] }[]): Transition['hinges'] | null {
  // Paper that stays still, give or take the gap between layers as the stack is renumbered (every such group:
  // separate pieces of paper can each stay put).
  const still = reps.map((r) => Math.abs(r.q.w) > 1 - 1e-9 && r.t.length() < SLACK);
  const roots = faces.filter((f) => still[f.motion]).length;
  if (!roots) return null;
  const n = faces.length;
  const maps = faces.map((f) => {
    const r = reps[f.motion];
    return new Matrix4().makeRotationFromQuaternion(r.q).setPosition(r.t);
  });
  const inverse = maps.map((m) => m.clone().invert());
  // Faces sharing an edge on the sheet, and where that edge is before the step.
  const joins: { other: number; a: Vec3; b: Vec3 }[][] = faces.map(() => []);
  for (const { i, j, shared } of sharedEdges(faces)) {
    const place = affine(faces[i].paper, faces[i].before);
    const [pa, pb] = shared.map(place);
    joins[i].push({ other: j, a: pa, b: pb });
    joins[j].push({ other: i, a: pa, b: pb });
  }

  const parent = new Array<number>(n).fill(-2);
  const at: Vec3[] = faces.map(() => [0, 0, 0]);
  const dir: Vec3[] = faces.map(() => [0, 0, 0]);
  const angle = new Array<number>(n).fill(0);
  const order: number[] = [];
  const queue: number[] = [];
  faces.forEach((f, i) => {
    if (still[f.motion]) {
      parent[i] = -1;
      order.push(i);
      queue.push(i);
    }
  });
  const pv = new Vector3();
  const qv = new Vector3();
  while (queue.length) {
    const u = queue.shift()!;
    for (const { other: w, a, b } of joins[u]) {
      if (parent[w] !== -2) continue;
      // w's move relative to u, in the paper's position before the step: it must leave the shared edge put.
      const rel = inverse[u].clone().multiply(maps[w]);
      const fixed = [a, b].every((p) => pv.set(...p).applyMatrix4(rel).distanceTo(qv.set(...p)) < SLACK);
      if (!fixed) continue;
      const q = new Quaternion().setFromRotationMatrix(rel);
      if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      let turn = 2 * Math.acos(Math.min(1, q.w));
      const edge = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
      if (turn > 1e-9) {
        const axis = new Vector3(q.x, q.y, q.z).normalize();
        if (axis.dot(edge) < 0) turn = -turn;
        // A half turn can go either way round: the way that brings w down on the side of u it ends up on.
        if (Math.abs(Math.abs(turn) - Math.PI) < 1e-3) {
          const wanted = Math.sign(sideAfter(faces, u, w)) || 1;
          if (Math.sign(sideHalfway(faces, u, w, a, edge, Math.sign(turn))) !== wanted) turn = -turn;
        }
      }
      parent[w] = u;
      at[w] = a;
      dir[w] = [edge.x, edge.y, edge.z];
      angle[w] = turn;
      order.push(w);
      queue.push(w);
    }
  }
  // Paper staying put still slides by the few gaps between layers its stack is renumbered by, as it goes.
  const shift = faces.map((f): Vec3 => (still[f.motion] ? reps[f.motion].t.toArray() as Vec3 : [0, 0, 0]));
  return order.length > roots ? { parent, at, dir, angle, order, lift: 0, shift } : null;
}

/** The cuts in the paper a step's faces were made from (see `moving`): faces meeting along one aren't joined. */
const cutsOf = new WeakMap<FaceTrack[], Cut[]>();

/** Pairs of faces joined along an edge on the sheet, and that edge. */
function sharedEdges(faces: FaceTrack[]): { i: number; j: number; shared: [Vec2, Vec2] }[] {
  const cuts = cutsOf.get(faces);
  const out: { i: number; j: number; shared: [Vec2, Vec2] }[] = [];
  const bounds = faces.map((f) => {
    const us = f.paper.map((p) => p[0]);
    const vs = f.paper.map((p) => p[1]);
    return [Math.min(...us), Math.min(...vs), Math.max(...us), Math.max(...vs)];
  });
  for (let i = 0; i < faces.length; i++) {
    for (let j = i + 1; j < faces.length; j++) {
      const [a, b] = [bounds[i], bounds[j]];
      if (a[2] < b[0] - 1e-9 || b[2] < a[0] - 1e-9 || a[3] < b[1] - 1e-9 || b[3] < a[1] - 1e-9) continue;
      const shared = joinedSegment(faces[i].paper, faces[j].paper, cuts);
      if (shared) out.push({ i, j, shared: shared as [Vec2, Vec2] });
    }
  }
  return out;
}

/** The pieces of paper in a transition: faces joined to each other on the sheet, directly or through others. */
function pieces(faces: FaceTrack[]): number[][] {
  const root = faces.map((_, i) => i);
  const find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i])));
  for (const { i, j } of sharedEdges(faces)) root[find(i)] = find(j);
  const groups = new Map<number, number[]>();
  faces.forEach((_, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(i);
  });
  return [...groups.values()];
}

/** When the other paper is in its way, part of the step plays while the paper making way is up. */
const OPEN = 0.25;
const PLAY: [number, number] = [0.2, 0.75];
const WAY_SAMPLES = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
const CLOSE_SAMPLES = Array.from({ length: 99 }, (_, i) => (i + 1) / 100);
const STAGE_SAMPLES = Array.from({ length: 31 }, (_, i) => (i + 1) / 32);
/** Which way round a half turn goes is judged along the way, and closely as it lands, where layers settle into order. */
const WAY_ROUND_SAMPLES = [0.25, 0.5, 0.75, 0.9, 0.95, 0.98];
/** How far to try lifting paper out of the way, in degrees. */
const TILTS = [10, 20, 35, 50, 70, 90];

/**
 * Paper passing through a separate piece of paper that otherwise stays put (tucking a point under another
 * unit) can instead find that piece lifted out of its way, as you'd lift it with your other hand: the piece
 * tilts up about a line on the table at its far side, the step plays, and it comes back down. Tries tilting
 * each way, as little as works, and keeps it only if less paper passes through paper.
 */
function withWayMade(t: Transition): Transition {
  const crossing: [number, number][] = [];
  const now = passesThrough(t, WAY_SAMPLES, { pairs: crossing });
  if (!now) return t;
  // Pieces that stay put (give or take the gap between layers as the stack is renumbered), with moving paper
  // crossing them.
  const put = t.motions.map((m) => !m.angle && m.shift.length() < SLACK);
  const candidates = pieces(t.faces).filter((piece) => {
    if (piece.some((f) => !put[t.faces[f].motion])) return false;
    const inside = new Set(piece);
    return crossing.some(([a, b]) => inside.has(a) !== inside.has(b) && !put[t.faces[inside.has(a) ? b : a].motion]);
  });
  if (!candidates.length) return t;
  // Each lift is judged by the paper passing through the lifted piece, closely, since a moving point can slip
  // through it in a moment; the smallest lift that does best wins, if it beats not lifting at all.
  let best: Transition | null = null;
  let fewest = Infinity;
  let least = Infinity;
  const roughly = WAY_SAMPLES.map((s) => ({ s, pose: rawPose(t, played(s)) }));
  const closely = CLOSE_SAMPLES.map((s) => ({ s, pose: rawPose(t, played(s)) }));
  for (const piece of candidates) {
    const points = piece.flatMap((f) => t.faces[f].before);
    const bottom = Math.min(...points.map((p) => p[1]));
    const lifted = t.faces.map(() => false);
    for (const f of piece) lifted[f] = true;
    // The rest of the paper moves the same however the piece is lifted: place it once for each moment looked at.
    const throughLifted = (way: NonNullable<Transition['makeWay']>, at: { s: number; pose: Vec3[][] }[], limit: number) => {
      let count = 0;
      for (const { s, pose } of at) {
        if (count > limit) break;
        const placed = tilted(way, s, pose);
        const boxes = placed.map(box);
        for (const a of piece) {
          for (let b = 0; b < placed.length; b++) {
            if (lifted[b] || touching(t.faces, a, b) || !overlapping(boxes[a], boxes[b])) continue;
            if (crossDepth(placed[a], placed[b]) > 2.5 * LAYER_GAP) count++;
          }
        }
      }
      return count;
    };
    const tilt = (d: number, degrees: number): Transition => {
      // Lift the side towards (nx, nz), turning about a line across that direction at the piece's far edge.
      const [nx, nz] = [Math.cos((d * Math.PI) / 4), Math.sin((d * Math.PI) / 4)];
      const far = points.reduce((a, p) => (p[0] * nx + p[2] * nz < a[0] * nx + a[2] * nz ? p : a));
      return { ...t, makeWay: { lifted, pivot: [far[0], bottom, far[2]], axis: [-nz, 0, nx], angle: (degrees * Math.PI) / 180 } };
    };
    // A rough look at every way of lifting it first, then a close one up from the best of those.
    let rough: { d: number; k: number; count: number } | null = null;
    for (let d = 0; d < 8; d++) {
      for (let k = 0; k < TILTS.length; k++) {
        if (rough && !rough.count && k >= rough.k) break;
        const count = throughLifted(tilt(d, TILTS[k]).makeWay!, roughly, rough?.count ?? Infinity);
        if (!rough || count < rough.count || (count === rough.count && k < rough.k)) rough = { d, k, count };
        if (!count) break;
      }
    }
    for (let k = rough!.k; k < TILTS.length; k++) {
      if (TILTS[k] > least && fewest === 0) break;
      const tried = tilt(rough!.d, TILTS[k]);
      const count = throughLifted(tried.makeWay!, closely, fewest);
      if (count < fewest || (count === fewest && TILTS[k] < least)) [best, fewest, least] = [tried, count, TILTS[k]];
      if (!count) break;
    }
  }
  return best && passesThrough(best, WAY_SAMPLES) < now ? best : t;
}

/** A transition with paper making way: the rest plays in the middle, while the lifted paper is up. */
function wayMadePose(t: Transition, s: number): Vec3[][] {
  return tilted(t.makeWay!, s, rawPose({ ...t, makeWay: undefined }, played(s)));
}

/** How far through the rest of the step it is, `s` of the way through, while paper makes way. */
const played = (s: number) => Math.min(1, Math.max(0, (s - PLAY[0]) / (PLAY[1] - PLAY[0])));

/** The pose with the lifted paper tilted up as far as it is `s` of the way through. */
function tilted({ lifted, pivot, axis, angle }: NonNullable<Transition['makeWay']>, s: number, pose: Vec3[][]): Vec3[][] {
  const open = smooth(Math.min(1, s / OPEN, (1 - s) / OPEN));
  if (!open) return pose;
  const m = new Matrix4()
    .makeTranslation(...pivot)
    .multiply(new Matrix4().makeRotationAxis(new Vector3(...axis), angle * open))
    .multiply(new Matrix4().makeTranslation(-pivot[0], -pivot[1], -pivot[2]));
  const p = new Vector3();
  return pose.map((points, f) => (lifted[f] ? points.map((q) => p.set(...q).applyMatrix4(m).toArray() as Vec3) : points));
}

const smooth = (x: number) => x * x * (3 - 2 * x);

/** Which side of u's plane w ends up on (by the gap between stacked layers): positive is u's front. */
function sideAfter(faces: FaceTrack[], u: number, w: number): number {
  const nu = planeNormal(faces[u].after);
  const cu = centroid(faces[u].after);
  const cw = centroid(faces[w].after);
  return nu.dot(new Vector3(cw[0] - cu[0], cw[1] - cu[1], cw[2] - cu[2]));
}

/** Which side of u's plane (before the step) w is on, turned a quarter turn about the edge, `way` round. */
function sideHalfway(faces: FaceTrack[], u: number, w: number, a: Vec3, edge: Vector3, way: number): number {
  const nu = planeNormal(faces[u].before);
  const c = centroid(faces[w].before);
  const p = new Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]).applyAxisAngle(edge, (way * Math.PI) / 2);
  return nu.dot(p);
}

function planeNormal(points: Vec3[]): Vector3 {
  const [a, b, c] = points.map((p) => new Vector3(...p));
  return b.clone().sub(a).cross(c.clone().sub(a)).normalize();
}

function centroid(points: Vec3[]): Vec3 {
  const n = points.length;
  return [points.reduce((s, p) => s + p[0], 0) / n, points.reduce((s, p) => s + p[1], 0) / n, points.reduce((s, p) => s + p[2], 0) / n];
}

/** How far through its own move face `i` is, `s` of the way through the step (see `Transition.landing`). */
const landed = (t: Transition, i: number, s: number) => (t.landing ? Math.min(1, s / t.landing[i]) : s);

/** How much more of the step the top layer may take to land than the bottom one, when landing in order. */
const LANDS = [0.2, 0.4];

/** The same moves, landing bottom layer first: each face finishes earlier the lower it ends up, by up to `spread`. */
function inLandingOrder(t: Transition, spread: number): Transition {
  const heights = t.faces.map((f) => f.after.reduce((s, p) => s + p[1], 0) / f.after.length);
  const order = heights.map((_, i) => i).sort((a, b) => heights[a] - heights[b]);
  const landing = new Array<number>(t.faces.length);
  order.forEach((f, rank) => (landing[f] = 1 - spread * (1 - rank / Math.max(1, order.length - 1))));
  return { ...t, landing };
}

/** Faces placed by hinges, each turning about its crease by its share of the way, carried by its parent. */
/** How much of its landing correction a hinged layer has made `s` of the way through: all of it by halfway. */
const FIX = (s: number) => smooth(Math.min(1, 2 * s));

function hingedPose(t: Transition, s: number): Vec3[][] {
  const h = t.hinges!;
  const placed: Matrix4[] = new Array(t.faces.length);
  const depth: number[] = new Array(t.faces.length).fill(0);
  for (const f of h.order) if (h.parent[f] >= 0) depth[f] = depth[h.parent[f]] + 1;
  const deepest = Math.max(1, ...depth);
  for (const f of h.order) {
    if (h.parent[f] === -1) {
      placed[f] = new Matrix4().makeTranslation(h.shift[f][0] * s, h.shift[f][1] * s, h.shift[f][2] * s);
      continue;
    }
    const [ax, ay, az] = h.at[f];
    const turn = new Matrix4()
      .makeTranslation(ax, ay, az)
      .multiply(new Matrix4().makeRotationAxis(new Vector3(...h.dir[f]), h.angle[f] * stagger(h.stagger ?? 0, depth[f], deepest, landed(t, f, s))))
      .multiply(new Matrix4().makeTranslation(-ax, -ay, -az));
    placed[f] = placed[h.parent[f]].clone().multiply(turn);
  }
  const p = new Vector3();
  const lifted = h.lift * raised(s);
  return t.faces.map((f, i) => {
    if (h.parent[i] === -2) return f.before.map((q) => move(t.motions[f.motion], q, landed(t, i, s)));
    const settle = h.fix ? FIX(landed(t, i, s)) : 0;
    const rise = t.grounded?.[i] ? 0 : lifted;
    return f.before.map((q, c) => {
      p.set(...q).applyMatrix4(placed[i]);
      const d = h.fix?.[i][c];
      return d ? [p.x + d[0] * settle, p.y + rise + d[1] * settle, p.z + d[2] * settle] : [p.x, p.y + rise, p.z];
    });
  });
}

/**
 * A sphere around the paper for step k, for framing the camera: it covers the step from start to end,
 * including mid-fold poses like a sheet lifted to turn over. Step 0 is the paper before the first step.
 */
export function stepBound(model: OrigamiModel, k: number): { center: Vec3; radius: number } {
  const frames = framesOf(model);
  if (k === 0) return sphereAround(frames[0].vertices_coords);
  const t = stepTransition(model, k);
  const points: Vec3[] = [...frames[k - 1].vertices_coords, ...frames[k].vertices_coords];
  for (const s of [0.25, 0.5, 0.75]) for (const face of rawPose(t, s)) points.push(...face);
  return sphereAround(points);
}

const turn = new Quaternion();
const v = new Vector3();

/**
 * How far up paper lifted off the table is, `s` of the way through a step, as a share of its lift: up quickly,
 * held, and down again at the end, as you'd pick the model up. Rising slowly, a dip near the start or end of the
 * step would need the model lifted far higher to clear the table there.
 */
const raised = (s: number) => Math.min(1, 3 * Math.sin(Math.PI * s));

export function move(m: Motion, [x, y, z]: Vec3, s: number): Vec3 {
  v.set(x, y, z);
  if (m.angle) {
    turn.setFromAxisAngle(m.axis, m.angle * s);
    v.sub(m.pivot).applyQuaternion(turn).add(m.pivot);
  }
  v.addScaledVector(m.shift, s);
  v.y += m.lift * raised(s);
  if (m.ease) v.addScaledVector(m.ease, Math.sin(Math.PI * s));
  return [v.x, v.y, v.z];
}

/** Maps points on the unfolded sheet to 3D, for a face whose corners are at `paper` and `world`. */
export function affine(paper: Vec2[], world: Vec3[]): (p: Vec2) => Vec3 {
  const [i, j, k] = spread(paper);
  const [q0, q1, q2] = [paper[i], paper[j], paper[k]];
  const [w0, w1, w2] = [world[i], world[j], world[k]];
  const a = [q1[0] - q0[0], q1[1] - q0[1]];
  const b = [q2[0] - q0[0], q2[1] - q0[1]];
  const det = a[0] * b[1] - a[1] * b[0];
  return ([u, vv]) => {
    const du = u - q0[0];
    const dv = vv - q0[1];
    const alpha = (du * b[1] - dv * b[0]) / det;
    const beta = (a[0] * dv - a[1] * du) / det;
    return [0, 1, 2].map((c) => w0[c] + alpha * (w1[c] - w0[c]) + beta * (w2[c] - w0[c])) as Vec3;
  };
}

/** The three corners of a polygon that make the largest triangle, for numerically stable maths. */
function spread(paper: Vec2[]): [number, number, number] {
  let best: [number, number, number] = [0, 1, 2];
  let bestArea = -1;
  for (let j = 1; j < paper.length; j++) {
    for (let k = j + 1; k < paper.length; k++) {
      const area = Math.abs(
        (paper[j][0] - paper[0][0]) * (paper[k][1] - paper[0][1]) - (paper[j][1] - paper[0][1]) * (paper[k][0] - paper[0][0]),
      );
      if (area > bestArea) [bestArea, best] = [area, [0, j, k]];
    }
  }
  return best;
}

/** The rotation and translation taking a face's corners from `before` to `after`. */
function rigid(paper: Vec2[], before: Vec3[], after: Vec3[]): { q: Quaternion; t: Vector3 } {
  const idx = spread(paper);
  const basis = (pts: Vec3[]) => {
    const [p0, p1, p2] = idx.map((i) => new Vector3(...pts[i]));
    const e1 = p1.clone().sub(p0).normalize();
    const n = e1.clone().cross(p2.clone().sub(p0)).normalize();
    const e2 = n.clone().cross(e1);
    return { m: new Matrix4().makeBasis(e1, e2, n), origin: p0 };
  };
  const b = basis(before);
  const a = basis(after);
  const rotation = a.m.clone().multiply(b.m.clone().transpose());
  const q = new Quaternion().setFromRotationMatrix(rotation);
  if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
  const t = a.origin.clone().sub(b.origin.clone().applyQuaternion(q));
  return { q, t };
}

/**
 * The screw motions for a rotation + translation, which can be played part way: one, or for a half turn, the
 * two ways round.
 */
function screwsFor(q: Quaternion, t: Vector3): Motion[] {
  const angle = 2 * Math.acos(Math.min(1, q.w));
  if (angle < 1e-6) return [{ axis: new Vector3(0, 1, 0), angle: 0, pivot: new Vector3(), shift: t.clone(), lift: 0 }];
  const axis = new Vector3(q.x, q.y, q.z).normalize();
  const screw = (ax: Vector3): Motion => {
    const d = t.dot(ax);
    const perp = t.clone().addScaledVector(ax, -d);
    const pivot = perp.clone().add(ax.clone().cross(perp).multiplyScalar(1 / Math.tan(angle / 2))).multiplyScalar(0.5);
    return { axis: ax, angle, pivot, shift: ax.clone().multiplyScalar(d), lift: 0 };
  };
  return angle > Math.PI - 1e-3 ? [screw(axis), screw(axis.clone().negate())] : [screw(axis)];
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/**
 * How much paper the moves `group` pass through on the way, against the faces moving otherwise: the number
 * of crossings, at a few points along the way, deeper than the gap between stacked layers.
 */
function throughPaper(faces: FaceTrack[], motions: Motion[], group: number[], ignore: boolean[]): number {
  const inGroup = new Set(group);
  let count = 0;
  for (const s of WAY_ROUND_SAMPLES) {
    const pose = faces.map((f) => f.before.map((p) => move({ ...motions[f.motion], lift: 0 }, p, s)));
    const boxes = pose.map(box);
    for (let a = 0; a < faces.length; a++) {
      if (!inGroup.has(faces[a].motion)) continue;
      for (let b = 0; b < faces.length; b++) {
        if (ignore[b] || inGroup.has(faces[b].motion) || !overlapping(boxes[a], boxes[b])) continue;
        if (touching(faces, a, b)) continue;
        if (crossDepth(pose[a], pose[b]) > 2.5 * LAYER_GAP) count++;
      }
    }
  }
  return count;
}

function midHeight(m: Motion, points: Vec3[]): number {
  return points.reduce((sum, p) => sum + move(m, p, 0.5)[1], 0) / points.length;
}

/** For a stack turning about a level crease: away from the crease, across it, by how far its bottom is below the turn. */
function easeFor(m: Motion, points: Vec3[]): Vector3 | undefined {
  if (!m.angle || Math.abs(m.axis.y) > 1e-6) return undefined;
  const below = m.pivot.y - Math.min(...points.map((p) => p[1]));
  if (below < 1e-9) return undefined;
  const c = centroid(points);
  const out = new Vector3(c[0] - m.pivot.x, 0, c[2] - m.pivot.z);
  out.addScaledVector(m.axis, -out.dot(m.axis)).setY(0);
  return out.lengthSq() > 1e-18 ? out.normalize().multiplyScalar(below) : undefined;
}

/**
 * How far to raise the move so it doesn't dip below the table. The lift rises and falls through the move, so a
 * dip early on (a tall shape turning over) needs more of it than one halfway.
 */
function liftFor(m: Motion, points: Vec3[]): number {
  let need = 0;
  for (let i = 1; i < 16; i++) {
    const lowest = Math.min(...points.map((p) => move(m, p, i / 16)[1]));
    if (lowest < -1e-4) need = Math.max(need, -lowest / raised(i / 16));
  }
  return need ? need + 0.02 : 0;
}

/**
 * How far through its own turn a hinged face is, `s` of the way through the step, `depth` hinges out from the
 * paper staying still. Folds of several creases rarely move in step: with `stagger` above 0 the creases
 * nearest the still paper fold first, below 0 the outermost do.
 */
function stagger(amount: number, depth: number, deepest: number, s: number): number {
  if (!amount || deepest <= 1) return s;
  const k = amount > 0 ? (depth - 1) / (deepest - 1) : (deepest - depth) / (deepest - 1);
  const span = 1 - Math.abs(amount);
  const start = k * (1 - span);
  return Math.min(1, Math.max(0, (s - start) / span));
}

// ——— Keeping paper joined ———

/** How far apart (in sheet widths) the same point of paper may come mid-step before it's pulled back together. */
const TEAR = 0.05;
/** Where through a step to look for paper coming apart. */
const TEAR_SAMPLES = [0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9];
/** Gaps left between the same point of paper, for layers of a stack easing round each other. */
const JOIN_SLACK = 0.002;
/** Points through a step at which the pull is worked out, in between which it's blended. */
const JOIN_SAMPLES = 40;
const JOIN_ROUNDS = 30;
/** How many times over the points that couldn't be joined are tried again. */
const FILL_ROUNDS = 4;
/** How far joined-up paper may graze through other paper (a sheet's width is 1), as the crossing tests allow: far less than a tear shows. */
const GRAZE = 0.005;
/** How much more graze is let by, joining paper up, for each sheet width it has come apart beyond a tear. */
const GRAZE_PER_TEAR = 0.2;

/** How a face is moved to join the paper up: turned by `q` about its middle, then moved by `shift`. */
interface JoinFix {
  q: Quaternion;
  shift: Vector3;
}

/** For each sample through the step, how each face is moved to join the paper up; null if it stays joined. */
const joined = new WeakMap<Transition, JoinFix[][] | null>();
function joinFixes(t: Transition): JoinFix[][] | null {
  if (joined.has(t)) return joined.get(t)!;
  let out: JoinFix[][] | null = null;
  const groups = cornerGroups(t.faces);
  if (groups.length && TEAR_SAMPLES.some((s) => apart(rawPose(t, s), groups) > TEAR)) {
    const fixes: JoinFix[][] = [];
    const whole: boolean[] = [];
    const raws: Vec3[][][] = [];
    const allowed: number[] = [];
    let warm: JoinFix[] | null = null;
    for (let i = 0; i <= JOIN_SAMPLES; i++) {
      const raw = rawPose(t, i / JOIN_SAMPLES);
      raws.push(raw);
      // Joined up only as far as it can be without passing paper through paper that the faces moving their own
      // ways kept clear of (a flap stood up before it's squashed, say): torn a little rather than tangled. But a
      // graze shows far less than a tear, so the wider the paper has come apart, the more of a graze is let by.
      allowed.push(Math.max(deepest(t, raw), GRAZE + GRAZE_PER_TEAR * Math.max(0, apart(raw, groups) - TEAR)));
      if (i === 0 || i === JOIN_SAMPLES) {
        fixes.push(raw.map(() => ({ q: new Quaternion(), shift: new Vector3() })));
        whole.push(true);
        continue;
      }
      // Starting from the last sample's fix, as the paper moves on only a little.
      const w = warm;
      // (A copy either way: joining up moves the corners it's given.)
      const start = w ? raw.map((face, f) => applyFix(w[f], face)) : raw.map((face) => face.map((p) => [...p] as Vec3));
      const fitted = joinUp(t.faces, start, groups, raw);
      const fix = fitted.map((face, f) => fixFor(t.faces[f].paper, raw[f], face));
      const part = [1, 0.75, 0.5, 0.25].find((k) => deepest(t, raw.map((face, f) => applyFix(partly(fix[f], k), face))) <= allowed[i]) ?? 0;
      fixes.push(fix.map((x) => partly(x, part)));
      whole.push(part === 1);
      // A join that passes paper through paper has found the paper folded the wrong way round (a face flipped
      // through its neighbour): the next sample starts again from the last one joined up right.
      if (part === 1) warm = fix;
    }
    // Where the paper couldn't be joined up whole: joined again starting from the joins either side blended,
    // or failing that, just those blended, if that keeps it clear.
    // Again while that fixes more, as each point fixed gives the ones beside it a better start.
    for (let more = true, round = 0; more && round < FILL_ROUNDS; round++) {
      more = false;
      for (let i = 1; i < JOIN_SAMPLES; i++) {
        if (whole[i]) continue;
        let a = i - 1;
        while (!whole[a]) a--;
        let b = i + 1;
        while (!whole[b]) b++;
        const w = (i - a) / (b - a);
        const raw = raws[i];
        const blend = fixes[a].map((x, f) => ({ q: x.q.clone().slerp(fixes[b][f].q, w), shift: x.shift.clone().lerp(fixes[b][f].shift, w) }));
        const start = raw.map((face, f) => applyFix(blend[f], face));
        const fitted = joinUp(t.faces, start.map((face) => face.map((p) => [...p] as Vec3)), groups, raw);
        const again = fitted.map((face, f) => fixFor(t.faces[f].paper, raw[f], face));
        const torn = apart(raw.map((face, f) => applyFix(fixes[i][f], face)), groups);
        const fix = [again, blend].find((x) => {
          const pose = raw.map((face, f) => applyFix(x[f], face));
          return deepest(t, pose) <= allowed[i] && apart(pose, groups) < torn;
        });
        if (fix) {
          fixes[i] = fix;
          whole[i] = true;
          more = true;
        }
      }
    }
    out = fixes;
  }
  joined.set(t, out);
  return out;
}

/** A fix made only `k` (0–1) of the way. */
function partly({ q, shift }: JoinFix, k: number): JoinFix {
  return { q: new Quaternion().slerp(q, k), shift: shift.clone().multiplyScalar(k) };
}

/** How deep paper goes through paper, at most, in a pose of a transition's faces: how far it would take to clear it. */
function deepest(t: Transition, pose: Vec3[][]): number {
  const boxes = pose.map(box);
  let most = 0;
  for (let a = 0; a < pose.length; a++) {
    for (let b = a + 1; b < pose.length; b++) {
      if (together(t, a, b) || !overlapping(boxes[a], boxes[b]) || touching(t.faces, a, b)) continue;
      most = Math.max(most, clearanceDepth(pose[a], pose[b]));
    }
  }
  return most;
}

/** A face moved by its fix. */
function applyFix({ q, shift }: JoinFix, face: Vec3[]): Vec3[] {
  const mid = new Vector3(...centroid(face));
  return face.map((p) => new Vector3(...p).sub(mid).applyQuaternion(q).add(mid).add(shift).toArray() as Vec3);
}

/** The turn about its middle and the move taking a face from `from` to `to`, both its shape on the sheet. */
function fixFor(paper: Vec2[], from: Vec3[], to: Vec3[]): JoinFix {
  const { q } = rigid(paper, from, to);
  const shift = new Vector3(...centroid(to)).sub(new Vector3(...centroid(from)));
  return { q, shift };
}

/** The corners (as [face, corner]) that are one point of paper: on an edge two faces are joined along, at the same place on the sheet. */
function cornerGroups(faces: FaceTrack[]): [number, number][][] {
  const start: number[] = [];
  let n = 0;
  for (const f of faces) {
    start.push(n);
    n += f.paper.length;
  }
  const root = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i])));
  const near = (p: Vec2, q: Vec2) => Math.abs(p[0] - q[0]) < 1e-7 && Math.abs(p[1] - q[1]) < 1e-7;
  const along = (p: Vec2, [a, b]: [Vec2, Vec2]) => {
    const d = [b[0] - a[0], b[1] - a[1]];
    const len = Math.hypot(d[0], d[1]);
    const t = ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / (len * len);
    return t > -1e-7 && t < 1 + 1e-7 && Math.abs((p[0] - a[0]) * d[1] - (p[1] - a[1]) * d[0]) / len < 1e-7;
  };
  for (const { i, j, shared } of sharedEdges(faces)) {
    faces[i].paper.forEach((p, a) => {
      if (!along(p, shared)) return;
      const b = faces[j].paper.findIndex((q) => near(p, q));
      if (b >= 0) root[find(start[i] + a)] = find(start[j] + b);
    });
  }
  const groups = new Map<number, [number, number][]>();
  faces.forEach((f, i) =>
    f.paper.forEach((_, c) => {
      const r = find(start[i] + c);
      const g = groups.get(r);
      if (g) g.push([i, c]);
      else groups.set(r, [[i, c]]);
    }),
  );
  return [...groups.values()].filter((g) => g.length > 1);
}

/** How far the furthest corner of a group is from where its group is on average. */
function apart(pose: Vec3[][], groups: [number, number][][]): number {
  let most = 0;
  for (const g of groups) {
    const m = centroid(g.map(([f, c]) => pose[f][c]));
    for (const [f, c] of g) most = Math.max(most, Math.hypot(pose[f][c][0] - m[0], pose[f][c][1] - m[1], pose[f][c][2] - m[2]));
  }
  return most;
}

/**
 * The paper joined up: in turn, each point of paper drawn together to where its corners are on average (within
 * a layer's easing), and each face set rigidly where its corners best fit. Paper that stays where it is through
 * the step (`raw` shows where) stays put, and the moving paper comes to it. Faces end rigid, their corners
 * close to joined.
 */
function joinUp(faces: FaceTrack[], pose: Vec3[][], groups: [number, number][][], raw: Vec3[][]): Vec3[][] {
  const at = (p: Vec3, q: Vec3) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < SAME;
  // Paper where it starts and ends; and of that, paper in place now too (a stage can lift paper out of the way
  // and put it back). Paper lifted like that is held where it is, unless it's joined to paper in place: then it
  // comes back to that.
  const ends = faces.map((f) => f.before.every((p, c) => at(p, f.after[c])));
  const now = faces.map((f, i) => ends[i] && f.before.every((p, c) => at(p, raw[i][c])));
  const besideNow = faces.map(() => false);
  for (const g of groups) if (g.some(([f]) => now[f])) for (const [f] of g) besideNow[f] = true;
  const still = faces.map((_, i) => now[i] || (ends[i] && !besideNow[i]));
  let x = pose.map((face, i) => (still[i] ? raw[i] : face));
  for (let k = 0; k < JOIN_ROUNDS; k++) {
    drawTogether(x, groups, still);
    x = faces.map((f, i) => (still[i] ? raw[i] : fitFace(f.paper, x[i])));
  }
  return x;
}

function drawTogether(pose: Vec3[][], groups: [number, number][][], still: boolean[]) {
  for (const g of groups) {
    const held = g.filter(([f]) => still[f]);
    const m = centroid((held.length ? held : g).map(([f, c]) => pose[f][c]));
    for (const [f, c] of g) {
      if (still[f]) continue;
      const p = pose[f][c];
      const d = Math.hypot(p[0] - m[0], p[1] - m[1], p[2] - m[2]);
      if (d <= JOIN_SLACK) continue;
      const k = JOIN_SLACK / d;
      pose[f][c] = [m[0] + (p[0] - m[0]) * k, m[1] + (p[1] - m[1]) * k, m[2] + (p[2] - m[2]) * k];
    }
  }
}

/** A face's shape on the sheet placed rigidly where it best fits `to`: facing the way `to` does, turned to match it. */
function fitFace(paper: Vec2[], to: Vec3[]): Vec3[] {
  const flat = paper.map(([u, v]) => new Vector3(u, 0, v));
  const target = to.map((p) => new Vector3(...p));
  const nFrom = newell(flat);
  const nTo = newell(target);
  if (nTo.lengthSq() < 1e-12) return to;
  nFrom.normalize();
  nTo.normalize();
  const from0 = new Vector3(...centroid(flat.map((p) => p.toArray())));
  const to0 = new Vector3(...centroid(to));
  const face = new Quaternion().setFromUnitVectors(nFrom, nTo);
  const a = flat.map((p) => p.clone().sub(from0).applyQuaternion(face));
  const b = target.map((p) => p.clone().sub(to0));
  let cross = 0;
  let dot = 0;
  a.forEach((p, i) => {
    cross += nTo.dot(new Vector3().crossVectors(p, b[i]));
    dot += p.dot(b[i]);
  });
  const turn = new Quaternion().setFromAxisAngle(nTo, Math.atan2(cross, dot));
  return a.map((p) => p.applyQuaternion(turn).add(to0).toArray() as Vec3);
}

/** A polygon's normal, scaled by its area (Newell's method), which way round its corners go. */
function newell(pts: Vector3[]): Vector3 {
  const n = new Vector3();
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    n.x += (p.y - q.y) * (p.z + q.z);
    n.y += (p.z - q.z) * (p.x + q.x);
    n.z += (p.x - q.x) * (p.y + q.y);
  });
  return n;
}


// ——— Keeping layers apart ———

/**
 * How the paper is put right through a step: joined up where it came apart, and layers that meet face to face
 * on the way held apart. Null when neither is needed.
 */
const fixed = new WeakMap<Transition, JoinFix[][] | null>();
function fixesFor(t: Transition): JoinFix[][] | null {
  if (fixed.has(t)) return fixed.get(t)!;
  const join = joinFixes(t);
  const poses = Array.from({ length: JOIN_SAMPLES + 1 }, (_, i) => {
    const raw = rawPose(t, i / JOIN_SAMPLES);
    return join ? raw.map((face, f) => applyFix(join[i][f], face)) : raw;
  });
  const apart = apartShifts(t, poses);
  const out =
    join || apart
      ? poses.map((_, i) =>
          t.faces.map((_, f) => {
            const fix = join?.[i][f] ?? { q: new Quaternion(), shift: new Vector3() };
            return apart ? { q: fix.q, shift: fix.shift.clone().add(apart[i][f]) } : fix;
          }),
        )
      : null;
  fixed.set(t, out);
  return out;
}

/** How close (along their normal) overlapping layers lying face to face may come before they're held apart. */
const MEET = LAYER_GAP / 2;
const APART_ROUNDS = 4;
/** The furthest a face is moved to hold it apart from the layers it meets: a few layers' thickness. */
const MAX_APART = 4 * LAYER_GAP;

/**
 * Layers that come to lie face to face while a step plays (a stack's layers swapping order in a reverse fold,
 * say) are drawn flickering through each other. For each sample of the step, how far to move each face to
 * hold such layers half a layer apart, in the order they were last apart in: when they've passed through each
 * other, they swap in a step too small to see. Null if no layers meet.
 */
function apartShifts(t: Transition, poses: Vec3[][][]): Vector3[][] | null {
  // Bending paper is many small triangles, joined at every corner: never layers to hold apart.
  if (t.blend) return null;
  const n = t.faces.length;
  const order = new Map<number, number>();
  let any = false;
  const out = poses.map((start, i) => {
    const shifts = start.map(() => new Vector3());
    // Paper meeting where the step ends is held apart too (walls stood up onto paper that shared their layer
    // lying flat), in the order it came in.
    if (i === 0) return shifts;
    const normals = start.map((face) => newell(face.map((p) => new Vector3(...p))).normalize());
    // A few rounds, as holding two layers apart can push one onto a third.
    for (let round = 0; round < APART_ROUNDS; round++) {
      const pose = start.map((face, f) => face.map((p) => new Vector3(...p).add(shifts[f]).toArray() as Vec3));
      const boxes = pose.map(box);
      let moved = false;
      for (let a = 0; a < n; a++) {
        for (let b = a + 1; b < n; b++) {
          if (!overlapping(boxes[a], boxes[b]) || Math.abs(normals[a].dot(normals[b])) < 0.999) continue;
          const gap = normals[a].dot(new Vector3(...pose[b][0]).sub(new Vector3(...pose[a][0])));
          const key = a * n + b;
          const known = order.get(key);
          if (Math.abs(gap) >= MEET) {
            // Clearly apart: this is their order now.
            if (known !== undefined) order.set(key, Math.sign(gap));
            continue;
          }
          if (!faceToFace(pose[a], pose[b], normals[a])) continue;
          // Meeting: kept in the order they had at the last sample, or as they start out.
          const sign = known ?? (Math.sign(normals[a].dot(new Vector3(...poses[i - 1][b][0]).sub(new Vector3(...poses[i - 1][a][0])))) || 1);
          order.set(key, sign);
          const need = (MEET - sign * gap) / 2;
          shifts[a].addScaledVector(normals[a], -sign * need);
          shifts[b].addScaledVector(normals[a], sign * need);
          any = moved = true;
        }
      }
      // Nudged against a deep stack, layer by layer, a face could add up to a move you'd see.
      for (const v of shifts) if (v.length() > MAX_APART) v.setLength(MAX_APART);
      if (!moved) break;
    }
    return shifts;
  });
  return any ? out : null;
}

/** Whether two faces lying in one plane (with normal `n`) overlap there, rather than lying side by side. */
function faceToFace(a: Vec3[], b: Vec3[], n: Vector3): boolean {
  const e1 = new Vector3(...a[1]).sub(new Vector3(...a[0])).normalize();
  const e2 = n.clone().cross(e1);
  const o = new Vector3(...a[0]);
  const flat = (pts: Vec3[]) =>
    pts.map((p): Vec2 => {
      const d = new Vector3(...p).sub(o);
      return [d.dot(e1), d.dot(e2)];
    });
  return overlapArea(flat(a), flat(b)) > 1e-5;
}
