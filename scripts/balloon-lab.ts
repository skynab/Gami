import { writeFileSync } from 'node:fs';
import { waterbomb } from '../src/models/recipes/waterbomb';
import { bendFrame } from '../src/fold/bend/frame';
import { enclosed } from '../src/fold/bend/solver';
import { toFoldFile } from '../src/fold/fold-format';
import { crossingAt } from '../src/fold/collisions';
import { stepTransition } from '../src/fold/animate';
import type { FoldFrame, OrigamiModel } from '../src/fold/types';
const volume = +(process.argv[2] ?? 0.015), mesh = +(process.argv[3] ?? 0.05);
const base = waterbomb();
const frame = base.steps.at(-1)!.frame;
// A point in the middle of a bottom-layer face.
// A face in the middle of the stack.
const mid = Math.floor((Math.max(...frame.faces_layer!) + 1) / 2);
const bottom = frame.faces_layer!.indexOf(+(process.env.LAYER ?? mid));
const poly = frame.faces_vertices[bottom].map((v) => frame.vertices_paper[v]);
const anchor: [number, number] = [poly.reduce((s, q) => s + q[0], 0) / poly.length, poly.reduce((s, q) => s + q[1], 0) / poly.length];
const t0 = performance.now();
const r = bendFrame(frame, { flex: frame.faces_vertices.map((_, f) => f), anchor, goals: [], mesh, ...(process.env.CC && { creaseCompliance: +process.env.CC }), ...(volume > 0 && { inflate: volume }) });
const ms = Math.round(performance.now() - t0);
const strain = (f: FoldFrame) => { let w = 0; for (const t of f.faces_vertices) for (let e = 0; e < 3; e++) { const [a, b] = [t[e], t[(e + 1) % 3]]; const want = Math.hypot(f.vertices_paper[a][0] - f.vertices_paper[b][0], f.vertices_paper[a][1] - f.vertices_paper[b][1]); w = Math.max(w, Math.abs(Math.hypot(...[0, 1, 2].map((c) => f.vertices_coords[a][c] - f.vertices_coords[b][c])) - want) / want); } return +w.toFixed(4); };
const model: OrigamiModel = { ...base, steps: [...base.steps, { title: 'Blow it up', kind: 'pose', frame: r.frame, via: r.via }] };
const t = stepTransition(model, model.steps.length);
const n = r.via.length + 1;
const ys = r.frame.vertices_coords.map((q) => q[1]);
console.log(`volume ${volume} mesh ${mesh} ms ${ms} tris ${r.frame.faces_vertices.length} height ${Math.max(...ys).toFixed(3)} strain ${JSON.stringify([...r.via, r.frame].map(strain))}`);
console.log('crossing', JSON.stringify(Array.from({ length: n }, (_, i) => +Math.max(0, ...crossingAt(t, (i + 1) / n - 1e-9).map((c) => c.depth)).toFixed(4))));
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(toFoldFile({ ...model, id: 'bend-lab' })));
void enclosed;
