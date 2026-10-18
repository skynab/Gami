import { toFlat } from './fold';
import { normal } from './frames';
import { frontUp } from './geometry2d';
import { faceColour } from './sheets';
import type { FoldFrame, OrigamiModel, Vec2, Vec3 } from './types';

/**
 * The finished model as a small SVG for the gallery: seen from above, as it was before any 3D shaping, or
 * if the model asks (a fortune teller popped open), finished and seen from above at a slant. It needs no browser or WebGL, and its
 * transparent background suits light and dark themes.
 */
export function thumbnailSvg(model: OrigamiModel, size = 240): string {
  const flat = (f: FoldFrame) => f.vertices_coords.every((p) => Math.abs(p[1]) < 1e-6);
  const last = model.steps.at(-1)?.frame ?? model.start;
  if (model.card === 'finished' && !flat(last)) return slanted(model, last, size);
  const frame = model.steps.map((s) => s.frame).findLast(flat) ?? model.start;
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
  const polys = faces
    .map((f) => {
      const fill = faceColour(model, f.paper, frontUp(f.world, f.paper));
      const points = f.world.map((p) => p.map((n) => +n.toFixed(4)).join(',')).join(' ');
      return `<polygon points="${points}" fill="${fill}"/>`;
    })
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.join(' ')}" width="${size}" height="${size}">` +
    `<g stroke="#2b2a33" stroke-opacity=".45" stroke-width="${stroke}" stroke-linejoin="round">${polys}</g></svg>\n`
  );
}

/** How steeply the slanted view looks down at a model finished in 3D. */
const SLANT = (55 * Math.PI) / 180;

function slanted(model: OrigamiModel, frame: FoldFrame, size: number): string {
  // Looking down from above and in front: screen right is +x, screen up tilts back with the view.
  const toViewer: Vec3 = [0, Math.sin(SLANT), Math.cos(SLANT)];
  const up: Vec3 = [0, Math.cos(SLANT), -Math.sin(SLANT)];
  const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const faces = frame.faces_vertices.map((face) => {
    const world = face.map((v) => frame.vertices_coords[v]);
    const n = normal(world);
    return {
      paper: face.map((v) => frame.vertices_paper[v]),
      screen: world.map((p): Vec2 => [p[0], -dot(p, up)]),
      depth: world.reduce((s, p) => s + dot(p, toViewer), 0) / world.length,
      front: dot(n, toViewer) > 0,
      light: Math.abs(dot(n, [0.3, 0.9, 0.3])),
    };
  });
  faces.sort((a, b) => a.depth - b.depth);
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
      return `<polygon points="${f.screen.map((p) => p.map((n) => +n.toFixed(4)).join(',')).join(' ')}" fill="${fill}"/>`;
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
