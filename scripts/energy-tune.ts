/**
 * Tuning the energy solver (see src/fold/bend/minimize.ts): a model's bend solved again from its .fold file, with
 * the solver as it is now (its weights in solver.ts's `ENERGY`), and the bend report on it. Seconds, where building
 * the model again folds it all.
 *
 *   npx tsx scripts/energy-tune.ts <model id> [step]
 */
import { readFileSync } from 'node:fs';
import { bendReport, describeBend } from '../src/fold/bend/report';
import { fromFoldFile } from '../src/fold/fold-format';
import { applyOp } from '../src/fold/ops';

const [id, only] = process.argv.slice(2);
const model = fromFoldFile(JSON.parse(readFileSync(new URL(`../public/models/${id}.fold`, import.meta.url), 'utf8')));
const k = only ? +only : model.steps.findIndex((s) => s.op?.op === 'bend') + 1;
const step = model.steps[k - 1];
if (step?.op?.op !== 'bend') throw new Error(`Step ${k} of ${id} isn't a bend.`);
const before = { ...model, steps: model.steps.slice(0, k - 1) };
const t0 = performance.now();
const { frame, via } = applyOp(before, step.op);
const ms = Math.round(performance.now() - t0);
const again = { ...model, steps: [...before.steps, { ...step, frame, via }] };
console.log(`${id} step ${k}: solved in ${ms} ms`);
console.log(describeBend(bendReport(again, k)).join('\n'));
