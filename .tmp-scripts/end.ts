import { poseAt, transitionVia } from '../src/fold/animate';
import { foldPath } from '../src/fold/bend/frame';
import { framesOf } from '../src/fold/frames';
import { RECIPES } from '../src/models/recipes/index';
import { gap } from './try-path';
const [id, step] = [process.argv[2], Number(process.argv[3])];
const model = RECIPES.map((m) => m()).find((m) => m.id === id)!;
const frames = framesOf(model);
const via = foldPath(frames[step - 1], frames[step], (model.steps[step - 1].op as any).anchor.paper);
const t = transitionVia([frames[step - 1], ...via, { ...frames[step], faces_parent: undefined }], { joined: true });
const n = via.length + 1;
for (let j = 0; j < n; j++) {
  const ss = [0.25, 0.5, 0.75].map((x) => (j + x) / n);
  const ys = ss.flatMap((s) => poseAt(t, s).flat().map((p) => p[1]));
  console.log('stretch', j + 1, 'gap', gap(t, frames[step].cuts, ss).toFixed(3), 'low', Math.min(...ys).toFixed(3));
}
