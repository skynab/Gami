import { describe, expect, it } from 'vitest';
import { RECIPES } from '../../models/recipes';
import { es } from './es';
import { fr } from './fr';
import { ja } from './ja';

/** Every built-in step's title, instruction and section name, in English. */
const english = new Set(RECIPES.flatMap((make) => make().steps.flatMap((s) => [s.title, s.text ?? '', s.section ?? ''])).filter(Boolean));

describe.each([
  ['ja', ja],
  ['es', es],
  ['fr', fr],
])('%s steps', (_, words) => {
  it('translates every step of every built-in model', () => {
    for (const text of english) expect(words[text]?.trim(), text).toBeTruthy();
  });

  it('has nothing left over from steps that have changed', () => {
    for (const text of Object.keys(words)) expect(english.has(text), text).toBe(true);
  });

  it('keeps the numbers', () => {
    // Angles and axiom numbers must survive translation (written with a comma or a point).
    const numbers = (s: string) => [...s.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => m[0].replace(',', '.')).sort();
    for (const text of english) expect(numbers(words[text] ?? ''), text).toEqual(numbers(text));
  });
});
