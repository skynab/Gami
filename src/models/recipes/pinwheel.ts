import { paper, Recipe } from '../../fold/recipe';
import { squashEnd } from './windmill';

/**
 * The traditional pinwheel (windmill), following the order of folds at origami.me/pinwheel: the sides folded
 * to the middle, the top and bottom creased to the middle, then each end squashed flat with one corner pulled
 * out sideways and the other up (or down), so the four arms point round the same way.
 */
export function pinwheel() {
  const r = new Recipe({ id: 'pinwheel', title: 'Pinwheel', sheet: { size: [1, 1], front: '#f6f3ec', back: '#e5484d' } })
    .crease(paper(-0.5, 0), paper(0.5, 0), { title: 'Fold in half', text: 'Fold in half side to side, then unfold.' })
    .crease(paper(0, -0.5), paper(0, 0.5), { title: 'Fold in half the other way', text: 'And top to bottom, then unfold.' })
    .onto(paper(-0.5, 0), paper(0, 0), { title: 'Fold the left side in', text: 'Fold the left edge to the middle crease.' })
    .onto(paper(0.5, 0), paper(0, 0), { title: 'Fold the right side in', text: 'And the right edge.' })
    .crease(paper(0, -0.5), paper(0, 0), { title: 'Fold the top to the middle', text: 'Fold the top edge to the middle, then unfold.' })
    .crease(paper(0, 0.5), paper(0, 0), { title: 'Fold the bottom to the middle', text: 'And the bottom edge, then unfold.' });

  // Each end squashed with its corners pulled out (see ./windmill): at the top, the left corner sideways and the
  // right one up; at the bottom, the other way round, so the four arms turn the same way.
  squashEnd(r, -1, 'side', 'end', {
    title: 'Squash the top',
    text: 'Fold the top edge down to the middle, pulling the top left corner out to the side and the top right corner up. Flatten them into triangles.',
  });
  squashEnd(r, 1, 'end', 'side', {
    title: 'Squash the bottom',
    text: 'The same at the bottom, the other way round: the bottom right corner out to the side and the bottom left one down. Pin the middle to a stick and blow: it spins!',
  });
  return r.build();
}
