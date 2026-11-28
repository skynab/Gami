import { toFlat } from '../../fold/fold';
import { paper, Recipe, table, type ShapeBend } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * A bull, Orikata's own, from two squares: a big one for the body, folded in half with two snips up from its bottom
 * edge and the paper between them tucked up inside, leaving four legs, and a small one for the head, folded like
 * the heart bookmark so its two humps stand up as horns, set at the front. Then stood up in 3D, the body's sides
 * opened a little and the face looking forwards.
 */
export function bull() {
  const r = new Recipe({
    id: 'bull',
    title: 'Bull',
    sheets: [
      { size: [1, 1], front: '#e88a73', back: '#cc4a38', origin: [0, 0], at: [-0.35, 0] },
      { size: [0.72, 0.72], front: '#e88a73', back: '#cc4a38', origin: [10, 0], at: [0.9, 0] },
    ],
  });
  const body = ([u]: Vec2) => u < 5;
  const head = ([u]: Vec2) => u > 5;

  // The body: folded in half, top to bottom, so its fold is the back, along z = bz, and its raw edges run along the
  // bottom at bz + ½. Two snips `leg` long, `gap` either side of the middle, free the paper between the legs.
  const [bx, bz] = r.where(paper(0, 0));
  r.onto(table(bx, bz - 0.5), table(bx, bz + 0.5), { title: 'Fold the body in half', text: 'Fold the big square in half, top to bottom.', only: body });
  const leg = 0.2;
  const gap = 0.3;
  const feet = bz + 0.5;
  const knees = feet - leg;
  r.together({ title: 'Snip the legs', text: 'Cut two snips up from the bottom edge, through both layers, a little in from each end.' }, (q) => {
    for (const s of [-1, 1]) q.cut(table(bx + s * gap, feet + 0.01), table(bx + s * gap, knees - 0.01), { title: '', only: body });
  });
  // The snips split the paper into strips down the body: the belly is the middle one.
  const belly = r.lying(([x]) => Math.abs(x - bx) < gap);
  // Pushed up inside, between the layers, rather than folded behind both: each side keeps its own belly, so the
  // sides can open apart at the end.
  r.collapse(
    { title: 'Tuck up the belly', text: 'Push the paper between the snips up inside, between the layers, leaving four legs.', kind: 'reverse' },
    [{ through: [table(bx - 1, knees), table(bx + 1, knees)], kind: 'inside', only: (c) => body(c) && belly(c) }],
    paper(0.4, 0.1),
  );

  // The head, from the front, folded like the heart bookmark: a diamond `h` from its middle to each corner, folded
  // bottom to top into a triangle, its top point folded behind at `notch`, its side corners folded up to where the
  // point was, and those flaps' points folded down from the middle out to `horn`, standing up either side of a notch.
  const h = 0.36 * Math.SQRT2;
  r.move({ title: 'Turn the head square', text: 'Turn the small square so a corner points towards you.' }, head, { degrees: 45 });
  const [hx, hz] = r.where(paper(10, 0));
  const notch = hz - 0.5 * h;
  const horn: Vec2 = [0.14 * h, -0.9 * h];
  r.onto(table(hx, hz + h), table(hx, hz - h), { title: 'Fold the head in half', text: 'Fold its bottom corner up to its top corner, making a triangle.', only: head });
  r.along(table(hx - 1, notch), table(hx + 1, notch), table(hx, hz - h), {
    title: 'Fold the top behind',
    text: 'Fold the top point behind, halfway down.',
    kind: 'mountain',
    only: head,
  });
  const left = r.lying(([x]) => x < hx - 0.001);
  const right = r.lying(([x]) => x > hx + 0.001);
  r.together({ title: 'Fold the corners up', text: 'Fold each side corner up to where the top point was.' }, (q) => {
    for (const s of [-1, 1]) q.onto(table(hx + s * h, hz), table(hx, hz - h), { title: '', only: head });
  });
  r.together({ title: 'Fold down the horns', text: 'Fold each flap’s point down in front, from the middle out to the edge, so a horn stands up each side.' }, (q) => {
    for (const s of [-1, 1]) {
      q.along(table(hx, notch), table(hx + s * horn[0], hz + horn[1]), table(hx, hz - h), { title: '', only: (c) => head(c) && (s < 0 ? left : right)(c) });
    }
  });

  // Set the head at the front of the body, its muzzle a little below the back.
  const box = (only: (c: Vec2) => boolean) => {
    const pts = toFlat(r.current)
      .filter((f) => only(f.paper[0]))
      .flatMap((f) => f.world);
    const xs = pts.map((p) => p[0]);
    const zs = pts.map((p) => p[1]);
    return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...zs), bottom: Math.max(...zs) };
  };
  const b = box(body);
  const k0 = box(head);
  r.move({ title: 'Put the head on', text: 'Set the head on the front of the body, its muzzle a little below the back.' }, head, {
    to: table(b.right - 0.02, b.top + 0.3 - (k0.bottom - k0.top) / 2),
  });
  const k = box(head);
  const cx = (k.left + k.right) / 2;
  const ring = (x: number, z: number, rad: number) => Array.from({ length: 10 }, (_, i): Vec2 => [x + rad * Math.cos((i / 10) * 2 * Math.PI), z + rad * Math.sin((i / 10) * 2 * Math.PI)]);
  // The face is the square between the horns, its bottom corner the muzzle: eyes `up` its height above that,
  // nostrils near it, drawn either side of the middle, where the flaps meet.
  const at = (up: number) => k.bottom - up * h;
  r.draw({ title: 'Draw a face', text: 'Draw two eyes and two nostrils on the head.' }, [
      { fill: ring(cx - 0.08, at(0.5), 0.022) },
      { fill: ring(cx + 0.08, at(0.5), 0.022) },
      { fill: ring(cx - 0.04, at(0.18), 0.014) },
      { fill: ring(cx + 0.04, at(0.18), 0.014) },
  ]);

  // Standing it up: the body's sides open `open` either side of its back (the fold, along z = bz), and it stands on
  // its four legs, the table's +z going down and its up towards the viewer. The head, a face seen from the front,
  // turns to look forwards (+x), its horns up, at the front of the body.
  const open = 14;
  const sides: ShapeBend[] = [1, -1].map((s) => ({
    through: [table(bx - 1, bz), table(bx + 1, bz)],
    moving: table(bx, bz + 0.2),
    degrees: s * open,
    only: (c: Vec2) => body(c) && s * c[1] < 0,
  }));
  const high = (feet - bz) * Math.cos((open * Math.PI) / 180) + 0.003;
  const middle: Vec2 = [cx, (k.top + k.bottom) / 2];
  return r
    .assemble({ title: 'Stand it up', text: 'Open the body’s two sides a little and stand it on its four legs, its face looking forwards. Your bull is ready to charge!' }, [
      { only: body, bends: sides, pose: { from: table(bx, bz), to: [0, high, 0], x: [1, 0, 0], up: [0, 0, 1] } },
      { only: head, pose: { from: table(...middle), to: [b.right - bx + 0.02, high - (middle[1] - bz), 0], x: [0, 0, -1], up: [1, 0, 0] } },
    ])
    .build();
}
