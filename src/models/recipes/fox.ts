import { lerp, lineThrough, reflect, sideOf } from '../../fold/geometry2d';
import { locate, paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { faceMarks } from './face';

/** A sitting fox, after Mitsuo Okuda's design, following origami.me/fox. */
export function fox() {
  // Turned a quarter-turn halfway, the sheet's corners are: top (½, −½), bottom (−½, ½), left (−½, −½), right (½, ½).
  const r = new Recipe({ id: 'fox', title: 'Fox', sheet: { size: [1, 1], front: '#f6f3ec', back: '#e08a2e' } })
    .rotate(45, { title: 'Start as a diamond', text: 'White side up, with a corner pointing towards you.' })
    .crease(paper(-0.5, -0.5), paper(0.5, 0.5), { title: 'Fold in half', text: 'Fold the left corner to the right corner, then unfold.' })
    .onto(paper(-0.5, 0.5), paper(0.5, -0.5), { title: 'Fold the bottom up', text: 'Bring the bottom corner up to the top corner.' })
    .onto(paper(-0.5, -0.5), paper(0.5, -0.5), { title: 'Fold the left corner up', text: 'Fold the left corner up to the top.' })
    .onto(paper(0.5, 0.5), paper(0.5, -0.5), { title: 'Fold the right corner up', text: 'And the right one. It’s a small diamond.' })
    .turnOver();
  const top = r.where(paper(0.5, -0.5));
  r.along(table(top[0], -2), table(top[0], 2), table(top[0] - 0.2, top[1] + 0.35), {
    title: 'Fold in half',
    text: 'Fold the left half over onto the right.',
  }).rotate(-45, { title: 'Turn it', text: 'Turn it an eighth of a turn clockwise, so the long edge slopes up to the right.' });

  // A right triangle now: the square corner B at the bottom right, the tip T above it, the left corner L.
  // All four of the sheet's corners are at T, each on its own flap: the ear is the right corner's flap, the
  // head the flap of the top and bottom corners (those quarters of the sheet have u·v < 0), the back ear the left.
  const T = r.where(paper(0.5, 0.5));
  const B = r.where(paper(0.5, 0));
  const L = r.where(paper(0, 0));
  // The ear's crease runs from B to a point on the long edge a little below the tip; anywhere looks fine.
  const Q = lerp(T, L, 0.22);
  const ear = lineThrough(B, Q);
  const head = ([u, v]: Vec2) => u * v < 0;
  r.along(table(...B), table(...Q), table(...T), {
    title: 'Fold an ear',
    text: 'Fold the top flap’s right edge over to the left, from the bottom corner. This is one ear.',
    layers: 2,
  }).along(table(...B), table(...Q), table(...T), {
    title: 'Fold the middle flap over',
    text: 'Fold the next flap over along the same line. (You can just stand it straight up instead.)',
    only: head,
  });

  // The squash: the head flap's tip is pressed flat into a diamond on the ear's crease, its two halves each
  // folding along the line halving the angle at Q (worked out with the flap folded over, as it lies now).
  const Tf = reflect(ear, T);
  const unit = (p: Vec2): Vec2 => [(p[0] - Q[0]) / Math.hypot(p[0] - Q[0], p[1] - Q[1]), (p[1] - Q[1]) / Math.hypot(p[0] - Q[0], p[1] - Q[1])];
  const [a, b] = [unit(Tf), unit(B)];
  const bisect: Vec2 = [Q[0] + a[0] + b[0], Q[1] + a[1] + b[1]];
  // The flap, and the part of it beyond the bisector, by where each face lies with the flap folded over.
  const folded = r.current;
  const inFlap = (c: Vec2) => inTriangle(locate(folded, c), B, Q, Tf);
  const nearTip = (c: Vec2) => inTriangle(locate(folded, c), Q, Tf, lineHit(Q, bisect, B, Tf));
  const front = (c: Vec2) => head(c) && c[0] + c[1] > 0;
  const back = (c: Vec2) => head(c) && c[0] + c[1] < 0;
  // The flap folds back out to the right first, so the squash is a move of its own. From there its creases are
  // those lines mirrored in the ear's crease, each folding the other way, as the paper lies the other way up;
  // and the front half folds back over on the ear's crease as it squashes.
  const back2 = reflect(ear, bisect);
  r.unfold({ title: 'Open the flap back out', text: 'Fold the middle flap back to the right, leaving its crease.' }).collapse(
    {
      title: 'Squash the head',
      text: 'Open the flap from the left and press its tip down onto the crease, so it flattens into a diamond: the face.',
      kind: 'squash',
    },
    [
      { through: [table(...B), table(...Q)], kind: 'valley', only: front },
      { through: [table(...Q), table(...back2)], kind: 'mountain', only: (c) => front(c) && inFlap(c) },
      { through: [table(...Q), table(...back2)], kind: 'valley', only: (c) => back(c) && inFlap(c) },
      { through: [table(...Q), table(...T)], kind: 'flat', only: (c) => head(c) && nearTip(c) },
    ],
    paper(-0.3, -0.2),
  );

  // The tail: the left corner pushed in between the layers.
  const x = L[0] + (B[0] - L[0]) / 3;
  r.collapse(
    { title: 'Fold the tail in', text: 'Push the left corner in between the layers, so the bottom edges line up and the fox can stand.', kind: 'reverse' },
    [{ through: [table(x, -2), table(x, 2)], kind: 'inside' }],
    paper(0.5, 0),
  );

  // The face: the squashed diamond, from where the ears meet down to its point, where the sheet's corners are.
  return r
    .draw({ title: 'Draw a face', text: 'Draw two shut, smiling eyes and a little nose on the face. Done!' }, faceMarks(Q, r.where(paper(0.5, -0.5)), { eyes: 'closed', nose: true, noseAt: 0.78 }))
    .build();
}

function inTriangle(p: Vec2, a: Vec2, b: Vec2, c: Vec2): boolean {
  const s1 = sideOf(lineThrough(a, b), p);
  const s2 = sideOf(lineThrough(b, c), p);
  const s3 = sideOf(lineThrough(c, a), p);
  return (s1 > 0 && s2 > 0 && s3 > 0) || (s1 < 0 && s2 < 0 && s3 < 0);
}

/** Where the line through a and b meets the line through c and d. */
function lineHit(a: Vec2, b: Vec2, c: Vec2, d: Vec2): Vec2 {
  const [x1, y1] = a;
  const [x2, y2] = b;
  const [x3, y3] = c;
  const [x4, y4] = d;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / ((x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4));
  return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
}
