import { fixedPose, type Transition } from '../animate';
import { LAYER_GAP } from '../frames';
import type { FoldFrame, Vec2, Vec3 } from '../types';
import { meshFrame } from './frame';
import { frameKey, remembered } from './memo';
import { topology } from './mesh';
import { solve } from './solver';

/**
 * A fold that bends on the way (docs/clipping-plan.md, part 2, the reverse folds): it ends flat, as folded, but plays
 * through bent paper, so a point turned in between layers doesn't pass through them. Rigid paper can't: the point
 * swings in and lands among layers that stay put on both sides, cutting through about a stack's thickness of them
 * (0.0077 on the crane's neck), where real paper bends the layers either side apart near the corner.
 */
export interface BentWay {
  /** How far from the corner (the crease's still end, where the moving paper turns) paper that stays put may bend. */
  near?: number;
  /** The longest edge of a triangle of bending paper, on the sheet. */
  mesh?: number;
  /** The frames it passes through, each the paper brought to rest along the way (guided, the solver's iterations aren't used). */
  stages?: number;
}

const NEAR = 0.08;
const MESH = 0.06;
const STAGES = 16;
/** How readily creases give, as bendFrame has it. */
const CREASE_COMPLIANCE = 0.1;
/** How readily the paper strays from the way rigid paper goes (see BendProblem.compliance.guide). */
const GUIDE_COMPLIANCE = 1e-2;

/**
 * The frames a fold passes through, bent: `end` (the fold's flat result) meshed, every point guided along the way the
 * paper goes rigidly (`rigid`, the step as it plays now, from the frame before to `end`), with layers kept on the
 * sides `end` stacks them, so where the rigid motion takes paper through paper, the layers near the corner give
 * way, bending apart, instead. The paper that moves bends too, and any that stays put within `near` of the corner.
 * The first frame points each triangle back at the face before the step it comes from; the last is the paper as it
 * lands, close to `end` (within a few layers, where they were held apart), which the step plays to before it rests
 * on `end`.
 */
export function bentWay(end: FoldFrame, rigid: Transition, way: BentWay = {}): FoldFrame[] {
  // The rigid motion's every pose follows from where each face starts and ends.
  const key = `bentWay ${frameKey(end)} ${JSON.stringify(rigid.faces.map((f) => f.before))} ${JSON.stringify(way)}`;
  return remembered(key, () => solveBentWay(end, rigid, way));
}

