import { Matrix4, Quaternion, Vector3 } from 'three';
import { box, cornerKeys, crossDepth, overlapping } from './cross3d';
import { facePositions, framesOf, LAYER_GAP, sphereAround } from './frames';
import { sharedSegment } from './geometry2d';
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
 * rather than one part rising through the rest.
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
   * anything (-2) use their own motion. `order` lists faces parents first.
   */
  hinges?: { parent: number[]; at: Vec3[]; dir: Vec3[]; angle: number[]; order: number[]; lift: number };
}

const SAME = 1e-4;
/** How far stacked faces can shift as their layers are renumbered (a few gaps between layers). */
const SLACK = 20 * LAYER_GAP;

/** How the paper gets from `from` to `to`. */
export function transition(from: FoldFrame, to: FoldFrame): Transition {
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
  // between layers) go the same way round and rise as high, so they never pass through each other.
  const classes: number[][] = [];
  reps.forEach((r, i) => {
    const c = classes.find((c) => Math.abs(reps[c[0]].q.dot(r.q)) > 1 - SAME);
    if (c) c.push(i);
    else classes.push([i]);
  });
  const motions: Motion[] = new Array(reps.length);
  const choices: { c: number[]; options: Motion[][] }[] = [];
  for (const c of classes) {
    const points = c.map((i) => reps[i].faces.flatMap((f) => faces[f].before));
    const options = c.map((i) => screwsFor(reps[i].q, reps[i].t));
    // A half turn can go either way round: by default the way that lifts the paper most, for all of them.
    const way = options[0].length > 1 && sum(options.map((o, k) => midHeight(o[1], points[k]))) > sum(options.map((o, k) => midHeight(o[0], points[k]))) + 1e-9 ? 1 : 0;
    c.forEach((i, k) => (motions[i] = options[k][way]));
    if (options[0].length > 1) choices.push({ c, options });
  }
  // But going the other way is better if it passes through less paper, as when folding a layer behind.
  if (choices.length) {
    const keys = faces.map((f) => cornerKeys(f.paper));
    for (const { c, options } of choices) {
      const now = throughPaper(faces, motions, c, keys);
      if (!now) continue;
      const other = motions.slice();
      c.forEach((i, k) => (other[i] = options[k].find((m) => m !== motions[i])!));
      if (throughPaper(faces, other, c, keys) < now) c.forEach((i) => (motions[i] = other[i]));
    }
  }
  motions.forEach((m, i) => (motions[i] = { ...m, lift: liftFor(m, reps[i].faces.flatMap((f) => faces[f].before)) }));
  // Paper that would dip below the table (folding something behind) lifts it, and the rest of the paper with
  // it, as you'd pick the model up: lifting only the moving part would push it up through the layers above.
  const lift = Math.max(0, ...motions.map((m) => m.lift));
  const out: Transition = { faces, motions: motions.map((m) => ({ ...m, lift })) };
  const hinges = hingesFor(faces, reps);
  if (hinges) {
    const hinged: Transition = { ...out, hinges };
    // Hinged paper takes its own path, so it needs its own lift to keep it off the table.
    // The lift rises and falls through the step, so a dip early on needs more of it than one halfway.
    let need = 0;
    for (let i = 1; i < 32; i++) {
      const lowest = Math.min(0, ...poseAt(hinged, i / 32).flat().map((p) => p[1]));
      if (lowest < -1e-4) need = Math.max(need, (-lowest + 0.02) / Math.sin((Math.PI * i) / 32));
    }
    hinges.lift = need;
    // Each way of moving has cases the other handles better: keep whichever passes through less paper.
    const keys = faces.map((f) => cornerKeys(f.paper));
    if (passesThrough(hinged, keys) < passesThrough(out, keys)) return hinged;
  }
  return out;
}

/** Step k's animation (k from 1): straight from the frame before, or through the frames it passes on its way. */
export function stepTransition(model: OrigamiModel, k: number): Transition {
  const frames = framesOf(model);
  return transitionVia([frames[k - 1], ...(model.steps[k - 1].via ?? []), frames[k]]);
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
  const whole = transition(frames[0], { ...last, faces_parent: last.faces_vertices.map((_, f) => frames[1].faces_parent?.[ancestors[0][f]] ?? ancestors[0][f]) });
  return { ...whole, path: { parts, ancestors } };
}

/** Each face's corners `s` of the way (0–1) through the step. */
export function poseAt(t: Transition, s: number): Vec3[][] {
  if (s <= 0) return t.faces.map((f) => f.before);
  if (s >= 1) return t.faces.map((f) => f.after);
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
  return t.faces.map((f) => f.before.map((p) => move(t.motions[f.motion], p, s)));
}

