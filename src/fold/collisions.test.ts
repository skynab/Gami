import { describe, expect, it } from 'vitest';
import { stepTransition } from './animate';
import { crossings } from './collisions';
import { crossDepth } from './cross3d';
import { fromFoldFile, toFoldFile } from './fold-format';
import { paper, Recipe } from './recipe';
import { RECIPES } from '../models/recipes';
import { toFlat } from './fold';
import { overlapArea } from './geometry2d';
import { locate } from './select';
import type { Vec2, Vec3 } from './types';

const square = (y: number): Vec3[] => [[-1, y, -1], [1, y, -1], [1, y, 1], [-1, y, 1]];
const deep = (model: Parameters<typeof crossings>[0]) => crossings(model).filter((c) => c.depth > 0.005);
const models = RECIPES.map((make) => make());
const byId = (id: string) => models.find((m) => m.id === id)!;
const centre = (poly: Vec2[]): Vec2 => [poly.reduce((a, p) => a + p[0], 0) / poly.length, poly.reduce((a, p) => a + p[1], 0) / poly.length];

describe('paper passing through paper', () => {
  it('measures how far one face pokes through another', () => {
    const upright: Vec3[] = [[0, -0.5, -0.5], [0, 0.5, -0.5], [0, 0.5, 0.5], [0, -0.5, 0.5]];
    expect(crossDepth(square(0), upright)).toBeCloseTo(0.5);
    expect(crossDepth(square(0), square(0.1))).toBe(0);
  });

  it('keeps the simple models clean', () => {
    for (const id of ['basics', 'paper-plane', 'cup', 'fortune-teller', 'sword']) expect(deep(byId(id)), id).toEqual([]);
  });

  it('turns stacked layers over together, the same way round', () => {
    const crane = byId('crane');
    const turns = crane.steps.flatMap((s, i) => (s.kind === 'turn-over' ? [i + 1] : []));
    expect(turns.length).toBeGreaterThan(0);
    expect(deep(crane).filter((c) => turns.includes(c.step))).toEqual([]);
  });

  it('folds behind by going under, not up through the paper', () => {
    // The helmet's last fold takes the back point up behind.
    const helmet = byId('samurai-helmet');
    expect(deep(helmet).filter((c) => c.step === helmet.steps.length)).toEqual([]);
  });

  it('tucks each point into the other unit’s pocket, weaving the two together', () => {
    const star = byId('ninja-star');
    const tucks = star.steps.flatMap((s, i) => (s.title.startsWith('Tuck') ? [i + 1] : []));
    expect(tucks).toHaveLength(4);
    expect(deep(star)).toEqual([]);
    // Each tucked point has the other unit's paper both over it and under it: in a pocket, not underneath.
    const yellow = ([u]: Vec2) => u < 5;
    for (const k of tucks) {
      const after = toFlat(star.steps[k - 1].frame);
      const moved = after.filter((f) => {
        const was = locate(star.steps[k - 2].frame, centre(f.paper));
        const now = centre(f.world);
        return Math.hypot(was[0] - now[0], was[1] - now[1]) > 1e-6;
      });
      expect(moved.length, `step ${k}`).toBeGreaterThan(0);
      const unit = yellow(centre(moved[0].paper));
      const sandwiched = moved.some((f) => {
        const others = after.filter((g) => yellow(centre(g.paper)) !== unit && overlapArea(g.world, f.world) > 1e-6);
        return others.some((g) => g.layer > f.layer) && others.some((g) => g.layer < f.layer);
      });
      expect(sandwiched, `step ${k}`).toBe(true);
    }
  });

  it('folds thick stacks, petal folds and reverse folds without passing through', () => {
    // Stacks ease off their creases, hinged layers settle into place as they turn, and creases nearer the
    // still paper can fold first.
    for (const id of ['heart', 'jumping-frog', 'tulip', 'crane']) expect(deep(byId(id)), id).toEqual([]);
  });

  it('folds each plane’s wings down without passing through the body', () => {
    // A wing is all the paper on its side of the centre crease, including any an earlier fold took across the
    // middle (the navy plane's sides), so it doesn't fold down through paper left behind.
    for (const id of ['paper-plane', 'glider', 'bulldog-dart', 'navy-plane', 'king-bee']) {
      const model = byId(id);
      const wings = model.steps.flatMap((s, i) => (s.title === 'Fold the wing down' || s.title === 'Fold the other wing to match' ? [i + 1] : []));
      expect(wings, id).toHaveLength(2);
      expect(deep(model).filter((c) => wings.includes(c.step)), id).toEqual([]);
    }
  });

  it('stands a flap up before squashing it', () => {
    // The fox's squash and the lily's squash-and-petal folds play in stages: the flap lifts about its hinge
    // first, then each part goes to its place.
    const fox = byId('fox');
    expect(deep(fox)).toEqual([]);
    expect(stepTransition(fox, 12).path).toBeDefined();
    const lily = byId('lily');
    const squashes = lily.steps.flatMap((s, i) => (s.kind === 'petal' ? [i + 1] : []));
    expect(squashes).toHaveLength(4);
    expect(deep(lily).filter((c) => c.step === squashes[0])).toEqual([]);
  });

  it('opens the lily’s petals clear of the narrowing folds', () => {
    // The tips open on a line well past the slivers the narrowing caught, top one furthest, curled in many
    // small bends; layers bend at their own heights, so the petals only graze the stack by about a layer.
    const lily = byId('lily');
    const last = lily.steps.length;
    expect(lily.steps[last - 1].kind).toBe('pose');
    const opening = crossings(lily).filter((c) => c.step === last);
    expect(Math.max(0, ...opening.map((c) => c.depth))).toBeLessThan(0.002);
    // And nothing in the whole lily goes deeper than a few layers.
    expect(deep(lily)).toEqual([]);
  });

  it('unfolds several folds one at a time, and keeps that in .fold files', () => {
    const r = new Recipe({ id: 'kite', title: 'Kite', sheet: { size: [1, 1], front: '#fff', back: '#000' } });
    const before = r.mark();
    r.onto(paper(-0.5, -0.5), paper(0.5, 0.5), { title: 'Diagonal' })
      .onto(paper(0.5, -0.5), paper(0, 0), { title: 'Corner in' })
      .unfold({ to: before });
    const model = r.build();
    const unfold = model.steps.at(-1)!;
    expect(unfold.via).toHaveLength(1);
    expect(deep(model)).toEqual([]);
    expect(fromFoldFile(toFoldFile(model)).steps.at(-1)!.via).toHaveLength(1);
  });
});
