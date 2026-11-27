import { paper, Recipe, table } from '../../fold/recipe';
import { normalize } from '../../fold/geometry2d';
import { birdBase } from './bird-base';
import type { Vec2 } from '../../fold/types';

/**
 * Gami's own swallow, seen from above: the crane's bird base and leg narrowing, the legs reverse-folded out as
 * swept-back wings, the front long flap folded down for the head, and the back one cut up the middle and its
 * halves folded apart for a forked tail. Then turned round, head up.
 */
export function swallow() {
  const r = new Recipe({ id: 'swallow', title: 'Swallow', sheet: { size: [1, 1], front: '#26386b', back: '#f6f3ec' } });
  const { K, K2, side, up, front, back, innerFront, innerBack } = birdBase(r);

  // Narrow the legs, as the crane does: the lower edges of the front half fold to the centre line.
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
  r.turnOver('Turn the paper over.');
  narrow((c) => front(c) || innerFront(c));

  // The wings: each leg (one of the sheet's other two quarters) swings up and out between its layers, from half a
  // side above the bottom point, to 25° above level. Higher than that its creases can't fold flat. The fold line
  // bisects straight down and the wing's new direction.
  const root = up(0.5);
  const lift = (25 * Math.PI) / 180;
  const line = (dir: 1 | -1): Vec2 => normalize([dir * Math.cos(lift), 1 - Math.sin(lift)]);
  // The second wing a little lower, and bent on the way (fold/bend/reverse.ts): from the same point, rigid, it swung
  // through the first wing's layers there, 0.0093 deep (0.0063 bent from the same point; 0.0032 now, 26 November 2026).
  const wing = (dir: 1 | -1, leg: (c: Vec2) => boolean, title: string, text: string) => {
    const at = dir > 0 ? up(0.46) : root;
    return r.collapse(
      { title, text, kind: 'reverse' },
      [{ through: [table(...at), table(at[0] + line(dir)[0], at[1] + line(dir)[1])], kind: 'inside', only: leg }],
      paper(-0.3, 0.3),
      undefined,
      dir > 0 ? {} : undefined,
    );
  };
  wing(-1, ([u, v]) => u > 0 && v > 0, 'Reverse-fold a wing', 'Push the left point up between the layers so it sticks out to the side, sloping up a little. This is a wing.');
  wing(1, ([u, v]) => u < 0 && v < 0, 'Reverse-fold the other wing', 'Do the same with the right point, for the other wing.');

  // The head: the front long flap folds down level with the top of the body (the sheet's centre; any lower tears
  // through the narrowed edges), and its tip just shows below the wings.
  const top = r.where(paper(0, 0))[1];
  r.along(table(-2, top), table(2, top), paper(0.5, -0.5), {
    title: 'Fold the top flap down',
    text: 'Fold the front flap down as far as it goes, so its tip peeks out below the wings. This is the head.',
    only: front,
  });

  // The tail: the back long flap, still pointing up, is cut along its middle from the tip almost to its widest
  // part. Each half's inner edge then folds out on a line 12° off the cut, from its bottom, so the tail forks.
  const tail = r.where(paper(-0.5, 0.5));
  const end: Vec2 = [tail[0], tail[1] + 0.28];
  r.cut(paper(-0.5, 0.5), table(...end), {
    title: 'Cut the tail',
    text: 'With scissors, cut along the middle of the point that’s left at the top, from its tip almost down to its widest part.',
  });
  const slant = (12 * Math.PI) / 180;
  // The back flap's halves on the sheet: the right one (s = 1) has u + v < 0.
  const fork = (s: 1 | -1, title: string, text: string) =>
    r.along(table(...end), table(end[0] + s * Math.sin(slant), end[1] - Math.cos(slant)), table(tail[0] + s * 0.004, tail[1] + 0.03), {
      title,
      text,
      only: (c) => back(c) && s * -(c[0] + c[1]) > 0,
    });
  fork(-1, 'Fork the tail', 'Fold the inside edge of the left half out on a slant, from the bottom of the cut, so the tail opens into a fork.');
  fork(1, 'Fork the other side', 'Match it on the right.');

  return r
    .rotate(180, { title: 'Turn it round', text: 'Turn the swallow round so its head points up. Your swallow is done!' })
    .build();
}
