import { overlapArea } from './geometry2d';
import type { Tape, Vec2 } from './types';

/**
 * Which paper tape holds together (see tape.ts). Apart from laying tape, so the fold engine can allow for it
 * without depending on everything laying it does.
 */

/** The faces (given by their outlines on the sheet) each strip of tape holds together, as indices. */
export function stuckTogether(tapes: Tape[] | undefined, faces: Vec2[][]): number[][] {
  return (tapes ?? []).map((t) => faces.flatMap((face, f) => (t.pieces.some((p) => overlapArea(face, p.points) > 1e-9) ? [f] : [])));
}

/**
 * Which faces take part in a fold once tape is allowed for: any face stuck to one that takes part does too, so
 * taped layers fold as one.
 */
export function withTaped(tapes: Tape[] | undefined, faces: Vec2[][], takesPart: boolean[]): boolean[] {
  const out = [...takesPart];
  const groups = stuckTogether(tapes, faces);
  // Tape can join a group to another through a face they share: go on until nothing more joins.
  for (let changed = true; changed; ) {
    changed = false;
    for (const group of groups) {
      if (!group.some((f) => out[f]) || group.every((f) => out[f])) continue;
      for (const f of group) out[f] = true;
      changed = true;
    }
  }
  return out;
}
