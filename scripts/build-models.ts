/**
 * Writes every built-in model to public/models: <id>.fold for the viewer, <id>.svg for its gallery card and
 * <id>-preview.svg for the card's looping preview.
 * Run with `npm run models` after changing a recipe. A test fails if the files are out of date.
 *
 * It also checks where each step comes to rest for paper passing through paper deeper than the model checks allow
 * (src/models/known-clipping.ts), naming the model and step, so whoever changed the recipe finds out at once. The
 * files are written all the same, to look at in the viewer, but it ends in an error.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { clippedSteps } from '../src/fold/collisions';
import { toFoldFile } from '../src/fold/fold-format';
import { LAYER_GAP } from '../src/fold/frames';
import { previewSvg, thumbnailSvg } from '../src/fold/thumbnail';
import { REST, RESTS } from '../src/models/known-clipping';
import { RECIPES } from '../src/models/recipes';

const dir = new URL('../public/models/', import.meta.url);
mkdirSync(dir, { recursive: true });
const clipping: string[] = [];
const cleaner: string[] = [];
for (const make of RECIPES) {
  const model = make();
  writeFileSync(new URL(`${model.id}.fold`, dir), `${JSON.stringify(toFoldFile(model))}\n`);
  writeFileSync(new URL(`${model.id}.svg`, dir), thumbnailSvg(model));
  writeFileSync(new URL(`${model.id}-preview.svg`, dir), previewSvg(model));
  console.log(`${model.id}: ${model.steps.length} steps`);
  const limit = RESTS[model.id] ?? REST;
  for (const { step, depth } of clippedSteps(model, limit)) {
    const deep = `${(depth / LAYER_GAP).toFixed(1)} layers, ${(depth * 150).toFixed(1)} mm on a 15 cm sheet`;
    clipping.push(`${model.id}, step ${step} “${model.steps[step - 1].title}”: paper passes through paper at rest, ${deep} (/learn/${model.id}?step=${step})`);
  }
  // A model on the list that no longer goes deeper comes off it.
  if (model.id in RESTS && !clippedSteps(model).length) cleaner.push(model.id);
}
if (cleaner.length) console.log(`\nNo longer clipping at rest, so off RESTS in src/models/known-clipping.ts: ${cleaner.join(', ')}.`);
if (clipping.length) {
  console.error(`\nPaper through paper where a step comes to rest, deeper than ${(REST / LAYER_GAP).toFixed(1)} layers or than the model is known to go:`);
  for (const line of clipping) console.error(`  ${line}`);
  console.error('The files are written; `npm run clip-report -- <id>` says more.');
  process.exitCode = 1;
}
