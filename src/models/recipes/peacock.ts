import { toFlat } from '../../fold/fold';
import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * A peacock showing off its tail, seen from the front, Gami's own, from two squares: a big green one for the tail,
 * its bottom and top corners folded behind into a fan, and a small blue one for the body, a kite narrowed twice
 * into a long neck with its tip folded down for the head, set in front of the tail.
 */
export function peacock() {
  const r = new Recipe({
    id: 'peacock',
    title: 'Peacock',
    sheets: [
      { size: [1, 1], front: '#1d8a7e', back: '#5fb39a', origin: [0, 0], at: [-0.75, 0] },
      { size: [0.6, 0.6], front: '#2a5fb0', back: '#3d78cc', origin: [10, 0], at: [0.65, 0] },
    ],
  });
  const tail = ([u]: Vec2) => u < 5;
  const body = ([u]: Vec2) => u > 5;
  const along = (a: Vec2, b: Vec2, moving: Vec2, step: { title: string; text: string; kind?: 'mountain'; only: (c: Vec2) => boolean }) =>
    r.along(table(...a), table(...b), table(...moving), step);

  r.together({ title: 'Start with two diamonds', text: 'A big green square and a small blue one, coloured side up, each turned so a corner points towards you.' }, (q) => {
    q.move({ title: '' }, tail, { degrees: 45 }).move({ title: '' }, body, { degrees: 45 });
  });

  // The tail: a diamond `h` from its middle to each corner, its bottom corner folded behind to the middle and its
  // top corner a little way, so it spreads like a fan.
  const h = Math.SQRT1_2;
  const [tx, tz] = r.where(paper(0, 0));
  r.onto(table(tx, tz + h), table(tx, tz), { title: 'Fold the tail’s bottom behind', text: 'Fold the green square’s bottom corner behind, to the middle.', kind: 'mountain', only: tail });
  along([tx - 1, tz - 0.5], [tx + 1, tz - 0.5], [tx, tz - h], {
    title: 'Fold the top behind',
    text: 'Fold the top corner behind a little way, so the tail spreads like a fan.',
    kind: 'mountain',
    only: tail,
  });

  // The body: a diamond `b` from its middle to each corner, folded into a kite pointing up, then narrowed again.
  const b = 0.3 * Math.SQRT2;
  const [bx, bz] = r.where(paper(10, 0));
  const [top, bottom, left, right]: Vec2[] = [[bx, bz - b], [bx, bz + b], [bx - b, bz], [bx + b, bz]];
  r.crease(table(...left), table(...right), { title: 'Crease the body square', text: 'Fold the blue square’s left corner to its right corner, then unfold.', only: body });
  r.edgeOnto([table(...top), table(...left)], [table(...top), table(...bottom)], { title: 'Fold a kite', text: 'Fold the upper left edge to the centre crease.', only: body })
    .edgeOnto([table(...top), table(...right)], [table(...top), table(...bottom)], { title: 'Fold the other side', text: 'And the upper right edge. It’s a kite, pointing up.', only: body });
  // The kite's side corners, where those folds' edges ended.
  const corner = (s: number): Vec2 => [bx + s * (Math.SQRT2 - 1) * b * Math.SQRT2, bz + b * (Math.SQRT2 - 1)];
  r.edgeOnto([table(...top), table(...corner(-1))], [table(...top), table(...bottom)], { title: 'Narrow the neck', text: 'Fold the long upper left edge to the centre again, making the top a long thin neck.', only: body })
    .edgeOnto([table(...top), table(...corner(1))], [table(...top), table(...bottom)], { title: 'And the right edge', text: 'The same on the right.', only: body });
  const head = top[1] + 0.09;
  along([bx - 1, head], [bx + 1, head], [bx, top[1]], { title: 'Fold the head down', text: 'Fold the tip of the neck down a little way, for the head.', only: body });

  // Stand the body in front of the tail, its bottom a little above the tail's bottom edge.
  const span = (only: (c: Vec2) => boolean) => {
    const zs = toFlat(r.current)
      .filter((f) => only(f.paper[0]))
      .flatMap((f) => f.world.map((p) => p[1]));
    return [Math.min(...zs), Math.max(...zs)];
  };
  const [bodyTop, bodyBottom] = span(body);
  const [, tailBottom] = span(tail);
  r.move({ title: 'Put the body in front', text: 'Set the body in front of the tail, near its bottom edge. Your peacock is showing off!' }, body, {
    to: table(tx, tailBottom - 0.04 - (bodyBottom - bodyTop) / 2),
  });
  return r.build();
}
