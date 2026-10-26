// Scratch: a collapse step played through foldPath's frames, and how far joined faces come apart.
import { affine, poseAt, transitionVia, type Transition } from '../src/fold/animate';
import { foldPath } from '../src/fold/bend/frame';
import { framesOf } from '../src/fold/frames';
import { joinedSegment } from '../src/fold/geometry2d';
import { RECIPES } from '../src/models/recipes/index';
import type { FoldFrame } from '../src/fold/types';

export function gap(t: Transition, cuts: FoldFrame['cuts'], samples = [0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9]): number {
  const pairs: [number, number, [number, number][]][] = [];
  for (let a = 0; a < t.faces.length; a++)
    for (let b = a + 1; b < t.faces.length; b++) {
      const s = joinedSegment(t.faces[a].paper, t.faces[b].paper, cuts ?? []);
      if (s) pairs.push([a, b, s as [number, number][]]);
    }
  let worst = 0;
  for (const s of samples) {
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
  return worst;
}

if (process.argv[2]) {
  const [id, step] = [process.argv[2], Number(process.argv[3])];
  const model = RECIPES.map((m) => m()).find((m) => m.id === id)!;
  const frames = framesOf(model);
  const op = model.steps[step - 1].op as any;
  const anchor = op.anchor.paper;
  const t0 = Date.now();
  const via = foldPath(frames[step - 1], frames[step], anchor);
  console.log('via frames', via.length, 'in', Date.now() - t0, 'ms');
  const t = transitionVia([frames[step - 1], ...via, { ...frames[step], faces_parent: undefined }], { joined: true });
  console.log('gap', gap(t, frames[step].cuts).toFixed(4));
  // How low anything goes, and the paper's height through the step.
  for (const s of [0.25, 0.5, 0.75, 0.95]) {
    const ys = poseAt(t, s).flat().map((p) => p[1]);
    console.log(s, 'y', Math.min(...ys).toFixed(3), Math.max(...ys).toFixed(3));
  }
}

/** Largest move of any face corner between consecutive frames of a step played through `via`. */
export function jumps(frames: FoldFrame[]): number[] {
  const out: number[] = [];
  for (let j = 1; j < frames.length; j++) {
    const a = frames[j - 1], b = frames[j];
    // Corners by their point on the sheet (the first frame has other faces, so match by paper).
    const at = new Map(a.vertices_paper.map((p, v) => [p.map((x) => x.toFixed(5)).join(), a.vertices_coords[v]]));
    let worst = 0;
    b.vertices_paper.forEach((p, v) => {
      const q = at.get(p.map((x) => x.toFixed(5)).join());
      if (q) worst = Math.max(worst, Math.hypot(...b.vertices_coords[v].map((x, i) => x - q[i])));
    });
    out.push(+worst.toFixed(3));
  }
  return out;
}
if (process.argv[2]) {
  const [id, step] = [process.argv[2], Number(process.argv[3])];
  const model = RECIPES.map((m) => m()).find((m) => m.id === id)!;
  const frames = framesOf(model);
  const via = foldPath(frames[step - 1], frames[step], (model.steps[step - 1].op as any).anchor.paper);
  console.log('jumps', jumps([frames[step - 1], ...via, frames[step]]).join(' '));
}
