import { poseAt, stepTransition } from '../animate';
import { crossingAt } from '../collisions';
import { toFoldFile } from '../fold-format';
import type { OrigamiModel, Vec2, Vec3 } from '../types';
import { BEND_SAMPLES } from '../validate';

/**
 * What a bent step does, to look at when it's wrong (see docs/bending-plan.md): how far its paper stretches, in
 * its frames and as it plays between them; how far any triangle turns from one frame to the next (paper that
 * snaps through, rather than following, turns a long way at once); how far the paper falls behind its guides,
 * stage by stage; how deep paper goes through paper as it plays; and how much of the file the step takes. Each
 * says where, as a point on the sheet.
 */
export interface BendReport {
  step: number;
  triangles: number;
  frames: number;
  /** The most any edge stretches in the step's frames: which frame (from 0), and the edge's middle on the sheet. */
  still: { strain: number; frame: number; at: Vec2 };
  /** The same while it plays, and when (0 to 1 through the step). */
  playing: { strain: number; time: number; at: Vec2 };
  /**
   * The most a triangle turns between one frame and the next, in degrees, between which (from 0), and its middle on
   * the sheet; and how many times a triangle turns more than 45° or 90° from one frame to the next.
   */
  turns: { degrees: number; frames: [number, number]; at: Vec2; over45: number; over90: number };
  /**
   * For a guided bend, how far the paper is from where its guides take it at each stage it has a place for them
   * (the paths' entries), the most at each and where the most of all is. A bend set down on the table after (free,
   * or blown up) is compared with its heights matched on average.
   */
  guides?: { stages: { stage: number; lag: number }[]; lag: number; stage: number; at: Vec2 };
  /** The deepest paper goes through paper as it plays, when, and the middles of the two triangles on the sheet. */
  crossing: { depth: number; time: number; at?: [Vec2, Vec2] };
  /** The step's share of the model's .fold file, in bytes. */
  bytes: number;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const middle = (pts: Vec2[]): Vec2 => [pts.reduce((s, q) => s + q[0], 0) / pts.length, pts.reduce((s, q) => s + q[1], 0) / pts.length];

/** A report on bent step k of a model (counting from 1). `samples`: how many times to look for crossings as it plays. */
export function bendReport(model: OrigamiModel, k: number, { samples = 24 }: { samples?: number } = {}): BendReport {
  const step = model.steps[k - 1];
  const frames = [...(step.via ?? []), step.frame];
  const tris = step.frame.faces_vertices;
  const paper = step.frame.vertices_paper;

  // Stretch: each edge against its length on the sheet.
  const stretchOf = (world: Vec3[][], sheet: Vec2[][]) => {
    let worst = { strain: 0, at: [0, 0] as Vec2 };
    world.forEach((pts, f) =>
      pts.forEach((p, i) => {
        const j = (i + 1) % pts.length;
        const [q, a, b] = [pts[j], sheet[f][i], sheet[f][j]];
        const strain = Math.abs(Math.hypot(...sub(p, q)) / Math.hypot(a[0] - b[0], a[1] - b[1]) - 1);
        if (strain > worst.strain) worst = { strain, at: middle([a, b]) };
      }),
    );
    return worst;
  };
  let still = { strain: 0, frame: 0, at: [0, 0] as Vec2 };
  frames.forEach((f, n) => {
    const w = stretchOf(
      f.faces_vertices.map((face) => face.map((v) => f.vertices_coords[v] as Vec3)),
      f.faces_vertices.map((face) => face.map((v) => f.vertices_paper[v])),
    );
    if (w.strain > still.strain) still = { ...w, frame: n };
  });
  const t = stepTransition(model, k);
  const sheet = t.faces.map((f) => f.paper);
  let playing = { strain: 0, time: 0, at: [0, 0] as Vec2 };
  for (let i = 1; i < BEND_SAMPLES; i++) {
    const w = stretchOf(poseAt(t, i / BEND_SAMPLES), sheet);
    if (w.strain > playing.strain) playing = { ...w, time: i / BEND_SAMPLES };
  }

  // Turns: each triangle's normal, frame to frame.
  const normal = (n: number, tri: number[]): Vec3 => {
    const [a, b, c] = tri.map((v) => frames[n].vertices_coords[v] as Vec3);
    const m = cross(sub(b, a), sub(c, a));
    const l = Math.hypot(...m) || 1;
    return [m[0] / l, m[1] / l, m[2] / l];
  };
  const turns = { degrees: 0, frames: [0, 0] as [number, number], at: [0, 0] as Vec2, over45: 0, over90: 0 };
  for (let n = 1; n < frames.length; n++) {
    tris.forEach((tri) => {
      const [a, b] = [normal(n - 1, tri), normal(n, tri)];
      const degrees = (Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180) / Math.PI;
      if (degrees > 45) turns.over45++;
      if (degrees > 90) turns.over90++;
      if (degrees > turns.degrees) Object.assign(turns, { degrees, frames: [n - 1, n], at: middle(tri.map((v) => paper[v])) });
    });
  }

  // Guides: each one's place on the paper, by the triangle it's in, against its path.
  const op = step.op?.op === 'bend' ? step.op : undefined;
  const guided = (op?.goals ?? []).flatMap((g) => ('guide' in g ? [{ paper: g.guide.paper, path: g.path }] : []));
  let guides: BendReport['guides'];
  if (guided.length) {
    const placed = guided.flatMap((g) => {
      for (const tri of tris) {
        const w = barycentric(g.paper, tri.map((v) => paper[v]) as [Vec2, Vec2, Vec2]);
        if (w && w.every((x) => x > -1e-9)) return [{ ...g, tri, w }];
      }
      return [];
    });
    const setDown = !!(op!.free || op!.inflate);
    const stages: { stage: number; lag: number }[] = [];
    let worst = { lag: 0, stage: 0, at: [0, 0] as Vec2 };
    frames.forEach((f, n) => {
      const share = (n + 1) / frames.length;
      const here = placed.flatMap((g) => {
        // Only where the path has an entry for this stage, as it's spaced evenly over them from where it starts.
        const x = share * g.path.length;
        if (Math.abs(x - Math.round(x)) > 1e-9 || Math.round(x) < 1) return [];
        const at = [0, 1, 2].map((c) => g.tri.reduce((s, v, i) => s + g.w[i] * f.vertices_coords[v][c], 0)) as Vec3;
        return [{ g, at, to: g.path[Math.round(x) - 1] }];
      });
      if (!here.length) return;
      const lift = setDown ? here.reduce((s, h) => s + h.to[1] - h.at[1], 0) / here.length : 0;
      let lag = 0;
      for (const h of here) {
        const d = Math.hypot(h.at[0] - h.to[0], h.at[1] + lift - h.to[1], h.at[2] - h.to[2]);
        if (d > lag) lag = d;
        if (d > worst.lag) worst = { lag: d, stage: n + 1, at: h.g.paper };
      }
      stages.push({ stage: n + 1, lag });
    });
    if (stages.length) guides = { stages, ...worst };
  }

  // Crossings as it plays.
  let crossing: BendReport['crossing'] = { depth: 0, time: 0 };
  for (let i = 1; i <= samples; i++) {
    const time = i / samples - 1e-9;
    for (const c of crossingAt(t, time)) {
      if (c.depth > crossing.depth) crossing = { depth: c.depth, time, at: [middle(t.faces[c.faces[0]].paper), middle(t.faces[c.faces[1]].paper)] };
    }
  }

  return {
    step: k,
    triangles: tris.length,
    frames: frames.length,
    still,
    playing,
    turns,
    ...(guides && { guides }),
    crossing,
    bytes: JSON.stringify(toFoldFile(model).file_frames[k - 1]).length,
  };
}

/** A report as lines to read. */
export function describeBend(r: BendReport): string[] {
  const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
  const cm = (x: number) => `${(100 * x).toFixed(2)} cm`;
  const at = (q: Vec2) => `(${q[0].toFixed(3)}, ${q[1].toFixed(3)})`;
  return [
    `Step ${r.step}: ${r.triangles} triangles, ${r.frames} frames, ${(r.bytes / 1024).toFixed(0)} KB of the file`,
    `  stretch in its frames  ${pct(r.still.strain)} in frame ${r.still.frame}, at ${at(r.still.at)}`,
    `  stretch as it plays    ${pct(r.playing.strain)} at ${r.playing.time.toFixed(3)}, at ${at(r.playing.at)}`,
    `  turn between frames    ${r.turns.degrees.toFixed(0)}° from frame ${r.turns.frames[0]} to ${r.turns.frames[1]}, at ${at(r.turns.at)}; ${r.turns.over45} over 45°, ${r.turns.over90} over 90°`,
    ...(r.guides
      ? [`  behind its guides      ${cm(r.guides.lag)} at stage ${r.guides.stage}, at ${at(r.guides.at)}; by stage ${r.guides.stages.map((s) => (100 * s.lag).toFixed(1)).join(' ')} (cm)`]
      : []),
    `  paper through paper    ${cm(r.crossing.depth)}${r.crossing.at ? ` at ${r.crossing.time.toFixed(3)}, between ${at(r.crossing.at[0])} and ${at(r.crossing.at[1])}` : ''}`,
  ];
}

/** Barycentric weights of q in a triangle on the sheet, or null for a sliver. */
function barycentric(q: Vec2, [a, b, c]: [Vec2, Vec2, Vec2]): [number, number, number] | null {
  const det = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  if (Math.abs(det) < 1e-15) return null;
  const wb = ((q[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (q[1] - a[1])) / det;
  const wc = ((b[0] - a[0]) * (q[1] - a[1]) - (q[0] - a[0]) * (b[1] - a[1])) / det;
  return [1 - wb - wc, wb, wc];
}
