import { clip } from '../cut';
import { FoldError, fromFlat, placeLike, toFlat, type FlatFace } from '../fold';
import { facePositions, LAYER_GAP } from '../frames';
import { joinedAlong, sharedSegment, signedArea, split } from '../geometry2d';
import type { FoldFrame, Vec2, Vec3 } from '../types';
import { frameKey, remembered } from './memo';
import { topology, type Tri } from './mesh';
import { solve } from './solver';

/**
 * Bending a frame (see docs/bending-plan.md): its faces cut into small triangles on the sheet, the solver run from
 * where they are in 3D, and the result written back as frames of triangles. Edges between triangles cut from
 * one face are soft (`FoldFrame.soft`); every triangle points back at the face it came from.
 */

/** A frame's faces as one mesh of triangles, joined where the faces are. */
export interface FrameMesh {
  /** Each point on the sheet, and where it is in 3D (flat stacked faces lifted by their layer). */
  paper: Vec2[];
  points: Vec3[];
  /** Wound as the frame's faces are on the sheet. */
  triangles: Tri[];
  /** The face of the frame each triangle is part of. */
  parent: number[];
}

/**
 * Meshes a frame: the faces in `flex` into triangles no longer than `size` on the sheet, the rest into triangles
 * no longer than `rigidSize`. Triangles meet edge to edge, within faces and across creases where faces are joined
 * (not across cuts).
 */
