import { fromFoldFile } from '../fold/fold-format';
import type { OrigamiModel } from '../fold/types';
import { findModel } from '../gallery/catalog';

/** A plain square and no steps, for models whose instructions aren't written yet. */
export const BLANK_SHEET: OrigamiModel = {
  id: 'blank',
  title: '',
  sheets: [{ size: [1, 1], front: '#5b54e8', back: '#f6f3ec' }],
  start: {
    vertices_paper: [[-0.5, 0.5], [0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]],
    vertices_coords: [[-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 0, -0.5], [-0.5, 0, -0.5]],
    faces_vertices: [[0, 1, 2, 3]],
  },
  steps: [],
};

/** Where a built-in model's files are served from. */
export const modelUrl = (id: string, ext: 'fold' | 'svg' | 'preview.svg') =>
  `${import.meta.env.BASE_URL}models/${id}${ext === 'preview.svg' ? '-' : '.'}${ext}`;

/** Fetches a built-in model's steps, or returns null for models that don't have any yet. */
export function loadModel(id: string): Promise<OrigamiModel> | null {
  if (!findModel(id)?.steps) return null;
  return fetch(modelUrl(id, 'fold')).then(async (res) => {
    if (!res.ok) throw new Error(`Couldn’t load ${id} (${res.status})`);
    return fromFoldFile(await res.json());
  });
}
