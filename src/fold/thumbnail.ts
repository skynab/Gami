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
  if (model.card === 'finished' && !flat(last)) return slanted(model, last, size);
  const k = model.steps.findLastIndex((s) => flat(s.frame)) + 1;
  const { box, body } = fromAbove(model, k ? model.steps[k - 1].frame : model.start, marksAt(model, k));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.join(' ')}" width="${size}" height="${size}">${body}</svg>
`;
}

const flat = (f: FoldFrame) => f.vertices_coords.every((p) => Math.abs(p[1]) < 1e-6);

/** The marks drawn by the end of step k. */
const marksAt = (model: OrigamiModel, k: number): Mark[] => marksUpTo(model, k).map((m) => m.mark);

/**
 * A flat frame seen from above: its faces bottom layer first, each with the marks drawn and tape stuck on its
 * upper side, and a square box round them.
 */
function fromAbove(model: OrigamiModel, frame: FoldFrame, marks: Mark[] = []): { box: number[]; body: string } {
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

function slanted(model: OrigamiModel, frame: FoldFrame, size: number): string {
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
      softly: face.map((u, c) => soft.has(key(u, face[(c + 1) % face.length]))),
      screen: world.map((p): Vec2 => [p[0], -dot(p, up)]),
      depth: world.reduce((s, p) => s + dot(p, toViewer), 0) / world.length,
      facing,
      offset: dot(facing, world[0]),
      front,
      light: Math.abs(dot(n, [0.3, 0.9, 0.3])),
    };
  });
  // Farthest first. Layers lying flat a hair apart go by which is higher, as their centres can lie anywhere: a big
  // floor face's centre may be nearer than a small flap's lying on it.
  const stacked = 0.01;
  const flat = (f: (typeof faces)[number]) => Math.abs(f.facing[1]) > 0.999;
  faces.sort((a, b) =>
    flat(a) && flat(b) && dot(a.facing, b.facing) > 0.999 && Math.abs(a.offset - b.offset) < stacked ? a.offset - b.offset : a.depth - b.depth,
  );
  const pts = faces.flatMap((f) => f.screen);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const pad = span * 0.08;
  const box = [(Math.min(...xs) + Math.max(...xs)) / 2 - span / 2 - pad, (Math.min(...ys) + Math.max(...ys)) / 2 - span / 2 - pad, span + 2 * pad, span + 2 * pad].map(
    (n) => +n.toFixed(4),
  );
  const stroke = +(span / 220).toFixed(5);
  const polys = faces
    .map((f) => {
      const fill = shade(faceColour(model, f.paper, f.front), 0.78 + 0.22 * f.light);
      const at = (p: Vec2) => p.map((n) => +n.toFixed(4)).join(',');
      const points = f.screen.map(at).join(' ');
      if (!f.softly.some(Boolean)) return `<polygon points="${points}" fill="${fill}"/>`;
      // Outlined in its own colour, closing the hairline seams between triangles, then lined on its other edges.
      const d = f.screen.flatMap((p, c) => (f.softly[c] ? [] : [`M${at(p)}L${at(f.screen[(c + 1) % f.screen.length])}`])).join('');
      return `<polygon points="${points}" fill="${fill}" stroke="${fill}" stroke-opacity="1"/>${d && `<path d="${d}" fill="none"/>`}`;
    })
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.join(' ')}" width="${size}" height="${size}">` +
    `<g stroke="#2b2a33" stroke-opacity=".45" stroke-width="${stroke}" stroke-linejoin="round">${polys}</g></svg>
`
  );
}

/** A #rrggbb colour made darker by `k` (0–1). */
function shade(hex: string, k: number): string {
  const c = [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
