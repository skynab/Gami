import { paper, Recipe, table } from '../../fold/recipe';
import { finishPlane } from './paper-plane';

/** Each roll of the leading edge: about 2.5 cm (1 inch) on US letter held sideways. */
export const ROLL = 0.09;

/**
 * The albatross, Orikata's own: a glider with long, narrow, straight wings and a heavy front edge, which circles slowly,
 * after the look of Fold'N Fly's Underside Plane (design #27), which is likely Norman Schmidt's, but folded its own
 * way: a sheet held sideways folded in half from top to bottom, its folded edge rolled over twice for a thick leading
 * edge, then folded in half with a short body, so nearly all of its width is wing. From US letter paper held
 * sideways (11 : 8.5).
 */
export function albatross() {
  const w = 1;
  const h = 0.77;
  const [top, bottom] = [-h / 2, h / 2];

  const plane = new Recipe({ id: 'albatross', title: 'Albatross', sheet: { size: [w, h], front: '#5a6b7a', back: '#f6f3ec' } })
    .crease(paper(0, top), paper(0, bottom), { title: 'Fold in half', text: 'With the paper sideways, bring the left edge over to the right edge, crease down the middle and open it again.' })
    .onto(paper(0, top), paper(0, bottom), { title: 'Fold in half the other way', text: 'Bring the top edge down to the bottom edge. The fold along the top is the front of the wing.' })
    .along(table(-1, ROLL), table(1, ROLL), table(0, 0), { title: 'Roll the front edge', text: 'Fold the folded top edge down about 2.5 cm (1 inch).' })
    .along(table(-1, 2 * ROLL), table(1, 2 * ROLL), table(0, ROLL), { title: 'Roll it again', text: 'Fold it down once more, the same amount, so the front edge is thick and heavy.' });
  return finishPlane(plane, 0.03, 'Fold the wing down along a line about 1 cm (3/8 inch) above the bottom. It’s long and narrow.', {
    flyText: 'Turn the plane over, so it stands on its keel with its long wings out flat. Give them a slight upward V and launch it gently: it glides slowly round in wide circles.',
  });
}
