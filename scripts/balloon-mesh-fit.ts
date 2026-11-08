// How far the exact cube map (balloon-cube-lab.ts) stretches the bend's own mesh: each triangle's corners placed
// through the map, by the face it's cut from, its edges against the sheet's. A triangle crossing a fold of the map
// can't follow it flat, so the guides ask the impossible there. PRECREASE creases the cube's edges first, across
// the stack (as balloon-cube-run.ts can), so the mesh has edges along them; MESH sets the mesh's size.
import { meshFrame } from '../src/fold/bend/frame';
import { Recipe, table } from '../src/fold/recipe';
import type { Vec2, Vec3 } from '../src/fold/types';
import { tuckedSide, waterbombBase } from '../src/models/recipes/waterbomb-base';
import { onCube } from './balloon-cube-lab';

const r = waterbombBase(new Recipe({ id: 'balloon', title: 'Balloon', sheet: { size: [1, 1], front: '#4caf50', back: '#f6f3ec' } }));
tuckedSide(r);
r.turnOver('Turn it over, and do the same on this side.');
tuckedSide(r);
if (process.env.PRECREASE) {
  r.crease(table(0, -0.5), table(0, -0.25), { title: 'Crease the top edges' });
  r.crease(table(0, 0), table(0, -0.25), { title: 'Crease the bottom edges' });
}
const frame = r.current;
const at = onCube(frame);
const mesh = meshFrame(frame, frame.faces_vertices.map((_, i) => i), +(process.env.MESH ?? 0.07));

/** Each triangle's stretch through the map at θ, and its corners there. */
const fit = (theta: number) =>
  mesh.triangles.map((t, i) => {
    const pts = t.map((v): Vec3 => at(mesh.parent[i], mesh.paper[v] as Vec2, theta));
    let strain = 0;
    for (let e = 0; e < 3; e++) {
      const [a, b] = [mesh.paper[t[e]], mesh.paper[t[(e + 1) % 3]]];
      const [p, q] = [pts[e], pts[(e + 1) % 3]];
      strain = Math.max(strain, Math.abs(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) / Math.hypot(a[0] - b[0], a[1] - b[1]) - 1));
    }
    return { i, strain, pts };
  });

for (const k of [2, 4, 6, 8, 10, 12]) {
  const all = fit(((k / 12) * Math.PI) / 2);
  const bad = all.filter((x) => x.strain > 0.01);
  console.log(`stage ${k}: ${bad.length} of ${mesh.triangles.length} triangles over 1%, worst ${(100 * Math.max(...all.map((x) => x.strain))).toFixed(0)}%`);
}
// The worst at the cube, and where.
for (const { i, strain, pts } of fit(Math.PI / 2).sort((a, b) => b.strain - a.strain).slice(0, 4)) {
  const f = mesh.parent[i];
  const round = (p: number[]) => p.map((x) => x.toFixed(3)).join(',');
  console.log(`  ${(100 * strain).toFixed(1)}%: face ${f} (layer ${frame.faces_layer![f]}), on the sheet ${mesh.triangles[i].map((v) => round(mesh.paper[v])).join(' | ')}; on the cube ${pts.map(round).join(' | ')}`);
}
