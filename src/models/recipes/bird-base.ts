import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * The square base: creased in diagonals and halves, collapsed, and turned so the loose corners point towards
 * you. The start of the bird base and the frog base. `only` keeps the folds to one sheet, when others share the
 * table (turning the table still turns them all).
 */
export function squareBase(r: Recipe, only?: (centre: Vec2) => boolean): Recipe {
  return squareBaseFold(r, only).rotate(135, { title: 'Open end towards you', text: 'Turn the square so the loose corners point towards you.' });
}

/** The square base's creases and its collapse, before it's turned with its open end towards you (`squareBase`). */
export function squareBaseFold(r: Recipe, only?: (centre: Vec2) => boolean): Recipe {
  return r.crease(paper(-0.5, -0.5), paper(0.5, 0.5), { title: 'Fold in half diagonally', text: 'Bring one corner to the opposite corner, then unfold.', only })
    .crease(paper(0.5, -0.5), paper(-0.5, 0.5), { title: 'Fold the other diagonal', text: 'The two creases cross at the centre.', only })
    .crease(paper(-0.5, 0), paper(0.5, 0), { title: 'Fold in half', text: 'Edge to edge this time, then unfold.', only })
    .crease(paper(0, -0.5), paper(0, 0.5), { title: 'Fold in half the other way', text: 'Now the paper has eight creases from the centre.', only })
    .collapse(
      {
        title: 'Collapse into a square base',
        text: 'Push the edge middles in so the edge creases fold outwards and one diagonal folds inwards. All four corners meet in a small square.',
      },
      [
        { through: [table(-1, 0), table(1, 0)], kind: 'mountain', only },
        { through: [table(0, -1), table(0, 1)], kind: 'mountain', only },
        { through: [table(-1, -1), table(1, 1)], kind: 'valley', only },
      ],
      paper(-0.4, -0.1),
    );
}

/**
 * The bird base, as the crane folds it: square base, then a petal fold on each side. Shared by the crane and
 * the crow. Returns where its points are, and tests picking out its flaps by their centres on the sheet.
 */
export function birdBase(r: Recipe, only?: (centre: Vec2) => boolean) {
  squareBase(r, only);
  const base = squareBaseFlaps(r, only);
  base.petal(false);
  r.turnOver('Turn the paper over.');
  base.petal(true);
  return base;
}

/**
 * A square base's points and flaps, and its petal fold: `petal(false)` on the front flap, `petal(true)` on the
 * back one once the paper is turned over. For a square base just folded by `squareBase`.
 *
 * The sheet's quarters each become one flap of the square base: the front flap is the quarter u > 0, v < 0,
 * the back flap u < 0, v > 0, and the two inner flaps are the other quarters, each folded along its diagonal.
 */
export function squareBaseFlaps(r: Recipe, only?: (centre: Vec2) => boolean) {
  const keep = only ?? (() => true);
  // The square base as a diamond: closed point T (the sheet's centre) at the top, open corners B at the bottom.
  const T = r.where(paper(0, 0));
  const B = r.where(paper(0.5, 0.5));
  const up = (d: number): Vec2 => [B[0], B[1] - d];
  // A side corner folded in to the centre line lands half a side up from B; the kite flaps' tops line up with it.
  const P = up(0.5);
  const side = (Math.SQRT2 - 1) / 2;
  const K: Vec2 = [B[0] - side, P[1]];
  const K2: Vec2 = [B[0] + side, P[1]];

  const front = (c: Vec2) => keep(c) && c[0] > 0 && c[1] < 0;
  const back = (c: Vec2) => keep(c) && c[0] < 0 && c[1] > 0;
  // The inner flaps' halves next to the front flap, and next to the back flap.
  const innerFront = (c: Vec2) => keep(c) && ((c[0] > 0 && c[1] > 0 && c[0] > c[1]) || (c[0] < 0 && c[1] < 0 && c[0] > c[1]));
  const innerBack = (c: Vec2) => keep(c) && ((c[0] > 0 && c[1] > 0 && c[1] > c[0]) || (c[0] < 0 && c[1] < 0 && c[1] > c[0]));

  /**
   * Kite folds, top triangle, unfold, then the petal fold, for whichever flap is on top: `second`, the back flap
   * once the paper is turned over. The petal fold is the Studio's Named fold, picked at the flap's free corner.
   */
  const petal = (second: boolean) => {
    const left = r.where(paper(...(second ? ([0, 0.5] as Vec2) : ([0.5, 0] as Vec2))));
    const right = r.where(paper(...(second ? ([-0.5, 0] as Vec2) : ([0, -0.5] as Vec2))));
    const before = r.mark();
    r.onto(table(...(left[0] < right[0] ? left : right)), table(...P), {
      title: 'Fold the left edge to the centre',
      text: 'Fold the lower left edge of the top layer to the centre crease.',
      layers: 2,
      only,
    })
      .onto(table(...(left[0] < right[0] ? right : left)), table(...P), {
        title: 'Fold the right edge to the centre',
        text: 'Match the right side. It looks like a kite.',
        layers: 2,
        only,
      })
      .along(table(-2, P[1]), table(2, P[1]), table(...T), {
        title: 'Fold the top down',
        text: 'Fold the top triangle down over the kite flaps, crease hard, then…',
      })
      .unfold({ title: 'Unfold the last three folds', text: 'Open the kite flaps and the top back out to the square base.', to: before });
    r.preset(
      {
        title: 'Petal fold',
        text: 'Lift the bottom corner of the top layer up along the horizontal crease. The sides fold in along the kite creases and meet in the middle.',
        kind: 'petal',
      },
      { kind: 'petal', picks: [r.where(paper(...(second ? ([-0.5, 0.5] as Vec2) : ([0.5, -0.5] as Vec2))))] },
    );
  };

  return { T, B, P, K, K2, side, up, front, back, innerFront, innerBack, petal };
}
