import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { filterModels, levelOf, MODELS } from './catalog';

describe('catalog', () => {
  it('has unique, URL-safe ids', () => {
    const ids = MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it('maps difficulty to levels', () => {
    expect(levelOf(1)).toBe('easy');
    expect(levelOf(2)).toBe('easy');
    expect(levelOf(3)).toBe('medium');
    expect(levelOf(5)).toBe('hard');
  });

  it('filters by query, level and category together', () => {
    expect(filterModels(MODELS, { query: 'CRANE' }).map((m) => m.id)).toEqual(['crane']);
    expect(filterModels(MODELS, { level: 'hard' }).every((m) => m.difficulty >= 4)).toBe(true);
    expect(filterModels(MODELS, { category: 'modular' }).map((m) => m.id)).toEqual(['ninja-star']);
    expect(filterModels(MODELS, { level: 'easy', category: 'animal' }).map((m) => m.id)).toEqual([
      'dog-face', 'cat-face', 'cicada', 'jumping-frog', 'fox', 'swan', 'penguin', 'whale', 'fish', 'dolphin', 'crow', 'butterfly', 'pajarita',
    ]);
    expect(filterModels(MODELS, {})).toHaveLength(MODELS.length);
  });

  it('records where every model with steps comes from', () => {
    const provenance = readFileSync(new URL('../../PROVENANCE.md', import.meta.url), 'utf8');
    const missing = MODELS.filter((m) => m.steps && !provenance.includes(`| \`${m.id}\` |`)).map((m) => m.id);
    expect(missing, 'add a row to PROVENANCE.md for each').toEqual([]);
  });
});
