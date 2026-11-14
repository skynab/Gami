import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MODELS } from '../../gallery/catalog';
import { es } from './es';
import { fr } from './fr';
import { ja } from './ja';

/**
 * Every built-in step's title, instruction and section name, in English: read from the models' files, as the
 * site reads them (the model checks make sure each file is its recipe's), rather than building every model.
 */
const english = new Set(
  MODELS.filter((m) => m.steps)
    .flatMap((m) => {
      const frames: { frame_title?: string; 'gami:text'?: string; 'gami:section'?: string }[] = JSON.parse(
        readFileSync(new URL(`../../../public/models/${m.id}.fold`, import.meta.url), 'utf8'),
      ).file_frames;
      return frames.flatMap((f) => [f.frame_title ?? '', f['gami:text'] ?? '', f['gami:section'] ?? '']);
    })
    .filter(Boolean),
);

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
