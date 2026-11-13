import { toFlat } from '../../fold/fold';
import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * A squirrel sitting up, seen from the side, Gami's own, from three squares: a triangle for the body, standing on
 * its point with that folded behind for feet; a tall kite for the bushy tail, its top flicked over, rising behind the
 * back; and a small triangle for the head, its top corner the ear.
 */
export function squirrel() {
  // Half of each square's side: body, tail and head.
  const b = 0.4;
  const t = 0.38;
  const k = 0.22;
  const colours = { front: '#e9c79a', back: '#a8612a' };
  const r = new Recipe({
    id: 'squirrel',
    title: 'Squirrel',
    sheets: [
      { size: [2 * b, 2 * b], ...colours, origin: [0, 0], at: [-0.8, 0] },
      { size: [2 * t, 2 * t], ...colours, origin: [10, 0], at: [0.45, 0] },
      { size: [2 * k, 2 * k], ...colours, origin: [20, 0], at: [1.35, 0] },
    ],
  });
  const body = ([u]: Vec2) => u < 5;
  const tail = ([u]: Vec2) => u > 5 && u < 15;
  const head = ([u]: Vec2) => u > 15;
  const box = (only: (c: Vec2) => boolean) => {
    const pts = toFlat(r.current)
      .filter((f) => only(f.paper[0]))
      .flatMap((f) => f.world);
    const xs = pts.map((p) => p[0]);
    const zs = pts.map((p) => p[1]);
    return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...zs), bottom: Math.max(...zs) };
  };

  r.together({ title: 'Start with three diamonds', text: 'Three squares, light side up, each turned so a corner points towards you: a middle-sized one, a big one and a small one.' }, (q) => {
    for (const only of [body, tail, head]) q.move({ title: '' }, only, { degrees: 45 });
  });

  // The body: folded in half, right over left, its folded edge the back; its bottom point folded behind for feet.
  const [bx, bz] = r.where(paper(0, 0));
  const d = b * Math.SQRT2;
  r.along(table(bx, bz - 2), table(bx, bz + 2), table(bx + 0.1, bz), { title: 'Fold the body in half', text: 'Fold the middle square’s right corner over to its left corner.', only: body });
  r.along(table(bx - 1, bz + d - 0.1), table(bx + 1, bz + d - 0.1), table(bx - 0.02, bz + d), {
    title: 'Fold the feet behind',
    text: 'Fold the bottom point behind, so the body sits on a flat edge.',
    kind: 'mountain',
    only: body,
  });

  // The tail: a kite, turned over so it's dark all over, its top point flicked down.
  const [tx, tz] = r.where(paper(10, 0));
  const h = t * Math.SQRT2;
  r.crease(table(tx - h, tz), table(tx + h, tz), { title: 'Crease the tail', text: 'Fold the big square’s left corner to its right corner, then unfold.', only: tail });
  r.together({ title: 'Fold the tail into a kite', text: 'Fold its lower edges to the middle crease.' }, (q) => {
    for (const s of [-1, 1]) q.edgeOnto([table(tx, tz + h), table(tx + s * h, tz)], [table(tx, tz + h), table(tx, tz - h)], { title: '', only: tail });
  });
  r.move({ title: 'Turn the tail over', text: 'Turn the kite over, left to right.' }, tail, { flip: true });
  r.along(table(tx - 1, tz - h + 0.22), table(tx + 1, tz - h + 0.22), table(tx, tz - h), {
    title: 'Flick the tail’s tip',
    text: 'Fold the top point down, so the tail’s tip curls over.',
    only: tail,
  });

  // The head: folded in half to point left, the top corner the ear, the bottom one folded behind.
  const [hx, hz] = r.where(paper(20, 0));
  const e = k * Math.SQRT2;
  r.along(table(hx, hz - 2), table(hx, hz + 2), table(hx + 0.1, hz), { title: 'Fold the head in half', text: 'Fold the small square’s right corner over to its left corner. The point on the left is the nose; the top corner is the ear.', only: head });
  r.along(table(hx - 1, hz + e * 0.45), table(hx + 1, hz + e * 0.45), table(hx - 0.02, hz + e), {
    title: 'Fold the chin behind',
    text: 'Fold the bottom corner behind.',
    kind: 'mountain',
    only: head,
  });

  // Put it together: the tail up behind the back, leaning over it; the head on top, facing forwards.
  const bb = box(body);
  r.move({ title: 'Put the tail on', text: 'Slip the tail’s point behind the body, so the tail rises up behind its back and leans over it.' }, tail, {
    degrees: 15,
    to: table(bb.right + 0.2, bz - 0.1),
    under: true,
  });
  const hb = box(head);
  r.move({ title: 'Put the head on', text: 'Set the head on top of the body, its nose to the front.' }, head, {
    to: table(bb.right + 0.04 - (hb.right - hb.left) / 2, bb.top + 0.1),
  });
  const nose = r.where(paper(20 - k, -k));
  const ear = r.where(paper(20 + k, -k));
  const eye: Vec2 = [nose[0] + 0.55 * (ear[0] - nose[0]), nose[1] + 0.3 * (ear[1] - nose[1])];
  const ring = (x: number, z: number, rad: number): Vec2[] => Array.from({ length: 10 }, (_, i) => [x + rad * Math.cos((i / 10) * 2 * Math.PI), z + rad * Math.sin((i / 10) * 2 * Math.PI)]);
  return r.draw({ title: 'Draw an eye', text: 'Draw an eye on the head. Your squirrel is keeping watch!' }, [{ fill: ring(...eye, 0.016) }]).build();
}
