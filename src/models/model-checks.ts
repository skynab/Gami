import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { crossings, partings } from '../fold/collisions';
import { fromFoldFile, toFoldFile } from '../fold/fold-format';
import { framesOf } from '../fold/frames';
import { guidesFor } from '../fold/guides';
import { replay } from '../fold/ops';
import { previewSvg, thumbnailSvg } from '../fold/thumbnail';
import { problems } from '../fold/validate';
import { MODELS } from '../gallery/catalog';
import { paperRatio } from '../gallery/ModelCard';
import { RECIPES } from './recipes';

/**
 * Every check on every built-in model, split into shards run from models-1.test.ts to models-4.test.ts, so the
 * work spreads over several test workers rather than one doing it all (it took five minutes on its own). Each
 * shard builds only its own models; the heaviest (the kusudama, rainbow chain, balloon and cup) fall in
 * different shards by their place in `RECIPES`.
 */
export const SHARDS = 4;

const file = (name: string) => readFileSync(new URL(`../../public/models/${name}`, import.meta.url), 'utf8');

/** How deep paper may pass through paper as a model plays (a sheet's width is 1, a layer 0.0007): a few layers. */
const GRAZE = 0.005;
/**
 * The models known to go deeper, each a little over what it was measured at (last on 11 November 2026), and where. Bent steps
 * are left to the bending checks: the viewer draws bent paper in its stacking order where layers meet.
 */
const GRAZES: Record<string, number> = {
  lily: 0.009, // Its squash-and-petal folds, joined up all the way (see collisions.test.ts).
  swan: 0.014, // Pulling up the neck: with rigid paper its body is a closed tube (PLAN.md, milestone 13).
  whale: 0.009, // Opening the fins out in 3D.
  dolphin: 0.0075, // Opening the fins out in 3D.
  frog: 0.011, // Turning out a back leg, and lifting the front legs against the other front quarter (docs/origami-me-plan.md).
  'masu-shallow-lid': 0.0085, // Raising the walls: riding layers sit a little off the faces they ride on.
  'rainbow-chain': 0.034, // Joining the ends: rigid links set on a ring dip into each other where they cross.
  // The second squash, its twelve layers grazing as they turn (docs/bending-plan.md, step 7).
  boat: 0.0105,
  // Reverse folds, their points tucked in between the flap's halves (November 2026): the point turns as one and
  // settles in between, through about half the stack. Real paper bends a little to open the flap; rigid paper
  // can't without opening it right out (docs/next-tasks-plan.md).
  crane: 0.008, // The neck, tail and head. (The seal's tail came off the list on 11 November: see LANDS in animate.ts.)
  fox: 0.0075, // Folding the tail in.
};

/**
 * How far joined paper may come apart as a model plays, beyond what's apart at a step's ends anyway (the gaps
 * between layers at a fold, paper riding on paper, a cut's two sides): about the thickness of a 14-layer stack,
 * 1.5 mm on a 15 cm sheet. The boat's small diamond once tore by twelve times that, unseen by the checks above.
 */
const TEAR = 0.01;
/**
 * The models known to come further apart, each a little over what it was measured at, and where. None since
 * 11 November 2026: the lily, seal, frog and fox, the last four, are joined up all the way (docs/next-tasks-plan.md).
 */
const TEARS: Record<string, number> = {};

/** The checks on shard `shard` (1 to `SHARDS`) of the built-in models: every `SHARDS`th recipe from its place. */
export function checkModels(shard: number) {
  const models = RECIPES.filter((_, i) => i % SHARDS === shard - 1).map((make) => make());
  describe.each(models.map((m) => [m.id, m] as const))('%s', (id, model) => checks(id, model));
}

function checks(id: string, model: ReturnType<(typeof RECIPES)[number]>) {
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

  // After the crossings, which work out each step's motion: about half a second a model.
  it('keeps joined paper together as it plays, or no further apart than it’s known to', () => {
    const most = Math.max(0, ...partings(model).map((p) => p.apart));
    expect(most).toBeLessThanOrEqual(TEARS[id] ?? TEAR);
    // A model that no longer comes apart further comes off the list.
    if (id in TEARS) expect(most).toBeGreaterThan(TEAR);
  }, 60_000);

  // After the crossings too, whose motions the guides' arrows follow.
  it('works out guides for every step', () => {
    const fs = framesOf(model);
    for (let k = 1; k < fs.length; k++) {
      // Starting again on a fresh sheet (fewer faces than before) moves nothing, so has nothing to show.
      if (fs[k].faces_vertices.length < fs[k - 1].faces_vertices.length || model.steps[k - 1].op?.op === 'newSheet') continue;
      // Drawing on the paper or taping it doesn't fold it.
      if (model.steps[k - 1].kind === 'draw' || model.steps[k - 1].kind === 'tape') continue;
      // A bend passes through frames on its way, which its faces point back at.
      const g = guidesFor(fs[k - 1], fs[k], model.steps[k - 1].via);
      expect(g.arrows.length + g.creases.length + g.cuts.length, `step ${k}`).toBeGreaterThan(0);
    }
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

  it('says in the gallery whether it ends flat or in 3D', () => {
    const last = model.steps.at(-1)?.frame ?? model.start;
    const standing = last.vertices_coords.some((p) => Math.abs(p[1]) > 1e-6);
    expect(MODELS.find((m) => m.id === id)?.form === '3d').toBe(standing);
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
}
