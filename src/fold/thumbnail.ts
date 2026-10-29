import { placeLike, toFlat } from './fold';
import { facePositions, normal } from './frames';
import { frontUp } from './geometry2d';
import { MARK_COLOUR, MARK_WIDTH, marksUpTo, onFace, type Mark } from './marks';
import { faceColour } from './sheets';
import { TAPE_COLOUR, TAPE_OPACITY } from './tape';
import type { FoldFrame, OrigamiModel, Vec2, Vec3 } from './types';

/**
 * The finished model as a small SVG for the gallery: seen from above, as it was before any 3D shaping, or
 * if the model asks (a fortune teller popped open), finished and seen from above at a slant. It needs no browser or WebGL, and its
 * transparent background suits light and dark themes.
 */
export function thumbnailSvg(model: OrigamiModel, size = 240): string {
  const last = model.steps.at(-1)?.frame ?? model.start;
  if (model.card === 'finished' && !flat(last)) return slanted(model, last, size, marksAt(model, model.steps.length));
  const k = model.steps.findLastIndex((s) => flat(s.frame)) + 1;
  const { box, body } = fromAbove(model, k ? model.steps[k - 1].frame : model.start, marksAt(model, k));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.join(' ')}" width="${size}" height="${size}">${body}</svg>
`;
}

export const flat = (f: FoldFrame) => f.vertices_coords.every((p) => Math.abs(p[1]) < 1e-6);

/** The marks drawn by the end of step k. */
export const marksAt = (model: OrigamiModel, k: number): Mark[] => marksUpTo(model, k).map((m) => m.mark);

/**
 * A flat frame seen from above: its faces bottom layer first, each with the marks drawn and tape stuck on its
 * upper side, and a square box round them.
 */
export function fromAbove(model: OrigamiModel, frame: FoldFrame, marks: Mark[] = []): { box: number[]; body: string } {
  const faces = toFlat(frame).sort((a, b) => a.layer - b.layer);
  const pts = faces.flatMap((f) => f.world);
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
  const pad = span * 0.08;
  const box = [
    (Math.min(...xs) + Math.max(...xs)) / 2 - span / 2 - pad,
    (Math.min(...zs) + Math.max(...zs)) / 2 - span / 2 - pad,
    span + 2 * pad,
    span + 2 * pad,
  ].map((n) => +n.toFixed(4));
  const stroke = +(span / 220).toFixed(5);
  const width = +(MARK_WIDTH * Math.max(...model.sheets.map((s) => Math.max(...s.size)))).toFixed(5);
  const polys = faces
    .map((f) => {
      const up = frontUp(f.world, f.paper);
      const fill = faceColour(model, f.paper, up);
      const points = f.world.map((p) => p.map((n) => +n.toFixed(4)).join(',')).join(' ');
      const place = placeLike(f);
      // Each mark's part on this face, if it's drawn on the side facing up.
      const drawn = marks
        .filter((m) => (m.side === 'front') === up)
        .flatMap((m) =>
          onFace(m, f.paper).map((part) => {
            const pts = part.map((p) => place(p).map((n) => +n.toFixed(4)).join(',')).join(' ');
            return m.fill
              ? `<polygon points="${pts}" fill="${MARK_COLOUR}" stroke="none"/>`
              : `<polyline points="${pts}" fill="none" stroke="${MARK_COLOUR}" stroke-opacity="1" stroke-width="${width}" stroke-linecap="round"/>`;
          }),
        )
        .join('');
      const taped = (frame.tapes ?? [])
        .flatMap((t) => t.pieces)
        .filter((m) => (m.side === 'front') === up)
        .flatMap((m) =>
          onFace(m, f.paper).map((part) => {
            const pts = part.map((p) => place(p).map((n) => +n.toFixed(4)).join(',')).join(' ');
            return `<polygon points="${pts}" fill="${TAPE_COLOUR}" fill-opacity="${TAPE_OPACITY}" stroke="none"/>`;
          }),
        )
        .join('');
      return `<polygon points="${points}" fill="${fill}"/>${drawn}${taped}`;
    })
    .join('');
  return { box, body: `<g stroke="#2b2a33" stroke-opacity=".45" stroke-width="${stroke}" stroke-linejoin="round">${polys}</g>` };
}

/** How many moments a preview shows, and how long each. */
const PREVIEW_FRAMES = 8;
const PREVIEW_SECONDS = 0.9;

/**
 * A short looping preview for the gallery card, shown on hover: a few of the model's flat states from the
 * sheet to the finish, evenly spaced, each framed on its own (the sheet is much bigger than the model) and
 * shown in turn. Still, on the finished state, for anyone who prefers less motion.
 */
export function previewSvg(model: OrigamiModel, size = 240): string {
  // Each flat state, with how many steps it's after (for the marks drawn by then).
  const frames = [model.start, ...model.steps.map((s) => s.frame)].map((frame, k) => ({ frame, k })).filter(({ frame }) => flat(frame));
  const n = Math.min(PREVIEW_FRAMES, frames.length);
  const picked = Array.from({ length: n }, (_, i) => frames[Math.round((i * (frames.length - 1)) / Math.max(1, n - 1))]);
  const cycle = n * PREVIEW_SECONDS;
  const share = +(100 / n).toFixed(3);
  const style =
    `.f{opacity:0;animation:show ${cycle}s step-end infinite}` +
    `@keyframes show{0%{opacity:1}${share}%{opacity:0}100%{opacity:0}}` +
    picked.map((_, i) => `.f${i}{animation-delay:${(i * PREVIEW_SECONDS).toFixed(2)}s}`).join('') +
    `@media (prefers-reduced-motion:reduce){.f{animation:none}.f${n - 1}{opacity:1}}`;
  const views = picked
    .map(({ frame, k }, i) => {
      const { box, body } = fromAbove(model, frame, marksAt(model, k));
      return `<svg class="f f${i}" viewBox="${box.join(' ')}" width="${size}" height="${size}">${body}</svg>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><style>${style}</style>${views}</svg>
