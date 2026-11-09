import { placeLike, toFlat } from '../../fold/fold';
import { facePositions } from '../../fold/frames';
import { signedArea } from '../../fold/geometry2d';
import type { BendGoal } from '../../fold/ops';
import { locate } from '../../fold/select';
import type { FoldFrame, Vec2, Vec3 } from '../../fold/types';

/**
 * The flat boat opened out and stood on its keel, worked out face by face, as guides for the boat's last step (see
 * docs/bending-plan.md, step 7, the boat).
 *
 * Flat, the boat lies on its side. Its keel runs between the small diamond's side corners, (±¼, ±¼) on the sheet. The
 * sail's tip (the sheet's middle) and the gunwales' middles (0, ±½) are ¼ above the keel, and the bow and stern
 * points (the hat's corners) are at that height, ½ along it either way. From the front: P's wall (the quarter v < 0,
 * between its gunwale and the keel), the sails (the quarters' triangles past the keel), the corner flaps folded in
 * between them, and S's wall at the back. The brims lie on the walls' outsides.
 *
 * Opening it, each wall's middle triangle (from the keel up to the gunwale's middle) leans out by `LEAN` about the
 * keel. Each end triangle (the keel's end, the gunwale's middle and the bow point) turns with it, then about the
 * crease it shares with the middle until its point is back in the middle plane, where P's and S's meet (at 30°, 0.481
 * along and 0.267 up, every length kept). The sails and the flaps' triangles past the keel stay in the middle plane.
 * The flaps' lower triangles (the keel's end, the sail's tip and the bow point) can't: their raw edge is half the
 * sheet wide, 4% longer than the sail's tip is from the bow point by then. So each folds a little along the line from
 * the keel's end to its raw edge's middle: its bow half lies against its wall's end, and its other half spans from
 * there to the sail's tip, the paper bending (only these triangles bend; the rest stays rigid). The brims go with the
 * faces they lie on. All the while the boat stands up about its keel, a quarter turn, and swings round to lie along
 * the table's x.
 */

/** How far each wall leans out from the middle plane, finished. */
export const LEAN = (30 * Math.PI) / 180;
/** The frames the boat opens through. */
export const STAGES = 12;
/** Guide points on the sheet: a triangular lattice this far apart, kept this far inside each face. */
const SPACING = 0.05;
const MARGIN = 0.008;

type V = Vec3;
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V): V => mul(a, 1 / (Math.hypot(...a) || 1));
const round6 = (x: number) => Math.round(x * 1e6) / 1e6 || 0;
const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** p turned by `angle` about the axis through a along the unit vector k. */
function turn(p: V, a: V, k: V, angle: number): V {
  const v = sub(p, a);
  const [c, s] = [Math.cos(angle), Math.sin(angle)];
  return add(a, add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c))));
}

// In the boat's own frame, (along the keel towards the bow, up towards the sail, out towards P's wall), with the
// middle of the keel at 0. Worked out for P's bow end; the stern mirrors it along the keel, S's wall across the
// middle plane.
const KEEL_END: V = [0.25, 0, 0];
const KEEL: V = [1, 0, 0];
/** The gunwale's middle, with the wall leaning out by φ. */
const gunwaleMiddle = (phi: number): V => [0, 0.25 * Math.cos(phi), 0.25 * Math.sin(phi)];

/** How far the end triangle turns about its crease with the wall's middle, so its point stays in the middle plane. */
function endTurn(phi: number): number {
  const g = gunwaleMiddle(phi);
  const axis = unit(sub(g, KEEL_END));
  const point: V = [0.5, g[1], g[2]];
  const out = (angle: number) => turn(point, KEEL_END, axis, angle)[2];
  // The point drops towards the middle plane as the turn grows from 0, whichever way that is.
  const way = out(0.01) < out(0) ? 1 : -1;
  let [lo, hi] = [0, Math.PI / 2];
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (out(way * mid) > 0) lo = mid;
    else hi = mid;
  }
  return way * lo;
}

const wall = (p: V, phi: number) => turn(p, [0, 0, 0], KEEL, phi);
const end = (p: V, phi: number) => turn(wall(p, phi), KEEL_END, unit(sub(gunwaleMiddle(phi), KEEL_END)), endTurn(phi));

/**
 * A flap's lower triangle (the keel's end at (¼, 0), the sail's tip at (0, ¼), the bow point at (½, ¼), flat): past
 * the line from the keel's end to its raw edge's middle M (along = ¼) it lies against the wall's end; short of it,
 * it spans from that line to the sail's tip.
 */
function flap(p: V, phi: number): V {
  if (p[0] >= 0.25) return end(p, phi);
  const [keelEnd, middle, tip]: V[] = [[0.25, 0, p[2]], end([0.25, 0.25, p[2]], phi), [0, 0.25, p[2]]];
  const wTip = (0.25 - p[0]) / 0.25;
  const wMiddle = p[1] / 0.25 - wTip;
  return add(add(mul(keelEnd, 1 - wTip - wMiddle), mul(middle, wMiddle)), mul(tip, wTip));
}

type Part = 'sail' | 'wall' | 'end' | 'flap';

