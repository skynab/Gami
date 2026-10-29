import { toFlat } from '../../fold/fold';
import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { faceMarks } from './face';

/**
 * A sitting cat seen from the front, Gami's own, after the look of OrigamiOK's cute cat but from two squares: a big
 * one for the body, a tall kite with its bottom point folded up behind for a tail, and a small one for the head, the
 * cat face (a triangle with its corners folded up into ears), set on top.
 */
export function cuteCat() {
  const r = new Recipe({
    id: 'cute-cat',
    title: 'Cute cat',
    sheets: [
      { size: [1, 1], front: '#f4a660', back: '#e8833a', origin: [0, 0], at: [-0.6, 0] },
      { size: [0.7, 0.7], front: '#f4a660', back: '#e8833a', origin: [10, 0], at: [0.85, 0] },
    ],
  });
  const body = ([u]: Vec2) => u < 5;
  const head = ([u]: Vec2) => u > 5;

  r.together({ title: 'Start with two diamonds', text: 'A big square and a small one, light side up, each turned so a corner points towards you.' }, (q) => {
    q.move({ title: '' }, body, { degrees: 45 }).move({ title: '' }, head, { degrees: 45 });
  });

  // The body: a diamond `b` from its middle to each corner, its upper edges folded to the middle into a tall kite.
  const b = Math.SQRT1_2;
  const [bx, bz] = r.where(paper(0, 0));
  const [top, bottom, left, right]: Vec2[] = [[bx, bz - b], [bx, bz + b], [bx - b, bz], [bx + b, bz]];
  r.together({ title: 'Fold a kite', text: 'Fold the big square’s upper edges to the middle, making a tall kite.' }, (q) => {
    q.edgeOnto([table(...top), table(...left)], [table(...top), table(...bottom)], { title: '', only: body }).edgeOnto(
      [table(...top), table(...right)],
      [table(...top), table(...bottom)],
      { title: '', only: body },
    );
  });
  // The tail: the bottom point folded up behind, so it sticks out past the body's right side and the body sits on
  // a slant.
  const tail: Vec2 = [bx + 0.45, bz - 0.05];
  r.onto(table(...bottom), table(...tail), {
    title: 'Fold up the tail',
    text: 'Fold the bottom point up behind, so it sticks out to the right: the tail. The body now sits on its folded edge.',
    kind: 'mountain',
    only: body,
  });
  const neck = top[1] + 0.22;
  r.along(table(bx - 1, neck), table(bx + 1, neck), table(...top), {
    title: 'Fold the top behind',
    text: 'Fold the top point behind, for the neck.',
    kind: 'mountain',
    only: body,
  });

  // The head: the cat face, from a diamond `h` from its middle to each corner.
  const h = 0.35 * Math.SQRT2;
  const [hx, hz] = r.where(paper(10, 0));
  r.onto(table(hx, hz + h), table(hx, hz - h), { title: 'Fold the head in half', text: 'Fold the small square’s bottom corner up to its top corner.', only: head });
  const ear: Vec2 = [0.17, -h - 0.06];
  r.together({ title: 'Fold up the ears', text: 'Fold each side corner up, so its point sticks up past the top point and out to the side.' }, (q) => {
    q.onto(table(hx - h, hz), table(hx - ear[0], hz + ear[1]), { title: '', only: head }).onto(table(hx + h, hz), table(hx + ear[0], hz + ear[1]), {
      title: '',
      only: head,
    });
  });
  const brow = hz - h + 0.14;
  const ears = r.lying(([x, z]) => z < hz - 0.05 && Math.abs(x - hx) > 0.06);
  r.along(table(hx - 1, brow), table(hx + 1, brow), table(hx, hz - h), {
    title: 'Fold the top behind',
    text: 'Fold the head’s top point down behind, between the ears.',
    kind: 'mountain',
    only: (c) => head(c) && !ears(c),
  });

  // Set the head on the body, its chin over the neck.
  const span = (only: (c: Vec2) => boolean) => {
    const zs = toFlat(r.current)
      .filter((f) => only(f.paper[0]))
      .flatMap((f) => f.world.map((p) => p[1]));
    return [Math.min(...zs), Math.max(...zs)];
  };
  const [earTips, chin] = span(head);
  r.move({ title: 'Put the head on', text: 'Set the head on top of the body, its chin over the neck.' }, head, {
    to: table(bx, neck + 0.05 - (chin - earTips) / 2),
  });
  // The face: from the brow, between the ears, down to the chin.
  const [, faceChin] = span(head);
  const faceTop = faceChin - (chin - brow);
  return r
    .draw(
      { title: 'Draw a face', text: 'Draw on eyes, a nose and whiskers. Your cat is sitting pretty!' },
      faceMarks([bx, faceTop], [bx, faceChin], { eyes: 'open', nose: true, whiskers: true, eyesAt: 0.35, eyeGap: 0.2, noseAt: 0.62 }),
    )
    .build();
}
