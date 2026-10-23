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
| **F. Box** | masu box | Done (the box and its classic lid; the shallow lid is to come). Its walls, corners and locking ends are posed crease by crease with `shape`'s `chained` (October 2026), in three moves as origami.me does. |

## Progress

| Model | Status |
|---|---|
| Penguin, whale, crow, Christmas tree, water bomb, flapping bird, balloon rabbit, pinwheel, butterfly, dolphin | Done. The whale's fins are bent out in 3D: the diagrams swing them below the belly, which tears with rigid paper. The water bomb and balloon rabbit end flat, ready to blow up. |
| Dolphin | Done, with scissor cuts now in the engine (`Recipe.cut`). Its last step, a swivel fold raising the dorsal fin above the back, tears with rigid paper (the flaps are hinged across the body, as in the whale), so both flaps are bent out from the sides in 3D instead. |
| Fish | Done (9 steps). origami.me places most folds by eye, so Gami chose its own: the back fin folds up on a line two fifths of the way down the triangle, the belly flap folds up edge to crease (22.5°) and back down 15° below that line, the tail stands straight up and its tip folds back on a line to the middle of its side, and the head folds the top left corner onto the lowest point. No paper passes through paper. |
| Pajarita | Done (18 steps), after origami.me: the double blintz creased and opened right out, then the windmill base's moves on the whole sheet one corner at a time (`cornerCreases` from `windmill.ts`): the right edge in and its bottom swung out sideways, the top left corner behind, the left edge in with the bottom left pulled down into a point (the windmill's creases, given on the table, since the bottom edge is already folded up there), the top right swung out sideways, then turned over and folded in half along the diagonal, the coloured square folding into the head. No paper passes through paper. It turned out not to need `Recipe.swivel`: origami.me's swivels here are the windmill's squashes. |
| Fan | Stays coming soon. It folds as far as the pleats locked by the flap (on the `wip/fan` branch, after origami.me: sixteen strips, pleated with the first strip as a flap, folded in half, the flap's corners in and the flap closed), but it can't be opened with rigid paper. Folded in half, each pleat is a doubled panel whose halves lie in opposite orders in the stack, so opening its fold would turn them opposite ways though they're joined along the half fold; a real fan swings its pleats round the closed end into a half circle, which bends the creases. Single-layer pleats do open, into a zigzag (`shape` with `chained`). |
| Masu box | Done (22 steps), the box without a lid, after origami.me/box: the corners to the middle, the ends creased and opened out, the sides creased, then posed crease by crease (`shape` with `chained`): the walls up with each corner square folding along its diagonal (its end-wall half right over onto the end wall's inside, its side-wall half turned in onto that), then each end flap over the end wall into the box, its outer triangles tucked under it and its point on the floor. No paper passes through paper. The classic lid is its own gallery model (`masu-lid`, 22 steps): the same recipe with each corner folded 0.02 short of the middle (about 3 mm on a 15 cm sheet, as origami.me suggests a small gap), so the box comes out a little bigger. It ends open side up, like the box: turned over, its floor's outside lies one layer's thickness (0.0007) from the points folded in on it, and the viewer, drawing every layer with the same depth offset, can't keep those apart (the box has the same gap, but both faces there are one colour). The shallow lid is left (tried October 2026): its crease pattern is the box's with a larger floor and low walls (each edge creased to 4 mm short of the middle, then to that crease), side rims folded in over the side walls (they land exactly on them), and end flaps that turn onto the floor exactly on the square's edge crease and cross in the middle. The box's crease-by-crease posing, given the new floor and walls, comes apart at the corners: there the rims lie over the corner squares, and origami.me folds each corner's diagonal through every layer, rims included. Posing needs its own rules for the rims at the corners, and a little slack for layers turned about creases at different heights (joined faces end up a few layer gaps apart). |
| (windmill squash) | Shared in `windmill.ts`: an end of the cupboard fold squashed with each corner pulled out sideways or along the sheet. The butterfly ends with its wings lifted in 3D instead of origami.me's last body fold, which tears with rigid paper. |
| Frog, iris | The frog is done (55 steps). The frog base is shared in `frog-base.ts`. The earlier "squashes" weren't squashes: both halves of each flap landed on one side. A real squash opens the flap along its spine (crease kinds by search: one side's 22.5° crease mountain and its quarter's diagonal valley, the other side's valley, the spine opened flat), with a page turn between the second and third, as origami.me does. The petal fold then lifts the squashed coloured layer, not the white corners: the edge's middle rises above the line across the kite creases' tops, its corners fold in to the centre on lines to that middle, the white edges fold in on the kite creases, and the squash creases below open flat. The narrowing turns whole quarters as pages, so each leg is a quarter folded in half. The knees take each leg's paper by its length from the corner on the sheet, the feet by lying along the leg on the table. Left: the front legs' lifts and knees graze the other front quarter's paper, by up to 0.049; folding only the leg there leaves it joined to the body, so it doesn't move. |
| Iris | Stays coming soon; work so far on the `wip/iris` branch (October 2026). After origami.me, each flap in turn is petal-folded, its petal folded down along the hinge, and its kite flaps swivelled out (`Recipe.swivel`, 22.5° so their edges run straight down, the pleat limited to the rest of the flap's quarter). The first two flaps fold, and the third flap's petal fold and petal now do too: its petal fold opens out the pleats the first two swivels left in its pages (the only crease kinds a search found to fold flat). The third flap's swivel works on one side but not the other: there the neighbouring flap is already petal-folded and narrowed, so nothing lies beyond the kite crease for the kite flap to swing across. Real paper flexes to give it; rigid paper can't, and whatever the order, the last two flaps each have a narrowed neighbour. Swivelling after the whole frog base fails for the same reason. |

## Done when

Every model above has a recipe, translated steps, a finished `PROVENANCE.md` row and no "Coming soon"
badge, and the tests pass. Anything that can't be made yet stays "Coming soon" with the reason noted
in the decisions log, as with the boat.
