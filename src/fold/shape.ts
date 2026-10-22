import { checkNoTear, FoldError, placeLike, toFlat, type FlatFace } from './fold';
import { joinedSegment, sideOf, split, type Cut, type Line } from './geometry2d';
import { LAYER_GAP } from './frames';
import type { FoldFrame, Vec2, Vec3 } from './types';

/**
 * 3D shaping, for finishing steps: opening a flap partway, spreading wings, curling a petal. The paper
 * is bent about lines drawn on its last flat state. Each bend turns the paper on the left of its line's
 * direction up off the table by its angle; a piece of paper beyond several bends turns by each of them,
 * the one turning the most paper nearest the paper that stays put. So bends along a row of lines curl a
 * flap, and bends on different flaps shape them separately. Bends whose lines cross on the paper they turn
 * would stretch it, and are refused, unless `corners` is set: then they're walls rising together, as a box's
 * do, and the paper beyond both (the corner) pinches into an ear between them (see `cornerPlacer`). The
 * result isn't flat, so it can't be folded further, but it can be shaped again (from the same flat state,
 * with more bends).
 */
export interface Bend {
  line: Line;
  /** How far to turn, in radians: 0 leaves it flat, π/2 stands it straight up, π folds it right over. */
  angle: number;
  /** Turn only the top N layers on the moving side. Leave out to turn every layer there. */
  layers?: number;
  /** Turn only faces whose corners on the sheet pass this test. */
  only?: (paper: Vec2[]) => boolean;
}

