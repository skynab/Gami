# Plan: a "New" filter, and new folds from OrigamiOK

Two pieces of work: a **New** filter, sort and badge in the gallery, then a batch of new models taken from
[OrigamiOK](https://origamiok.com/traditional-japanese-origami/). Every model in this batch is marked New on its
card. Each phase ships on its own, one commit per model, like `docs/origami-me-plan.md`.

## What was found (28 October 2026)

- **OrigamiOK credits no designers.** Its traditional page says traditional designs "belong to humanity's
  collective heritage", but no model page names a designer or gives a licence, only "Copyright © 2026 ·
  OrigamiOK" for the site. Only the lotus page calls its model traditional. So each model's status comes from
  [Gilad's database](https://www.giladorigami.com/origami-database/lotus), as `PROVENANCE.md` already does. As
  with origami.me, Gami follows the order of folds only and copies none of OrigamiOK's text or photos.
- **Lotus.** Traditional: Gilad's lists "Lotus" and "Lotus flower" as Traditional in many books (LaFosse,
  Yamaguchi, NOA). One sheet, 19 steps, no cuts or glue. **Clear.**
- **Boat.** Already in the catalog as Coming soon, with a Clear row in `PROVENANCE.md`. **Blocked by the
  engine**: its last step, pulling the diamond's points apart into a hull, needs the bend solver to reach a
  shape it can't reach yet, and its two diamond squashes pass paper through paper (`docs/bending-plan.md`, step 7;
  branch `wip/boat`).
- **Tulip.** Gami already has the flat tulip from two squares. OrigamiOK's is different: a 3D blossom, plus a pot
  and two leaves, four sheets in all. The blossom is the traditional water bomb tulip; the pot needs checking.
- **Cactus.** **Not open.** Gilad's lists 55 cactus designs, all with named designers (Kawasaki, Montroll,
  Petty, and others) except one "cactus seed holder". OrigamiOK names no designer for its own, and it takes three
  sheets, scissors and glue (the engine has cuts but no glue).
- **The rest of the page.** Many are already in Gami (crane, flapping bird, frog, plane, samurai hat, box, lily,
  crow, penguin, dog and cat faces, fish, fox, cicada, heart, cup, fan, sword, balloon, fortune teller, balloon
  rabbit). The new ones were checked against Gilad's:

  | Model | OrigamiOK | Gilad's database | Verdict |
  |---|---|---|---|
  | Crown | 1 sheet, 10 steps | 15+ plain "Crown" entries Traditional | Candidate |
  | Sailboat | 1 sheet, 11 steps | 16+ plain "Sailboat" entries Traditional | Candidate |
  | Lantern | 1 sheet, 10 steps | 12 plain "Lantern" entries Traditional (some with cuts) | Candidate |
  | Star box | 1 sheet | 26+ plain "Star box" entries Traditional | Candidate |
  | Peacock | 1 sheet, 25 steps | 5 plain "Peacock" entries Traditional (Robinson, Montroll, Yamaguchi) | Candidate |
  | Crab | 1 sheet, 19 steps | No Traditional crab in the parts read | Skip unless one turns up |
  | Pot plant | 8 sheets, scissors, glue | not checked | Skip: glue |
  | Others (pig face, mouse, dove, rooster, phoenix, furniture, Santa set, hats, leaf, grass, …) | | not checked | Later, if wanted |

  "Candidate" means a traditional model of that name exists. Before writing each recipe, check that OrigamiOK's
  fold sequence is the traditional one and not a named designer's version (Gilad's lists named versions of
  every one of them too).

## Phase 1: the New filter, sort and badge

No new models yet: this ships first, its chip hidden while nothing is new.

1. **Data** (`src/gallery/catalog.ts`).
   - `ModelInfo.added?: string`: the date a model shipped, `YYYY-MM-DD`. Backfill every shipped model from the
     "Added" column of `PROVENANCE.md`, so the sort has dates for all of them.
   - `NEW_SINCE = '2026-10-28'` and `isNew(m)`: shipped (`steps` set) and `added >= NEW_SINCE`. A cutoff date,
     not "the last 30 days": every model so far shipped between 16 and 23 October, so a rolling window would mark
     the whole gallery New. Move the cutoff forward to retire a batch's badges.
   - `Filter.onlyNew?: boolean` in `filterModels`.
   - `'newest'` in `SORTS`: by `added`, newest first, ties in catalog order, models with no date last.
2. **Gallery** (`src/routes/Gallery.tsx`). A **New** chip beside Favourites (`aria-pressed`), saved with the
   rest of the gallery's place. Hidden when no model is new. "Newest" in the sort menu.
