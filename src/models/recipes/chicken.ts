import { toFlat } from '../../fold/fold';
import { Recipe, table, type At } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/** The beak: how far down the front from the top corner it turns, and how far (degrees from straight up, forward). */
export const BEAK = 0.12;
export const BEAK_TURN = 120;
/** How far in from the right edge the landmarks are pinched. */
export const PINCH = 0.08;
/** The red pen, for the comb and wattle. */
export const RED = '#c8202a';

/** Where the line through a along d meets the line through b along e. */
function meet(a: Vec2, d: Vec2, b: Vec2, e: Vec2): Vec2 {
  const k = ((b[0] - a[0]) * e[1] - (b[1] - a[1]) * e[0]) / (d[0] * e[1] - d[1] * e[0]);
  return [a[0] + k * d[0], a[1] + k * d[1]];
}
const mid = (a: Vec2, b: Vec2): Vec2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
/** The direction square to the one from a to b (the line folding a onto b runs this way, through their middle). */
const across = (a: Vec2, b: Vec2): Vec2 => [a[1] - b[1], b[0] - a[0]];
const deg = Math.PI / 180;
/** The line through `a` that turns paper pointing at angle `from` to point at `to` (degrees on the table), by reflecting it. */
function turning(a: Vec2, from: number, to: number): [At, At] {
  const m = ((from + to) / 2) * deg;
  return [table(...a), table(a[0] + Math.cos(m), a[1] + Math.sin(m))];
}

/**
 * The traditional chicken, following the order of folds at origami.me/chicken as far as its beak, from one square: a
 * triangle pinched at its right edge for its landmarks, its corners folded up to the top, the bottom corner creased, folded in half; the
 * bottom of the fold reverse-folded for the feet (round the outside, not inside) and the top corner for the beak. origami.me's wings (a squash
 * of the front flap), comb (one layer of the beak unfolded) and head (an outside reverse fold) are left out: the
 * squash can't be placed from its text, and the comb's layer is joined to the next along the fold. So the comb and
 * wattle are drawn on with a red pen instead, on both sides, with an eye.
 */
