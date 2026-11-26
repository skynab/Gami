import { toFlat } from '../../fold/fold';
import { lineThrough, sideOf } from '../../fold/geometry2d';
import { inside } from '../../fold/select';
import { paper, Recipe, table, type ShapeBend } from '../../fold/recipe';
import type { Vec2, Vec3 } from '../../fold/types';
import { birdBase } from './bird-base';

/**
 * A dragon, Gami's own: the traditional bird base, its lower points narrowed as the crane's are, then turned with
 * outside reverse folds (wrapped round the body, as the hummingbird's are) into a neck rising forwards and a long
 * tail behind, sloping down so its end rests on the table once the dragon stands. The neck's top is turned out
 * again to stand straight up, and its tip pushed in between its layers for the head, pointing forwards and down: an
 * S. The tail's end is crimped up. The wings are the bird base's upper flaps, spread out sideways in 3D and rippled
 * into ribs.
 *
 * As the kaiju is built, the parts one sheet can't give come from little squares set on in the body's middle
 * plane: horns, a pale kite folded in half on the back of the head; legs, a green one under the belly. And an eye
 * drawn on each side of the head.
 *
 * The neck and tail turn with outside reverse folds rather than inside ones: tucked between the layers, rigid paper
 * passes through the stack as the point turns (the tail 8.7 layers), over `GRAZE` (src/models/known-clipping.ts).
 * The head is the other way round: wrapped round the upright top of the neck, it swings through the neck's inner
 * layers (14 layers), tucked in it passes nothing. Steeper than 60° the neck's root runs into the wings once they
 * spread (9 layers), so the S rises at 50° and stands up from there; turned past upright, its top won't fold flat.
 */
export const NECK_UP = 50;
/** The upper neck: how far down from the tip it turns, and how far above level it then points. */
export const UPPER = 0.22;
export const UPPER_UP = 90;
/** How far from where the head's crease starts the paper it creases may cross it: the neck's width there, and more. */
export const REACH = 0.1;
export const TAIL_UP = -9;
export const HEAD_DOWN = 20;
export const NECK_ROOT = 0.5;
export const TAIL_ROOT = 0.5;
export const SPREAD = 70;
export const RIPPLES = 5;
export const RIPPLE_DEG = 24;
/** The horns: half the diagonal of their square, and how far above level they sweep back. */
export const HORN = 0.045;
export const HORN_UP = 30;
/** The legs: half the diagonal of their square, and how far from straight down they lean forwards. */
export const LEG = 0.07;
export const LEG_LEAN = 12;
/** The eyes' size. */
export const EYE_SIZE = 0.005;

const deg = (a: number) => (a * Math.PI) / 180;
/** Where a point turns to: `angle` degrees above level, `dir` −1 forwards (left), +1 back (right). */
const dirOf = (angle: number, dir: 1 | -1): Vec2 => [dir * Math.cos(deg(angle)), -Math.sin(deg(angle))];
const plus = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
const minus = (a: Vec2, b: Vec2, k = 1): Vec2 => [a[0] - k * b[0], a[1] - k * b[1]];
const turn = (d: Vec2, a: number): Vec2 => [d[0] * Math.cos(deg(a)) - d[1] * Math.sin(deg(a)), d[0] * Math.sin(deg(a)) + d[1] * Math.cos(deg(a))];
/** Inside a convex face: a triangle's incentre, or any other face's centre of area. */
function middleOf(face: Vec2[]): Vec2 {
  if (face.length === 3) {
    const sides = face.map((_, i) => Math.hypot(face[(i + 1) % 3][0] - face[(i + 2) % 3][0], face[(i + 1) % 3][1] - face[(i + 2) % 3][1]));
    const round = sides[0] + sides[1] + sides[2];
    return [0, 1].map((k) => face.reduce((a, p, i) => a + sides[i] * p[k], 0) / round) as Vec2;
  }
  let [area, cx, cz] = [0, 0, 0];
  face.forEach((p, i) => {
    const q = face[(i + 1) % face.length];
    const w = p[0] * q[1] - q[0] * p[1];
    [area, cx, cz] = [area + w, cx + (p[0] + q[0]) * w, cz + (p[1] + q[1]) * w];
  });
  return [cx / (3 * area), cz / (3 * area)];
}

