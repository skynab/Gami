import { paper, Recipe, table } from '../../fold/recipe';
import type { Ray } from '../../fold/shape';

/**
 * A pyramid, Gami's own, popped up from a creased square as the fortune teller opens, but point up: the diagonals
 * slope down from the middle to the corners as ridges, and each side's spare paper tucks inside along its middle
 * crease, so the sides stay flat. No glue.
 */
export function pyramid() {
  const r = creased(new Recipe({ id: 'pyramid', title: 'Pyramid', card: 'finished', sheet: { size: [1, 1], front: '#e3b341', back: '#c98a1d' } }));
  return r
    .popUp(
      {
        title: 'Pop it up',
        text: 'Push the middle up from underneath and let the corners drop, pinching each diagonal into a ridge and pushing each side’s middle crease inside. Your pyramid stands on its four corners.',
      },
      paper(0, 0),
      pyramidRays(SLOPE),
      [1, 2, 3, 4, 5].map((k) => pyramidRays((SLOPE * k) / 6, SLOPE)),
    )
    .build();
}

/**
 * How steeply the ridges slope, so that each side spans half a corner of the square: the sides' creases are then
 * halfway between a diagonal and the middle crease, easy to fold. Adjacent ridges meet at 45° when sin² = cos 45°.
 */
export const SLOPE = Math.asin(Math.sqrt(Math.SQRT1_2));

/**
 * A square creased for the pyramid's pop: folded in half four times through its middle, each fold halving the
 * wedge left, then opened out, leaving sixteen creases from the middle (diagonals, middles and halfway between).
 */
export function creased(r: Recipe): Recipe {
  const start = r.mark();
  // Each fold runs through the middle at `deg` (from +x towards +z), moving the side `towards` is on.
  const half = (deg: number, towards: [number, number], step: { title: string; text: string }) => {
    const a = (deg * Math.PI) / 180;
    return r.along(table(-Math.cos(a), -Math.sin(a)), table(Math.cos(a), Math.sin(a)), table(...towards), step);
  };
  half(45, [-0.4, 0.4], { title: 'Fold in half diagonally', text: 'Fold the square in half corner to corner.' });
  half(135, [-0.3, -0.35], { title: 'Fold in half again', text: 'Fold the triangle in half, point to point.' });
  half(0, [0.3, -0.2], { title: 'And again', text: 'Fold it in half once more, lining up the edges by the point.' });
  half(22.5, [0.4, 0.05], { title: 'And once more', text: 'And once more: a thin wedge, many layers thick. Crease it hard.' });
  return r.unfold({ title: 'Open it out', text: 'Unfold it all: sixteen creases run out from the middle.', to: start });
}

type V = [number, number, number];
const unit = (v: V): V => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * The creases of a pyramid whose four ridges, the diagonals, slope down from the middle by `slope` (or up, point
 * down, when it's negative), on its way to `final`. The paper between two ridges is a quarter turn round the middle
 * but the finished side between them spans less: `side` of paper from each ridge lies on the side, and the rest,
 * either side of the middle crease, tucks in as a flap standing straight in from the side, hidden inside. On the
 * way, the side is wider, so the two creases where the flap starts open apart and the flap stands in less.
 */
export function pyramidRays(slope: number, final = slope): Ray[] {
  const ridge = (e: number, k: number): V => {
    const f = Math.PI / 4 + (k * Math.PI) / 2;
    return [Math.cos(e) * Math.cos(f), -Math.sin(e), Math.cos(e) * Math.sin(f)];
  };
  // How much paper lies on each finished side either side of its middle, and how much tucks in.
  const side = Math.acos(dot(ridge(final, 0), ridge(final, 1))) / 2;
  const tuck = Math.PI / 4 - side;
  const ray = (onPaper: number, v: V): Ray => ({ azimuth: onPaper, elevation: Math.atan2(v[1], Math.hypot(v[0], v[2])), heading: Math.atan2(v[2], v[0]) });
  // `side` round from a towards b, in the plane they span.
  const toward = (a: V, b: V): V => {
    const w = unit(b.map((c, i) => c - dot(a, b) * a[i]) as V);
    return a.map((c, i) => c * Math.cos(side) + w[i] * Math.sin(side)) as V;
  };
  return [0, 1, 2, 3].flatMap((k) => {
    const [a, b] = [ridge(slope, k), ridge(slope, k + 1)];
    const [p, q] = [toward(a, b), toward(b, a)];
    // The flap's crease: `tuck` from both, between them and in towards the middle.
    const mid = unit([p[0] + q[0], p[1] + q[1], p[2] + q[2]]);
    let inward = unit([a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]);
    // Inside is below the point when it's up, above it when it's down.
    if (Math.sign(inward[1]) === Math.sign(final)) inward = [-inward[0], -inward[1], -inward[2]];
    const lift = Math.acos(Math.min(1, Math.cos(tuck) / Math.sqrt((1 + dot(p, q)) / 2)));
    const flap = mid.map((c, i) => c * Math.cos(lift) + inward[i] * Math.sin(lift)) as V;
    const f = Math.PI / 4 + (k * Math.PI) / 2;
    return [ray(f, a), ray(f + side, p), ray(f + Math.PI / 4, flap), ray(f + Math.PI / 2 - side, q)];
  });
}