export function chicken() {
  const h = Math.SQRT1_2;
  const t = Math.tan(Math.PI / 8);
  const r = new Recipe({ id: 'chicken', title: 'Chicken', sheet: { size: [1, 1], front: '#f6ead2', back: '#b8602f' } })
    .rotate(45, { title: 'Start as a diamond', text: 'Start with the plain side up and a corner pointing towards you.' })
    .crease(table(-h, 0), table(h, 0), { title: 'Crease down the middle', text: 'Fold the left corner to the right corner, and unfold.' })
    .onto(table(0, h), table(0, -h), { title: 'Fold in half', text: 'Fold the bottom corner up to the top corner, making a triangle.' });
  const [L, R, T, B]: Vec2[] = [[-h, 0], [h, 0], [0, -h], [0, 0]];
  // Landmarks, pinched where they meet the right edge (only that much of each fold is pressed): the left edge
  // folded down onto the bottom edge marks P3; the right corner folded up to P3 marks P4, halfway.
  const P3: Vec2 = [t * h, t * h - h];
  const P4 = mid(R, P3);
  const pinchAt = (at: Vec2, toward: Vec2): [At, At] => {
    const d = Math.hypot(toward[0] - at[0], toward[1] - at[1]);
    return [table(...at), table(at[0] + ((toward[0] - at[0]) / d) * PINCH, at[1] + ((toward[1] - at[1]) / d) * PINCH)];
  };
  r.edgeOnto([table(...L), table(...T)], [table(...L), table(...R)], {
    title: 'Pinch the right edge',
    text: 'Fold the left edge down onto the bottom edge, but press the fold flat only where it meets the right edge, and unfold. The pinch marks a point.',
  }).unfold({ pinch: pinchAt(P3, L) });
  // The right corner's fold runs square to the right edge from P4, into the triangle (towards its middle).
  const square: Vec2 = [P4[0] - (P3[1] - R[1]), P4[1] + (P3[0] - R[0])];
  const middle: Vec2 = [0, -h / 3];
  const other: Vec2 = [2 * P4[0] - square[0], 2 * P4[1] - square[1]];
  const far = (p: Vec2) => Math.hypot(p[0] - middle[0], p[1] - middle[1]);
  const inward = far(square) < far(other) ? square : other;
  r.onto(table(...R), table(...P3), {
    title: 'Pinch it again',
    text: 'Fold the right corner up to the pinch, pressing only at the right edge again, and unfold.',
  }).unfold({ pinch: pinchAt(P4, inward) });
  r.together({ title: 'Fold the corners up', text: 'Fold the left and right corners up to the top corner.' }, (q) => {
    q.onto(table(...L), table(...T), { title: '' }).onto(table(...R), table(...T), { title: '' });
  });
  // P4 now lies on the right flap, reflected across its fold (z = −x).
  const P4f: Vec2 = [-P4[1], -P4[0]];
  r.onto(table(...B), table(...P4f), { title: 'Crease the bottom corner', text: 'Fold the bottom corner up to the second pinch on the right flap’s edge, and unfold.' }).unfold();
  // That crease meets the middle at Q and the lower right edge at C.
  const d6 = across(B, P4f);
  const m6 = mid(B, P4f);
  const Q = meet(m6, d6, [0, 0], [0, 1]);
  const C = meet(m6, d6, [0, 0], [1, -1]);
  r.along(table(0, -1), table(0, 1), table(-0.2, -0.3), { title: 'Fold in half', text: 'Fold the left half behind, along the middle crease.', kind: 'mountain' });
  // The feet: the middle below Q folded up onto that crease, then reverse-folded on it, round the outside: inside,
  // as origami.me folds them, its many layers pass through each other as they go in.
  const dQC: Vec2 = [C[0] - Q[0], C[1] - Q[1]];
  const len = Math.hypot(...dQC);
  const bis: Vec2 = [dQC[0] / len, 1 + dQC[1] / len];
  const F = meet(Q, bis, [0, 0], [1, -1]);
  r.edgeOnto([table(...Q), table(...B)], [table(...Q), table(...C)], { title: 'Crease the feet', text: 'Fold the bottom of the left edge up onto that crease, and unfold.' }).unfold();
  const anchor = () => r.sheetAt([0.15, -0.35]);
  r.collapse(
    { title: 'Make the feet', text: 'Turn the bottom corner up round the outside, on that crease, for the feet.', kind: 'reverse' },
    [{ through: [table(...Q), table(...F)], kind: 'outside' }],
    anchor(),
  );
  // The beak: the top corner pushed in, forward (left) and down.
  r.collapse(
    { title: 'Make the beak', text: 'Push the top corner down between the layers, for the beak.', kind: 'reverse' },
    [{ through: turning([0, T[1] + BEAK], -90, -90 - BEAK_TURN), kind: 'inside' }],
    anchor(),
  );
  // The comb, wattle and eye, drawn on the head (the top corner's side of the back, the fold at the chest on x = 0),
  // then the same turned over: the paper turns over about the middle of its width.
  const head = headMarks();
  const xs = toFlat(r.current).flatMap((f) => f.world.map((w) => w[0]));
  const mirror = (p: Vec2): Vec2 => [Math.min(...xs) + Math.max(...xs) - p[0], p[1]];
  const drawHead = (place: (p: Vec2) => Vec2) => head.map((m) => ({ fill: m.fill.map(place), ...(m.colour && { colour: m.colour }) }));
  r.draw({ title: 'Draw the comb', text: 'With a red pen, draw a comb along the top of the head and a wattle under the beak. Give her an eye too.' }, drawHead((p) => p));
  r.turnOver('Turn the hen over, left to right.');
  r.draw({ title: 'Draw the other side', text: 'Draw the comb, wattle and eye on this side too.' }, drawHead(mirror));
  r.turnOver('Turn her back over. Your hen is ready.');
  return r.build();
}

/**
 * A round blob, as a polygon: centre and radii across and down, its first point at angle `start` (radians on the
 * table). A mark goes on the paper under its first point, so that has to be on the paper.
 */
const blob = ([x, z]: Vec2, rx: number, rz = rx, start = 0): Vec2[] =>
  Array.from({ length: 14 }, (_, i) => [x + rx * Math.cos(start + (i * Math.PI) / 7), z + rz * Math.sin(start + (i * Math.PI) / 7)]);

/**
 * What's drawn on the head as the hen lies (facing left, the chest's fold on x = 0, the top corner at its top left):
 * three round red lobes for the comb just inside the head's top edge, a red wattle under the beak, a dark eye. Each
 * fill is convex, as fills are drawn.
 */
function headMarks(): { fill: Vec2[]; colour?: string }[] {
  // The head's top edge runs from the top corner (0, −0.59) down to the right, 0.595 down for each 1 across.
  const top = (x: number): Vec2 => [x, -0.59 + 0.595 * x];
  const inward: Vec2 = [-0.511, 0.86];
  // Each lobe's middle a little inside the edge, so the paper's edge cuts it into a scallop; they overlap.
  const lobe = (x: number, r: number) => {
    const p = top(x);
    return { fill: blob([p[0] + inward[0] * r * 0.35, p[1] + inward[1] * r * 0.35], r, r, Math.atan2(inward[1], inward[0])), colour: RED };
  };
  return [lobe(0.022, 0.014), lobe(0.047, 0.017), lobe(0.074, 0.015), { fill: blob([0.014, -0.481], 0.009, 0.017), colour: RED }, { fill: blob([0.032, -0.527], 0.0065) }];
}
