# Plan: the 16 traditional models from origami.me

The water bomb, balloon rabbit, flapping bird, frog, penguin, whale, fish, dolphin, crow, butterfly,
pajarita, iris, pinwheel, fan, masu box and Christmas tree are in the gallery as "Coming soon"
(`src/gallery/catalog.ts`). Each is credited "Traditional" on origami.me, whose licensing page says nobody
owns a traditional design (see `PROVENANCE.md`). This plan turns them into folding models.

## The routine for each model

1. Read the origami.me tutorial for the **order of folds only**. Write every step in Gami's own words and
   copy no text or pictures (origami.me keeps its diagrams under copyright).
2. Recipe in `src/models/recipes/<id>.ts`, added to `RECIPES` in `src/models/recipes/index.ts`.
3. `npm run models` to write `public/models/<id>.fold`, `<id>.svg` and `<id>-preview.svg`.
4. `crossings` kept at zero, or a note in the decisions log if paper grazes.
5. In `src/gallery/catalog.ts`, set `steps` and move the entry up out of "Coming soon"; check the difficulty,
   minutes and sheets guesses.
6. Translate each new step into Japanese, Spanish and French (`src/i18n/steps`).
7. In `PROVENANCE.md`, set the row's reference and the date it shipped (the `record-model-licence` skill).
8. `npm test` and `npm run typecheck`, then look at it in the viewer.
9. Milestone row in `PLAN.md` once the group is done; commit per model.

## Order

Easiest first, grouped by what the engine already has. Each group can ship on its own.

| Group | Models | Engine fit |
|---|---|---|
| **A. Flat folds** | fish, penguin, whale, crow, Christmas tree, dolphin | Valley, mountain and edge-to-edge folds, plus inside reverse folds as in the swan. Nothing new expected. |
| **B. From the blintz** | pajarita | Corners to the centre (fortune teller), then a collapse and a pulled-out head and tail. |
| **C. Water bomb base** | butterfly, water bomb, balloon rabbit | The base is in the lily. The water bomb and rabbit end blown up into a 3D ball: try `popUp`, or a final `shape`; if neither fits, stop at the flat state and say "blow into the hole" (as the fortune teller ends). |
| **D. Bird and frog bases** | flapping bird, frog, iris | The crane has the bird base, the lily the frog base's squash and petal folds. The frog's legs need many reverse folds; the iris narrows like the lily. |
| **E. Squash folds and pleats** | pinwheel, fan | The pinwheel: cupboard folds, then four squashes into the windmill base. The fan: a row of alternating pleats, then `shape` to spread it. |
| **F. Box** | masu box | Two sheets (box and lid). The walls rising together need the "several bends meeting at the corners" `shape` addition noted in `docs/bogota-2013-plan.md`. Last, as it needs new engine work. |

## Progress

| Model | Status |
|---|---|
| Penguin, whale, crow, Christmas tree, water bomb, flapping bird, balloon rabbit, pinwheel, butterfly | Done. The whale's fins are bent out in 3D: the diagrams swing them below the belly, which tears with rigid paper. The water bomb and balloon rabbit end flat, ready to blow up. |
| Dolphin | Blocked: origami.me's version needs a cut (step 11), and the engine has no scissors. Look for an uncut traditional dolphin, or cuts in the engine. |
| Fish | Waiting: its folds are placed by eye ("this sets the tail size"), so exact reference points need choosing first. |
| Pajarita | Waiting: built from swivel folds that move several flaps at once; needs a crease search like the fish base's. |
| Fan | Waiting: the pleating works, but the fan's point is spreading into a half circle, which turns the pleats round one point and can't be done with rigid paper. Spreading it as a zigzag with `shape` didn't work either: bends on a stack of pleats whose creases lie on top of each other don't chain. Needs `shape` to handle that, or stays coming soon. |
| (windmill squash) | Shared in `windmill.ts`: an end of the cupboard fold squashed with each corner pulled out sideways or along the sheet. The butterfly ends with its wings lifted in 3D instead of origami.me's last body fold, which tears with rigid paper. |
| Frog, iris | Half way. The frog base's squashes are found: from the square base (as in `bird-base.ts`, turned 135°), each flap (half of each quarter either side of a midline, its spine that midline) squashes flat with two valley creases from the centre at 22.5° either side of the spine; the four squash in many orders with no paper through paper (e.g. −v, turn over, −u, +v, turn over, +u). The petal folds that follow aren't found yet: the frog base is a long diamond (centre line x = −0.104, point at z = −0.604, widest at z = −0.104, the sheet's corners at (−0.104, 0.104)), and searches over the horizontal at z = −0.25, the kite lines from the bottom point, and opening the squash creases found nothing. Each squashed flap's two bottom corners are separate raw edges, unlike the crane's petal. The iris also needs a swivel fold per flap. |

## Done when

Every model above has a recipe, translated steps, a finished `PROVENANCE.md` row and no "Coming soon"
badge, and the tests pass. Anything that can't be made yet stays "Coming soon" with the reason noted
in the decisions log, as with the boat.
