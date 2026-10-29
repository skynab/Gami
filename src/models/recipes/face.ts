import type { Vec2 } from '../../fold/types';

/** What a drawn face has: closed (smiling) or open eyes, and whether it gets a nose and whiskers. */
export interface FaceStyle {
  eyes: 'closed' | 'open';
  nose?: boolean;
  whiskers?: boolean;
  /** How far down the face the eyes are, and how far apart, as shares of its length. */
  eyesAt?: number;
  eyeGap?: number;
  /** How far down the face the nose is, as a share of its length. */
  noseAt?: number;
}

/**
 * A face to draw on a model, laid out along the line from the top of its head to its chin (points on the
 * table), as marks for `Recipe.draw`. Everything scales with the face: eyes a little above the middle, a
 * small nose pointing down near the chin, whiskers out to either side of it. Each mark starts off the face's
 * middle line, on the paper it's drawn on.
 */
export function faceMarks(top: Vec2, chin: Vec2, style: FaceStyle): ({ line: Vec2[] } | { fill: Vec2[] })[] {
  const length = Math.hypot(chin[0] - top[0], chin[1] - top[1]);
  // Down the face, and across it to its right (the viewer's right, seen from above).
  const down: Vec2 = [(chin[0] - top[0]) / length, (chin[1] - top[1]) / length];
  const right: Vec2 = [down[1], -down[0]];
  const at = (along: number, across: number): Vec2 => [
    top[0] + down[0] * along * length + right[0] * across * length,
    top[1] + down[1] * along * length + right[1] * across * length,
  ];
  const { eyesAt = 0.42, eyeGap = 0.22, noseAt = 0.8 } = style;
  const marks: ({ line: Vec2[] } | { fill: Vec2[] })[] = [];
  for (const side of [-1, 1]) {
    const across = side * eyeGap;
    if (style.eyes === 'closed') {
      // A little arch, its ends lower than its middle: a smiling, shut eye.
      marks.push({ line: [-1, -0.5, 0, 0.5, 1].map((t) => at(eyesAt - 0.055 * (1 - t * t), across + 0.085 * t)) });
    } else {
      marks.push({ fill: Array.from({ length: 10 }, (_, i) => at(eyesAt + 0.035 * Math.sin((i / 10) * 2 * Math.PI), across - 0.035 * Math.cos((i / 10) * 2 * Math.PI))) });
    }
  }
  // In two halves, one each side of the middle line, which is often a crease between two pieces of paper.
  if (style.nose) marks.push({ fill: [at(noseAt, -0.07), at(noseAt, 0), at(noseAt + 0.08, 0)] }, { fill: [at(noseAt, 0.07), at(noseAt + 0.08, 0), at(noseAt, 0)] });
  if (style.whiskers) {
    for (const side of [-1, 1]) {
      for (const tilt of [-0.06, 0.06]) marks.push({ line: [at(noseAt + 0.03, side * 0.12), at(noseAt + 0.03 + tilt, side * 0.45)] });
    }
  }
  return marks;
}

/**
 * A line split where it crosses x = `mid` (the line where two flaps meet, say), each piece starting just off it,
 * on its own side, so each is drawn on the paper it lies on.
 */
export function halves(line: Vec2[], mid: number): Vec2[][] {
  const gap = 1e-3;
  const side = (p: Vec2) => (p[0] < mid ? -1 : 1);
  const pieces: Vec2[][] = [[line[0]]];
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1], line[i]];
    if (side(a) !== side(b)) {
      const t = (mid - a[0]) / (b[0] - a[0]);
      const z = a[1] + t * (b[1] - a[1]);
      pieces.at(-1)!.push([mid + side(a) * gap, z]);
      pieces.push([[mid + side(b) * gap, z]]);
    }
    pieces.at(-1)!.push(b);
  }
  return pieces.filter((p) => p.length > 1);
}
