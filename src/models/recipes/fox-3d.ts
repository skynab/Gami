import { toFlat } from '../../fold/fold';
import { paper, Recipe, table, type ShapeBend } from '../../fold/recipe';
import type { Vec2, Vec3 } from '../../fold/types';
import { faceMarks } from './face';
import { moved } from './waterbomb-base';

/**
 * A fox standing on four legs, in 3D, Gami's own, from three squares: the body snipped for legs, its belly strips
 * folded inside and folded in half along the back, then opened a little so it stands; a fox face from the cat face's
 * folds, looking forwards; and a long kite for the tail, held out behind.
 */
export function fox3d() {
  // Half of each square's side: body, head and tail.
  const b = 0.5;
  const k = 0.3;
  const t = 0.32;
  const orange = { front: '#e8742a', back: '#f6f3ec' };
  const white = { front: '#f6f3ec', back: '#e8742a' };
  const r = new Recipe({
    id: 'fox-3d',
    title: 'Standing fox',
    sheets: [
      { size: [2 * b, 2 * b], ...orange, origin: [0, 0], at: [-0.4, 0] },
      { size: [2 * k, 2 * k], ...white, origin: [10, 0], at: [0.8, -0.35] },
      { size: [2 * t, 2 * t], ...white, origin: [20, 0], at: [0.85, 0.5] },
    ],
  });
  const body = ([u]: Vec2) => u < 5;
  const head = ([u]: Vec2) => u > 5 && u < 15;
  const tail = ([u]: Vec2) => u > 15;
  const box = (only: (c: Vec2) => boolean) => {
    const pts = toFlat(r.current)
      .filter((f) => only(f.paper[0]))
      .flatMap((f) => f.world);
    const xs = pts.map((p) => p[0]);
    const zs = pts.map((p) => p[1]);
    return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...zs), bottom: Math.max(...zs) };
  };

  // The body: snipped in from the top and bottom edges, the strips between the snips folded behind, then folded in
  // half, top behind, so its fold is the back and the strips are inside: four legs.
  const [bx, bz] = r.where(paper(0, 0));
  const leg = 0.24;
  const gap = 0.37;
  r.together({ title: 'Snip the legs', text: 'Orange side up, cut two snips up from the bottom edge of the big square and two down from the top edge, a little in from each side.' }, (q) => {
    for (const s of [-1, 1])
      for (const e of [-1, 1]) q.cut(table(bx + s * gap, bz + e * (b + 0.01)), table(bx + s * gap, bz + e * (b - leg - 0.01)), { title: '', only: body });
  });
  const middle = r.lying(([x]) => Math.abs(x - bx) < gap);
  r.together({ title: 'Fold the bellies behind', text: 'Fold the strips between the snips behind, at the top and at the bottom.' }, (q) => {
    for (const e of [-1, 1]) q.along(table(bx - 1, bz + e * (b - leg)), table(bx + 1, bz + e * (b - leg)), table(bx, bz + e * (b - 0.02)), { title: '', kind: 'mountain', only: (c) => body(c) && middle(c) });
  });
  r.along(table(bx - 1, bz), table(bx + 1, bz), table(bx, bz - 0.3), { title: 'Fold the body in half', text: 'Fold the top half behind, so the strips are inside and four legs hang down.', kind: 'mountain', only: body });

  // The head: the cat face's folds, a triangle with its side corners folded up past its top point for ears.
  r.move({ title: 'Turn the head square', text: 'Take the small square, white side up, and turn it so a corner points towards you.' }, head, { degrees: 45 });
  const [hx, hz] = r.where(paper(10, 0));
  const h = k * Math.SQRT2;
  r.onto(table(hx, hz + h), table(hx, hz - h), { title: 'Fold the head in half', text: 'Fold its bottom corner up to its top corner, making a triangle.', only: head });
  const ear: Vec2 = [0.36 * h, -h - 0.04];
  const ears: ((c: Vec2) => boolean)[] = [];
  r.together({ title: 'Fold up the ears', text: 'Fold each side corner up, so its point sticks up past the top point and out to the side.' }, (q) => {
    for (const s of [-1, 1]) ears.push(moved(r, () => q.onto(table(hx + s * h, hz), table(hx + s * ear[0], hz + ear[1]), { title: '', only: head })));
  });
  r.along(table(hx - 1, hz - 0.62 * h), table(hx + 1, hz - 0.62 * h), table(hx, hz - h), {
    title: 'Fold the top behind',
    text: 'Fold the top point down behind, between the ears.',
    kind: 'mountain',
    only: (c) => head(c) && !ears.some((e) => e(c)),
  });
  r.move({ title: 'Turn the head over', text: 'Turn the head over, left to right.' }, head, { flip: true });
  const hb = box(head);
  const face = faceMarks([hx, hz - 0.62 * h], [hx, hb.bottom], { eyes: 'open', nose: true, whiskers: false });
  r.draw({ title: 'Draw a face', text: 'Draw two eyes and a nose on the face.' }, face);

  // The tail: a kite, its long point the tip.
  r.move({ title: 'Turn the tail square', text: 'Take the last square, white side up, and turn it so a corner points towards you.' }, tail, { degrees: 45 });
  const [tx, tz] = r.where(paper(20, 0));
  const d = t * Math.SQRT2;
  r.crease(table(tx - d, tz), table(tx + d, tz), { title: 'Crease the tail', text: 'Fold its left corner to its right corner, then unfold.', only: tail });
  r.together({ title: 'Fold the tail into a kite', text: 'Fold its lower edges to the middle crease. The long point is the tip of the tail.' }, (q) => {
    for (const s of [-1, 1]) q.edgeOnto([table(tx, tz + d), table(tx + s * d, tz)], [table(tx, tz + d), table(tx, tz - d)], { title: '', only: tail });
  });
  r.along(table(tx, tz - 2), table(tx, tz + 2), table(tx - 0.1, tz), { title: 'Fold the tail in half', text: 'Fold the left half behind, so the tail is orange on both sides.', kind: 'mountain', only: tail });

  // Standing it up. The body's halves open by `open` either side of the back, which runs along +x at height `high`,
  // its feet just touching the table. The table's +z (down the body) goes down, its up towards the viewer.
  const open = 12;
  const high = b * Math.cos((open * Math.PI) / 180) + 0.004;
  const bodyBends: ShapeBend[] = [-1, 1].map((s) => ({
    through: [table(bx - 1, bz), table(bx + 1, bz)],
    moving: table(bx, bz + 0.3),
    degrees: s * open,
    only: (c: Vec2) => body(c) && s * c[1] > 0,
  }));
  const bb = box(body);
  r.assemble({ title: 'Stand the body up', text: 'Open the body’s two sides a little and stand it on its four legs.' }, [
    { only: body, bends: bodyBends, pose: { from: table(bx, bz), to: [0, high, 0], x: [1, 0, 0], up: [0, 0, 1] } },
  ]);
  // The head at the front, facing forwards: its face's up towards +x, its ears up.
  const front = bb.right - bx;
  const [hcx, hcz] = [(hb.left + hb.right) / 2, (hb.top + hb.bottom) / 2];
  r.assemble({ title: 'Put the head on', text: 'Slip the head over the front of the body, facing forwards.' }, [
    { only: head, pose: { from: table(hcx, hcz), to: [front + 0.02, high + 0.06, 0], x: [0, 0, -1], up: [1, 0, 0] } },
  ]);
  // The tail out behind and a little up, its wide end tucked between the body's sides.
  const lift = (20 * Math.PI) / 180;
  const along: Vec3 = [-Math.cos(lift), Math.sin(lift), 0];
  return r
    .assemble({ title: 'Put the tail on', text: 'Tuck the tail’s wide end between the back legs, so it sticks out behind. Your fox is ready to explore!' }, [
      { only: tail, pose: { from: table(tx, tz - d), to: [bb.left - bx + 0.18, high - 0.06, 0], x: [-along[1], along[0], 0], up: [0, 0, 1] } },
    ])
    .build();
}