export function shape(
  frame: FoldFrame,
  bends: Bend[],
  { corners = false, chained }: { corners?: boolean; chained?: Vec2 } = {},
): FoldFrame {
  if (chained) return opened(frame, bends, chained);
  const faces = toFlat(frame);
  // Which of the flat state's faces each bend turns (before cutting them along the bend lines).
  const turns = bends.map((b) => {
    const movingSide = faces.filter((f) => f.world.some((x) => sideOf(b.line, x) > 1e-7));
    if (!movingSide.length) throw new FoldError('Nothing is on the lifting side of that line.');
    const from = b.layers === undefined ? -Infinity : Math.max(...movingSide.map((f) => f.layer)) - b.layers + 1;
    return faces.map((f) => f.layer >= from && (!b.only || b.only(f.paper)));
  });

  // Cut the faces each bend turns along its line.
  let pieces: (FlatFace & { source: number })[] = faces.map((f, i) => ({ ...f, parent: i, source: i }));
  bends.forEach((b, k) => {
    pieces = pieces.flatMap((p) => {
      if (!turns[k][p.source]) return [p];
      const { pos, neg } = split(p, b.line);
      return [pos, neg].filter((q) => q !== null).map((q) => ({ ...q!, layer: p.layer, parent: p.parent, source: p.source }));
    });
  });

  // For each bend, the pieces it turns: those it applies to, on the left of its line.
  let moves = bends.map((b, k) => pieces.map((p) => turns[k][p.source] && sideOf(b.line, centre(p.world)) > 0));

  // Corners: where two bends' lines cross and paper lies beyond both, that paper is split along the corner's
  // diagonal, and each half placed hinged to its own wall (see `cornerPlacer`).
  let cornerOf: (((p: Vec2, y: number) => Vec3) | null)[] = pieces.map(() => null);
  if (corners) {
    for (let a = 0; a < bends.length; a++) {
      for (let b = a + 1; b < bends.length; b++) {
        if (!pieces.some((_, i) => moves[a][i] && moves[b][i] && !cornerOf[i])) continue;
        const placer = cornerPlacer(bends[a], bends[b]);
        if (!placer) continue;
        // Split the corner's pieces along the diagonal, keeping track of which piece each part came from.
        const next: typeof pieces = [];
        const from: number[] = [];
        pieces.forEach((p, i) => {
          if (!(moves[a][i] && moves[b][i]) || cornerOf[i]) {
            next.push(p);
            from.push(i);
            return;
          }
          const { pos, neg } = split(p, placer.diagonal);
          for (const q of [pos, neg]) {
            if (!q) continue;
            next.push({ ...q, layer: p.layer, parent: p.parent, source: p.source });
            from.push(i);
          }
        });
        pieces = next;
        moves = moves.map((m) => from.map((i) => m[i]));
        cornerOf = from.map((i) => cornerOf[i]);
        pieces.forEach((p, j) => {
          if (moves[a][j] && moves[b][j] && !cornerOf[j]) cornerOf[j] = placer.place(centre(p.world));
        });
      }
    }
  }
  bends.forEach((b, k) => {
    if (!moves[k].some(Boolean)) throw new FoldError('Nothing is on the lifting side of that line.');
    if (b.layers !== undefined || b.only) checkNoTear(pieces.map((p, i) => ({ ...p, moves: moves[k][i] })), b.line, frame.cuts);
  });

  // A piece's place: each bend it's beyond turns it, from the one turning the least paper (furthest out) to
  // the one turning the most (nearest the paper that stays put).
  const count = moves.map((m) => m.filter(Boolean).length);
  const order = bends.map((_, k) => k).sort((a, b) => count[a] - count[b]);
  const place = (i: number, [x, z]: Vec2, y = 0): Vec3 => {
    const corner = cornerOf[i];
    if (corner) return corner([x, z], y);
    let q: Vec3 = [x, y, z];
    for (const k of order) if (moves[k][i]) q = turn(q, bends[k]);
    return q;
  };

  const index = new Map<string, number>();
  const vertices_paper: Vec2[] = [];
  const vertices_coords: Vec3[] = [];
  const faces_vertices = pieces.map((p, i) =>
    p.paper.map((q, j) => {
      // The same paper point in the same place before shaping (cut paper can have one point in two places).
      const [x, z] = p.world[j];
      const key = `${q[0].toFixed(7)},${q[1].toFixed(7)},${Math.round(x * 1e6)},${Math.round(z * 1e6)}`;
      const at = place(i, p.world[j]);
      let v = index.get(key);
      if (v === undefined) {
        v = vertices_paper.push(q) - 1;
        vertices_coords.push(at);
        index.set(key, v);
      } else if (Math.hypot(...vertices_coords[v].map((c, n) => c - at[n])) > 1e-6) {
        // On a scissor cut, the paper either side is free to part: the pieces get a corner each.
        if (!onCut(q, frame.cuts)) throw new FoldError('Those bends cross on the paper, so they’d stretch it. Shape one part at a time.');
        v = vertices_paper.push(q) - 1;
        vertices_coords.push(at);
      }
      return v;
    }),
  );
  // A turned piece stands off its surface by its layer's gap (flat pieces get theirs when drawn), each with
  // its own corners: otherwise a thick stack's upper layers swing down through the lower ones at the bend.
  const ups = pieces.map((p, i): Vec3 | null => {
    if (!cornerOf[i] && !order.some((k) => moves[k][i])) return null;
    const [w] = p.world;
    const a = place(i, w);
    return place(i, w, 1).map((c, n) => c - a[n]) as Vec3;
  });
  // A stack turned right over lies flat again, so it's drawn lifted by its layers like any flat paper, which
  // would undo standing it off downwards. It's lifted instead so its layers, now upside down, end up stacked
  // the other way round, on the table.
  const over = (i: number) => ups[i] !== null && ups[i]![1] < -0.999;
  const overTop = Math.max(0, ...pieces.filter((_, i) => over(i)).map((p) => p.layer));
  pieces.forEach((p, i) => {
    const up = ups[i];
    if (!up || (!p.layer && !over(i))) return;
    const offset: Vec3 = over(i) ? [0, (overTop - 2 * p.layer) * LAYER_GAP, 0] : (up.map((c) => c * p.layer * LAYER_GAP) as Vec3);
    faces_vertices[i] = faces_vertices[i].map((v) => {
      vertices_paper.push(vertices_paper[v]);
      return vertices_coords.push(vertices_coords[v].map((c, n) => c + offset[n]) as Vec3) - 1;
    });
  });
  return {
    vertices_paper,
    vertices_coords,
    faces_vertices,
    faces_parent: pieces.map((p) => p.parent),
    faces_layer: pieces.map((p) => p.layer),
  };
}

