import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { squareBase, squareBaseFlaps } from './bird-base';

/**
 * A lesson rather than a model: the common folds, one to a section, each on a fresh square. The choice of
 * folds follows origami.me's beginner's guide; the steps are our own. The swivel fold waits for the fold
 * engine, and the open sink for reverse folds that tuck between the layers (the engine's lay the point
 * behind them, which would make a sink a plain fold behind).
 */
export function foldsLesson() {
  const r = new Recipe({ id: 'folds-lesson', title: 'Common folds', sheet: { size: [1, 1], front: '#f6f3ec', back: '#7fb3d5' } });
  const h = Math.SQRT1_2;

  /** Each fold starts on a fresh square: this step says what the fold is for. Returns a bookmark to open back to. */
  const start = (section: string, title: string, text: string) => {
    r.section(section).newSheet({ title, text });
    return r.mark();
  };
  const openUp = (to: number, text: string) => r.unfold({ title: 'Open it up', text, to });

  // A diamond folded in half: a triangle with the fold along its bottom edge, its point at (h, 0) on the right.
  const triangle = () =>
    r
      .rotate(45, { title: 'Make a diamond', text: 'Turn the square so a corner points towards you.' })
      .onto(paper(-0.5, 0.5), paper(0.5, -0.5), { title: 'Fold in half', text: 'Fold the bottom corner up to the top corner. It’s a triangle.' });

  // 1. Valley and mountain folds. The first section has no fresh square to start on, so its first fold says
  // what the section is about.
  const valley = r.section('Valley and mountain folds').mark();
  r.onto(paper(0, 0.5), paper(0, -0.5), {
    title: 'Valley fold',
    text: 'Nearly every fold is a valley fold or a mountain fold. For a valley fold, fold the paper towards you: bring the bottom edge up to the top edge.',
  })
    .unfold({ title: 'Unfold', text: 'Open it. The crease dips down into the paper, like a valley.' })
    .along(table(0, -1), table(0, 1), table(-0.3, 0), {
      title: 'Mountain fold',
      text: 'Now fold the left half behind, away from you, onto the back of the right half. This is a mountain fold.',
      kind: 'mountain',
    });
  openUp(valley, 'Open it. This crease stands up like a ridge. Turn the paper over and it would look like a valley: a mountain fold is just a valley fold seen from the other side.');

  // 2. Inside reverse fold: the triangle's right point turned up between its own layers.
  const at = (x: number, angle: number, t = 1): Vec2 => [x + t * Math.cos((angle * Math.PI) / 180), -t * Math.sin((angle * Math.PI) / 180)];
  const inside = start(
    'Inside reverse fold',
    'Inside reverse fold',
    'An inside reverse fold turns a point back on itself, tucking it in between its own layers. It makes necks, heads, tails and legs.',
  );
  triangle();
  const neck = [table(0.3, 0), table(...at(0.3, 35))] as const;
  r.along(neck[0], neck[1], table(h - 0.05, 0), {
    title: 'Crease the point',
    text: 'Fold the right point up along a slanting line, through both layers, and crease it well.',
  })
    .unfold({ title: 'Unfold', text: 'Fold it back down. The crease shows where the reverse fold goes.' })
    .collapse(
      {
        title: 'Inside reverse fold',
        text: 'Open the layers a little and push the point up between them along the crease, so it turns back on itself. Flatten it.',
        kind: 'reverse',
      },
      [{ through: [neck[0], neck[1]], kind: 'inside' }],
      paper(-0.3, 0.3),
    );
  openUp(inside, 'Open it out to see the creases: the reverse fold left a pair of creases, mirrored across the middle one.');

  // 3. Outside reverse fold: the point wraps round the outside of the triangle's folded edge and turns down.
  const outside = start(
    'Outside reverse fold',
    'Outside reverse fold',
    'An outside reverse fold also turns a point back, but this time the paper wraps round the outside of the point instead of going inside it. It often makes heads that hang down.',
  );
  triangle();
  // Leaning back over the triangle, so the point swings down round its folded bottom edge.
  const head = [table(0.5, 0), table(...at(0.5, 120))] as const;
  r.along(head[0], head[1], table(h - 0.05, 0), {
    title: 'Crease the point',
    text: 'Fold the right point back over the triangle along a line leaning to the left, through both layers, and crease it well.',
  })
    .unfold({ title: 'Unfold', text: 'Fold it back again.' })
    .collapse(
      {
        title: 'Outside reverse fold',
        text: 'Open the point’s layers and wrap them round the outside of the triangle, so the point turns down past the folded bottom edge. Flatten it.',
        kind: 'reverse',
      },
      [{ through: [head[0], head[1]], kind: 'outside' }],
      paper(-0.3, 0.3),
    );
  openUp(outside, 'Open it out. Again a mirrored pair of creases, but folded the opposite way to the inside reverse fold’s.');

  // 4. Squash fold: half of a square base, from a triangle folded in half.
  const squash = start(
    'Squash fold',
    'Squash fold',
    'In a squash fold you open a flap and press it flat into a new shape, usually a square or a diamond. It starts many bases.',
  );
  triangle().onto(paper(0.5, 0.5), paper(-0.5, -0.5), {
    title: 'Fold in half again',
    text: 'Fold the right corner over to the left corner.',
  });
  // The flap on top: the quarters of the sheet by the edges u = ½ (on top) and v = ½, hinged up the middle.
  const O: Vec2 = [0, 0];
  const A: Vec2 = [0, -h];
  const L: Vec2 = [-h / 2, -h / 2];
  const E = ([u, v]: Vec2) => u > Math.abs(v);
  const S = ([u, v]: Vec2) => v > Math.abs(u);
  const N = ([u, v]: Vec2) => -v > Math.abs(u);
  r.collapse(
    {
      title: 'Squash fold',
      text: 'Stand the top flap straight up and open its pocket. Press it down flat so it spreads evenly over the centre line, into a diamond.',
      kind: 'squash',
    },
    [
      { through: [table(...O), table(...A)], kind: 'flat', only: (c) => E(c) || N(c) },
      { through: [table(...O), table(-h, 0)], kind: 'flat', only: (c) => E(c) || S(c) },
      { through: [table(...O), table(...L)], kind: 'mountain', only: E },
      { through: [table(...O), table(...L)], kind: 'valley', only: S },
    ],
    paper(-0.3, 0),
  );
  openUp(squash, 'Open it out. A squash fold leaves a fan of creases round a point.');


  // 5. Rabbit ear: on the triangle, its two lower corners' halving lines and the line down the middle, which
  // all meet at one point, I. The edges fold in to the bottom edge and the corner between them stands up.
  const rabbit = start(
    'Rabbit ear',
    'Rabbit ear',
    'A rabbit ear folds two edges of a triangle in at once, so the corner between them stands up as a thin flap. It makes legs and fins, and narrows a point.',
  );
  triangle();
  const B: Vec2 = [-h, 0];
  const C: Vec2 = [h, 0];
  r.edgeOnto([table(...B), table(0, -h)], [table(...B), table(...C)], {
    title: 'Fold the left edge down',
    text: 'Fold the left slanting edge down onto the bottom edge.',
  })
    .unfold({ title: 'Unfold', text: 'Open it again.' })
    .edgeOnto([table(...C), table(0, -h)], [table(...C), table(...B)], {
      title: 'Fold the right edge down',
      text: 'And the right slanting edge onto the bottom edge.',
    })
    .unfold({ title: 'Unfold', text: 'Open it again. The two creases cross on the middle line.' })
    .crease(table(...B), table(...C), { title: 'Fold in half', text: 'Fold the left corner over to the right corner.' });
  // The creases around I, by the angle of a face's centre seen from I (anticlockwise from the right, up the page).
  const I: Vec2 = [0, -(1 - h)];
  const around = (lo: number, hi: number) => (c: Vec2) => {
    const [x, z] = r.where(paper(...c));
    const a = (Math.atan2(-(z - I[1]), x - I[0]) * 180) / Math.PI;
    return (a - lo + 720) % 360 < (hi - lo + 720) % 360;
  };
  r.collapse(
    {
      title: 'Rabbit ear',
      text: 'Fold both slanting edges down to the bottom edge at the same time, along their creases. The top corner pinches up into a flap. Lay it down to the right, and the right half of the triangle folds behind along the middle crease.',
    },
    [
      { through: [table(...B), table(...I)], kind: 'valley', only: around(157.5, 270) },
      { through: [table(...C), table(...I)], kind: 'valley', only: around(-90, 22.5) },
      { through: [table(0, -1), table(0, 1)], kind: 'valley', only: around(22.5, 157.5) },
      { through: [table(0, -1), table(0, 1)], kind: 'mountain', only: around(202.5, 337.5) },
    ],
    r.sheetAt([-0.3, -0.05]),
  );
  openUp(rabbit, 'Open it out. Four creases meet at one point in the middle of the triangle.');

  // 6. Pleat: a valley fold and a mountain fold side by side.
  const pleat = start(
    'Pleat',
    'Pleat',
    'A pleat is a valley fold and a mountain fold next to each other, making a step in the paper, like a folded fan. Pleats make stripes, tails and springs.',
  );
  r.onto(paper(0, 0.5), paper(0, 0), { title: 'Fold the bottom up', text: 'Fold the bottom edge up to the middle of the square.' }).along(
    table(-1, 0.125),
    table(1, 0.125),
    table(0, 0.05),
    { title: 'Fold it back down', text: 'Fold the edge back down to the bottom fold, folding just the top layer. The zig-zag is a pleat.', layers: 1 },
  );
  openUp(pleat, 'Open it out: a valley crease and a mountain crease side by side.');

  // 7. Crimp: a pleat through both layers of a folded point, which bends it: two reverse folds together.
  const crimp = start(
    'Crimp',
    'Crimp',
    'A crimp is two reverse folds next to each other: a pleat folded through both layers of a point at once, so the point bends. It makes knees, necks and beaks.',
  );
  triangle();
  const k1 = [table(0.05, 0), table(...at(0.05, 85))] as const;
  const k2 = [table(0.1, 0), table(...at(0.1, 70))] as const;
  r.along(k1[0], k1[1], table(h - 0.05, 0), {
    title: 'Crease near the middle',
    text: 'Fold the right half over along a nearly upright line just right of the middle, through both layers.',
  })
    .unfold({ title: 'Unfold', text: 'Open it again.' })
    .along(k2[0], k2[1], table(h - 0.05, 0), {
      title: 'Crease beside it',
      text: 'Fold it over again along a second line just to the right, leaning a little further right.',
    })
    .unfold({ title: 'Unfold', text: 'Open it again.' })
    .collapse(
      {
        title: 'Crimp',
        text: 'Pinch a pleat into both layers along the two creases at once, so the point tilts up. Each layer gets the same pleat, mirrored, with the pleat tucked between them.',
        kind: 'reverse',
      },
      [
        { through: [k1[0], k1[1]], kind: 'inside' },
        { through: [k2[0], k2[1]], kind: 'outside' },
      ],
      paper(-0.3, 0.3),
    );
  openUp(crimp, 'Open it out: on each layer, the two creases are a pleat.');

  // 8. Petal fold: on a square base, the bird base's petal fold, as the crane folds it.
  const petal = start(
    'Petal fold',
    'Petal fold',
    'A petal fold lifts one layer of a point up while its sides fold in to meet in the middle, making a long, thin diamond. Two of them turn a square base into a bird base. First, fold a square base.',
  );
  squareBase(r);
  squareBaseFlaps(r).petal(false);
  openUp(petal, 'Open it out to see the creases the petal fold left behind.');

  return r.build();
}

