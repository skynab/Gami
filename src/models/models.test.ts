import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { MODELS } from '../gallery/catalog';
import { SHARDS } from './model-checks';
import { RECIPES } from './recipes';

// The checks on each built-in model are in model-checks.ts, run in shards from models-1.test.ts on.

it('has a shard file for every shard of the model checks', () => {
  for (let k = 1; k <= SHARDS; k++) expect(() => readFileSync(new URL(`./models-${k}.test.ts`, import.meta.url))).not.toThrow();
});

it('has step data for every gallery model that claims steps', () => {
  // Without building every model to read its id: each recipe's model is checked, in its shard, to be listed in
  // the gallery with its number of steps and to match its file, so as many recipes as gallery models with steps,
  // each with its file, leaves none of them out.
  const listed = MODELS.filter((m) => m.steps);
  expect(RECIPES.length).toBe(listed.length);
  for (const m of listed) {
    const file = JSON.parse(readFileSync(new URL(`../../public/models/${m.id}.fold`, import.meta.url), 'utf8'));
    expect(file['gami:id'], m.id).toBe(m.id);
    expect(file.file_frames.length, m.id).toBe(m.steps);
  }
});