/** Turns a point about a bend's line (on the table) by its angle, the left of the line going up. */
function turn([x, y, z]: Vec3, { line, angle }: Bend): Vec3 {
  const len = Math.hypot(line.d[0], line.d[1]);
  const [dx, dz] = [line.d[0] / len, line.d[1] / len];
  // Unit vector across the line towards its left (the moving side), and straight up.
  const [nx, nz] = [-dz, dx];
  const rx = x - line.p[0];
  const rz = z - line.p[1];
  const along = rx * dx + rz * dz;
  const across = rx * nx + rz * nz;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  // In the plane across the line, (across, up) turns by the angle.
  const a2 = across * c - y * s;
  const y2 = across * s + y * c;
  return [line.p[0] + along * dx + a2 * nx, y2, line.p[1] + along * dz + a2 * nz];
}

/**
 * Two walls rising together by the same angle about crossing lines, as a box's walls do: the paper beyond both
 * lines (the corner) folds along its diagonal, the bisector of the two lines, and each half stays hinged to
 * its own wall, along the other wall's line. So the halves meet along the diagonal, which rises between the
 * walls; stood straight up, they pinch into an ear pointing out from the corner. Returns the diagonal and,
 * for a point of the corner, where its half puts the paper (with `y` the height above it, for stacked
 * layers); null if the lines don't cross.
 */
