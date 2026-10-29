# Plan: easy folds from OrigamiOK

A second batch from OrigamiOK, this time from its [easy origami](https://origamiok.com/easy-origami/) page: 24
requested models. Like `docs/origamiok-plan.md`, each phase ships on its own, in its own commit, and every
model is marked New on its card (its `added` date is on or after `NEW_SINCE`).

## What was found (28 October 2026)

- **Still no credits, with one exception.** As before, OrigamiOK's pages give no licence and, with one exception,
  no designer: the dice page credits **Stéphane Gigandet**. So each model's status comes from
  [Gilad's database](https://www.giladorigami.com/origami-database/jellyfish) (search results are at
  `/origami-database/<name>`). Gami follows the order of folds only and copies none of OrigamiOK's text or photos.
- **Three are already done.** The sailboat and crown shipped on 28 October as Gami's own designs (OrigamiOK's
  needed its photos to place the folds, and its crown opens into a band). Gami's own sword shipped on 18 October.
- **What the engine lacks.** Many of these models use **glue** (pyramid, diamond, kunai, knife, palm leaf, the
  two-sheet spinning top, the frog bookmark's eyes). The engine has no glue: Gami's versions hold with a tuck
  or lock, or just end posed. Some **roll paper into tubes or spirals** (kunai handle, knife sheath, jellyfish
  tentacles), which rigid faces can't do. Some **close into a band** (bracelet, ring, finger trap), which waits
  on bending (`docs/bending-plan.md`). It does have scissor cuts, several sheets and a pen for drawing.
- **The 24, checked:**

  | Model | OrigamiOK | Gilad's database | Verdict |
  |---|---|---|---|
  | Pirate hat | A4 sheet, 6 folds, then decorate | The traditional **newspaper hat** (Traditional in Van Sicklen's *Joy of Origami* and Beech); OrigamiOK's folds match it | **Clear** |
  | Frog bookmark | 1 sheet, cuts, glued eyes, drawn face | The corner bookmark it's built on is widely taught with no credit; Gilad's has named corner bookmarks (Cunliffe, Ng) | Likely Clear for the corner; the frog face Gami's own |
  | Basic cube | 6 sheets, units tucked together, no glue | Traditional cubes listed (box cube, business card cube); this simple six-panel cube not found by name | Check; likely Clear |
  | Bracelet | 1 sheet, pleated strip, ends tucked | 4 plain "Bracelet" entries Traditional (Jackson, NOA, Sok Song) | Candidate |
  | Spinning top | 2 sheets + glue, or 3-sheet modular | 1 Traditional "Spinning top" (*Atlas de l'Origami*), 55 named | Check the 3-sheet one |
  | Pyramid | 1 sheet, 9 steps, glued | 300 results; one Traditional candy box (pyramid) | Check |
  | Fan | 10 cm sheet, 16 steps | Already in Gami as Coming soon, traditional (origami.me's pleated fan) | Use Gami's planned fan |
  | Heart bookmark | half sheet, 22 steps | Heart bookmarks by Shumakov, Shinde, Yamaguchi | Check which, else Gami's own |
  | Diamond ring | strip from a square, 17 steps | 2,000 "ring" results, none found to match | Check, else Gami's own |
  | Rose | 1 sheet, 25 steps, "abstract" | Not checked (too many roses); OrigamiOK says it isn't the traditional rose | Check, else Gami's own |
  | Palm leaf | half triangle, pleats, glued | "Palm leaf" by Mark Bolitho; Traditional only for palm crosses | Check, else Gami's own |
  | Green leaf | half triangle, cut, 21 steps | Not checked by name | Check, else Gami's own |
  | Cute cat | half sheet, 18 steps | Not checked (thousands of cats) | Check, else Gami's own |
  | Bull | 1 sheet, 17 steps | 276 results; the only Traditional one is the *akabeko*, a different model | Gami's own |
  | Bat | 1 sheet, 19 steps | 1,186 results, no Traditional found | Gami's own |
  | T-rex | 1 sheet, 21 steps | 221 results, no Traditional | Gami's own |
  | Jellyfish | 1 sheet, 24 steps, spiral tentacles | 74 results, all named | **Not open**: Gami's own |
  | Finger trap | 1 sheet, cuts | 2 results, both named (Pedruzzi, Garibi) | **Not open**: Gami's own |
  | Dice | 1 sheet cut into strips | Page credits Stéphane Gigandet | **Not open**: Gami's own, from the basic cube |
  | Knife | 3 sheets, cuts, glue, rolled sheath | Only the Traditional *throwing knife*, a different model | Gami's own, one sheet |
  | Kunai | 3 sheets, glue, rolled handle | No results | Gami's own, one sheet |
  | Easy sword | 1 sheet, 9 steps | 95 results, no Traditional | Gami already has its own sword |
  | Sailboat, crown | | | Already shipped |

  "Check" means the model wasn't settled from search results alone: run the `record-model-licence` skill at the
  start of its phase. "Gami's own" follows the decision on the cactus: keep the general look, fold it
  differently, licence it CC BY 4.0 in `DESIGNS-LICENSE.md`.

## The routine for each model

As in `docs/origamiok-plan.md`: licence row first (`record-model-licence`); recipe in `src/models/recipes`;
`npm run models`; no crossings; catalog entry with `added` set to the ship date; Japanese, Spanish and French
steps; `npm test` and `npm run typecheck`; look at it in the viewer. Where OrigamiOK glues, Gami tucks, locks or
leaves it posed, and says so in the step. Where it draws a face, use the pen (the card then shows it).

## Order

Easiest and clearest first. Each phase can ship alone, and models within a phase are independent.

| Phase | Models | Engine fit | Risk |
|---|---|---|---|
| 1. **Flat and clear** | Pirate hat, frog bookmark, heart bookmark | Flat folds on a rectangle (the king bee already starts on letter paper). The frog's eyes become folded-up flaps instead of glued cut-outs, and its nose and mouth are drawn. | Low |
| 2. **Flat animals** | Cute cat, bat, bull, T-rex | Flat folds, reverse folds and squashes, as the fox, swan and dolphin. Mostly Gami's own, so the steps can be shaped around what the engine does well. | Low–medium |
| 3. **Weapons** | Knife, kunai | One sheet each, no glue or rolled handles: a narrowed blade and a folded-flat grip. Different enough from Gami's sword (`sword`) to stand apart; check that against its recipe first. | Medium |
| 4. **Leaves, fan and rose** | Fan, palm leaf, green leaf, rose | The fan (Coming soon) and palm leaf are pleats spread with `shape`, the fan's open problem; stop pleated if needed and ship both together. The green leaf is pleats on a cut triangle. The rose starts from the water bomb base (lily, tulip blossom) and twists, so it goes last. | Medium–high |
| 5. **Solids** | Basic cube, dice, pyramid, diamond, spinning top | 3D, posed with `shape`'s `chained` as the masu box. The cube is six simple units slotted together; the dice is the same cube with pips drawn on (in place of Gigandet's). The pyramid and diamond hold with a tuck instead of glue. The three-sheet spinning top interlocks like the ninja star, then stands up; a spin animation is a bonus. | High |
| Later | Bracelet, diamond ring, finger trap | Each is folded flat as a strip, then closed into a band or tube. Closing waits on bending (`docs/bending-plan.md`). The flat part could ship sooner, ending "tuck one end into the other", as the fortune teller ends before it's played. | Blocked |
| — | Easy sword, sailboat, crown | Already in Gami. | — |

## Open questions

- **Easy sword.** Gami has its own sword already. Skip OrigamiOK's, or add it as a second sword? Planned: skip.
- **The New cutoff.** Every model in this batch will show as New beside the 28 October batch. Move `NEW_SINCE`
  forward when phase 1 ships if the older batch should stop being New.

## Progress

| Phase | Status |
|---|---|
| 1. Flat and clear | Done. The **pirate hat** is the traditional newspaper hat on upright A4, its band folded up twice (OrigamiOK folds it once), with a skull and crossbones drawn in halves where the corners meet. It ends flat; opening it to wear is left to the last step's words. The **frog bookmark** is Gami's own: the corner bookmark with its flaps' points folded out past the sides for eyes, no scissors or glue. The **heart bookmark** is Gami's own too, a heart on the corner bookmark rather than OrigamiOK's heart on a long strip, whose squash folds come from a named design we couldn't trace: the top point folded behind, the flaps' points folded down for the notch, the humps and sides rounded. The two bookmarks share a card (`PAIRS`). |
| 2. Flat animals | Done, all four Gami's own. The **cute cat** is two squares: a tall kite for the body, its bottom point folded up behind for the tail, and the cat face on top. The **bat** is a water bomb base with its bottom corners folded up into wings either side of the point. Raising a triangle's corners above its fold edge isn't possible with one flat fold, which ruled out a bat from a plain triangle. The **bull** is a body folded in half with two snips and its belly folded up behind, leaving four legs, and a head folded like the heart bookmark, its humps standing up as horns. Horns folded from a triangle's top corners can't rise past the top edge. The **T-rex** is a kite folded in half and laid on its side (tail, body, legs) with a separate head from a small square, an eye and teeth drawn on. Raising a neck from the kite with reverse folds swallowed the legs corner. The bull's snips turned up an engine bug, now fixed: a cut further along the same line counted against an edge's cut. |
| 3. Weapons | Done, both Gami's own. The **knife** is half a square folded to the middle twice into a strip, one end's corner folded behind into a slanted tip, the other end rolled over twice for the handle and coloured in with a pen. Once a strip's edges meet in the middle, only one side of one-sided paper shows anywhere, so rolling can't bring up the other colour. It has no crossguard, which keeps it apart from Gami's sword. The **kunai** is two pieces: a square folded into a long-pointed diamond with its bottom point folded behind, and a strip folded thin for the handle, slipped under. A single kite only tapers, so it can't give a wide blade and a straight handle at once. The kunai's ring is left out. |
| 4. Leaves, fan and rose | Hand fan and rose done, both Gami's own. OrigamiOK's fan turned out to be a flat paddle fan (an uchiwa), not the pleated one, so it's a new model (`hand-fan`): a square with its corners folded behind and a strip folded thin for the handle. A kite's flaps cover too much of it to leave a big paddle with a small white handle. The pleated `fan` stays Coming soon. The **rose** is flat: corners to the middle twice, each point folded back out turned the same way round, and the tips rounded behind, so the petals spiral. OrigamiOK's twist can't be folded with rigid paper. The palm and green leaves are next. |
| 5. Solids | Not started |
| Later: bands | Waits for bending |
