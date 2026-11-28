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

/**
 * The viewer's camera: its field of view (degrees, top to bottom), its nearest near plane and its far plane, and how
 * close to and far from what it looks at it can be zoomed.
 */
export const CAMERA = { fov: 35, near: 0.01, far: 100, minDistance: 0.3, maxDistance: 8 };

/**
 * The near plane for the camera `distance` from what it looks at: a fiftieth of the way there, or `CAMERA.near`
 * when close. The depth buffer's steps grow with the square of the distance over the near plane, so with the near
 * plane fixed at 0.01, zoomed right out a step was more than half the gap between stacked layers, too coarse to keep
 * the paper underneath behind the paper on top (November 2026). Following the camera out, the step grows only as
 * fast as the distance does: 16 times finer, zoomed right out (see viewer/depth.ts). Zoomed in to
 * half a sheet away or closer, the near plane is where it always was; zoomed right out, paper within a sixth of a
 * sheet of the camera is out of sight, which only a model reaching 7.8 sheets from its middle could be.
 */
export function nearFor(distance: number): number {
  return Math.max(CAMERA.near, distance / 50);
}

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
