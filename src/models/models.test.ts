import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { crossings } from '../fold/collisions';
import { fromFoldFile, toFoldFile } from '../fold/fold-format';
import { replay } from '../fold/ops';
import { previewSvg, thumbnailSvg } from '../fold/thumbnail';
import { problems } from '../fold/validate';
import { MODELS } from '../gallery/catalog';
import { paperRatio } from '../gallery/ModelCard';
import { RECIPES } from './recipes';

const models = RECIPES.map((make) => make());
const file = (name: string) => readFileSync(new URL(`../../public/models/${name}`, import.meta.url), 'utf8');

/** How deep paper may pass through paper as a model plays (a sheet's width is 1, a layer 0.0007): a few layers. */
const GRAZE = 0.005;
/**
 * The models known to go deeper, each a little over what it was measured at (November 2026), and where. Bent steps
 * are left to the bending checks: the viewer draws bent paper in its stacking order where layers meet.
 */
const GRAZES: Record<string, number> = {
  'king-bee': 0.0065, // Bending up the ailerons between the slits.
  lily: 0.009, // Its squash-and-petal folds, joined up all the way (see collisions.test.ts).
  swan: 0.014, // Pulling up the neck: with rigid paper its body is a closed tube (PLAN.md, milestone 13).
  whale: 0.009, // Opening the fins out in 3D.
  dolphin: 0.0075, // Opening the fins out in 3D.
  frog: 0.013, // Lifting the front legs, against the other front quarter (docs/origami-me-plan.md).
  'masu-shallow-lid': 0.0085, // Raising the walls: riding layers sit a little off the faces they ride on.
  'rainbow-chain': 0.034, // Joining the ends: rigid links set on a ring dip into each other where they cross.
  // Reverse folds, their points tucked in between the flap's halves (November 2026): the point turns as one and
  // settles in between, through about half the stack. Real paper bends a little to open the flap; rigid paper
  // can't without opening it right out (docs/next-tasks-plan.md).
  crane: 0.008, // The neck, tail and head.
  fox: 0.0075, // Folding the tail in.
  seal: 0.0055, // Turning the tail up.
};

describe.each(models.map((m) => [m.id, m] as const))('%s', (id, model) => {
  // Animating every step of the biggest models (the kusudama's 61 sheets) takes up to 20 s; the later tests reuse it.
  it('folds without stretching, tearing or tangling', () => {
    expect(problems(model)).toEqual([]);
  }, 90_000);

  it('passes paper through paper no deeper than a few layers, or than it’s known to', () => {
    const deepest = Math.max(0, ...crossings(model).filter((c) => !model.steps[c.step - 1].frame.soft?.length).map((c) => c.depth));
    expect(deepest).toBeLessThanOrEqual(GRAZES[id] ?? GRAZE);
    // A model that no longer goes deeper comes off the list.
    if (id in GRAZES) expect(deepest).toBeGreaterThan(GRAZE);
  }, 60_000);

  it('has a title on every step', () => {
    for (const s of model.steps) expect(s.title.trim()).not.toBe('');
  });

  it('matches its generated files (run `npm run models` if not)', () => {
    expect(JSON.parse(file(`${id}.fold`))).toEqual(JSON.parse(JSON.stringify(toFoldFile(model))));
    expect(file(`${id}.svg`)).toBe(thumbnailSvg(model));
    expect(file(`${id}-preview.svg`)).toBe(previewSvg(model));
  });

  // Replaying a bend solves it again, which takes seconds.
  it('folds again from its .fold file exactly as its recipe did', { timeout: 60_000 }, () => {
    const warnings: string[] = [];
    const read = fromFoldFile(JSON.parse(JSON.stringify(toFoldFile(model))), warnings);
    expect(warnings).toEqual([]);
    const { model: again, status, error } = replay(read);
    expect(error).toBeUndefined();
    expect(status.every((s) => s === 'replayed')).toBe(true);
    // Compared as the file keeps them, to 1e-9.
    expect(toFoldFile(again)).toEqual(toFoldFile(read));
  });

  it('says in the gallery which tools it needs: scissors for a cut, a pen for drawing, tape, glue', () => {
    const needs = [
      ...(model.steps.some((s) => s.kind === 'cut') ? ['scissors'] : []),
      ...(model.steps.some((s) => s.kind === 'draw') ? ['pen'] : []),
      ...(model.steps.some((s) => s.kind === 'tape') ? ['tape'] : []),
      ...(model.steps.some((s) => s.op?.op === 'assemble' && s.op.glue) ? ['glue'] : []),
    ];
    expect(MODELS.find((m) => m.id === id)?.needs ?? []).toEqual(needs);
  });

  it('says in the gallery when it starts from a rectangle rather than a square', () => {
    const ratio = paperRatio(model.sheets);
    const listed = MODELS.find((m) => m.id === id)?.paper;
    if (ratio < 1 + 1e-9) expect(listed).toBeUndefined();
    else expect(listed).toBeCloseTo(ratio, 2);
  });

  it('is listed in the gallery with the right number of steps', () => {
    expect(MODELS.find((m) => m.id === id)?.steps).toBe(model.steps.length);
  });
});

it('has step data for every gallery model that claims steps', () => {
  const ids = new Set(models.map((m) => m.id));
  for (const m of MODELS) if (m.steps) expect(ids, m.id).toContain(m.id);
});
