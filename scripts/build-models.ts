/**
 * Writes every built-in model to public/models: <id>.fold for the viewer and <id>.svg for its gallery card.
 * Run with `npm run models` after changing a recipe. A test fails if the files are out of date.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { toFoldFile } from '../src/fold/fold-format';
import { thumbnailSvg } from '../src/fold/thumbnail';
import { RECIPES } from '../src/models/recipes';

const dir = new URL('../public/models/', import.meta.url);
mkdirSync(dir, { recursive: true });
for (const make of RECIPES) {
  const model = make();
  writeFileSync(new URL(`${model.id}.fold`, dir), `${JSON.stringify(toFoldFile(model))}\n`);
  writeFileSync(new URL(`${model.id}.svg`, dir), thumbnailSvg(model));
  console.log(`${model.id}: ${model.steps.length} steps`);
}
