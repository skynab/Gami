import { foldPath } from '../src/fold/bend/frame';
import { framesOf } from '../src/fold/frames';
import { RECIPES } from '../src/models/recipes/index';
const [id, step] = [process.argv[2], Number(process.argv[3])];
const model = RECIPES.map((m) => m()).find((m) => m.id === id)!;
const frames = framesOf(model);
const via = foldPath(frames[step - 1], frames[step], (model.steps[step - 1].op as any).anchor.paper);
const all = [frames[step - 1], ...via, frames[step]];
all.forEach((f, j) => {
  // Worst stretch of any face edge, and lowest point.
  let stretch = 0;
  for (const face of f.faces_vertices)
    face.forEach((v, i) => {
      const w = face[(i + 1) % face.length];
      const d3 = Math.hypot(...f.vertices_coords[v].map((x, k) => x - f.vertices_coords[w][k]));
      const d2 = Math.hypot(f.vertices_paper[v][0] - f.vertices_paper[w][0], f.vertices_paper[v][1] - f.vertices_paper[w][1]);
      stretch = Math.max(stretch, Math.abs(d3 - d2));
    });
  const ys = f.vertices_coords.map((p) => p[1]);
  console.log(j, 'faces', f.faces_vertices.length, 'verts', f.vertices_coords.length, 'stretch', stretch.toFixed(3), 'y', Math.min(...ys).toFixed(3), Math.max(...ys).toFixed(3));
});
