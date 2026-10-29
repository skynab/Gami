import { paper, Recipe, table, type At } from '../../fold/recipe';
import type { OrigamiModel, Vec2 } from '../../fold/types';

/** The classic dart, from a sheet shaped like A4 (1 : 1.41). */
export function paperPlane() {
  const w = 0.7;
  const h = 1;
  const [l, r, top] = [-w / 2, w / 2, -h / 2];
  // A top corner folded to the centre line lands this far down from the top edge.
  const corner = top + w / 2;
  // The slanted edge from the first folds, swung onto the centre line, reaches this far down.
  const edge = top + Math.hypot(w / 2, w / 2);

  const plane = new Recipe({
    id: 'paper-plane',
    title: 'Paper plane',
    sheet: { size: [w, h], front: '#e8553f', back: '#f6f3ec' },
  })
    .crease(paper(l, 0), paper(r, 0), {
      title: 'Fold in half lengthwise',
      text: 'Bring the left edge over to the right edge and crease down the middle.',
    })
    .onto(paper(l, top), table(0, corner), {
      title: 'Fold the top-left corner to the middle',
      text: 'Line the top edge up with the centre crease.',
    })
    .onto(paper(r, top), table(0, corner), {
      title: 'Fold the top-right corner to the middle',
      text: 'The two corners meet on the centre crease, making a point at the top.',
    })
    .onto(paper(l, corner), table(0, edge), {
      title: 'Fold the left edge to the middle',
      text: 'Bring the slanted left edge in to the centre crease, making the point sharper.',
    })
    .onto(paper(r, corner), table(0, edge), {
      title: 'Fold the right edge to the middle',
      text: 'Match the left side. The edges meet along the centre.',
    });
  return finishPlane(plane, 0.13, 'Fold the top layers down so the wing’s edge meets the bottom of the plane.');
}

/** Where a plane's wings are, for the steps a plane adds to its finish (see `finishPlane`). */
export interface Wings {
  /** On its side, the keel's height on the table, and the line each wing folds down along. */
  keel: number;
  wingLine: number;
  /** The paper of the wing folded first (the one underneath) and of the other. */
  firstWing: (c: Vec2) => boolean;
  secondWing: (c: Vec2) => boolean;
}

/**
 * How a plane ends, from its nose folds: in half behind, turned on its side, a wing folded down each side along
 * a line `body` up from the keel (`wingText` saying how), then the wings opened out and the plane turned over.
 * `beforeOpen` adds steps with both wings down (flat), and `afterOpen` with them open (3D: bends on the flat
 * state with both wings down, added to the wings' own).
 */
export function finishPlane(
  plane: Recipe,
  body: number,
  wingText: string,
  more: { beforeOpen?(plane: Recipe, wings: Wings): void; afterOpen?(plane: Recipe, wings: Wings): void } = {},
): OrigamiModel {
  // Each half of the plane: the paper on that side of the centre crease before it folds in half. That's the
  // sheet's own half unless an earlier fold took paper across the middle (as the navy plane's sides do).
  const right = plane.lying(([x]) => x > 0);
  const left = (c: Vec2) => !right(c);
  plane
    .along(table(0, -1), table(0, 1), table(-0.1, 0), {
      title: 'Fold in half behind',
      text: 'Mountain-fold along the centre crease, so the folds stay on the outside.',
      kind: 'mountain',
    })
    .rotate(90, { title: 'Turn it on its side', text: 'Point the nose to the left, with the long folded edge at the bottom.' });
  return foldWings(plane, body, wingText, right, left, more);
}

/**
 * The end of `finishPlane`, for a plane already on its side with its keel along the bottom: the wing on top
 * (the paper `right` picks out) folded down `body` up from the keel, turned over, the other (`left`) to match,
 * then the wings opened out and the plane turned over. With `fin`, paper of neither wing reaching past the line
 * stays standing with the body, as a tail fin. With `tail`, the line slants: `body` up at the nose and `tail` up
 * at the back, for a body that deepens towards the tail.
 */
export function foldWings(
  plane: Recipe,
  body: number,
  wingText: string,
  right: (c: Vec2) => boolean,
  left: (c: Vec2) => boolean,
  more: { beforeOpen?(plane: Recipe, wings: Wings): void; afterOpen?(plane: Recipe, wings: Wings): void; flyText?: string; fin?: boolean; tail?: number } = {},
): OrigamiModel {
  // On its side, the keel runs along the bottom. Each wing folds down along a line parallel to it.
  const keel = Math.max(...plane.current.vertices_coords.map((p) => p[2]));
  const wingLine = keel - body;
  // The line, from nose (left) to tail, and a point just past it, away from the keel. Turning the plane over
  // mirrors a slanting line, so the second wing and the opening fold along the mirror image.
  const xs = plane.current.vertices_coords.map((p) => p[0]);
  const ends: [Vec2, Vec2] =
    more.tail === undefined ? [[-1, wingLine], [1, wingLine]] : [[Math.min(...xs), wingLine], [Math.max(...xs), keel - more.tail]];
  const fold: [At, At] = [table(...ends[0]), table(...ends[1])];
  const over: [At, At] = more.tail === undefined ? fold : [table(-ends[0][0], ends[0][1]), table(-ends[1][0], ends[1][1])];
  const slope = (ends[1][1] - ends[0][1]) / (ends[1][0] - ends[0][0]);
  const lineAt = (x: number) => ends[0][1] + slope * (x - ends[0][0]);
  const past = table(0, lineAt(0) - 0.1);
  // Each wing: the part of its half of the sheet beyond the line, before it folds down.
  const wingOf = (half: (c: Vec2) => boolean, turned: boolean) => {
    const beyond = plane.lying(([x, z]) => z < lineAt(turned ? -x : x));
    return (c: Vec2) => half(c) && beyond(c);
  };
  const firstWing = wingOf(right, false);
  const pastLine = plane.lying(([x, z]) => z < lineAt(x));
  const fin = (c: Vec2) => pastLine(c) && !right(c) && !left(c);
  plane.along(...fold, past, {
    title: 'Fold the wing down',
    text: wingText,
    only: right,
  });
  plane.turnOver();
  const secondWing = wingOf(left, true);
  const wings: Wings = { keel, wingLine, firstWing, secondWing };
  plane.along(...over, past, {
    title: 'Fold the other wing to match',
    text: 'Line it up with the first wing.',
    only: left,
  });
  more.beforeOpen?.(plane, wings);
  plane
    // The first wing, underneath, stays on the table; the body stands up off it, and the other wing swings
    // right over to lie out flat on the far side: the plane upside down, its keel pointing up.
    .shape({ title: 'Open the wings', text: 'Open both wings out flat on either side of the body, at right angles to it.' }, [
      { through: over, moving: table(0, keel), degrees: 90, only: (c) => !firstWing(c) },
      { through: over, moving: table(0, keel), degrees: 90, only: secondWing },
      // The fin carries on the body's line past the wings', so it turns with the body: down through the table,
      // until the plane turns over.
      ...(more.fin ? [{ through: over, moving: past, degrees: -90, only: fin }] : []),
    ]);
  more.afterOpen?.(plane, wings);
  return plane
    .turnOver(more.flyText ?? 'Turn the plane over, so it stands on its keel with its wings level on top. It’s ready to fly!')
    .build();
}
