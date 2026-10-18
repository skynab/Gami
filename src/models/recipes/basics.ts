import { paper, Recipe } from '../../fold/recipe';
import { basics } from '../basics';

/**
 * "Folding basics" for the gallery: the same four steps as the hand-written model in ../basics.ts (which the
 * engine's tests use), made by the fold engine so its .fold file says how each step is folded, like every
 * other model.
 */
export function folds() {
  const [half, open, over, again] = basics.steps;
  return new Recipe({ id: basics.id, title: basics.title, sheet: basics.sheets[0] })
    .onto(paper(-0.5, -0.5), paper(0.5, 0.5), { title: half.title, text: half.text })
    .unfold({ title: open.title, text: open.text })
    .turnOver(over.text)
    .onto(paper(0, 0.5), paper(0, -0.5), { title: again.title, text: again.text })
    .build();
}
