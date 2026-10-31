import { placeLike, toFlat } from '../../fold/fold';
import { LAYER_GAP } from '../../fold/frames';
import { lerp, signedArea } from '../../fold/geometry2d';
import type { BendGoal } from '../../fold/ops';
import { paper, Recipe, table } from '../../fold/recipe';
import { inside } from '../../fold/select';
import type { FoldFrame, Vec2, Vec3 } from '../../fold/types';

/** A paper cup that holds water for a while. */
export function cup() {
  const cup = new Recipe({ id: 'cup', title: 'Cup', sheet: { size: [1, 1], front: '#2f9e8f', back: '#f6f3ec' } })
    .onto(paper(0.5, -0.5), paper(-0.5, 0.5), {
      title: 'Fold in half diagonally',
      text: 'Bring the top-right corner down to the bottom-left corner.',
    })
    .rotate(-135, { title: 'Turn it point up', text: 'Turn the triangle so the long folded edge is at the bottom.' });

  // The two bottom corners each fold to the opposite edge. Landing at (2 − √2) of the way up the edge
  // leaves the top of each flap level with the bottom.
  const right = cup.where(paper(-0.5, -0.5));
  const left = cup.where(paper(0.5, 0.5));
  const apex = cup.where(paper(-0.5, 0.5));
  const k = 2 - Math.SQRT2;
  const onLeft = lerp(left, apex, k);
  const onRight = lerp(right, apex, k);

  cup
    .onto(paper(-0.5, -0.5), table(...onLeft), {
      title: 'Fold the right corner across',
      text: 'Bring the right corner to the left edge, so the top of the flap is level.',
    })
    .onto(paper(0.5, 0.5), table(...onRight), {
      title: 'Fold the left corner across',
      text: 'Bring the left corner over to the right edge in the same way.',
    })
    .along(table(-1, onLeft[1]), table(1, onLeft[1]), table(apex[0], apex[1]), {
      title: 'Fold the front flap down',
      text: 'Fold the top layer of the point down over the front. You can tuck it into the pocket instead.',
      layers: 1,
    })
    .turnOver()
    .along(table(-1, onLeft[1]), table(1, onLeft[1]), table(apex[0], apex[1]), {
      title: 'Fold the other flap down',
      text: 'Fold the last point down to match.',
      layers: 1,
    });

  // Squeezed at its sides, the cup's walls bow apart into a mouth. Paper bends to do it, so the opening is worked
  // out beforehand (`openCup`) and the paper guided there (see docs/bending-plan.md).
  return cup
    .bend(
      { title: 'Open the cup', text: 'Squeeze the sides gently towards each other, so the cup opens, and stand it up. Done!' },
      { flex: () => true, anchor: [0, 0], goals: opening(cup.current), mesh: 0.07, stages: STAGES, free: true },
    )
    .build();
}

/** How far the cup's sides turn in at the rim as it opens, and the frames it opens through. */
const SQUEEZE = (8 * Math.PI) / 180;
const STAGES = 8;
/** Guide points on the sheet: a triangular lattice this far apart, kept this far inside each face. */
const SPACING = 0.05;
const MARGIN = 0.008;

/**
 * Guides taking the flat cup open, standing it up on its bottom crease as it goes: points spread over every face,
 * each with where it is at each stage. The mouth opens between the two faces that meet along the bottom crease; every
 * face goes with the wall on its side of them, as far out as its layer is.
 */
function opening(frame: FoldFrame): BendGoal[] {
  const faces = toFlat(frame);
  // On the table, the cup's bottom crease runs along x, its rim further away (towards −z).
  const corners = faces.flatMap((f) => f.world);
  const bottom = Math.max(...corners.map(([, z]) => z));
  const rim = Math.min(...corners.map(([, z]) => z));
  const halfWidth = (z: number) => Math.max(...corners.filter((q) => Math.abs(q[1] - z) < 1e-9).map(([x]) => Math.abs(x)));
  // The mouth opens as the square root of the squeeze, so the squeeze grows as the square of the stage: the mouth
  // opens evenly, rather than a third of the way in the first stage.
  const open = (k: number) => openCup({ bottom: halfWidth(bottom), rim: halfWidth(rim), height: bottom - rim }, SQUEEZE * (k / STAGES) ** 2);
  const stages = Array.from({ length: STAGES }, (_, k) => open(k + 1));
  const walls = faces.filter((f) => inside(f.world, [0, bottom]));
  const pocket = walls.reduce((sum, f) => sum + f.layer, 0) / walls.length;
  const round6 = (x: number) => Math.round(x * 1e6) / 1e6 || 0;

  return faces.flatMap((f) => {
    const side = f.layer < pocket ? -1 : 1;
    const out = (f.layer - pocket) * LAYER_GAP;
    const place = placeLike(f);
    return lattice(f.paper).map((q): BendGoal => {
      const [x, z] = place(q);
      const path = stages.map((shape, k): Vec3 => {
        const [across, depth, up] = shape(x, bottom - z);
        // Stood up about the bottom crease, a share more each stage, so the rim rises.
        const turn = ((Math.PI / 2) * (k + 1)) / STAGES;
        const [dy, dz] = [side * depth + out, -up];
        return [across, pocket * LAYER_GAP + dy * Math.cos(turn) - dz * Math.sin(turn), bottom + dy * Math.sin(turn) + dz * Math.cos(turn)].map(round6) as Vec3;
      });
      return { guide: { paper: q.map(round6) as Vec2 }, path };
    });
  });
}

