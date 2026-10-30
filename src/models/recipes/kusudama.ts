import type { Faces } from '../../fold/ops';
import { paper, Recipe, table, type At, type ShapeBend } from '../../fold/recipe';
import type { Sheet, Vec2, Vec3 } from '../../fold/types';

const PETALS = 60;
const FLOWERS = PETALS / 5;
/** The loop's strip: how long, and where its middle lies on the table. */
const LOOP = 1.6;
const LOOP_AT: Vec2 = [0, 1.8];

/**
 * The flower kusudama, traditional: sixty squares, each folded into a petal, five petals glued into a flower and
 * twelve flowers glued into a ball. A petal is a square folded into a triangle, its corners folded up to the top,
 * those flaps squashed into kites, their tips folded down and their outer halves folded in; its sides are then
 * glued together into a cone, here a three-sided one: the two halves of the square and, closing it, the two
 * folded flaps. The first square is folded in full; the rest wait in a pile and are folded the same way.
 */
export function kusudama() {
  const sheets: (Sheet & { at?: Vec2 })[] = Array.from({ length: PETALS }, (_, n) => ({
    size: [1, 1] as Vec2,
    front: '#f6f3ec',
    back: COLOURS[Math.floor(n / 5) % COLOURS.length],
    origin: [10 * n, 0] as Vec2,
    at: (n ? [0, -1.5] : [0, 0]) as Vec2,
  }));
  // And a strip for the loop it hangs from, lying between where the ball goes and the flowers waiting round it.
  sheets.push({ size: [LOOP, 0.12], front: '#f2c94c', back: '#f9e6a8', origin: [10 * PETALS, 0], at: LOOP_AT });
  const r = new Recipe({ id: 'kusudama', title: 'Kusudama flower ball', sheets, card: 'finished' });
  const square = (n: number) => ([u]: Vec2) => Math.abs(u - 10 * n) < 5;
  const local = (n: number, test: (u: number, v: number) => boolean) => ([u, v]: Vec2) => square(n)([u, v]) && test(u - 10 * n, v);
  const first = square(0);

  // The square turned to a diamond, then folded in half into a triangle point up: its long folded edge along z = 0
  // from (−h, 0) to (h, 0), its point A at the top. Its corners fold up to A, making a diamond of side ½: bottom
  // corner O, the square's middle; left and right corners M and N. Each flap is a quarter of the square: on the
  // sheet, the left one is u, v < 0 and the right one u, v > 0. A flap's top layer is the half nearer v = −u.
  const h = Math.SQRT1_2;
  const [O, A, M, N] = [[0, 0], [0, -h], [-h / 2, -h / 2], [h / 2, -h / 2]].map((p) => table(p[0], p[1]));
  const left = (n: number) => local(n, (u, v) => u < 0 && v < 0);
  const right = (n: number) => local(n, (u, v) => u > 0 && v > 0);
  r.move({ title: 'Turn the square', text: 'Take a square and turn it to a diamond, coloured side down.' }, first, { degrees: 45 })
    .onto(paper(-0.5, 0.5), paper(0.5, -0.5), { title: 'Fold in half', text: 'Fold the bottom corner up to the top corner: a triangle.', only: first })
    .together({ title: 'Fold the corners up', text: 'Fold the left and right corners up to the top corner: a small diamond with two flaps.' }, (q) => {
      q.onto(paper(-0.5, -0.5), A, { title: '', only: first }).onto(paper(0.5, 0.5), A, { title: '', only: first });
    });
  const flat = r.mark();
  r.together({ title: 'Crease the flaps', text: 'Fold each flap in half, its middle edge down onto its lower edge. Unfold them.' }, (q) => {
    q.edgeOnto([O, A], [O, M], { title: '', only: left(0) }).edgeOnto([O, A], [O, N], { title: '', only: right(0) });
  }).unfold({ to: flat, title: 'Unfold', text: 'Open the flaps back up, leaving the creases.' });
  // Squashing a flap is folding it in half on its crease, then opening its top layer back out over the diamond's
  // lower edge: its folded edge then lies along that edge, and it's a kite, its tip sticking out past the diamond.
  r.together({ title: 'Squash the flaps', text: 'Stand each flap up, open it and press it flat along its crease, into a kite lying over the diamond’s lower edge. Its tip sticks out at the top.', kind: 'squash' }, (q) => {
    q.edgeOnto([O, A], [O, M], { title: '', only: left(0) })
      .along(O, M, table(0, -h / 2), { title: '', only: local(0, (u, v) => u < 0 && v < 0 && v < u) })
      .edgeOnto([O, A], [O, N], { title: '', only: right(0) })
      .along(O, N, table(0, -h / 2), { title: '', only: local(0, (u, v) => u > 0 && v > 0 && v > u) });
  })
    .together({ title: 'Fold the tips down', text: 'Fold down the tip of each kite where it sticks out past the diamond, along the diamond’s upper edge.' }, (q) => {
      q.along(table(-h, 0), A, table(-0.5, -0.5), { title: '', only: left(0) }).along(table(h, 0), A, table(0.5, -0.5), { title: '', only: right(0) });
    })
    .together({ title: 'Fold the kites in half', text: 'Fold the outer half of each kite in over the diamond, along its lower edge.' }, (q) => {
      q.along(O, M, table(-0.45, -0.3), { title: '', only: left(0) }).along(O, N, table(0.45, -0.3), { title: '', only: right(0) });
    });

  // The other petals, folded the same way, laid out in rows behind the first. A petal's corner O is h/2 below its
  // middle, where a copy is put.
  const middle = (n: number): Vec2 => [-3.6 + 0.8 * (n % 10), -1.4 - 0.8 * Math.floor(n / 10)];
  const corner = (n: number): Vec2 => (n ? [middle(n)[0], middle(n)[1] + h / 2] : [0, 0]);
  const others = Array.from({ length: PETALS - 1 }, (_, k) => k + 1);
  r.copy({ title: 'Fold the other petals', text: `Fold the other ${PETALS - 1} squares into petals the same way.` }, 0, others, others.map(middle));

  // A petal glued into a three-sided cone: its right half turned up about the middle crease OA by 2θ, which brings its lower edges OM and ON to 45° apart; then each folded kite half turned up
  // about its lower edge by φ, into the plane of OM and ON, where the two meet. On the table with O at the
  // origin, the left half lying flat, its corners are O, A, M and `n3`.
  const theta = Math.asin(Math.sqrt(Math.SQRT1_2));
  const m: Vec3 = [-h / 2, 0, -h / 2];
  const n3: Vec3 = [(h / 2) * Math.cos(2 * theta), (h / 2) * Math.sin(2 * theta), -h / 2];
  const a: Vec3 = [0, 0, -h];
  const across = (v: Vec3, along: Vec3) => unit(sub(v, scale(unit(along), dot(v, unit(along)))));
  const phi = Math.acos(dot(across(a, m), across(n3, m)));
  const deg = (x: number) => (x * 180) / Math.PI;
  // A flap, the quarter of its square on the side `s` of the middle (as `left` and `right`), kept in the file as
  // that one square rather than each of its faces.
  const quarter = (n: number, s: number): Faces => ({ inPaper: [[[10 * n, 0], [10 * n + s * 0.5, 0], [10 * n + s * 0.5, s * 0.5], [10 * n, s * 0.5]]] });
  const cone = (n: number): ShapeBend[] => {
    const [x, z] = corner(n);
    const at = ([px, pz]: Vec2): At => table(x + px, z + pz);
    return [
      { through: [at([0, 0]), at([0, -h])], moving: at([0.2, -0.35]), degrees: deg(2 * theta) },
      { through: [at([0, 0]), at([-h / 2, -h / 2])], moving: at([-0.2, -0.35]), degrees: deg(phi), only: quarter(n, -1) },
      { through: [at([0, 0]), at([h / 2, -h / 2])], moving: at([0.2, -0.35]), degrees: deg(phi), only: quarter(n, 1) },
    ];
  };

  // The cone's own axis, towards the middle of its open end, and the way its flaps face, from the middle crease.
  const axis = unit(add(add(a, m), n3));
  const out = across(sub(scale(add(m, n3), 0.5), a), axis);
  // A petal set in a flower: its point at the flower's middle `centre`, its axis tilted `TILT` out from the flower's
  // `up` towards `towards`, its flaps facing out of the flower.
  const TILT = (70 * Math.PI) / 180;
  const pose = (n: number, centre: Vec3, up: Vec3, towards: Vec3) => {
    const P = unit(add(scale(up, Math.cos(TILT)), scale(across(towards, up), Math.sin(TILT))));
    const U = across(up, P);
    // The turn taking (axis, out, axis × out) to (P, U, P × U).
    const [w, W] = [cross(axis, out), cross(P, U)];
    const turn = (v: Vec3) => add(add(scale(P, dot(v, axis)), scale(U, dot(v, out))), scale(W, dot(v, w)));
    return { from: table(...corner(n)), to: centre, x: turn([1, 0, 0]), up: turn([0, 1, 0]), turn };
  };
  // Where a flower's petals' far corners go, to keep them all off the table: the cone's corners, and where its
  // flaps meet, halfway between OM and ON, as far from O as the flaps' corners on the diamond's edge, (h − ½, −½).
  const meet = scale(unit(add(unit(m), unit(n3))), Math.hypot(h - 0.5, 0.5));
  const lowest = (poses: { to: Vec3; turn: (v: Vec3) => Vec3 }[]) =>
    Math.min(...poses.flatMap((p) => [a, m, n3, meet].map((c) => add(p.to, p.turn(c))[1])));

  // A flower: petals 5k to 5k + 4, around `up` at `centre`, each towards one of `towards`.
  const flower = (k: number, centre: Vec3, up: Vec3, towards: Vec3[]) => towards.map((t, i) => pose(5 * k + i, centre, up, t));
  const ring = (k: number): Vec3[] => Array.from({ length: 5 }, (_, i) => [Math.cos((2 * Math.PI * i) / 5 + k), 0, Math.sin((2 * Math.PI * i) / 5 + k)]);
  // Flowers wait on the table in a ring round where the ball goes, those going into it first every other place,
  // so the ones left waiting are spread round it too, and each step is seen with the ball in the middle.
  const BALL_AT: Vec2 = [0, 3.6];
  const onTable = (k: number) => {
    const half = FLOWERS / 2;
    const turn = (2 * Math.PI * (k < half ? 2 * k : 2 * (k - half) + 1)) / FLOWERS;
    const placed = flower(k, [BALL_AT[0] - 3 * Math.sin(turn), 0, BALL_AT[1] - 3 * Math.cos(turn)], [0, 1, 0], ring(k));
    const lift = 0.01 - lowest(placed);
    return placed.map((p, i) => ({ sheet: 5 * k + i, bends: cone(5 * k + i), pose: { ...p, to: add(p.to, [0, lift, 0]) } }));
  };

  // The ball: a flower on each face of a dodecahedron, its petals towards that face's corners, where three
  // flowers' petals meet. Its faces' middles are the corners of an icosahedron.
  const g = (1 + Math.sqrt(5)) / 2;
  const faces: Vec3[] = [
    [0, 1, g], [0, -1, g], [0, 1, -g], [0, -1, -g],
    [1, g, 0], [-1, g, 0], [1, -g, 0], [-1, -g, 0],
    [g, 0, 1], [-g, 0, 1], [g, 0, -1], [-g, 0, -1],
  ].map((v) => unit(v as Vec3));
  // Lowest faces first, so the ball is built up from the bottom.
  faces.sort((p, q) => p[1] - q[1]);
  const corners: Vec3[] = [
    ...[-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z): Vec3 => [x, y, z]))),
    ...[-1, 1].flatMap((s) => [-1, 1].flatMap((t): Vec3[] => [[0, s / g, t * g], [s / g, t * g, 0], [t * g, 0, s / g]])),
  ].map(unit);
  const DEPTH = 0.5;
  const ball = (k: number, middle: Vec3) => {
    const up = faces[k];
    const near = [...corners].sort((p, q) => dot(q, up) - dot(p, up)).slice(0, 5);
    // Round the face in order.
    const [e1, e2] = [across(near[0], up), cross(up, across(near[0], up))];
    near.sort((p, q) => Math.atan2(dot(p, e2), dot(p, e1)) - Math.atan2(dot(q, e2), dot(q, e1)));
    return flower(k, add(middle, scale(up, DEPTH)), up, near);
  };
  const BALL: Vec3 = [BALL_AT[0], 0, BALL_AT[1]];
  const all = Array.from({ length: FLOWERS }, (_, k) => ball(k, BALL));
  const lift = 0.01 - lowest(all.flat());
  // The top of the ball, where the loop goes, and the loop's left end on the table.
  const top = Math.max(...all.flat().flatMap((p) => [a, m, n3, meet].map((c) => add(p.to, p.turn(c))[1]))) + lift;
  const loopEnd = LOOP_AT[0] - LOOP / 2;
  const inBall = (ks: number[]) =>
    ks.flatMap((k) => all[k].map((p, i) => ({ sheet: 5 * k + i, bends: cone(5 * k + i), pose: { ...p, to: add(p.to, [0, lift, 0]) } })));

  const strip = (p: { sheet: number; bends: ShapeBend[]; pose: ReturnType<typeof pose> }) => ({ sheet: p.sheet, bends: p.bends, pose: { from: p.pose.from, to: p.pose.to, x: p.pose.x, up: p.pose.up } });
  const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i);
  return r
    .assemble({ glue: true, title: 'Glue a petal', text: 'Glue the two folded flaps together, so the petal closes into a cone.' }, [{ sheet: 0, bends: cone(0) }])
    .assemble({ glue: true, title: 'Glue five into a flower', text: 'Glue five petals side by side, their points together, into a flower.' }, onTable(0).map(strip))
    .assemble({ glue: true, title: 'Make the other flowers', text: `Glue the other petals into ${FLOWERS - 1} more flowers the same way.` }, range(1, FLOWERS).flatMap(onTable).map(strip))
    .assemble({ glue: true, title: 'Start the ball', text: 'Glue the flowers together where their petals meet: one in the middle and five round it, a bowl.' }, inBall(range(0, 6)).map(strip))
    .assemble({ glue: true, title: 'Finish the ball', text: 'Glue on the other six flowers, the last one on top, to close the ball.' }, inBall(range(6, FLOWERS)).map(strip))
    .assemble({ glue: true, title: 'Add a loop', text: 'Glue the ends of a strip together into a loop, and glue it in between the top flowers to hang the ball. Done!' }, [
      {
        sheet: PETALS,
        // Curled right round from its left end, which stays put at the bottom of the loop, tucked in at the top of the ball.
        bends: [{ through: [table(loopEnd, -1), table(loopEnd, 1)], moving: table(loopEnd + LOOP, LOOP_AT[1]), degrees: 360, segments: 24 }],
        pose: { from: table(loopEnd, LOOP_AT[1]), to: [BALL[0], top - 0.06, BALL[2]], x: [1, 0, 0], up: [0, 1, 0] },
      },
    ])
    .build();
}

/** Each flower's colour, on the back of its squares: the side that ends up outside. */
const COLOURS = ['#e5534b', '#f0883e', '#a66bd6', '#5b8def'];

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const unit = (a: Vec3): Vec3 => scale(a, 1 / Math.hypot(...a));
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