`;
}

/** How steeply the slanted view looks down at a model finished in 3D. */
const SLANT = (55 * Math.PI) / 180;

function slanted(model: OrigamiModel, frame: FoldFrame, size: number, marks: Mark[] = []): string {
  // Looking down from above and in front: screen right is +x, screen up tilts back with the view.
  const toViewer: Vec3 = [0, Math.sin(SLANT), Math.cos(SLANT)];
  const up: Vec3 = [0, Math.cos(SLANT), -Math.sin(SLANT)];
  const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // Where each face is drawn, flat-lying layers lifted by their gaps as the viewer draws them.
  const placed = facePositions(frame);
  // Edges between triangles of paper that bends get no line.
  const key = (u: number, v: number) => (u < v ? `${u} ${v}` : `${v} ${u}`);
  const soft = new Set((frame.soft ?? []).map(([u, v]) => key(u, v)));
  const faces = frame.faces_vertices.map((face, f) => {
    const world = placed[f];
    const n = normal(world);
    const front = dot(n, toViewer) > 0;
    // The face's plane, its normal turned towards the viewer, and how far along that normal the plane lies.
    const facing: Vec3 = front ? n : [-n[0], -n[1], -n[2]];
    return {
      paper: face.map((v) => frame.vertices_paper[v]),
      world,
      softly: face.map((u, c) => soft.has(key(u, face[(c + 1) % face.length]))),
      screen: world.map((p): Vec2 => [p[0], -dot(p, up)]),
      depth: world.reduce((s, p) => s + dot(p, toViewer), 0) / world.length,
      facing,
      offset: dot(facing, world[0]),
      front,
      light: Math.abs(dot(n, [0.3, 0.9, 0.3])),
    };
  });
  // Farthest first. Where two faces cover each other on the card, the one nearer the viewer there goes after the
  // other, however their middles lie: a big floor face's middle may be nearer than a small flap's lying on it, or a
  // cube's face's than the flap over it.
  const order = paintOrder(faces, ({ facing, offset }, [x, y]) => {
    // The depth towards the viewer of the point of the face's plane drawn at (x, y): x along +x, −y along `up`.
    const across = dot(facing, toViewer);
    return across > 1e-6 ? (offset - facing[0] * x + dot(facing, up) * y) / across : null;
  });
  faces.splice(0, faces.length, ...order.map((i) => faces[i]));
  const pts = faces.flatMap((f) => f.screen);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const pad = span * 0.08;
  const box = [(Math.min(...xs) + Math.max(...xs)) / 2 - span / 2 - pad, (Math.min(...ys) + Math.max(...ys)) / 2 - span / 2 - pad, span + 2 * pad, span + 2 * pad].map(
    (n) => +n.toFixed(4),
  );
  const stroke = +(span / 220).toFixed(5);
  const width = +(MARK_WIDTH * Math.max(...model.sheets.map((s) => Math.max(...s.size)))).toFixed(5);
  const polys = faces
    .map((f) => {
      const fill = shade(faceColour(model, f.paper, f.front), 0.78 + 0.22 * f.light);
      const at = (p: Vec2) => p.map((n) => +n.toFixed(4)).join(',');
      const points = f.screen.map(at).join(' ');
      // Each mark's part on this face, if it's drawn on the side facing the viewer, as the face is drawn.
      const onScreen = (p: Vec2): Vec2 => {
        const q = toWorld(f.paper, f.world)(p);
        return [q[0], -dot(q, up)];
      };
      const drawn = marks
        .filter((m) => (m.side === 'front') === f.front)
        .flatMap((m) =>
          onFace(m, f.paper).map((part) => {
            const pts = part.map((p) => at(onScreen(p))).join(' ');
            return m.fill
              ? `<polygon points="${pts}" fill="${MARK_COLOUR}" stroke="none"/>`
              : `<polyline points="${pts}" fill="none" stroke="${MARK_COLOUR}" stroke-opacity="1" stroke-width="${width}" stroke-linecap="round"/>`;
          }),
        )
        .join('');
      if (!f.softly.some(Boolean)) return `<polygon points="${points}" fill="${fill}"/>${drawn}`;
      // Outlined in its own colour, closing the hairline seams between triangles, then lined on its other edges.
      const d = f.screen.flatMap((p, c) => (f.softly[c] ? [] : [`M${at(p)}L${at(f.screen[(c + 1) % f.screen.length])}`])).join('');
      return `<polygon points="${points}" fill="${fill}" stroke="${fill}" stroke-opacity="1"/>${d && `<path d="${d}" fill="none"/>`}${drawn}`;
    })
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.join(' ')}" width="${size}" height="${size}">` +
    `<g stroke="#2b2a33" stroke-opacity=".45" stroke-width="${stroke}" stroke-linejoin="round">${polys}</g></svg>
`
  );
}

