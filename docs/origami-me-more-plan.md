# Plan: eight more models from origami.me

The next batch after OrigamiOK's advanced folds (`docs/origamiok-advanced-plan.md`), chosen 22 November 2026 from
`docs/origami-me-candidates.md`: the eight it marks as good candidates that aren't in the gallery yet. Each is
credited "Traditional" on its origami.me page (checked again 22 November 2026), and origami.me's licensing page says
nobody owns a traditional design. Their diagrams, photos and wording are still under copyright: Gami follows the
order of folds only and writes every step in its own words.

**But check Gilad's database too.** The necktie, the first, turned out to have no Traditional entry there: all ten
neckties have named designers. So it's Gami's own, as the easy sword and sunflower are, and each of the rest gets
the same check before its recipe: traditional where Gilad's database agrees, Gami's own (folded its own way, in
`DESIGNS-LICENSE.md`) where it doesn't.

## What was found (22 November 2026)

| Model | Paper | Cuts | Starts from | Steps there | Ends |
|---|---|---|---|---|---|
| Necktie | 1 square | none | a diamond creased in half, a pinch | 10 | flat |
| Kimono | 1 square | none | halves creased, a narrow strip | 8 | flat |
| Wallet | 1 square | none | halves and thirds | 13 | flat, opens like a book |
| Parrot | 1 square | none | a kite, its flap folded behind | 12 | flat, a pleated tail and reverse-folded beak |
| Chicken | 1 square | none | a diamond folded in half, pinches | 17 | stands: squashed wings, reverse-folded feet, beak and head, a comb |
| Swallow | 1 square | one, to fork the tail | the bird base | 23 | flat |
| Horse | 1 square | one, to part the legs | the square base | 20 | stands: reverse-folded head and tail |
| Crab | 1 square | several, to part the legs | the frog base | 32 | spread out in 3D |

## The routine for each model

As in the earlier batches: licence row first (`record-model-licence`: Traditional, `None needed: nobody owns it`,
the origami.me page as the reference, if Gilad's database agrees; otherwise Gami's own); recipe in
`src/models/recipes`, added to `RECIPES`; `npm run models` (it rewrites every file in `public/models`, so check only
the new model's files changed); no crossings at rest or playing, and no new `RESTS` or `GRAZES` entry; catalog entry with `added` set to the ship date; Japanese, Spanish and
French steps; `npm test` and `npm run typecheck`; look at it in the viewer. Take the model's row out of
`docs/origami-me-candidates.md` when it ships. Check line endings before committing. One commit per model.

Reuse the base helpers (`bird-base.ts` for the swallow, `squareBase` for the horse, the frog base for the crab) and
the presets (squash, petal, crimp, pleat) rather than folding them out by hand.

## Order

Flat first, then the ones that stand, then the cut ones, roughly in step count:

| Phase | Model | Engine fit | Risk |
|---|---|---|---|
| 1 | Necktie | Folds to a centre crease, two squashes, a tuck. | Low |
| 2 | Kimono | Folds to creases, a narrow strip each side, a squash for the collar. | Low |
| 3 | Wallet | Edges to creases, corners in, a tuck under the side flaps; then a `bend` to open it, as the fan does. | Low |
| 4 | Parrot | A kite, a pleat for the tail, folded in half and the beak inside-reverse-folded. | Low |
| 5 | Chicken | Squashes for the wings either side, inside reverse folds for the feet and beak, an outside one for the head; stood up with `assemble`. | Medium |
| 6 | Swallow | The bird base helper, petal folds, then one `cut` up the tail and its halves folded apart. | Medium |
| 7 | Horse | The square base helper, a `cut` to part the legs, reverse folds for the head and tail (long, thin flaps: watch the clipping). | Medium |
| 8 | Crab | The frog base, several cuts for the legs, each pair folded out at its own angle so they stack. | High |

## Progress

| Phase | Status |
|---|---|
| 1. Necktie | Done (22 November), **Gami's own** (Gilad's database has no Traditional necktie), 10 steps, a pen. A kite narrowed at the top and turned over, the point folded down and back up for the knot and its tip folded behind, as the easy sword makes its crossguard. Folded from the narrow point, the knot came out narrower than the tie and the same colour, so it barely showed; stripes drawn across the tie below it before it's folded leave the knot plain. Light blue, as the pen is dark. origami.me's knot is squashed out from a pleat; not followed. |
| 2. Kimono | Not started |
| 3. Wallet | Not started |
| 4. Parrot | Not started |
| 5. Chicken | Not started |
| 6. Swallow | Not started |
| 7. Horse | Not started |
| 8. Crab | Not started |
