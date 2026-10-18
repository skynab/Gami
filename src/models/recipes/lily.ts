import type { CreaseKind } from '../../fold/collapse';
import { sideOf, lineThrough } from '../../fold/geometry2d';
import { locate, paper, Recipe, table, type At } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * The traditional lily, following origami.me/lily: a waterbomb base, each of its four flaps squashed and
 * petal-folded in one movement along pre-creases, then the petals folded down, the top narrowed, and the
 * petals opened out.
 *
 * In the waterbomb base each flap is a quarter of the sheet folded along its diagonal (its spine, the flap's
 * slanted outer edge), so each petal is one corner of the sheet. The quarter (su, sv) is the one whose corner
 * is at (su/2, sv/2) on the sheet; its half nearer the u = 0 midline is "a", the other "b".
 */
export function lily() {
  const r = new Recipe({ id: 'lily', title: 'Lily', sheet: { size: [1, 1], front: '#f2a7c3', back: '#fbe9f0' } })
    .crease(paper(-0.5, 0), paper(0.5, 0), { title: 'Fold in half', text: 'Colour side up. Fold in half, then unfold.' })
    .crease(paper(0, -0.5), paper(0, 0.5), { title: 'Fold in half the other way', text: 'And the other way. Then turn the paper over.' })
    .crease(paper(-0.5, -0.5), paper(0.5, 0.5), { title: 'Fold in half diagonally', text: 'Corner to corner, then unfold.' })
    .crease(paper(0.5, -0.5), paper(-0.5, 0.5), { title: 'Fold the other diagonal', text: 'Eight creases from the centre.' })
    .collapse(
      {
        title: 'Collapse into a waterbomb base',
        text: 'Push the left and right edges in and down, so the paper folds into a triangle with two flaps on each side.',
      },
      [
        { through: [table(-1, -1), table(1, 1)], kind: 'mountain' },
        { through: [table(-1, 1), table(1, -1)], kind: 'mountain' },
        { through: [table(-1, 0), table(1, 0)], kind: 'valley' },
      ],
      paper(0, -0.3),
    )
    .rotate(180, { title: 'Point up', text: 'Turn the triangle so its point is at the top.' });

  const quarter = (su: number, sv: number) => ([u, v]: Vec2) => Math.sign(u) === su && Math.sign(v) === sv;
  const halfA = (su: number, sv: number) => (c: Vec2) => quarter(su, sv)(c) && Math.abs(c[0]) < Math.abs(c[1]);
  const halfB = (su: number, sv: number) => (c: Vec2) => quarter(su, sv)(c) && Math.abs(c[0]) > Math.abs(c[1]);
  // A flap's petal: its corner's side of the step-5 crease, which on the sheet runs halfway along the diagonal.
  const petal = (su: number, sv: number) => (c: Vec2) => quarter(su, sv)(c) && Math.abs(c[0]) + Math.abs(c[1]) > 0.5;
  const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const at = (p: Vec2): At => table(...p);

  /**
   * A flap where it lies now: the top point T, its corner C, and M, where its top layer's hinge (the midline
   * joining it to the next flap) meets the base. Its top layer swings over in the squash.
   */
  const flap = (su: number, sv: number) => {
    const T = r.where(paper(0, 0));
    const C = r.where(paper(su / 2, sv / 2));
    // The half lying on top: whichever is nearer the viewer at a point inside both.
    const aOnTop = r.layerAt(lerp(T, C, 0.4), halfA(su, sv)) > r.layerAt(lerp(T, C, 0.4), halfB(su, sv));
    const M = r.where(paper(...((aOnTop ? [0, sv / 2] : [su / 2, 0]) as Vec2)));
    return {
      T, C, M,
      top: aOnTop ? halfA(su, sv) : halfB(su, sv),
      bottom: aOnTop ? halfB(su, sv) : halfA(su, sv),
      neighbour: aOnTop ? halfA(-su, sv) : halfB(su, -sv),
      // Where the petal line, the squash line (from T) and the kite crease (from C) meet.
      meet: lerp(M, lerp(T, C, 0.5), 2 - Math.SQRT2),
    };
  };

  /** Origami.me steps 5–7 for a flap: its corner up to the top point, that folded in half, both undone. */
  const precrease = (su: number, sv: number, text: [string, string], unfold = true) => {
    const { T, C, M, meet } = flap(su, sv);
    const before = r.mark();
    const only = quarter(su, sv);
    // The flap's outer half moves to the centre: the side of the T–meet line away from the hinge.
    const away: Vec2 = [2 * meet[0] - M[0], 2 * meet[1] - M[1]];
    r.onto(at(C), at(T), { title: 'Fold the corner up', text: text[0], only })
      .along(at(T), at(meet), at(away), { title: 'Fold it in half', text: text[1], only });
    return unfold ? r.unfold({ title: 'Unfold', text: 'Open both folds, leaving the creases.', to: before }) : r;
  };

  /**
   * Origami.me steps 9–10: the flap squashed and petal-folded at once, along its pre-creases. Above the petal
   * line the top layer swings over onto the next flap and the bottom one stays, both folding on the squash
   * line, with the spine opening out; below it, the sides fold in along the kite creases and the corner
   * lifts to the top point.
   */
  const squashPetal = (su: number, sv: number, step: { title: string; text: string }, anchor: Vec2) => {
    const f = flap(su, sv);
    const { T, C, M, top, bottom, neighbour, meet } = f;
    const Pm = lerp(T, C, 0.5);
    const lines = { squash: lineThrough(T, meet), petal: lineThrough(Pm, M), kite: lineThrough(C, meet) };
    // Which part of the flap a face is in: 1 above the petal line by the spine, 2 by the hinge, 3 and 4 below.
    const region = (c: Vec2) => {
      const w = r.where(paper(...c));
      if (sideOf(lines.petal, w) * sideOf(lines.petal, T) > 0) return sideOf(lines.squash, w) * sideOf(lines.squash, Pm) > 0 ? 1 : 2;
      return sideOf(lines.kite, w) * sideOf(lines.kite, Pm) > 0 ? 3 : 4;
    };
    const both = (through: [Vec2, Vec2], kinds: [CreaseKind, CreaseKind], regions: number[]) =>
      ([top, bottom] as const).map((layer, i) => ({
        through: through.map(at) as [At, At],
        kind: kinds[i],
        only: (c: Vec2) => layer(c) && regions.includes(region(c)),
      }));
    r.collapse({ ...step, kind: 'petal' }, [
      ...both([T, meet], ['mountain', 'valley'], [1, 2]),
      ...both([Pm, M], ['valley', 'mountain'], [1, 3]),
      ...both([Pm, M], ['mountain', 'valley'], [2, 4]),
      ...both([C, meet], ['mountain', 'valley'], [3, 4]),
      { through: [at(T), at(C)], kind: 'flat', only: (c) => top(c) || bottom(c) },
      { through: [at(T), at(M)], kind: 'valley', only: (c) => neighbour(c) || (top(c) && region(c) === 2) },
    ], paper(...anchor));
    return f;
  };

  precrease(-1, -1, [
    'Fold the bottom right corner of the top flap up to the top point.',
    'Fold that flap in half: its right edge to the centre line. Crease well at the top.',
  ]);
  precrease(1, -1, ['Do the same on the left flap: its corner up to the top point…', '…and that folded in half.']);
  r.turnOver('Turn over, to crease the two flaps at the back.');
  const backFlaps = r.mark();
  const corner = (su: number, sv: number) => (r: Recipe) => {
    const { T, C } = flap(su, sv);
    r.onto(at(C), at(T), { title: '', only: quarter(su, sv) });
  };
  const half = (su: number, sv: number) => (r: Recipe) => {
    const { T, M, meet } = flap(su, sv);
    r.along(at(T), at(meet), at([2 * meet[0] - M[0], 2 * meet[1] - M[1]]), { title: '', only: quarter(su, sv) });
  };
  r.together({ title: 'Fold both corners up', text: 'Fold the bottom corners of both flaps up to the top point.' }, (r) => (corner(-1, 1)(r), corner(1, 1)(r)))
    .together({ title: 'Fold both in half', text: 'Fold each in half, its outer edge to the centre line.' }, (r) => (half(-1, 1)(r), half(1, 1)(r)))
    .unfold({ title: 'Unfold', text: 'Open them again.', to: backFlaps })
    .turnOver('Turn back over.');

  /** Mirror image of a point across the line through a and b. */
  const mirror = (p: Vec2, a: Vec2, b: Vec2): Vec2 => {
    const d = [b[0] - a[0], b[1] - a[1]];
    const t = ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / (d[0] * d[0] + d[1] * d[1]);
    const foot: Vec2 = [a[0] + d[0] * t, a[1] + d[1] * t];
    return [2 * foot[0] - p[0], 2 * foot[1] - p[1]];
  };
  // Each petal's tip, the part folded down (as pieces of the sheet, which later folds only cut smaller).
  const tips: Vec2[][] = [];
  const inTip = (c: Vec2) => tips.some((poly) => inside(poly, c));
  /** Origami.me step 11: the petal just made (`made`, the flap as it was) folds down, across the diamond's side corners. */
  const petalDown = ({ T, M, meet }: ReturnType<typeof flap>, su: number, sv: number, text: string) => {
    const line = lineThrough(meet, mirror(meet, T, M));
    const before = r.build().steps.at(-1)!.frame;
    r.along(at(meet), at(mirror(meet, T, M)), at(T), { title: 'Fold the petal down', text, only: petal(su, sv) });
    // The pieces that moved: those that were above the fold line before it.
    tips.push(...r.pieces((c) => petal(su, sv)(c) && sideOf(line, locate(before, c)) * sideOf(line, T) > 0));
  };

  const first = squashPetal(-1, -1, {
    title: 'Squash and petal-fold a flap',
    text: 'Lift the top right flap, open it and squash it along the creases at the top, then fold the bottom sides in behind and the corner up to the top point.',
  }, [0.3, -0.1]);
  petalDown(first, -1, -1, 'Fold the petal you just made down.');

  /** Turns the paper picked out by `only` over the centre line, like a page, towards the side `to` is on. */
  const pageTurn = (only: (c: Vec2) => boolean, toRight: boolean, step: { title: string; text: string }) => {
    const T = r.where(paper(0, 0));
    const base = r.where(paper(0, 0.5));
    const from: Vec2 = [T[0] + (toRight ? -0.2 : 0.2), (T[1] + base[1]) / 2];
    return r.along(at(T), at([T[0], base[1]]), at(from), { ...step, only });
  };
  pageTurn(first.top, true, { title: 'Turn a page', text: 'Fold the left half of the diamond over to the right, showing the next flap.' });
  const second = squashPetal(1, -1, { title: 'Squash and petal-fold the next flap', text: 'Squash and petal-fold it the same way.' }, [-0.3, 0.1]);
  petalDown(second, 1, -1, 'Fold the petal down again.');
  r.turnOver('Turn the paper over, side to side.');
  const third = squashPetal(1, 1, { title: 'Squash and petal-fold a back flap', text: 'Squash and petal-fold the top right flap on this side too.' }, [-0.3, 0.1]);
  petalDown(third, 1, 1, 'Fold its petal down.');
  pageTurn(third.top, true, { title: 'Turn a page', text: 'Fold the left half of the diamond over to the right.' });
  const fourth = squashPetal(-1, 1, { title: 'Squash and petal-fold the last flap', text: 'And the last flap.' }, [0.3, -0.1]);
  petalDown(fourth, -1, 1, 'Fold the last petal down. The four petals hang down from the base.');

  // The model is now a long diamond: four pages each side, each half of a quarter, with its petal half folded
  // down below the waist. Pages are picked out by their half of the sheet.
  const diamond = () => {
    const T = r.where(paper(0, 0));
    const w = (2 - Math.SQRT2) / 4;
    return { T, left: [T[0] - w, T[1] + 0.5 - w] as Vec2, right: [T[0] + w, T[1] + 0.5 - w] as Vec2, bottom: [T[0], T[1] + Math.SQRT1_2] as Vec2 };
  };
  /** The half of the sheet a face (by its centre) belongs to, as a test for the whole page. */
  const pageOf = ([u, v]: Vec2) => (Math.abs(u) < Math.abs(v) ? halfA : halfB)(Math.sign(u), Math.sign(v));
  /** The pages on the left or right of the diamond, top first: what lies just beside the centre line, which every page covers. */
  const pages = (side: 'left' | 'right') => {
    const { T } = diamond();
    const seen: Vec2[] = [];
    for (const c of r.stackAt([T[0] + (side === 'left' ? -0.01 : 0.01), T[1] + 0.25])) if (!seen.some((s) => pageOf(s)(c))) seen.push(c);
    return seen.map(pageOf);
  };
  /** Origami.me steps 13 and 15: the top pages' outer edges fold to the centre line, from the top point. */
  const narrow = (step: { title: string; text: string }) => {
    const [leftPage, rightPage] = [pages('left')[0], pages('right')[0]];
    return r.together(step, (r) => {
      const { T, left, right, bottom } = diamond();
      r.edgeOnto([at(T), at(left)], [at(T), at(bottom)], { title: '', only: leftPage });
      r.edgeOnto([at(T), at(right)], [at(T), at(bottom)], { title: '', only: rightPage });
    });
  };
  /** Turns the top two pages on the right over to the left. */
  const flip = (step: { title: string; text: string }) => {
    const [a, b] = pages('right');
    return pageTurn((c) => a(c) || b(c), false, step);
  };

  narrow({ title: 'Narrow the top', text: 'Fold the top left and right edges of the top layer to the centre line.' });
  r.turnOver('Turn over.');
  narrow({ title: 'Narrow the other side', text: 'The same on this side.' });
  flip({ title: 'Flip two flaps', text: 'Turn two flaps over from right to left, like pages.' });
  narrow({ title: 'Narrow again', text: 'Fold the top edges to the centre again.' });
  r.turnOver('Turn over.');
  flip({ title: 'Flip two flaps', text: 'Turn two flaps over from right to left here too.' });
  narrow({ title: 'Narrow again', text: 'And fold the top edges to the centre.' });
  r.rotate(180, { title: 'Turn it round', text: 'Turn the model round, so the petals point up and the narrow part is at the bottom.' });

  // The petals' tips now lie on top of the short part, hinged at the waist. The narrowing folds caught slivers
  // of them just past the waist, so each opens on a line a little beyond those: the top one furthest, each
  // one under it less, so none passes through another, and the bottom one stays on the table.
  const T = r.where(paper(0, 0));
  const tipEnd = r.where(paper(0.5, 0.5));
  const along = Math.sign(tipEnd[1] - T[1]);
  const hinge = T[1] + along * (0.5 - (2 - Math.SQRT2) / 4 + 0.07);
  const order: string[] = [];
  for (const [u, v] of r.stackAt([T[0] + 0.01, (hinge + tipEnd[1]) / 2])) {
    const key = `${Math.sign(u)},${Math.sign(v)}`;
    if (inTip([u, v]) && !order.includes(key)) order.push(key);
  }
  r.shape(
    { title: 'Open the petals', text: 'Fold the petals out and curl them gently, the front one furthest. Your lily is finished.' },
    order.slice(0, -1).map((key, i) => {
      const [su, sv] = key.split(',').map(Number);
      return {
        through: [table(T[0] - 1, hinge), table(T[0] + 1, hinge)] as [At, At],
        moving: at(tipEnd),
        degrees: 85 - 25 * i,
        segments: 4,
        only: (c: Vec2) => quarter(su, sv)(c) && inTip(c),
      };
    }),
  );
  return r.build();
}

/** Whether a point is inside a convex polygon (or on its edge). */
function inside(poly: Vec2[], p: Vec2): boolean {
  const s = poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length];
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  });
  return s.every((x) => x >= -1e-9) || s.every((x) => x <= 1e-9);
}
