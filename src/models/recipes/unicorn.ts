import { paper, Recipe, table, type ShapeBend } from '../../fold/recipe';
import type { Vec2, Vec3 } from '../../fold/types';

/** How far the neck leans forwards from upright, and the head points below level, in degrees. */
const NECK_LEAN = 40;
const HEAD_DOWN = 45;
/** How much of the neck's long point turns out for the head, and where an eye goes on it before it turns. */
const TIP = 0.34;
const EYE: Vec2 = [0.065, 0.14];
/** Where the bottom of the neck's fold sits: this far in front of the body and above its back. */
const NECK_X = 0.02;
const NECK_Y = 0.01;
/** The mane's fold, this far behind the neck's; its ripples, and the tail's, and how far the tail hangs from upright. */
const MANE_GAP = 0.006;
const RIPPLES = 8;
const RIPPLE_DEG = 25;
const TAIL_DROP = 45;

/**
 * A unicorn standing on four legs, in 3D, Orikata's own, with the look of OrigamiOK's (Imai Yudai's, collapsed from
 * one square) but built as the standing fox is, from several sheets. A rectangle for the body, snipped for four
 * long legs, its belly strips folded inside and folded in half along the back; a kite with its top corner folded
 * behind and folded in half for the neck, its tip turned out forwards with an outside reverse fold for the head; a
 * small kite folded in half for the horn; and two long, narrow leaves (a diamond with all four edges folded to the
 * middle, as the palm leaf starts), folded in half and rippled, for the mane and the tail.
 *
 * Everything but the body lies in the body's middle plane, between its sides, so the pieces meet edge to edge rather
 * than overlapping: the neck stands just in front of the body, as its back is a fold with no room inside it, and the
 * mane's fold runs along the neck's.
 */
