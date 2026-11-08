/**
 * What a model's bent steps do (see src/fold/bend/report.ts): stretch, turns between frames, how far the paper falls
 * behind its guides, paper through paper, and where on the sheet each is worst.
 *
 *   npm run bend-report -- <model id, or a .fold file> [step]
 *
 * A model id reads public/models/<id>.fold, as built by `npm run models`; nothing is solved again.
 */
import { readFileSync } from 'node:fs';
import { describeBend, bendReport } from '../src/fold/bend/report';
import { fromFoldFile } from '../src/fold/fold-format';

const [which, only] = process.argv.slice(2);
if (!which) {
  console.error('Usage: npm run bend-report -- <model id, or a .fold file> [step]');
  process.exit(1);
}
const path = which.endsWith('.fold') ? which : new URL(`../public/models/${which}.fold`, import.meta.url);
const model = fromFoldFile(JSON.parse(readFileSync(path, 'utf8')));
const bent = model.steps.flatMap((s, i) => (s.frame.soft?.length && (!only || +only === i + 1) ? [i + 1] : []));
if (!bent.length) console.log(only ? `Step ${only} of ${model.id} isn’t bent.` : `${model.id} has no bent steps.`);
for (const k of bent) console.log(describeBend(bendReport(model, k)).join('\n'));