/**
 * The order to paint faces in, farthest first: for each two that cover each other on the card, the one nearer at
 * a point they both cover goes after the other (`depthAt`, the depth of a face's plane drawn at a point, nearer
 * being more). Faces nothing decides between go by their middles' depths.
 */
function paintOrder<F extends { screen: Vec2[]; depth: number }>(faces: F[], depthAt: (face: F, at: Vec2) => number | null): number[] {
  const n = faces.length;
  const boxes = faces.map(({ screen }) => {
    const xs = screen.map((p) => p[0]);
    const ys = screen.map((p) => p[1]);
    return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  });
  const after = faces.map((): number[] => []);
  const before = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const [a, b] = [boxes[i], boxes[j]];
      if (a[1] <= b[0] || b[1] <= a[0] || a[3] <= b[2] || b[3] <= a[2]) continue;
      const shared = clip(faces[i].screen, faces[j].screen);
      if (shared.length < 3 || Math.abs(area(shared)) < 1e-9) continue;
      const at: Vec2 = [shared.reduce((s, p) => s + p[0], 0) / shared.length, shared.reduce((s, p) => s + p[1], 0) / shared.length];
      const [di, dj] = [depthAt(faces[i], at), depthAt(faces[j], at)];
      if (di === null || dj === null || Math.abs(di - dj) < 1e-9) continue;
      const [far, near] = di < dj ? [i, j] : [j, i];
      after[far].push(near);
      before[near]++;
    }
  }
  // Painted in that order, the farthest middle first among those free to go. Faces can cover each other in a ring
  // (three flaps meeting in a cube's corner, each over the next): then the ring is broken inside itself, a face of
  // it waiting only on others of the ring going first, so faces outside the ring still wait for all of it.
  const ring = rings(after);
  const outside = new Array<number>(n).fill(0);
  after.forEach((ks, i) => ks.forEach((k) => ring[k] !== ring[i] && outside[k]++));
  const order: number[] = [];
  const done = new Array<boolean>(n).fill(false);
  const byDepth = faces.map((_, i) => i).sort((a, b) => faces[a].depth - faces[b].depth);
  while (order.length < n) {
    const next = byDepth.find((i) => !done[i] && !before[i]) ?? byDepth.find((i) => !done[i] && !outside[i]) ?? byDepth.find((i) => !done[i])!;
    done[next] = true;
    order.push(next);
    for (const k of after[next]) {
      before[k]--;
      if (ring[k] !== ring[next]) outside[k]--;
    }
  }
  return order;
}