/** How much paper passes through paper in a transition: crossings deeper than stacking, at a few points. */
function passesThrough(t: Transition, keys: Set<string>[]): number {
  let count = 0;
  for (const s of [0.25, 0.5, 0.75]) {
    const pose = poseAt(t, s);
    const boxes = pose.map(box);
    for (let a = 0; a < pose.length; a++) {
      for (let b = a + 1; b < pose.length; b++) {
        if (t.faces[a].motion === t.faces[b].motion || !overlapping(boxes[a], boxes[b])) continue;
        if ([...keys[a]].some((k) => keys[b].has(k))) continue;
        if (crossDepth(pose[a], pose[b]) > 2.5 * LAYER_GAP) count++;
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
  // Paper that stays still, give or take the gap between layers as the stack is renumbered: the biggest such group.
  let still = -1;
  reps.forEach((r, i) => {
    if (Math.abs(r.q.w) > 1 - 1e-9 && r.t.length() < SLACK && (still < 0 || r.faces.length > reps[still].faces.length)) still = i;
  });
  if (still < 0) return null;
  const n = faces.length;
  const maps = faces.map((f) => {
    const r = reps[f.motion];
    return new Matrix4().makeRotationFromQuaternion(r.q).setPosition(r.t);
  });
  const inverse = maps.map((m) => m.clone().invert());
  // Faces sharing an edge on the sheet, and where that edge is before the step.
  const joins: { other: number; a: Vec3; b: Vec3 }[][] = faces.map(() => []);
  const bounds = faces.map((f) => {
    const us = f.paper.map((p) => p[0]);
    const vs = f.paper.map((p) => p[1]);
    return [Math.min(...us), Math.min(...vs), Math.max(...us), Math.max(...vs)];
  });
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const [a, b] = [bounds[i], bounds[j]];
      if (a[2] < b[0] - 1e-9 || b[2] < a[0] - 1e-9 || a[3] < b[1] - 1e-9 || b[3] < a[1] - 1e-9) continue;
      const shared = sharedSegment(faces[i].paper, faces[j].paper);
      if (!shared) continue;
      const place = affine(faces[i].paper, faces[i].before);
      const [pa, pb] = shared.map(place);
      joins[i].push({ other: j, a: pa, b: pb });
      joins[j].push({ other: i, a: pa, b: pb });
    }
  }

  const parent = new Array<number>(n).fill(-2);
  const at: Vec3[] = faces.map(() => [0, 0, 0]);
  const dir: Vec3[] = faces.map(() => [0, 0, 0]);
  const angle = new Array<number>(n).fill(0);
  const order: number[] = [];
  const queue: number[] = [];
  faces.forEach((f, i) => {
    if (f.motion === still) {
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
  return order.length > reps[still].faces.length ? { parent, at, dir, angle, order, lift: 0 } : null;
}

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

/** Faces placed by hinges, each turning about its crease by its share of the way, carried by its parent. */
function hingedPose(t: Transition, s: number): Vec3[][] {
  const h = t.hinges!;
  const placed: Matrix4[] = new Array(t.faces.length);
  for (const f of h.order) {
    if (h.parent[f] === -1) {
      placed[f] = new Matrix4();
      continue;
    }
    const [ax, ay, az] = h.at[f];
    const turn = new Matrix4()
      .makeTranslation(ax, ay, az)
      .multiply(new Matrix4().makeRotationAxis(new Vector3(...h.dir[f]), h.angle[f] * s))
      .multiply(new Matrix4().makeTranslation(-ax, -ay, -az));
    placed[f] = placed[h.parent[f]].clone().multiply(turn);
  }
  const p = new Vector3();
  const rise = h.lift * Math.sin(Math.PI * s);
  return t.faces.map((f, i) => {
    if (h.parent[i] === -2) return f.before.map((q) => move(t.motions[f.motion], q, s));
    return f.before.map((q) => {
      p.set(...q).applyMatrix4(placed[i]);
      return [p.x, p.y + rise, p.z];
    });
  });
}

/**
 * A sphere around the paper for each step, for framing the camera: item k covers step k from start to end,
 * including mid-fold poses like a sheet lifted to turn over. Item 0 is the paper before the first step.
 */
export function stepBounds(model: OrigamiModel): { center: Vec3; radius: number }[] {
  const frames = framesOf(model);
  return frames.map((frame, k) => {
    if (k === 0) return sphereAround(frame.vertices_coords);
    const t = stepTransition(model, k);
    const points: Vec3[] = [...frames[k - 1].vertices_coords, ...frame.vertices_coords];
    for (const s of [0.25, 0.5, 0.75]) for (const face of poseAt(t, s)) points.push(...face);
    return sphereAround(points);
  });
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
  return [v.x, v.y, v.z];
}

/** Maps points on the unfolded sheet to 3D, for a face whose corners are at `paper` and `world`. */
function affine(paper: Vec2[], world: Vec3[]): (p: Vec2) => Vec3 {
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
function throughPaper(faces: FaceTrack[], motions: Motion[], group: number[], keys: Set<string>[]): number {
  const inGroup = new Set(group);
  let count = 0;
  for (const s of [0.25, 0.5, 0.75]) {
    const pose = faces.map((f) => f.before.map((p) => move({ ...motions[f.motion], lift: 0 }, p, s)));
    const boxes = pose.map(box);
    for (let a = 0; a < faces.length; a++) {
      if (!inGroup.has(faces[a].motion)) continue;
      for (let b = 0; b < faces.length; b++) {
        if (inGroup.has(faces[b].motion) || !overlapping(boxes[a], boxes[b])) continue;
        if ([...keys[a]].some((k) => keys[b].has(k))) continue;
        if (crossDepth(pose[a], pose[b]) > 2.5 * LAYER_GAP) count++;
      }
    }
  }
  return count;
}

function midHeight(m: Motion, points: Vec3[]): number {
  return points.reduce((sum, p) => sum + move(m, p, 0.5)[1], 0) / points.length;
}

/** How far to raise the move so it doesn't dip below the table. */
function liftFor(m: Motion, points: Vec3[]): number {
  let lowest = 0;
  for (let i = 1; i < 16; i++) for (const p of points) lowest = Math.min(lowest, move(m, p, i / 16)[1]);
  return lowest < -1e-4 ? -lowest + 0.02 : 0;
}