function cornerPlacer(a: Bend, b: Bend): { diagonal: Line; place(at: Vec2): (p: Vec2, y: number) => Vec3 } | null {
  const unit = (v: Vec2): Vec2 => {
    const l = Math.hypot(v[0], v[1]);
    return [v[0] / l, v[1] / l];
  };
  const [da, db] = [unit(a.line.d), unit(b.line.d)];
  const det = da[0] * db[1] - da[1] * db[0];
  if (Math.abs(det) < 1e-9) return null;
  if (Math.abs(a.angle - b.angle) > 1e-9) throw new FoldError('Walls meeting at a corner must turn by the same angle.');
  // Where the lines cross: a.p + t da = b.p + u db.
  const t = ((b.line.p[0] - a.line.p[0]) * db[1] - (b.line.p[1] - a.line.p[1]) * db[0]) / det;
  const O: Vec2 = [a.line.p[0] + t * da[0], a.line.p[1] + t * da[1]];
  // Along each line, the way into the paper beyond the other one.
  const ea: Vec2 = sideOf(b.line, [O[0] + da[0], O[1] + da[1]]) > 0 ? da : [-da[0], -da[1]];
  const eb: Vec2 = sideOf(a.line, [O[0] + db[0], O[1] + db[1]]) > 0 ? db : [-db[0], -db[1]];
  const ed = unit([ea[0] + eb[0], ea[1] + eb[1]]);
  const diagonal: Line = { p: O, d: ed };
  const O3: Vec3 = [O[0], 0, O[1]];
  const at = (p: Vec2, bend: Bend): Vec3 => turn([p[0], 0, p[1]], bend);
  const minus = (p: Vec3, q: Vec3): Vec3 => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
  const times = (p: Vec3, k: number): Vec3 => [p[0] * k, p[1] * k, p[2] * k];
  const dot = (p: Vec3, q: Vec3) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  const cross = (p: Vec3, q: Vec3): Vec3 => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const norm = (p: Vec3): Vec3 => times(p, 1 / Math.hypot(...p));
  // Each half's hinge, where its wall has taken it: along b's line on a's wall, and along a's line on b's.
  const ua = norm(minus(at([O[0] + eb[0], O[1] + eb[1]], a), at(O, a)));
  const ub = norm(minus(at([O[0] + ea[0], O[1] + ea[1]], b), at(O, b)));
  // The diagonal makes the same angle with each hinge as on the sheet. Two directions do: the one pointing out
  // from the corner is the one that rises smoothly from flat to standing straight up (the other turns in over
  // the box partway), so the ear points out.
  const cosg = ed[0] * eb[0] + ed[1] * eb[1];
  const out: Vec3 = [ed[0], 0, ed[1]];
  const m: Vec3 = [ua[0] + ub[0], ua[1] + ub[1], ua[2] + ub[2]];
  const n = cross(ua, ub);
  let q: Vec3;
  if (dot(n, n) < 1e-12) {
    // The hinges lie along one line (walls stood straight up): any direction round it at that angle fits.
    const w = norm(minus(out, times(ua, dot(out, ua))));
    const sing = Math.sqrt(Math.max(0, 1 - cosg * cosg));
    q = [0, 1, 2].map((c) => ua[c] * cosg + w[c] * sing) as Vec3;
  } else {
    const k = cosg / (1 + dot(ua, ub));
    const s = Math.sqrt(Math.max(0, 1 - k * k * dot(m, m)) / dot(n, n));
    const [q1, q2] = [1, -1].map((sign) => [0, 1, 2].map((c) => k * m[c] + sign * s * n[c]) as Vec3);
    q = dot(q1, out) >= dot(q2, out) ? q1 : q2;
  }
  // A half's placement: from its hinge and the diagonal on the sheet to where they are now.
  const half = (eh: Vec2, uh: Vec3) => {
    // Across the hinge towards the diagonal, on the sheet and now.
    const ep: Vec2 = eh[0] * ed[1] - eh[1] * ed[0] > 0 ? [-eh[1], eh[0]] : [eh[1], -eh[0]];
    const up = norm(minus(q, times(uh, dot(q, uh))));
    // The sheet's up, carried along: (eh, ep) turned the same way round as (uh, up).
    const normal = times(norm(cross(uh, up)), Math.sign(eh[1] * ep[0] - eh[0] * ep[1]));
    return (p: Vec2, y: number): Vec3 => {
      const [x, z] = [p[0] - O[0], p[1] - O[1]];
      const al = x * eh[0] + z * eh[1];
      const be = x * ep[0] + z * ep[1];
      return [0, 1, 2].map((c) => O3[c] + al * uh[c] + be * up[c] + y * normal[c]) as Vec3;
    };
  };
  // The half next to a's wall is on eb's side of the diagonal, hinged along b's line.
  const sideB = Math.sign(sideOf(diagonal, [O[0] + eb[0], O[1] + eb[1]]));
  const [nearA, nearB] = [half(eb, ua), half(ea, ub)];
  return { diagonal, place: (c) => (Math.sign(sideOf(diagonal, c)) === sideB ? nearA : nearB) };
}

/**
 * Folds opened along the paper, as a stack of pleats opens into a zigzag: from the face at `anchor` (a point on
 * the sheet), the paper is followed face by face, and each time it crosses a fold lying on one of the bends'
 * lines (on the table, in the flat state), the paper beyond opens that fold by the bend's angle, away from the
 * face it lay on. Unlike `shape`'s bends, which turn whatever lies beyond a line, this tells apart layers
 * stacked over the same line, so each pleat opens on its own. The bends' `only` and `layers` aren't used.
 */
