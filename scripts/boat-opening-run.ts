// The boat opened by its guides, and what its bend does (see src/fold/bend/report.ts).
import { writeFileSync } from 'node:fs';
import { boat } from '../src/models/recipes/boat';
import { openingGuides, STAGES } from './boat-opening-lab';
import { bendReport, describeBend } from '../src/fold/bend/report';
import { toFoldFile } from '../src/fold/fold-format';
const r = boat();
const goals = openingGuides(r);
const t0 = performance.now();
r.bend({ title: 'Open it into a boat', text: 'Pull the two top corners apart.' }, { flex: () => true, anchor: [0, 0], goals, mesh: +(process.env.MESH ?? 0.07), stages: STAGES, free: true });
const model = r.build();
console.log(`${goals.length} guides, solved in ${Math.round(performance.now() - t0)} ms`);
console.log(describeBend(bendReport(model, model.steps.length)).join('\n'));
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(toFoldFile({ ...model, id: 'boat-lab' })));
