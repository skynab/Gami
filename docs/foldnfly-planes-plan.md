# Plan: more planes from Fold'N Fly

Five requested planes from Fold'N Fly: the Fun Flyer (#45), the Sprinter (#4), the Spin Plane (#15), the Navy
Plane (#35) and the UFO (#13). As with the OrigamiOK batches, each phase ships on its own, in its own commit, and
every new plane is marked New on its card (its `added` date is on or after `NEW_SINCE`).

## What was found (29 October 2026)

- **No credits on the pages.** Like the navy plane and king bee (checked 21 October), none of the five names a
  designer or gives a licence, only a copyright notice for the site. Gilad's database covers origami, not paper
  planes, so it can't settle them. But three pages list **References**, books on paper planes, and two of those
  lists point to a single book, which is a lead to a designer:

  | Plane | Fold'N Fly | References on the page | Verdict |
  |---|---|---|---|
  | Navy plane (#35) | 19 folds, letter paper | | **Already shipped** (21 Oct 2026), Unattributed |
  | Sprinter (#4) | Medium, 7 folds, letter or A4; a diagonal fold, a narrow hem, a tall tail fin; staples in the nose | Four general books: Laux's *World's Greatest Paper Airplane and Toy Book*, *Paper Flight*, *Flying Origami*, *High-Flying Paper Airplanes* | **Unattributed**, like the navy plane: four books by different authors, none named as the source |
  | Fun Flyer (#45) | Hard, 13 folds, letter or A4; a water bomb base at the top, then an accordion collapse | None (only the site's own book, under "Of Interest") | **Unattributed**. If it turns out to be Fold'N Fly's own design, it's theirs: credit it, or swap it for Gami's own |
  | Spin Plane (#15) | Hard, 11 folds, letter or A4; the same water bomb start; cockpit flaps; stapled | Only Keith Laux's *World's Greatest Paper Airplane and Toy Book* (1987), a book of Laux's own designs. Its listed contents include a "Spin King", not a Spin Plane | **Likely Laux's**: Gami's own spinning plane, unless the book shows otherwise |
  | UFO (#13) | Medium, 7 folds, letter or A4; one corner cut round; long rounded wings | Only the *Kids' Paper Airplane Book* (Workman, 1996): "planes engineered by Ken Blackburn & Jeff Lammers" | **Not open**: Blackburn and Lammers's book of their own planes. Gami's own flying saucer |

  "Gami's own" follows the decision on the cactus: keep the general look, fold it differently, licence it CC BY
  4.0 in `DESIGNS-LICENSE.md`.

- **What the engine lacks.** There's no stapler (`Tool` is scissors, pen or tape). The Sprinter's staples are
  optional weight, so its last step can suggest them without a tool on the card; the Spin Plane's staple holds
  the body shut, so Gami's spinning plane uses tape or a lock fold. Cuts are straight (`cut(from, to)`), so the
  UFO's rounded corner can't be cut in one; Gami's saucer rounds its edge with small folds behind, as the rose
  rounds its tips, and needs no scissors.

## The routine for each plane

As in `docs/origamiok-plan.md`: licence row first (`record-model-licence`), adding to the Fold'N Fly note in
`PROVENANCE.md`; recipe in `src/models/recipes`; `npm run models`; no crossings; catalog entry in the `plane`
category with `added` set to the ship date; Japanese, Spanish and French steps; `npm test` and
`npm run typecheck`; look at it in the viewer. Planes start on letter paper held as Gami's other Fold'N Fly
planes are (1 : 0.77, as `navy-plane`). Gami follows only the order of folds, in its own words and pictures.

`finishPlane` (`paper-plane.ts`) folds in half along the sheet's centre and opens the wings. That suits planes
that are symmetric about the middle of the sheet (Fun Flyer, Spin Plane, the UFO). The Sprinter's first fold is
across the diagonal, so its body isn't on the sheet's centre line: it needs its own finish, or `finishPlane`
taught a centre line.

## Order

Easiest and clearest first. Each phase can ship alone.

| Phase | Plane | Engine fit | Risk |
|---|---|---|---|
| 1. **Sprinter** | Sprinter | Plain flat folds: one corner onto the opposite corner (on a rectangle that's the diagonal's perpendicular, not the diagonal), a narrow hem along the long edge, folded in half and the wings down, a tail fin left standing. The off-centre body is the only new thing. | Low |
| 2. **Fun Flyer** | Fun Flyer | A water bomb base on the top of a rectangle (`collapse`, as the balloon and bat), its ends folded up into a diamond, pre-creases, then an accordion collapse that pinches the middle up: a sink-like `collapse` with small flaps standing up in front. The collapse is the hard part; if it won't fold rigidly, stop and make it Gami's own. | Medium–high |
| 3. **Spinning plane** | Gami's own, after the Spin Plane | Reuses phase 2's water bomb start. Keeps the look: a stubby dart with a cockpit of two flaps standing up, which spins and corkscrews. Folded differently from Laux's sequence, held with a lock fold or tape. | Medium |
| 4. **Flying saucer** | Gami's own, after the UFO | A broad, round-edged wing for slow wide circles: the dart's nose folded down short, its corners folded in, the edges rounded with small folds behind, then a short body. No scissors. Needs a new name (not "UFO" if that reads as Blackburn's). | Medium |
| Later | Navy plane's tail flaps | Shipped without its two tail flaps, each of which runs across the wing fold (see `PROVENANCE.md`). `shape` now spreads a turn over many small bends (the bracelet's curl), which may let a flap rise a little across that fold. | Optional |

## Open questions

- **The Spin Plane.** Gami treats it as Laux's because his book is its only reference. If the book's contents
  show no such plane, it could be Unattributed and follow Fold'N Fly's sequence like the navy plane.
- **Names.** Gami's own spinning plane and saucer should have names of their own, so they don't pass for
  Laux's or Blackburn's.

## Progress

| Phase | Status |
|---|---|
| 1. Sprinter | Done, Unattributed, after Fold'N Fly's sequence. The corner-to-corner fold creases at right angles to the diagonal; the halving fold runs along the diagonal itself; each layer then folds back along the line halving the thick corner, so the outer layers are the wings and the inner ones the fin. `foldWings` (the second half of `finishPlane`) now takes the two wings' paper, and with `fin` lifts the paper of neither past the wing line with the body (it turns down through the table until the plane turns over). The other planes' files are unchanged. The staples are suggested in the last step, not needed. |
| 2. Fun Flyer | Done, Unattributed, after Fold'N Fly's sequence without its rabbit ears. Each of the diamond's flaps is joined to the layers under it along its bottom edge, which the rabbit ear folds, so rigid paper can't follow; the flaps' tips stick out in front as they are. So the point folds down a quarter of the way (Fold'N Fly: halfway) to keep the tips small, and the wings fold from just above them along a line slanting a little towards the tail. `foldWings` takes a `tail` for that slant: turning over mirrors a slanting line, so the second wing and the opening use its mirror image. |
| 3. Spinning plane | Not started |
| 4. Flying saucer | Not started |
| Later: navy plane's tail flaps | Not started |
