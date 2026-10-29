import { guidesFor } from './guides';
import { flat, fromAbove, marksAt } from './thumbnail';
import type { OrigamiModel, Vec2, Vec3 } from './types';

/**
 * One step drawn the way a paper diagram draws it, to learn to read those: the paper before the step seen from
 * above, its fold lines in the Yoshizawa–Randlett style (valley dashed, mountain dash-dot-dotted) and curved
 * arrows showing where the paper goes: a filled head for a valley fold, a hollow half head for a mountain fold
 * and a hollow head for opening the paper out. Null when the paper isn't lying flat to draw from above.
 *
 * `k` is the step, from 1.
 */
export function stepDiagramSvg(model: OrigamiModel, k: number): string | null {
  const step = model.steps[k - 1];
  if (!step) return null;
  const before = k > 1 ? model.steps[k - 2].frame : model.start;
  // A fresh sheet: just the sheet, as there's nothing to fold yet.
  if (step.op?.op === 'newSheet') return flat(step.frame) ? svg(fromAbove(model, step.frame), '', []) : null;
  if (!flat(before)) return null;
  const drawn = fromAbove(model, before, marksAt(model, k - 1));
  const guides = guidesFor(before, step.frame, step.via);
  const span = drawn.box[2];
  const width = span / 90;
  const at = (p: Vec2) => p.map((n) => +n.toFixed(4)).join(',');
  const top = ([x, , z]: Vec3): Vec2 => [x, z];

  const lines = guides.creases
    .map((c) => {
      const dash = (c.valley ? [4, 2.5] : [5, 1.6, 0.9, 1.6, 0.9, 1.6]).map((n) => +(n * width).toFixed(5)).join(' ');
      return `<path d="M${at(top(c.a))}L${at(top(c.b))}" stroke-dasharray="${dash}"/>`;
    })
    .join('');

  // The paper's middle, for curving arrows away from it.
  const [bx, by, bw] = drawn.box;
  const middle: Vec2 = [bx + bw / 2, by + bw / 2];
  const reach: Vec2[] = [];
  const arrows = guides.arrows
    .map((a) => {
      const from = top(a.from);
      const to = top(a.to);
      const d: Vec2 = [to[0] - from[0], to[1] - from[1]];
      const len = Math.hypot(...d);
      if (len < span * 0.04) return '';
      const mid: Vec2 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
      // Bowed out to one side, as diagram arrows are: the side away from the paper's middle.
      let n: Vec2 = [-d[1] / len, d[0] / len];
      if ((mid[0] - middle[0]) * n[0] + (mid[1] - middle[1]) * n[1] < 0) n = [-n[0], -n[1]];
      const bow = 0.3 * len;
      const control: Vec2 = [mid[0] + 2 * bow * n[0], mid[1] + 2 * bow * n[1]];
      reach.push(from, to, [mid[0] + bow * n[0], mid[1] + bow * n[1]]);
      // Its head, along the curve where it arrives.
      const t: Vec2 = [to[0] - control[0], to[1] - control[1]];
      const tl = Math.hypot(...t);
      const u: Vec2 = [t[0] / tl, t[1] / tl];
      const h = Math.min(span * 0.06, len * 0.35);
      const back: Vec2 = [to[0] - u[0] * h, to[1] - u[1] * h];
      const side: Vec2 = [-u[1] * h * 0.5, u[0] * h * 0.5];
      const left: Vec2 = [back[0] + side[0], back[1] + side[1]];
      const right: Vec2 = [back[0] - side[0], back[1] - side[1]];
      const curve = `<path d="M${at(from)}Q${at(control)} ${at(back)}" fill="none"/>`;
      if (step.kind === 'unfold') return `${curve}<path d="M${at(to)}L${at(left)}L${at(right)}Z" fill="#fff"/>`;
      // Under the table halfway: a mountain fold, the paper going behind.
      if (a.via[1] < -1e-6) return `${curve}<path d="M${at(to)}L${at(left)}L${at(back)}Z" fill="#fff"/>`;
      return `${curve}<path d="M${at(to)}L${at(left)}L${at(right)}Z" fill="${INK}"/>`;
    })
    .join('');

  return svg(drawn, `<g fill="none" stroke="${INK}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${lines}${arrows}</g>`, reach);
}

/** Lines and arrows: the dark grey a printed diagram uses. */
const INK = '#2b2a33';

/** The drawing in a square box round the paper and any arrows reaching past it. */
function svg({ box, body }: { box: number[]; body: string }, over: string, reach: Vec2[]): string {
  const [x, y, w] = box;
  const pad = w * 0.04;
  const xs = [x, x + w, ...reach.map((p) => p[0] - pad), ...reach.map((p) => p[0] + pad)];
  const ys = [y, y + w, ...reach.map((p) => p[1] - pad), ...reach.map((p) => p[1] + pad)];
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const view = [(Math.min(...xs) + Math.max(...xs)) / 2 - span / 2, (Math.min(...ys) + Math.max(...ys)) / 2 - span / 2, span, span].map((n) => +n.toFixed(4));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view.join(' ')}">${body}${over}</svg>`;
}
