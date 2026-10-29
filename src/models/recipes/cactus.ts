import { toFlat } from '../../fold/fold';
import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * A potted cactus, Gami's own, after the look of OrigamiOK's (a ribbed green body in a pot, a flower on top) but
 * with no glue or scissors: three squares. The body is folded to the middle from both sides, the folds' inner
 * edges turned back out into ribs and its top corners rounded; the pot is a square with a rim folded down and its
 * sides and bottom folded behind; the flower is a small square with its corners folded to the middle.
 */
export function cactus() {
  const r = new Recipe({
    id: 'cactus',
    title: 'Cactus',
    sheets: [
      { size: [1, 1], front: '#2f7d43', back: '#7cc47a', origin: [0, 0], at: [-1.2, 0] },
      { size: [0.8, 0.8], front: '#c0643c', back: '#e39a72', origin: [10, 0], at: [0, 0] },
      { size: [0.3, 0.3], front: '#f6f3ec', back: '#e8436a', origin: [20, 0], at: [0.8, -0.2] },
    ],
  });
  const body = ([u]: Vec2) => u < 5;
  const pot = ([u]: Vec2) => u > 5 && u < 15;
  const flower = ([u]: Vec2) => u > 15;
  const along = (a: Vec2, b: Vec2, moving: Vec2, step: { title: string; text?: string; kind?: 'mountain'; only: (c: Vec2) => boolean }) =>
    r.along(table(...a), table(...b), table(...moving), step);

  // The body: its sides folded to the middle, then a narrow strip of each turned back out, for ribs.
  const [bx, bz] = r.where(paper(0, 0));
  r.together({ title: 'Fold the sides to the middle', text: 'Start with the big green square, dark side up. Fold its left and right edges to the middle.' }, (q) => {
    for (const s of [-1, 1]) q.along(table(bx + s * 0.25, bz - 1), table(bx + s * 0.25, bz + 1), table(bx + s * 0.4, bz), { title: '', only: body });
  });
  const rib = 0.05;
  r.together({ title: 'Fold out the ribs', text: 'Fold each flap’s inner edge back out a little way, so a dark stripe shows down the middle.' }, (q) => {
    for (const s of [-1, 1]) {
      q.along(table(bx + s * rib, bz - 1), table(bx + s * rib, bz + 1), table(bx + s * 0.01, bz), { title: '', only: ([u]) => body([u, 0]) && s * u > 0.25 });
    }
  });
  const round = 0.09;
  r.together({ title: 'Round the top', text: 'Fold the two top corners behind, a little way.' }, (q) => {
    for (const s of [-1, 1]) {
      q.along(table(bx + s * 0.25, bz - 0.5 + round), table(bx + s * (0.25 - round), bz - 0.5), table(bx + s * 0.24, bz - 0.49), { title: '', kind: 'mountain', only: body });
    }
  });

  // The pot: a rim folded down in front, the sides folded behind at a slant, and the bottom folded behind.
  const [px, pz] = r.where(paper(10, 0));
  const half = 0.4;
  const rim = pz - half + 0.12;
  along([px - 1, rim], [px + 1, rim], [px, pz - half + 0.01], { title: 'Fold down the rim', text: 'Now the pot: fold the top edge of the orange square down a little way, for the rim.', only: pot });
  r.together({ title: 'Slant the sides', text: 'Fold the left and right edges behind at a slant, so the pot is narrower at the bottom.' }, (q) => {
    for (const s of [-1, 1]) {
      q.along(table(px + s * (half - 0.05), pz - half), table(px + s * (half - 0.17), pz + half), table(px + s * (half - 0.01), pz), { title: '', kind: 'mountain', only: pot });
    }
  });
  const base = pz + 0.18;
  along([px - 1, base], [px + 1, base], [px, pz + half - 0.01], { title: 'Fold the bottom behind', text: 'Fold the bottom of the pot behind.', kind: 'mountain', only: pot });

  // The flower: the corners of the small square folded to its middle, showing four petals.
  const [fx, fz] = r.where(paper(20, 0));
  r.together({ title: 'Fold the flower', text: 'Last, the flower: fold the four corners of the small square to its middle.' }, (q) => {
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) q.onto(table(fx + sx * 0.15, fz + sz * 0.15), table(fx, fz), { title: '', only: flower });
  });

  // Put them together: the body behind the pot, standing in it, and the flower on top of the body.
  const span = (only: (c: Vec2) => boolean) => {
    const zs = toFlat(r.current)
      .filter((f) => only(f.paper[0]))
      .flatMap((f) => f.world.map((p) => p[1]));
    return [Math.min(...zs), Math.max(...zs)];
  };
  const [bodyTop, bodyBottom] = span(body);
  r.move({ title: 'Stand it in the pot', text: 'Slide the body down behind the rim of the pot.' }, body, {
    to: table(px, pz - (bodyBottom - bodyTop) / 2 + 0.05),
    under: true,
  });
  const [top] = span(body);
  r.move({ title: 'Add the flower', text: 'Put the flower on top, a corner pointing up. Your cactus is in bloom!' }, flower, {
    to: table(px, top + 0.04),
  });
  return r.build();
}
