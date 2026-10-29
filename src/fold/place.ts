import { fromFlat, FoldError, toFlat } from './fold';
import { overlapArea } from './geometry2d';
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
  /**
   * Slid in between layers, as a link's halves into another's sleeves: each part of the piece (`part`, a test
   * on faces' corners on the sheet) goes just under the paper `under` picks where it lands, above the rest
   * there. Parts of the piece not listed go on top (or underneath, with `under`).
   */
  into?: { part: (paper: Vec2[]) => boolean; under: (paper: Vec2[]) => boolean }[];
}

export function place(frame: FoldFrame, { only, to, angle = 0, flip = false, under = false, into = [] }: PlaceOptions): FoldFrame {
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
  // Turning it over reverses its stack. Then it goes above (or below) everything else.
  const inPiece = (layer: number) => (flip ? hi - layer : layer - lo);
  const placed = faces.map((f, i) => {
    if (!only(f.paper)) return { ...f, parent: i };
    const layer = under ? bottom - 1 - (hi - lo) + inPiece(f.layer) : top + 1 + inPiece(f.layer);
    return { ...f, world: f.world.map(move), layer, parent: i };
  });

  // Each part slid in: between the lowest of the `under` paper it lands beneath and the highest of the rest
  // below that, keeping its own stack's order.
  const still = placed.filter((f) => !only(f.paper));
  for (const { part, under: over } of into) {
    const parts = placed.filter((f) => only(f.paper) && part(f.paper));
    if (!parts.length) throw new FoldError('No part of the piece to slide in.');
    const beneath = still.filter((f) => parts.some((p) => overlapArea(p.world, f.world) > 1e-7));
    const above = beneath.filter((f) => over(f.paper)).map((f) => f.layer);
    if (!above.length) throw new FoldError('There’s no paper there for that part to slide under.');
    const ceiling = Math.min(...above);
    const floor = Math.max(bottom - 1, ...beneath.filter((f) => !over(f.paper) && f.layer < ceiling).map((f) => f.layer));
    const order = [...new Set(parts.map((p) => p.layer))].sort((a, b) => a - b);
    for (const p of parts) p.layer = floor + ((ceiling - floor) * (order.indexOf(p.layer) + 1)) / (order.length + 1);
  }
  return fromFlat(placed);
}
