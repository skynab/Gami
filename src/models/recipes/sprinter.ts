import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { foldWings } from './paper-plane';

/**
 * The sprinter, a swept-wing plane with a tall tail fin: one corner folded onto the opposite one, the long edge
 * folded over and the whole folded in half, then each layer folded back on itself from the thick corner. The
 * outer layers become the wings and the inner ones stand up between them as the fin. From a sheet of US letter
 * paper, held sideways (11 : 8.5).
 */
export function sprinter() {
  const w = 1;
  // US letter is 11 : 8.5; 1 : 0.77 is near enough, and exact in a .fold file.
  const h = 0.77;
  const [l, r, top, bottom] = [-w / 2, w / 2, -h / 2, h / 2];
  // The strip folded over along the long edge, and the body under the wings: each about 3/4 inch (19 mm).
  const strip = 0.068;
  // Folding the bottom-left corner onto the top-right one creases across the middle at right angles to the
  // diagonal; `along` runs the diagonal's way, from the middle towards the top-right corner.
  const diagonal = Math.hypot(w, h);
  const along: Vec2 = [w / diagonal, -h / diagonal];
  // The strip's fold, across the middle: it meets the diagonal (the plane's halving fold) in the thick corner.
  const corner: Vec2 = [strip * along[0], strip * along[1]];
  const across: Vec2 = [-along[1], along[0]];
  // The plane's halves, either side of the diagonal: the one with the bottom-right corner folds over on top.
  const turned = (p: Vec2) => along[0] * p[1] - along[1] * p[0] > 0;
  // From the thick corner, the strip's edge runs one way and the halving fold the other, at right angles. Each
  // layer folds back along the line halfway between them: `keel`, a point along it.
  const keel: Vec2 = [corner[0] + 0.15 * (along[0] - across[0]), corner[1] + 0.15 * (along[1] - across[1])];
  // A point on the strip's side of that line, on paper none of the first three folds moves.
  const wingSide: Vec2 = [corner[0] - 0.15 * across[0] + 0.05 * along[0], corner[1] - 0.15 * across[1] + 0.05 * along[1]];

  const plane = new Recipe({
    id: 'sprinter',
    title: 'Sprinter',
    sheet: { size: [w, h], front: '#f6f3ec', back: '#2a9d8f' },
  }).onto(paper(l, bottom), table(r, top), {
    title: 'Fold one corner onto the other',
    text: 'With the paper sideways, bring the bottom-left corner up onto the top-right corner and crease. The flap’s other corner sticks out past the top edge.',
  });
  const first = plane.lying(turned);
  plane
    .along(table(corner[0] - across[0], corner[1] - across[1]), table(corner[0] + across[0], corner[1] + across[1]), table(0, 0), {
      title: 'Fold over the long edge',
      text: 'Fold a narrow strip, about 2 cm (3/4 inch) wide, over along the long folded edge.',
    })
    .along(table(0, 0), table(r, top), table(r, bottom), {
      title: 'Fold in half',
      text: 'Fold from the middle of the strip to the top-right corner, bringing the bottom-right corner up over the top left. The strip ends in a thick corner at the bottom.',
    });
  // Each layer's wing: its paper on the strip's side of the fold through the thick corner.
  const wingSideOf = plane.lying(([x, z]) => (keel[0] - corner[0]) * (z - corner[1]) - (keel[1] - corner[1]) * (x - corner[0]) < 0);
  const wing = (layer: (c: Vec2) => boolean) => (c: Vec2) => layer(c) && wingSideOf(c);
  plane
    .along(paper(...corner), paper(...keel), paper(...wingSide), {
      title: 'Fold the top layer back',
      text: 'Fold it back on itself along a line straight up from the thick corner, so the strip lies along the folded edge.',
      only: first,
    })
    .turnOver()
    .along(paper(...corner), paper(...keel), paper(...wingSide), {
      title: 'Fold the other layer to match',
      text: 'Fold it back along the same line. The two folds make the bottom edge of the plane.',
      only: (c) => !first(c),
    })
    // The fold through the thick corner, turned to run along the bottom with the corner (the nose) at the left.
    .rotate((Math.atan2(keel[1] - corner[1], corner[0] - keel[0]) * 180) / Math.PI, {
      title: 'Turn it on its side',
      text: 'Point the thick corner to the left, with the long folded edge at the bottom.',
    });
  return foldWings(
    plane,
    strip,
    'Fold the top layer down along a line about 2 cm (3/4 inch) above the bottom. The layers inside stay up: they’re the tail fin.',
    wing((c) => !first(c)),
    wing(first),
    {
      fin: true,
      flyText: 'Turn the plane over, so it stands on its keel with the fin up between its wings. A few staples in the nose help it fly straight and keep the body shut.',
    },
  );
}
