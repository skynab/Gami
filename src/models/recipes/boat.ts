import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * The traditional paper boat, from an A4 sheet, following origami.me/traditional-boat, as far as the small
 * diamond. Not in the gallery yet: opening it into a boat waits for bending (docs/bending-plan.md, step 7).
 */
export function boat() {
  const h = Math.SQRT2 / 2;
  const r = new Recipe({ id: 'boat', title: 'Boat', sheet: { size: [1, Math.SQRT2], front: '#3b82c4', back: '#f6f3ec' } })
    .crease(paper(-0.5, 0), paper(0.5, 0), { title: 'Crease down the middle', text: 'Fold in half side to side, then unfold.' })
    .onto(paper(0, -h), paper(0, h), { title: 'Fold in half', text: 'Fold the top edge down to the bottom edge.' })
    .onto(table(-0.5, 0), table(0, 0.5), { title: 'Fold the left corner down', text: 'Fold the top left corner down to the centre crease.' })
    .onto(table(0.5, 0), table(0, 0.5), { title: 'Fold the right corner down', text: 'And the right one. It’s a triangle with a strip underneath.' })
    .along(table(-1, 0.5), table(1, 0.5), table(0, h), {
      title: 'Fold the strip up',
      text: 'Fold the top layer of the strip up over the triangle.',
      only: ([, v]) => v < 0,
    })
    .along(table(-1, 0.5), table(1, 0.5), table(0, h), {
      title: 'Fold the back strip up',
      text: 'Fold the other layer of the strip up behind. It looks like a hat.',
      kind: 'mountain',
      only: ([, v]) => v > 0,
    });

  // The hat opens at the bottom and flattens the other way: the front and back fold along the middle crease,
  // and the corner flaps open along the hat's original top edge. A diamond.
  const corner = ([u, v]: Vec2) => Math.abs(v) < Math.abs(u);
  const front = ([u, v]: Vec2) => v < 0 && !corner([u, v]);
  const back = ([u, v]: Vec2) => v > 0 && !corner([u, v]);
  r.collapse(
    {
      title: 'Open it into a diamond',
      text: 'Open the hat from the bottom and push the two sides together, so it flattens into a diamond. Tuck one end of the strip under the other.',
      kind: 'squash',
    },
    [
      { through: [table(0, -1), table(0, 1)], kind: 'mountain', only: front },
      { through: [table(0, -1), table(0, 1)], kind: 'valley', only: back },
      { through: [table(0, 0), table(-0.5, 0.5)], kind: 'flat', only: ([, v]) => v > 0 },
      { through: [table(0, 0), table(0.5, 0.5)], kind: 'flat', only: ([, v]) => v > 0 },
    ],
    paper(-0.3, -0.4),
  ).rotate(45, { title: 'Turn it', text: 'Turn the diamond so the closed point is at the top.' });
  const F = r.where(paper(0, -0.5));
  const K = r.where(paper(0, 0.5));
  const D = r.where(paper(-0.5, -0.5));
  // The diamond's front layers come from the sheet's left half (u < 0), its back layers from the right half.
  r.along(table(...F), table(...K), table(...D), {
    title: 'Fold the bottom up',
    text: 'Fold the front flap’s bottom point up to the top point.',
    only: ([u]) => u < 0,
  }).turnOver();
  r.along(table(...r.where(paper(0, -0.5))), table(...r.where(paper(0, 0.5))), table(...r.where(paper(0.5, 0.5))), {
    title: 'Fold the other side up',
    text: 'Fold this side’s bottom point up to match. It’s a small hat.',
    only: ([u]) => u > 0,
  });
  {
    const A = r.where(paper(0, 0));
    const F2 = r.where(paper(0, -0.5));
    const K2 = r.where(paper(0, 0.5));
    const mid: [number, number] = [(F2[0] + K2[0]) / 2, (F2[1] + K2[1]) / 2];
    r.collapse(
      { title: 'Open it into a diamond again', text: 'Open the bottom and push the two sides together again, flattening a smaller diamond.', kind: 'squash' },
      [
        { through: [table(...A), table(...mid)], kind: 'mountain', only: ([u]) => u < 0 },
        { through: [table(...A), table(...mid)], kind: 'valley', only: ([u]) => u > 0 },
        { through: [table(...A), table(...F2)], kind: 'flat' },
        { through: [table(...A), table(...K2)], kind: 'flat' },
      ],
      paper(-0.2, -0.3),
    );
  }
  return r;
}
