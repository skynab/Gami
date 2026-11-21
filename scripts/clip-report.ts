/**
 * Where paper passes through paper, model by model, step by step: what shows in the viewer as the inside of the
 * paper poking out through its outside. Looks at the frame each step comes to rest on (see `restingCrossings` in
 * src/fold/collisions.ts), and with --playing at points through each step as it plays too.
 *
 *   npm run clip-report -- [model ids, or .fold files] [--playing] [--stacked] [--md <file>]
 *
 * With no models, every one in public/models (as built by `npm run models`; nothing is solved again, except the
 * steps' motions with --playing, which takes a few minutes for them all). --stacked lists bent paper's stacked layers
 * passing into each other too, which the viewer draws in order where they meet (so they rarely show). --md writes the
 * report to a Markdown file as well.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { crossings, PLAYING, restingCrossings, type RestingCrossing } from '../src/fold/collisions';
import { fromFoldFile } from '../src/fold/fold-format';
import { LAYER_GAP } from '../src/fold/frames';
import type { OrigamiModel, Vec2 } from '../src/fold/types';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? (args.splice(i, 1), true) : false;
};
const playing = flag('--playing');
const withStacked = flag('--stacked');
const mdAt = args.indexOf('--md');
const md = mdAt >= 0 ? args.splice(mdAt, 2)[1] : undefined;

/** Deeper than this counts: a single layer's gap is how far apart stacked paper is drawn anyway. */
const SHOWS = LAYER_GAP;

const dir = new URL('../public/models/', import.meta.url);
const which = args.length ? args : readdirSync(dir).filter((f) => f.endsWith('.fold') && !f.includes('-preview')).map((f) => f.replace(/\.fold$/, ''));
const load = (w: string): OrigamiModel => fromFoldFile(JSON.parse(readFileSync(w.endsWith('.fold') ? w : new URL(`${w}.fold`, dir), 'utf8')));

const layers = (d: number) => `${(d / LAYER_GAP).toFixed(1)} layers`;
const mm = (d: number) => `${(d * 150).toFixed(1)} mm`;
const pt = (q: Vec2) => `(${q[0].toFixed(2)}, ${q[1].toFixed(2)})`;
const kind = (c: RestingCrossing) =>
  [c.sheets[0] !== c.sheets[1] ? `sheets ${c.sheets[0] + 1} and ${c.sheets[1] + 1}` : '', c.pointJoined ? 'joined at a point' : '', c.stacked ? 'stacked, bent' : '']
    .filter(Boolean)
    .join(', ');

interface Row {
  id: string;
  worst: number;
  lines: string[];
}
const rows: Row[] = [];
const clean: string[] = [];
for (const w of which) {
  const model = load(w);
  const found = restingCrossings(model).filter((c) => c.depth > SHOWS && (withStacked || !c.stacked));
  // The deepest of each step, and how many pairs of faces cross in it.
  const bySteps = new Map<number, { worst: RestingCrossing; pairs: number }>();
  for (const c of found) {
    const s = bySteps.get(c.step);
    if (!s) bySteps.set(c.step, { worst: c, pairs: 1 });
    else (s.pairs++, c.depth > s.worst.depth && (s.worst = c));
  }
  const lines = [...bySteps.values()].map(({ worst: c, pairs }) => {
    const what = kind(c);
    return `  at rest, step ${String(c.step).padStart(2)} “${model.steps[c.step - 1].title}”: ${layers(c.depth)} (${mm(c.depth)} on a 15 cm sheet), ${pairs} pair${pairs === 1 ? '' : 's'}${what ? `; ${what}` : ''}; on the sheet at ${pt(c.paper[0])} and ${pt(c.paper[1])}`;
  });
  let worst = Math.max(0, ...found.map((c) => c.depth));
  if (playing) {
    const moving = crossings(model, PLAYING, 'edge').filter((c) => c.depth > SHOWS && !model.steps[c.step - 1].frame.soft?.length);
    const steps = new Map<number, { depth: number; at: number }>();
    for (const c of moving) if (c.depth > (steps.get(c.step)?.depth ?? 0)) steps.set(c.step, { depth: c.depth, at: c.at });
    for (const [k, c] of steps) lines.push(`  playing, step ${String(k).padStart(2)} “${model.steps[k - 1].title}”: ${layers(c.depth)} (${mm(c.depth)}), deepest ${c.at.toFixed(1)} of the way through`);
    worst = Math.max(worst, ...[...steps.values()].map((c) => c.depth));
  }
  if (lines.length) rows.push({ id: model.id, worst, lines });
  else clean.push(model.id);
}

rows.sort((a, b) => b.worst - a.worst);
const out = [
  `Paper through paper, deeper than a layer (${which.length} model${which.length === 1 ? '' : 's'}${playing ? ', at rest and playing' : ', at rest'}${withStacked ? ', bent stacks included' : ''}):`,
  '',
  ...rows.flatMap((r) => [`${r.id}: ${layers(r.worst)} (${mm(r.worst)}) at worst`, ...r.lines, '']),
  `Clean: ${clean.length ? clean.join(', ') : 'none'}.`,
];
console.log(out.join('\n'));
if (md) {
  writeFileSync(md, ['# Clipping report', '', '```', ...out, '```', ''].join('\n'));
  console.log(`\nWritten to ${md}.`);
}