export function meshFrame(frame: FoldFrame, flex: number[], size: number, rigidSize = 3 * size): FrameMesh {
  const corners = facePositions(frame);
  const polys = frame.faces_vertices.map((face) => face.map((v) => frame.vertices_paper[v]));

  // Each face's outline, with every vertex of the frame that lies along its edges (where a neighbour was split
  // and it wasn't), so neighbouring faces' outlines match point for point.
  const outlines = polys.map((poly) => {
    const paper: Vec2[] = [];
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length];
      paper.push(a);
      const along = frame.vertices_paper
        .map((q) => ({ q, t: onSegment(q, a, b) }))
        .filter((x): x is { q: Vec2; t: number } => x.t !== null)
        .sort((x, y) => x.t - y.t);
      for (const { q } of along) if (!paper.some((p) => same(p, q))) paper.push(q);
    });
    return paper;
  });

  // Most faces are cut into triangles and then halved across their longest edges until they're small enough, which
  // keeps right-angled triangles right-angled, and lines their halves up with their neighbours' (paper folded onto
  // paper meets it the same way). But a long narrow face (a band, or a piece cut off it along a line it will fold
  // along) comes out in slivers, which tip right over at the slightest nudge to a narrow corner, so the frames a bend
  // passes through, played one into the next, stretch them. Such a face is laid out on a grid instead (`grid`): filled
  // with points on a square grid on the sheet, once the faces around it are halved, and those joined to the points
  // along its outline in the best-shaped triangles they make (`delaunay`).
  const flexible = new Set(flex);
  // A face narrower than a triangle's edge (a fan's strip) has no room for a grid: its outline is cut evenly, and so
  // are the stretches its neighbours share with it, so outlines still match, and its triangles run across it in a row.
  const thin = polys.map((poly) => {
    const around = poly.reduce((sum, a, i) => sum + Math.sqrt(dist2(a, poly[(i + 1) % poly.length])), 0);
    return (2 * Math.abs(signedArea(poly))) / around < size;
  });
  const limit = (f: number) => (flexible.has(f) || thin[f] ? size : rigidSize);
  const grid = outlines.map((outline, f) => !thin[f] && halvedBadly(outline, limit(f)));
  // A grid's squares' diagonals are as long as its triangles' edges may be.
  const spacing = (f: number) => limit(f) / Math.SQRT2;
  // How finely a stretch of a face's outline is cut, if at all: as finely as any thin face along it needs; else, along
  // grids only, as finely as theirs. Beside a face that's halved, a grid takes the points it's halved at.
  const pieceSpacing = (f: number, a: Vec2, b: Vec2) => {
    const along = polys.flatMap((poly, g) =>
      g === f || poly.some((s, i) => onSegment(a, s, poly[(i + 1) % poly.length], true) !== null && onSegment(b, s, poly[(i + 1) % poly.length], true) !== null)
        ? [g]
        : [],
    );
    if (along.some((g) => thin[g])) return size;
    if (along.some((g) => !grid[g])) return Infinity;
    return Math.min(...along.map(spacing));
  };
  const touched = polys.map(() => false);

  const local: { paper: Vec2[]; points: Vec3[]; outline: number; tris: Tri[] }[] = outlines.map((paper, f) => {
    const at = affine(polys[f], corners[f]);
    const even = paper.flatMap((a, i): Vec2[] => {
      const b = paper[(i + 1) % paper.length];
      const piece = pieceSpacing(f, a, b);
      if (piece === size) touched[f] = true;
      const n = piece < Infinity ? Math.max(1, Math.ceil(Math.sqrt(dist2(a, b)) / piece - 1e-9)) : 1;
      return Array.from({ length: n }, (_, k): Vec2 => (k ? [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n] : a));
    });
    // A grid's points, to be joined up once the faces around it are halved.
    const all = grid[f] ? [...even, ...gridWithin(polys[f], spacing(f))] : even;
    return { paper: all, points: all.map(at), outline: even.length, tris: grid[f] ? [] : earClip(even) };
  });

  // Points shared by joined faces become one, where the faces meet.
  const offsets: number[] = [];
  let count = 0;
  for (const l of local) {
    offsets.push(count);
    count += l.paper.length;
  }
  const root = Array.from({ length: count }, (_, i) => i);
  const find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i])));
  const join = (i: number, j: number) => {
    const [a, b] = [find(i), find(j)];
    if (a !== b) root[Math.max(a, b)] = Math.min(a, b);
  };
  // Along the crease each joined point is on, across the table.
  const along: (Vec3 | undefined)[] = [];
  for (let f = 0; f < polys.length; f++) {
    for (let g = f + 1; g < polys.length; g++) {
      const shared = sharedSegment(polys[f], polys[g]);
      if (!shared) continue;
      // Along the shared stretch, in order, joining both ends of each piece that isn't cut.
      const on = local[f].paper
        .map((q, i) => ({ i, t: onSegment(q, shared[0], shared[1], true) }))
        .filter((x): x is { i: number; t: number } => x.t !== null)
        .sort((x, y) => x.t - y.t);
      const partner = (i: number) => local[g].paper.findIndex((q) => same(q, local[f].paper[i]));
      for (let k = 0; k + 1 < on.length; k++) {
        const [i, j] = [on[k].i, on[k + 1].i];
        if (!joinedAlong(local[f].paper[i], local[f].paper[j], frame.cuts)) continue;
        const [pi, pj] = [local[f].points[i], local[f].points[j]];
        for (const x of [i, j]) {
          const y = partner(x);
          if (y < 0) continue;
          join(offsets[f] + x, offsets[g] + y);
          along[offsets[f] + x] = [pj[0] - pi[0], 0, pj[2] - pi[2]];
        }
      }
    }
  }
  const index = new Map<number, number>();
  const paper: Vec2[] = [];
  const sums: { p: Vec3; n: number }[] = [];
  const id = (f: number, i: number) => {
    const r = find(offsets[f] + i);
    let k = index.get(r);
    if (k === undefined) {
      k = paper.length;
      index.set(r, k);
      paper.push(local[f].paper[i]);
      sums.push({ p: [0, 0, 0], n: 0 });
    }
    return k;
  };
  const triangles: Tri[] = [];
  const parent: number[] = [];
  const ids: number[][] = [];
  // Where each point's faces put it, which way is out of each face there, and along the crease it's on, if any.
  const from: { at: Vec3; out: Vec3 }[][] = [];
  const crease: (Vec3 | undefined)[] = [];
  local.forEach((l, f) => {
    const own = (ids[f] = l.paper.map((_, i) => id(f, i)));
    const middle = l.points.slice(0, l.outline).reduce((m, q) => [m[0] + q[0] / l.outline, 0, m[2] + q[2] / l.outline] as Vec3, [0, 0, 0] as Vec3);
    own.forEach((k, i) => {
      for (let c = 0; c < 3; c++) sums[k].p[c] += l.points[i][c];
      sums[k].n++;
      (from[k] ??= []).push({ at: l.points[i], out: [l.points[i][0] - middle[0], 0, l.points[i][2] - middle[2]] });
      crease[k] ??= along[offsets[f] + i];
    });
    for (const [a, b, c] of l.tris) {
      triangles.push([own[a], own[b], own[c]]);
      parent.push(f);
    }
  });
  // Faces stacked apart meet a hair apart along a crease: they meet halfway. Where they're folded together (both
  // on one side of it), the paper wraps round the layers between them, so the point goes out past the fold by
  // half the stack: folds round folds nest, rather than all meeting inside the stack and cutting through it. Two
  // layers next to each other have nothing between them to wrap round.
  const points = sums.map(({ p, n }, k): Vec3 => {
    const q: Vec3 = [p[0] / n, p[1] / n, p[2] / n];
    const ys = from[k].map((x) => x.at[1]);
    const spread = Math.max(...ys) - Math.min(...ys);
    const c = crease[k];
    if (spread < 1.5 * LAYER_GAP || !c) return q;
    // Square to the crease, away from the faces.
    const cl = Math.hypot(c[0], c[2]);
    const across: Vec3 = [-c[2] / cl, 0, c[0] / cl];
    const away = from[k].reduce((s, x) => s + Math.sign(x.out[0] * across[0] + x.out[2] * across[2]), 0);
    // Faces either side of the point (a crease lying open) pull out both ways, and stay where they meet.
    if (Math.abs(away) < from[k].length) return q;
    const out = (Math.sign(away) * spread) / 2;
    return [q[0] + across[0] * out, q[1], q[2] + across[2] * out];
  });

  // The faces that aren't grids, halved.
  const halved = paper.length;
  refine(paper, points, triangles, parent, limit);
  // Each grid's points joined up, with the points along its outline, its neighbours' halves too.
  local.forEach((l, f) => {
    if (!grid[f]) return;
    const outline = ids[f].slice(0, l.outline).flatMap((k, i, all) => {
      const next = all[(i + 1) % all.length];
      const between = paper
        .slice(halved)
        .map((q, j) => ({ j: halved + j, t: onSegment(q, paper[k], paper[next]) }))
        .filter((x): x is { j: number; t: number } => x.t !== null)
        .sort((x, y) => x.t - y.t);
      return [k, ...between.map((x) => x.j)];
    });
    const all = [...outline, ...ids[f].slice(l.outline)];
    const at = all.map((k) => paper[k]);
    const tris = earClip(at.slice(0, outline.length));
    for (let i = outline.length; i < all.length; i++) insertPoint(at, tris, i);
    for (const t of tris) {
      triangles.push(t.map((i) => all[i]) as Tri);
      parent.push(f);
    }
  });
  // A square of the grid could be cut along either diagonal: each is cut the way its neighbours aren't, a pattern
  // that looks the same in a mirror along the grid's lines and diagonals, as halving does, so paper folded onto
  // paper meets it the same way, rather than crossing where the two take different diagonals.
  const prefer = (f: number, a: Vec2, b: Vec2) => {
    if (!grid[f]) return undefined;
    const h = spacing(f);
    const [i, j] = [Math.floor((a[0] + b[0]) / 2 / h), Math.floor((a[1] + b[1]) / 2 / h)];
    return (b[0] - a[0]) * (b[1] - a[1]) > 0 === ((i + j) % 2 === 0);
  };
  delaunay(paper, triangles, parent, (f) => grid[f], prefer);
  // Any triangle still too long (beside a corner sharper than the grid's) halved too.
  refine(paper, points, triangles, parent, limit);
  // Ear-clipping fans out to the many points along an outline cut evenly beside a thin face: evened out.
  delaunay(paper, triangles, parent, (f) => grid[f] || touched[f], prefer);
  return { paper, points, triangles, parent };
}

