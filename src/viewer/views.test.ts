import { describe, expect, it } from 'vitest';
import { anglesFrom, nearestAngle, sameAngles, VIEW_ANGLES, viewFor, wrap } from './views';

describe('views', () => {
  it('maps the view cube faces to presets', () => {
    expect(viewFor([0, 1, 0])).toBe('top');
    expect(viewFor([0, 0, 1])).toBe('front');
    expect(viewFor([1, 0, 0])).toBe('side');
    expect(viewFor([0, 0, -1])).toBe('free');
    expect(viewFor([1, 1, 1])).toBe('free');
  });

  it('turns directions into camera angles', () => {
    const corner = anglesFrom([1, 1, 1]);
    expect(corner.azimuth).toBeCloseTo(Math.PI / 4);
    expect(corner.polar).toBeCloseTo(Math.acos(1 / Math.sqrt(3)));
    expect(anglesFrom([0, -2, 0])).toEqual({ azimuth: 0, polar: Math.PI });
  });

  it('ignores azimuth when looking straight down', () => {
    expect(sameAngles({ azimuth: 2, polar: 0 }, VIEW_ANGLES.top)).toBe(true);
    expect(sameAngles({ azimuth: 2, polar: Math.PI / 2 }, VIEW_ANGLES.front)).toBe(false);
  });

  it('turns the short way round', () => {
    expect(wrap(3 * Math.PI)).toBeCloseTo(-Math.PI);
    expect(nearestAngle(6, 0)).toBeCloseTo(2 * Math.PI);
    expect(nearestAngle(-6, Math.PI / 2)).toBeCloseTo(Math.PI / 2 - 2 * Math.PI);
    expect(nearestAngle(1, 1.5)).toBeCloseTo(1.5);
  });
});