/** Points of a triangular lattice on the sheet inside a convex face, all at least `MARGIN` in from its edges. */
function lattice(poly: Vec2[]): Vec2[] {
  const turn = Math.sign(signedArea(poly));
  const within = (q: Vec2) =>
    poly.every((a, i) => {
      const b = poly[(i + 1) % poly.length];
      return (turn * ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]))) / Math.hypot(b[0] - a[0], b[1] - a[1]) >= MARGIN;
    });
  const us = poly.map((q) => q[0]);
  const vs = poly.map((q) => q[1]);
  const row = SPACING * (Math.sqrt(3) / 2);
  const out: Vec2[] = [];
  for (let j = Math.floor(Math.min(...vs) / row); j <= Math.ceil(Math.max(...vs) / row); j++) {
    for (let i = Math.floor(Math.min(...us) / SPACING) - 1; i <= Math.ceil(Math.max(...us) / SPACING); i++) {
      const q: Vec2 = [(i + (Math.abs(j) % 2) / 2) * SPACING, j * row];
      if (within(q)) out.push(q);
    }
  }
  return out;
}

/**
 * The cup opened by `squeeze`: where a point of one wall goes, given as it lies flat, `x` across the cup from its
 * middle and `v` up from the bottom crease, as [across, depth out from the middle, height up]. It keeps the paper's
 * lengths: each horizontal line of the wall stays as long, bowed into a parabola between the sides; each side stays as
 * long, drawn in by a pinch growing as the square of the height (none at the bottom crease, which stays closed); and
 * the line up the middle stays as long, its depth and how far the middle of the rim dips below the corners shared to
 * do so. Elsewhere it's near enough for the paper to settle.
 */
function openCup({ bottom, rim, height }: { bottom: number; rim: number; height: number }, squeeze: number): (x: number, v: number) => Vec3 {
  const n = 400;
  const dv = height / n;
  const flare = rim - bottom;
  const side = Math.hypot(flare, height);
  // How far in the side is drawn at the rim: as far as turning it in by `squeeze` about the bottom corner would.
  const pinch = flare * (1 - Math.cos(squeeze)) + height * Math.sin(squeeze);
  // Half the length of the parabola y = a(1 − x²/X²) over −X..X, from 0 to ξ.
  const arc = (xi: number, a: number, X: number) => {
    const c = (2 * a) / (X * X);
    return c < 1e-12 ? xi : 0.5 * (xi * Math.sqrt(1 + c * c * xi * xi) + Math.asinh(c * xi) / c);
  };
  const solve = (f: (x: number) => number, target: number, hi: number) => {
    let lo = 0;
    for (let i = 0; i < 60; i++) [lo, hi] = f((lo + hi) / 2) < target ? [(lo + hi) / 2, hi] : [lo, (lo + hi) / 2];
    return (lo + hi) / 2;
  };
  // Each height's half width as it lay, the side's place now, and the sagitta keeping the half width's length.
  const sideUp: number[] = [0];
  for (let i = 1; i <= n; i++) {
    const across = flare - 2 * pinch * ((i - 0.5) / n);
    sideUp.push(sideUp[i - 1] + Math.sqrt(Math.max(0, side * side - across * across)) / n);
  }
  const row = (i: number) => {
    const s = i / n;
    const w = bottom + s * flare;
    const X = w - pinch * s * s;
    return { w, X, up: sideUp[i], sag: X >= w - 1e-12 ? 0 : solve((a) => arc(X, a, X), w, 4 * w) };
  };
  // The middle line, at unit speed up the paper, its depth and dip kept on each height's parabola.
  const rows: (ReturnType<typeof row> & { depth: number; dip: number })[] = [];
  let [depth, middle] = [0, 0];
  for (let i = 0; i <= n; i++) {
    const r = row(i);
    const th = Math.hypot(depth, r.up - middle) < 1e-12 ? 0 : Math.atan2(r.up - middle, depth);
    [depth, middle] = [r.sag * Math.cos(th), r.up - r.sag * Math.sin(th)];
    rows.push({ ...r, depth, dip: r.up - middle });
    if (i === n) break;
    const next = row(i + 1);
    const psi = th + Math.asin(Math.max(-1, Math.min(1, (next.sag - r.sag) / dv - Math.sin(th) * ((next.up - r.up) / dv))));
    [depth, middle] = [depth + Math.sin(psi) * dv, middle + Math.cos(psi) * dv];
  }
  return (x, v) => {
    const i = Math.min(n - 1, Math.max(0, Math.floor(v / dv)));
    const t = Math.min(1, Math.max(0, v / dv - i));
    const [a, b] = [rows[i], rows[i + 1]];
    const at = (key: 'w' | 'X' | 'up' | 'sag' | 'depth' | 'dip') => a[key] + (b[key] - a[key]) * t;
    const [w, X, sag] = [at('w'), at('X'), at('sag')];
    const xi = Math.sign(x) * solve((u) => arc(u, sag, X), Math.min(Math.abs(x), w), X);
    const g = 1 - (xi * xi) / (X * X);
    return [xi, at('depth') * g, at('up') - at('dip') * g];
  };
}