/**
 * Whether halving a face's triangles across their longest edges until none is longer than `limit` leaves any of
 * them sharper than `SHARPEST`: the right-angled triangles of a square or a right-angled corner, halved, never are;
 * a band four times as long as it's wide comes out at under 15°.
 */
function halvedBadly(outline: Vec2[], limit: number): boolean {
  const paper = outline.map((q): Vec2 => [q[0], q[1]]);
  const tris = earClip(paper);
  const points = paper.map((q): Vec3 => [q[0], 0, q[1]]);
  refine(paper, points, tris, tris.map(() => 0), () => limit);
  return tris.some(([a, b, c]) => minAngle(paper[a], paper[b], paper[c]) < SHARPEST);
}

/**
 * How sharp a triangle's corner may be, halving a face's triangles, before the face is laid out on a grid instead.
 * The cup's walls, halved, come to 22.5°, and their halves line up with each other where they meet.
 */
const SHARPEST = (20 * Math.PI) / 180;

/**
 * The points of a square grid on the sheet, `spacing` apart, inside a face (a convex polygon) and at least
 * `MARGIN` of a square from its edges, which have points of their own about as far apart.
 */
function gridWithin(poly: Vec2[], spacing: number): Vec2[] {
  const xs = poly.map((q) => q[0]);
  const ys = poly.map((q) => q[1]);
  const turn = Math.sign(signedArea(poly)) || 1;
  const out: Vec2[] = [];
  for (let i = Math.ceil(Math.min(...xs) / spacing); i * spacing <= Math.max(...xs); i++) {
    for (let j = Math.ceil(Math.min(...ys) / spacing); j * spacing <= Math.max(...ys); j++) {
      const q: Vec2 = [i * spacing, j * spacing];
      const clear = poly.every((a, k) => {
        const b = poly[(k + 1) % poly.length];
        const len = Math.sqrt(dist2(a, b));
        return (turn * ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]))) / len > MARGIN * spacing;
      });
      if (clear) out.push(q);
    }
  }
  return out;
}

/**
 * How near a face's edge, as a share of the grid's squares, its grid's points may be: well clear of it, so the
 * triangles between the outline and the grid aren't flattened against it (wider gaps are halved). Paper folded round
 * other layers starts its points along the fold a little out past it (see `meshFrame`), and small triangles there
 * take longest to take the sheet's shape back.
 */
const MARGIN = 0.75;

/** Adds point `p` to triangles of `paper` that fill a polygon, splitting the one it's in (or the two whose edge it's on). */
function insertPoint(paper: Vec2[], tris: Tri[], p: number) {
  const q = paper[p];
  const k = tris.findIndex((t) => inside(q, t.map((v) => paper[v]) as [Vec2, Vec2, Vec2]));
  if (k < 0) return;
  const t = tris[k];
  const w = barycentric(q, t.map((v) => paper[v]) as [Vec2, Vec2, Vec2]);
  const e = w.findIndex((x) => Math.abs(x) < 1e-9);
  if (e < 0) {
    const [a, b, c] = t;
    tris.splice(k, 1, [a, b, p], [b, c, p], [c, a, p]);
    return;
  }
  // On the edge across from corner e: split this triangle and the one beyond it in two each.
  const [a, b, c] = [t[(e + 1) % 3], t[(e + 2) % 3], t[e]];
  tris.splice(k, 1, [c, a, p], [p, b, c]);
  const n = tris.findIndex((u) => u.includes(a) && u.includes(b));
  if (n < 0) return;
  const u = tris[n];
  const d = u.find((v) => v !== a && v !== b)!;
  const [x, y] = [u[(u.indexOf(d) + 1) % 3], u[(u.indexOf(d) + 2) % 3]];
  tris.splice(n, 1, [d, x, p], [p, y, d]);
}

/**
 * Swaps the diagonal of any two triangles of one face (of those `among` picks) whose angles opposite it add up to
 * more than a straight angle (the Delaunay rule), until none do, so no triangle is needlessly thin. Where they add up
 * to a straight angle, either diagonal will do: `prefer` picks, for the faces it picks for.
 */
