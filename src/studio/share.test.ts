import { describe, expect, it } from 'vitest';
import { toFoldFile } from '../fold/fold-format';
import { fortuneTeller } from '../models/recipes/fortune-teller';
import { ninjaStar } from '../models/recipes/ninja-star';
import { openShared, ShareError, shareText } from './share';

describe('sharing a design by link', () => {
  it('folds the design again from the link, exactly as it was', async () => {
    for (const make of [fortuneTeller, ninjaStar]) {
      const model = make();
      const text = await shareText(model);
      // Small enough to paste: a fraction of the .fold file.
      expect(text.length).toBeLessThan(JSON.stringify(toFoldFile(model)).length / 5);
      expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(toFoldFile(await openShared(text))).toEqual(toFoldFile(model));
    }
  });

  it('says so when a step can’t be folded again, or the link is damaged', async () => {
    const model = fortuneTeller();
    const baked = { ...model, steps: model.steps.map((s, i) => (i === 2 ? { ...s, op: undefined } : s)) };
    await expect(shareText(baked)).rejects.toThrow(ShareError);
    const text = await shareText(model);
    await expect(openShared(text.slice(0, text.length / 2))).rejects.toThrow(ShareError);
    await expect(openShared('not a link')).rejects.toThrow(ShareError);
  });
});
