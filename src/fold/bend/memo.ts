import type { FoldFrame } from '../types';

/**
 * Bent paper solved lately, by everything it was solved from: making a model and replaying its file solve every bend
 * again from the same paper (up to a minute and a half for the crane's three reverse folds), and the solver gives the
 * same paper every time from the same start (see docs/bending-plan.md, "Determinism"), so the second is the first
 * again. Paper that differs in any digit is solved afresh. A few are kept, the latest used.
 */
const kept = new Map<string, unknown>();
const KEEP = 12;

export function remembered<T>(key: string, make: () => T): T {
  if (kept.has(key)) {
    const known = kept.get(key) as T;
    kept.delete(key);
    kept.set(key, known);
    return known;
  }
  const made = make();
  kept.set(key, made);
  if (kept.size > KEEP) kept.delete(kept.keys().next().value!);
  return made;
}

/** Everything about a frame a bend is solved from, as a key for `remembered`. */
export function frameKey(f: FoldFrame): string {
  return JSON.stringify([f.vertices_coords, f.vertices_paper, f.faces_vertices, f.faces_layer, f.faces_parent, f.cuts, f.tapes, f.soft]);
}