function delaunay(
  paper: Vec2[],
  triangles: Tri[],
  parent: number[],
  among: (face: number) => boolean,
  prefer?: (face: number, a: Vec2, b: Vec2) => boolean | undefined,
) {
  const angle = (p: Vec2, a: Vec2, b: Vec2) => {
    const [u, v]: Vec2[] = [a, b].map((q) => [q[0] - p[0], q[1] - p[1]]);
    return Math.atan2(Math.abs(u[0] * v[1] - u[1] * v[0]), u[0] * v[0] + u[1] * v[1]);
  };
  const area = (t: Tri) => signedArea(t.map((v) => paper[v]));
  for (let round = 0; round < 1000; round++) {
    const byEdge = new Map<string, number[]>();
    triangles.forEach((t, k) => {
      if (!among(parent[k])) return;
      for (let e = 0; e < 3; e++) {
        const key = edgeKey(t[e], t[(e + 1) % 3]);
        byEdge.set(key, [...(byEdge.get(key) ?? []), k]);
      }
    });
    const swapped = new Set<number>();
    for (const pair of byEdge.values()) {
      if (pair.length !== 2) continue;
      const [k, j] = pair;
      if (parent[k] !== parent[j] || swapped.has(k) || swapped.has(j)) continue;
      const [a, b] = triangles[k].filter((v) => triangles[j].includes(v));
      const c = triangles[k].find((v) => v !== a && v !== b)!;
      const d = triangles[j].find((v) => v !== a && v !== b)!;
      const opposite = angle(paper[c], paper[a], paper[b]) + angle(paper[d], paper[a], paper[b]);
      // Four points round a circle (a grid's square) could be cut either way: as `prefer` has it, if it says.
      const rather = Math.abs(opposite - Math.PI) <= 1e-6 ? prefer?.(parent[k], paper[c], paper[d]) : undefined;
      if (rather === undefined ? opposite <= Math.PI + 1e-9 : !rather || prefer!(parent[k], paper[a], paper[b])) continue;
      // Only across a convex pair: a and b on either side of the new diagonal.
      const side = (q: Vec2) => Math.sign(signedArea([paper[c], paper[d], q]));
      if (side(paper[a]) * side(paper[b]) >= 0) continue;
      // Wound as the face is.
      const turn = Math.sign(area(triangles[k]));
      const wound = (t: Tri): Tri => (Math.sign(area(t)) === turn ? t : [t[0], t[2], t[1]]);
      triangles[k] = wound([c, d, a]);
      triangles[j] = wound([d, c, b]);
      swapped.add(k).add(j);
    }
    if (!swapped.size) break;
  }
}

export interface BendOptions {
  /** The faces allowed to bend. The rest move as rigid pieces. */
  flex: number[];
  /**
   * A point on the sheet whose triangle stays put; all of its face, if that face doesn't bend. With guides, they
   * place the paper, and nothing is held.
   */
  anchor: Vec2;
  /** Points on the sheet (corners of faces) taken to positions in 3D. */
  goals: { paper: Vec2; to: Vec3 }[];
  /**
   * Points anywhere on the sheet guided through positions in 3D, spaced evenly over the stages, the last where they
   * end: the shape the paper is to take, worked out beforehand, which it follows as closely as it can without
   * stretching. Paper far from where it starts, a cup opened from a flat stack say, is found this way, rather than
   * from a few goals, which leave the solver to find the shape (see docs/bending-plan.md).
   */
  guides?: { paper: Vec2; path: Vec3[] }[];
  /** Not held up by the table as it bends, so it can bend both ways from the middle; each frame is set down on it. */
  free?: boolean;
  /**
   * Creases (between two points on the sheet, along edges of faces) taken to a fold angle: valley folds positive
   * (the front sides turning towards each other), mountain folds negative, 0 flat.
   */
  creases?: { from: Vec2; to: Vec2; degrees: number }[];
  /** The longest edge of a triangle of bending paper, on the sheet. Defaults to a twelfth of the sheet's size. */
  mesh?: number;
  /**
   * Lines the paper will fold along, as segments on the table, for paper lying flat: every layer's face a segment
   * crosses is cut along it before meshing (joined still, as a crease is), so the mesh has edges there and the
   * paper can fold along them, rather than across triangles, which can't.
   */
  lines?: [Vec2, Vec2][];
  /**
   * Regions on the table (polygons), for paper lying flat, where it may crumple on the way, every layer of it: in the
   * frames in between, it may draw in shorter than the paper, never stretch (see BendProblem.crumple).
   */
  crumple?: Vec2[][];
  /**
   * How readily creases between faces give, as a share of each hinge's own stiffness (see solver.ts); soft mesh edges
   * bend more readily still.
   */
  creaseCompliance?: number;
  /** How many stages the goals ramp over: the step's in-between frames, and its last. */
  stages?: number;
  /**
   * Air blown in (a water bomb puffed up): the volume the paper encloses by the end. Each triangle is pushed out
   * away from the middle of the stack it starts in, as the layers either side of the air are.
   */
  inflate?: number;
}

const CREASE_COMPLIANCE = 0.1;

/**
 * Bends the paper of a frame towards its goals. Returns the frames it passes through (the first pointing each
 * triangle back at the face of `frame` it came from) and the bent paper, and how far any triangle strains.
 */
