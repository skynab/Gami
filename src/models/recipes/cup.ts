import { lerp } from '../../fold/geometry2d';
import { paper, Recipe, table } from '../../fold/recipe';

/** A paper cup that holds water for a while. */
export function cup() {
  const cup = new Recipe({ id: 'cup', title: 'Cup', sheet: { size: [1, 1], front: '#2f9e8f', back: '#f6f3ec' } })
    .onto(paper(0.5, -0.5), paper(-0.5, 0.5), {
      title: 'Fold in half diagonally',
      text: 'Bring the top-right corner down to the bottom-left corner.',
    })
    .rotate(-135, { title: 'Turn it point up', text: 'Turn the triangle so the long folded edge is at the bottom.' });

  // The two bottom corners each fold to the opposite edge. Landing at (2 − √2) of the way up the edge
  // leaves the top of each flap level with the bottom.
  const right = cup.where(paper(-0.5, -0.5));
  const left = cup.where(paper(0.5, 0.5));
  const apex = cup.where(paper(-0.5, 0.5));
  const k = 2 - Math.SQRT2;
  const onLeft = lerp(left, apex, k);
  const onRight = lerp(right, apex, k);

  return cup
    .onto(paper(-0.5, -0.5), table(...onLeft), {
      title: 'Fold the right corner across',
      text: 'Bring the right corner to the left edge, so the top of the flap is level.',
    })
    .onto(paper(0.5, 0.5), table(...onRight), {
      title: 'Fold the left corner across',
      text: 'Bring the left corner over to the right edge in the same way.',
    })
    .along(table(-1, onLeft[1]), table(1, onLeft[1]), table(apex[0], apex[1]), {
      title: 'Fold the front flap down',
      text: 'Fold the top layer of the point down over the front. You can tuck it into the pocket instead.',
      layers: 1,
    })
    .turnOver()
    .along(table(-1, onLeft[1]), table(1, onLeft[1]), table(apex[0], apex[1]), {
      title: 'Fold the other flap down',
      text: 'Fold the last point down to match. Push the sides gently to open the cup.',
      layers: 1,
    })
    .build();
}
