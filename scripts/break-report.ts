/**
 * Where paper comes apart from the paper it's joined to, model by model, step by step: what shows in the viewer as
 * part of the model floating off the rest, torn away along a crease. Looks at the frame each step comes to rest on
 * (see `restingBreaks` in src/fold/breaks.ts), and with --playing at points through each step as it plays too
 * (`partings` in src/fold/collisions.ts: how much further apart than at the step's ends).
 *
 *   npm run break-report -- [model ids, or .fold files] [--playing] [--all] [--md <file>] [--url <site>]
 *
 * With no models, every one in public/models (as built by `npm run models`; nothing is solved again, except the
 * steps' motions with --playing, which takes a few minutes for them all). Gaps wider than `BREAK` count (1.5 mm on a
 * 15 cm sheet), whether or not a model is known to come apart that far (`BREAKS` in src/models/known-clipping.ts);
 * --all lists every gap wider than a layer. --md writes the report to a Markdown file as well. Each line links to its
 * step in the viewer, on the dev server (`npm run dev`) or the site --url names.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { BREAK, restingBreaks, type RestingBreak } from '../src/fold/breaks';
import { partings } from '../src/fold/collisions';
import { fromFoldFile } from '../src/fold/fold-format';
import { LAYER_GAP } from '../src/fold/frames';
import type { OrigamiModel, Vec2 } from '../src/fold/types';
import { BREAKS, TEAR, TEARS } from '../src/models/known-clipping';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? (args.splice(i, 1), true) : false;
};
const playing = flag('--playing');
const all = flag('--all');
const mdAt = args.indexOf('--md');
const md = mdAt >= 0 ? args.splice(mdAt, 2)[1] : undefined;
const urlAt = args.indexOf('--url');
const site = (urlAt >= 0 ? args.splice(urlAt, 2)[1] : 'http://localhost:5173').replace(/\/$/, '');
/** The step in the viewer. */
const link = (id: string, step: number) => `${site}/learn/${id}?step=${step}`;

/** Wider than this counts, at rest and as steps play. */
const [atRest, asPlaying] = all ? [LAYER_GAP, LAYER_GAP] : [BREAK, TEAR];

const dir = new URL('../public/models/', import.meta.url);
const which = args.length ? args : readdirSync(dir).filter((f) => f.endsWith('.fold') && !f.includes('-preview')).map((f) => f.replace(/\.fold$/, ''));
const load = (w: string): OrigamiModel => fromFoldFile(JSON.parse(readFileSync(w.endsWith('.fold') ? w : new URL(`${w}.fold`, dir), 'utf8')));

const layers = (d: number) => `${(d / LAYER_GAP).toFixed(1)} layers`;
const mm = (d: number) => `${(d * 150).toFixed(1)} mm`;
const pt = (q: Vec2) => `(${q[0].toFixed(2)}, ${q[1].toFixed(2)})`;

interface Row {
  id: string;
  worst: number;
  lines: string[];
}
const rows: Row[] = [];
const clean: string[] = [];
for (const w of which) {
  const model = load(w);
  const found = restingBreaks(model, atRest);
  // The widest of each step, and how many pairs of faces have parted in it.
  const bySteps = new Map<number, { worst: RestingBreak; pairs: number }>();
  for (const b of found) {
    const s = bySteps.get(b.step);
    if (!s) bySteps.set(b.step, { worst: b, pairs: 1 });
    else (s.pairs++, b.gap > s.worst.gap && (s.worst = b));
  }
  const lines = [...bySteps.values()].map(({ worst: b, pairs }) => {
    const sheet = model.sheets.length > 1 ? `, sheet ${b.sheet + 1}` : '';
    return `  at rest, step ${String(b.step).padStart(2)} “${model.steps[b.step - 1].title}”: ${mm(b.gap)} apart on a 15 cm sheet (${layers(b.gap)}), ${pairs} pair${pairs === 1 ? '' : 's'} of faces; along the crease at ${pt(b.paper)} on the sheet${sheet}
    ${link(model.id, b.step)}`;
  });
  let worst = Math.max(0, ...found.map((b) => b.gap));
  if (playing) {
    for (const { step, apart } of partings(model)) {
      if (apart <= asPlaying) continue;
      lines.push(`  playing, step ${String(step).padStart(2)} “${model.steps[step - 1].title}”: ${mm(apart)} further apart than at its ends (${layers(apart)})
    ${link(model.id, step)}`);
      worst = Math.max(worst, apart);
    }
  }
  const known = [model.id in BREAKS ? `known at rest to ${mm(BREAKS[model.id])}` : '', playing && model.id in TEARS ? `known playing to ${mm(TEARS[model.id])}` : '']
    .filter(Boolean)
    .join(', ');
  if (lines.length) rows.push({ id: known ? `${model.id} (${known})` : model.id, worst, lines });
  else clean.push(model.id);
}

rows.sort((a, b) => b.worst - a.worst);
const out = [
  `Joined paper come apart, wider than ${all ? 'a layer' : `${mm(atRest)} on a 15 cm sheet`} (${which.length} model${which.length === 1 ? '' : 's'}${playing ? ', at rest and playing' : ', at rest'}):`,
  '',
  ...rows.flatMap((r) => [`${r.id}: ${mm(r.worst)} (${layers(r.worst)}) at worst`, ...r.lines, '']),
  `Clean: ${clean.length ? clean.join(', ') : 'none'}.`,
];
console.log(out.join('\n'));
if (md) {
  writeFileSync(md, ['# Break report', '', '```', ...out, '```', ''].join('\n'));
  console.log(`\nWritten to ${md}.`);
}
