import { joinedAlong } from './geometry2d';
import type { FoldFrame, Vec2, Vec3 } from './types';

/**
 * Pinches: a fold pressed flat only for a short way (at an edge, to mark a point) and opened back up. The paper is
 * split along the whole fold line, as for any crease, but only the pinched part creases: the rest of the line is
 * kept in the frame's `uncreased`, as segments on the sheet, and the face edges along it are drawn without lines.
 * Kept from frame to frame once made, less any stretch a later fold presses: wherever paper either side of it is
 * folded, it's creased from then on.
 */

const TOL = 1e-7;

const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
const dot = (a: Vec2, b: Vec2) => a[0] * b[0] + a[1] * b[1];
const cross = (a: Vec2, b: Vec2) => a[0] * b[1] - a[1] * b[0];
const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const flat = (p: Vec3): Vec2 => [p[0], p[2]];

/** Where along a–b (0 at a, 1 at b) the segment c–d lies, if it lies on the same line: else null. */
function along(a: Vec2, b: Vec2, c: Vec2, d: Vec2, tol = TOL): [number, number] | null {
  const ab = sub(b, a);
  const len = Math.hypot(...ab);
  if (len < TOL) return null;
  if (Math.abs(cross(ab, sub(c, a))) / len > tol || Math.abs(cross(ab, sub(d, a))) / len > tol) return null;
  const t = (p: Vec2) => dot(sub(p, a), ab) / (len * len);
  const [s, e] = [t(c), t(d)];
  return s < e ? [s, e] : [e, s];
}

/** [0, 1] less the given intervals, as the pieces left, ignoring slivers. */
function less(cut: [number, number][], from: [number, number] = [0, 1]): [number, number][] {
  let pieces: [number, number][] = [from];
  for (const [s, e] of cut) {
    pieces = pieces.flatMap(([p, q]): [number, number][] => {
      if (e <= p + 1e-9 || s >= q - 1e-9) return [[p, q]];
      return [
        ...(s > p + 1e-9 ? [[p, s] as [number, number]] : []),
        ...(e < q - 1e-9 ? [[e, q] as [number, number]] : []),
      ];
    });
  }
  return pieces.filter(([p, q]) => q - p > 1e-6);
}

/** The faces' edges, as [face, corner, from, to] on the sheet. */
function edges(frame: FoldFrame) {
  return frame.faces_vertices.flatMap((face, f) =>
    face.map((v, c) => ({ f, c, p: frame.vertices_paper[v], q: frame.vertices_paper[face[(c + 1) % face.length]] })),
  );
}

/** A face's normal in 3D, counter-clockwise on the sheet seen from the front (Newell's method). */
function faceNormal(frame: FoldFrame, f: number): Vec3 {
  const pts = frame.faces_vertices[f].map((v) => frame.vertices_coords[v]);
  const n: Vec3 = [0, 0, 0];
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    n[0] += (p[1] - q[1]) * (p[2] + q[2]);
    n[1] += (p[2] - q[2]) * (p[0] + q[0]);
    n[2] += (p[0] - q[0]) * (p[1] + q[1]);
  });
  const len = Math.hypot(...n) || 1;
  return [n[0] / len, n[1] / len, n[2] / len];
}

/**
 * The creases left by opening `folded` back up to `unfolded` (its faces, placed as an earlier frame has them), when
 * the fold was pinched only between `keep`'s two points on the table, as `folded` lies: the parts of the new creases
 * along that line but outside the pinch, as segments on the sheet. `before` is the paper before the folds, so creases
 * it already had stay creased.
 */
export function unpinched(folded: FoldFrame, unfolded: FoldFrame, before: FoldFrame, keep: [Vec2, Vec2]): [Vec2, Vec2][] {
  const [a, b] = keep;
  const old = edges(before);
  const out: [Vec2, Vec2][] = [];
  const seen = new Set<string>();
  for (const { f, c, p, q } of edges(unfolded)) {
    // Where the edge lay when the paper was folded: the unfolded frame keeps the folded one's faces.
    const face = folded.faces_vertices[f];
    if (!face) continue;
    const wp = flat(folded.vertices_coords[face[c]]);
    const wq = flat(folded.vertices_coords[face[(c + 1) % face.length]]);
    const on = along(a, b, wp, wq, 1e-6);
    if (!on) continue;
    const k = [p, q].map((x) => x.map((n) => n.toFixed(6)).join(',')).sort().join('|');
    if (seen.has(k)) continue;
    seen.add(k);
    // Creased before the folds: it stays so.
    const mid = lerp(p, q, 0.5);
    const creased = old.some((o) => {
      const at = along(o.p, o.q, mid, mid);
      return !!at && at[0] > -1e-9 && at[0] < 1 + 1e-9;
    });
    if (creased) continue;
    // The pinch, as a stretch of this edge: where along it the edge's folded place falls inside a–b.
    const [s, e] = on;
    const span = e - s;
    if (span < 1e-12) continue;
    const sameWay = dot(sub(wq, wp), sub(b, a)) > 0;
    const toEdge = (t: number) => (sameWay ? (t - s) / span : (e - t) / span);
    const kept: [number, number] = [toEdge(0), toEdge(1)].sort((x, y) => x - y) as [number, number];
    for (const [t0, t1] of less([kept])) out.push([lerp(p, q, t0), lerp(p, q, t1)]);
  }
  return merged(out);
}