/**
 * Which part of the boat paper goes with (by a face's centre on the sheet), and on which side: 1 for P's wall
 * (v < 0), −1 for S's. A brim's middle piece lies on its wall's middle triangle, its long piece on its wall's end, and
 * its corner, folded round the stem, on the other wall's end.
 */
function partOf([u, v]: Vec2): { part: Part; side: number } {
  const [au, av] = [Math.abs(u), Math.abs(v)];
  const side = v < 0 ? 1 : -1;
  if (av > 0.5) {
    if (au < av - 0.5) return { part: 'wall', side };
    if (au + av < 1) return { part: 'end', side };
    return { part: 'end', side: -side };
  }
  if (au < av) {
    if (av < 0.25) return { part: 'sail', side };
    return { part: au + av < 0.5 ? 'wall' : 'end', side };
  }
  return { part: au + av < 0.5 ? 'sail' : 'flap', side };
}

/** The paper that bends as the boat opens: the flaps' lower triangles. */
export const bendsOpening = (centre: Vec2) => partOf(centre).part === 'flap';

/** Where a point of the flat boat (in the boat's frame) goes with the walls leaning out by φ. */
function opened({ part, side }: { part: Part; side: number }, [k, up, n]: V, phi: number): V {
  const [mk, mn] = [k < 0 ? -1 : 1, side];
  const p: V = [k * mk, up, n * mn];
  const q = part === 'wall' ? wall(p, phi) : part === 'end' ? end(p, phi) : part === 'flap' ? flap(p, phi) : p;
  return [q[0] * mk, q[1], q[2] * mn];
}

/**
 * Guides taking the flat boat open and standing it up on its keel: points spread over every face, each with where it
 * is at each stage.
 */
export function openingGuides(frame: FoldFrame, stages = STAGES): BendGoal[] {
  const faces = toFlat(frame);
  const heights = facePositions(frame).map((points) => points.reduce((sum, q) => sum + q[1], 0) / points.length);
  const [s1, s2, tip] = ([[-0.25, -0.25], [0.25, -0.25], [0, 0]] as Vec2[]).map((q) => locate(frame, q));
  const origin: V = [(s1[0] + s2[0]) / 2, (Math.max(...heights) + Math.min(...heights)) / 2, (s1[1] + s2[1]) / 2];
  const along = unit([s1[0] - s2[0], 0, s1[1] - s2[1]]);
  const up = unit([tip[0] - origin[0], 0, tip[1] - origin[2]]);
  const out = cross(along, up);
  if (out[1] < 0.99) throw new Error('The flat boat should lie with P’s wall on top.');
  const local = (p: V): V => [dot(sub(p, origin), along), dot(sub(p, origin), up), dot(sub(p, origin), out)];
  const world = ([k, u, n]: V): V => add(origin, add(add(mul(along, k), mul(up, u)), mul(out, n)));
  // Turned as it stands up, so its keel ends along the table's x (the way nearer to its bow), and the side view
  // shows it side on.
  const VERTICAL: V = [0, 1, 0];
  let yaw = Math.atan2(along[2], along[0]);
  if (turn(along, [0, 0, 0], VERTICAL, yaw)[0] < 0.99) yaw = -yaw;

  return faces.flatMap((face, f) => {
    const centre: Vec2 = [face.paper.reduce((s, q) => s + q[0], 0) / face.paper.length, face.paper.reduce((s, q) => s + q[1], 0) / face.paper.length];
    const part = partOf(centre);
    const place = placeLike(face);
    return lattice(face.paper).map((q): BendGoal => {
      const [x, z] = place(q);
      const start = local([x, heights[f], z]);
      const path = Array.from({ length: stages }, (_, i): V => {
        const s = smooth((i + 1) / stages);
        const stood = turn(opened(part, start, LEAN * s), [0, 0, 0], KEEL, (Math.PI / 2) * s);
        return turn(world(stood), origin, VERTICAL, yaw * s).map(round6) as V;
      });
      return { guide: { paper: q.map(round6) as Vec2 }, path };
    });
  });
}

/** Points of a triangular lattice on the sheet inside a convex face, all at least `MARGIN` in from its edges. */
function lattice(poly: Vec2[]): Vec2[] {
  const turnWay = Math.sign(signedArea(poly));
  const within = (q: Vec2) =>
    poly.every((a, i) => {
      const b = poly[(i + 1) % poly.length];
      return (turnWay * ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]))) / Math.hypot(b[0] - a[0], b[1] - a[1]) >= MARGIN;
    });
  const us = poly.map((q) => q[0]);
  const vs = poly.map((q) => q[1]);
  const row = SPACING * (Math.sqrt(3) / 2);
  const out: Vec2[] = [];
  for (let j = Math.floor(Math.min(...vs) / row); j <= Math.ceil(Math.max(...vs) / row); j++)
    for (let i = Math.floor(Math.min(...us) / SPACING) - 1; i <= Math.ceil(Math.max(...us) / SPACING); i++) {
      const q: Vec2 = [(i + (Math.abs(j) % 2) / 2) * SPACING, j * row];
      if (within(q)) out.push(q);
    }
  return out;
}