function solveBentWay(end: FoldFrame, rigid: Transition, way: BentWay): FoldFrame[] {
  const stages = way.stages ?? STAGES;
  const [startPose, endPose] = [fixedPose(rigid, 0), fixedPose(rigid, 1)];
  const moves = rigid.faces.map((_, f) => startPose[f].some((q, j) => dist(q, endPose[f][j]) > 1e-6));
  // The corner: the moving paper's corners that stay put, along the crease.
  const corner: Vec2[] = [];
  rigid.faces.forEach((_, f) => {
    if (moves[f]) startPose[f].forEach((q, j) => dist(q, endPose[f][j]) < 1e-6 && corner.push([q[0], q[2]]));
  });
  const near = way.near ?? NEAR;
  const flex = rigid.faces.flatMap((_, f) => {
    const [x, z] = centre(endPose[f]);
    return moves[f] || corner.some((c) => Math.hypot(c[0] - x, c[1] - z) < near) ? [f] : [];
  });
  const { paper, triangles, parent } = meshFrame(end, flex, way.mesh ?? MESH);

  // Each point placed as its face is, through the step.
  const faceOf = paper.map(() => -1);
  triangles.forEach((t, n) => t.forEach((v) => faceOf[v] < 0 && (faceOf[v] = parent[n])));
  // Not set down on the table, which lifts all the paper while any dips below it, nor picked up off it (as the
  // rigid motion picks the model up to swing the point under it): the step is set down as it plays. Picked up, the
  // paper rises a long way between frames, and the bent triangles' own moves between them, each a screw, part the
  // small ones' corners on the way.
  const still = rigid.faces.findIndex((_, f) => !moves[f]);
  const rigidAt = (s: number): Vec3[] => {
    const pose = fixedPose(rigid, s);
    const raised = still < 0 ? 0 : pose[still][0][1] - startPose[still][0][1];
    const place = rigid.faces.map((f, i) => affine(f.paper, pose[i].map(([x, y, z]): Vec3 => [x, y - raised, z])));
    return paper.map((p, v) => place[faceOf[v]](p));
  };

  // Which side of each triangle each point belongs on: as `end` stacks them (as sidesByLayer in frame.ts has it).
  const endAt = rigidAt(1);
  const layer = end.faces_layer ?? end.faces_vertices.map(() => 0);
  const lo = paper.map(() => Infinity);
  const hi = paper.map(() => -Infinity);
  triangles.forEach((t, n) =>
    t.forEach((v) => {
      lo[v] = Math.min(lo[v], layer[parent[n]]);
      hi[v] = Math.max(hi[v], layer[parent[n]]);
    }),
  );
  const up = triangles.map(([a, b, c]) => {
    const [pa, pb, pc] = [endAt[a], endAt[b], endAt[c]];
    return Math.sign((pb[2] - pa[2]) * (pc[0] - pa[0]) - (pb[0] - pa[0]) * (pc[2] - pa[2]));
  });
  const side = (v: number, n: number) => {
    const at = layer[parent[n]];
    return !up[n] || (lo[v] <= at && hi[v] >= at) ? undefined : up[n] * (lo[v] > at ? 1 : -1);
  };

  // Creases give, seams within faces that stay rigid hold, and seams within faces that bend, bend.
  const flexible = new Set(flex);
  const key = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`);
  const facesAlong = new Map<string, number[]>();
  triangles.forEach((t, n) => {
    for (let e = 0; e < 3; e++) {
      const k = key(t[e], t[(e + 1) % 3]);
      facesAlong.set(k, [...(facesAlong.get(k) ?? []), parent[n]]);
    }
  });
  const hinges: { edge: [number, number]; compliance: number }[] = [];
  const soft: [number, number][] = [];
  for (const { a, b } of topology(triangles).hinges) {
    const [f, g] = facesAlong.get(key(a, b))!;
    const edge: [number, number] = a < b ? [a, b] : [b, a];
    if (f !== g) hinges.push({ edge, compliance: CREASE_COMPLIANCE });
    else {
      soft.push(edge);
      if (!flexible.has(f)) hinges.push({ edge, compliance: 0 });
    }
  }

  const paths = Array.from({ length: stages }, (_, i) => rigidAt((i + 1) / stages));
  const { frames } = solve({
    points: rigidAt(0),
    sheet: paper,
    triangles,
    guides: paper.map((_, v) => ({ ids: [v], weights: [1], path: paths.map((f) => f[v]) })),
    hinges,
    thickness: LAYER_GAP,
    side,
    stages,
    compliance: { guide: GUIDE_COMPLIANCE },
  });
  const from = end.faces_parent;
  return frames.map((coords, k) => ({
    vertices_coords: coords,
    vertices_paper: paper,
    faces_vertices: triangles,
    ...(k === 0 && { faces_parent: parent.map((f) => from?.[f] ?? f) }),
    ...(end.cuts?.length && { cuts: end.cuts }),
    ...(end.tapes?.length && { tapes: end.tapes }),
    ...(soft.length && { soft }),
  }));
}

const dist = (p: Vec3, q: Vec3) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
const centre = (f: Vec3[]): Vec2 => [f.reduce((a, q) => a + q[0], 0) / f.length, f.reduce((a, q) => a + q[2], 0) / f.length];

/** A face's placing: points on the sheet to where they are, through three of its corners as far apart as any. */
function affine(from: Vec2[], to: Vec3[]): (p: Vec2) => Vec3 {
  let best = [0, 1, 2];
  let most = 0;
  for (let a = 0; a < from.length; a++)
    for (let b = a + 1; b < from.length; b++)
      for (let c = b + 1; c < from.length; c++) {
        const s = Math.abs((from[b][0] - from[a][0]) * (from[c][1] - from[a][1]) - (from[b][1] - from[a][1]) * (from[c][0] - from[a][0]));
        if (s > most) [most, best] = [s, [a, b, c]];
      }
  const [A, B, C] = best.map((i) => from[i]);
  const [a, b, c] = best.map((i) => to[i]);
  const det = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
  return (p) => {
    const u = ((p[0] - A[0]) * (C[1] - A[1]) - (p[1] - A[1]) * (C[0] - A[0])) / det;
    const w = ((B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0])) / det;
    return [0, 1, 2].map((i) => a[i] + u * (b[i] - a[i]) + w * (c[i] - a[i])) as Vec3;
  };
}
