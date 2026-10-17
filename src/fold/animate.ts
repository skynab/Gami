import { Matrix4, Quaternion, Vector3 } from 'three';
import { facePositions, framesOf, sphereAround } from './frames';
import type { FoldFrame, OrigamiModel, Vec2, Vec3 } from './types';

/**
 * Animating one step: every face of the new frame moves rigidly from where its paper was in the old frame
 * to where it is now. Faces are never stretched, so the paper keeps its shape mid-fold.
 *
 * Each move is a screw motion: a turn about an axis plus a slide along it. A plain fold is a pure turn
 * about the crease, so faces on either side of a crease stay joined all the way through.
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
  /** How far to raise this group mid-move so it doesn't swing through the table, as when turning the paper over. */
  lift: number;
}

export interface Transition {
  faces: FaceTrack[];
  motions: Motion[];
}

const SAME = 1e-4;

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

  const motions = reps.map((r) => motionFor(r.q, r.t, r.faces.flatMap((f) => faces[f].before)));
  return { faces, motions };
}

/** Each face's corners `s` of the way (0–1) through the step. */
export function poseAt(t: Transition, s: number): Vec3[][] {
  if (s <= 0) return t.faces.map((f) => f.before);
  if (s >= 1) return t.faces.map((f) => f.after);
  return t.faces.map((f) => f.before.map((p) => move(t.motions[f.motion], p, s)));
}

/**
 * A sphere around the paper for each step, for framing the camera: item k covers step k from start to end,
 * including mid-fold poses like a sheet lifted to turn over. Item 0 is the paper before the first step.
 */
export function stepBounds(model: OrigamiModel): { center: Vec3; radius: number }[] {
  const frames = framesOf(model);
  return frames.map((frame, k) => {
    if (k === 0) return sphereAround(frame.vertices_coords);
    const t = transition(frames[k - 1], frame);
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

/** Turns a rotation + translation into a screw motion that can be played part way. */
function motionFor(q: Quaternion, t: Vector3, points: Vec3[]): Motion {
  const angle = 2 * Math.acos(Math.min(1, q.w));
  if (angle < 1e-6) return withLift({ axis: new Vector3(0, 1, 0), angle: 0, pivot: new Vector3(), shift: t.clone(), lift: 0 }, points);

  const axis = new Vector3(q.x, q.y, q.z).normalize();
  const screw = (ax: Vector3): Motion => {
    const d = t.dot(ax);
    const perp = t.clone().addScaledVector(ax, -d);
    const pivot = perp.clone().add(ax.clone().cross(perp).multiplyScalar(1 / Math.tan(angle / 2))).multiplyScalar(0.5);
    return { axis: ax, angle, pivot, shift: ax.clone().multiplyScalar(d), lift: 0 };
  };

  let m = screw(axis);
  // A half turn can go either way round. Paper is lifted to fold it, so take the way that goes up.
  if (angle > Math.PI - 1e-3) {
    const other = screw(axis.clone().negate());
    if (midHeight(other, points) > midHeight(m, points) + 1e-9) m = other;
  }
  return withLift(m, points);
}

function midHeight(m: Motion, points: Vec3[]): number {
  return points.reduce((sum, p) => sum + move(m, p, 0.5)[1], 0) / points.length;
}

/** Raise the move by however far it would otherwise dip below the table. */
function withLift(m: Motion, points: Vec3[]): Motion {
  let lowest = 0;
  for (let i = 1; i < 16; i++) for (const p of points) lowest = Math.min(lowest, move(m, p, i / 16)[1]);
  return lowest < -1e-4 ? { ...m, lift: -lowest + 0.02 } : m;
}
