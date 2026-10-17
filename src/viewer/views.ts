/**
 * Camera presets, as angles around the model. The paper lies on the table in the XZ plane with +Y up.
 * Azimuth 0 looks from +Z (the front); polar 0 looks straight down from above.
 */

export type View = 'free' | 'top' | 'front' | 'side';

export const VIEWS: { id: View; label: string }[] = [
  { id: 'free', label: 'Free' },
  { id: 'top', label: 'Top' },
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' },
];

export interface Angles {
  azimuth: number;
  polar: number;
}

/** Where each preset puts the camera. "Free" is the three-quarter view a model starts in. */
export const VIEW_ANGLES: Record<View, Angles> = {
  free: { azimuth: Math.PI / 6, polar: Math.PI / 3.6 },
  top: { azimuth: 0, polar: 0 },
  front: { azimuth: 0, polar: Math.PI / 2 },
  side: { azimuth: Math.PI / 2, polar: Math.PI / 2 },
};

const EPS = 1e-3;

/** The camera angles that look at the model from `dir` (any length). */
export function anglesFrom([x, y, z]: readonly [number, number, number]): Angles {
  const len = Math.hypot(x, y, z) || 1;
  const polar = Math.acos(Math.min(1, Math.max(-1, y / len)));
  // Straight above or below, azimuth is meaningless: keep the paper's front edge at the bottom of the screen.
  const azimuth = Math.hypot(x, z) < EPS * len ? 0 : Math.atan2(x, z);
  return { azimuth, polar };
}

/** The preset a direction matches exactly, or "free". */
export function viewFor(dir: readonly [number, number, number]): View {
  const a = anglesFrom(dir);
  for (const v of ['top', 'front', 'side'] as const) if (sameAngles(a, VIEW_ANGLES[v])) return v;
  return 'free';
}

export function sameAngles(a: Angles, b: Angles, tolerance = 0.01): boolean {
  // At the poles azimuth doesn't change the view, so only polar matters there.
  if (a.polar < tolerance && b.polar < tolerance) return true;
  return Math.abs(a.polar - b.polar) < tolerance && Math.abs(wrap(a.azimuth - b.azimuth)) < tolerance;
}

/** The angle equal to `target` (mod 2π) closest to `current`, so the camera turns the short way round. */
export function nearestAngle(current: number, target: number): number {
  return current + wrap(target - current);
}

/** Wraps an angle into [-π, π). */
export function wrap(angle: number): number {
  const t = (angle + Math.PI) % (2 * Math.PI);
  return (t < 0 ? t + 2 * Math.PI : t) - Math.PI;
}
