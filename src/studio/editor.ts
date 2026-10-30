import { clip } from '../fold/cut';
import { placeLike, toFlat, unplaceLike, type FlatFace } from '../fold/fold';
import type { Op } from '../fold/ops';
import { sheetOf } from '../fold/sheets';
import { roundCoord } from '../fold/fold-format';
import { frontUp, lerp } from '../fold/geometry2d';
export { frontUp } from '../fold/geometry2d';
import { onFace } from '../fold/marks';
import { centre, inside, locate, project } from '../fold/select';
import type { Ray } from '../fold/shape';
export { anchorFor, project, smallerSideMoves, topLayers } from '../fold/select';
import type { FoldFrame, Mark, OrigamiModel, Vec2 } from '../fold/types';

/** Helpers for the Studio's fold editor that don't need React. */

/**
 * Folding the rest like sheet `from`: a step copying it onto every other sheet the same size that's still unfolded
 * (one face), each copy where its sheet lies. Null when there's nothing to copy (`from` unfolded, or no such sheets),
 * or the paper isn't flat.
 */
export function foldRest(model: OrigamiModel, from: number): Op | null {
  const frame = model.steps.at(-1)?.frame ?? model.start;
  let faces;
  try {
    faces = toFlat(frame);
  } catch {
    return null;
  }
  const count = model.sheets.map((_, n) => faces.filter((f) => sheetOf(model.sheets, f.paper) === n).length);
  const [w, h] = model.sheets[from]?.size ?? [0, 0];
  if (!(count[from] > 1)) return null;
  const to = model.sheets.flatMap((s, n) => (n !== from && count[n] === 1 && Math.abs(s.size[0] - w) < 1e-9 && Math.abs(s.size[1] - h) < 1e-9 ? [n] : []));
  return to.length ? { op: 'copy', from, to } : null;
}

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

/** Where the paper's scissor cuts are on the table: each cut's stretch along every face it runs past. */
export function cutsOnTable(frame: FoldFrame): [Vec2, Vec2][] {
  if (!frame.cuts?.length) return [];
  const out: [Vec2, Vec2][] = [];
  for (const face of project(frame)) {
    const toTable = placeLike(face);
    for (const [a, b] of frame.cuts) {
      const seg = clip(face.paper, a, b);
      if (seg) out.push([toTable(seg[0]), toTable(seg[1])]);
    }
  }
  return out;
}

/**
 * The tape stuck on a face's upper side, as outlines on the table: drawn just after the face, so the faces above
 * it cover it as they cover the face.
 */
export function tapeOnFace(frame: FoldFrame, face: FlatFace): Vec2[][] {
  if (!frame.tapes?.length) return [];
  const up = frontUp(face.world, face.paper);
  const toTable = placeLike(face);
  return frame.tapes
    .flatMap((t) => t.pieces)
    .filter((m) => (m.side === 'front') === up)
    .flatMap((m) => onFace(m, face.paper).map((part) => part.map(toTable)));
}

/** The frame to unfold back to: the one before the latest fold or collapse made since the last unfold. */
export { lastFold as unfoldTarget } from '../fold/ops';


/** The face seen from above at a point on the table: the top one there. */
export function faceAt(frame: FoldFrame, spot: Vec2) {
  const under = project(frame).filter((f) => inside(f.world, spot));
  return under.length ? under.reduce((a, b) => (b.layer > a.layer ? b : a)) : null;
}

/**
 * A mark drawn through points picked on the table, as a recipe's `draw` makes one: on the paper on top under
 * its first point, on the side facing up, with every point carried onto the sheet by that face. Null off the paper.
 */
export function markAt(frame: FoldFrame, points: Vec2[], fill: boolean): Mark | null {
  const face = points.length ? faceAt(frame, points[0]) : null;
  if (!face) return null;
  // Rounded as .fold files round coordinates, as recipes round what they record.
  const toSheet = unplaceLike(face);
  return { side: frontUp(face.world, face.paper) ? 'front' : 'back', points: points.map((p) => toSheet(p).map(roundCoord) as Vec2), ...(fill && { fill: true }) };
}

/** Where a mark's points are on the table now, or null if any of them isn't on the paper. */
export function markOnTable(frame: FoldFrame, mark: Mark): Vec2[] | null {
  try {
    return mark.points.map((p) => locate(frame, p));
  } catch {
    return null;
  }
}

/**
 * Faces picked by clicking, as outlines on the sheet: clicking the face on top at a spot adds its outline, or
 * takes away the outline that face is already in.
 */
export function toggleFace(frame: FoldFrame, picked: Vec2[][], spot: Vec2): Vec2[][] {
  const face = faceAt(frame, spot);
  if (!face) return picked;
  const c = centre(face.paper);
  const had = picked.filter((poly) => inside(poly, c));
  return had.length ? picked.filter((poly) => !had.includes(poly)) : [...picked, face.paper.map((p) => p.map(roundCoord) as Vec2)];
}

/** Whether a face (by its corners on the sheet) is among the picked outlines, as `inPaper` decides it. */
export function isPicked(picked: Vec2[][], paper: Vec2[]): boolean {
  const c = centre(paper);
  return picked.some((poly) => inside(poly, c));
}

/**
 * Creases for popping a model up from a point (`popUp`), as the fortune teller opens: `count` of them evenly
 * round, the first pointing along `azimuth` and every other one rising by `steep`; those between rise just
 * enough that no paper stretches. Null when no rise for those between would do. Angles in radians.
 */
export function popRays(count: number, azimuth: number, steep: number): Ray[] | null {
  const gap = (2 * Math.PI) / count;
  // Neighbours stay `gap` apart in 3D: a·cos(e) + b·sin(e) = cos(gap).
  const a = Math.cos(steep) * Math.cos(gap);
  const b = Math.sin(steep);
  const gentle = Math.atan2(b, a) - Math.acos(Math.cos(gap) / Math.hypot(a, b));
  if (count % 2 || !Number.isFinite(gentle)) return null;
  return Array.from({ length: count }, (_, k) => ({ azimuth: azimuth + k * gap, elevation: k % 2 ? gentle : steep }));
}

/** The settings `popRays` would make these creases from (starting from either of the first two), if it could. */
export function popSettings(rays: Ray[]): { count: number; azimuth: number; steep: number } | null {
  const turn = (x: number) => Math.abs(Math.atan2(Math.sin(x), Math.cos(x)));
  for (const start of [0, 1]) {
    const first = rays[start];
    const made = first && popRays(rays.length, first.azimuth, first.elevation);
    const same = made?.every((r, k) => {
      const ray = rays[(k + start) % rays.length];
      return turn(r.azimuth - ray.azimuth) < 1e-6 && Math.abs(r.elevation - ray.elevation) < 1e-6;
    });
    if (same) return { count: rays.length, azimuth: first.azimuth, steep: first.elevation };
  }
  return null;
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
