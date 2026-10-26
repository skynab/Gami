import { poseAt, transitionVia } from '../src/fold/animate';
import { foldPath } from '../src/fold/bend/frame';
import { framesOf } from '../src/fold/frames';
import { RECIPES } from '../src/models/recipes/index';
import { gap } from './try-path';
const [id, step] = [process.argv[2], Number(process.argv[3])];
const model = RECIPES.map((m) => m()).find((m) => m.id === id)!;
const frames = framesOf(model);
const via = foldPath(frames[step - 1], frames[step], (model.steps[step - 1].op as any).anchor.paper);
const all = [frames[step - 1], ...via, frames[step]];
for (let j = 1; j < all.length; j++) {
  const t = transitionVia([all[j - 1], all[j]], { joined: true });
  const ys = [0.25, 0.5, 0.75].flatMap((s) => poseAt(t, s).flat().map((p) => p[1]));
  console.log(j, 'gap', gap(t, all[j].cuts).toFixed(3), 'low', Math.min(...ys).toFixed(3));
}