function opened(frame: FoldFrame, bends: Bend[], anchor: Vec2): FoldFrame {
  const faces = toFlat(frame);
  const start = faces.findIndex((f) => inside(f.paper, anchor));
  if (start < 0) throw new FoldError('The anchor point isn’t on the paper.');
  const n = faces.length;
  // Faces joined along an edge, and that edge on the sheet.
  const joins: { other: number; shared: [Vec2, Vec2] }[][] = faces.map(() => []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const shared = joinedSegment(faces[i].paper, faces[j].paper, frame.cuts);
      if (!shared) continue;
      joins[i].push({ other: j, shared: shared as [Vec2, Vec2] });
      joins[j].push({ other: i, shared: shared as [Vec2, Vec2] });
    }
  }
  // Each face's move, as a matrix on (x, y, z), from where it lies flat (at its layer's height).
  type M = number[]; // row-major 3x4
  const apply = (m: M, [x, y, z]: Vec3): Vec3 => [0, 1, 2].map((r) => m[r * 4] * x + m[r * 4 + 1] * y + m[r * 4 + 2] * z + m[r * 4 + 3]) as Vec3;
  const compose = (a: M, b: M): M => {
    // a after b.
    const out: M = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) out.push(a[r * 4] * b[c] + a[r * 4 + 1] * b[4 + c] + a[r * 4 + 2] * b[8 + c] + (c === 3 ? a[r * 4 + 3] : 0));
    }
    return out;
  };
  const rotation = (p: Vec3, d: Vec3, t: number): M => {
    // About the axis through p along unit d, by t (right hand).
    const [x, y, z] = d;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const C = 1 - c;
    const R = [x * x * C + c, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, y * y * C + c, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, z * z * C + c];
    const off = [0, 1, 2].map((r) => p[r] - (R[r * 3] * p[0] + R[r * 3 + 1] * p[1] + R[r * 3 + 2] * p[2]));
    return [R[0], R[1], R[2], off[0], R[3], R[4], R[5], off[1], R[6], R[7], R[8], off[2]];
  };
  const identity: M = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
  const flatAt = (f: number, p: Vec2): Vec3 => {
    const w = placeLike(faces[f])(p);
    return [w[0], faces[f].layer * LAYER_GAP, w[1]];
  };
  const onBend = (a: Vec2, b: Vec2) => bends.find((k) => Math.abs(sideOf(k.line, a)) < 1e-7 && Math.abs(sideOf(k.line, b)) < 1e-7);
  const moved: (M | null)[] = faces.map(() => null);
  moved[start] = identity;
  const queue = [start];
  while (queue.length) {
    const u = queue.shift()!;
    for (const { other: w, shared } of joins[u]) {
      if (moved[w]) continue;
      const [a, b] = shared.map((q) => placeLike(faces[u])(q));
      const bend = onBend(a, b);
      if (!bend || !bend.angle) {
        moved[w] = moved[u];
        queue.push(w);
        continue;
      }
      // The fold's edge where u has gone, and the way that takes w off the face it lies on.
      const [pa, pb] = shared.map((q) => apply(moved[u]!, flatAt(u, q)));
      const len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]);
      const d: Vec3 = [(pb[0] - pa[0]) / len, (pb[1] - pa[1]) / len, (pb[2] - pa[2]) / len];
      const awayUp = faces[w].layer > faces[u].layer;
      const cw = apply(moved[u]!, flatAt(w, centre(faces[w].paper)));
      const up = apply(moved[u]!, [0, 1, 0]).map((c, i) => c - apply(moved[u]!, [0, 0, 0])[i]);
      const height = (m: M) => {
        const q = apply(m, cw);
        const base = apply(moved[u]!, flatAt(u, centre(faces[u].paper)));
        return (q[0] - base[0]) * up[0] + (q[1] - base[1]) * up[1] + (q[2] - base[2]) * up[2];
      };
      const tries = [1, -1].map((sign) => rotation(pa, d, sign * Math.abs(bend.angle)));
      const [r] = tries.sort((p, q) => (awayUp ? height(q) - height(p) : height(p) - height(q)));
      moved[w] = compose(r, moved[u]!);
      queue.push(w);
    }
  }
  const index = new Map<string, number>();
  const vertices_paper: Vec2[] = [];
  const vertices_coords: Vec3[] = [];
  const faces_vertices = faces.map((f, i) =>
    f.paper.map((q) => {
      const at = apply(moved[i] ?? identity, flatAt(i, q));
      // The same paper point on the same layer is one vertex; a fold's two sides must meet.
      const key = `${q[0].toFixed(7)},${q[1].toFixed(7)},${f.layer}`;
      const v = index.get(key);
      if (v !== undefined && Math.hypot(...vertices_coords[v].map((c, k) => c - at[k])) < 1e-6) return v;
      vertices_paper.push(q);
      return vertices_coords.push(at) - 1;
    }),
  );
  // Each fold's two sides must still meet where they're joined.
  for (let i = 0; i < n; i++) {
    for (const { other: j, shared } of joins[i]) {
      for (const q of shared) {
        const [p1, p2] = [apply(moved[i] ?? identity, flatAt(i, q)), apply(moved[j] ?? identity, flatAt(j, q))];
        if (Math.hypot(p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]) > LAYER_GAP * Math.abs(faces[i].layer - faces[j].layer) + 1e-6) {
          throw new FoldError('Those folds can’t all open together without stretching the paper.');
        }
      }
    }
  }
  return { vertices_paper, vertices_coords, faces_vertices, faces_parent: faces.map((_, i) => i), faces_layer: faces.map((f) => f.layer) };
}

