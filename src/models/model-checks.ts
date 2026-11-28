import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { restingBreaks } from '../fold/breaks';
import { crossings, partings, playing, restingCrossings } from '../fold/collisions';
import { fromFoldFile, toFoldFile } from '../fold/fold-format';
import { framesOf } from '../fold/frames';
import { guidesFor } from '../fold/guides';
import { replay } from '../fold/ops';
import { previewSvg, thumbnailSvg } from '../fold/thumbnail';
import { problems } from '../fold/validate';
import { MODELS } from '../gallery/catalog';
import { paperRatio } from '../gallery/ModelCard';
import { stepsShowingThrough } from '../viewer/depth';
import { BREAK, BREAKS, GRAZE, GRAZES, REST, RESTS, SHOWING, TEAR, TEARS } from './known-clipping';
import { RECIPES } from './recipes';

/**
 * Every check on every built-in model, split into shards run from models-1.test.ts to models-4.test.ts, so the
 * work spreads over several test workers rather than one doing it all (it took five minutes on its own). Each
 * shard builds only its own models; the heaviest (the kusudama, rainbow chain, balloon and cup) fall in
 * different shards by their place in `RECIPES`.
 */
export const SHARDS = 4;

const file = (name: string) => readFileSync(new URL(`../../public/models/${name}`, import.meta.url), 'utf8');

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
    // Faces meeting at a point compared too, so a flap's point tucked through what it meets there is found. Step
    // by step: a model's entry once covered all its steps, which hid others going deeper than the limit.
    const deepest = new Map<number, number>();
    for (const c of crossings(model, playing, 'edge')) {
      if (model.steps[c.step - 1].frame.soft?.length) continue;
      deepest.set(c.step, Math.max(deepest.get(c.step) ?? 0, c.depth));
    }
    const known = GRAZES[id] ?? {};
    const name = (k: number) => `step ${k} “${model.steps[k - 1]?.title}”`;
    expect([...deepest].filter(([k, d]) => d > (known[k] ?? GRAZE)).map(([k, d]) => `${name(k)}: ${d.toFixed(4)}`)).toEqual([]);
    // A step that no longer goes deeper comes off the list.
    expect(Object.keys(known).map(Number).filter((k) => (deepest.get(k) ?? 0) <= GRAZE).map(name)).toEqual([]);
  }, 90_000);

  it('rests without paper through paper deeper than a few layers, or than it’s known to', () => {
    const deepest = Math.max(0, ...restingCrossings(model).filter((c) => !c.stacked).map((c) => c.depth));
    expect(deepest).toBeLessThanOrEqual(RESTS[id] ?? REST);
    // A model that no longer goes deeper comes off the list.
    if (id in RESTS) expect(deepest).toBeGreaterThan(REST);
  });

  it('rests with joined paper together, or no further apart than it’s known to', () => {
    // Faces joined along a crease, as the viewer draws them where each step comes to rest: apart, but for stacked
    // layers' gaps at a fold (which the viewer closes with a bend), the paper shows torn there.
    const widest = Math.max(0, ...restingBreaks(model, 0).map((b) => b.gap));
    expect(widest).toBeLessThanOrEqual(BREAKS[id] ?? BREAK);
    // A model that no longer comes apart further comes off the list.
    if (id in BREAKS) expect(widest).toBeGreaterThan(BREAK);
  });

  it('keeps paper underneath out of sight, even zoomed right out, or where it’s known not to', () => {
    // The depth buffer's steps, from as far off as the camera goes, have to keep each layer apart from the paper on
    // top of it, or the crease lines underneath show through (viewer/depth.ts). A step that no longer shows through
    // comes off the list.
    expect(stepsShowingThrough(model)).toEqual(SHOWING[id] ?? []);
  });

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
    // The kusudama's 61 sheets took over 60 s with every shard running (26 November 2026).
  }, 180_000);

  it('has a title on every step', () => {
    for (const s of model.steps) expect(s.title.trim()).not.toBe('');
  });

  it('matches its generated files (run `npm run models` if not)', () => {
    expect(JSON.parse(file(`${id}.fold`))).toEqual(JSON.parse(JSON.stringify(toFoldFile(model))));
    expect(file(`${id}.svg`)).toBe(thumbnailSvg(model));
    expect(file(`${id}-preview.svg`)).toBe(previewSvg(model));
  });

  // Replaying a bend solves it again: up to 40 s on its own (the balloon and balloon rabbit), over 60 s with the
  // other shards' workers sharing the cores (26 November 2026); the crane's three reverse folds, bent on the way,
  // about 85 s on their own.
  it('folds again from its .fold file exactly as its recipe did', { timeout: 420_000 }, () => {
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
