import type { CreaseKind } from '../../fold/collapse';
import { paper, Recipe, table, type At } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * The square base: creased in diagonals and halves, collapsed, and turned so the loose corners point towards
 * you. The start of the bird base and the frog base.
 */
export function squareBase(r: Recipe): Recipe {
  return r.crease(paper(-0.5, -0.5), paper(0.5, 0.5), { title: 'Fold in half diagonally', text: 'Bring one corner to the opposite corner, then unfold.' })
    .crease(paper(0.5, -0.5), paper(-0.5, 0.5), { title: 'Fold the other diagonal', text: 'The two creases cross at the centre.' })
    .crease(paper(-0.5, 0), paper(0.5, 0), { title: 'Fold in half', text: 'Edge to edge this time, then unfold.' })
    .crease(paper(0, -0.5), paper(0, 0.5), { title: 'Fold in half the other way', text: 'Now the paper has eight creases from the centre.' })
    .collapse(
      {
        title: 'Collapse into a square base',
        text: 'Push the edge middles in so the edge creases fold outwards and one diagonal folds inwards. All four corners meet in a small square.',
      },
      [
        { through: [table(-1, 0), table(1, 0)], kind: 'mountain' },
        { through: [table(0, -1), table(0, 1)], kind: 'mountain' },
        { through: [table(-1, -1), table(1, 1)], kind: 'valley' },
      ],
      paper(-0.4, -0.1),
    )
    .rotate(135, { title: 'Open end towards you', text: 'Turn the square so the loose corners point towards you.' });
}

/**
 * The bird base, as the crane folds it: square base, then a petal fold on each side. Shared by the crane and
 * the crow. Returns where its points are, and tests picking out its flaps by their centres on the sheet.
 *
 * The sheet's quarters each become one flap of the square base: the front flap is the quarter u > 0, v < 0,
 * the back flap u < 0, v > 0, and the two inner flaps are the other quarters, each folded along its diagonal.
 */
export function birdBase(r: Recipe) {
  squareBase(r);

  // The square base as a diamond: closed point T (the sheet's centre) at the top, open corners B at the bottom.
  const T = r.where(paper(0, 0));
  const B = r.where(paper(0.5, 0.5));
  const up = (d: number): Vec2 => [B[0], B[1] - d];
  // A side corner folded in to the centre line lands half a side up from B; the kite flaps' tops line up with it.
  const P = up(0.5);
  const side = (Math.SQRT2 - 1) / 2;
  const K: Vec2 = [B[0] - side, P[1]];
  const K2: Vec2 = [B[0] + side, P[1]];
  const L = r.where(paper(0.5, 0));
  const R = r.where(paper(0, -0.5));

  const front = ([u, v]: Vec2) => u > 0 && v < 0;
  const back = ([u, v]: Vec2) => u < 0 && v > 0;
  // The inner flaps' halves next to the front flap, and next to the back flap.
  const innerFront = ([u, v]: Vec2) => (u > 0 && v > 0 && u > v) || (u < 0 && v < 0 && u > v);
  const innerBack = ([u, v]: Vec2) => (u > 0 && v > 0 && v > u) || (u < 0 && v < 0 && v > u);

  /** Kite folds, top triangle, unfold, then the petal fold, for whichever flap is on top. */
  const petal = (flap: (c: Vec2) => boolean, inner: (c: Vec2) => boolean, seam: (c: Vec2) => boolean, second: boolean) => {
    const left = r.where(paper(...(second ? ([0, 0.5] as Vec2) : ([0.5, 0] as Vec2))));
    const right = r.where(paper(...(second ? ([-0.5, 0] as Vec2) : ([0, -0.5] as Vec2))));
    const before = r.mark();
    r.onto(table(...(left[0] < right[0] ? left : right)), table(...P), {
      title: 'Fold the left edge to the centre',
      text: 'Fold the lower left edge of the top layer to the centre crease.',
      layers: 2,
    })
      .onto(table(...(left[0] < right[0] ? right : left)), table(...P), {
        title: 'Fold the right edge to the centre',
        text: 'Match the right side. It looks like a kite.',
        layers: 2,
      })
      .along(table(-2, P[1]), table(2, P[1]), table(...T), {
        title: 'Fold the top down',
        text: 'Fold the top triangle down over the kite flaps, crease hard, then…',
      })
      .unfold({ title: 'Unfold the last three folds', text: 'Open the kite flaps and the top back out to the square base.', to: before });
    const kite = (kind: CreaseKind, only: (c: Vec2) => boolean) =>
      [K, K2].map((k) => ({ through: [table(...B), table(...k)] as [At, At], kind, only }));
    r.collapse(
      {
        title: 'Petal fold',
        text: 'Lift the bottom corner of the top layer up along the horizontal crease. The sides fold in along the kite creases and meet in the middle.',
        kind: 'petal',
      },
      [
        { through: [table(...K), table(...K2)], kind: 'valley', only: flap },
        ...kite('mountain', flap),
        ...kite('valley', inner),
        // The seams joining the flap to the inner flaps, below the kite corners, open out flat.
        { through: [table(...T), table(...L)], kind: 'flat', only: seam },
        { through: [table(...T), table(...R)], kind: 'flat', only: seam },
      ],
      paper(...(second ? ([0.3, -0.3] as Vec2) : ([-0.3, 0.3] as Vec2))),
    );
  };

  // The seams lie along the sheet's middle lines, far from the centre.
  petal(front, innerFront, ([u, v]) => u > 0.3 || v < -0.3, false);
  r.turnOver('Turn the paper over.');
  petal(back, innerBack, ([u, v]) => v > 0.3 || u < -0.3, true);

  return { T, B, P, K, K2, side, up, front, back, innerFront, innerBack };
}
