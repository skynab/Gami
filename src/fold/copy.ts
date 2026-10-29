import { fromFlat, FoldError, toFlat, type FlatFace } from './fold';
import { centre, inside } from './select';
import { sheetOf } from './sheets';
import type { FoldFrame, Sheet, Vec2 } from './types';

/**
 * Folding more units like one already made: each sheet in `to` becomes a copy of sheet `from` as it is now,
 * folded the same way, with its middle where that sheet lay (or at the matching point of `at`), on top of the
 * paper there. Each copy is its own sheet, in its own colours. The sheets copied onto must be the same size as
 * the one copied, and are usually still unfolded, waiting in a pile.
 */
export function copyUnit(frame: FoldFrame, sheets: Sheet[], from: number, to: number[], at?: Vec2[]): FoldFrame {
  const faces = toFlat(frame);
  const sheet = (f: FlatFace) => sheetOf(sheets, f.paper);
  const unit = faces.filter((f) => sheet(f) === from);
  if (!unit.length) throw new FoldError(`Sheet ${from} isn’t there to copy.`);
  if (at && at.length !== to.length) throw new FoldError('Each copy needs its own place.');
  const middle = (fs: FlatFace[]): Vec2 => {
    const pts = fs.flatMap((f) => f.world);
    const xs = pts.map((p) => p[0]);
    const zs = pts.map((p) => p[1]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
  };
  const [cx, cz] = middle(unit);
  const [ou, ov] = sheets[from].origin ?? [0, 0];
  const low = Math.min(...unit.map((f) => f.layer));
  const span = Math.max(...unit.map((f) => f.layer)) - low + 1;
  let top = Math.max(...faces.map((f) => f.layer));

  const out: FlatFace[] = faces.flatMap((f, i) => (to.includes(sheet(f)) ? [] : [{ ...f, parent: i }]));
  to.forEach((t, k) => {
    if (t === from) throw new FoldError('A sheet can’t be copied onto itself.');
    const target = sheets[t];
    if (!target) throw new FoldError(`There’s no sheet ${t} to copy onto.`);
    const [w, h] = sheets[from].size;
    if (Math.abs(target.size[0] - w) > 1e-9 || Math.abs(target.size[1] - h) > 1e-9) throw new FoldError('Copies must be folded from sheets the same size.');
    const old = faces.map((f, i) => [f, i] as const).filter(([f]) => sheet(f) === t);
    if (!old.length) throw new FoldError(`Sheet ${t} isn’t there to fold.`);
    const [tx, tz] = at?.[k] ?? middle(old.map(([f]) => f));
    const [tu, tv] = target.origin ?? [0, 0];
    for (const f of unit) {
      const paper = f.paper.map(([u, v]): Vec2 => [u - ou + tu, v - ov + tv]);
      const c = centre(paper);
      // Grown from whichever of the old sheet's faces holds this bit of paper.
      const parent = old.find(([g]) => inside(g.paper, c))?.[1] ?? old[0][1];
      out.push({ paper, world: f.world.map(([x, z]): Vec2 => [x - cx + tx, z - cz + tz]), layer: top + 1 + f.layer - low, parent });
    }
    top += span;
  });
  return fromFlat(out);
}