export function bendFrame(given: FoldFrame, options: BendOptions): { via: FoldFrame[]; frame: FoldFrame; strain: number } {
  return remembered(`bendFrame ${frameKey(given)} ${JSON.stringify(options)}`, () => bendAfresh(given, options));
}

function bendAfresh(given: FoldFrame, options: BendOptions): { via: FoldFrame[]; frame: FoldFrame; strain: number } {
  // Cut along the lines it will fold along, if any; its faces then point back at the frame's (`origin`).
  const { frame, origin } = options.lines?.length ? cutAlong(given, options.lines) : { frame: given, origin: given.faces_vertices.map((_, f) => f) };
  const flex = frame.faces_vertices.flatMap((_, f) => (options.flex.includes(origin[f]) ? [f] : []));
  const size = options.mesh ?? sheetSize(frame) / 12;
  const mesh = meshFrame(frame, flex, size);
  const { paper, points, triangles, parent } = mesh;
  const flexible = new Set(flex);

  const near = (q: Vec2) => {
    let best = 0;
    for (let v = 1; v < paper.length; v++) if (dist2(paper[v], q) < dist2(paper[best], q)) best = v;
    return best;
  };
  const goals = options.goals.map((g) => {
    const vertex = near(g.paper);
    if (dist2(paper[vertex], g.paper) > 1e-12) throw new Error(`A bend's goal at (${g.paper}) isn't a corner of a face.`);
    return { vertex, to: g.to };
  });
  const guides = (options.guides ?? []).map((g) => {
    const t = triangles.find((tri) => inside(g.paper, tri.map((v) => paper[v]) as [Vec2, Vec2, Vec2]));
    if (!t) throw new Error(`A bend's guide at (${g.paper}) isn't on the paper.`);
    return { ids: [...t], weights: barycentric(g.paper, t.map((v) => paper[v]) as [Vec2, Vec2, Vec2]), path: g.path };
  });
  const held = triangles.findIndex((t) => inside(options.anchor, t.map((v) => paper[v]) as [Vec2, Vec2, Vec2]));
  if (held < 0) throw new Error(`A bend's anchor at (${options.anchor}) isn't on the paper.`);
  // Guided, the paper goes where the guides take it: a triangle held flat where it starts would fight paper that
  // curves through it.
  const pinned = new Set(guides.length ? [] : triangles[held]);
  if (!guides.length && !flexible.has(parent[held])) triangles.forEach((t, k) => parent[k] === parent[held] && t.forEach((v) => pinned.add(v)));
  // Held where its face is, not out past a fold it's on (see meshFrame): held there, the paper beside it couldn't
  // take its shape back.
  const face = frame.faces_vertices[parent[held]];
  const place = affine(
    face.map((v) => frame.vertices_paper[v]),
    facePositions(frame)[parent[held]],
  );
  for (const v of pinned) points[v] = place(paper[v]);

  // Within a face that bends, the paper bends; within one that doesn't, it holds; between faces, creases give.
  const parentOf = new Map<string, number[]>();
  triangles.forEach((t, k) => {
    for (let e = 0; e < 3; e++) {
      const key = edgeKey(t[e], t[(e + 1) % 3]);
      parentOf.set(key, [...(parentOf.get(key) ?? []), parent[k]]);
    }
  });
  const meshHinges = topology(triangles).hinges;
  const soft: [number, number][] = [];
  const hinges: { edge: [number, number]; compliance: number }[] = [];
  for (const { a, b } of meshHinges) {
    const [f, g] = parentOf.get(edgeKey(a, b))!;
    const edge: [number, number] = a < b ? [a, b] : [b, a];
    if (f !== g) hinges.push({ edge, compliance: options.creaseCompliance ?? CREASE_COMPLIANCE });
    else {
      // Cut from one face, so a seam of the mesh rather than a crease: soft, whether it bends or holds.
      soft.push(edge);
      if (!flexible.has(f)) hinges.push({ edge, compliance: 0 });
    }
  }

  // The solver's fold angle turns the other way from a valley fold, with triangles wound as the sheet's faces are.
  const creases = (options.creases ?? []).flatMap(({ from, to, degrees }) => {
    const found = meshHinges.filter(({ a, b }) => onSegment(paper[a], from, to, true) !== null && onSegment(paper[b], from, to, true) !== null);
    if (!found.length) throw new Error(`A bend's crease from (${from}) to (${to}) isn't along an edge of a face.`);
    return found.map(({ a, b }) => ({ edge: [a, b] as [number, number], degrees: -degrees }));
  });

  const { frames, strain } = solve({
    points,
    sheet: paper,
    triangles,
    pinned: [...pinned],
    goals,
    ...(guides.length && { guides }),
    creases,
    hinges,
    thickness: LAYER_GAP,
    // Paper blown up puffs out both ways from the middle: it rises off the table as it does (below), rather
    // than its bottom being held flat on it. So does paper bent free of the table.
    ...(!options.inflate && !options.free && { floor: 0 }),
    ...(stacked(frame) && { side: sidesByLayer(frame, points, triangles, parent) }),
    ...(options.inflate && { inflate: inflation(frame, points, triangles, parent, options.inflate) }),
    ...(options.stages && { stages: options.stages }),
    ...(options.crumple?.length && { crumple: crumpling(points, triangles, options.crumple) }),
  });
  const write = (coords: Vec3[], first: boolean): FoldFrame => ({
    vertices_coords: coords,
    vertices_paper: paper,
    faces_vertices: triangles,
    ...(first && { faces_parent: parent.map((f) => origin[f]) }),
    ...(frame.cuts?.length && { cuts: frame.cuts }),
    ...(frame.tapes?.length && { tapes: frame.tapes }),
    ...(soft.length && { soft }),
  });
  // Resting on the table: blown up or bent free of it, each frame is set down with its lowest point on it.
  if (options.inflate || options.free) for (const f of frames) {
    const low = Math.min(...f.map((q) => q[1]));
    for (const q of f) q[1] -= low;
  }
  const all = frames.map((f, k) => write(f, k === 0));
  return { via: all.slice(0, -1), frame: all[all.length - 1], strain };
}

