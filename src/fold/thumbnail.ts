import { toFlat } from './fold';
import { frontUp } from './geometry2d';
import { faceColour } from './sheets';
import type { OrigamiModel } from './types';

/**
 * The finished model seen from above, as a small SVG for the gallery. Built from the last frame,
 * so it needs no browser or WebGL, and its transparent background suits light and dark themes.
 */
export function thumbnailSvg(model: OrigamiModel, size = 240): string {
  const frame = model.steps.at(-1)?.frame ?? model.start;
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
