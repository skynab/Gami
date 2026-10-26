// Scratch: how far joined faces come apart mid-step, for every step of every built-in model.
import { affine, poseAt, stepTransition } from '../src/fold/animate';
import { framesOf } from '../src/fold/frames';
import { joinedSegment } from '../src/fold/geometry2d';
import { RECIPES } from '../src/models/recipes/index';

const only = process.argv[2];
const rows: [string, number, string, string, number][] = [];
for (const make of RECIPES) {
  const model = make();
  if (only && model.id !== only) continue;
  const frames = framesOf(model);
  model.steps.forEach((step, i) => {
    const k = i + 1;
    if (step.frame.soft?.length) return;
    const t = stepTransition(model, k);
    const cuts = frames[k].cuts ?? [];
    const pairs: [number, number, [number, number][]][] = [];
    for (let a = 0; a < t.faces.length; a++)
      for (let b = a + 1; b < t.faces.length; b++) {
        const s = joinedSegment(t.faces[a].paper, t.faces[b].paper, cuts);
        if (s) pairs.push([a, b, s as [number, number][]]);
      }
    let worst = 0;
    for (const s of [0.25, 0.5, 0.75]) {
      const pose = poseAt(t, s);
      for (const [a, b, seg] of pairs) {
        const pa = affine(t.faces[a].paper, pose[a]);
        const pb = affine(t.faces[b].paper, pose[b]);
        for (const q of seg) {
          const [x, y] = [pa(q), pb(q)];
          worst = Math.max(worst, Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]));
        }
      }
    }
    rows.push([model.id, k, step.title, step.op?.op ?? '', worst]);
  });
}
const torn = rows.filter((r) => r[4] > 0.01).sort((a, b) => b[4] - a[4]);
for (const r of torn) console.log(r[4].toFixed(3), r[0], r[1], r[3], '|', r[2]);
console.log(`${torn.length} torn of ${rows.length} steps`);
