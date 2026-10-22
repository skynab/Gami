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
| **F. Box** | masu box | Two sheets (box and lid). The walls rising together use `shape`'s `corners` (October 2026): bends whose lines cross rise together, each corner pinching into an ear along its diagonal. Folding the ears flat against the walls and locking the top edges over them is the model's work. |

## Progress

| Model | Status |
|---|---|
| Penguin, whale, crow, Christmas tree, water bomb, flapping bird, balloon rabbit, pinwheel, butterfly, dolphin | Done. The whale's fins are bent out in 3D: the diagrams swing them below the belly, which tears with rigid paper. The water bomb and balloon rabbit end flat, ready to blow up. |
| Dolphin | Done, with scissor cuts now in the engine (`Recipe.cut`). Its last step, a swivel fold raising the dorsal fin above the back, tears with rigid paper (the flaps are hinged across the body, as in the whale), so both flaps are bent out from the sides in 3D instead. |
| Fish | Waiting: its folds are placed by eye ("this sets the tail size"), so exact reference points need choosing first. |
| Pajarita | Waiting: built from swivel folds that move several flaps at once. The engine now has swivel folds (`Recipe.swivel`, October 2026): a flap swings flat about a pivot on its hinge, the paper it crosses pleating into a gusset. What's left is the model: finding each swivel's pivot, hinge and angle on the blintzed base. |
| Fan | Waiting on the model, not the engine. The pleating works, and `shape` can now open stacked pleats along the paper (`chained`, October 2026), each fold opening by its own angle, so the pleats spread into a zigzag. A true half circle turns the pleats round one point, which rigid paper can't do; the zigzag is the rigid version. |
| (windmill squash) | Shared in `windmill.ts`: an end of the cupboard fold squashed with each corner pulled out sideways or along the sheet. The butterfly ends with its wings lifted in 3D instead of origami.me's last body fold, which tears with rigid paper. |
| Frog, iris | The frog is done (55 steps). The frog base is shared in `frog-base.ts`. The earlier "squashes" weren't squashes: both halves of each flap landed on one side. A real squash opens the flap along its spine (crease kinds by search: one side's 22.5° crease mountain and its quarter's diagonal valley, the other side's valley, the spine opened flat), with a page turn between the second and third, as origami.me does. The petal fold then lifts the squashed coloured layer, not the white corners: the edge's middle rises above the line across the kite creases' tops, its corners fold in to the centre on lines to that middle, the white edges fold in on the kite creases, and the squash creases below open flat. The narrowing turns whole quarters as pages, so each leg is a quarter folded in half. The knees take each leg's paper by its length from the corner on the sheet, the feet by lying along the leg on the table. Left: the front legs' lifts and knees graze the other front quarter's paper, by up to 0.049; folding only the leg there leaves it joined to the body, so it doesn't move. The iris still needs a swivel fold per flap. |

## Done when

Every model above has a recipe, translated steps, a finished `PROVENANCE.md` row and no "Coming soon"
badge, and the tests pass. Anything that can't be made yet stays "Coming soon" with the reason noted
in the decisions log, as with the boat.
