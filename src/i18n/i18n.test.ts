import { describe, expect, it } from 'vitest';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { ja } from './ja';

/** Every message, keyed by its dotted path. */
function flatten(o: object, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string') out.set(prefix + k, v);
    else for (const [kk, vv] of flatten(v, `${prefix}${k}.`)) out.set(kk, vv);
  }
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
const english = flatten(en);

describe.each([
  ['ja', ja],
  ['es', es],
  ['fr', fr],
])('%s', (_, messages) => {
  const translated = flatten(messages);

  it('has exactly the English keys', () => {
    expect([...translated.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it('fills every message, with the same placeholders', () => {
    for (const [key, text] of translated) {
      expect(text.trim(), key).not.toBe('');
      expect(placeholders(text), key).toEqual(placeholders(english.get(key)!));
    }
  });
});
