import { describe, expect, it } from 'vitest';
import { basics } from '../models/basics';
import { RECIPES } from '../models/recipes';
import { framesOf } from './frames';
import { guidesFor } from './guides';

const frames = framesOf(basics);

describe('fold guides', () => {
  it('marks the diagonal as a valley fold, with an arrow from corner to corner', () => {
    const g = guidesFor(frames[0], frames[1]);
    expect(g.creases).toHaveLength(1);
    const { a, b, valley } = g.creases[0];
    expect(valley).toBe(true);
    // The diagonal from BL (−½, ½) to TR (½, −½).
    expect(Math.abs(a[0] + a[2])).toBeLessThan(1e-9);
    expect(Math.abs(b[0] + b[2])).toBeLessThan(1e-9);
    expect(g.arrows).toHaveLength(1);
    const arrow = g.arrows[0];
    expect(arrow.from[0]).toBeCloseTo(-0.5);
    expect(arrow.to[0]).toBeCloseTo(0.5);
    // Halfway, the corner is up in the air.
    expect(arrow.via[1]).toBeGreaterThan(0.3);
  });

  it('shows an arrow but no crease for turning over', () => {
    const g = guidesFor(frames[2], frames[3]);
    expect(g.creases).toHaveLength(0);
    expect(g.arrows).toHaveLength(1);
  });

  it('works out guides for every step of every model', () => {
    for (const make of RECIPES) {
      const model = make();
      const fs = framesOf(model);
      for (let k = 1; k < fs.length; k++) {
        // Starting again on a fresh sheet (fewer faces than before) moves nothing, so has nothing to show.
        if (fs[k].faces_vertices.length < fs[k - 1].faces_vertices.length) continue;
        const g = guidesFor(fs[k - 1], fs[k]);
        expect(g.arrows.length + g.creases.length, `${model.id} step ${k}`).toBeGreaterThan(0);
      }
    }
    // Every step of every model is animated here, which takes a few seconds.
  }, 30_000);
});
