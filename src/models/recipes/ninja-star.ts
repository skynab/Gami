import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * The ninja star (shuriken), from two squares, following origami.me/ninja-star. Each square becomes a unit
 * shaped like an S of two triangles, the two units being mirror images; then they're laid across each
 * other and each unit's points are tucked into the other's pockets.
 */
export function ninjaStar() {
  // Sheet coordinates: yellow around (0, 0), blue around (10, 0). On the table they start side by side.
  const yellowAt = -0.75;
  const blueAt = 0.75;
  const yellow = ([u]: Vec2) => u < 5;
  const blue = ([u]: Vec2) => u > 5;
  const r = new Recipe({
    id: 'ninja-star',
    title: 'Ninja star',
    sheets: [
      { size: [1, 1], front: '#f6f3ec', back: '#f2c94c', origin: [0, 0], at: [yellowAt, 0] },
      { size: [1, 1], front: '#f6f3ec', back: '#5b8def', origin: [10, 0], at: [blueAt, 0] },
    ],
  });
  const both: [number, number, (c: Vec2) => boolean][] = [
    [yellowAt, 0, yellow],
    [blueAt, 10, blue],
  ];

  // The units: each square folded into a strip a quarter of its width.
  r.together({ title: 'Fold both in half', text: 'Start white side up. Fold each square in half side to side.' }, (r) => {
    for (const [, o, only] of both) r.onto(paper(o - 0.5, 0), paper(o + 0.5, 0), { title: '', only });
  })
    .unfold({ text: 'Unfold, leaving a crease down the middle.' })
    .together({ title: 'Fold both in half the other way', text: 'Fold each square in half top to bottom.' }, (r) => {
      for (const [, o, only] of both) r.onto(paper(o, 0.5), paper(o, -0.5), { title: '', only });
    })
    .unfold({ text: 'Unfold again. Each square has a cross of creases.' })
    .together({ title: 'Fold the sides to the middle', text: 'Fold the left and right edges of each square in to the centre crease.' }, (r) => {
      for (const [x, o, only] of both) {
        r.onto(paper(o - 0.5, 0), table(x, 0), { title: '', only }).onto(paper(o + 0.5, 0), table(x, 0), { title: '', only });
      }
    })
    .together({ title: 'Fold in half lengthwise', text: 'Fold each one in half again, right over left, into a long strip.' }, (r) => {
      for (const [x, , only] of both) r.onto(table(x + 0.25, 0), table(x - 0.25, 0), { title: '', only });
    });

  // Each strip now runs from x − ¼ to x, and top to bottom from −½ to ½: four squares of side w long.
  const w = 0.25;
  const ends = (top: boolean) => (r: Recipe) => {
    for (const [x, , only] of both) {
      const [l, rt] = [x - w, x];
      // Yellow: top edge to the left edge, bottom edge to the right edge. Blue is the mirror image.
      const mirror = only === blue;
      const [near, far] = top !== mirror ? [l, rt] : [rt, l];
      const y = top ? -0.5 : 0.5;
      const inward = top ? w : -w;
      r.along(table(near, y), table(far, y + inward), table(far + (near - far) * 0.04, y + inward * 0.02), { title: '', only });
    }
  };
  r.together({ title: 'Fold the top ends', text: 'On the yellow strip, bring the top edge down to the left edge. On the blue one, to the right edge.' }, ends(true))
    .together({ title: 'Fold the bottom ends', text: 'Bring the bottom edges up the other way: yellow to the right edge, blue to the left.' }, ends(false));

  // Fold along the diagonal of each middle square, so the ends swing out sideways. Each fold only takes its own
  // half of the strip: the line runs on into the other half.
  const swing = (top: boolean) => (r: Recipe) => {
    for (const [x, o, only] of both) {
      const [l, rt] = [x - w, x];
      const mirror = only === blue;
      const [a, b] = mirror ? [rt, l] : [l, rt];
      const half = (c: Vec2) => only(c) && (top ? c[1] < 0 : c[1] > 0);
      if (top) r.along(table(a, -0.5 + 2 * w), table(b, -0.5 + w), table(x - w / 2, -0.49), { title: '', only: half });
      else r.along(table(b, 0.5 - 2 * w), table(a, 0.5 - w), table(x - w / 2, 0.49), { title: '', only: half });
      void o;
    }
  };
  r.together({ title: 'Swing the top ends out', text: 'Fold along the diagonal of the second square, so the top end points sideways.' }, swing(true))
    .together({ title: 'Swing the bottom ends out', text: 'Do the same at the bottom, pointing the other way. Each unit is now an S of two triangles.' }, swing(false));

  // Assembly: yellow turned over, blue laid across it.
  r.move({ title: 'Turn the yellow unit over', text: 'Turn it over and turn it on the table, as shown.' }, yellow, { to: table(0, 0), degrees: -45, flip: true })
    .move({ title: 'Lay the blue unit across it', text: 'Place the blue unit on top, crossing the yellow one.' }, blue, { to: table(0, 0), degrees: 45 });

  // The star's half-width, and where the units' triangles meet, once assembled.
  const q = 0.375 * Math.SQRT1_2;
  const h = 0.125 * Math.SQRT1_2;
  // Each tuck folds a triangle's outer half along its middle (from the square corner to the long edge),
  // anchored on the half that stays, and slides it under the other unit.
  return r
    .collapse(
      { title: 'Tuck in a yellow point', text: 'Fold the top yellow point down along its middle and tuck it under the blue unit, into its pocket.', kind: 'fold' },
      [{ through: [table(h, -q), table(-h, -h)], kind: 'valley', only: yellow }],
      r.sheetAt([h / 3, -h], yellow),
      blue,
    )
    .collapse(
      { title: 'Tuck in the other yellow point', text: 'Tuck the bottom yellow point in the same way.', kind: 'fold' },
      [{ through: [table(-h, q), table(h, h)], kind: 'valley', only: yellow }],
      r.sheetAt([-h / 3, h], yellow),
      blue,
    )
    .turnOver('Turn the whole star over.')
    .collapse(
      { title: 'Tuck in a blue point', text: 'Now tuck the blue points into the yellow unit’s pockets the same way.', kind: 'fold' },
      [{ through: [table(q, -h), table(h, h)], kind: 'valley', only: blue }],
      r.sheetAt([h, -h / 3], blue),
      yellow,
    )
    .collapse(
      { title: 'Tuck in the last point', text: 'Tuck the last blue point in. Crease everything firmly, and it’s ready to throw (gently, at nobody).', kind: 'fold' },
      [{ through: [table(-q, h), table(-h, -h)], kind: 'valley', only: blue }],
      r.sheetAt([-h, h / 3], blue),
      yellow,
    )
    .build();
}