/**
 * An unfold to frame `to` of `frames` (the model so far) that was pinched between `keep`'s two points on the table
 * as the paper lies now: `unfolded` with the creases the pinch left unpressed added to the paper's.
 */
export function pinchedUnfold(frames: FoldFrame[], to: number, unfolded: FoldFrame, keep: [Vec2, Vec2]): FoldFrame {
  const folded = frames[frames.length - 1];
  const uncreased = merged([...(folded.uncreased ?? []), ...unpinched(folded, unfolded, frames[to], keep)]);
  return uncreased.length ? { ...unfolded, uncreased } : unfolded;
}

/** Joins segments on one line that touch or overlap into one. */
export function merged(segments: [Vec2, Vec2][]): [Vec2, Vec2][] {
  const out: [Vec2, Vec2][] = [];
  const left = [...segments];
  while (left.length) {
    let [p, q] = left.shift()!;
    for (let grew = true; grew; ) {
      grew = false;
      for (let i = 0; i < left.length; i++) {
        const on = along(p, q, ...left[i]);
        if (!on || on[1] < -1e-9 || on[0] > 1 + 1e-9) continue;
        const [s, e] = [Math.min(0, on[0]), Math.max(1, on[1])];
        [p, q] = [lerp(p, q, s), lerp(p, q, e)];
        left.splice(i, 1);
        grew = true;
        break;
      }
    }
    out.push([p, q]);
  }
  return out;
}

/**
 * `segments` less the stretches where `frame` has the paper folded either side of them (faces joined there facing
 * different ways): pressed, so creased from then on.
 */
export function unpressed(segments: [Vec2, Vec2][], frame: FoldFrame): [Vec2, Vec2][] {
  if (!segments.length) return segments;
  const all = edges(frame);
  const normals = new Map<number, Vec3>();
  const normalOf = (f: number) => normals.get(f) ?? normals.set(f, faceNormal(frame, f)).get(f)!;
  return segments.flatMap(([a, b]) => {
    const here = all.map((e) => ({ ...e, on: along(a, b, e.p, e.q) })).filter((e) => e.on && e.on[1] > 1e-9 && e.on[0] < 1 - 1e-9);
    const pressed: [number, number][] = [];
    for (let i = 0; i < here.length; i++) {
      for (let j = i + 1; j < here.length; j++) {
        const [x, y] = [here[i], here[j]];
        if (x.f === y.f) continue;
        const s = Math.max(x.on![0], y.on![0]);
        const e = Math.min(x.on![1], y.on![1]);
        if (e - s < 1e-9) continue;
        const [n, m] = [normalOf(x.f), normalOf(y.f)];
        if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] > 1 - 1e-6) continue;
        if (!joinedAlong(lerp(a, b, s), lerp(a, b, e), frame.cuts)) continue;
        pressed.push([s, e]);
      }
    }
    return less(pressed).map(([s, e]): [Vec2, Vec2] => [lerp(a, b, s), lerp(a, b, e)]);
  });
}

/**
 * For drawing a frame's face edges: the stretches of the edge from p to q on the sheet that are creases or the
 * paper's outline, as fractions along it. All of it, but where it runs along part of an unpressed pinch.
 */
export function drawnParts(frame: FoldFrame): (p: Vec2, q: Vec2) => [number, number][] {
  const segments = frame.uncreased ?? [];
  if (!segments.length) return () => [[0, 1]];
  return (p, q) => {
    const cut = segments.flatMap(([a, b]): [number, number][] => {
      const on = along(p, q, a, b);
      return on ? [on] : [];
    });
    return cut.length ? less(cut) : [[0, 1]];
  };
}
