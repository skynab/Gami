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
| 2. Kimono | Done (22 November), **Gami's own**: Gilad's database does list Traditional kimonos, but Gami's doesn't follow them or origami.me's (a square folded in half, narrow strips, a squash). 6 steps: the sides to the middle for a coloured body, their edges turned back on a slant at the top for a white collar, and their bottom corners folded out and the bottom half folded up behind, as a dollar-bill shirt's sleeves are, so the sleeves show the coloured side. Folding the corners out square, for wider sleeves, would tear the flaps from the body, so the sleeves are pointed; the body is as tall as it's wide, as the sleeves need the whole bottom half. |
| 3. Wallet | Done (22 November), **traditional**: Gilad's database lists six Traditional wallets. 12 steps, following origami.me's order of folds: creased in half and near the top and bottom, the corners folded to those creases and the strips over them, turned over and stood up, the bottom folded up past the middle and the top folded down and tucked under its side flaps (a `collapse` with `under`), then folded in half like a book. From a square, as origami.me's steps are, though its candidates row said rectangle. Left closed, not opened with a `bend`. |
| 4. Parrot | Done (22 November), **Gami's own**: Gilad's database lists a Traditional parrot (Saydak's book), but origami.me's squashes out the head in steps that can't be followed from its text. 8 steps: a kite, its long point pleated for the tail, folded in half coloured side out, and its short point, at the front of the head on the fold, inside-reverse-folded forward and down for a hooked beak. Narrowing the top for a separate head left it a thin spike; folded the other way, the beak hung at the back of the head; an outside reverse fold showed the plain side but wrapped the head like a cap, so the beak is green. |
| 5. Chicken | Done (22 November), **traditional**: Gilad's database lists three Traditional chickens, one in Saydak's book (he wrote origami.me's page). 16 steps, following origami.me's order as far as the beak: landmark pinches (made as full creases until pinches came, 24 November), the corners folded up, folded in half, the feet reverse-folded (round the outside: inside, its many layers pass through each other) and the beak. Its wings, comb and head are left out: the wings' squash can't be placed from the text, and the comb is one layer of the beak unfolded, joined to the next along the fold, which the engine can't do; turning the head over outside or folding a front layer down couldn't reach the red inside without tearing. So it's a one-colour (russet) hen, and it lies flat rather than standing. Tried first: a triangle and a kite folded in half with reverse-folded neck, head and tail, which read as a duck. |
| 6. Swallow | Done (24 November), **Gami's own** (paused 22 November): Gilad's database lists five Swallows credited Traditional (Saydak's *Everyone Can Learn Origami*, Cunliffe, LaFosse, Takahama, Sakade) and two Unknown, but four readings of origami.me's captions didn't fold; see below. 33 steps, seen from above: the bird base and the crane's leg narrowing, the legs reverse-folded up and out to 25° above level as swept-back wings (from half a side above the bottom point; higher, the creases can't fold flat), the front long flap folded down at the top of the body so its tip shows below the wings for the head, the back one cut up the middle and each half's inside edge folded out 12° for a forked tail, then turned round head up. |
| 7. Horse | **Paused** before starting: like the swallow, its key steps need origami.me's diagrams. |
| 8. Crab | **Paused** before starting: as the horse. |

The batch is paused at six of eight (22 November; the swallow, as Gami's own, 24 November). What's below is what's left, and what would help.

## What could still be done

### The swallow, horse and crab

origami.me's step text for these three leans on its diagrams ("fold along the dashed line", "where it meets the layer
underneath"), which can't be read from the text alone, so the order of folds can't be followed with confidence. The
swallow got furthest. Its bird base and the crane's leg narrowing (origami.me's steps 1 to 12) are certain; what isn't
is which parts become the wings, head and tail. Four readings, each built and checked:

1. **Legs swung out as wings** (inside reverse folds from a little above the bottom point), **one long flap folded down
   for the tail, the other's tip down and up for the head.** Folds cleanly, but the long flaps can only fold at the top
   of the body (the sheet's centre; lower, the fold tears through the narrowed legs' edges), so the tail reaches only
   the wing roots and doesn't show.
2. **Long flaps swung out as wings** (folded on slanted lines through the top of the body), **one leg folded up for the
   neck, the other cut for the tail.** The wings come out stubby (only the 0.3 of each flap above the top of the body swings out, on a sheet 1 across), and folding one
   leg up tears whatever number of layers is picked: each leg is folded in half round the other.
3. **As 2, but the neck reverse-folded up between the layers, as the crane's is.** The neck stays hidden inside the long
   flaps, and with it inside the wing folds tear.
4. **The long flap folded down along the crease across the middle** (for a longer tail). Tears for the reason in 1.

Done instead (24 November): a swallow of Gami's own, as row 6 says, which takes the legs as wings swinging up toward
the long flaps, so the flap folded down becomes the head and the one left up the tail. A traditional swallow could
still follow, once a diagram (Robinson's *World's Best Origami* or Saydak's book) shows which flap is which. The horse (square base, a cut to part the legs,
reverse-folded head and tail) and the crab (frog base, several cuts) need the same diagram check first.

### Left out of the five that shipped

Since 23 November marks can take a pen of any colour (`Mark.colour`; the Studio's Draw tool has a Pen swatch), and
three of these are drawn on: the chicken's red comb and wattle (with an eye, both sides), the kimono's gold obi and
the parrot's pale yellow beak (both sides). What's below is what folding them would still need.

- **Chicken: wings, red comb, head.** origami.me squashes the front flap into a wing after the feet are folded, makes
  the comb by unfolding one layer of the beak's reverse fold, and shapes the head with an outside reverse fold. The
  squash couldn't be placed from the text. The comb needs one layer of a reverse fold opened while the layer it's
  joined to along the fold stays, which the engine can't make; turning the head over outside or folding a front layer
  down couldn't reach the red inside without tearing. Also its feet are reverse-folded round the outside, not inside:
  inside, its many layers pass through each other as the step plays (8.9 layers against a limit of 5). And it lies
  flat; origami.me's stands on its feet (stand it up with `assemble`, as the T-rex is).
- **Kimono: a longer robe and an obi.** The body can only be as tall as it's wide, as the sleeves use the whole bottom
  half, and the sleeves are pointed, as folding them out square would tear the flaps from the body. An obi (a band of
  the plain side across the waist) needs a flap that turns over once; a pleat shows the same side.
- **Parrot: a pale beak.** Its beak shows the coloured side; turned round the outside it shows the plain side but wraps
  the head like a cap.
- **Wallet: open.** It's left closed; it could open part way with a `bend`, as the fan does.

### Engine features that would help

- ✅ **Pinches** (24 November): `unfold({ pinch })`, a fold pressed only for a short way and opened, so only that much
  of its line creases (the rest is kept as `uncreased` and drawn without lines). The chicken's two landmarks are pinched
  at the right edge. The Studio has no pinch tool yet.
- **Opening one layer of a fold**: unfolding the top layer of a reverse fold while the rest stays (the chicken's comb),
  and similar "open the pocket" moves.
- ✅ **Coloured pen marks** (23 November): a mark's `colour` (`#rrggbb`, kept in .fold files), drawn in it by the
  viewer, the cards and the Studio. Used for the chicken's comb, the kimono's obi and the parrot's beak.

