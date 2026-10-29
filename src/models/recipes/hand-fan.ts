import { toFlat } from '../../fold/fold';
import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * A flat hand fan (an uchiwa), Gami's own, after the look of OrigamiOK's, from a square and a strip: the square's
 * corners folded behind into a round green paddle, and the strip folded lengthwise into a thin white handle, its
 * end folded back, slipped under the paddle.
 */
export function handFan() {
  const r = new Recipe({
    id: 'hand-fan',
    title: 'Hand fan',
    sheets: [
      { size: [1, 1], front: '#2f7d43', back: '#e9f0e3', origin: [0, 0], at: [-0.55, 0] },
      { size: [0.2, 0.8], front: '#e9e2d0', back: '#f6f3ec', origin: [10, 0], at: [0.4, 0] },
    ],
  });
  const paddle = ([u]: Vec2) => u < 5;
  const handle = ([u]: Vec2) => u > 5;

  // The paddle: each corner folded behind along a line `cut` in from it, both ways.
  const [px, pz] = r.where(paper(0, 0));
  const cut = 0.17;
  r.together({ title: 'Round the paddle', text: 'Green side up, fold all four corners of the square behind, a little way.' }, (q) => {
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      q.along(table(px + sx * (0.5 - cut), pz + sz * 0.5), table(px + sx * 0.5, pz + sz * (0.5 - cut)), table(px + sx * 0.5, pz + sz * 0.5), {
        title: '',
        kind: 'mountain',
        only: paddle,
      });
    }
  });

  // The handle: the strip `w` wide folded to the middle from both sides, then in half, then its end folded back.
  const w = 0.2;
  const [hx, hz] = r.where(paper(10, 0));
  r.together({ title: 'Fold the strip’s edges in', text: 'Fold the long edges of the strip to its middle.' }, (q) => {
    for (const s of [-1, 1]) q.along(table(hx + (s * w) / 4, hz - 1), table(hx + (s * w) / 4, hz + 1), table(hx + (s * w) / 2.2, hz), { title: '', only: handle });
  });
  r.along(table(hx, hz - 1), table(hx, hz + 1), table(hx - w / 8, hz), { title: 'Fold the strip in half', text: 'Fold it in half lengthwise: the handle.', only: handle });
  const end = hz + 0.4;
  r.along(table(hx - 1, end - 0.06), table(hx + 1, end - 0.06), table(hx, end - 0.01), {
    title: 'Fold the end back',
    text: 'Fold the bottom end of the handle back up, a little way.',
    kind: 'mountain',
    only: handle,
  });

  // Slip the handle's top under the paddle, a third of the way up it.
  const box = (only: (c: Vec2) => boolean) => {
    const pts = toFlat(r.current)
      .filter((f) => only(f.paper[0]))
      .flatMap((f) => f.world);
    const xs = pts.map((p) => p[0]);
    const zs = pts.map((p) => p[1]);
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, top: Math.min(...zs), bottom: Math.max(...zs) };
  };
  const p = box(paddle);
  const k = box(handle);
  r.move({ title: 'Add the handle', text: 'Slip the top of the handle under the paddle. Your fan is ready to cool you down.' }, handle, {
    to: table(p.x, p.bottom - 0.3 + (k.bottom - k.top) / 2),
    under: true,
  });
  return r.build();
}