/**
 * A flat frame with every face a line crosses cut along it (see BendOptions.lines), each piece pointing back at the
 * face it's cut from (`origin`). The paper stays joined: unlike scissors, no cut is kept.
 */
export function cutAlong(frame: FoldFrame, lines: [Vec2, Vec2][]): { frame: FoldFrame; origin: number[] } {
  if (!frame.vertices_coords.every((q) => Math.abs(q[1]) < 1e-9)) throw new FoldError('linesNeedFlat');
  let faces: FlatFace[] = toFlat(frame);
  for (const [a, b] of lines) {
    const line = { p: a, d: [b[0] - a[0], b[1] - a[1]] as Vec2 };
    faces = faces.flatMap((f) => {
      if (!clip(f.world, a, b)) return [f];
      const { pos, neg } = split(f, line);
      return pos && neg ? [{ ...pos, layer: f.layer, parent: f.parent }, { ...neg, layer: f.layer, parent: f.parent }] : [f];
    });
  }
  const cutUp = fromFlat(faces);
  return {
    frame: { ...cutUp, faces_parent: undefined, ...(frame.cuts?.length && { cuts: frame.cuts }), ...(frame.tapes?.length && { tapes: frame.tapes }) },
    origin: faces.map((f) => f.parent),
  };
}

/** Whether a point is inside a polygon. */
function within(q: Vec2, poly: Vec2[]): boolean {
  let odd = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [a, b] = [poly[i], poly[j]];
    if (a[1] > q[1] !== b[1] > q[1] && q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]) odd = !odd;
  }
  return odd;
}

/** Which triangles lie in the regions on the table where paper may crumple (see BendOptions.crumple), by their middles. */
function crumpling(points: Vec3[], triangles: Tri[], regions: Vec2[][]): boolean[] {
  return triangles.map((t) => {
    const mid: Vec2 = [t.reduce((s, v) => s + points[v][0], 0) / 3, t.reduce((s, v) => s + points[v][2], 0) / 3];
    return regions.some((poly) => within(mid, poly));
  });
}

/**
 * Which triangles of a bent step's frames may crumple on the way (see BendOptions.crumple), by where their paper lay
 * on the table in the frame before the step (`before`): `first` is the step's first frame, whose faces point back at
 * `before`'s. Null if none may.
 */
export function crumpleOf(before: FoldFrame, first: FoldFrame, regions: Vec2[][] | undefined): boolean[] | null {
  const parent = first.faces_parent;
  if (!regions?.length || !parent || !stacked(before)) return null;
  const place = toFlat(before).map(placeLike);
  return first.faces_vertices.map((t, k) => {
    const mid = t.reduce<Vec2>((m, v) => [m[0] + first.vertices_paper[v][0] / t.length, m[1] + first.vertices_paper[v][1] / t.length], [0, 0]);
    return regions.some((poly) => within(place[parent[k]](mid), poly));
  });
}

/** Whether a frame lies flat, its faces in layers. */
const stacked = (frame: FoldFrame) => !!frame.faces_layer && frame.vertices_coords.every((q) => Math.abs(q[1]) < 1e-9);

/**
 * For paper lying flat in layers: which side of a triangle a point belongs on, by the layers of the faces they're
 * on (see BendProblem.side), where every face the point is on is above the triangle's, or every one below.
 */
function sidesByLayer(frame: FoldFrame, points: Vec3[], triangles: Tri[], parent: number[]): (v: number, t: number) => number | undefined {
  const layer = frame.faces_layer!;
  const lo = points.map(() => Infinity);
  const hi = points.map(() => -Infinity);
  triangles.forEach((t, k) => {
    for (const v of t) {
      lo[v] = Math.min(lo[v], layer[parent[k]]);
      hi[v] = Math.max(hi[v], layer[parent[k]]);
    }
  });
  // Which way each triangle's corners wind, seen from above.
  const up = triangles.map(([a, b, c]) => {
    const [pa, pb, pc] = [points[a], points[b], points[c]];
    return Math.sign((pb[2] - pa[2]) * (pc[0] - pa[0]) - (pb[0] - pa[0]) * (pc[2] - pa[2]));
  });
  return (v, t) => {
    const at = layer[parent[t]];
    if (!up[t] || (lo[v] <= at && hi[v] >= at)) return undefined;
    return up[t] * (lo[v] > at ? 1 : -1);
  };
}

/**
 * Where air blown into paper pushes it (see BendOptions.inflate): out from the middle of the stack, round the middle
 * of the paper. Paper lying flat in layers is pushed only where it's the outside, the top layer or the bottom one
 * there: the air pushes the skin out, and the layers inside (flaps tucked into pockets) come along, rather than
 * being pushed out through it. A triangle lying in the middle, or standing on edge, isn't pushed.
 */
