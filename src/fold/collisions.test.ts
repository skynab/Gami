import { describe, expect, it } from 'vitest';
import { stepTransition } from './animate';
import { crossings } from './collisions';
import { crossDepth } from './cross3d';
import { fromFoldFile, toFoldFile } from './fold-format';
import { paper, Recipe } from './recipe';
import { RECIPES } from '../models/recipes';
import type { Vec3 } from './types';

const square = (y: number): Vec3[] => [[-1, y, -1], [1, y, -1], [1, y, 1], [-1, y, 1]];
const deep = (model: Parameters<typeof crossings>[0]) => crossings(model).filter((c) => c.depth > 0.005);
const models = RECIPES.map((make) => make());
const byId = (id: string) => models.find((m) => m.id === id)!;

describe('paper passing through paper', () => {
  it('measures how far one face pokes through another', () => {
    const upright: Vec3[] = [[0, -0.5, -0.5], [0, 0.5, -0.5], [0, 0.5, 0.5], [0, -0.5, 0.5]];
    expect(crossDepth(square(0), upright)).toBeCloseTo(0.5);
    expect(crossDepth(square(0), square(0.1))).toBe(0);
  });

  it('keeps the simple models clean', () => {
    for (const id of ['basics', 'paper-plane', 'cup', 'fortune-teller']) expect(deep(byId(id)), id).toEqual([]);
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

  it('lifts the other unit out of the way to tuck a point under it', () => {
    const star = byId('ninja-star');
    const tucks = star.steps.flatMap((s, i) => (s.title.startsWith('Tuck') ? [i + 1] : []));
    expect(tucks).toHaveLength(4);
    for (const k of tucks) expect(stepTransition(star, k).makeWay, `step ${k}`).toBeDefined();
    expect(deep(star)).toEqual([]);
  });

  it('folds thick stacks, petal folds and reverse folds without passing through', () => {
    // Stacks ease off their creases, hinged layers settle into place as they turn, and creases nearer the
    // still paper can fold first.
    for (const id of ['heart', 'jumping-frog', 'tulip', 'crane']) expect(deep(byId(id)), id).toEqual([]);
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
