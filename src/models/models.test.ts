import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { toFoldFile } from '../fold/fold-format';
import { thumbnailSvg } from '../fold/thumbnail';
import { problems } from '../fold/validate';
import { MODELS } from '../gallery/catalog';
import { RECIPES } from './recipes';

const models = RECIPES.map((make) => make());
const file = (name: string) => readFileSync(new URL(`../../public/models/${name}`, import.meta.url), 'utf8');

describe.each(models.map((m) => [m.id, m] as const))('%s', (id, model) => {
  it('folds without stretching, tearing or tangling', () => {
    expect(problems(model)).toEqual([]);
  });

  it('has a title on every step', () => {
    for (const s of model.steps) expect(s.title.trim()).not.toBe('');
  });

  it('matches its generated files (run `npm run models` if not)', () => {
    expect(JSON.parse(file(`${id}.fold`))).toEqual(JSON.parse(JSON.stringify(toFoldFile(model))));
    expect(file(`${id}.svg`)).toBe(thumbnailSvg(model));
  });

  it('is listed in the gallery with the right number of steps', () => {
    expect(MODELS.find((m) => m.id === id)?.steps).toBe(model.steps.length);
  });
});

it('has step data for every gallery model that claims steps', () => {
  const ids = new Set(models.map((m) => m.id));
  for (const m of MODELS) if (m.steps) expect(ids, m.id).toContain(m.id);
});
