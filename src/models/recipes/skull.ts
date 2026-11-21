import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * A skull, Gami's own, after the look of OrigamiOK's (a pale skull face, dark eye sockets and nose, a row of teeth)
 * but folded differently: the blintz, dark side out, so the face is the pale back of the paper. The top corner goes
 * a little past the middle, the side corners to it, and the side flaps' tips are folded back out: where each tip was,
 * the dark middle of the sheet shows through, and the tip turned over is dark too, together an eye socket. The top
 * flap reaching past the middle leaves a pale bridge between them. The cranium's corners and the jaw are folded
 * behind, and the nose and teeth are drawn.
 */
export function skull() {
  const r = new Recipe({ id: 'skull', title: 'Skull', sheet: { size: [1, 1], front: '#2b2a30', back: '#efe8da' } });
  r.rotate(45, { title: 'Turn it to a diamond', text: 'Start dark side up, and turn the square so a corner points towards you.' });

  // As a diamond, the sheet's corners sit R from the middle; folded in, the blintz is a square half as wide.
  const R = Math.SQRT1_2;
  const h = R / 2;
  const corners: Vec2[] = [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ];
  const at = corners.map((c) => ({ c, w: r.where(paper(...c)) }));
  const corner = (pick: (w: Vec2) => number) => at.reduce((a, b) => (pick(b.w) < pick(a.w) ? b : a)).c;
  const left = corner((w) => w[0]);
  const right = corner((w) => -w[0]);
  // A flap: the corner triangle beyond the line between its two edges' middles.
  const flap = (k: Vec2) => (c: Vec2) => c[0] * k[0] + c[1] * k[1] > 0.25;

  r.crease(table(-R, 0), table(R, 0), { title: 'Crease across', text: 'Fold the left corner to the right corner, then unfold.' }).crease(table(0, -R), table(0, R), {
    title: 'Crease down',
    text: 'Fold the bottom corner to the top corner, then unfold. The creases cross in the middle.',
  });

  // The top corner, a little past the middle: its flap then reaches over the inner points of the eyes.
  const past = 0.05;
  const top = (past - R) / 2;
  r.along(table(-1, top), table(1, top), table(0, -R), {
    title: 'Fold the top corner down',
    text: 'Fold the top corner down, a little past the middle.',
  })
    .along(table(-1, h), table(1, h), table(0, R), { title: 'Fold the bottom corner up', text: 'Fold the bottom corner up to the middle.' })
    .along(table(-h, -1), table(-h, 1), table(-R, 0), { title: 'Fold the left corner in', text: 'Fold the left corner to the middle.' })
    .along(table(h, -1), table(h, 1), table(R, 0), { title: 'Fold the right corner in', text: 'And the right corner. It’s a square, pale side up.' });

  // The eyes: each side flap's tip folded back out on itself.
  const eye = 0.12;
  r.along(table(-eye, -1), table(-eye, 1), table(-eye / 2, 0), {
    title: 'Fold back the left point',
    text: 'Fold the point of the left flap back out to the left. The dark side shows: an eye socket.',
    only: flap(left),
  }).along(table(eye, -1), table(eye, 1), table(eye / 2, 0), {
    title: 'Fold back the right point',
    text: 'The same on the right, for the other eye.',
    only: flap(right),
  });

  // The cranium's top corners and the jaw's sides, folded behind.
  // The top edge is the top flap's fold, a little below the blintz's.
  const cut = 0.13;
  const jawTop = 0.08;
  const jaw = 0.09;
  r.along(table(-h, top + cut), table(-h + cut, top), table(-h + 0.01, top + 0.01), {
    title: 'Round the top',
    text: 'Fold the two top corners behind a little, to round the top of the skull.',
    kind: 'mountain',
  })
    .along(table(h, top + cut), table(h - cut, top), table(h - 0.01, top + 0.01), { title: 'Round the other corner', text: 'And the other one.', kind: 'mountain' })
    .along(table(-h, jawTop), table(-h + jaw, h), table(-h, h), {
      title: 'Narrow the jaw',
      text: 'Fold the lower left side behind at a slant, from the level of the eyes down, so the jaw is narrower.',
      kind: 'mountain',
    })
    .along(table(h, jawTop), table(h - jaw, h), table(h, h), { title: 'Narrow the other side', text: 'Match it on the right.', kind: 'mountain' });

  // The nose, a dark upside-down triangle below the eyes, and the teeth: a line between the jaws, crossed by short
  // lines, on the bottom flap.
  const nose: Vec2[] = [
    [-0.045, 0.115],
    [0.045, 0.115],
    [0, 0.19],
  ];
  const mouth = 0.27;
  const teeth = [-0.12, -0.072, -0.024, 0.024, 0.072, 0.12];
  return r
    .draw({ title: 'Draw the nose and teeth', text: 'Draw an upside-down triangle for the nose, and a row of teeth below it. Done!' }, [
      { fill: nose },
      { line: [[teeth[0], mouth], [teeth.at(-1)!, mouth]] },
      ...teeth.map((x) => ({ line: [[x, mouth - 0.045], [x, mouth + 0.045]] as Vec2[] })),
    ])
    .build();
}
