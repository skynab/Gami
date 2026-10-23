import { move, poseAt, transition, transitionVia, type Motion } from './animate';
import { sharedSegment } from './geometry2d';
import type { FoldFrame, Vec2, Vec3 } from './types';

/**
 * Diagram-style guides for one step: the creases being folded, and arrows showing where the paper goes.
 * Origami diagrams draw valley folds dashed and mountain folds dash-dotted; the viewer does the same.
 */

export interface CreaseGuide {
  a: Vec3;
  b: Vec3;
  /** The moving side ends up on top (valley), or underneath (mountain). Unfolding counts as valley. */
  valley: boolean;
}

export interface ArrowGuide {
  from: Vec3;
  /** Where the point is halfway through, so the arrow follows the real path. */
  via: Vec3;
  to: Vec3;
}

/** A scissor cut the step makes, drawn on the paper where it goes. */
export interface CutGuide {
  a: Vec3;
  b: Vec3;
}

export interface Guides {
  creases: CreaseGuide[];
  arrows: ArrowGuide[];
  cuts: CutGuide[];
}

/** Shortest arrow worth drawing, in sheet widths. */
const MIN_ARROW = 0.05;
/** At most this many arrows, for the parts that move furthest. */
const MAX_ARROWS = 2;

/** `via`: the frames the step passes through on its way, if any (a bend's). */
export function guidesFor(from: FoldFrame, to: FoldFrame, via: FoldFrame[] = []): Guides {
  if (to.soft?.length) return bendGuides(from, to, via);
  const t = transition(from, to);
  const still = (m: Motion) => !m.angle && m.shift.lengthSq() < 1e-12 && !m.lift;

  // Creases: edges between faces that move differently. They stay put while the step plays.
  const creases: CreaseGuide[] = [];
  for (let i = 0; i < t.faces.length; i++) {
    for (let j = i + 1; j < t.faces.length; j++) {
      const fi = t.faces[i];
      const fj = t.faces[j];
      if (fi.motion === fj.motion) continue;
      const shared = sharedSegment(fi.paper, fj.paper);
      if (!shared) continue;
      // The moving side is whichever isn't standing still (either, if both move).
      const [moving, other] = still(t.motions[fi.motion]) ? [j, i] : [i, j];
      const layer = (f: number) => to.faces_layer?.[f] ?? 0;
      const place = placer(fi.paper, fi.before);
      creases.push({ a: place(shared[0]), b: place(shared[1]), valley: layer(moving) >= layer(other) });
    }
  }

  // Arrows: for each part that moves, follow its corner that travels furthest.
  const arrows = t.motions
    .map((m, k) => {
      if (still(m)) return null;
      let best: { from: Vec3; to: Vec3; d: number } | null = null;
      t.faces.forEach((f) => {
        if (f.motion !== k) return;
        f.before.forEach((p, c) => {
          const q = f.after[c];
          const d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
          if (!best || d > best.d) best = { from: p, to: q, d };
        });
      });
      const b = best as { from: Vec3; to: Vec3; d: number } | null;
      return b && b.d > MIN_ARROW ? { from: b.from, via: move(m, b.from, 0.5), to: b.to, d: b.d } : null;
    })
    .filter((a) => a !== null)
    .sort((a, b) => b.d - a.d)
    .slice(0, MAX_ARROWS)
    .map(({ from, via, to }) => ({ from, via, to }));

  // Cuts: those this step adds, placed on a face they cross (on its edge, as cutting splits faces along them).
  const known = new Set((from.cuts ?? []).map((c) => c.map((p) => p.map((x) => x.toFixed(6)).join(',')).join('|')));
  const cuts: CutGuide[] = [];
  for (const c of to.cuts ?? []) {
    if (known.has(c.map((p) => p.map((x) => x.toFixed(6)).join(',')).join('|'))) continue;
    const face = t.faces.find((f) => onBoundary(f.paper, c[0]) && onBoundary(f.paper, c[1]));
    if (face) {
      const place = placer(face.paper, face.before);
      cuts.push({ a: place(c[0]), b: place(c[1]) });
    }
  }

  return { creases: mergeCollinear(creases), arrows, cuts: mergeCollinear(cuts.map((c) => ({ ...c, valley: true }))).map(({ a, b }) => ({ a, b })) };
}

/**
 * Paper that bends has no one crease to draw, nor parts moving as one: an arrow follows the corner that goes
 * furthest, through where it is halfway.
 */
function bendGuides(from: FoldFrame, to: FoldFrame, via: FoldFrame[]): Guides {
  const t = transitionVia([from, ...via, to]);
  const half = poseAt(t, 0.5);
  let best: ArrowGuide & { d: number } = { from: [0, 0, 0], via: [0, 0, 0], to: [0, 0, 0], d: 0 };
  t.faces.forEach((f, i) =>
    f.before.forEach((p, c) => {
      const q = f.after[c];
      const d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
      if (d > best.d) best = { from: p, via: half[i][c], to: q, d };
    }),
  );
  const { d, ...arrow } = best;
  return { creases: [], arrows: d > MIN_ARROW ? [arrow] : [], cuts: [] };
}

/** Whether a point lies on a polygon's outline. */
function onBoundary(poly: Vec2[], p: Vec2): boolean {
  return poly.some((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (Math.abs(cross) > 1e-7 * Math.max(1, len)) return false;
    const t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (len * len);
    return t > -1e-7 && t < 1 + 1e-7;
  });
}

/** Maps sheet points onto a face's position in 3D, from its corners on the sheet and in space. */
function placer(paper: Vec2[], world: Vec3[]): (p: Vec2) => Vec3 {
  let best = [0, 1, 2];
  let area = -1;
  for (let j = 1; j < paper.length; j++) {
    for (let k = j + 1; k < paper.length; k++) {
      const s = Math.abs((paper[j][0] - paper[0][0]) * (paper[k][1] - paper[0][1]) - (paper[j][1] - paper[0][1]) * (paper[k][0] - paper[0][0]));
      if (s > area) [area, best] = [s, [0, j, k]];
    }
  }
  const [q0, q1, q2] = best.map((i) => paper[i]);
  const [w0, w1, w2] = best.map((i) => world[i]);
  const a = [q1[0] - q0[0], q1[1] - q0[1]];
  const b = [q2[0] - q0[0], q2[1] - q0[1]];
  const det = a[0] * b[1] - a[1] * b[0];
  return ([u, v]) => {
    const du = u - q0[0];
    const dv = v - q0[1];
    const alpha = (du * b[1] - dv * b[0]) / det;
    const beta = (a[0] * dv - a[1] * du) / det;
    return [0, 1, 2].map((c) => w0[c] + alpha * (w1[c] - w0[c]) + beta * (w2[c] - w0[c])) as Vec3;
  };
}

/** Stacked layers fold along the same line; draw each line once. */
function mergeCollinear(creases: CreaseGuide[]): CreaseGuide[] {
  const out: CreaseGuide[] = [];
  const key = (p: Vec3) => `${p[0].toFixed(3)},${p[2].toFixed(3)}`;
  const seen = new Set<string>();
  for (const c of creases) {
    const k = [key(c.a), key(c.b)].sort().join('|');
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}
