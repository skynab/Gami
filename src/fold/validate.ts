import { poseAt, transition } from './animate';
import { toFlat } from './fold';
import { framesOf } from './frames';
import { overlapArea, signedArea } from './geometry2d';
import type { FoldFrame, OrigamiModel, Vec2, Vec3 } from './types';

/**
 * Checks a model is physically sensible, step by step. Returns what's wrong, or an empty list.
 * The paper must never stretch or lose area, stacked faces must be in a definite order,
 * and animating each step must keep faces their shape and above the table.
 */
export function problems(model: OrigamiModel): string[] {
  const out: string[] = [];
  const frames = framesOf(model);
  const area = Math.abs(sheetArea(model.start));

  frames.forEach((frame, k) => {
    const where = k ? `step ${k}` : 'start';
    if (Math.abs(sheetArea(frame) - area) > 1e-6) out.push(`${where}: paper area changed`);
    if (k && frame.faces_parent?.some((p) => p >= frames[k - 1].faces_vertices.length)) out.push(`${where}: face parent out of range`);
    frame.faces_vertices.forEach((face, f) => {
      const world = face.map((v) => frame.vertices_coords[v]);
      const sheet = face.map((v) => frame.vertices_paper[v]);
      if (!sameShape(world, sheet)) out.push(`${where}: face ${f} is stretched`);
    });
    if (isFlat(frame)) {
      const faces = toFlat(frame);
      for (let a = 0; a < faces.length; a++) {
        for (let b = a + 1; b < faces.length; b++) {
          if (faces[a].layer === faces[b].layer && overlapArea(faces[a].world, faces[b].world) > 1e-6) {
            out.push(`${where}: faces ${a} and ${b} overlap on the same layer`);
          }
        }
      }
    }
    if (k) {
      const t = transition(frames[k - 1], frame);
      for (const s of [0.25, 0.5, 0.75]) {
        poseAt(t, s).forEach((pts, f) => {
          if (!sameShape(pts, t.faces[f].paper)) out.push(`${where}: face ${f} stretches while animating`);
          if (pts.some((p) => p[1] < -1e-6)) out.push(`${where}: face ${f} goes through the table while animating`);
        });
      }
    }
  });
  return [...new Set(out)];
}

function sameShape(world: Vec3[], sheet: Vec2[]): boolean {
  for (let i = 0; i < world.length; i++) {
    const j = (i + 1) % world.length;
    const a = Math.hypot(world[i][0] - world[j][0], world[i][1] - world[j][1], world[i][2] - world[j][2]);
    const b = Math.hypot(sheet[i][0] - sheet[j][0], sheet[i][1] - sheet[j][1]);
    if (Math.abs(a - b) > 1e-6) return false;
  }
  return true;
}

function sheetArea(frame: FoldFrame): number {
  return frame.faces_vertices.reduce((sum, face) => sum + Math.abs(signedArea(face.map((v) => frame.vertices_paper[v]))), 0);
}

function isFlat(frame: FoldFrame): boolean {
  return frame.vertices_coords.every((p) => Math.abs(p[1]) < 1e-6);
}