export function dragon() {
  const r = new Recipe({
    id: 'dragon',
    title: 'Dragon',
    sheets: [
      { size: [1, 1], front: '#2f8f5b', back: '#d8ecb8', origin: [0, 0], at: [0, 0] },
      { size: [HORN * Math.SQRT2, HORN * Math.SQRT2], front: '#ece4ca', back: '#d4c8a2', origin: [10, 0], at: [1.0, -0.3] },
      { size: [LEG * Math.SQRT2, LEG * Math.SQRT2], front: '#287a4e', back: '#2f8f5b', origin: [20, 0], at: [1.0, 0.3] },
    ],
  });
  const body = ([u]: Vec2) => u < 5;
  const horns = ([u]: Vec2) => u > 5 && u < 15;
  const legs = ([u]: Vec2) => u > 15;
  const { T, K, K2, side, up, front, back, innerFront, innerBack } = birdBase(r, body);

  const reach = Math.hypot(side, 0.5);
  const narrow = (half: (c: Vec2) => boolean) =>
    r
      .onto(table(...K), table(...up(reach)), {
        title: 'Fold the left edge to the centre',
        text: 'Fold the lower left edge of the front layers to the centre line, making the bottom point narrower.',
        only: half,
      })
      .onto(table(...K2), table(...up(reach)), { title: 'Fold the right edge to the centre', text: 'Match it on the right.', only: half });
  narrow((c) => back(c) || innerBack(c));
  r.turnOver('Turn the paper over.', { only: body });
  narrow((c) => front(c) || innerFront(c));

  // The lower points: the left one (the sheet's quarter u > 0, v > 0) the neck, the right one the tail. Each turns
  // along the line bisecting straight down and where it ends up pointing.
  const neckPaper = ([u, v]: Vec2) => u > 0 && u < 5 && v > 0;
  const tailPaper = ([u, v]: Vec2) => u < 0 && v < 0;
  const neckRoot = up(NECK_ROOT);
  const neckDir = dirOf(NECK_UP, -1);
  r.collapse(
    {
      title: 'Outside-reverse-fold the neck',
      text: 'Open the left point a little and wrap it round the outside of the body, so it points up and forwards. This is the neck.',
      kind: 'reverse',
    },
    [{ through: [table(...neckRoot), table(...plus(neckRoot, plus([0, 1], neckDir)))], kind: 'outside', only: neckPaper }],
    paper(-0.3, 0.3),
  );
  const tailRoot = up(TAIL_ROOT);
  const tailDir = dirOf(TAIL_UP, 1);
  r.collapse(
    {
      title: 'Outside-reverse-fold the tail',
      text: 'Wrap the right point round the outside the same way, so it points back and a little down. This is the tail.',
      kind: 'reverse',
    },
    [{ through: [table(...tailRoot), table(...plus(tailRoot, plus([0, 1], tailDir)))], kind: 'outside', only: tailPaper }],
    paper(-0.3, 0.3),
  );

  // The faces of `part` past a crease from `a` to `b`, on the side `towards` is, as patches of the sheet: a compound
  // fold creases where the pieces it cuts on both sides of the line pass the test. Only faces crossing the line
  // within `reach` of `a`, or lying wholly past it no further from `towards`, so the line, carried on, creases
  // nothing else. (A circle round the tip on the sheet misses the neck's long faces, which run from the tip nearly
  // to the body.)
  const beyond = (part: (c: Vec2) => boolean, a: Vec2, b: Vec2, towards: Vec2, reach: number) => {
    const line = lineThrough(a, b);
    const sense = Math.sign(sideOf(line, towards));
    const far = Math.hypot(towards[0] - a[0], towards[1] - a[1]) + reach;
    const patches = toFlat(r.current)
      .filter((f) => part([f.paper.reduce((t, p) => t + p[0], 0) / f.paper.length, f.paper.reduce((t, p) => t + p[1], 0) / f.paper.length]))
      .filter((f) => {
        const s = f.world.map((p) => sense * sideOf(line, p));
        if (s.every((v) => v > 1e-7)) return f.world.every((p) => Math.hypot(p[0] - towards[0], p[1] - towards[1]) < far);
        // Where its edges cross the line.
        return f.world.some((p, k) => {
          const q = f.world[(k + 1) % f.world.length];
          const [sp, sq] = [s[k], s[(k + 1) % s.length]];
          if ((sp > 1e-7) === (sq > 1e-7)) return false;
          const t = sp / (sp - sq);
          return Math.hypot(p[0] + t * (q[0] - p[0]) - a[0], p[1] + t * (q[1] - p[1]) - a[1]) < reach;
        });
      })
      .map((f) => f.paper);
    return (c: Vec2) => patches.some((poly) => inside(poly, c));
  };

  // The upper neck turned out to stand straight up, for an S: the neck's paper reaching past its crease folds (all of
  // it: kept to near the neck, some of its layers wouldn't crease and it can't fold flat).
  const neckTop = r.where(paper(0.5, 0.5));
  const upperRoot = minus(neckTop, neckDir, UPPER);
  const upperDir = dirOf(UPPER_UP, -1);
  const upperLine = plus(upperRoot, plus(neckDir, upperDir));
  r.collapse(
    {
      title: 'Outside-reverse-fold the upper neck',
      text: 'Wrap the top of the neck round the outside the same way, so it stands straight up.',
      kind: 'reverse',
    },
    [{ through: [table(...upperRoot), table(...upperLine)], kind: 'outside', only: beyond(neckPaper, upperRoot, upperLine, neckTop, Infinity) }],
    // Held by the neck just below the crease: the body can lie on either side of the line, carried on.
    r.sheetAt(minus(upperRoot, neckDir, 0.03), neckPaper),
  );

  // The head: the neck's tip pushed in between its layers, forwards and down. Only the paper near the tip creases.
  const tip = r.where(paper(0.5, 0.5));
  const headRoot = minus(tip, upperDir, 0.12);
  const headLine = plus(headRoot, plus(upperDir, dirOf(-HEAD_DOWN, -1)));
  r.collapse(
    { title: 'Make the head', text: 'Push the tip of the neck forward between its layers, for the head.', kind: 'reverse' },
    [{ through: [table(...headRoot), table(...headLine)], kind: 'inside', only: beyond(neckPaper, headRoot, headLine, tip, REACH) }],
    paper(-0.3, 0.3),
  );

  // The tail's end crimped up: two reverse folds side by side.
  const end = r.where(paper(-0.5, -0.5));
  const across: Vec2 = [-tailDir[1], tailDir[0]];
  const c1 = minus(end, tailDir, 0.2);
  const c2 = minus(end, tailDir, 0.15);
  r.collapse(
    { title: 'Crimp the tail', text: 'Pinch a little zigzag into the end of the tail, through all its layers, so the tip kicks up.', kind: 'reverse' },
    [
      { through: [table(...c1), table(...plus(c1, turn(across, 10)))], kind: 'inside', only: tailPaper },
      { through: [table(...c2), table(...plus(c2, turn(across, -10)))], kind: 'outside', only: tailPaper },
    ],
    paper(-0.3, 0.3),
  );

  // An eye on each side of the head, on its top face at the tip: in the middle of it (for a triangle, where a
  // circle in it would touch all three sides, towards the back of the head).
  const headTip = r.where(paper(0.5, 0.5));
  const head = toFlat(r.current)
    .filter((f) => f.world.some((p) => Math.hypot(p[0] - headTip[0], p[1] - headTip[1]) < 1e-6))
    .sort((a, b) => b.layer - a.layer)[0].world as Vec2[];
  const eye = middleOf(head);
  const ring = ([x, z]: Vec2): Vec2[] => Array.from({ length: 12 }, (_, i) => [x + EYE_SIZE * Math.cos((i * Math.PI) / 6), z + EYE_SIZE * Math.sin((i * Math.PI) / 6)]);
  const eyePaper = r.sheetAt(eye, body);
  r.draw({ title: 'Draw an eye', text: 'Draw a fierce eye on the head.' }, [{ fill: ring(eye) }]);
  r.move({ title: 'Turn the dragon over', text: 'Turn the dragon over, left to right.' }, body, { flip: true });
  r.draw({ title: 'Draw the other eye', text: 'And an eye on this side.' }, [{ fill: ring(r.where(eyePaper)) }]);
  r.move({ title: 'Turn it back', text: 'Turn the dragon back over.' }, body, { flip: true });

  // The horns and the legs: the two little squares turned to diamonds on their own, as the body was for its square
  // base, then creased, folded into kites and folded in half.
  const kites = [horns, legs];
  const halves = [HORN, LEG];
  const centres = [10, 20].map((u) => r.where(paper(u, 0)));
  r.together({ title: 'Turn the little squares', text: 'Take the little pale square and the little green one and turn each so a corner points towards you.' }, (q) => {
    for (const only of kites) q.move({ title: '' }, only, { degrees: 135 });
  });
  r.together(
    { title: 'Fold the little diamonds in half', text: 'Fold each diamond’s left corner over to its right corner.' },
    (q) => {
      kites.forEach((only, i) => {
        const [x, z] = centres[i];
        q.onto(table(x - halves[i], z), table(x + halves[i], z), { title: '', only });
      });
    },
  );
  r.unfold({ title: 'Unfold', text: 'Open them back up, leaving a crease down the middle of each.' });
  r.together({ title: 'Fold them into kites', text: 'Fold each one’s lower edges to its middle crease.' }, (q) => {
    kites.forEach((only, i) => {
      const [x, z] = centres[i];
      const d = halves[i];
      for (const s of [-1, 1]) q.edgeOnto([table(x, z + d), table(x + s * d, z)], [table(x, z + d), table(x, z - d)], { title: '', only });
    });
  });
  r.together({ title: 'Fold them in half', text: 'Fold each kite’s left half behind, along its middle crease. The pale one is the horns, the green one the legs.' }, (q) => {
    kites.forEach((only, i) => {
      const [x, z] = centres[i];
      q.along(table(x, z - 2), table(x, z + 2), table(x - 0.02, z), { title: '', kind: 'mountain', only });
    });
  });

  // The wings are the front and back flaps, standing up from the body: spread opposite ways, out to the sides,
  // from just above the body.
  const faces = toFlat(r.current).filter((f) => body([f.paper.reduce((a, p) => a + p[0], 0) / f.paper.length, 0]));
  const top = faces.flatMap((f) => f.world).reduce((m, p) => (p[1] < m[1] ? p : m));
  const low = Math.max(...faces.flatMap((f) => f.world.map((p) => p[1])));
  const hinge = T[1] - 0.01;
  // Each wing rippled across into ribs, as a fan: bends parallel to the hinge, alternating, the first half as much
  // so the zigzag is centred on the spread.
  const wingTop = top[1];
  const ripples = (only: (c: Vec2) => boolean, sense: 1 | -1): ShapeBend[] =>
    Array.from({ length: RIPPLES - 1 }, (_, i) => {
      const at = hinge + ((i + 1) * (wingTop - hinge)) / RIPPLES;
      const d = i === 0 ? RIPPLE_DEG / 2 : i % 2 ? -RIPPLE_DEG : RIPPLE_DEG;
      return { through: [table(-2, at), table(2, at)], moving: table(top[0], wingTop - 0.01), degrees: sense * d, only };
    });
  const wings: ShapeBend[] = [
    { through: [table(-2, hinge), table(2, hinge)], moving: table(top[0], hinge - 0.1), degrees: SPREAD, only: front },
    { through: [table(-2, hinge), table(2, hinge)], moving: table(top[0], hinge - 0.1), degrees: -SPREAD, only: back },
    ...ripples(front, 1),
    ...ripples(back, -1),
  ];

  // Standing up on the legs: the table's x stays x, its z (down the table) goes down. The body's lowest point,
  // under the tail, is lifted off the table so the legs, from the belly where the neck and tail part, reach it.
  const belly = up(NECK_ROOT);
  const lean = deg(LEG_LEAN);
  const lift = 2 * LEG * Math.cos(lean) - (low - belly[1]);
  const [fx, fz] = [belly[0], low];
  const world = ([x, z]: Vec2): Vec3 => [x - fx, 0.002 + lift - (z - fz), 0];
  // Each kite's half: its wide end (the table's z − d) on the body, its fold (the table's z) pointing `d`, its side
  // corner (the table's x) a quarter turn round from it, facing the same way as the body.
  const set = (only: (c: Vec2) => boolean, i: number, to: Vec3, d: Vec2) => ({
    only,
    pose: { from: table(centres[i][0], centres[i][1] - halves[i]), to, x: [-d[1], d[0], 0] as Vec3, up: [0, 0, 1] as Vec3 },
  });
  // The horns at the top of the back of the head (its highest corner), sweeping back and up.
  const crown = world(head.reduce((m, p) => (p[1] < m[1] ? p : m)));
  const hornUp = deg(HORN_UP);
  return r
    .assemble({ title: 'Spread the wings', text: 'Open the wings out to the sides, and stand the dragon up.' }, [
      { only: body, bends: wings, pose: { from: table(fx, fz), to: world([fx, fz]), x: [1, 0, 0], up: [0, 0, 1] } },
    ])
    .assemble({ title: 'Put the legs on', text: 'Stand the dragon on its legs: the green kite under its belly, where the neck and tail part, leaning forwards a little.' }, [
      set(legs, 1, world(belly), [-Math.sin(lean), -Math.cos(lean)]),
    ])
    .assemble({ title: 'Put the horns on', text: 'Set the horns on the back of the head, sweeping back. Done!' }, [
      set(horns, 0, [crown[0] + 0.004, crown[1], 0], [Math.cos(hornUp), Math.sin(hornUp)]),
    ])
    .build();
}
