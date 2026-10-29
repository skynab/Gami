import { FoldError, toFlat, unplaceLike, type FlatFace } from './fold';
import { roundCoord } from './fold-format';
import { frontUp } from './geometry2d';
import { onFace } from './marks';
import { inside } from './select';
import type { FoldFrame, Mark, Vec2 } from './types';
export { stuckTogether, withTaped } from './stuck';

/**
 * Sticky tape. A strip is laid on top of the paper from one point on the table to another, and sticks to the
 * paper facing up beneath it: each piece of it, on each face it covers, is kept as a fill on the sheet (like a
 * mark), so it moves with the paper from then on. Every face under one strip is stuck to the others under it:
 * a later fold that moves some of them (folding just the top layers, say) carries the rest along. Tape stays in
 * the paper from step to step, as cuts do, until a fresh sheet.
 */

/** How wide a strip of tape is, on a 1 × 1 sheet: about 2 cm on a 15 cm square. */
export const TAPE_WIDTH = 0.12;
export const TAPE_COLOUR = '#efe3b4';
export const TAPE_OPACITY = 0.7;

/** The paper with a strip of tape laid from `from` to `to` on the table, `width` wide. */
export function tape(frame: FoldFrame, from: Vec2, to: Vec2, width = TAPE_WIDTH): FoldFrame {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  if (length < 1e-6) throw new FoldError('A piece of tape needs two different ends.');
  const across: Vec2 = [(-(to[1] - from[1]) / length) * (width / 2), ((to[0] - from[0]) / length) * (width / 2)];
  const strip: Vec2[] = [
    [from[0] + across[0], from[1] + across[1]],
    [to[0] + across[0], to[1] + across[1]],
    [to[0] - across[0], to[1] - across[1]],
    [from[0] - across[0], from[1] - across[1]],
  ];
  const faces = toFlat(frame).sort((a, b) => b.layer - a.layer);
  const pieces = faces.flatMap((f, i) =>
    onFace({ side: 'front', points: strip, fill: true }, f.world)
      .filter((part) => showing(part, faces.slice(0, i)))
      .map((part): Mark => {
        const toSheet = unplaceLike(f);
        // Rounded as .fold files round coordinates, so the model and its file agree exactly.
        return { side: frontUp(f.world, f.paper) ? 'front' : 'back', points: part.map((p) => toSheet(p).map(roundCoord) as Vec2), fill: true };
      }),
  );
  if (!pieces.length) throw new FoldError('There’s no paper under that tape.');
  return { ...frame, faces_parent: undefined, tapes: [...(frame.tapes ?? []), { pieces }] };
}

/** Points across a piece of tape, to tell whether any of it is showing. */
const SAMPLES = 8;

/** Whether some of a piece (on the table) isn't covered by the faces above it, so the tape reaches its face. */
function showing(part: Vec2[], above: FlatFace[]): boolean {
  const xs = part.map((p) => p[0]);
  const zs = part.map((p) => p[1]);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  for (let i = 0; i < SAMPLES; i++) {
    for (let j = 0; j < SAMPLES; j++) {
      const p: Vec2 = [x0 + ((i + 0.5) / SAMPLES) * (x1 - x0), z0 + ((j + 0.5) / SAMPLES) * (z1 - z0)];
      if (inside(part, p) && !above.some((f) => inside(f.world, p))) return true;
    }
  }
  return false;
}

/** What stays in the paper from step to step until a fresh sheet: its scissor cuts and its tape. */
export function keepIn(after: FoldFrame, before: FoldFrame): FoldFrame {
  const cuts = !after.cuts && before.cuts?.length ? before.cuts : undefined;
  const tapes = !after.tapes && before.tapes?.length ? before.tapes : undefined;
  return cuts || tapes ? { ...after, ...(cuts && { cuts }), ...(tapes && { tapes }) } : after;
}