function inside(poly: Vec2[], p: Vec2): boolean {
  return contains(poly, p);
}

function centre(pts: Vec2[]): Vec2 {
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
}

/**
 * A curl: one bend's turn spread over `segments` bends, from its line out to the farthest paper it turns,
 * so the flap rolls over evenly instead of folding at the line.
 */
export function curl(frame: FoldFrame, bend: Bend, segments: number): Bend[] {
  if (segments <= 1) return [bend];
  const len = Math.hypot(bend.line.d[0], bend.line.d[1]);
  const reach = Math.max(
    0,
    ...toFlat(frame)
      .filter((f) => !bend.only || bend.only(f.paper))
      .flatMap((f) => f.world.map((x) => sideOf(bend.line, x) / len)),
  );
  const across: Vec2 = [-bend.line.d[1] / len, bend.line.d[0] / len];
  return Array.from({ length: segments }, (_, i) => ({
    ...bend,
    line: { p: [bend.line.p[0] + (across[0] * reach * i) / segments, bend.line.p[1] + (across[1] * reach * i) / segments], d: bend.line.d },
    angle: bend.angle / segments,
  }));
}

/**
 * For a frame shaped again from the flat state: points each face's parent at the face of `previous` it lies
 * within (on the sheet), so the step animates from where the paper was.
 */
export function reparent(previous: FoldFrame, next: FoldFrame): FoldFrame {
  const faces = previous.faces_vertices.map((face) => face.map((v) => previous.vertices_paper[v]));
  const faces_parent = next.faces_vertices.map((face) => {
    const c = centre(face.map((v) => next.vertices_paper[v]));
    const f = faces.findIndex((poly) => contains(poly, c));
    if (f < 0) throw new FoldError(`(${c.join(', ')}) isn’t on the paper.`);
    return f;
  });
  return { ...next, faces_parent };
}

function contains(poly: Vec2[], p: Vec2): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const c = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    if (Math.abs(c) < 1e-9) continue;
    if (sign && Math.sign(c) !== sign) return false;
    sign = Math.sign(c);
  }
  return true;
}

/**
 * A crease from a centre point, lifted off the table: its direction on the table (radians, from +x towards
 * +z) and how steeply it rises.
 */
export interface Ray {
  azimuth: number;
  elevation: number;
}

/**
 * Pops a flat model up about a point, as a fortune teller opens: creases run out from `centre` along `rays`
 * (in order round the point), each rising by its elevation, and the paper between each pair turns as one
 * piece. Every sector must keep its angle, or the paper would stretch. Stacked layers keep their gaps
 * straight up: the popped surface never stands past upright, so copies of it raised by different amounts
 * never cross, where gaps measured off each sector would cross in its valleys.
 */
