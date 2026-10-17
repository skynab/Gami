import { fromFlat, FoldError, toFlat } from './fold';
import type { FoldFrame, Vec2 } from './types';

/**
 * Picking up one piece of a multi-sheet model and putting it down somewhere else: optionally turned over
 * (left to right) and turned on the table, with its middle at `to`, on top of everything or underneath.
 * Used to assemble modular models like the ninja star.
 */
export interface PlaceOptions {
  /** Which faces to move, as a test on their corners on the sheet (usually: this sheet). */
  only: (paper: Vec2[]) => boolean;
  /** Where the middle of the piece goes. Leave out to keep it where it is. */
  to?: Vec2;
  /** Turn on the table, anticlockwise seen from above, in radians. */
  angle?: number;
  /** Turn it over from left to right first. */
  flip?: boolean;
  /** Put it down underneath everything else instead of on top. */
  under?: boolean;
}

export function place(frame: FoldFrame, { only, to, angle = 0, flip = false, under = false }: PlaceOptions): FoldFrame {
  const faces = toFlat(frame);
  const moving = faces.filter((f) => only(f.paper));
  if (!moving.length) throw new FoldError('Nothing to move.');

  const pts = moving.flatMap((f) => f.world);
  const cx = (Math.min(...pts.map((p) => p[0])) + Math.max(...pts.map((p) => p[0]))) / 2;
  const cz = (Math.min(...pts.map((p) => p[1])) + Math.max(...pts.map((p) => p[1]))) / 2;
  const [tx, tz] = to ?? [cx, cz];
  // Seen from above, +x is right and +z towards you, so anticlockwise turns x towards −z (as in `rotate`).
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const move = ([x, z]: Vec2): Vec2 => {
    const dx = (flip ? -1 : 1) * (x - cx);
    const dz = z - cz;
    return [tx + c * dx + s * dz, tz - s * dx + c * dz];
  };

  const top = Math.max(...faces.map((f) => f.layer));
  const bottom = Math.min(...faces.map((f) => f.layer));
  const lo = Math.min(...moving.map((f) => f.layer));
  const hi = Math.max(...moving.map((f) => f.layer));
  return fromFlat(
    faces.map((f, i) => {
      if (!only(f.paper)) return { ...f, parent: i };
      // Turning it over reverses its stack. Then it goes above (or below) everything else.
      const inPiece = flip ? hi - f.layer : f.layer - lo;
      const layer = under ? bottom - 1 - (hi - lo) + inPiece : top + 1 + inPiece;
      return { ...f, world: f.world.map(move), layer, parent: i };
    }),
  );
}