/** Which ring of a graph each node is in (its strongly connected component, by Tarjan's method), as a number. */
function rings(after: number[][]): number[] {
  const n = after.length;
  const index = new Array<number>(n).fill(-1);
  const low = new Array<number>(n).fill(0);
  const ring = new Array<number>(n).fill(-1);
  const stack: number[] = [];
  const onStack = new Array<boolean>(n).fill(false);
  let count = 0;
  let rings = 0;
  // Depth first without recursion: each frame is a node and how far through its edges it is.
  for (let root = 0; root < n; root++) {
    if (index[root] >= 0) continue;
    const frames: [number, number][] = [[root, 0]];
    index[root] = low[root] = count++;
    stack.push(root);
    onStack[root] = true;
    while (frames.length) {
      const frame = frames[frames.length - 1];
      const [v, e] = frame;
      if (e < after[v].length) {
        frame[1]++;
        const w = after[v][e];
        if (index[w] < 0) {
          index[w] = low[w] = count++;
          stack.push(w);
          onStack[w] = true;
          frames.push([w, 0]);
        } else if (onStack[w]) low[v] = Math.min(low[v], index[w]);
        continue;
      }
      frames.pop();
      if (frames.length) low[frames[frames.length - 1][0]] = Math.min(low[frames[frames.length - 1][0]], low[v]);
      if (low[v] === index[v]) {
        let w: number;
        do {
          w = stack.pop()!;
          onStack[w] = false;
          ring[w] = rings;
        } while (w !== v);
        rings++;
      }
    }
  }
  return ring;
}

/** The part of convex polygon `a` inside convex polygon `b`. */
function clip(a: Vec2[], b: Vec2[]): Vec2[] {
  const turn = area(b) < 0 ? -1 : 1;
  let out = a;
  for (let i = 0; i < b.length && out.length; i++) {
    const [p, q] = [b[i], b[(i + 1) % b.length]];
    const side = (x: Vec2) => turn * ((q[0] - p[0]) * (x[1] - p[1]) - (q[1] - p[1]) * (x[0] - p[0]));
    const input = out;
    out = [];
    input.forEach((cur, k) => {
      const prev = input[(k + input.length - 1) % input.length];
      const [sc, sp] = [side(cur), side(prev)];
      if (sc >= 0 !== sp >= 0) {
        const t = sp / (sp - sc);
        out.push([prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])]);
      }
      if (sc >= 0) out.push(cur);
    });
  }
  return out;
}

/** Twice a polygon's signed area. */
const area = (poly: Vec2[]) => poly.reduce((s, p, i) => s + p[0] * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * p[1], 0);

/** Maps points on the sheet to a face's place in 3D, from its corners on the sheet and in space. */
function toWorld(paper: Vec2[], world: Vec3[]): (p: Vec2) => Vec3 {
  // The two edges from the first corner spanning the most paper, for a well-shaped map.
  let [j, k] = [1, 2];
  let most = -1;
  for (let a = 1; a < paper.length; a++) {
    for (let b = a + 1; b < paper.length; b++) {
      const span = Math.abs((paper[a][0] - paper[0][0]) * (paper[b][1] - paper[0][1]) - (paper[a][1] - paper[0][1]) * (paper[b][0] - paper[0][0]));
      if (span > most) [most, j, k] = [span, a, b];
    }
  }
  const [q0, q1, q2] = [paper[0], paper[j], paper[k]];
  const [w0, w1, w2] = [world[0], world[j], world[k]];
  const det = (q1[0] - q0[0]) * (q2[1] - q0[1]) - (q1[1] - q0[1]) * (q2[0] - q0[0]);
  return ([u, v]) => {
    const [du, dv] = [u - q0[0], v - q0[1]];
    const alpha = (du * (q2[1] - q0[1]) - dv * (q2[0] - q0[0])) / det;
    const beta = ((q1[0] - q0[0]) * dv - (q1[1] - q0[1]) * du) / det;
    return [0, 1, 2].map((c) => w0[c] + alpha * (w1[c] - w0[c]) + beta * (w2[c] - w0[c])) as Vec3;
  };
}

/** A #rrggbb colour made darker by `k` (0–1). */
function shade(hex: string, k: number): string {
  const c = [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
