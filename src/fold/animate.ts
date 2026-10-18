import { Matrix4, Quaternion, Vector3 } from 'three';
import { box, cornerKeys, crossDepth, overlapping } from './cross3d';
import { facePositions, framesOf, LAYER_GAP, normal, sphereAround } from './frames';
import { overlapArea, sharedSegment } from './geometry2d';
import { applyOp } from './ops';
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
    let deepest = depthThrough(best);
    for (const staged of stagedWays(from, to, t, stages - 1)) {
      const way = staged();
      if (!way) continue;
      const d = depthThrough(way, deepest);
      if (d < deepest) [best, deepest] = [way, d];
      if (!deepest) break;
    }
  }
  return best;
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
  const lift = Math.max(0, ...motions.map((m) => m.lift));
  let out: Transition = { faces, motions: motions.map((m) => ({ ...m, lift })) };
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
    const deep = found.order.some((f) => found.parent[f] >= 0 && found.parent[found.parent[f]] >= 0);
    let hinged: Transition | null = null;
    let fewest = Infinity;
    for (const stagger of deep ? [0, 0.3, 0.5, -0.3] : [0]) {
      const tried = hingedWith(out, { ...found, stagger });
      const count = passesThrough(tried, WAY_SAMPLES);
      if (count < fewest) [hinged, fewest] = [tried, count];
      if (!count) break;
    }
    // Each way of moving has cases the other handles better: keep whichever passes through less paper. When
    // neither passes through any, as a collapse's faces all meeting at a point count as touching, judge by
    // how deep any faces cut through each other, joined or not.
    const plain = passesThrough(out, WAY_SAMPLES);
    if (fewest < plain || (fewest === plain && deepestCut(hinged!) <= deepestCut(out))) return landInOrder(hinged!);
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

/** A transition landing bottom layer first instead, if that passes through less paper as it settles. */
function landInOrder(t: Transition): Transition {
  // Only for paper settling flat: a step ending in 3D (petals opened out, say) has nothing to land.
  if (t.faces.some((f) => Math.abs(normal(f.after)[1]) < 0.999)) return t;
  // Judged by how deep paper goes through, as landing in order trades crossings in time for others.
  let best = t;
  let now = depthThrough(t);
  for (const spread of LANDS) {
    if (!now) break;
    const ordered = inLandingOrder(t, spread);
    const d = depthThrough(ordered, now);
    if (d < now) [best, now] = [ordered, d];
  }
  return best;
}

/** The deepest any two faces moving apart cut through each other, at a few points: faces joined at a corner too. */
function deepestCut(t: Transition): number {
  let deepest = 0;
  for (const s of WAY_SAMPLES) {
    const pose = poseAt(t, s);
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
    const pose = poseAt(t, s);
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

/** Hinged motion for a transition, with how far its paper rises and how its layers settle into place. */
function hingedWith(out: Transition, hinges: NonNullable<Transition['hinges']>): Transition {
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
    const lowest = Math.min(0, ...poseAt(hinged, i / 32).flat().map((p) => p[1]));
    if (lowest < -1e-4) need = Math.max(need, (-lowest + 0.02) / Math.sin((Math.PI * i) / 32));
  }
  hinges.lift = need;
  return hinged;
}

/** Step k's animation (k from 1): straight from the frame before, or through the frames it passes on its way. */
export function stepTransition(model: OrigamiModel, k: number): Transition {
  const frames = framesOf(model);
  const over = tuckedOver(model, k);
  if (over) return transitionVia([frames[k - 1], over, { ...frames[k], faces_parent: sameFaces(over, frames[k]) }]);
  return transitionVia([frames[k - 1], ...(model.steps[k - 1].via ?? []), frames[k]]);
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

/** Each face's corners `s` of the way (0–1) through the step. */
export function poseAt(t: Transition, s: number): Vec3[][] {
  if (s <= 0) return t.faces.map((f) => f.before);
  if (s >= 1) return t.faces.map((f) => f.after);
  if (t.makeWay) return wayMadePose(t, s);
  if (t.path) {
    const { parts, ancestors } = t.path;
    const j = Math.min(parts.length - 1, Math.floor(s * parts.length));
    const pose = poseAt(parts[j], s * parts.length - j);
    // Each face is part of a face of that stretch: place its corners like that face's.
    return t.faces.map((f, i) => {
      const a = ancestors[j][i];
      return f.paper.map(affine(parts[j].faces[a].paper, pose[a]));
    });
  }
  if (t.hinges) return hingedPose(t, s);
  return t.faces.map((f, i) => f.before.map((p) => move(t.motions[f.motion], p, landed(t, i, s))));
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

/** Whether two faces move as one through a transition, so they can't pass through each other. */
export function together(t: Transition, a: number, b: number): boolean {
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
    const pose = poseAt(t, s);
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

/** Pairs of faces joined along an edge on the sheet, and that edge. */
function sharedEdges(faces: FaceTrack[]): { i: number; j: number; shared: [Vec2, Vec2] }[] {
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
      const shared = sharedSegment(faces[i].paper, faces[j].paper);
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
  const roughly = WAY_SAMPLES.map((s) => ({ s, pose: poseAt(t, played(s)) }));
  const closely = CLOSE_SAMPLES.map((s) => ({ s, pose: poseAt(t, played(s)) }));
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
  return tilted(t.makeWay!, s, poseAt({ ...t, makeWay: undefined }, played(s)));
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
  const rise = h.lift * Math.sin(Math.PI * s);
  return t.faces.map((f, i) => {
    if (h.parent[i] === -2) return f.before.map((q) => move(t.motions[f.motion], q, landed(t, i, s)));
    const settle = h.fix ? FIX(landed(t, i, s)) : 0;
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
  for (const s of [0.25, 0.5, 0.75]) for (const face of poseAt(t, s)) points.push(...face);
  return sphereAround(points);
}

const turn = new Quaternion();
const v = new Vector3();

export function move(m: Motion, [x, y, z]: Vec3, s: number): Vec3 {
  v.set(x, y, z);
  if (m.angle) {
    turn.setFromAxisAngle(m.axis, m.angle * s);
    v.sub(m.pivot).applyQuaternion(turn).add(m.pivot);
  }
  v.addScaledVector(m.shift, s);
  v.y += m.lift * Math.sin(Math.PI * s);
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
    if (lowest < -1e-4) need = Math.max(need, -lowest / Math.sin((Math.PI * i) / 16));
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