export function unicorn() {
  // Half of each sheet's side: the body (a rectangle), the neck, the horn, the mane and the tail.
  const [bw, bh] = [0.4, 0.6];
  const k = 0.42;
  const c = 0.07;
  // The mane is as long as the back of the neck: from the kite's side corners to where the head turns.
  const m = (k * Math.SQRT2 * Math.SQRT2 - TIP - 0.02) / (2 * Math.SQRT2);
  const t = 0.2;
  const white = { front: '#f8f5fb', back: '#dccbf0' };
  // The neck, horn, mane and tail show their backs once folded into kites.
  const neckColours = { front: '#dccbf0', back: '#f8f5fb' };
  const hair = { front: '#9d82db', back: '#e98fc3' };
  const gold = { front: '#e2b23c', back: '#f3d36b' };
  const r = new Recipe({
    id: 'unicorn',
    title: 'Unicorn',
    sheets: [
      { size: [2 * bw, 2 * bh], ...white, origin: [0, 0], at: [0, 0] },
      { size: [2 * k, 2 * k], ...neckColours, origin: [10, 0], at: [1.05, -0.1] },
      { size: [2 * c, 2 * c], ...gold, origin: [20, 0], at: [1.05, 0.8] },
      { size: [2 * m, 2 * m], ...hair, origin: [30, 0], at: [-0.95, -0.35] },
      { size: [2 * t, 2 * t], ...hair, origin: [40, 0], at: [-0.95, 0.4] },
    ],
  });
  const body = ([u]: Vec2) => u < 5;
  const neck = ([u]: Vec2) => u > 5 && u < 15;
  const horn = ([u]: Vec2) => u > 15 && u < 25;
  const mane = ([u]: Vec2) => u > 25 && u < 35;
  const tail = ([u]: Vec2) => u > 35;
  // The body: snipped in from the long edges, the strips between the snips folded behind, then folded in half, top
  // behind, so its fold is the back and the strips are inside: four long legs.
  const [bx, bz] = r.where(paper(0, 0));
  const leg = 0.36;
  const gap = bw - 0.12;
  r.together({ title: 'Snip the legs', text: 'White side up, the rectangle standing tall, cut two snips up from the bottom edge and two down from the top edge, a little in from each side.' }, (q) => {
    for (const s of [-1, 1])
      for (const e of [-1, 1]) q.cut(table(bx + s * gap, bz + e * (bh + 0.01)), table(bx + s * gap, bz + e * (bh - leg - 0.01)), { title: '', only: body });
  });
  const middle = r.lying(([x]) => Math.abs(x - bx) < gap);
  r.together({ title: 'Fold the bellies behind', text: 'Fold the strips between the snips behind, at the top and at the bottom.' }, (q) => {
    for (const e of [-1, 1]) q.along(table(bx - 1, bz + e * (bh - leg)), table(bx + 1, bz + e * (bh - leg)), table(bx, bz + e * (bh - 0.02)), { title: '', kind: 'mountain', only: (c) => body(c) && middle(c) });
  });
  r.along(table(bx - 1, bz), table(bx + 1, bz), table(bx, bz - 0.3), { title: 'Fold the body in half', text: 'Fold the top half behind, so the strips are inside and four legs hang down.', kind: 'mountain', only: body });

  // The four squares, turned to diamonds, each creased down the middle and folded into a kite together.
  const squares = [neck, horn, mane, tail];
  r.together({ title: 'Start with four diamonds', text: 'Take the four squares, coloured side up: a big one for the neck, a little one for the horn and two for the mane and tail. Turn each so a corner points towards you.' }, (q) => {
    for (const only of squares) q.move({ title: '' }, only, { degrees: 45 });
  });
  const centres = [10, 20, 30, 40].map((u) => r.where(paper(u, 0)));
  const halves = [k, c, m, t].map((s) => s * Math.SQRT2);
  r.together({ title: 'Fold the diamonds in half', text: 'Fold each diamond’s left corner over to its right corner.' }, (q) => {
    squares.forEach((only, i) => {
      const [x, z] = centres[i];
      q.onto(table(x - halves[i], z), table(x + halves[i], z), { title: '', only });
    });
  });
  r.unfold({ title: 'Unfold', text: 'Open them back up, leaving a crease down the middle of each.' });
  r.together({ title: 'Fold them into kites', text: 'Fold each diamond’s lower edges to its middle crease.' }, (q) => {
    squares.forEach((only, i) => {
      const [x, z] = centres[i];
      const d = halves[i];
      for (const s of [-1, 1]) q.edgeOnto([table(x, z + d), table(x + s * d, z)], [table(x, z + d), table(x, z - d)], { title: '', only });
    });
  });

  // The neck: the kite's top corner folded behind, so the neck stands on a straight edge, then folded in half, its
  // fold the back of the neck, its long point the head.
  const [hx, hz] = centres[0];
  const d = halves[0];
  const sideZ = hz + d * (1 - Math.SQRT2);
  r.along(table(hx - 1, sideZ), table(hx + 1, sideZ), table(hx, hz - d), {
    title: 'Fold the neck’s top behind',
    text: 'Fold the neck’s top corner behind, along a line between its side corners.',
    kind: 'mountain',
    only: neck,
  });
  r.along(table(hx, hz - 2), table(hx, hz + 2), table(hx - 0.1, hz), { title: 'Fold the neck in half', text: 'Fold its left half behind, along its middle crease.', kind: 'mountain', only: neck });
  // The head: the point turned out forwards round the outside, along a line bisecting straight on (down the table)
  // and where the head ends up pointing (`head`, on the table).
  const tipLength = TIP;
  const root: Vec2 = [hx, hz + d - tipLength];
  // Where the head points, on the table: once the neck leans `NECK_LEAN` forwards, `HEAD_DOWN` below level.
  const turn = ((HEAD_DOWN - NECK_LEAN) * Math.PI) / 180;
  const head: Vec2 = [Math.cos(turn), -Math.sin(turn)];
  r.collapse(
    {
      title: 'Outside-reverse-fold the head',
      text: 'Open the neck’s point a little and wrap it round the outside, so it points the other way, forwards and a little down. This is the head.',
      kind: 'reverse',
    },
    [{ through: [table(...root), table(root[0] + head[0], root[1] + 1 + head[1])], kind: 'outside', only: neck }],
    r.sheetAt([hx + 0.05, sideZ + 0.05], neck),
  );

  // An eye on each side of the head, near its top and back. Where a point of the point lands once it's turned out:
  // reflected in the line it turned about.
  const uLen = Math.hypot(head[0], 1 + head[1]);
  const u: Vec2 = [head[0] / uLen, (1 + head[1]) / uLen];
  const turned = ([x, z]: Vec2): Vec2 => {
    const [vx, vz] = [x - root[0], z - root[1]];
    const dot = vx * u[0] + vz * u[1];
    return [root[0] + 2 * dot * u[0] - vx, root[1] + 2 * dot * u[1] - vz];
  };
  const ring = ([x, z]: Vec2, radius: number): Vec2[] => Array.from({ length: 12 }, (_, i) => [x + radius * Math.cos((i * Math.PI) / 6), z + radius * Math.sin((i * Math.PI) / 6)]);
  const eye = turned([hx + EYE[0], root[1] + EYE[1]]);
  const eyePaper = r.sheetAt(eye, neck);
  r.draw({ title: 'Draw an eye', text: 'Draw an eye on the head, near the top.' }, [{ fill: ring(eye, 0.014) }]);
  r.move({ title: 'Turn the neck over', text: 'Turn the neck over, left to right.' }, neck, { flip: true });
  r.draw({ title: 'Draw the other eye', text: 'And an eye on this side.' }, [{ fill: ring(r.where(eyePaper), 0.014) }]);
  r.move({ title: 'Turn it back', text: 'Turn the neck back over.' }, neck, { flip: true });

  // The horn: the small kite folded in half, a thin spike.
  const [cx, cz] = centres[1];
  const dc = halves[1];
  r.along(table(cx, cz - 2), table(cx, cz + 2), table(cx - 0.05, cz), { title: 'Fold the horn in half', text: 'Fold the horn’s left half behind, so it’s a thin spike.', kind: 'mountain', only: horn });

  // The mane and the tail: their kites' upper edges to the middle too, into long, narrow leaves; then both folded in half
  // along their length, so their folds are their top edges.
  r.together({ title: 'Narrow the mane and tail', text: 'Fold the mane’s and tail’s upper edges to the middle crease too, so each is a long, narrow leaf.' }, (q) => {
    for (const i of [2, 3]) {
      const [x, z] = centres[i];
      const dd = halves[i];
      const kc = (s: number) => table(x + s * (Math.SQRT2 - 1) * dd, z + dd * (1 - Math.SQRT2));
      for (const s of [-1, 1]) q.edgeOnto([table(x, z - dd), kc(s)], [table(x, z - dd), table(x, z + dd)], { title: '', only: squares[i] });
    }
  });
  const [mx, mz] = centres[2];
  const [tx, tz] = centres[3];
  r.together({ title: 'Fold the mane and tail in half', text: 'Fold each leaf in half along its length, its left half behind.' }, (q) => {
    for (const [x, z, only] of [[mx, mz, mane], [tx, tz, tail]] as const) q.along(table(x, z - 2), table(x, z + 2), table(x - 0.05, z), { title: '', kind: 'mountain', only });
  });

  // Standing it up. The body's halves open by `open` either side of the back, which runs along +x at height `high`,
  // its feet just touching the table. The table's +z (down the body) goes down, its up towards the viewer.
  const open = 12;
  const high = bh * Math.cos((open * Math.PI) / 180) + 0.004;
  const bodyBends: ShapeBend[] = [-1, 1].map((s) => ({
    through: [table(bx - 1, bz), table(bx + 1, bz)],
    moving: table(bx, bz + 0.3),
    degrees: s * open,
    only: (c: Vec2) => body(c) && s * c[1] > 0,
  }));
  r.assemble({ title: 'Stand the body up', text: 'Open the body’s two sides a little and stand it on its four legs.' }, [
    { only: body, bends: bodyBends, pose: { from: table(bx, bz), to: [0, high, 0], x: [1, 0, 0], up: [0, 0, 1] } },
  ]);

  // The neck rises from the front of the back, leaning forwards `lean`: its fold (the table's x = hx) the back of
  // the neck, its straight bottom edge sloping down to the front, over the chest. On the table, +z (towards the
  // head) goes up the neck, +x forwards.
  const lean = (NECK_LEAN * Math.PI) / 180;
  const up3: Vec3 = [Math.sin(lean), Math.cos(lean), 0];
  const front3: Vec3 = [Math.cos(lean), -Math.sin(lean), 0];
  const base: Vec2 = [hx, sideZ];
  const neckAt: Vec3 = [bw + NECK_X, high + NECK_Y, 0];
  const onNeck = ([x, z]: Vec2): Vec3 => [0, 1, 2].map((i) => neckAt[i] + (x - base[0]) * front3[i] + (z - base[1]) * up3[i]) as Vec3;
  r.assemble({ title: 'Put the neck on', text: 'Stand the neck on the front of the body, leaning forwards, its fold at the back and the head looking ahead.' }, [
    { only: neck, pose: { from: table(...base), to: neckAt, x: front3, up: [0, 0, -1] } },
  ]);

  // The horn on the forehead, where the head turns from the neck, pointing up and forwards.
  const poll = onNeck(root);
  const hornLean = (30 * Math.PI) / 180;
  const hornFront: Vec3 = [Math.cos(hornLean), -Math.sin(hornLean), 0];
  r.assemble({ title: 'Put the horn on', text: 'Set the horn on the forehead, pointing up and forwards.' }, [
    { only: horn, pose: { from: table(cx, cz - dc), to: [poll[0], poll[1] + 0.005, 0], x: hornFront, up: [0, 0, -1] } },
  ]);

  // Ripples: lines across a leaf, bending it back and forth, the first by half as much so it zigzags either side of
  // where it lay.
  const ripples = (only: (c: Vec2) => boolean, [x, z]: Vec2, dd: number, n: number, degrees: number): ShapeBend[] =>
    Array.from({ length: n - 1 }, (_, i) => {
      const at = z - dd + ((i + 1) * 2 * dd) / n;
      return { through: [table(x - 1, at), table(x + 1, at)], moving: table(x, z + dd), degrees: i === 0 ? degrees / 2 : i % 2 ? -degrees : degrees, only };
    });

  // The mane along the back of the neck, its fold against it, rippled. The back of the neck is the neck's fold, from its
  // bottom to where the head turns.
  const neckBottom = onNeck(base);
  const N: Vec3 = [-up3[1], up3[0], 0];
  const mid: Vec3 = [(neckBottom[0] + poll[0]) / 2 + N[0] * MANE_GAP, (neckBottom[1] + poll[1]) / 2 + N[1] * MANE_GAP, 0];
  // The mane's fold (x = mx on the table) along the neck, its open edges, at +x, away from it, along N.
  r.assemble({ title: 'Put the mane on', text: 'Ripple the mane back and forth across its length and stand it along the back of the neck, its fold against the neck.' }, [
    { only: mane, bends: ripples(mane, [mx, mz], halves[2], RIPPLES, RIPPLE_DEG), pose: { from: table(mx, mz), to: mid, x: N, up: [0, 0, 1] } },
  ]);

  // The tail out behind, from the top of the back, hanging down and back, rippled.
  const dt = halves[3];
  const drop = (TAIL_DROP * Math.PI) / 180;
  const T: Vec3 = [-Math.sin(drop), -Math.cos(drop), 0];
  const tailTop: Vec3 = [-bw - 0.02, high - 0.02, 0];
  return r
    .assemble({ title: 'Put the tail on', text: 'Ripple the tail the same way and hang it from the top of the back, its fold on top. Your unicorn is ready!' }, [
      {
        only: tail,
        bends: ripples(tail, [tx, tz], dt, RIPPLES, RIPPLE_DEG),
        pose: { from: table(tx, tz - dt), to: tailTop, x: [-T[1], T[0], 0], up: [0, 0, 1] },
      },
    ])
    .build();
}
