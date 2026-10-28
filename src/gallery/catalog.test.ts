import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { filterModels, levelOf, MODELS, PAIRS, sortModels, withPairs } from './catalog';

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
      'dog-face', 'cat-face', 'cicada', 'jumping-frog', 'fox', 'swan', 'penguin', 'whale', 'pajarita', 'fish',
    ]);
    expect(filterModels(MODELS, {})).toHaveLength(MODELS.length);
  });

  it('sorts, keeping the catalog order among equals', () => {
    expect(sortModels(MODELS, 'natural')).toEqual(MODELS);
    const easiest = sortModels(MODELS, 'easiest');
    expect(easiest.map((m) => m.difficulty)).toEqual(MODELS.map((m) => m.difficulty).sort());
    expect(easiest[0].id).toBe('basics');
    expect(sortModels(MODELS, 'hardest')[0].id).toBe('lily');
    const az = sortModels(MODELS, 'az').map((m) => m.title);
    expect(az[0]).toBe('Balloon');
    expect(sortModels(MODELS, 'za').map((m) => m.title)).toEqual([...az].reverse());
    expect(sortModels(MODELS, 'quickest').slice(0, 2).map((m) => m.id)).toEqual(['dog-face', 'cat-face']);
    // Sorting copies: the catalog keeps its order.
    expect(MODELS[0].id).toBe('basics');
  });

  it('pairs related models where the first of them comes, only when both are there', () => {
    const ids = (list: ReturnType<typeof withPairs>) => list.map((e) => (Array.isArray(e) ? e.map((m) => m.id).join('+') : e.id));
    const all = ids(withPairs(MODELS));
    expect(all).toContain('masu-box+masu-lid');
    expect(all).not.toContain('masu-lid');
    // In the box's place, after the sword.
    expect(all[all.indexOf('masu-box+masu-lid') - 1]).toBe('sword');
    // Sorted Z to A, the lid comes first, but the box stays on the left.
    expect(ids(withPairs(sortModels(MODELS, 'za')))).toContain('masu-box+masu-lid');
    // Filtered down to one of them, it has a card of its own.
    expect(ids(withPairs(filterModels(MODELS, { query: 'lid for the masu box: the same' })))).toEqual(['masu-lid']);
    for (const pair of PAIRS) for (const id of pair) expect(MODELS.some((m) => m.id === id && m.steps), id).toBe(true);
  });

  it('records where every model with steps comes from', () => {
    const provenance = readFileSync(new URL('../../PROVENANCE.md', import.meta.url), 'utf8');
    const missing = MODELS.filter((m) => m.steps && !provenance.includes(`| \`${m.id}\` |`)).map((m) => m.id);
    expect(missing, 'add a row to PROVENANCE.md for each').toEqual([]);
  });
});
