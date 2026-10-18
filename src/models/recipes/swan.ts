import { locate, paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * The traditional swan: a kite folded narrower, the point folded up for the neck and its tip down for the
 * head, then folded in half with the neck pulled up.
 */
export function swan() {
  const h = Math.SQRT1_2;
  const r = new Recipe({ id: 'swan', title: 'Swan', sheet: { size: [1, 1], front: '#fbfbf8', back: '#e3e9f0' } })
    .rotate(45, { title: 'Make a diamond', text: 'Turn the square so a corner points at you.' })
    .crease(table(-h, 0), table(h, 0), { title: 'Crease down the middle', text: 'Fold the left corner to the right corner, and unfold.' });

  // The diamond's corners, wherever the crease left them.
  const [top, bottom] = [table(0, -h), table(0, h)];
  r.edgeOnto([bottom, table(-h, 0)], [bottom, top], { title: 'Fold a kite', text: 'Fold the lower left edge to the centre crease.' })
    .edgeOnto([bottom, table(h, 0)], [bottom, top], { title: 'Fold the other side', text: 'And the lower right edge. It’s a kite.' })
    .turnOver('Turn the kite over.');

  // The kite's side corners, where the first folds' edges ended.
  const corner = (s: number) => table(s * (Math.SQRT2 - 1) * h * Math.SQRT2, h * (1 - Math.SQRT2));
  r.edgeOnto([bottom, corner(-1)], [bottom, top], { title: 'Fold the edges in again', text: 'Fold the long lower left edge to the centre crease, making it narrower.' })
    .edgeOnto([bottom, corner(1)], [bottom, top], { title: 'And the right edge', text: 'The same on the right.' });
  // The neck: the half below the middle, folded up over the body. Its pieces are kept for the head fold.
  const below = r.build().steps.at(-1)!.frame;
  r.onto(bottom, top, { title: 'Fold the point up', text: 'Fold the narrow point up to the top. This will be the neck.' });
  const neck = r.pieces((c) => locate(below, c)[1] > 0);
  const inNeck = (c: Vec2) => neck.some((poly) => inside(poly, c));
  r.along(table(-1, -0.45), table(1, -0.45), top, { title: 'Fold the tip down', text: 'Fold the tip of the neck back down a little way, for the head.', only: inNeck })
    .along(top, table(0, 0), table(-0.2, -0.1), { title: 'Fold in half', text: 'Fold the left half over onto the right, along the centre crease, so the neck is inside.' })
    .rotate(90, { title: 'Turn it', text: 'Turn it on its side, the neck along the bottom.' });
  // The neck's base is at the right end: an inside reverse fold there stands it up between the body's halves.
  r.collapse(
    { title: 'Pull the neck up', text: 'Open the body a little and pull the neck up between its sides, then flatten it again.', kind: 'reverse' },
    [{ through: [table(0.42, -0.236), table(0.32, -0.336)], kind: 'inside', only: inNeck }],
    paper(0.14, -0.27),
  );
  // The head: the top of the neck turned forwards by another inside reverse fold.
  // Where the neck now reaches highest (its corners on the table, from its pieces' corners on the sheet).
  const tops = r.pieces((c) => inNeck(c)).flat().map((p) => r.where(paper(...p)));
  const z = Math.min(...tops.map((p) => p[1]));
  const atTop = tops.filter((p) => p[1] < z + 0.02).map((p) => p[0]);
  const x = (Math.min(...atTop) + Math.max(...atTop)) / 2;
  r.collapse(
    { title: 'Turn the head', text: 'Pull the tip of the neck forwards between its layers to make the head. Your swan is ready.', kind: 'reverse' },
    [{ through: [table(x, z + 0.09), table(x + 0.1, z - 0.01)], kind: 'inside', only: inNeck }],
    paper(0.14, -0.27),
  );
  return r.build();
}

/** Whether a point is inside a convex polygon (or on its edge). */
function inside(poly: Vec2[], p: Vec2): boolean {
  const s = poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length];
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  });
  return s.every((x) => x >= -1e-9) || s.every((x) => x <= 1e-9);
}