export function radial(frame: FoldFrame, centre: Vec2, rays: Ray[]): FoldFrame {
  const dir = ({ azimuth, elevation }: Ray): Vec3 => [Math.cos(elevation) * Math.cos(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.sin(azimuth)];
  const n = rays.length;
  for (let k = 0; k < n; k++) {
    const [a, b] = [rays[k], rays[(k + 1) % n]];
    const flat = (((b.azimuth - a.azimuth) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const [p, q] = [dir(a), dir(b)];
    if (Math.abs(Math.acos(Math.min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])) - flat) > 1e-6) {
      throw new FoldError('Those creases would stretch the paper between them.');
    }
  }
  // Cut every face along each ray's line, so each piece lies in one sector.
  let pieces: (FlatFace & { source: number })[] = toFlat(frame).map((f, i) => ({ ...f, parent: i, source: i }));
  for (const r of rays) {
    const line = { p: centre, d: [Math.cos(r.azimuth), Math.sin(r.azimuth)] as Vec2 };
    pieces = pieces.flatMap((p) => {
      const { pos, neg } = split(p, line);
      return [pos, neg].filter((q) => q !== null).map((q) => ({ ...q!, layer: p.layer, parent: p.parent, source: p.source }));
    });
  }
  const sectorOf = (pts: Vec2[]) => {
    const c = centreOf(pts);
    const ang = Math.atan2(c[1] - centre[1], c[0] - centre[0]);
    for (let k = 0; k < n; k++) {
      const a = rays[k].azimuth;
      const span = (((rays[(k + 1) % n].azimuth - a) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      if (((((ang - a) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) < span) return k;
    }
    return 0;
  };
  const vertices_paper: Vec2[] = [];
  const vertices_coords: Vec3[] = [];
  const faces_vertices = pieces.map((p) => {
    const k = sectorOf(p.world);
    const [ra, rb] = [rays[k], rays[(k + 1) % n]];
    const [ua, ub]: Vec2[] = [ra, rb].map((r) => [Math.cos(r.azimuth), Math.sin(r.azimuth)]);
    const [da, db] = [dir(ra), dir(rb)];
    const up: Vec3 = [0, 1, 0];
    const det = ua[0] * ub[1] - ua[1] * ub[0];
    const rise = p.layer * LAYER_GAP;
    // Each piece has its own corners, as stacked layers sit at different heights.
    return p.world.map((w, j) => {
      const [x, z] = [w[0] - centre[0], w[1] - centre[1]];
      const a = (x * ub[1] - z * ub[0]) / det;
      const b = (ua[0] * z - ua[1] * x) / det;
      vertices_paper.push(p.paper[j]);
      return vertices_coords.push([0, 1, 2].map((c) => (c === 0 ? centre[0] : c === 2 ? centre[1] : 0) + a * da[c] + b * db[c] + rise * up[c]) as Vec3) - 1;
    });
  });
  return { vertices_paper, vertices_coords, faces_vertices, faces_parent: pieces.map((p) => p.parent) };
}

const centreOf = (pts: Vec2[]): Vec2 => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

/** Whether a point on the sheet lies on one of its scissor cuts. */
function onCut(q: Vec2, cuts: Cut[] | undefined): boolean {
  return (cuts ?? []).some(([a, b]) => {
    const d: Vec2 = [b[0] - a[0], b[1] - a[1]];
    const len2 = d[0] * d[0] + d[1] * d[1];
    const t = ((q[0] - a[0]) * d[0] + (q[1] - a[1]) * d[1]) / len2;
    if (t < -1e-9 || t > 1 + 1e-9) return false;
    return Math.hypot(a[0] + d[0] * t - q[0], a[1] + d[1] * t - q[1]) < 1e-7;
  });
}
