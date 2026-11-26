import { toFlat } from '../../fold/fold';
import { paper, Recipe, table, type ShapeBend } from '../../fold/recipe';
import type { Vec2, Vec3 } from '../../fold/types';

/**
 * A T-rex, Gami's own, from two squares: a big one for the body, a kite folded in half and laid on its side, its long
 * point the tail and its corner the legs, and a small one for the head, folded in half with its snout's top corner
 * folded behind, set high on the body's front end. Then stood up in 3D, the body's halves opened a little and the
 * head sitting up on the front of its back.
 */
export function tRex() {
  const r = new Recipe({
    id: 't-rex',
    title: 'T-rex',
    sheets: [
      { size: [1, 1], front: '#ef9a2d', back: '#f7c77e', origin: [0, 0], at: [-0.5, 0] },
      { size: [0.45, 0.45], front: '#ef9a2d', back: '#f7c77e', origin: [10, 0], at: [0.85, 0] },
    ],
  });
  const body = ([u]: Vec2) => u < 5;
  const head = ([u]: Vec2) => u > 5;

  // The body: a diamond `h` from its middle to each corner, folded into a kite, then in half and turned on its side.
  const h = Math.SQRT1_2;
  r.move({ title: 'Start with a diamond', text: 'Start with the big square, dark side up, a corner pointing towards you.' }, body, { degrees: 45 });
  const [bx, bz] = r.where(paper(0, 0));
  const [top, bottom] = [table(bx, bz - h), table(bx, bz + h)];
  r.crease(table(bx - h, bz), table(bx + h, bz), { title: 'Crease down the middle', text: 'Fold the left corner to the right corner, and unfold.', only: body });
  r.together({ title: 'Fold a kite', text: 'Fold the lower edges to the middle crease, making a kite.' }, (q) => {
    q.edgeOnto([bottom, table(bx - h, bz)], [bottom, top], { title: '', only: body }).edgeOnto([bottom, table(bx + h, bz)], [bottom, top], {
      title: '',
      only: body,
    });
  });
  r.along(top, bottom, table(bx - 0.2, bz), { title: 'Fold in half', text: 'Fold the left half behind onto the right.', kind: 'mountain', only: body });
  r.move({ title: 'Turn it', text: 'Turn it on its side: the long point is the tail, the corner below is the legs.' }, body, { degrees: -90 });

  // The head: folded in half, top to bottom, with the snout's top corner folded behind.
  const s = 0.225;
  const [hx, hz] = r.where(paper(10, 0));
  r.onto(table(hx, hz - s), table(hx, hz + s), { title: 'Fold the head in half', text: 'Fold the small square in half, top to bottom.', only: head });
  r.along(table(hx + s - 0.16, hz), table(hx + s, hz + 0.1), table(hx + s, hz), {
    title: 'Shape the snout',
    text: 'Fold the top right corner behind, so the snout slopes down to the front.',
    kind: 'mountain',
    only: head,
  });

  // Set the head above the body's front end, a little forward of the legs.
  const box = (only: (c: Vec2) => boolean) => {
    const pts = toFlat(r.current)
      .filter((f) => only(f.paper[0]))
      .flatMap((f) => f.world);
    const xs = pts.map((p) => p[0]);
    const zs = pts.map((p) => p[1]);
    return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...zs), bottom: Math.max(...zs) };
  };
  const b = box(body);
  r.move({ title: 'Put the head on', text: 'Set the head on the front of the body, a little higher than its back.' }, head, {
    to: table(b.right - 0.12, b.top - 0.02),
  });
  const k = box(head);
  const ring = (x: number, z: number, rad: number) => Array.from({ length: 10 }, (_, i): Vec2 => [x + rad * Math.cos((i / 10) * 2 * Math.PI), z + rad * Math.sin((i / 10) * 2 * Math.PI)]);
  // A zigzag of teeth just above the head's bottom edge, from the snout back.
  const teeth = Array.from({ length: 9 }, (_, i): Vec2 => [k.right - 0.03 - i * 0.03, k.bottom - (i % 2 ? 0.045 : 0.012)]);
  r.draw({ title: 'Draw a face', text: 'Draw an eye and a row of sharp teeth on the head.' }, [{ fill: ring(k.left + 0.1, k.top + 0.06, 0.02) }, { line: teeth }]);

  // Standing it up: the body's halves open `open` either side of its back (the kite's middle, folded), and it
  // stands on its legs, the table's +z going down and its up towards the viewer. The head goes up onto the back
  // above where it lay, turned a little about the upright to look out.
  const [A, B] = [r.where(paper(0.5, -0.5)), r.where(paper(-0.5, 0.5))];
  // A point on the body off its back, on the legs' side, and the legs' tip, its lowest point.
  const side = r.where(paper(0.3, 0));
  const legs = box(body).bottom;
  const open = 14;
  const right = ([u, v]: Vec2) => u + v > 0;
  const halves: ShapeBend[] = [1, -1].map((s) => ({
    through: [table(...A), table(...B)],
    moving: table(...side),
    degrees: s * open,
    only: (c: Vec2) => body(c) && (s > 0 ? right(c) : !right(c)),
  }));
  // The back is level: A and B share a z. The legs reach down from it, shortened by the opening.
  const back = A[1];
  const high = (legs - back) * Math.cos((open * Math.PI) / 180) + 0.003;
  const at = ([x, z]: Vec2): Vec3 => [x - bx, high - (z - back), 0];
  const add = (p: Vec3, q: Vec3): Vec3 => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
  const a = (20 * Math.PI) / 180;
  // The head sits up on the front of the back, its lower edge on it: turned to look out, it couldn't go down between
  // the body's halves without passing through them, and its snout's fold holds its layers shut, so they can't open
  // to sit astride them.
  const perch = k.bottom - back + 0.002;
  const middle: Vec2 = [(k.left + k.right) / 2, (k.top + k.bottom) / 2];
  return r
    .assemble({ title: 'Stand it up', text: 'Open the body’s two sides a little and stand it on its legs. Sit the head up on the front of its back, turned to look out. Roar!' }, [
      { only: body, bends: halves, pose: { from: table(bx, back), to: at([bx, back]), x: [1, 0, 0], up: [0, 0, 1] } },
      { only: head, pose: { from: table(...middle), to: add(at(middle), [0, perch, 0]), x: [Math.cos(a), 0, -Math.sin(a)], up: [Math.sin(a), 0, Math.cos(a)] } },
    ])
    .build();
}