3. **Badge** (`src/gallery/ModelCard.tsx`). A purple origami star, `OrigamiStarIcon` in `src/app/icons.tsx`
   drawn like `OrigamiHeartIcon`, in a corner of the card's picture, with "New" for screen readers. On a
   `PairCard`, on the half that's new. Its colour is a new token in `src/app/app.css` (`--new`, a purple apart
   from the indigo `--accent`), set again for dark mode in both places the other tokens are.
4. **Words.** `gallery.new` and `sorts.newest` in `en`, `es`, `fr` and `ja` (`src/i18n`).
5. **Tests.** `catalog.test.ts`: `isNew` needs steps and a date on or after the cutoff; `onlyNew` filters;
   `newest` sorts; every shipped model has an `added` date matching its `PROVENANCE.md` row. A gallery e2e check
   that the chip filters and the badge shows.
6. **Docs.** The gallery section of `PLAN.md` (4.1) and a decisions-log line on the cutoff.

## The routine for each model

As in `docs/origami-me-plan.md` (licence row first with the `record-model-licence` skill; recipe; `npm run
models`; no crossings; catalog entry; Japanese, Spanish and French steps; `npm test` and `npm run typecheck`;
look at it in the viewer), plus: set `added` to the day it ships, so it's New.

## Order

Easiest first, by what the engine already does. Each can ship alone.

| Phase | Model | Expected engine fit | Risk |
|---|---|---|---|
| 2 | **Crown** | Flat valley and mountain folds. | Low |
| 3 | **Sailboat** | Flat folds, as the swan and fish. | Low |
| 4 | **Lotus** (requested) | Corners to the centre three times (the fortune teller's blintz), then each corner pulled out from underneath and turned up into a petal. That last move is 3D, paper coming round from behind: posed with `shape`'s `chained`, as the masu box's walls, or stopped at a flat lotus. | Medium–high |
| 5 | **3D tulip** (requested) | A separate model from the flat tulip (id `tulip-bloom`). The blossom: water bomb base (in the lily), corners up, one flap tucked into the other, blown up, petals peeled down. Blowing up hit the same limit as the balloon (a pillow, not a ball). Leaves from a second square; the pot only if it checks out as traditional. | Medium–high |
| 6 | **Star box** | A collapse, then the box opened up with `chained`, as the masu box. | Medium |
| 7 | **Lantern** | Check first whether OrigamiOK's has cuts (Gilad's traditional lanterns sometimes do); `Recipe.cut` handles them. | Medium |
| 8 | **Peacock** | Flat folds and a pleated tail, then the tail fanned out (the fan's open problem; stop with it pleated if needed). | Medium |
| Later | **Boat** (requested) | Waits for bending (`docs/bending-plan.md` step 7). Already listed as Coming soon; it becomes New the day it ships. | Blocked |
| — | **Cactus** (requested) | Not open. See below. | — |

## Decisions (28 October 2026)

- **Cactus.** Gami's own, keeping the general look: a ribbed body in a pot with a flower on top, from three squares,
  no glue or scissors.
- **Tulip.** Both: the 3D tulip shares a split card with the flat one (`PAIRS`).
- **Extras.** Crown, sailboat and peacock. Not the star box or lantern, for now.

## Progress

| Phase | Status |
|---|---|
| 1. New filter, sort and badge | Done. The star and chip are purple (`--new`), in light and dark. |
| Crown | Done, Gami's own: a triangle with its bottom corners folded up into leaning points, the bottom behind. OrigamiOK's opens into a band, which the engine can't pose. |
| Sailboat | Done, Gami's own: the hull folded up, the top left half behind for the sail, the ends slanted. OrigamiOK's steps lean on photos for where its folds go. |
| Lotus | Done, simplified: three rounds of corners to the middle, then the last round's corners lifted as four curling petals. OrigamiOK's back fold and pulled-out petals curl paper round folds, which rigid paper can't. |
| 3D tulip | Done (`tulip-bloom`): water bomb base, corners up, sides overlapped and tucked, blown up like the balloon. Its card shows it before blowing up, as the bent mesh draws speckled. The petals aren't peeled down; the leaves and pot are left out. |
| Peacock | Done, Gami's own, from two squares: a green fan for the tail and a blue kite narrowed into a neck, set in front. OrigamiOK's eight-feather fan can't open in the engine, and one square leaves only a third of the paper for a tail. |
| Cactus | Done, Gami's own (see Decisions). |
| Star box, lantern | Not planned for now. |
| Boat | Still waits for bending. |