function inflation(frame: FoldFrame, points: Vec3[], triangles: Tri[], parent: number[], volume: number): { centre: Vec3; outward: number[]; volume: number } {
  const ys = points.map((q) => q[1]);
  const middle = (Math.min(...ys) + Math.max(...ys)) / 2;
  const centre: Vec3 = [0, middle, 0];
  for (const q of points) {
    centre[0] += q[0] / points.length;
    centre[2] += q[2] / points.length;
  }
  const outside = stacked(frame) ? outsideOf(frame, triangles, points, parent) : undefined;
  const outward = triangles.map(([a, b, c], t) => {
    const [pa, pb, pc] = [points[a], points[b], points[c]];
    // The triangle's normal's height, the way its corners wind, and which side of the middle it lies.
    const ny = (pb[2] - pa[2]) * (pc[0] - pa[0]) - (pb[0] - pa[0]) * (pc[2] - pa[2]);
    const above = (pa[1] + pb[1] + pc[1]) / 3 - middle;
    if (Math.abs(ny) < 1e-12 || Math.abs(above) < 1e-9) return 0;
    if (outside && !outside(t)) return 0;
    return Math.sign(ny) * Math.sign(above);
  });
  return { centre, outward, volume };
}

/** For paper lying flat in layers: whether each triangle is the top or bottom layer where it lies. */
function outsideOf(frame: FoldFrame, triangles: Tri[], points: Vec3[], parent: number[]): (t: number) => boolean {
  const layer = frame.faces_layer!;
  const placed = facePositions(frame).map((face) => face.map((q): Vec2 => [q[0], q[2]]));
  return (t) => {
    const [a, b, c] = triangles[t].map((v) => points[v]);
    const at: Vec2 = [(a[0] + b[0] + c[0]) / 3, (a[2] + b[2] + c[2]) / 3];
    const here = placed.flatMap((poly, f) => (inPolygon(at, poly) ? [layer[f]] : []));
    const mine = layer[parent[t]];
    return !here.length || mine >= Math.max(...here) || mine <= Math.min(...here);
  };
}

