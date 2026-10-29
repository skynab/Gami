import { toFlat } from '../../fold/fold';
import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * A kunai, Gami's own, from a square and a strip: the square's upper and lower edges folded to the middle into a
 * long-pointed diamond and its bottom point folded behind, the blade, and the strip folded lengthwise into a thin
 * handle, its end folded back for a pommel, slipped under the blade's base.
 */
export function kunai() {
  const r = new Recipe({
    id: 'kunai',
    title: 'Kunai',
    sheets: [
      { size: [0.8, 0.8], front: '#9bb8e8', back: '#2f5fb3', origin: [0, 0], at: [-0.5, 0] },
      { size: [0.16, 0.64], front: '#f6f3ec', back: '#2b2d31', origin: [10, 0], at: [0.4, 0] },
    ],
  });
  const blade = ([u]: Vec2) => u < 5;
  const handle = ([u]: Vec2) => u > 5;

  // The blade: a diamond `h` from its middle to each corner, its upper edges folded to the middle for the long
  // point, then its lower edges for the short one.
  const h = 0.4 * Math.SQRT2;
  r.move({ title: 'Turn the square', text: 'Turn the square so a corner points towards you, light side up.' }, blade, { degrees: 45 });
  const [bx, bz] = r.where(paper(0, 0));
  const [top, bottom] = [table(bx, bz - h), table(bx, bz + h)];
  r.crease(table(bx - h, bz), table(bx + h, bz), { title: 'Crease down the middle', text: 'Fold the left corner to the right corner, and unfold.', only: blade });
  r.together({ title: 'Fold a kite', text: 'Fold the upper edges to the middle crease, making a kite with a long point at the top.' }, (q) => {
    for (const s of [-1, 1]) q.edgeOnto([top, table(bx + s * h, bz)], [top, bottom], { title: '', only: blade });
  });
  // The kite's side corners, where those folds' edges ended.
  const corner = (s: number) => table(bx + s * (Math.SQRT2 - 1) * h * Math.SQRT2, bz + h * (Math.SQRT2 - 1));
  r.together({ title: 'Fold the lower edges in', text: 'Fold the short lower edges to the middle too: a long, sharp diamond.' }, (q) => {
    for (const s of [-1, 1]) q.edgeOnto([bottom, corner(s)], [bottom, top], { title: '', only: blade });
  });

  // A kunai's blade is short below its widest corners: the bottom point folds up behind, `base` below them.
  const widest = r.current.vertices_coords.reduce((a, p) => (p[0] > a[0] ? p : a))[2];
  const base = 0.16;
  r.along(table(bx - 1, widest + base), table(bx + 1, widest + base), bottom, {
    title: 'Fold the bottom behind',
    text: 'Fold the bottom point up behind, a little below the widest part, so the blade’s base is short.',
    kind: 'mountain',
    only: blade,
  });

  // The handle: the strip `w` wide folded to the middle from both sides, then in half, then its end folded back.
  const w = 0.16;
  const [hx, hz] = r.where(paper(10, 0));
  r.together({ title: 'Fold the strip’s edges in', text: 'Fold the long edges of the strip to its middle.' }, (q) => {
    for (const s of [-1, 1]) q.along(table(hx + (s * w) / 4, hz - 1), table(hx + (s * w) / 4, hz + 1), table(hx + (s * w) / 2.2, hz), { title: '', only: handle });
  });
  r.along(table(hx, hz - 1), table(hx, hz + 1), table(hx - w / 8, hz), { title: 'Fold the strip in half', text: 'Fold it in half lengthwise: a thin handle.', only: handle });
  const end = hz + 0.32;
  r.along(table(hx - 1, end - 0.06), table(hx + 1, end - 0.06), table(hx, end - 0.01), {
    title: 'Fold the end back',
    text: 'Fold the bottom end of the handle back up, a little way, for a pommel.',
    kind: 'mountain',
    only: handle,
  });

  // Slip the handle under the blade's short point.
  const box = (only: (c: Vec2) => boolean) => {
    const pts = toFlat(r.current)
      .filter((f) => only(f.paper[0]))
      .flatMap((f) => f.world);
    const xs = pts.map((p) => p[0]);
    const zs = pts.map((p) => p[1]);
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, top: Math.min(...zs), bottom: Math.max(...zs) };
  };
  const b = box(blade);
  const k = box(handle);
  r.move({ title: 'Add the handle', text: 'Slip the top of the handle under the blade’s base. Your kunai is ready.' }, handle, {
    to: table(b.x, b.bottom - 0.08 + (k.bottom - k.top) / 2),
    under: true,
  });
  return r.build();
}
