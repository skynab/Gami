import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { squashEnd } from './windmill';

/**
 * The traditional butterfly, following the order of folds at origami.me/butterfly: creased in halves,
 * diagonals and quarters, squashed at the top with the corners out sideways and at the bottom with them pulled
 * down, the top folded behind into the wings, the body narrowed, and folded in half with the wings turned out.
 */
export function butterfly() {
  const r = new Recipe({ id: 'butterfly', title: 'Butterfly', sheet: { size: [1, 1], front: '#f6f3ec', back: '#b98ad6' } })
    .crease(paper(-0.5, 0), paper(0.5, 0), { title: 'Fold in half', text: 'White side up. Fold in half side to side, then unfold.' })
    .crease(paper(0, -0.5), paper(0, 0.5), { title: 'Fold in half the other way', text: 'And top to bottom, then unfold.' })
    .turnOver('Turn the paper over.')
    .crease(paper(-0.5, -0.5), paper(0.5, 0.5), { title: 'Fold in half diagonally', text: 'Corner to corner, then unfold.' })
    .crease(paper(0.5, -0.5), paper(-0.5, 0.5), { title: 'Fold the other diagonal', text: 'And the other corners.' })
    .turnOver('Turn the paper back over.')
    .crease(paper(-0.5, 0), paper(0, 0), { title: 'Fold the left side to the middle', text: 'Fold the left edge to the middle, then unfold.' })
    .crease(paper(0.5, 0), paper(0, 0), { title: 'Fold the right side to the middle', text: 'And the right edge.' })
    .crease(paper(0, -0.5), paper(0, 0), { title: 'Fold the top to the middle', text: 'Fold the top edge to the middle, then unfold.' })
    .crease(paper(0, 0.5), paper(0, 0), { title: 'Fold the bottom to the middle', text: 'And the bottom edge.' })
    .onto(paper(-0.5, 0), paper(0, 0), { title: 'Fold the left side in', text: 'Fold the left edge to the middle again, and leave it there.' })
    .onto(paper(0.5, 0), paper(0, 0), { title: 'Fold the right side in', text: 'And the right edge.' });
  squashEnd(r, -1, 'side', 'side', {
    title: 'Squash the top',
    text: 'Fold the top edge down to the middle, pulling both top corners out to the sides. Flatten them into triangles.',
  });
  squashEnd(r, 1, 'end', 'end', {
    title: 'Squash the bottom',
    text: 'Push the bottom edge up to the middle, letting the bottom corners come down below it, and flatten them.',
  });
  // The top section folds behind along the middle: its triangles become the upper wings, their tips at the
  // sheet's middle line, (±½, 0).
  r.along(table(-1, 0), table(1, 0), table(0, -0.15), {
    title: 'Fold the top behind',
    text: 'Fold the top part back behind, along the middle. It’s a wide triangle now.',
    kind: 'mountain',
  });
  // The body narrows: each top flap (all the layers of that lower quarter, joined along its outer edge) folds
  // in, from the top corner of its square, (∓¼, 0), to the middle of the bottom flap's slanted edge, (∓⅛, ⅜).
  for (const s of [-1, 1]) {
    const a: Vec2 = [s * 0.25, 0];
    const b: Vec2 = [s * 0.125, 0.375];
    r.along(table(...a), table(...b), table(s * 0.24, 0.2), {
      title: s < 0 ? 'Narrow the left side' : 'Narrow the right side',
      text: s < 0 ? 'Fold the top left flap in, from its top corner to the middle of its bottom edge.' : 'And the top right flap.',
      only: ([u, v]: Vec2) => s * u > 0 && v > 0,
    });
  }
  r.along(table(0, -1), table(0, 1), table(-0.2, 0.1), { title: 'Fold in half', text: 'Fold the left half over onto the right.' });
  // The wings: the top half folds back out on a slanted line just beside the body (the fold), so the wings
  // spread both ways; then it's lifted a little, for a butterfly in flight.
  const wing = 0.06;
  r.along(table(wing, 0), table(0, 0.35), table(0.3, 0.1), {
    title: 'Fold out the wings',
    text: 'Fold the top half back to the left, on a slant just beside the body. The wings spread out on both sides.',
    only: ([u]) => u < 0,
  });
  r.shape({ title: 'Lift the wings', text: 'Lift the wings a little, folding the butterfly gently in half along its body. Done!' }, [
    { through: [table(0, -1), table(0, 1)], moving: table(-0.3, 0.1), degrees: 35, only: ([u]) => u < 0 },
  ]);
  return r.build();
}