/** Whether a point is inside a polygon (even–odd). */
function inPolygon([x, y]: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Splits triangles in two across their longest edge until none is longer than its face allows (Rivara's method). */
function refine(paper: Vec2[], points: Vec3[], triangles: Tri[], parent: number[], limit: (face: number) => number) {
  const length = (a: number, b: number) => Math.sqrt(dist2(paper[a], paper[b]));
  // Edges ordered by length, then by their points, so equal edges never tie.
  const longer = (a: [number, number], b: [number, number]) => {
    const d = length(...a) - length(...b);
    if (Math.abs(d) > 1e-12) return d > 0;
    return edgeKey(...a) > edgeKey(...b);
  };
  const longest = (k: number): number => {
    const t = triangles[k];
    let best = 0;
    for (let e = 1; e < 3; e++) if (longer([t[e], t[(e + 1) % 3]], [t[best], t[(best + 1) % 3]])) best = e;
    return best;
  };
  const byEdge = new Map<string, number[]>();
  const add = (k: number) => {
    const t = triangles[k];
    for (let e = 0; e < 3; e++) {
      const key = edgeKey(t[e], t[(e + 1) % 3]);
      byEdge.set(key, [...(byEdge.get(key) ?? []), k]);
    }
  };
  const remove = (k: number) => {
    const t = triangles[k];
    for (let e = 0; e < 3; e++) {
      const key = edgeKey(t[e], t[(e + 1) % 3]);
      byEdge.set(key, byEdge.get(key)!.filter((x) => x !== k));
    }
  };
  triangles.forEach((_, k) => add(k));
  const midpoints = new Map<string, number>();
  const midpoint = (a: number, b: number) => {
    const key = edgeKey(a, b);
    let m = midpoints.get(key);
    if (m === undefined) {
      m = paper.length;
      midpoints.set(key, m);
      paper.push([(paper[a][0] + paper[b][0]) / 2, (paper[a][1] + paper[b][1]) / 2]);
      points.push([(points[a][0] + points[b][0]) / 2, (points[a][1] + points[b][1]) / 2, (points[a][2] + points[b][2]) / 2]);
    }
    return m;
  };
  // Halves triangle k across edge e, keeping its winding: the new one goes on the end.
  const halve = (k: number, e: number) => {
    const t = triangles[k];
    const [a, b, c] = [t[e], t[(e + 1) % 3], t[(e + 2) % 3]];
    const m = midpoint(a, b);
    remove(k);
    triangles[k] = [a, m, c];
    triangles.push([m, b, c]);
    parent.push(parent[k]);
    add(k);
    add(triangles.length - 1);
  };
  const bisect = (k: number) => {
    for (;;) {
      const e = longest(k);
      const t = triangles[k];
      const [a, b] = [t[e], t[(e + 1) % 3]];
      const n = byEdge.get(edgeKey(a, b))!.find((x) => x !== k);
      if (n !== undefined) {
        const f = longest(n);
        const u = triangles[n];
        if (edgeKey(u[f], u[(f + 1) % 3]) !== edgeKey(a, b)) {
          // The neighbour's longest edge is longer still: halve it first, then look again.
          bisect(n);
          continue;
        }
        halve(n, f);
      }
      halve(k, e);
      return;
    }
  };
  for (let k = 0; k < triangles.length; k++) {
    while (true) {
      const e = longest(k);
      const t = triangles[k];
      if (length(t[e], t[(e + 1) % 3]) <= limit(parent[k]) + 1e-12) break;
      bisect(k);
    }
  }
}

/**
 * Triangles filling a simple polygon (as corner indices), wound as it is: each time cutting off the corner whose
 * triangle is best shaped. Points along straight stretches of the outline are kept.
 */
function earClip(poly: Vec2[]): Tri[] {
  const turn = Math.sign(signedArea(poly)) || 1;
  const left = poly.map((_, i) => i);
  const out: Tri[] = [];
  while (left.length > 3) {
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < left.length; i++) {
      const [a, b, c] = [left[(i + left.length - 1) % left.length], left[i], left[(i + 1) % left.length]];
      const area = turn * signedArea([poly[a], poly[b], poly[c]]);
      if (area <= 1e-15) continue;
      if (left.some((x) => x !== a && x !== b && x !== c && inside(poly[x], [poly[a], poly[b], poly[c]]))) continue;
      const score = minAngle(poly[a], poly[b], poly[c]);
      if (score > bestScore) {
        best = i;
        bestScore = score;
      }
    }
    if (best < 0) throw new Error('A face of the frame could not be cut into triangles.');
    const n = left.length;
    out.push([left[(best + n - 1) % n], left[best], left[(best + 1) % n]]);
    left.splice(best, 1);
  }
  out.push([left[0], left[1], left[2]]);
  return out;
}

/** A face's map from the sheet into 3D, from three of its corners well apart. */
function affine(poly: Vec2[], corners: Vec3[]): (q: Vec2) => Vec3 {
  let [j, k, best] = [1, 2, 0];
  for (let a = 1; a < poly.length; a++) {
    for (let b = a + 1; b < poly.length; b++) {
      const area = Math.abs(signedArea([poly[0], poly[a], poly[b]]));
      if (area > best) [j, k, best] = [a, b, area];
    }
  }
  const [p0, p1, p2] = [poly[0], poly[j], poly[k]];
  const [x0, x1, x2] = [corners[0], corners[j], corners[k]];
  const det = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]);
  return (q) => {
    const s = ((q[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (q[1] - p0[1])) / det;
    const t = ((p1[0] - p0[0]) * (q[1] - p0[1]) - (q[0] - p0[0]) * (p1[1] - p0[1])) / det;
    return [0, 1, 2].map((c) => x0[c] + s * (x1[c] - x0[c]) + t * (x2[c] - x0[c])) as Vec3;
  };
}

const TOL = 1e-9;
const dist2 = (a: Vec2, b: Vec2) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
const same = (a: Vec2, b: Vec2) => dist2(a, b) < TOL * TOL;
const edgeKey = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`);

/** How far along a–b the point q lies (0 to 1), if it's on the segment: strictly between its ends, or `ends` too. */
function onSegment(q: Vec2, a: Vec2, b: Vec2, ends = false): number | null {
  const d: Vec2 = [b[0] - a[0], b[1] - a[1]];
  const l2 = d[0] * d[0] + d[1] * d[1];
  const t = ((q[0] - a[0]) * d[0] + (q[1] - a[1]) * d[1]) / l2;
  const off = Math.abs((q[0] - a[0]) * d[1] - (q[1] - a[1]) * d[0]) / Math.sqrt(l2);
  if (off > TOL) return null;
  const e = TOL / Math.sqrt(l2);
  if (ends ? t < -e || t > 1 + e : t <= e || t >= 1 - e) return null;
  return t;
}

/** Whether q is in the triangle, or on its edge. */
function inside(q: Vec2, [a, b, c]: [Vec2, Vec2, Vec2]): boolean {
  const s1 = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]);
  const s2 = (c[0] - b[0]) * (q[1] - b[1]) - (c[1] - b[1]) * (q[0] - b[0]);
  const s3 = (a[0] - c[0]) * (q[1] - c[1]) - (a[1] - c[1]) * (q[0] - c[0]);
  return (s1 >= -1e-15 && s2 >= -1e-15 && s3 >= -1e-15) || (s1 <= 1e-15 && s2 <= 1e-15 && s3 <= 1e-15);
}

/** The weights of a triangle's corners that make q. */
function barycentric(q: Vec2, [a, b, c]: [Vec2, Vec2, Vec2]): number[] {
  const area = signedArea([a, b, c]);
  const wa = signedArea([q, b, c]) / area;
  const wb = signedArea([a, q, c]) / area;
  return [wa, wb, 1 - wa - wb];
}

function minAngle(a: Vec2, b: Vec2, c: Vec2): number {
  const angle = (p: Vec2, q: Vec2, r: Vec2) => {
    const u: Vec2 = [q[0] - p[0], q[1] - p[1]];
    const v: Vec2 = [r[0] - p[0], r[1] - p[1]];
    return Math.abs(Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]));
  };
  return Math.min(angle(a, b, c), angle(b, c, a), angle(c, a, b));
}

/** The larger side of the paper's extent on the sheet. */
function sheetSize(frame: FoldFrame): number {
  const us = frame.vertices_paper.map((p) => p[0]);
  const vs = frame.vertices_paper.map((p) => p[1]);
  return Math.max(Math.max(...us) - Math.min(...us), Math.max(...vs) - Math.min(...vs));
}
