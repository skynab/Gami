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

describe('the fold engine’s messages', () => {
  it('are said in the interface’s language, values and all', async () => {
    const { default: i18n, sayFold } = await import('./index');
    const { FoldError } = await import('../fold/fold');
    const { ShareError } = await import('../studio/share');
    const { said } = await import('../fold/messages');
    await i18n.changeLanguage('ja');
    try {
      expect(sayFold(new FoldError('noSheetToCopyOnto', { sheet: 2 }))).toBe(ja.fold.noSheetToCopyOnto.replace('{{sheet}}', '2'));
      // As posted from a worker or kept with a design, and with a step's error inside a share link's.
      expect(sayFold(said(new FoldError('nothingToMove')))).toBe(ja.fold.nothingToMove);
      const inner = said(new FoldError('cutMissesPaper'));
      expect(sayFold(new ShareError('shareStep', { step: 3, error: inner }))).toBe(`手順 3:${ja.fold.cutMissesPaper}`);
      // Plain English, for authors and files, stays as it is.
      expect(sayFold(new Error('steps.2.op: expected a number'))).toBe('steps.2.op: expected a number');
    } finally {
      await i18n.changeLanguage('en');
    }
  });
});
