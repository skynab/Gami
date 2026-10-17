import type { OrigamiModel } from '../fold/types';

/**
 * Step-by-step data for the models that have it, loaded only when opened.
 * Milestone 4 moves these to .fold files in public/models.
 */
const LOADERS: Record<string, () => Promise<OrigamiModel>> = {
  basics: () => import('./basics').then((m) => m.basics),
};

/** A plain square and no steps, for models whose instructions aren't written yet. */
export const BLANK_SHEET: OrigamiModel = {
  id: 'blank',
  title: '',
  sheet: { size: [1, 1], front: '#5b54e8', back: '#f6f3ec' },
  start: {
    vertices_paper: [[-0.5, 0.5], [0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]],
    vertices_coords: [[-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 0, -0.5], [-0.5, 0, -0.5]],
    faces_vertices: [[0, 1, 2, 3]],
  },
  steps: [],
};

export function loadModel(id: string): Promise<OrigamiModel> | null {
  return LOADERS[id]?.() ?? null;
}
