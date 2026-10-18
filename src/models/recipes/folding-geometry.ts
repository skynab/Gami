import { lineOnto, lineThrough, sideOf, type Line } from '../../fold/geometry2d';
import { Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * A lesson rather than a model: geometry by folding, after Robert Geretschläger's book Geometric Origami.
 * Each step folds one of the Huzita–Hatori axioms on a square and opens it again, so the creases build up,
 * then puts axiom 6 to work trisecting an angle, which straightedge and compass can't do.
 */
export function foldingGeometry() {
  const r = new Recipe({ id: 'folding-geometry', title: 'Geometry by folding', sheet: { size: [1, 1], front: '#f6f3ec', back: '#c9b8f0' } });
  const at = (p: Vec2) => table(...p);
  const [bl, br, tl, tr]: Vec2[] = [[-0.5, 0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, -0.5]];
  /** Folds along a line (moving the side `moving` is on), then opens it again. */
  const crease = (a: Vec2, b: Vec2, moving: Vec2, step: { title: string; text: string }, open = 'Open it again. Each fold leaves a crease, a straight line.') =>
    r.along(at(a), at(b), at(moving), step).unfold({ title: 'Unfold', text: open });

  // Each axiom, and then the trisection, on a fresh square of its own, so its creases are easy to see.
  const fresh = () =>
    r.newSheet({
      title: 'A fresh square',
      text: 'Put the creased square aside and take a new one, so the next creases stand out.',
    });

  // 1. Through two points.
  r.section('Axiom 1');
  crease(bl, tr, tl, {
    title: 'A line through two points',
    text: 'Axiom 1: through any two points there is exactly one fold. Fold through two corners. Folding draws straight lines, like a ruler.',
  });
  // 2. One point onto another.
  r.section('Axiom 2');
  fresh();
  r.onto(at(bl), at(br), {
    title: 'One point onto another',
    text: 'Axiom 2: there is exactly one fold that lays one point on another. Every point of the crease is the same distance from both: it’s the perpendicular bisector.',
  }).unfold({ title: 'Unfold', text: 'Open it. The crease cuts the square exactly in half.' });
  // 3. One line onto another: a diagonal first, to fold onto.
  r.section('Axiom 3');
  fresh();
  crease(br, tl, tr, { title: 'A diagonal', text: 'Fold a diagonal, from the bottom right corner to the top left.' }, 'Open it. This crease is one of the lines.');
  r.edgeOnto([at(br), at(bl)], [at(br), at(tl)], {
    title: 'One line onto another',
    text: 'Axiom 3: fold one line onto another. The crease halves the angle between them: the bottom edge onto the diagonal halves 45° into 22.5°.',
  }).unfold({ title: 'Unfold', text: 'Open it. Halving angles is as easy as halving lengths.' });
  // 4. Through a point, square to a line: again a diagonal first.
  r.section('Axiom 4');
  fresh();
  crease(bl, tr, tl, { title: 'A diagonal', text: 'Fold a diagonal, from the bottom left corner to the top right.' }, 'Open it. This crease is the given line.');
  crease([0, 0], [1, 1], tl, {
    title: 'Square to a line, through a point',
    text: 'Axiom 4: through any point there is exactly one fold square to a given line. Fold through the centre at right angles to the diagonal.',
  }, 'Open it. The two diagonals cross at right angles.');

  // 5. A point onto a line, through another point: the bottom left corner onto the middle crease, the fold
  // through the bottom right corner. It lands where it's as far from that corner as the side is long.
  r.section('Axiom 5');
  fresh();
  r.onto(at(bl), at(br), { title: 'Fold in half', text: 'Fold the left edge onto the right edge.' }).unfold({ title: 'Unfold', text: 'Open it: a crease down the middle.' });
  const landing: Vec2 = [0, 0.5 - Math.sqrt(0.75)];
  r.onto(at(bl), at(landing), {
    title: 'A point onto a line, through a point',
    text: 'Axiom 5: fold the bottom left corner onto the middle crease, with the fold through the bottom right corner. The corner, the fold’s end and where it lands make an equilateral triangle: you’ve folded 60°.',
  }).unfold({ title: 'Unfold', text: 'Open it. Straightedge and compass can do this too; folding is just quicker.' });

  // 6. Two points onto two lines at once (Beloch's fold), used for Abe's trisection. The angle to trisect is
  // at the bottom left corner, between the bottom edge and the line to `ray`.
  const corner = bl;
  const angle = (60 * Math.PI) / 180;
  const ray: Vec2 = [corner[0] + Math.cos(angle) * 0.9, corner[1] - Math.sin(angle) * 0.9];
  r.section('Trisecting an angle');
  fresh();
  crease(corner, ray, [0.3, 0.3], {
    title: 'An angle to trisect',
    text: 'Now something a straightedge and compass can’t do. Fold a line from the bottom left corner: here at 60° to the bottom edge, but any angle works.',
  }, 'Open it. We’ll split this angle into three equal parts.');
  r.onto(at(bl), at(tl), { title: 'Fold in half', text: 'Fold the bottom edge to the top edge.' }).unfold({ title: 'Unfold', text: 'Open it: a crease across the middle.' });
  const quarter = 0.25;
  r.along(at([-1, quarter]), at([1, quarter]), at([0, 0.5]), { title: 'Fold a quarter', text: 'Fold the bottom edge up to the middle crease.' })
    .unfold({ title: 'Unfold', text: 'Open it. The two creases are equally spaced above the bottom edge.' });

  // Axiom 6: one fold putting the corner on the lower crease and the left end of the middle crease on the
  // angle's line, found by sliding the corner along the lower crease until the other point lands on it.
  const onLine = (p: Vec2, l: Line) => sideOf(l, p);
  const reflect = (l: Line, p: Vec2): Vec2 => {
    const s = onLine(p, l);
    return [p[0] + 2 * s * l.d[1], p[1] - 2 * s * l.d[0]];
  };
  const angleLine = lineThrough(corner, ray);
  const left: Vec2 = [-0.5, 0];
  const foldFor = (x: number) => lineOnto(corner, [x, quarter]);
  const miss = (x: number) => onLine(reflect(foldFor(x), left), angleLine);
  let [lo, hi] = [-0.45, 0.45];
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (Math.sign(miss(mid)) === Math.sign(miss(lo))) lo = mid;
    else hi = mid;
  }
  const beloch = foldFor((lo + hi) / 2);
  const cornerTo = reflect(beloch, corner);
  const quarterLeft: Vec2 = [-0.5, quarter];
  const markTo = reflect(beloch, quarterLeft);
  r.onto(at(corner), at(cornerTo), {
    title: 'Two points onto two lines',
    text: 'Axiom 6: fold so the corner lands on the lower crease and the left end of the middle crease lands on the angle’s line, both at once. Slide it until both fit. This is the only fold that solves cubic equations.',
  });
  r.unfold({ title: 'Unfold', text: 'Open it, remembering where the corner and the end of the lower crease landed.' });
  // The line from the corner through where the corner landed takes a third of the angle; the line through
  // where the lower crease's left end landed, two thirds.
  crease(corner, cornerTo, [0.3, 0.45], {
    title: 'A third of the angle',
    text: 'Fold a line from the corner through where the corner itself landed. It cuts off exactly a third of the angle: 20°.',
  }, 'Open it.');
  crease(corner, markTo, [0.3, 0.2], {
    title: 'Two thirds',
    text: 'And a line from the corner through where the end of the lower crease landed: two thirds, 40°. The angle is trisected, which was proved impossible with straightedge and compass alone.',
  }, 'Open it and look at the angle: three equal parts. Origami can do everything a straightedge and compass can, and more: axiom 6 also doubles a cube and folds a regular heptagon (7 sides). Axiom 7 folds a point onto one line, square to another.');
  return r.build();
}
