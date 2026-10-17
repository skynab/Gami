import { toFlat, type FlatFace } from '../fold/fold';
import { flipLine, lerp, sideOf, signedArea, split, type Line, type Piece } from '../fold/geometry2d';
export { frontUp } from '../fold/geometry2d';
import type { FoldFrame, Step, Vec2 } from '../fold/types';

/** Helpers for the Studio's fold editor that don't need React. */

/** Points a fold line can snap to: every corner, plus the middle of every edge. */
export function snapPoints(frame: FoldFrame): Vec2[] {
  const seen = new Map<string, Vec2>();
  const add = (p: Vec2) => seen.set(`${p[0].toFixed(5)},${p[1].toFixed(5)}`, p);
  for (const face of project(frame)) {
    face.world.forEach((p, i) => {
      add(p);
      add(lerp(p, face.world[(i + 1) % face.world.length], 0.5));
    });
  }
  return [...seen.values()];
}

/** The line turned so its smaller side is the one that moves, as most folds bring the smaller part over. */
export function smallerSideMoves(frame: FoldFrame, line: Line): Line {
  let pos = 0;
  let neg = 0;
  for (const face of project(frame)) {
    const parts = split(face, line);
    if (parts.pos) pos += Math.abs(signedArea(parts.pos.world));
    if (parts.neg) neg += Math.abs(signedArea(parts.neg.world));
  }
  return pos > neg ? flipLine(line) : line;
}

/**
 * The frame to unfold back to: the one before the latest fold made since the last unfold.
 * Frame k is the paper after step k, so the frame before step i (0-based) is frame i.
 */
export function unfoldTarget(steps: Step[]): number | null {
  const lastUnfold = steps.findLastIndex((s) => s.kind === 'unfold');
  const lastFold = steps.findLastIndex((s) => s.kind === 'fold');
  return lastFold > lastUnfold ? lastFold : null;
}

/** A square box (x, z, size, size) centred on some points, with room to spare. */
export function viewBox(points: Vec2[], pad = 0.15): [number, number, number, number] {
  const xs = points.map((p) => p[0]);
  const zs = points.map((p) => p[1]);
  const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) + 2 * pad;
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  return [cx - size / 2, cz - size / 2, size, size];
}

/**
 * Faces seen from above, as toFlat gives them, but also for frames lifted into 3D (after a Lift step):
 * those are drawn as their shadow on the table.
 */
export function project(frame: FoldFrame): FlatFace[] {
  return frame.faces_vertices.map((face, f) => ({
    world: face.map((v): Vec2 => [frame.vertices_coords[v][0], frame.vertices_coords[v][2]]),
    paper: face.map((v) => frame.vertices_paper[v]),
    layer: frame.faces_layer?.[f] ?? 0,
    parent: f,
  }));
}

/**
 * A point on the sheet that stays still when folding along `lines` (the first one decides which side): the
 * middle of the biggest piece behind it, once the paper is cut along every line, so it's never on a crease.
 */
export function anchorFor(frame: FoldFrame, lines: Line[]): Vec2 | null {
  let pieces: Piece[] = toFlat(frame);
  for (const l of lines) pieces = pieces.flatMap((f) => [split(f, l).pos, split(f, l).neg].filter((p): p is Piece => p !== null));
  let best: { area: number; at: Vec2 } | null = null;
  for (const p of pieces) {
    if (p.world.some((x) => sideOf(lines[0], x) > 1e-7)) continue;
    const area = Math.abs(signedArea(p.world));
    if (!best || area > best.area) best = { area, at: centre(p.paper) };
  }
  return best?.at ?? null;
}

/**
 * Limits a compound fold to the top N layers on the moving side of `line`, as a test on faces' corners on the
 * sheet. Faces get cut along creases before the test, so it checks whether a piece lies inside a chosen face.
 */
export function topLayers(frame: FoldFrame, line: Line, n: number): (paper: Vec2[]) => boolean {
  const faces = toFlat(frame).filter((f) => f.world.some((x) => sideOf(line, x) > 1e-7));
  const from = Math.max(...faces.map((f) => f.layer)) - n + 1;
  const chosen = faces.filter((f) => f.layer >= from).map((f) => f.paper);
  return (paper) => {
    const c = centre(paper);
    return chosen.some((poly) => inside(poly, c));
  };
}

function centre(poly: Vec2[]): Vec2 {
  return [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];
}

function inside(poly: Vec2[], p: Vec2): boolean {
  const s = Math.sign(signedArea(poly));
  return poly.every((a, i) => {
    const b = poly[(i + 1) % poly.length];
    return s * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) >= -1e-9;
  });
}
